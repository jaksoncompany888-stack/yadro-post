"""
Scheduler - Автоматическая публикация постов
"""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from datetime import datetime, timedelta
import logging
import os

# Импорты моделей (предполагается что они в main.py)
# from main import Post, Channel, Analytics, DATABASE_URL

logger = logging.getLogger(__name__)

class PostScheduler:
    """Планировщик публикаций"""
    
    def __init__(self, database_url: str):
        self.scheduler = AsyncIOScheduler()
        self.engine = create_async_engine(database_url)
        self.async_session_maker = async_sessionmaker(self.engine, expire_on_commit=False)
    
    def start(self):
        """Запуск планировщика"""
        self.scheduler.start()
        logger.info("Post scheduler started")
        
        # Загрузка существующих запланированных постов
        self.scheduler.add_job(
            self._load_scheduled_posts,
            'interval',
            minutes=5,  # Проверка каждые 5 минут
            id='load_scheduled_posts'
        )
    
    def stop(self):
        """Остановка планировщика"""
        self.scheduler.shutdown()
        logger.info("Post scheduler stopped")
    
    async def _load_scheduled_posts(self):
        """Загрузка постов которые нужно опубликовать"""
        async with self.async_session_maker() as db:
            # Импорт здесь чтобы избежать циклических зависимостей
            from main import Post
            
            # Найти все посты со статусом 'scheduled' и временем публикации в ближайший час
            now = datetime.utcnow()
            one_hour_later = now + timedelta(hours=1)
            
            result = await db.execute(
                select(Post).filter(
                    Post.status == 'scheduled',
                    Post.scheduled_time.isnot(None),
                    Post.scheduled_time.between(now, one_hour_later)
                )
            )
            posts = result.scalars().all()
            
            for post in posts:
                # Проверка что задача ещё не добавлена
                job_id = f"publish_post_{post.id}"
                if not self.scheduler.get_job(job_id):
                    self.schedule_post(post.id, post.scheduled_time)
                    logger.info(f"Scheduled post {post.id} for {post.scheduled_time}")
    
    def schedule_post(self, post_id: int, scheduled_time: datetime):
        """Запланировать публикацию поста"""
        job_id = f"publish_post_{post_id}"
        
        self.scheduler.add_job(
            self._publish_post,
            DateTrigger(run_date=scheduled_time),
            args=[post_id],
            id=job_id,
            replace_existing=True
        )
        
        logger.info(f"Post {post_id} scheduled for {scheduled_time}")
    
    def cancel_post(self, post_id: int):
        """Отменить публикацию поста"""
        job_id = f"publish_post_{post_id}"
        
        try:
            self.scheduler.remove_job(job_id)
            logger.info(f"Cancelled scheduled post {post_id}")
        except Exception as e:
            logger.warning(f"Could not cancel post {post_id}: {e}")
    
    async def _publish_post(self, post_id: int):
        """Публикация поста"""
        async with self.async_session_maker() as db:
            from main import Post, Channel
            from providers import get_provider
            
            # Получение поста
            result = await db.execute(select(Post).filter(Post.id == post_id))
            post = result.scalar_one_or_none()
            
            if not post:
                logger.error(f"Post {post_id} not found")
                return
            
            # Получение канала
            result = await db.execute(select(Channel).filter(Channel.id == post.channel_id))
            channel = result.scalar_one_or_none()
            
            if not channel:
                logger.error(f"Channel {channel.id} not found for post {post_id}")
                return
            
            try:
                # Получение провайдера для платформы
                provider = get_provider(channel.platform, channel.access_token)
                
                # Публикация
                result = await provider.publish_post(
                    channel_id=channel.channel_id,
                    content=post.content
                )
                
                if result.success:
                    # Обновление статуса поста
                    post.status = 'published'
                    post.published_at = datetime.utcnow()
                    await db.commit()
                    
                    logger.info(f"Post {post_id} published successfully")
                    
                    # Запуск задачи сбора аналитики через 1 час
                    self.scheduler.add_job(
                        self._collect_analytics,
                        DateTrigger(run_date=datetime.utcnow() + timedelta(hours=1)),
                        args=[post_id],
                        id=f"collect_analytics_{post_id}"
                    )
                else:
                    logger.error(f"Failed to publish post {post_id}: {result.error}")
                    
                    # Retry через 5 минут
                    self.scheduler.add_job(
                        self._publish_post,
                        DateTrigger(run_date=datetime.utcnow() + timedelta(minutes=5)),
                        args=[post_id],
                        id=f"retry_publish_{post_id}",
                        max_instances=3  # Максимум 3 попытки
                    )
                    
            except Exception as e:
                logger.error(f"Error publishing post {post_id}: {e}")
                post.status = 'failed'
                await db.commit()
    
    async def _collect_analytics(self, post_id: int):
        """Сбор аналитики поста"""
        async with self.async_session_maker() as db:
            from main import Post, Channel, Analytics
            from providers import get_provider
            
            # Получение поста и канала
            result = await db.execute(select(Post).filter(Post.id == post_id))
            post = result.scalar_one_or_none()
            
            if not post or post.status != 'published':
                return
            
            result = await db.execute(select(Channel).filter(Channel.id == post.channel_id))
            channel = result.scalar_one_or_none()
            
            if not channel:
                return
            
            try:
                provider = get_provider(channel.platform, channel.access_token)
                
                # Получение метрик
                stats = await provider.get_post_stats(
                    channel_id=channel.channel_id,
                    post_id=post_id
                )
                
                if stats:
                    # Сохранение аналитики
                    analytics = Analytics(
                        post_id=post_id,
                        views=stats.get('views', 0),
                        likes=stats.get('likes', 0),
                        shares=stats.get('shares', 0),
                        comments=stats.get('comments', 0)
                    )
                    db.add(analytics)
                    await db.commit()
                    
                    logger.info(f"Analytics collected for post {post_id}")
                    
                    # Запланировать следующий сбор через 24 часа
                    self.scheduler.add_job(
                        self._collect_analytics,
                        DateTrigger(run_date=datetime.utcnow() + timedelta(hours=24)),
                        args=[post_id],
                        id=f"collect_analytics_{post_id}_daily",
                        replace_existing=True
                    )
                    
            except Exception as e:
                logger.error(f"Error collecting analytics for post {post_id}: {e}")

# Global instance
scheduler = None

def init_scheduler(database_url: str):
    """Инициализация планировщика"""
    global scheduler
    scheduler = PostScheduler(database_url)
    scheduler.start()
    return scheduler

def get_scheduler() -> PostScheduler:
    """Получить экземпляр планировщика"""
    return scheduler
