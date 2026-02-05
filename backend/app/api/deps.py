"""
API Dependencies

Database, services, and auth injection.
"""

import os
import hmac
import hashlib
import json
from typing import Optional, Generator
from datetime import datetime
from urllib.parse import parse_qs

from fastapi import Depends, HTTPException, Header, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.storage.database import Database
from app.config.settings import settings
from app.memory.service import MemoryService
from app.llm.service import LLMService
from app.llm.router import ModelRouter, RouterConfig
from app.smm.agent import SMMAgent


# =============================================================================
# Database
# =============================================================================

_db: Optional[Database] = None


def get_db() -> Database:
    """Get database instance."""
    global _db
    if _db is None:
        _db = Database(settings.database.path)
    return _db


# =============================================================================
# Services
# =============================================================================

_memory: Optional[MemoryService] = None
_llm: Optional[LLMService] = None
_agent: Optional[SMMAgent] = None


def get_memory(db: Database = Depends(get_db)) -> MemoryService:
    """Get memory service."""
    global _memory
    if _memory is None:
        _memory = MemoryService(db)
    return _memory


def get_llm(db: Database = Depends(get_db)) -> LLMService:
    """Get LLM service."""
    global _llm
    if _llm is None:
        openai_key = os.environ.get("OPENAI_API_KEY")
        anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
        # Claude Sonnet для SMM задач
        router_config = RouterConfig(
            primary_model="claude-sonnet-4",
            task_model_overrides={
                "smm": "claude-sonnet-4",
                "smm_generate": "claude-sonnet-4",
                "smm_analyze": "claude-sonnet-4",
            }
        )
        router = ModelRouter(config=router_config)
        _llm = LLMService(
            db,
            router=router,
            openai_api_key=openai_key,
            anthropic_api_key=anthropic_key,
            mock_mode=False
        )
    return _llm


def get_agent(
    db: Database = Depends(get_db),
    llm: LLMService = Depends(get_llm),
) -> SMMAgent:
    """Get SMM agent."""
    global _agent
    if _agent is None:
        _agent = SMMAgent(db=db, llm=llm)
    return _agent


# =============================================================================
# Telegram Mini App Auth
# =============================================================================

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
DEV_MODE = os.environ.get("APP_ENV", "").lower() in ("development", "dev")

# Mock user for development
DEV_USER = {
    "id": 1,
    "first_name": "Dev",
    "last_name": "User",
    "username": "dev_user",
}


def validate_telegram_init_data(init_data: str) -> Optional[dict]:
    """
    Validate Telegram Mini App init data.

    Telegram sends: query_id=...&user={"id":123,...}&auth_date=...&hash=...
    We verify the hash using bot token.

    Returns user dict if valid, None otherwise.
    """
    if not init_data or not BOT_TOKEN:
        return None

    try:
        # Parse the init data
        parsed = parse_qs(init_data)

        # Extract hash
        received_hash = parsed.get("hash", [""])[0]
        if not received_hash:
            return None

        # Build data check string (sorted, without hash)
        data_pairs = []
        for key, values in parsed.items():
            if key != "hash":
                data_pairs.append(f"{key}={values[0]}")
        data_check_string = "\n".join(sorted(data_pairs))

        # Calculate expected hash
        secret_key = hmac.new(
            b"WebAppData",
            BOT_TOKEN.encode(),
            hashlib.sha256
        ).digest()

        expected_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        # Verify
        if not hmac.compare_digest(received_hash, expected_hash):
            return None

        # Check auth_date (not older than 24 hours)
        auth_date = int(parsed.get("auth_date", ["0"])[0])
        if datetime.now().timestamp() - auth_date > 86400:
            return None

        # Parse user
        user_json = parsed.get("user", ["{}"])[0]
        user = json.loads(user_json)

        return user

    except Exception:
        return None


class TelegramAuth:
    """Telegram Mini App authentication."""

    async def __call__(
        self,
        request: Request,
        x_telegram_init_data: Optional[str] = Header(None),
    ) -> dict:
        """
        Validate request from Telegram Mini App.

        Init data can come from:
        1. X-Telegram-Init-Data header
        2. Authorization header (for compatibility)
        3. Query param ?init_data=...

        In DEV_MODE, returns mock user without validation.
        """
        # Dev mode — return mock user
        if DEV_MODE:
            return DEV_USER

        init_data = x_telegram_init_data

        # Try query param
        if not init_data:
            init_data = request.query_params.get("init_data")

        # Try Authorization header
        if not init_data:
            auth = request.headers.get("Authorization", "")
            if auth.startswith("tma "):
                init_data = auth[4:]

        if not init_data:
            raise HTTPException(
                status_code=401,
                detail="Missing Telegram init data"
            )

        user = validate_telegram_init_data(init_data)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid Telegram init data"
            )

        return user


