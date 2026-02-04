"""
Yadro v0 - Tool Runtime

Executes tools with policy enforcement and logging.
"""
import time
import asyncio
import concurrent.futures
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from .models import ToolSpec, ToolResult, ToolCall, ToolImpact, ToolValidationError
from .registry import ToolRegistry, registry
from .policy import PolicyEngine, PolicyConfig, PolicyCheckResult
from ..storage import Database, to_json, now_iso
from ..config.logging import get_logger

_logger = get_logger("tools.runtime")

# ---------------------------------------------------------------------------
# Retry + validation constants
# ---------------------------------------------------------------------------

# Transient errors: retried with exponential backoff
_TRANSIENT_ERRORS = (TimeoutError, ConnectionError, OSError)

# Max retries for transient failures; delays: 0.5s → 1.0s → 2.0s
_TOOL_RETRY_MAX = 3
_TOOL_RETRY_BASE_DELAY = 0.5  # seconds

# Minimal type map — maps JSON-schema type names to Python types
_TYPE_MAP = {
    "string": (str,),
    "integer": (int,),
    "number": (int, float),
    "boolean": (bool,),
    "array": (list,),
    "object": (dict,),
}


def _validate_params(tool: ToolSpec, parameters: Dict[str, Any]) -> None:
    """
    Validate parameters against ToolSpec.parameters schema.

    Checks:
        - Required params are present
        - Provided params match declared type

    Raises ToolValidationError with list of all violations.
    Does nothing if tool.parameters is empty (no schema = no validation).
    """
    schema = tool.parameters
    if not schema:
        return  # no schema defined → skip validation

    errors: list = []
    for param_name, param_def in schema.items():
        required = param_def.get("required", False)
        expected_type = param_def.get("type")

        if required and param_name not in parameters:
            errors.append(f"missing required '{param_name}'")
            continue

        if param_name not in parameters:
            continue  # optional, not provided — ok

        value = parameters[param_name]
        if value is None:
            if required:
                errors.append(f"'{param_name}' is required but got None")
            continue  # None for optional is fine

        if expected_type and expected_type in _TYPE_MAP:
            if not isinstance(value, _TYPE_MAP[expected_type]):
                errors.append(
                    f"'{param_name}': expected {expected_type}, got {type(value).__name__}"
                )

    if errors:
        raise ToolValidationError(tool.name, errors)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class ToolExecutionError(Exception):
    """Raised when tool execution fails."""
    pass


class ToolNotFoundError(Exception):
    """Raised when tool is not found."""
    pass


class PolicyViolationError(Exception):
    """Raised when policy check fails."""

    def __init__(self, message: str, check_result: PolicyCheckResult):
        super().__init__(message)
        self.check_result = check_result


