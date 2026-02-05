"""
Analytics API

Статистика по постам и каналам пользователя.
"""

from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, Depends, Query

from .deps import get_current_user, get_db


router = APIRouter(prefix="/analytics", tags=["analytics"])


# =============================================================================
# Models
# =============================================================================

class PostStats(BaseModel):
    """Статистика по одному посту."""
    id: int
    text_preview: str
    channel_id: Optional[str]
    status: str
    created_at: str
    publish_at: Optional[str]


class ChannelStats(BaseModel):
    """Статистика по каналу."""
    channel_id: str
    name: str
    platform: str
    total_posts: int
    draft_posts: int
    scheduled_posts: int
    published_posts: int


class DailyStats(BaseModel):
    """Статистика по дням."""
    date: str
    posts_created: int
    posts_published: int


class OverviewStats(BaseModel):
    """Общая статистика."""
    total_posts: int
    draft_posts: int
    scheduled_posts: int
    published_posts: int
    error_posts: int
    channels_count: int


class AnalyticsResponse(BaseModel):
    """Полный ответ аналитики."""
    overview: OverviewStats
    channels: List[ChannelStats]
    daily: List[DailyStats]
    recent_posts: List[PostStats]


# =============================================================================
# Endpoints
# =============================================================================

@router.get("", response_model=AnalyticsResponse)
async def get_analytics(
    period: str = Query("30d", description="Период: 7d, 30d, 90d"),
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить аналитику по постам и каналам.

    Возвращает:
    - overview: общая статистика
    - channels: статистика по каналам
    - daily: статистика по дням
    - recent_posts: последние посты
    """
    user_id = current_user["id"]

    # Parse period
    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    since_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")

    # Overview stats
    overview_row = db.fetch_one("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
            SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
            SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
            SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
        FROM drafts
        WHERE user_id = ?
    """, (user_id,))

    # Channels count
    channels_count = db.fetch_value("""
        SELECT COUNT(DISTINCT channel_id) FROM user_channels WHERE user_id = ?
    """, (user_id,), default=0)

    overview = OverviewStats(
        total_posts=overview_row["total"] or 0,
        draft_posts=overview_row["drafts"] or 0,
        scheduled_posts=overview_row["scheduled"] or 0,
        published_posts=overview_row["published"] or 0,
        error_posts=overview_row["errors"] or 0,
        channels_count=channels_count or 0,
    )

    # Channel stats
    channel_rows = db.fetch_all("""
        SELECT
            uc.channel_id,
            uc.name,
            uc.platform,
            COUNT(d.id) as total_posts,
            SUM(CASE WHEN d.status = 'draft' THEN 1 ELSE 0 END) as drafts,
            SUM(CASE WHEN d.status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
            SUM(CASE WHEN d.status = 'published' THEN 1 ELSE 0 END) as published
        FROM user_channels uc
        LEFT JOIN drafts d ON d.channel_id = uc.channel_id AND d.user_id = uc.user_id
        WHERE uc.user_id = ?
        GROUP BY uc.channel_id
    """, (user_id,))

    channels = [
        ChannelStats(
            channel_id=row["channel_id"],
            name=row["name"],
            platform=row["platform"],
            total_posts=row["total_posts"] or 0,
            draft_posts=row["drafts"] or 0,
            scheduled_posts=row["scheduled"] or 0,
            published_posts=row["published"] or 0,
        )
        for row in channel_rows
    ]

    # Daily stats (last N days)
    daily_rows = db.fetch_all("""
        SELECT
            DATE(created_at) as date,
            COUNT(*) as created,
            SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
        FROM drafts
        WHERE user_id = ? AND DATE(created_at) >= ?
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    """, (user_id, since_date))

    daily = [
        DailyStats(
            date=row["date"],
            posts_created=row["created"] or 0,
            posts_published=row["published"] or 0,
        )
        for row in daily_rows
    ]

    # Recent posts (last 20)
    post_rows = db.fetch_all("""
        SELECT id, text, channel_id, status, created_at, publish_at
        FROM drafts
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
    """, (user_id,))

    recent_posts = [
        PostStats(
            id=row["id"],
            text_preview=row["text"][:100] + "..." if len(row["text"] or "") > 100 else (row["text"] or ""),
            channel_id=row["channel_id"],
            status=row["status"],
            created_at=row["created_at"] or "",
            publish_at=row["publish_at"],
        )
        for row in post_rows
    ]

    return AnalyticsResponse(
        overview=overview,
        channels=channels,
        daily=daily,
        recent_posts=recent_posts,
    )


@router.get("/posts")
async def get_posts_analytics(
    channel_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Получить список постов с фильтрацией.
    """
    user_id = current_user["id"]

    # Build query
    conditions = ["user_id = ?"]
    params = [user_id]

    if channel_id:
        conditions.append("channel_id = ?")
        params.append(channel_id)

    if status:
        conditions.append("status = ?")
        params.append(status)

    where_clause = " AND ".join(conditions)

    # Get total count
    total = db.fetch_value(
        f"SELECT COUNT(*) FROM drafts WHERE {where_clause}",
        tuple(params),
        default=0
    )

    # Get posts
    params.extend([limit, offset])
    rows = db.fetch_all(f"""
        SELECT id, text, channel_id, status, created_at, publish_at, topic
        FROM drafts
        WHERE {where_clause}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    """, tuple(params))

    posts = [
        {
            "id": row["id"],
            "text_preview": row["text"][:150] + "..." if len(row["text"] or "") > 150 else (row["text"] or ""),
            "channel_id": row["channel_id"],
            "status": row["status"],
            "created_at": row["created_at"],
            "publish_at": row["publish_at"],
            "topic": row["topic"],
        }
        for row in rows
    ]

    return {
        "total": total,
        "posts": posts,
        "limit": limit,
        "offset": offset,
    }
