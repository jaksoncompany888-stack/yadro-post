"""
Yadro v0 - Condition Evaluator

Safe expression evaluator for CONDITION steps.
No eval(), no exec(). Hand-written tokenizer + recursive descent parser.

Supported grammar:
    expression  := comparison (("and" | "or") comparison)*
    comparison  := accessor OP value
                 | accessor ("is_null" | "is_not_null")
                 | "true" | "false"
    accessor    := "result" ("." IDENT)+
                 | "len(" accessor ")"          <- only allowed function
    OP          := "==" | "!=" | ">" | "<" | ">=" | "<=" | "contains"
    value       := STRING | NUMBER | "true" | "false" | "null"

Examples:
    result.success == true
    result.error is_null
    result.error is_not_null
    len(result.text) > 100
    result.status == "completed" and result.score > 50
"""

import re
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Token types
# ---------------------------------------------------------------------------

_TOKEN_PATTERNS = [
    ("NUMBER",    r'-?\d+(\.\d+)?'),
    ("STRING",    r'"[^"]*"'),
    ("OP_GE",     r'>='),
    ("OP_LE",     r'<='),
    ("OP_EQ",     r'=='),
    ("OP_NE",     r'!='),
    ("OP_GT",     r'>'),
    ("OP_LT",     r'<'),
    ("LPAREN",    r'\('),
    ("RPAREN",    r'\)'),
    ("DOT",       r'\.'),
    ("IDENT",     r'[A-Za-z_][A-Za-z0-9_]*'),
    ("WS",        r'\s+'),
]

_TOKEN_RE = re.compile("|".join(f"(?P<{name}>{pat})" for name, pat in _TOKEN_PATTERNS))


def _tokenize(expr: str) -> List[Tuple[str, str]]:
    """Tokenize expression string. Returns [(type, value), ...]."""
    tokens: List[Tuple[str, str]] = []
    pos = 0
    for m in _TOKEN_RE.finditer(expr):
        if m.start() != pos:
            raise ValueError(f"Unexpected character at position {pos}: '{expr[pos:]}'")
        pos = m.end()
        kind = m.lastgroup
        value = m.group()
        if kind == "WS":
            continue
        # NUMBER group has a sub-group for decimals — collapse
        if kind == "NUMBER":
            tokens.append(("NUMBER", value))
        else:
            tokens.append((kind, value))
    if pos != len(expr):
        raise ValueError(f"Unexpected character at position {pos}: '{expr[pos:]}'")
    return tokens


# ---------------------------------------------------------------------------
# Evaluator
# ---------------------------------------------------------------------------

class ConditionEvaluator:
    """
    Thread-safe (stateless after init) condition evaluator.

    Args:
        step_results: context.step_results — Dict[step_id, result_dict]
    """

    def __init__(self, step_results: Dict[str, Any]):
        self._step_results = step_results

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def evaluate(self, condition: str, source_step_id: Optional[str] = None) -> bool:
        """
        Evaluate a condition expression.

        Args:
            condition: Expression string, e.g. "result.success == true"
            source_step_id: step_id whose result is bound as "result".
                            If None, uses the LAST entry in step_results.

        Returns:
            Boolean result.

        Raises:
            ValueError: If expression is malformed or references missing keys.
        """
        if not condition or condition.strip().lower() == "true":
            return True
        if condition.strip().lower() == "false":
            return False

        # Resolve the "result" root
        root = self._resolve_root(source_step_id)

        tokens = _tokenize(condition.strip())
        parser = _Parser(tokens, root)
        result = parser.parse_expression()

        if parser.pos != len(parser.tokens):
            raise ValueError(
                f"Unexpected token after position {parser.pos}: "
                f"{parser.tokens[parser.pos:]}"
            )

        return bool(result)

    # ------------------------------------------------------------------
    # Root resolution
    # ------------------------------------------------------------------

    def _resolve_root(self, source_step_id: Optional[str]) -> Any:
        """Get the result dict that 'result' maps to."""
        if source_step_id:
            if source_step_id not in self._step_results:
                raise ValueError(f"source_step_id '{source_step_id}' not in step_results")
            return self._step_results[source_step_id]

        # No explicit source — use last result
        if not self._step_results:
            raise ValueError("step_results is empty, cannot resolve 'result'")

        # Dict preserves insertion order in Python 3.7+
        last_key = list(self._step_results.keys())[-1]
        return self._step_results[last_key]


# ---------------------------------------------------------------------------
# Parser (recursive descent)
# ---------------------------------------------------------------------------