class ToolRuntime:
    """
    Tool Runtime - executes tools safely.
    
    Features:
        - Policy enforcement (rate limits, allowlists)
        - Timeout handling
        - Result logging
        - Sandbox execution (future)
    """
    
    def __init__(
        self,
        db: Optional[Database] = None,
        registry: Optional[ToolRegistry] = None,
        policy_engine: Optional[PolicyEngine] = None,
    ):
        """
        Initialize ToolRuntime.
        
        Args:
            db: Database for logging
            registry: Tool registry
            policy_engine: Policy engine
        """
        self._db = db
        self._registry = registry or ToolRegistry()
        self._policy_engine = policy_engine or PolicyEngine()
    
    @property
    def db(self) -> Database:
        """Get database (lazy init)."""
        if self._db is None:
            self._db = Database()
        return self._db
    
    @property
    def registry(self) -> ToolRegistry:
        """Get tool registry."""
        return self._registry
    
    @property
    def policy(self) -> PolicyEngine:
        """Get policy engine."""
        return self._policy_engine
    
    def execute(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        user_id: int,
        task_id: Optional[int] = None,
        task_type: str = "general",
        step_id: Optional[str] = None,
    ) -> ToolResult:
        """
        Execute a tool with validation, timeout and retry.

        Flow:
            1. Registry lookup
            2. Policy check (rate limits, allowlists)
            3. Schema validation (required params, types)
            4. Retry loop — up to _TOOL_RETRY_MAX attempts for transient errors
            5. Audit log to task_events

        Raises:
            ToolNotFoundError: Tool doesn't exist
            PolicyViolationError: Policy check failed
            ToolValidationError: Parameter schema mismatch
        """
        # 1. Get tool
        tool = self._registry.get(tool_name)
        if tool is None:
            raise ToolNotFoundError(f"Tool '{tool_name}' not found")

        # 2. Check policy
        check = self._policy_engine.check_tool_call(
            tool=tool,
            user_id=user_id,
            task_type=task_type,
            parameters=parameters,
        )
        if not check.allowed:
            raise PolicyViolationError(check.reason, check)

        # 3. Validate parameters against schema
        _validate_params(tool, parameters)

        # Create call record
        call = ToolCall(
            tool_name=tool_name,
            parameters=parameters,
            task_id=task_id,
            user_id=user_id,
            step_id=step_id,
            called_at=datetime.now(timezone.utc),
        )

        # 4. Execute with retry (transient errors only)
        start_time = time.time()
        result: Optional[ToolResult] = None

        for attempt in range(_TOOL_RETRY_MAX):
            try:
                result_data = self._execute_with_timeout(
                    tool.handler,
                    parameters,
                    tool.timeout_seconds,
                )
                execution_time_ms = int((time.time() - start_time) * 1000)
                result = ToolResult(
                    success=True,
                    data=result_data,
                    tool_name=tool_name,
                    execution_time_ms=execution_time_ms,
                )
                break  # success — exit retry loop

            except _TRANSIENT_ERRORS as e:
                if attempt < _TOOL_RETRY_MAX - 1:
                    delay = _TOOL_RETRY_BASE_DELAY * (2 ** attempt)
                    _logger.warning(
                        "Tool '%s' attempt %d/%d transient error: %s. Retry in %.1fs",
                        tool_name, attempt + 1, _TOOL_RETRY_MAX, e, delay,
                    )
                    time.sleep(delay)
                    continue
                # Final attempt exhausted
                execution_time_ms = int((time.time() - start_time) * 1000)
                result = ToolResult(
                    success=False,
                    error=f"Failed after {_TOOL_RETRY_MAX} retries: {type(e).__name__}: {e}",
                    tool_name=tool_name,
                    execution_time_ms=execution_time_ms,
                )
                break

            except Exception as e:
                # Non-transient error — no retry
                execution_time_ms = int((time.time() - start_time) * 1000)
                result = ToolResult(
                    success=False,
                    error=f"{type(e).__name__}: {str(e)}",
                    tool_name=tool_name,
                    execution_time_ms=execution_time_ms,
                )
                break

        # 5. Record call and audit log
        call.result = result
        call.completed_at = datetime.now(timezone.utc)

        # Record for rate limiting
        self._policy_engine.record_call(user_id, tool_name)

        # Log to database (task_events audit trail)
        self._log_tool_call(call)

        return result
    
    def _execute_with_timeout(
        self,
        handler,
        parameters: Dict,
        timeout_seconds: int,
    ) -> Any:
        """
        Execute handler with timeout.
        
        Args:
            handler: Function to execute
            parameters: Parameters to pass
            timeout_seconds: Timeout in seconds
            
        Returns:
            Handler result
            
        Raises:
            TimeoutError: If execution times out
        """
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(handler, **parameters)
            try:
                return future.result(timeout=timeout_seconds)
            except concurrent.futures.TimeoutError:
                raise TimeoutError(f"Execution timed out after {timeout_seconds}s")
    
    def _log_tool_call(self, call: ToolCall) -> None:
        """Log tool call to database."""
        if call.task_id:
            self.db.execute(
                """INSERT INTO task_events 
                   (task_id, event_type, event_data, step_id, tool_name, created_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    call.task_id,
                    "tool_called",
                    to_json({
                        "parameters": call.parameters,
                        "success": call.result.success if call.result else None,
                        "error": call.result.error if call.result else None,
                        "execution_time_ms": call.result.execution_time_ms if call.result else None,
                    }),
                    call.step_id,
                    call.tool_name,
                    now_iso(),
                )
            )
    
    def check_approval_required(self, tool_name: str) -> bool:
        """Check if tool requires approval."""
        tool = self._registry.get(tool_name)
        if tool is None:
            return False
        return self._policy_engine.check_approval_required(tool)


# ==================== BUILT-IN TOOLS ====================

def _web_search(query: str, limit: int = 10) -> Dict:
    """Mock web search tool."""
    return {
        "query": query,
        "results": [
            {"title": f"Result {i+1}", "url": f"https://example.com/{i+1}", "snippet": f"...{query}..."}
            for i in range(min(limit, 3))
        ],
    }


def _web_fetch(url: str) -> Dict:
    """Mock web fetch tool."""
    return {
        "url": url,
        "content": f"Content from {url}...",
        "status": 200,
    }


def _file_read(path: str) -> Dict:
    """Mock file read tool."""
    return {
        "path": path,
        "content": f"Content of {path}",
    }


def _file_write(path: str, content: str) -> Dict:
    """Mock file write tool."""
    return {
        "path": path,
        "written": True,
        "size": len(content),
    }


def _shell(command: str) -> Dict:
    """Mock shell tool."""
    return {
        "command": command,
        "output": f"Output of: {command}",
        "exit_code": 0,
    }


def _telegram_publish(channel: str, content: str) -> Dict:
    """Mock telegram publish tool."""
    return {
        "channel": channel,
        "message_id": 12345,
        "published": True,
    }


def register_builtin_tools(runtime: ToolRuntime) -> None:
    """Register built-in tools to runtime."""
    
    runtime.registry.register(
        name="web_search",
        handler=_web_search,
        description="Search the web",
        impact=ToolImpact.LOW,
        sandbox=True,
    )
    
    runtime.registry.register(
        name="web_fetch",
        handler=_web_fetch,
        description="Fetch web page content",
        impact=ToolImpact.LOW,
        sandbox=True,
    )
    
    runtime.registry.register(
        name="file_read",
        handler=_file_read,
        description="Read file content",
        impact=ToolImpact.LOW,
        sandbox=True,
    )
    
    runtime.registry.register(
        name="file_write",
        handler=_file_write,
        description="Write content to file",
        impact=ToolImpact.MEDIUM,
        sandbox=True,
    )
    
    runtime.registry.register(
        name="shell",
        handler=_shell,
        description="Execute shell command",
        impact=ToolImpact.HIGH,
        sandbox=True,
    )
    
    runtime.registry.register(
        name="telegram_publish",
        handler=_telegram_publish,
        description="Publish to Telegram channel",
        impact=ToolImpact.HIGH,
        requires_approval=True,
        allowed_task_types=["smm"],
    )
