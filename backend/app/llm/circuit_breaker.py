"""
Yadro v0 - Circuit Breaker

Per-provider circuit breaker. Pure stdlib, no external deps.
Thread-safe via a single Lock.

State machine:
    CLOSED  --[failures > threshold in window]--> OPEN
    OPEN    --[open_timeout elapsed]------------> HALF_OPEN
    HALF_OPEN --[success]-----------------------> CLOSED
    HALF_OPEN --[failure]-----------------------> OPEN

Failure counting uses a sliding window: only failures within the last
`window_seconds` are counted. Failures outside the window are pruned.
"""

import time
import threading
from enum import Enum
from typing import List, Optional


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"         # Normal: all requests pass through
    OPEN = "open"             # Tripped: reject immediately, don't hit external API
    HALF_OPEN = "half_open"   # Probe: allow ONE request through to test recovery


class CircuitBreakerError(Exception):
    """Raised when a request is rejected because the circuit is OPEN."""
    pass


class CircuitBreaker:
    """
    Sliding-window circuit breaker.

    Args:
        failure_threshold: Number of failures in window to trip the circuit.
        window_seconds: Sliding window size for failure counting.
        open_timeout_seconds: How long OPEN state lasts before transitioning to HALF_OPEN.
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        window_seconds: float = 60.0,
        open_timeout_seconds: float = 30.0,
    ):
        self._threshold = failure_threshold
        self._window = window_seconds
        self._open_timeout = open_timeout_seconds

        self._state = CircuitState.CLOSED
        self._failures: List[float] = []          # monotonic() timestamps of failures
        self._opened_at: Optional[float] = None   # monotonic() when circuit opened
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def state(self) -> CircuitState:
        """Current state (thread-safe, with auto OPEN→HALF_OPEN transition)."""
        with self._lock:
            return self._get_state()

    def allow_request(self) -> bool:
        """
        Check whether a request should be allowed.

        Returns False only when circuit is OPEN (and timeout has not elapsed).
        Returns True for CLOSED and HALF_OPEN.
        """
        with self._lock:
            return self._get_state() != CircuitState.OPEN

    def record_success(self) -> None:
        """
        Record a successful external call.

        - HALF_OPEN → CLOSED (probe succeeded, circuit healed)
        - CLOSED    → no-op
        - OPEN      → no-op (shouldn't happen: OPEN rejects before call)
        """
        with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.CLOSED
                self._failures.clear()
                self._opened_at = None

    def record_failure(self) -> None:
        """
        Record a failed external call.

        - Adds timestamp to sliding window
        - HALF_OPEN → OPEN (probe failed, back to rejection)
        - CLOSED    → OPEN if failure count >= threshold
        """
        with self._lock:
            now = time.monotonic()
            self._failures.append(now)
            self._prune_failures()

            if self._state == CircuitState.HALF_OPEN:
                # Probe failed — revert to OPEN
                self._state = CircuitState.OPEN
                self._opened_at = now
            elif len(self._failures) >= self._threshold:
                # Threshold exceeded — trip circuit
                self._state = CircuitState.OPEN
                self._opened_at = now

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _get_state(self) -> CircuitState:
        """Get state with auto-transition from OPEN to HALF_OPEN if timeout elapsed."""
        if self._state == CircuitState.OPEN and self._opened_at is not None:
            if time.monotonic() - self._opened_at >= self._open_timeout:
                self._state = CircuitState.HALF_OPEN
        return self._state

    def _prune_failures(self) -> None:
        """Remove failure timestamps outside the sliding window."""
        cutoff = time.monotonic() - self._window
        self._failures = [t for t in self._failures if t > cutoff]