class _Parser:
    """
    Recursive descent parser for condition expressions.
    Operates on token list produced by _tokenize().
    """

    def __init__(self, tokens: List[Tuple[str, str]], root: Any):
        self.tokens = tokens
        self.pos = 0
        self._root = root  # The dict that "result" resolves to

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _peek(self) -> Optional[Tuple[str, str]]:
        if self.pos < len(self.tokens):
            return self.tokens[self.pos]
        return None

    def _advance(self) -> Tuple[str, str]:
        tok = self.tokens[self.pos]
        self.pos += 1
        return tok

    def _expect(self, kind: str, value: Optional[str] = None) -> Tuple[str, str]:
        tok = self._peek()
        if tok is None:
            raise ValueError(f"Expected {kind} but got end of expression")
        if tok[0] != kind or (value is not None and tok[1] != value):
            raise ValueError(f"Expected {kind}({value}) but got {tok}")
        return self._advance()

    def _match_ident(self, value: str) -> bool:
        """Check if current token is IDENT with given value (case-insensitive)."""
        tok = self._peek()
        return tok is not None and tok[0] == "IDENT" and tok[1].lower() == value

    # ------------------------------------------------------------------
    # Grammar rules
    # ------------------------------------------------------------------

    def parse_expression(self) -> bool:
        """expression := comparison (("and" | "or") comparison)*"""
        left = self.parse_comparison()

        while self._peek() and self._peek()[0] == "IDENT" and self._peek()[1].lower() in ("and", "or"):
            op = self._advance()[1].lower()
            right = self.parse_comparison()
            if op == "and":
                left = left and right
            else:
                left = left or right

        return left

    def parse_comparison(self) -> bool:
        """
        comparison := "true" | "false"
                    | accessor ("is_null" | "is_not_null")
                    | accessor OP value
        """
        # Literal true / false
        if self._match_ident("true"):
            self._advance()
            return True
        if self._match_ident("false"):
            self._advance()
            return False

        # Must be accessor [OP value | is_null | is_not_null]
        left_val = self.parse_accessor()

        # is_null / is_not_null
        if self._match_ident("is_null"):
            self._advance()
            return left_val is None
        if self._match_ident("is_not_null"):
            self._advance()
            return left_val is not None

        # Operator
        op = self._parse_operator()
        right_val = self.parse_value()

        return self._compare(left_val, op, right_val)

    def parse_accessor(self) -> Any:
        """
        accessor := "result" ("." IDENT)+
                  | "len(" accessor ")"
        """
        # len(...)
        if self._match_ident("len"):
            self._advance()                  # consume "len"
            self._expect("LPAREN")          # consume "("
            inner = self.parse_accessor()   # recurse
            self._expect("RPAREN")          # consume ")"
            if inner is None:
                return 0
            try:
                return len(inner)
            except TypeError:
                raise ValueError(f"len() applied to non-sized value: {type(inner)}")

        # result.path.to.field
        self._expect("IDENT", "result")
        current = self._root

        while self._peek() and self._peek()[0] == "DOT":
            self._advance()  # consume "."
            field_tok = self._expect("IDENT")
            field_name = field_tok[1]

            if current is None:
                return None  # short-circuit: None.anything → None

            if isinstance(current, dict):
                current = current.get(field_name)
            else:
                # Try attribute access as fallback
                current = getattr(current, field_name, None)

        return current

    def parse_value(self) -> Any:
        """value := STRING | NUMBER | "true" | "false" | "null" """
        tok = self._peek()
        if tok is None:
            raise ValueError("Expected value but got end of expression")

        if tok[0] == "STRING":
            self._advance()
            return tok[1][1:-1]  # strip quotes

        if tok[0] == "NUMBER":
            self._advance()
            if "." in tok[1]:
                return float(tok[1])
            return int(tok[1])

        if tok[0] == "IDENT":
            lower = tok[1].lower()
            if lower == "true":
                self._advance()
                return True
            if lower == "false":
                self._advance()
                return False
            if lower == "null":
                self._advance()
                return None

        raise ValueError(f"Expected value but got {tok}")

    def _parse_operator(self) -> str:
        """Parse comparison operator."""
        tok = self._peek()
        if tok is None:
            raise ValueError("Expected operator but got end of expression")

        op_map = {
            "OP_EQ": "==", "OP_NE": "!=",
            "OP_GT": ">",  "OP_LT": "<",
            "OP_GE": ">=", "OP_LE": "<=",
        }

        if tok[0] in op_map:
            self._advance()
            return op_map[tok[0]]

        # "contains" keyword
        if tok[0] == "IDENT" and tok[1].lower() == "contains":
            self._advance()
            return "contains"

        raise ValueError(f"Expected operator but got {tok}")

    @staticmethod
    def _compare(left: Any, op: str, right: Any) -> bool:
        """Safe comparison. Handles None and type mismatches."""
        if left is None and right is None:
            return op in ("==",)
        if left is None or right is None:
            # None != anything (except None above)
            return op == "!="

        if op == "contains":
            # left contains right (string or list)
            try:
                return right in left
            except TypeError:
                return False

        # Normalize types for numeric comparison
        if isinstance(left, (int, float)) and isinstance(right, (int, float)):
            pass  # keep as-is
        elif type(left) != type(right):
            # Try to coerce right to left's type for comparison
            try:
                if isinstance(left, (int, float)):
                    right = type(left)(right)
                elif isinstance(left, str):
                    right = str(right)
            except (ValueError, TypeError):
                if op in ("==", "!="):
                    return op == "!="
                raise ValueError(f"Cannot compare {type(left).__name__} {op} {type(right).__name__}")

        try:
            if op == "==":  return left == right
            if op == "!=":  return left != right
            if op == ">":   return left > right
            if op == "<":   return left < right
            if op == ">=":  return left >= right
            if op == "<=":  return left <= right
        except TypeError:
            if op in ("==", "!="):
                return op == "!="
            raise ValueError(f"Cannot compare {type(left).__name__} {op} {type(right).__name__}")

        raise ValueError(f"Unknown operator: {op}")
