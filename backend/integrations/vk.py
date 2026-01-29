"""
VK Integration
Публикация постов в VK сообщества
"""

import os
from typing import Optional, List, Dict, Any
import vk_api

VK_TOKEN = os.getenv("VK_TOKEN")
VK_API_VERSION = "5.131"


class VKIntegration:
    def __init__(self, token: Optional[str] = None):
        self.token = token or VK_TOKEN
        self.session = None
        self.api = None

        if self.token:
            self.session = vk_api.VkApi(token=self.token)
            self.api = self.session.get_api()

    def verify_group(self, group_id: str) -> Dict[str, Any]:
        """
        Проверить доступ к сообществу.
        """
        if not self.api:
            return {"error": "VK token not configured"}

        try:
            # Remove minus if present
            gid = group_id.lstrip("-")

            groups = self.api.groups.getById(
                group_id=gid,
                fields="description,photo_200,can_post"
            )

            if not groups:
                return {"error": "Group not found"}

            group = groups[0]

            return {
                "id": str(group["id"]),
                "name": group["name"],
                "screen_name": group.get("screen_name"),
                "photo_url": group.get("photo_200"),
                "can_post": group.get("can_post", 0) == 1,
            }
        except vk_api.VkApiError as e:
            return {"error": str(e)}

    def send_post(
        self,
        group_id: str,
        text: str,
        media_urls: Optional[List[str]] = None,
        publish_date: Optional[int] = None,  # Unix timestamp
    ) -> Dict[str, Any]:
        """
        Отправить пост в сообщество.
        """
        if not self.api:
            return {"error": "VK token not configured"}

        try:
            # Remove minus if present
            owner_id = f"-{group_id.lstrip('-')}"

            attachments = []

            # Upload photos if any
            if media_urls:
                upload = vk_api.VkUpload(self.session)
                for url in media_urls[:10]:  # Max 10 attachments
                    if url.endswith(('.mp4', '.mov', '.avi')):
                        # Video upload is more complex, skip for now
                        continue
                    else:
                        # Upload photo
                        photo = upload.photo_wall(url, group_id=int(group_id.lstrip('-')))
                        if photo:
                            attachments.append(
                                f"photo{photo[0]['owner_id']}_{photo[0]['id']}"
                            )

            params = {
                "owner_id": owner_id,
                "message": text,
                "from_group": 1,
            }

            if attachments:
                params["attachments"] = ",".join(attachments)

            if publish_date:
                params["publish_date"] = publish_date

            result = self.api.wall.post(**params)

            return {
                "success": True,
                "post_id": result["post_id"],
                "url": f"https://vk.com/wall{owner_id}_{result['post_id']}",
            }

        except vk_api.VkApiError as e:
            return {"error": str(e)}

    def delete_post(self, group_id: str, post_id: int) -> bool:
        """
        Удалить пост из сообщества.
        """
        if not self.api:
            return False

        try:
            owner_id = f"-{group_id.lstrip('-')}"
            self.api.wall.delete(owner_id=owner_id, post_id=post_id)
            return True
        except vk_api.VkApiError:
            return False

    def get_group_stats(self, group_id: str) -> Dict[str, Any]:
        """
        Получить статистику сообщества.
        """
        if not self.api:
            return {"error": "VK token not configured"}

        try:
            gid = group_id.lstrip("-")
            stats = self.api.stats.get(group_id=gid, interval="day", intervals_count=30)
            return {
                "success": True,
                "stats": stats,
            }
        except vk_api.VkApiError as e:
            return {"error": str(e)}


# Singleton instance
vk = VKIntegration()
