"""
Channels API

Анализ и управление Telegram каналами.
Каналы для анализа конкурентов хранятся в БД привязанно к user_id.
"""

from typing import Optional, List
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException, Depends

from app.tools.channel_parser import ChannelParser
from app.api.deps import get_current_user, get_db
from app.memory import MemoryService, MemoryType


router = APIRouter(prefix="/channels", tags=["channels"])


# =============================================================================
# Models
# =============================================================================

class ChannelInfo(BaseModel):
    username: str
    title: str
    subscribers: int
    description: str


class ChannelMetrics(BaseModel):
    posts_analyzed: int
    avg_length: int
    length_category: str
    avg_emoji: float
    emoji_style: str
    avg_hashtags: float
    top_hashtags: List[str]
    structure: List[str]
    hook_patterns: List[str]
    cta_style: str
    top_words: List[str]
    avg_views: int
    max_views: int
    min_views: int
    avg_reactions: int
    total_reactions: int
    avg_forwards: int
    engagement_rate: float
    recommended_temperature: float
    content_type: str


class ChannelAnalysis(BaseModel):
    channel: ChannelInfo
    metrics: ChannelMetrics
    examples: dict


class AnalyzeRequest(BaseModel):
    channel: str  # @username или username
    limit: int = 30  # Больше постов = лучше анализ разных тем
    save_to_memory: bool = True  # Сохранять анализ в память пользователя


# =============================================================================
# Endpoints
# =============================================================================

