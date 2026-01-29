"""
Channels Router
Управление каналами (Telegram, VK)
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

router = APIRouter()


class ChannelType(str, Enum):
    TELEGRAM = "telegram"
    VK = "vk"


class ChannelCreate(BaseModel):
    type: ChannelType
    name: str
    access_token: Optional[str] = None
    channel_id: str  # Telegram chat_id or VK group_id


class ChannelResponse(BaseModel):
    id: str
    type: ChannelType
    name: str
    channel_id: str
    avatar_url: Optional[str]
    is_connected: bool
    created_at: datetime


# In-memory storage
channels_db = {}


@router.get("/", response_model=List[ChannelResponse])
async def list_channels():
    """Список подключённых каналов."""
    return list(channels_db.values())


@router.post("/", response_model=ChannelResponse)
async def create_channel(channel: ChannelCreate):
    """Подключить новый канал."""
    channel_id = f"ch_{len(channels_db) + 1}"

    new_channel = {
        "id": channel_id,
        "type": channel.type,
        "name": channel.name,
        "channel_id": channel.channel_id,
        "avatar_url": None,
        "is_connected": True,
        "created_at": datetime.utcnow(),
    }

    channels_db[channel_id] = new_channel
    return new_channel


@router.get("/{channel_id}", response_model=ChannelResponse)
async def get_channel(channel_id: str):
    """Получить канал по ID."""
    if channel_id not in channels_db:
        raise HTTPException(status_code=404, detail="Channel not found")
    return channels_db[channel_id]


@router.delete("/{channel_id}")
async def delete_channel(channel_id: str):
    """Отключить канал."""
    if channel_id not in channels_db:
        raise HTTPException(status_code=404, detail="Channel not found")

    del channels_db[channel_id]
    return {"status": "deleted"}


@router.post("/telegram/connect")
async def connect_telegram(code: str):
    """
    Подключить Telegram канал.
    Пользователь добавляет бота в канал и отправляет /connect CODE
    """
    # TODO: Verify code and get channel info from bot
    return {
        "status": "pending",
        "message": "Добавьте бота @YadroPostBot в ваш канал как админа и отправьте /connect " + code
    }


@router.post("/vk/connect")
async def connect_vk(access_token: str, group_id: str):
    """
    Подключить VK сообщество.
    Требует access_token с правами на управление группой.
    """
    # TODO: Verify token and get group info
    return {
        "status": "connected",
        "group_id": group_id
    }