telegram_auth = TelegramAuth()


# =============================================================================
# JWT Auth
# =============================================================================

JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "yadro-post-secret-change-in-production")
JWT_ALGORITHM = "HS256"

security = HTTPBearer(auto_error=False)


def verify_jwt_token(token: str) -> Optional[dict]:
    """Verify and decode JWT token."""
    import jwt
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None


# =============================================================================
# Current User
# =============================================================================

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Database = Depends(get_db),
) -> dict:
    """
    Get current user from JWT token or Telegram init data.

    Supports:
    1. JWT token in Authorization header (Bearer xxx)
    2. Telegram Mini App init data (legacy)
    3. Dev mode (returns mock user)

    Returns user dict with 'id' (our internal ID) and other fields.
    """
    # Dev mode — return mock user
    if DEV_MODE:
        return DEV_USER

    # Try JWT token first (from Authorization: Bearer xxx)
    if credentials and credentials.credentials:
        payload = verify_jwt_token(credentials.credentials)
        if payload:
            user_id = int(payload.get("sub", 0))
            if user_id:
                user = db.fetch_one(
                    "SELECT id, tg_id, email, username, first_name, last_name, role, settings FROM users WHERE id = ?",
                    (user_id,)
                )
                if user:
                    return {
                        "id": user["id"],
                        "tg_id": user["tg_id"],
                        "email": user["email"],
                        "username": user["username"],
                        "first_name": user["first_name"],
                        "last_name": user["last_name"],
                        "role": user["role"] or "user",
                        "settings": json.loads(user["settings"] or "{}"),
                    }

    # Try Telegram Mini App init data (legacy)
    try:
        tg_user = await telegram_auth(request)
        tg_id = tg_user.get("id")
        if tg_id:
            user = db.fetch_one(
                "SELECT id, tg_id, username, role, settings FROM users WHERE tg_id = ?",
                (tg_id,)
            )
            if not user:
                # Create new user
                username = tg_user.get("username")
                db.execute(
                    "INSERT INTO users (tg_id, username, role) VALUES (?, ?, 'user')",
                    (tg_id, username)
                )
                user = db.fetch_one(
                    "SELECT id, tg_id, username, role, settings FROM users WHERE tg_id = ?",
                    (tg_id,)
                )
            return {
                "id": user["id"],
                "tg_id": user["tg_id"],
                "username": user["username"],
                "role": user["role"] or "user",
                "settings": json.loads(user["settings"] or "{}"),
            }
    except HTTPException:
        pass  # No Telegram init data

    raise HTTPException(status_code=401, detail="Authentication required")


# =============================================================================
# Role-based Access Control
# =============================================================================

def require_role(allowed_roles: list):
    """
    Dependency factory for role-based access control.

    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(user: dict = Depends(require_role(["admin"]))):
            ...

    Roles:
        - admin: Полный доступ, управление пользователями, подписки
        - smm: Просмотр пользователей, проверка подписок, НЕ может менять тарифы
        - user: Базовый интерфейс, платный контент закрыт
    """
    async def role_checker(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role", "user")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied. Required role: {allowed_roles}, your role: {user_role}"
            )
        return user
    return role_checker


# Convenience dependencies for common role checks
async def get_admin_user(user: dict = Depends(require_role(["admin"]))) -> dict:
    """Require admin role."""
    return user


async def get_smm_or_admin_user(user: dict = Depends(require_role(["admin", "smm"]))) -> dict:
    """Require SMM or admin role."""
    return user


# =============================================================================
# Optional Auth (for public endpoints)
# =============================================================================

async def get_optional_user(
    request: Request,
    db: Database = Depends(get_db),
) -> Optional[dict]:
    """Get current user if authenticated, None otherwise."""
    try:
        tg_user = await telegram_auth(request)
        return await get_current_user(tg_user, db)
    except HTTPException:
        return None
