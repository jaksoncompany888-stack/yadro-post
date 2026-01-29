"""
Telegram Integration
Публикация постов в Telegram каналы
"""

import os
from typing import Optional, List, Dict, Any
from telegram import Bot
from telegram.error import TelegramError

TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")


class TelegramIntegration:
    def __init__(self, token: Optional[str] = None):
        self.token = token or TELEGRAM_TOKEN
        self.bot = Bot(token=self.token) if self.token else None

    async def verify_channel(self, chat_id: str) -> Dict[str, Any]:
        """
        Проверить доступ к каналу.
        """
        if not self.bot:
            return {"error": "Bot token not configured"}

        try:
            chat = await self.bot.get_chat(chat_id)
            me = await self.bot.get_me()

            # Check if bot is admin
            member = await self.bot.get_chat_member(chat_id, me.id)
            is_admin = member.status in ["administrator", "creator"]

            photo_url = None
            if chat.photo:
                file = await self.bot.get_file(chat.photo.big_file_id)
                photo_url = file.file_path

            return {
                "id": str(chat.id),
                "title": chat.title,
                "username": chat.username,
                "type": chat.type,
                "photo_url": photo_url,
                "is_admin": is_admin,
                "can_post": is_admin and member.can_post_messages,
            }
        except TelegramError as e:
            return {"error": str(e)}

    async def send_post(
        self,
        chat_id: str,
        text: str,
        media_urls: Optional[List[str]] = None,
        parse_mode: str = "HTML",
    ) -> Dict[str, Any]:
        """
        Отправить пост в канал.
        """
        if not self.bot:
            return {"error": "Bot token not configured"}

        try:
            # No media - just text
            if not media_urls:
                message = await self.bot.send_message(
                    chat_id=chat_id,
                    text=text,
                    parse_mode=parse_mode,
                )
                return {
                    "success": True,
                    "message_id": message.message_id,
                    "url": f"https://t.me/c/{str(chat_id).replace('-100', '')}/{message.message_id}",
                }

            # Single media
            if len(media_urls) == 1:
                url = media_urls[0]
                if url.endswith(('.mp4', '.mov', '.avi')):
                    message = await self.bot.send_video(
                        chat_id=chat_id,
                        video=url,
                        caption=text,
                        parse_mode=parse_mode,
                    )
                else:
                    message = await self.bot.send_photo(
                        chat_id=chat_id,
                        photo=url,
                        caption=text,
                        parse_mode=parse_mode,
                    )
                return {
                    "success": True,
                    "message_id": message.message_id,
                }

            # Multiple media - media group
            from telegram import InputMediaPhoto, InputMediaVideo

            media_group = []
            for i, url in enumerate(media_urls[:10]):  # Max 10 items
                if url.endswith(('.mp4', '.mov', '.avi')):
                    item = InputMediaVideo(
                        media=url,
                        caption=text if i == 0 else None,
                        parse_mode=parse_mode if i == 0 else None,
                    )
                else:
                    item = InputMediaPhoto(
                        media=url,
                        caption=text if i == 0 else None,
                        parse_mode=parse_mode if i == 0 else None,
                    )
                media_group.append(item)

            messages = await self.bot.send_media_group(
                chat_id=chat_id,
                media=media_group,
            )
            return {
                "success": True,
                "message_id": messages[0].message_id,
            }

        except TelegramError as e:
            return {"error": str(e)}

    async def delete_post(self, chat_id: str, message_id: int) -> bool:
        """
        Удалить пост из канала.
        """
        if not self.bot:
            return False

        try:
            await self.bot.delete_message(chat_id=chat_id, message_id=message_id)
            return True
        except TelegramError:
            return False


# Singleton instance
telegram = TelegramIntegration()
