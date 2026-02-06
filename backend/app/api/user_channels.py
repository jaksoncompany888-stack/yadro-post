"""
User Channels API

Управление каналами пользователя для автопостинга.
Отличие от channels.py (анализ конкурентов):
- Это СВОИ каналы куда постим
- Требуется валидация что бот добавлен как админ
"""

import os
import re
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException, Depends

from app.providers import TelegramProvider, Platform
from app.storage.database import Database
from .deps import get_current_user, get_db


router = APIRouter(prefix="/user-channels", tags=["user-channels"])


def _parse_telegram_channel_id(raw_input: str) -> str:
    """
    Parse various Telegram channel input formats:
    - @username -> @username
    - username -> @username
    - https://t.me/username -> @username
    - t.me/username -> @username
    - https://t.me/c/123456789/1 -> -100123456789 (private channel)
    - -100123456789 -> -100123456789
    """
    raw_input = raw_input.strip()

    # Already a numeric ID
    if raw_input.startswith("-"):
        return raw_input

    # Parse t.me URLs
    # Match: https://t.me/username, http://t.me/username, t.me/username
    url_pattern = r"(?:https?://)?t\.me/(?:c/)?(\d+|[a-zA-Z_][a-zA-Z0-9_]*)"
    match = re.match(url_pattern, raw_input, re.IGNORECASE)

    if match:
        channel_part = match.group(1)
        # If it's numeric (private channel via t.me/c/ID)
        if channel_part.isdigit():
            return f"-100{channel_part}"
        # Public channel username
        return f"@{channel_part}"

    # Remove @ if present, then add it back
    username = raw_input.lstrip("@")

    # Validate username format (basic check)
    if username and re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*$", username):
        return f"@{username}"

    # Return as-is with @ for API to validate
    return f"@{username}" if username else raw_input


# =============================================================================
# Models
# =============================================================================

class UserChannelCreate(BaseModel):
    """Добавление канала для постинга."""
    platform: str = "telegram"  # telegram или vk
    channel_id: str  # @username или ID


class UserChannelInfo(BaseModel):
    """Информация о канале пользователя."""
    id: Optional[int] = None
    platform: str
    channel_id: str
    name: str
    username: Optional[str] = None
    subscribers: int = 0
    is_valid: bool = True
    can_post: bool = True


class ValidateResponse(BaseModel):
    """Результат валидации канала."""
    valid: bool
    can_post: bool
    error: Optional[str] = None
    channel_info: Optional[UserChannelInfo] = None


# =============================================================================
# Database helpers
# =============================================================================

def _ensure_table(db: Database):
    """Ensure user_channels table exists."""
    db.execute("""
        CREATE TABLE IF NOT EXISTS user_channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            platform TEXT NOT NULL DEFAULT 'telegram',
            channel_id TEXT NOT NULL,
            name TEXT,
            username TEXT,
            subscribers INTEGER DEFAULT 0,
            is_valid INTEGER DEFAULT 1,
            can_post INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, platform, channel_id)
        )
    """)


def _get_user_channels(db: Database, user_id: int) -> List[UserChannelInfo]:
    """Get all channels for user from database."""
    _ensure_table(db)
    rows = db.fetch_all(
        """SELECT id, platform, channel_id, name, username, subscribers, is_valid, can_post
           FROM user_channels WHERE user_id = ?""",
        (user_id,)
    )
    return [
        UserChannelInfo(
            id=row["id"],
            platform=row["platform"],
            channel_id=row["channel_id"],
            name=row["name"] or row["channel_id"],
            username=row["username"],
            subscribers=row["subscribers"] or 0,
            is_valid=bool(row["is_valid"]),
            can_post=bool(row["can_post"]),
        )
        for row in rows
    ]


def _save_channel(db: Database, user_id: int, channel: UserChannelInfo):
    """Save or update channel in database."""
    _ensure_table(db)
    db.execute(
        """INSERT OR REPLACE INTO user_channels
           (user_id, platform, channel_id, name, username, subscribers, is_valid, can_post, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))""",
        (user_id, channel.platform, channel.channel_id, channel.name,
         channel.username, channel.subscribers, int(channel.is_valid), int(channel.can_post))
    )


def _delete_channel(db: Database, user_id: int, channel_id: str):
    """Delete channel from database."""
    _ensure_table(db)
    # Try with and without @
    db.execute(
        "DELETE FROM user_channels WHERE user_id = ? AND (channel_id = ? OR channel_id = ?)",
        (user_id, channel_id, f"@{channel_id.lstrip('@')}")
    )


# =============================================================================
# Endpoints
# =============================================================================

