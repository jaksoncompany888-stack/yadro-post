"""
AI Service - Генерация постов
"""

import os
from typing import List
from pydantic import BaseModel
import anthropic

class AIConfig:
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
    MODEL = "claude-sonnet-4-20250514"
    MAX_TOKENS = 1000

class GeneratedPost(BaseModel):
    content: str
    hashtags: List[str]
    suggested_time: str

class AIService:
    """Сервис для работы с AI"""
    
    def __init__(self):
        self.client = None
        if AIConfig.ANTHROPIC_API_KEY:
            self.client = anthropic.Anthropic(api_key=AIConfig.ANTHROPIC_API_KEY)
    
    async def generate_post(
        self,
        topic: str,
        platform: str = "telegram",
        style: str = "casual"
    ) -> GeneratedPost:
        """
        Генерация поста
        
        Args:
            topic: Тема поста
            platform: Платформа (telegram, vk, instagram)
            style: Стиль (casual, formal, funny)
        
        Returns:
            Сгенерированный пост
        """
        
        if not self.client:
            # Mock генерация если нет API ключа
            return self._generate_mock_post(topic, platform, style)
        
        # Генерация через Claude
        style_prompts = {
            "casual": """
            Стиль: Неформальный, дружелюбный
            Тон: Разговорный, как общение с другом
            Эмодзи: Умеренно (2-3 на пост)
            Формат: 2-3 коротких абзаца
            """,
            "formal": """
            Стиль: Деловой, профессиональный
            Тон: Экспертный, информативный
            Эмодзи: Минимально (только для акцентов)
            Формат: Структурированный текст с чёткими тезисами
            """,
            "funny": """
            Стиль: С юмором, легкий
            Тон: Шутливый, но не переборщить
            Эмодзи: Активно (4-5 на пост)
            Формат: Динамичный текст с шутками
            """
        }
        
        prompt = f"""Сгенерируй пост для {platform} на тему: "{topic}"

{style_prompts.get(style, style_prompts['casual'])}

Требования:
1. Начни с цепляющего заголовка (выдели жирным через <b>текст</b>)
2. Основной контент: 150-250 слов
3. Добавь 2-3 релевантных хештега
4. Рекомендуй оптимальное время для публикации (формат HH:MM)

Верни в формате JSON:
{{
    "content": "текст поста с <b>форматированием</b>",
    "hashtags": ["#хештег1", "#хештег2"],
    "suggested_time": "18:00"
}}

Важно: Не используй markdown блоки (```), верни чистый JSON."""

        try:
            message = self.client.messages.create(
                model=AIConfig.MODEL,
                max_tokens=AIConfig.MAX_TOKENS,
                temperature=self._get_temperature(style),
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            # Парсинг ответа
            response_text = message.content[0].text
            
            # Очистка от возможных markdown блоков
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()
            
            import json
            data = json.loads(response_text)
            
            return GeneratedPost(
                content=data["content"],
                hashtags=data["hashtags"],
                suggested_time=data["suggested_time"]
            )
            
        except Exception as e:
            print(f"Error generating post: {e}")
            # Fallback на mock
            return self._generate_mock_post(topic, platform, style)
    
    def _get_temperature(self, style: str) -> float:
        """Температура в зависимости от стиля"""
        temperatures = {
            "casual": 0.7,
            "formal": 0.3,
            "funny": 0.9
        }
        return temperatures.get(style, 0.7)
    
    def _generate_mock_post(
        self,
        topic: str,
        platform: str,
        style: str
    ) -> GeneratedPost:
        """Mock генерация поста"""
        
        emoji_map = {
            "casual": "✨💡🎯",
            "formal": "📊📈💼",
            "funny": "😄🎉🤣"
        }
        
        templates = {
            "casual": """<b>{emoji} {topic}: главное что нужно знать</b>

Привет! Давай разберём тему {topic} — сейчас это особенно актуально.

{emoji} Основные моменты:
• Тренд набирает обороты
• Эксперты советуют обратить внимание
• Уже есть успешные кейсы

Следи за обновлениями — будет интересно! {emoji}""",
            
            "formal": """<b>📊 {topic}: профессиональный обзор</b>

Анализ темы {topic} показывает устойчивую динамику роста интереса.

Ключевые аспекты:
• Рыночные тренды демонстрируют положительную динамику
• Экспертное сообщество рекомендует углубленное изучение
• Практическое применение показывает эффективность

Рекомендуется отслеживать развитие ситуации.""",
            
            "funny": """<b>😄 {topic} — давайте разберёмся с юмором!</b>

Все говорят про {topic}, а вы всё ещё не в теме? Исправляемся! 🎉

🤣 Что происходит:
• Весь интернет обсуждает
• Даже бабушка в курсе
• Пора и нам подключиться!

Короче, следите за новостями — будет весело! 🚀"""
        }
        
        emoji = emoji_map.get(style, "✨")[0]
        template = templates.get(style, templates["casual"])
        
        content = template.format(
            emoji=emoji,
            topic=topic.capitalize()
        )
        
        hashtags = [
            f"#{''.join(topic.split())}",
            "#тренды",
            "#инсайты"
        ]
        
        suggested_time = "18:00" if platform == "telegram" else "12:00"
        
        return GeneratedPost(
            content=content,
            hashtags=hashtags,
            suggested_time=suggested_time
        )
    
    async def edit_post(
        self,
        original_text: str,
        instruction: str
    ) -> str:
        """Редактирование поста по инструкции"""
        
        if not self.client:
            return f"{original_text}\n\n[Отредактировано: {instruction}]"
        
        prompt = f"""Отредактируй этот пост согласно инструкции.

Исходный текст:
{original_text}

Инструкция: {instruction}

Верни только отредактированный текст, сохранив HTML форматирование."""

        try:
            message = self.client.messages.create(
                model=AIConfig.MODEL,
                max_tokens=AIConfig.MAX_TOKENS,
                messages=[{
                    "role": "user",
                    "content": prompt
                }]
            )
            
            return message.content[0].text
            
        except Exception as e:
            print(f"Error editing post: {e}")
            return f"{original_text}\n\n[Отредактировано: {instruction}]"

# Singleton instance
ai_service = AIService()
