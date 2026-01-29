"""
Post Publisher
Планировщик публикации постов
"""

import asyncio
from datetime import datetime
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger

from ..integrations.telegram import telegram
from ..integrations.vk import vk

scheduler = AsyncIOScheduler()


async def publish_post(post_id: str):
    """
    Опубликовать пост во все каналы.
    """
    # TODO: Get post from database
    # For now, mock data
    post = {
        "id": post_id,
        "content": "Test post",
        "channel_ids": [],
        "media_urls": [],
    }

    results = {}

    for channel_id in post["channel_ids"]:
        # TODO: Get channel from database
        channel = {"type": "telegram", "channel_id": "-1001234567890"}

        if channel["type"] == "telegram":
            result = await telegram.send_post(
                chat_id=channel["channel_id"],
                text=post["content"],
                media_urls=post["media_urls"],
            )
        elif channel["type"] == "vk":
            result = vk.send_post(
                group_id=channel["channel_id"],
                text=post["content"],
                media_urls=post["media_urls"],
            )
        else:
            result = {"error": f"Unknown channel type: {channel['type']}"}

        results[channel_id] = result

    # TODO: Update post status in database

    return results


def schedule_post(post_id: str, publish_at: datetime) -> str:
    """
    Запланировать публикацию поста.
    """
    job_id = f"publish_{post_id}"

    scheduler.add_job(
        publish_post,
        trigger=DateTrigger(run_date=publish_at),
        args=[post_id],
        id=job_id,
        replace_existing=True,
    )

    return job_id


def cancel_scheduled_post(post_id: str) -> bool:
    """
    Отменить запланированную публикацию.
    """
    job_id = f"publish_{post_id}"
    try:
        scheduler.remove_job(job_id)
        return True
    except Exception:
        return False


def reschedule_post(post_id: str, new_publish_at: datetime) -> Optional[str]:
    """
    Перенести публикацию на другое время.
    """
    job_id = f"publish_{post_id}"
    try:
        scheduler.reschedule_job(
            job_id,
            trigger=DateTrigger(run_date=new_publish_at),
        )
        return job_id
    except Exception:
        # Job doesn't exist, create new
        return schedule_post(post_id, new_publish_at)


def start_scheduler():
    """
    Запустить планировщик.
    """
    if not scheduler.running:
        scheduler.start()


def stop_scheduler():
    """
    Остановить планировщик.
    """
    if scheduler.running:
        scheduler.shutdown()
