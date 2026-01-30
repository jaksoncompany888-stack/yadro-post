"""
Providers - Публикация в социальные сети
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)

@dataclass
class PublishResult:
    """Результат публикации"""
    success: bool
    post_id: Optional[str] = None
    url: Optional[str] = None
    error: Optional[str] = None

@dataclass
class PostStats:
    """Статистика поста"""
    views: int = 0
    likes: int = 0
    shares: int = 0
    comments: int = 0

class SocialProvider(ABC):
    """Базовый класс провайдера"""
    
    @abstractmethod
    async def publish_post(self, channel_id: str, content: str) -> PublishResult:
        """Опубликовать пост"""
        pass
    
    @abstractmethod
    async def get_post_stats(self, channel_id: str, post_id: str) -> Optional[Dict]:
        """Получить статистику поста"""
        pass

class TelegramProvider(SocialProvider):
    """Провайдер для Telegram"""
    
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self._bot = None
    
    async def _get_bot(self):
        """Получить экземпляр бота"""
        if not self._bot:
            try:
                from telegram import Bot
                self._bot = Bot(token=self.bot_token)
            except ImportError:
                logger.error("python-telegram-bot not installed")
                raise
        return self._bot
    
    async def publish_post(self, channel_id: str, content: str) -> PublishResult:
        """Опубликовать в Telegram канал"""
        try:
            bot = await self._get_bot()
            
            # Конвертация markdown в HTML если нужно
            # Telegram поддерживает HTML форматирование
            
            message = await bot.send_message(
                chat_id=channel_id,
                text=content,
                parse_mode='HTML'
            )
            
            return PublishResult(
                success=True,
                post_id=str(message.message_id),
                url=f"https://t.me/{channel_id.replace('@', '')}/{message.message_id}"
            )
            
        except Exception as e:
            logger.error(f"Telegram publish error: {e}")
            return PublishResult(
                success=False,
                error=str(e)
            )
    
    async def get_post_stats(self, channel_id: str, post_id: str) -> Optional[Dict]:
        """Получить статистику поста из Telegram"""
        try:
            # Для получения статистики нужен доступ к Telegram API
            # Через Bot API это ограничено
            # Здесь можно интегрировать telethon/pyrogram
            
            # Пока возвращаем None или mock данные
            return {
                "views": 0,
                "likes": 0,
                "shares": 0,
                "comments": 0
            }
            
        except Exception as e:
            logger.error(f"Error getting Telegram stats: {e}")
            return None

class VKProvider(SocialProvider):
    """Провайдер для VK"""
    
    def __init__(self, access_token: str):
        self.access_token = access_token
        self._api = None
    
    async def _get_api(self):
        """Получить VK API"""
        if not self._api:
            try:
                import vk_api
                self._api = vk_api.VkApi(token=self.access_token)
            except ImportError:
                logger.error("vk-api not installed")
                raise
        return self._api.get_api()
    
    async def publish_post(self, channel_id: str, content: str) -> PublishResult:
        """Опубликовать в VK группу"""
        try:
            api = await self._get_api()
            
            # VK не поддерживает HTML, нужно убрать теги
            clean_content = self._strip_html(content)
            
            # Публикация на стену группы
            response = api.wall.post(
                owner_id=channel_id,  # Отрицательный ID для групп
                message=clean_content
            )
            
            post_id = response['post_id']
            
            return PublishResult(
                success=True,
                post_id=str(post_id),
                url=f"https://vk.com/wall{channel_id}_{post_id}"
            )
            
        except Exception as e:
            logger.error(f"VK publish error: {e}")
            return PublishResult(
                success=False,
                error=str(e)
            )
    
    async def get_post_stats(self, channel_id: str, post_id: str) -> Optional[Dict]:
        """Получить статистику поста из VK"""
        try:
            api = await self._get_api()
            
            # Получение поста
            response = api.wall.getById(
                posts=[f"{channel_id}_{post_id}"]
            )
            
            if response:
                post = response[0]
                return {
                    "views": post.get('views', {}).get('count', 0),
                    "likes": post.get('likes', {}).get('count', 0),
                    "shares": post.get('reposts', {}).get('count', 0),
                    "comments": post.get('comments', {}).get('count', 0)
                }
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting VK stats: {e}")
            return None
    
    def _strip_html(self, text: str) -> str:
        """Убрать HTML теги"""
        import re
        # Простая очистка HTML
        text = re.sub(r'<b>(.*?)</b>', r'\1', text)  # Удаляем <b>
        text = re.sub(r'<i>(.*?)</i>', r'\1', text)  # Удаляем <i>
        text = re.sub(r'<[^>]+>', '', text)  # Удаляем остальные теги
        return text

class InstagramProvider(SocialProvider):
    """Провайдер для Instagram (будущее)"""
    
    def __init__(self, access_token: str):
        self.access_token = access_token
    
    async def publish_post(self, channel_id: str, content: str) -> PublishResult:
        # TODO: Интеграция Instagram Graph API
        return PublishResult(
            success=False,
            error="Instagram provider not implemented yet"
        )
    
    async def get_post_stats(self, channel_id: str, post_id: str) -> Optional[Dict]:
        return None

# Factory функция
def get_provider(platform: str, access_token: str) -> SocialProvider:
    """Получить провайдер для платформы"""
    providers = {
        "telegram": TelegramProvider,
        "vk": VKProvider,
        "instagram": InstagramProvider
    }
    
    provider_class = providers.get(platform.lower())
    if not provider_class:
        raise ValueError(f"Unknown platform: {platform}")
    
    return provider_class(access_token)
