"""
Notes API

CRUD operations for user notes.
"""

import json
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.storage.database import Database
from .deps import get_db, get_current_user


router = APIRouter(prefix="/notes", tags=["notes"])


# =============================================================================
# Models
# =============================================================================

class NoteCreate(BaseModel):
    title: Optional[str] = None
    content: str
    color: str = "default"
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    is_pinned: Optional[bool] = None


class NoteResponse(BaseModel):
    id: int
    user_id: int
    title: Optional[str]
    content: str
    color: str
    is_pinned: bool
    created_at: datetime
    updated_at: datetime


class NoteList(BaseModel):
    items: List[NoteResponse]
    total: int


# =============================================================================
# Helpers
# =============================================================================

def _row_to_note(row) -> NoteResponse:
    """Convert DB row to NoteResponse."""
    row = dict(row)
    return NoteResponse(
        id=row["id"],
        user_id=row["user_id"],
        title=row.get("title"),
        content=row["content"],
        color=row.get("color", "default"),
        is_pinned=bool(row.get("is_pinned", 0)),
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


# =============================================================================
# CRUD
# =============================================================================

@router.post("", response_model=NoteResponse)
async def create_note(
    data: NoteCreate,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Create a new note."""
    db.execute(
        """
        INSERT INTO notes (user_id, title, content, color, is_pinned, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        """,
        (user["id"], data.title, data.content, data.color, int(data.is_pinned))
    )

    row = db.fetch_one(
        "SELECT * FROM notes WHERE user_id = ? ORDER BY id DESC LIMIT 1",
        (user["id"],)
    )

    return _row_to_note(row)


@router.get("", response_model=NoteList)
async def list_notes(
    search: Optional[str] = None,
    pinned_only: bool = False,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """List user's notes."""
    conditions = ["user_id = ?"]
    params: List = [user["id"]]

    if pinned_only:
        conditions.append("is_pinned = 1")

    if search:
        conditions.append("(title LIKE ? OR content LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])

    where = " AND ".join(conditions)

    total = db.fetch_value(f"SELECT COUNT(*) FROM notes WHERE {where}", params)

    offset = (page - 1) * per_page
    rows = db.fetch_all(
        f"""
        SELECT * FROM notes
        WHERE {where}
        ORDER BY is_pinned DESC, updated_at DESC
        LIMIT ? OFFSET ?
        """,
        params + [per_page, offset]
    )

    return NoteList(
        items=[_row_to_note(row) for row in rows],
        total=total,
    )


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Get single note by ID."""
    row = db.fetch_one(
        "SELECT * FROM notes WHERE id = ? AND user_id = ?",
        (note_id, user["id"])
    )

    if not row:
        raise HTTPException(status_code=404, detail="Note not found")

    return _row_to_note(row)


@router.patch("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    data: NoteUpdate,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Update a note."""
    row = db.fetch_one(
        "SELECT * FROM notes WHERE id = ? AND user_id = ?",
        (note_id, user["id"])
    )

    if not row:
        raise HTTPException(status_code=404, detail="Note not found")

    updates = []
    params = []

    if data.title is not None:
        updates.append("title = ?")
        params.append(data.title)

    if data.content is not None:
        updates.append("content = ?")
        params.append(data.content)

    if data.color is not None:
        updates.append("color = ?")
        params.append(data.color)

    if data.is_pinned is not None:
        updates.append("is_pinned = ?")
        params.append(int(data.is_pinned))

    updates.append("updated_at = datetime('now')")

    if updates:
        params.append(note_id)
        db.execute(
            f"UPDATE notes SET {', '.join(updates)} WHERE id = ?",
            params
        )

    row = db.fetch_one("SELECT * FROM notes WHERE id = ?", (note_id,))
    return _row_to_note(row)


@router.delete("/{note_id}")
async def delete_note(
    note_id: int,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """Delete a note."""
    row = db.fetch_one(
        "SELECT * FROM notes WHERE id = ? AND user_id = ?",
        (note_id, user["id"])
    )

    if not row:
        raise HTTPException(status_code=404, detail="Note not found")

    db.execute("DELETE FROM notes WHERE id = ?", (note_id,))

    return {"message": "Note deleted"}
