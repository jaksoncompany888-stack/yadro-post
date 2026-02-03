"""
Resources API

Управление ресурсами пользователя:
- Свой канал (для стиля и постинга)
- Конкуренты (для анализа и вдохновения)

Каждый пользователь имеет свой набор ресурсов.
"""

from typing import List, Optional
from pydantic import BaseModel

from fastapi import APIRouter, HTTPException, Depends

from app.api.deps import get_db, get_current_user, get_agent
from app.storage.database import Database
from app.smm.agent import SMMAgent


router = APIRouter(prefix="/resources", tags=["resources"])


# =============================================================================
# Models
# =============================================================================

class ChannelBase(BaseModel):
    """Базовая модель канала."""
    channel: str  # @username


class MyChannelResponse(BaseModel):
    """Мой канал."""
    channel: Optional[str] = None
    name: Optional[str] = None
    analyzed: bool = False
    temperature: Optional[float] = None


class CompetitorResponse(BaseModel):
    """Конкурент."""
    id: int
    channel: str
    analyzed: bool = False
    temperature: Optional[float] = None


class CompetitorAdd(BaseModel):
    """Добавление конкурента."""
    channel: str
    auto_analyze: bool = True


class AnalyzeResponse(BaseModel):
    """Результат анализа."""
    success: bool
    message: str
    temperature: Optional[float] = None


# =============================================================================
# My Channel - Свой канал
# =============================================================================

@router.get("/my-channel", response_model=MyChannelResponse)
async def get_my_channel(
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
):
    """
    Получить свой канал.
    """
    user_id = user["id"]

    # Ищем в memory_items
    row = db.fetch_one(
        """SELECT content, metadata FROM memory_items
           WHERE user_id = ? AND memory_type = 'channel'
           ORDER BY created_at DESC LIMIT 1""",
        (user_id,)
    )

    if not row:
        return MyChannelResponse()

    import json
    content = row["content"]
    metadata = json.loads(row["metadata"]) if row["metadata"] else {}

    # Извлекаем имя канала из content "Канал: name (ID: id)"
    channel = metadata.get("channel_id", "")
    name = content.replace("Канал:", "").split("(")[0].strip() if content else ""

    # Проверяем есть ли анализ
    analysis = db.fetch_one(
        """SELECT metadata FROM memory_items
           WHERE user_id = ? AND memory_type = 'channel_style'
           AND content LIKE ?
           ORDER BY created_at DESC LIMIT 1""",
        (user_id, f"%{channel.replace('@', '')}%")
    )

    analyzed = analysis is not None
    temperature = None
    if analysis and analysis["metadata"]:
        meta = json.loads(analysis["metadata"])
        temperature = meta.get("temperature")

    return MyChannelResponse(
        channel=channel,
        name=name,
        analyzed=analyzed,
        temperature=temperature
    )


@router.post("/my-channel", response_model=MyChannelResponse)
async def set_my_channel(
    data: ChannelBase,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    agent: SMMAgent = Depends(get_agent),
):
    """
    Установить свой канал.

    Сохраняет канал и запускает анализ стиля.
    """
    user_id = user["id"]
    channel = data.channel.strip()

    # Нормализуем
    if not channel.startswith("@"):
        channel = f"@{channel}"

    # Удаляем старый канал если есть
    db.execute(
        "DELETE FROM memory_items WHERE user_id = ? AND memory_type = 'channel'",
        (user_id,)
    )

    # Сохраняем новый
    agent.save_channel(user_id, channel, channel)

    # Запускаем анализ
    try:
        agent._analyze_channel_via_executor(user_id, channel)
        analyzed = True
    except Exception as e:
        print(f"[Resources] Ошибка анализа {channel}: {e}")
        analyzed = False

    return MyChannelResponse(
        channel=channel,
        name=channel,
        analyzed=analyzed
    )


@router.post("/my-channel/analyze", response_model=AnalyzeResponse)
async def analyze_my_channel(
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    agent: SMMAgent = Depends(get_agent),
):
    """
    Переанализировать свой канал.
    """
    user_id = user["id"]

    # Получаем текущий канал
    channel = agent.get_channel_id(user_id)
    if not channel:
        raise HTTPException(status_code=404, detail="Канал не установлен")

    try:
        agent._analyze_channel_via_executor(user_id, channel)
        return AnalyzeResponse(success=True, message=f"Канал {channel} проанализирован")
    except Exception as e:
        return AnalyzeResponse(success=False, message=str(e))


