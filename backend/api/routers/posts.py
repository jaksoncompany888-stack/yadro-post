"""
Posts Router
CRUD операции с постами
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum

router = APIRouter()


class PostStatus(str, Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class PostCreate(BaseModel):
    content: str
    channel_ids: List[str]
    scheduled_at: Optional[datetime] = None
    media_urls: Optional[List[str]] = None


class PostUpdate(BaseModel):
    content: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    media_urls: Optional[List[str]] = None


class PostResponse(BaseModel):
    id: str
    content: str
    channel_ids: List[str]
    status: PostStatus
    scheduled_at: Optional[datetime]
    published_at: Optional[datetime]
    media_urls: List[str]
    created_at: datetime
    updated_at: datetime


# In-memory storage (replace with database)
posts_db = {}


@router.get("/", response_model=List[PostResponse])
async def list_posts(
    status: Optional[PostStatus] = None,
    channel_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """Список постов."""
    posts = list(posts_db.values())

    if status:
        posts = [p for p in posts if p["status"] == status]
    if channel_id:
        posts = [p for p in posts if channel_id in p["channel_ids"]]

    return posts[offset:offset + limit]


@router.post("/", response_model=PostResponse)
async def create_post(post: PostCreate):
    """Создать новый пост."""
    post_id = f"post_{len(posts_db) + 1}"
    now = datetime.utcnow()

    new_post = {
        "id": post_id,
        "content": post.content,
        "channel_ids": post.channel_ids,
        "status": PostStatus.SCHEDULED if post.scheduled_at else PostStatus.DRAFT,
        "scheduled_at": post.scheduled_at,
        "published_at": None,
        "media_urls": post.media_urls or [],
        "created_at": now,
        "updated_at": now,
    }

    posts_db[post_id] = new_post
    return new_post


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(post_id: str):
    """Получить пост по ID."""
    if post_id not in posts_db:
        raise HTTPException(status_code=404, detail="Post not found")
    return posts_db[post_id]


@router.put("/{post_id}", response_model=PostResponse)
async def update_post(post_id: str, post: PostUpdate):
    """Обновить пост."""
    if post_id not in posts_db:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = posts_db[post_id]

    if post.content is not None:
        existing["content"] = post.content
    if post.scheduled_at is not None:
        existing["scheduled_at"] = post.scheduled_at
        existing["status"] = PostStatus.SCHEDULED
    if post.media_urls is not None:
        existing["media_urls"] = post.media_urls

    existing["updated_at"] = datetime.utcnow()
    return existing


@router.delete("/{post_id}")
async def delete_post(post_id: str):
    """Удалить пост."""
    if post_id not in posts_db:
        raise HTTPException(status_code=404, detail="Post not found")

    del posts_db[post_id]
    return {"status": "deleted"}


@router.post("/{post_id}/publish")
async def publish_post(post_id: str):
    """Опубликовать пост сейчас."""
    if post_id not in posts_db:
        raise HTTPException(status_code=404, detail="Post not found")

    post = posts_db[post_id]

    # TODO: Actually publish to channels
    post["status"] = PostStatus.PUBLISHED
    post["published_at"] = datetime.utcnow()
    post["updated_at"] = datetime.utcnow()

    return {"status": "published", "post": post}