@router.get("", response_model=List[UserChannelInfo])
async def list_user_channels(
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """
    Список каналов пользователя для постинга.
    """
    user_id = user["id"]
    return _get_user_channels(db, user_id)


@router.post("/add", response_model=ValidateResponse)
async def add_user_channel(
    data: UserChannelCreate,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """
    Добавить канал для постинга.

    Проверяет что бот добавлен в канал как админ с правами постинга.
    """
    user_id = user["id"]

    # Парсим channel_id (поддержка URL, @username, username)
    channel_id = _parse_telegram_channel_id(data.channel_id)

    if data.platform == "telegram":
        # Use posting bot for channel operations
        bot_token = os.environ.get("TELEGRAM_POSTING_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN")
        if not bot_token:
            raise HTTPException(status_code=500, detail="Posting bot not configured")

        provider = TelegramProvider(bot_token=bot_token)

        try:
            # Проверяем что бот может постить в канал
            is_valid = await provider.validate_channel(channel_id)

            if not is_valid:
                await provider.close()
                return ValidateResponse(
                    valid=False,
                    can_post=False,
                    error="Бот не добавлен в канал как администратор. Добавьте бота @YadroPost_bot в канал с правами на публикацию."
                )

            # Получаем информацию о канале
            channel_info = await provider.get_channel_info(channel_id)
            await provider.close()

            if not channel_info:
                return ValidateResponse(
                    valid=False,
                    can_post=False,
                    error="Не удалось получить информацию о канале"
                )

            # Создаём запись
            user_channel = UserChannelInfo(
                platform="telegram",
                channel_id=channel_id,
                name=channel_info.title,
                username=channel_info.username,
                subscribers=channel_info.member_count or 0,
                is_valid=True,
                can_post=True,
            )

            # Сохраняем в базу
            _save_channel(db, user_id, user_channel)

            return ValidateResponse(
                valid=True,
                can_post=True,
                channel_info=user_channel
            )

        except Exception as e:
            await provider.close()
            error_msg = str(e)

            if "Chat not found" in error_msg:
                error_msg = "Канал не найден. Проверьте username."
            elif "bot was kicked" in error_msg or "Forbidden" in error_msg:
                error_msg = "Бот удалён из канала или не имеет прав."
            elif "CHAT_ADMIN_REQUIRED" in error_msg:
                error_msg = "Бот не является администратором канала."

            return ValidateResponse(
                valid=False,
                can_post=False,
                error=error_msg
            )

    elif data.platform == "vk":
        # TODO: VK implementation
        raise HTTPException(status_code=501, detail="VK пока не поддерживается")

    else:
        raise HTTPException(status_code=400, detail=f"Unknown platform: {data.platform}")


@router.delete("/{channel_id}")
async def remove_user_channel(
    channel_id: str,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db)
):
    """Удалить канал из списка постинга."""
    user_id = user["id"]

    # Декодируем channel_id (@ может быть закодирован как %40)
    from urllib.parse import unquote
    channel_id = unquote(channel_id)

    _delete_channel(db, user_id, channel_id)

    return {"status": "removed", "channel_id": channel_id}


@router.post("/validate", response_model=ValidateResponse)
async def validate_channel(
    data: UserChannelCreate,
    user: dict = Depends(get_current_user)
):
    """
    Проверить что бот может постить в канал (без добавления).
    """
    # Просто вызываем add но не сохраняем
    channel_id = _parse_telegram_channel_id(data.channel_id)

    if data.platform == "telegram":
        # Use posting bot for channel validation
        bot_token = os.environ.get("TELEGRAM_POSTING_BOT_TOKEN") or os.environ.get("TELEGRAM_BOT_TOKEN")
        if not bot_token:
            raise HTTPException(status_code=500, detail="Posting bot not configured")

        provider = TelegramProvider(bot_token=bot_token)

        try:
            is_valid = await provider.validate_channel(channel_id)
            channel_info = await provider.get_channel_info(channel_id) if is_valid else None
            await provider.close()

            if is_valid and channel_info:
                return ValidateResponse(
                    valid=True,
                    can_post=True,
                    channel_info=UserChannelInfo(
                        platform="telegram",
                        channel_id=channel_id,
                        name=channel_info.title,
                        username=channel_info.username,
                        subscribers=channel_info.member_count or 0,
                        is_valid=True,
                        can_post=True,
                    )
                )
            else:
                return ValidateResponse(
                    valid=False,
                    can_post=False,
                    error="Бот не может постить в этот канал"
                )
        except Exception as e:
            await provider.close()
            return ValidateResponse(
                valid=False,
                can_post=False,
                error=str(e)
            )

    raise HTTPException(status_code=400, detail="Unsupported platform")
