"""
Telegram Authentication API

Web-only authentication via Telegram Login Widget.
No Mini App, no bot interaction - pure web auth.
"""

import os
import secrets
import hashlib
import hmac
import json
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
import jwt
import httpx

from app.storage.database import Database
from .deps import get_db


router = APIRouter(prefix="/auth", tags=["auth"])

# Configuration
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "yadro-post-secret-change-in-production")
REQUIRED_CHANNEL = os.environ.get("REQUIRED_CHANNEL", "@yadro_channel")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30


# =============================================================================
# Models
# =============================================================================

class TelegramWidgetData(BaseModel):
    """Data from Telegram Login Widget"""
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class AuthResponse(BaseModel):
    """Response after successful auth"""
    token: str
    expires_at: str
    user: dict


class UserResponse(BaseModel):
    """User info response"""
    id: int
    tg_id: int
    username: Optional[str]
    role: str
    is_active: bool


class SubscriptionCheckResponse(BaseModel):
    """Response for subscription check"""
    subscribed: bool
    channel: str


# =============================================================================
# JWT Helpers
# =============================================================================

def create_jwt_token(user_id: int, tg_id: int, role: str = "user") -> tuple[str, datetime]:
    """Create JWT token for user."""
    expires = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {
        "sub": str(user_id),
        "tg_id": tg_id,
        "role": role,
        "exp": expires,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token, expires


def verify_jwt_token(token: str) -> Optional[dict]:
    """Verify and decode JWT token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# =============================================================================
# Telegram Login Widget Validation
# =============================================================================

def validate_telegram_widget(data: dict) -> bool:
    """
    Validate data from Telegram Login Widget.

    https://core.telegram.org/widgets/login#checking-authorization
    """
    if not BOT_TOKEN:
        # No bot token - allow in dev mode
        return True

    received_hash = data.get("hash")
    if not received_hash:
        return False

    # Build data check string (sorted, without hash)
    data_copy = {k: v for k, v in data.items() if k != "hash" and v is not None}
    data_check_arr = [f"{k}={v}" for k, v in sorted(data_copy.items())]
    data_check_string = "\n".join(data_check_arr)

    # Calculate hash
    secret_key = hashlib.sha256(BOT_TOKEN.encode()).digest()
    expected_hash = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_hash, received_hash)


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/telegram/login", response_model=AuthResponse)
async def telegram_login(
    data: TelegramWidgetData,
    db: Database = Depends(get_db),
):
    """
    Login via Telegram Login Widget.

    Frontend embeds the widget, user clicks "Log in with Telegram",
    widget returns user data which is sent here.
    """
    # Convert to dict for validation
    widget_data = {
        "id": data.id,
        "first_name": data.first_name,
        "auth_date": data.auth_date,
        "hash": data.hash,
    }
    if data.last_name:
        widget_data["last_name"] = data.last_name
    if data.username:
        widget_data["username"] = data.username
    if data.photo_url:
        widget_data["photo_url"] = data.photo_url

    # Validate widget data
    if not validate_telegram_widget(widget_data):
        raise HTTPException(status_code=401, detail="Invalid Telegram login data")

    # Check auth_date (not older than 24 hours)
    if datetime.now().timestamp() - data.auth_date > 86400:
        raise HTTPException(status_code=401, detail="Auth data expired")

    tg_id = data.id

    # Get or create user
    user = db.fetch_one(
        "SELECT id, tg_id, username, role, is_active FROM users WHERE tg_id = ?",
        (tg_id,)
    )

    if not user:
        # Create new user
        db.execute(
            "INSERT INTO users (tg_id, username, role, is_active) VALUES (?, ?, 'user', 1)",
            (tg_id, data.username)
        )
        user = db.fetch_one(
            "SELECT id, tg_id, username, role, is_active FROM users WHERE tg_id = ?",
            (tg_id,)
        )

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="User is deactivated")

    # Create token
    token, expires = create_jwt_token(
        user_id=user["id"],
        tg_id=user["tg_id"],
        role=user["role"] or "user",
    )

    return AuthResponse(
        token=token,
        expires_at=expires.isoformat(),
        user={
            "id": user["id"],
            "tg_id": user["tg_id"],
            "username": user["username"],
            "role": user["role"] or "user",
        },
    )


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    db: Database = Depends(get_db),
    token: str = Query(None, description="JWT token"),
    authorization: str = Query(None, alias="Authorization"),
):
    """
    Get current user info from JWT token.

    Token can be passed as:
    - Query parameter: ?token=xxx
    - Header: Authorization: Bearer xxx
    """
    # Extract token
    auth_token = token
    if not auth_token and authorization:
        if authorization.startswith("Bearer "):
            auth_token = authorization[7:]

    if not auth_token:
        raise HTTPException(status_code=401, detail="Token required")

    payload = verify_jwt_token(auth_token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = int(payload.get("sub", 0))

    user = db.fetch_one(
        "SELECT id, tg_id, username, role, is_active FROM users WHERE id = ?",
        (user_id,)
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=user["id"],
        tg_id=user["tg_id"],
        username=user["username"],
        role=user["role"] or "user",
        is_active=user["is_active"],
    )


@router.post("/refresh")
async def refresh_token(
    db: Database = Depends(get_db),
    token: str = Query(..., description="Current JWT token"),
):
    """
    Refresh JWT token.
    """
    # Verify current token (allow expired for refresh)
    try:
        payload = jwt.decode(
            token, SECRET_KEY, algorithms=[JWT_ALGORITHM],
            options={"verify_exp": False}
        )
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = int(payload.get("sub", 0))

    # Get user from DB
    user = db.fetch_one(
        "SELECT id, tg_id, role, is_active FROM users WHERE id = ?",
        (user_id,)
    )

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user["is_active"]:
        raise HTTPException(status_code=403, detail="User is deactivated")

    # Create new token
    new_token, expires = create_jwt_token(
        user_id=user["id"],
        tg_id=user["tg_id"],
        role=user["role"] or "user",
    )

    return {
        "token": new_token,
        "expires_at": expires.isoformat(),
    }


@router.post("/verify-subscription", response_model=SubscriptionCheckResponse)
async def verify_subscription(
    token: str = Query(..., description="JWT token"),
):
    """
    Verify that user is subscribed to the required channel.
    """
    # Verify token
    payload = verify_jwt_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    tg_id = payload.get("tg_id")
    if not tg_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Check subscription via Telegram API
    subscribed = await check_channel_subscription(tg_id, REQUIRED_CHANNEL)

    return SubscriptionCheckResponse(
        subscribed=subscribed,
        channel=REQUIRED_CHANNEL,
    )


@router.post("/logout")
async def logout():
    """
    Logout endpoint.

    Just returns success - actual logout is handled by frontend
    by removing the token from localStorage.
    """
    return {"success": True}


# =============================================================================
# Telegram API Helpers
# =============================================================================

async def check_channel_subscription(tg_id: int, channel: str) -> bool:
    """
    Check if user is subscribed to a Telegram channel.

    Uses Telegram Bot API getChatMember method.
    """
    if not BOT_TOKEN:
        # No bot token - skip subscription check
        return True

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.telegram.org/bot{BOT_TOKEN}/getChatMember",
                params={
                    "chat_id": channel,
                    "user_id": tg_id,
                },
                timeout=10.0,
            )

            data = response.json()

            if not data.get("ok"):
                # API error - assume not subscribed
                return False

            status = data.get("result", {}).get("status", "")

            # User is subscribed if they are member, admin, or creator
            return status in ("member", "administrator", "creator")

    except Exception:
        # Error checking subscription - assume not subscribed
        return False


# =============================================================================
# Widget Config Endpoint
# =============================================================================

@router.get("/telegram/config")
async def get_telegram_config():
    """
    Get Telegram Login Widget configuration.

    Frontend needs bot username to embed the widget.
    """
    bot_username = os.environ.get("TELEGRAM_BOT_USERNAME", "YadroPostBot")

    return {
        "bot_username": bot_username,
        "request_access": "write",  # Request write access for posting
    }
