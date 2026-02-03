"""
Yadro v0 - Memory Service (Layer 6)

User memories with full-text search and context building.
"""
from .models import MemoryItem, MemoryType, SearchResult, MemoryContext
from .service import MemoryService
from .user_memory import (
    SQLiteMemory,
    SuccessPatternDTO,
    UserPreferenceDTO,
    get_memory,
    get_user_memory,
)

__all__ = [
    "MemoryItem",
    "MemoryType",
    "SearchResult",
    "MemoryContext",
    "MemoryService",
    # User Memory (Architecture-First)
    "SQLiteMemory",
    "SuccessPatternDTO",
    "UserPreferenceDTO",
    "get_memory",
    "get_user_memory",
]