@router.post("/analyze", response_model=ChannelAnalysis)
async def analyze_channel(
    data: AnalyzeRequest,
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Анализ Telegram канала.

    Парсит посты и вычисляет метрики:
    - Длина постов, эмодзи, хештеги
    - Структура (списки, абзацы)
    - Хуки и CTA
    - Просмотры, реакции, engagement
    - Рекомендуемая temperature для AI

    Сохраняет анализ в память пользователя для использования при генерации постов.
    """
    parser = ChannelParser()
    user_id = current_user["id"]

    try:
        # Получаем информацию о канале
        info = parser.get_channel_info(data.channel)

        # Парсим посты
        posts = parser.parse_channel(data.channel, limit=data.limit)

        if not posts:
            raise HTTPException(
                status_code=404,
                detail="Посты не найдены. Канал приватный или пустой."
            )

        # Вычисляем метрики
        posts_data = [
            {
                "text": p.text,
                "views": p.views,
                "reactions": p.reactions,
                "forwards": p.forwards,
            }
            for p in posts
        ]

        metrics = _compute_metrics(posts_data)

        # Формируем username
        username = data.channel.replace("@", "").replace("https://t.me/", "")

        analysis = ChannelAnalysis(
            channel=ChannelInfo(
                username=username,
                title=info["title"],
                subscribers=info["subscribers"],
                description=info["description"],
            ),
            metrics=ChannelMetrics(
                posts_analyzed=metrics["posts_analyzed"],
                **metrics["metrics"]
            ),
            examples=metrics["examples"],
        )

        # Сохраняем анализ в память пользователя
        if data.save_to_memory:
            memory = MemoryService(db=db)

            # Формируем текстовое описание стиля для памяти
            # ВАЖНО: добавляем больше ключевых слов для FTS5 поиска
            m = metrics["metrics"]
            description_clean = info.get('description', '')[:200] if info.get('description') else ''
            style_content = f"""Стиль канала @{username}:
📊 {info['title']} ({info['subscribers']} подписчиков)
Тематика: {description_clean}
Длина постов: {m['length_category']} (~{m['avg_length']} символов)
Эмодзи: {m['emoji_style']} ({m['avg_emoji']} в среднем)
Структура: {', '.join(m['structure'])}
Хуки: {', '.join(m['hook_patterns'])}
CTA: {m['cta_style']}
Тип контента: {m['content_type']}
Engagement: {m['engagement_rate']}%
Ключевые слова: {', '.join(m['top_words'][:10])}"""

            # Удаляем старый анализ этого канала (если есть)
            db.execute(
                "DELETE FROM memory_items WHERE user_id = ? AND content LIKE ?",
                (user_id, f"Стиль канала @{username}%")
            )
            # Удаляем из FTS
            db.execute(
                """DELETE FROM memory_fts WHERE rowid IN (
                    SELECT id FROM memory_items WHERE user_id = ? AND content LIKE ?
                )""",
                (user_id, f"Стиль канала @{username}%")
            )

            # Сохраняем новый анализ
            memory.store(
                user_id=user_id,
                content=style_content,
                memory_type=MemoryType.CONTEXT,
                importance=0.85,
                metadata={
                    "channel": f"@{username}",
                    "recommended_temperature": m["recommended_temperature"],
                    "content_type": m["content_type"],
                    "analysis_version": "v2"
                }
            )

        return analysis

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("", response_model=List[ChannelInfo])
async def list_channels(
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Список сохранённых каналов конкурентов для текущего пользователя."""
    user_id = current_user["id"]

    rows = db.fetch_all(
        "SELECT username, title, subscribers, description FROM competitor_channels WHERE user_id = ?",
        (user_id,)
    )

    return [
        ChannelInfo(
            username=row["username"],
            title=row["title"] or row["username"],
            subscribers=row["subscribers"] or 0,
            description=row["description"] or ""
        )
        for row in rows
    ]


@router.post("/add")
async def add_channel(
    data: AnalyzeRequest,
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    Добавить канал в список конкурентов (с получением информации).
    """
    parser = ChannelParser()
    user_id = current_user["id"]

    try:
        info = parser.get_channel_info(data.channel)
        username = data.channel.replace("@", "").replace("https://t.me/", "")

        # Сохраняем в БД (INSERT OR REPLACE для обновления если уже есть)
        # Database.execute() автоматически делает commit
        db.execute(
            """INSERT OR REPLACE INTO competitor_channels
               (user_id, username, title, subscribers, description)
               VALUES (?, ?, ?, ?, ?)""",
            (user_id, username, info["title"], info["subscribers"], info["description"])
        )

        channel = ChannelInfo(
            username=username,
            title=info["title"],
            subscribers=info["subscribers"],
            description=info["description"],
        )

        return {"status": "added", "channel": channel}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{username}")
async def remove_channel(
    username: str,
    db=Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Удалить канал из списка конкурентов."""
    user_id = current_user["id"]

    # Database.execute() автоматически делает commit
    db.execute(
        "DELETE FROM competitor_channels WHERE user_id = ? AND username = ?",
        (user_id, username)
    )

    return {"status": "removed"}


# =============================================================================
# Helpers
# =============================================================================

def _compute_metrics(posts: List[dict]) -> dict:
    """
    Вычисление метрик канала без LLM.
    Копия из smm_tools.py для независимости.
    """
    import re
    from collections import Counter

    if not posts:
        return {"error": "no posts"}

    # Фильтруем рекламу
    ad_markers = ['#реклама', '#ad', 'промокод', 'скидка', 'купить']
    organic = [p for p in posts if not any(m in p.get('text', '').lower() for m in ad_markers)]

    if not organic:
        organic = posts[:5]

    texts = [p.get('text', '') for p in organic]

    # === МЕТРИКИ ===

    # 1. Длина постов
    lengths = [len(t) for t in texts]
    avg_length = sum(lengths) // len(lengths) if lengths else 0
    length_category = "короткие" if avg_length < 300 else "средние" if avg_length < 800 else "длинные"

    # 2. Эмодзи
    emoji_pattern = re.compile(r'[\U0001F300-\U0001F9FF\u2600-\u26FF\u2700-\u27BF]')
    emoji_counts = [len(emoji_pattern.findall(t)) for t in texts]
    avg_emoji = sum(emoji_counts) / len(emoji_counts) if emoji_counts else 0
    emoji_style = "много эмодзи" if avg_emoji > 3 else "мало эмодзи" if avg_emoji > 0 else "без эмодзи"

    # 3. Хештеги
    hashtag_pattern = re.compile(r'#\w+')
    hashtag_counts = [len(hashtag_pattern.findall(t)) for t in texts]
    avg_hashtags = sum(hashtag_counts) / len(hashtag_counts) if hashtag_counts else 0
    all_hashtags = []
    for t in texts:
        all_hashtags.extend(hashtag_pattern.findall(t))
    top_hashtags = [h for h, _ in Counter(all_hashtags).most_common(5)]

    # 4. Структура
    has_lists = sum(1 for t in texts if re.search(r'(^|\n)[•\-\d]\s', t)) / len(texts) > 0.3
    has_paragraphs = sum(1 for t in texts if t.count('\n\n') >= 2) / len(texts) > 0.3
    structure = []
    if has_lists:
        structure.append("списки")
    if has_paragraphs:
        structure.append("абзацы")
    if not structure:
        structure.append("сплошной текст")

    # 5. Стартовые паттерны (hooks)
    first_lines = [t.split('\n')[0][:50] for t in texts if t]
    hook_patterns = []
    question_hooks = sum(1 for l in first_lines if '?' in l)
    if question_hooks >= 2:
        hook_patterns.append("вопросы")
    emoji_hooks = sum(1 for l in first_lines if emoji_pattern.search(l))
    if emoji_hooks >= 2:
        hook_patterns.append("эмодзи в начале")
    caps_hooks = sum(1 for l in first_lines if l.isupper() or l[:10].isupper())
    if caps_hooks >= 2:
        hook_patterns.append("КАПС")

    # 6. Концовки (CTA)
    last_lines = [t.strip().split('\n')[-1] for t in texts if t]
    cta_keywords = ['подписы', 'ставь', 'пиши', 'делись', 'репост', 'комент', 'ссылк']
    has_cta = sum(1 for l in last_lines if any(k in l.lower() for k in cta_keywords))
    cta_style = "есть CTA" if has_cta >= 2 else "без CTA"

    # 7. Топ слова
    stop_words = {'и', 'в', 'на', 'с', 'что', 'это', 'как', 'а', 'не', 'но', 'для', 'по', 'к', 'из', 'у', 'о', 'же', 'то', 'все', 'так', 'его', 'от', 'они', 'вы', 'мы', 'я', 'бы', 'он', 'она', 'было', 'быть', 'или', 'при', 'уже', 'если', 'их', 'ее', 'её', 'только', 'когда', 'этот', 'эта', 'эти', 'вот', 'тут', 'там', 'ты', 'за'}
    all_words = []
    for t in texts:
        words = re.findall(r'\b[а-яА-ЯёЁa-zA-Z]{4,}\b', t.lower())
        all_words.extend([w for w in words if w not in stop_words])
    top_words = [w for w, _ in Counter(all_words).most_common(10)]

    # 8. Просмотры
    views = [p.get('views', 0) for p in organic if p.get('views')]
    avg_views = sum(views) // len(views) if views else 0
    max_views = max(views) if views else 0
    min_views = min(views) if views else 0

    # 9. Реакции
    reactions = [p.get('reactions', 0) for p in organic]
    avg_reactions = sum(reactions) // len(reactions) if reactions else 0
    total_reactions = sum(reactions)

    # 10. Репосты
    forwards = [p.get('forwards', 0) for p in organic]
    avg_forwards = sum(forwards) // len(forwards) if forwards else 0

    # 11. Engagement rate
    engagement = 0
    if avg_views > 0:
        engagement = round((avg_reactions + avg_forwards) / avg_views * 100, 2)

    # === TEMPERATURE ===
    recommended_temperature = 0.5
    content_type = "экспертный"

    if avg_length > 500 and avg_emoji < 1.5 and "вопросы" not in hook_patterns:
        recommended_temperature = 0.3
        content_type = "аналитический"
    elif avg_length < 300 and (avg_emoji > 1.5 or "вопросы" in hook_patterns):
        recommended_temperature = 0.7
        content_type = "лайфстайл"
    elif avg_emoji < 0.5 and cta_style == "без CTA":
        recommended_temperature = 0.35
        content_type = "новостной"
    elif avg_emoji > 2 and cta_style == "есть CTA":
        recommended_temperature = 0.6
        content_type = "авторский"

    return {
        "posts_analyzed": len(organic),
        "metrics": {
            "avg_length": avg_length,
            "length_category": length_category,
            "avg_emoji": round(avg_emoji, 1),
            "emoji_style": emoji_style,
            "avg_hashtags": round(avg_hashtags, 1),
            "top_hashtags": top_hashtags,
            "structure": structure,
            "hook_patterns": hook_patterns or ["без явных паттернов"],
            "cta_style": cta_style,
            "top_words": top_words,
            "avg_views": avg_views,
            "max_views": max_views,
            "min_views": min_views,
            "avg_reactions": avg_reactions,
            "total_reactions": total_reactions,
            "avg_forwards": avg_forwards,
            "engagement_rate": engagement,
            "recommended_temperature": recommended_temperature,
            "content_type": content_type,
        },
        "examples": {
            "hooks": first_lines[:3],
            "endings": last_lines[:3],
        }
    }
