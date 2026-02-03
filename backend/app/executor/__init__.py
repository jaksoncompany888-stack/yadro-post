"""
Yadro v0 - Executor (Layer 3)

The brain of the system - orchestrates task execution.
"""
from .models import Plan, Step, StepAction, StepStatus, ExecutionContext
from .plan_manager import PlanManager
from .step_executor import StepExecutor, ApprovalRequired
from .executor import Executor, LimitExceeded, ExecutionError
from .post_executor import (
    PostExecutor,
    PostPlan,
    PostExecutionResult,
    StepType,
    create_post_executor,
)

__all__ = [
    # Models
    "Plan",
    "Step",
    "StepAction",
    "StepStatus",
    "ExecutionContext",
    # Plan Manager
    "PlanManager",
    # Step Executor
    "StepExecutor",
    "ApprovalRequired",
    # Executor
    "Executor",
    "LimitExceeded",
    "ExecutionError",
    # Post Executor (Architecture-First)
    "PostExecutor",
    "PostPlan",
    "PostExecutionResult",
    "StepType",
    "create_post_executor",
]
