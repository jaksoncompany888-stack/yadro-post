"""
Calendar Router
Календарь постов
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date
from enum import Enum

router = APIRouter()


class CalendarView(str, Enum):
    DAY = "day"
    WEEK = "week"
    MONTH = "month"


class CalendarEvent(BaseModel):
    id: str
    title: str
    content: str
    channel_ids: List[str]
    scheduled_at: datetime
    status: str
    color: Optional[str] = "#8b5cf6"  # Purple default


class CalendarResponse(BaseModel):
    events: List[CalendarEvent]
    start_date: date
    end_date: date
    view: CalendarView


@router.get("/", response_model=CalendarResponse)
async def get_calendar(
    view: CalendarView = CalendarView.WEEK,
    date: Optional[str] = None,  # YYYY-MM-DD
):
    """
    Получить события календаря.
    По умолчанию — текущая неделя.
    """
    from datetime import timedelta

    if date:
        center_date = datetime.strptime(date, "%Y-%m-%d").date()
    else:
        center_date = datetime.utcnow().date()

    if view == CalendarView.DAY:
        start = center_date
        end = center_date
    elif view == CalendarView.WEEK:
        start = center_date - timedelta(days=center_date.weekday())
        end = start + timedelta(days=6)
    else:  # month
        start = center_date.replace(day=1)
        next_month = start.replace(day=28) + timedelta(days=4)
        end = next_month - timedelta(days=next_month.day)

    # TODO: Get posts from database for this date range
    events = []

    return {
        "events": events,
        "start_date": start,
        "end_date": end,
        "view": view,
    }


@router.get("/slots")
async def get_available_slots(
    date: str,  # YYYY-MM-DD
    channel_ids: List[str] = Query(default=[]),
):
    """
    Получить доступные слоты для публикации.
    Учитывает оптимальное время для каждой платформы.
    """
    # Optimal posting times
    telegram_slots = ["09:00", "12:00", "18:00", "21:00"]
    vk_slots = ["10:00", "13:00", "19:00", "22:00"]

    return {
        "date": date,
        "slots": {
            "telegram": telegram_slots,
            "vk": vk_slots,
        }
    }