# =============================================================================
# Competitors - Конкуренты
# =============================================================================

@router.get("/competitors", response_model=List[CompetitorResponse])
async def list_competitors(
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    agent: SMMAgent = Depends(get_agent),
):
    """
    Список конкурентов пользователя.
    """
    user_id = user["id"]

    competitors = agent.get_competitors_with_ids(user_id)
    result = []

    import json
    for comp in competitors:
        channel = comp["channel"]

        # Проверяем есть ли анализ
        analysis = db.fetch_one(
            """SELECT metadata FROM memory_items
               WHERE user_id = ? AND memory_type = 'channel_style'
               AND content LIKE ?
               ORDER BY created_at DESC LIMIT 1""",
            (user_id, f"%{channel.replace('@', '')}%")
        )

        analyzed = analysis is not None
        temperature = None
        if analysis and analysis["metadata"]:
            meta = json.loads(analysis["metadata"])
            temperature = meta.get("temperature")

        result.append(CompetitorResponse(
            id=comp["id"],
            channel=channel,
            analyzed=analyzed,
            temperature=temperature
        ))

    return result


@router.post("/competitors", response_model=CompetitorResponse)
async def add_competitor(
    data: CompetitorAdd,
    user: dict = Depends(get_current_user),
    agent: SMMAgent = Depends(get_agent),
):
    """
    Добавить конкурента.

    Опционально запускает автоматический анализ.
    """
    user_id = user["id"]
    channel = data.channel.strip()

    # Нормализуем
    if not channel.startswith("@"):
        channel = f"@{channel}"

    # Проверяем что не добавлен
    existing = agent.get_competitors(user_id)
    if channel in existing or channel.replace("@", "") in [c.replace("@", "") for c in existing]:
        raise HTTPException(status_code=400, detail="Конкурент уже добавлен")

    # Добавляем
    agent.add_competitor(user_id, channel, auto_analyze=data.auto_analyze)

    # Получаем ID
    competitors = agent.get_competitors_with_ids(user_id)
    comp_id = None
    for c in competitors:
        if c["channel"].replace("@", "") == channel.replace("@", ""):
            comp_id = c["id"]
            break

    return CompetitorResponse(
        id=comp_id or 0,
        channel=channel,
        analyzed=data.auto_analyze
    )


@router.delete("/competitors/{competitor_id}")
async def remove_competitor(
    competitor_id: int,
    user: dict = Depends(get_current_user),
    agent: SMMAgent = Depends(get_agent),
):
    """
    Удалить конкурента.
    """
    # Проверяем что принадлежит пользователю
    competitors = agent.get_competitors_with_ids(user["id"])
    found = False
    for c in competitors:
        if c["id"] == competitor_id:
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Конкурент не найден")

    agent.remove_competitor(competitor_id)
    return {"success": True}


@router.post("/competitors/{competitor_id}/analyze", response_model=AnalyzeResponse)
async def analyze_competitor(
    competitor_id: int,
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    agent: SMMAgent = Depends(get_agent),
):
    """
    Переанализировать конкурента.
    """
    user_id = user["id"]

    # Находим канал
    competitors = agent.get_competitors_with_ids(user_id)
    channel = None
    for c in competitors:
        if c["id"] == competitor_id:
            channel = c["channel"]
            break

    if not channel:
        raise HTTPException(status_code=404, detail="Конкурент не найден")

    try:
        agent._analyze_channel_via_executor(user_id, channel)
        return AnalyzeResponse(success=True, message=f"Канал {channel} проанализирован")
    except Exception as e:
        return AnalyzeResponse(success=False, message=str(e))


# =============================================================================
# Summary - Общая информация
# =============================================================================

@router.get("/summary")
async def get_resources_summary(
    user: dict = Depends(get_current_user),
    db: Database = Depends(get_db),
    agent: SMMAgent = Depends(get_agent),
):
    """
    Сводка по ресурсам пользователя.
    """
    user_id = user["id"]

    my_channel = agent.get_channel_id(user_id)
    competitors = agent.get_competitors(user_id)

    # Считаем анализы
    import json
    analyzed_count = 0

    rows = db.fetch_all(
        """SELECT content FROM memory_items
           WHERE user_id = ? AND memory_type = 'channel_style'""",
        (user_id,)
    )
    analyzed_count = len(rows)

    return {
        "my_channel": my_channel,
        "competitors_count": len(competitors),
        "analyzed_count": analyzed_count,
        "has_style_data": analyzed_count > 0
    }
