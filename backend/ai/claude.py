"""
Claude AI Integration
Генерация и редактирование контента
"""

import os
from typing import Optional, List, Dict, Any
import anthropic

# Initialize client
client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY")
)

MODEL = "claude-sonnet-4-20250514"


async def generate_content(
    topic: str,
    platform: str = "telegram",
    style: Optional[str] = None,
    language: str = "ru",
    max_length: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Генерация поста для соцсетей.
    """

    # Platform-specific constraints
    platform_limits = {
        "telegram": 4096,
        "vk": 16384,
    }

    max_chars = max_length or platform_limits.get(platform, 4096)

    style_hint = ""
    if style == "formal":
        style_hint = "Пиши в деловом стиле, без эмодзи."
    elif style == "casual":
        style_hint = "Пиши дружелюбно и неформально, используй эмодзи умеренно."
    elif style == "funny":
        style_hint = "Добавь юмор и шутки, много эмодзи."

    system_prompt = f"""Ты SMM-специалист. Пишешь посты для {platform}.
Язык: {'русский' if language == 'ru' else 'английский'}.
Максимум {max_chars} символов.
{style_hint}

Формат ответа:
1. Сам текст поста
2. ---HASHTAGS---
3. Хэштеги через запятую
4. ---TIME---
5. Лучшее время для публикации (HH:MM)"""

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=[
            {"role": "user", "content": f"Напиши пост на тему: {topic}"}
        ]
    )

    response_text = message.content[0].text

    # Parse response
    parts = response_text.split("---HASHTAGS---")
    content = parts[0].strip()

    hashtags = []
    suggested_time = None

    if len(parts) > 1:
        rest = parts[1]
        if "---TIME---" in rest:
            hashtag_part, time_part = rest.split("---TIME---")
            hashtags = [h.strip() for h in hashtag_part.strip().split(",") if h.strip()]
            suggested_time = time_part.strip()
        else:
            hashtags = [h.strip() for h in rest.strip().split(",") if h.strip()]

    return {
        "content": content,
        "hashtags": hashtags,
        "suggested_time": suggested_time,
        "platform": platform,
    }


async def edit_content(
    content: str,
    instruction: str,
) -> Dict[str, Any]:
    """
    Редактирование поста по инструкции.
    """

    system_prompt = """Ты редактор SMM-контента.
Отредактируй текст по инструкции пользователя.
Верни только отредактированный текст, без пояснений."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=[
            {"role": "user", "content": f"Текст:\n{content}\n\nИнструкция: {instruction}"}
        ]
    )

    edited_content = message.content[0].text.strip()

    # Determine changes
    changes = []
    if len(edited_content) < len(content):
        changes.append("Сокращён текст")
    elif len(edited_content) > len(content):
        changes.append("Добавлен контент")

    return {
        "content": edited_content,
        "changes": changes,
    }


async def chat_completion(
    messages: List[Dict[str, str]],
    context: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Чат с AI ассистентом.
    """

    system_prompt = """Ты AI-ассистент для SMM.
Помогаешь с созданием контента, отвечаешь на вопросы о соцсетях.
Будь полезным и кратким."""

    if context:
        system_prompt += f"\n\nТекущий пост пользователя:\n{context}"

    # Convert to Anthropic format
    anthropic_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
    ]

    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system_prompt,
        messages=anthropic_messages,
    )

    response = message.content[0].text.strip()

    # Detect suggested action
    suggested_action = None
    lower_response = response.lower()
    if "сгенериров" in lower_response or "создать пост" in lower_response:
        suggested_action = "generate"
    elif "редактир" in lower_response or "измени" in lower_response:
        suggested_action = "edit"

    return {
        "message": response,
        "suggested_action": suggested_action,
    }
