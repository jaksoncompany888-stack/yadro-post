"""
Background Scheduler using APScheduler

Handles:
- Auto-publishing scheduled posts
- Auto-collecting analytics after publishing
- Retry logic for failed posts
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Global scheduler instance
_scheduler: Optional[AsyncIOScheduler] = None


def get_scheduler() -> AsyncIOScheduler:
    """Get or create the global scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler()
    return _scheduler


def start_scheduler():
    """Start the background scheduler."""
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
        print("[APScheduler] Background scheduler started")
        logger.info("Background scheduler started")

        # Add periodic job to check for due posts every minute
        scheduler.add_job(
            check_scheduled_posts,
            IntervalTrigger(minutes=1),
            id='check_scheduled_posts',
            replace_existing=True
        )
        print("[APScheduler] Added periodic job: check_scheduled_posts (every 1 min)")
        logger.info("Added periodic job: check_scheduled_posts (every 1 min)")


def stop_scheduler():
    """Stop the background scheduler."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        print("[APScheduler] Background scheduler stopped")
        logger.info("Background scheduler stopped")


async def check_scheduled_posts():
    """
    Check for posts that need to be published.
    Called every minute by the scheduler.
    """
    from ..storage.database import Database
    from ..providers import ProviderManager

    print("[APScheduler] Checking for scheduled posts...")
    db = Database()
    now = datetime.utcnow()

    # Find posts with status='scheduled' and publish_at <= now
    rows = db.fetch_all(
        """SELECT id, user_id, text, metadata, publish_at
           FROM drafts
           WHERE status = 'scheduled'
           AND publish_at IS NOT NULL
           AND publish_at <= ?
           ORDER BY publish_at ASC
           LIMIT 10""",
        (now.isoformat(),)
    )

    for row in rows:
        post_id = row['id']
        logger.info(f"Publishing scheduled post {post_id}")

        try:
            await publish_post_with_retry(db, post_id, max_retries=3)
        except Exception as e:
            logger.error(f"Failed to publish post {post_id}: {e}")


async def publish_post_with_retry(db, post_id: int, max_retries: int = 3):
    """
    Publish a post with retry logic.

    Args:
        db: Database instance
        post_id: Post ID to publish
        max_retries: Maximum number of retry attempts
    """
    import json
    from ..providers import ProviderManager, TelegramProvider
    import os

    row = db.fetch_one("SELECT * FROM drafts WHERE id = ?", (post_id,))
    if not row:
        logger.warning(f"Post {post_id} not found")
        return

    metadata = json.loads(row.get('metadata') or '{}')
    channel_ids = metadata.get('channel_ids', {})
    platforms = metadata.get('platforms', ['telegram'])
    text = row['text']

    retry_count = metadata.get('retry_count', 0)

    # Initialize provider manager - use posting bot
    bot_token = os.environ.get('TELEGRAM_POSTING_BOT_TOKEN') or os.environ.get('TELEGRAM_BOT_TOKEN', '')
    provider_manager = ProviderManager()

    if bot_token:
        provider_manager.register(TelegramProvider(bot_token))

    success = False
    error_message = None
    published_ids = metadata.get('published_ids', {})
    published_urls = metadata.get('published_urls', {})

    for platform in platforms:
        channel_id = channel_ids.get(platform)
        if not channel_id:
            continue

        try:
            result = await provider_manager.post(platform, channel_id, text)

            if result.success:
                published_ids[platform] = result.post_id
                published_urls[platform] = result.url
                success = True
                logger.info(f"Published to {platform}: {result.url}")
            else:
                error_message = result.error
                logger.warning(f"Failed to publish to {platform}: {result.error}")

        except Exception as e:
            error_message = str(e)
            logger.error(f"Error publishing to {platform}: {e}")

    # Update post status
    if success:
        metadata['published_ids'] = published_ids
        metadata['published_urls'] = published_urls
        metadata['published_at'] = datetime.utcnow().isoformat()

        db.execute(
            """UPDATE drafts
               SET status = 'published', metadata = ?, updated_at = ?
               WHERE id = ?""",
            (json.dumps(metadata), datetime.utcnow().isoformat(), post_id)
        )

        # Schedule analytics collection
        schedule_analytics_collection(post_id)

    elif retry_count < max_retries:
        # Schedule retry
        metadata['retry_count'] = retry_count + 1
        metadata['last_error'] = error_message

        db.execute(
            """UPDATE drafts SET metadata = ?, updated_at = ? WHERE id = ?""",
            (json.dumps(metadata), datetime.utcnow().isoformat(), post_id)
        )

        # Retry in 5 minutes
        retry_time = datetime.utcnow() + timedelta(minutes=5)
        scheduler = get_scheduler()
        scheduler.add_job(
            publish_post_with_retry,
            DateTrigger(run_date=retry_time),
            args=[db, post_id, max_retries],
            id=f'retry_post_{post_id}_{retry_count + 1}',
            replace_existing=True
        )
        logger.info(f"Scheduled retry #{retry_count + 1} for post {post_id} at {retry_time}")

    else:
        # Max retries reached
        metadata['error_message'] = error_message
        metadata['retry_count'] = retry_count

        db.execute(
            """UPDATE drafts
               SET status = 'failed', metadata = ?, updated_at = ?
               WHERE id = ?""",
            (json.dumps(metadata), datetime.utcnow().isoformat(), post_id)
        )
        logger.error(f"Post {post_id} failed after {max_retries} retries")


def schedule_analytics_collection(post_id: int):
    """
    Schedule analytics collection for a published post.
    - First collection: 1 hour after publishing
    - Then: every 24 hours for 7 days
    """
    scheduler = get_scheduler()

    # First collection in 1 hour
    first_run = datetime.utcnow() + timedelta(hours=1)
    scheduler.add_job(
        collect_post_analytics,
        DateTrigger(run_date=first_run),
        args=[post_id],
        id=f'analytics_{post_id}_first',
        replace_existing=True
    )
    logger.info(f"Scheduled first analytics collection for post {post_id} at {first_run}")

    # Then every 24 hours for 7 days
    for day in range(1, 8):
        run_time = datetime.utcnow() + timedelta(days=day)
        scheduler.add_job(
            collect_post_analytics,
            DateTrigger(run_date=run_time),
            args=[post_id],
            id=f'analytics_{post_id}_day{day}',
            replace_existing=True
        )


async def collect_post_analytics(post_id: int):
    """
    Collect analytics for a published post.
    Gets views, likes, shares, comments from the platform API.
    """
    import json
    import os
    from ..storage.database import Database
    from ..providers import TelegramProvider

    db = Database()

    row = db.fetch_one("SELECT * FROM drafts WHERE id = ?", (post_id,))
    if not row:
        logger.warning(f"Post {post_id} not found for analytics")
        return

    metadata = json.loads(row.get('metadata') or '{}')
    published_ids = metadata.get('published_ids', {})

    if not published_ids:
        logger.warning(f"No published IDs for post {post_id}")
        return

    # Collect from Telegram
    if 'telegram' in published_ids:
        bot_token = os.environ.get('TELEGRAM_POSTING_BOT_TOKEN') or os.environ.get('TELEGRAM_BOT_TOKEN', '')
        if bot_token:
            try:
                provider = TelegramProvider(bot_token)
                channel_ids = metadata.get('channel_ids', {})
                channel_id = channel_ids.get('telegram')
                message_id = published_ids['telegram']

                if channel_id and message_id:
                    stats = await provider.get_post_stats(channel_id, message_id)

                    if stats:
                        # Save to analytics history
                        analytics_history = metadata.get('analytics_history', [])
                        analytics_history.append({
                            'timestamp': datetime.utcnow().isoformat(),
                            'platform': 'telegram',
                            'views': stats.get('views', 0),
                            'forwards': stats.get('forwards', 0),
                            'reactions': stats.get('reactions', 0),
                        })

                        metadata['analytics_history'] = analytics_history
                        metadata['last_analytics'] = {
                            'timestamp': datetime.utcnow().isoformat(),
                            'views': stats.get('views', 0),
                            'forwards': stats.get('forwards', 0),
                            'reactions': stats.get('reactions', 0),
                        }

                        db.execute(
                            "UPDATE drafts SET metadata = ?, updated_at = ? WHERE id = ?",
                            (json.dumps(metadata), datetime.utcnow().isoformat(), post_id)
                        )
                        logger.info(f"Collected analytics for post {post_id}: {stats}")

            except Exception as e:
                logger.error(f"Failed to collect Telegram analytics for post {post_id}: {e}")
