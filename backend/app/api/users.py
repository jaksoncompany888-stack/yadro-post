"""
Users API

User management and role-based access control.
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.storage.database import Database
from .deps import get_db, get_current_user, get_admin_user, get_smm_or_admin_user


router = APIRouter(prefix="/users", tags=["users"])


# =============================================================================
# Models
# =============================================================================

class UserResponse(BaseModel):
    """User data response."""
    id: int
    tg_id: int
    username: Optional[str]
    role: str
    is_active: bool


class UserRoleUpdate(BaseModel):
    """Update user role request."""
    role: str  # admin, smm, user


class UserListResponse(BaseModel):
    """List of users response."""
    users: List[UserResponse]
    total: int


# =============================================================================
# Current User
# =============================================================================

@router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    """Get current authenticated user info including role."""
    return UserResponse(
        id=user["id"],
        tg_id=user["tg_id"],
        username=user.get("username"),
        role=user.get("role", "user"),
        is_active=True,
    )


# =============================================================================
# User Management (Admin/SMM only)
# =============================================================================

@router.get("", response_model=UserListResponse)
async def list_users(
    user: dict = Depends(get_smm_or_admin_user),
    db: Database = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """
    List all users.

    - Admin: can see all users
    - SMM: can see all users but cannot modify
    """
    rows = db.fetch_all(
        """SELECT id, tg_id, username, role, is_active
           FROM users
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?""",
        (limit, offset)
    )

    total = db.fetch_one("SELECT COUNT(*) as cnt FROM users")["cnt"]

    users = [
        UserResponse(
            id=row["id"],
            tg_id=row["tg_id"],
            username=row["username"],
            role=row["role"] or "user",
            is_active=bool(row["is_active"]),
        )
        for row in rows
    ]

    return UserListResponse(users=users, total=total)


@router.put("/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    data: UserRoleUpdate,
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """
    Update user role. Admin only.

    Roles:
    - admin: Full access, user management, subscriptions
    - smm: View users, check subscriptions, cannot change tariffs
    - user: Basic interface, paid content locked
    """
    if data.role not in ("admin", "smm", "user"):
        raise HTTPException(status_code=400, detail="Invalid role. Must be: admin, smm, user")

    # Check user exists
    target_user = db.fetch_one("SELECT * FROM users WHERE id = ?", (user_id,))
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-demotion
    if target_user["id"] == admin["id"] and data.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    # Update role
    db.execute(
        "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?",
        (data.role, user_id)
    )

    # Return updated user
    updated = db.fetch_one("SELECT id, tg_id, username, role, is_active FROM users WHERE id = ?", (user_id,))

    return UserResponse(
        id=updated["id"],
        tg_id=updated["tg_id"],
        username=updated["username"],
        role=updated["role"],
        is_active=bool(updated["is_active"]),
    )


@router.put("/{user_id}/activate", response_model=UserResponse)
async def activate_user(
    user_id: int,
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Activate user. Admin only."""
    db.execute(
        "UPDATE users SET is_active = 1, updated_at = datetime('now') WHERE id = ?",
        (user_id,)
    )
    updated = db.fetch_one("SELECT id, tg_id, username, role, is_active FROM users WHERE id = ?", (user_id,))
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=updated["id"],
        tg_id=updated["tg_id"],
        username=updated["username"],
        role=updated["role"] or "user",
        is_active=bool(updated["is_active"]),
    )


@router.put("/{user_id}/deactivate", response_model=UserResponse)
async def deactivate_user(
    user_id: int,
    admin: dict = Depends(get_admin_user),
    db: Database = Depends(get_db),
):
    """Deactivate user. Admin only."""
    # Prevent self-deactivation
    if user_id == admin["id"]:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    db.execute(
        "UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?",
        (user_id,)
    )
    updated = db.fetch_one("SELECT id, tg_id, username, role, is_active FROM users WHERE id = ?", (user_id,))
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=updated["id"],
        tg_id=updated["tg_id"],
        username=updated["username"],
        role=updated["role"] or "user",
        is_active=bool(updated["is_active"]),
    )
