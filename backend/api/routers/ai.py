"""
AI Router
Генерация контента через Claude
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

router = APIRouter()


class GenerateRequest(BaseModel):
    topic: str
    platform: str = "telegram"  # telegram, vk
    style: Optional[str] = None  # formal, casual, funny
    language: str = "ru"
    max_length: Optional[int] = None


class GenerateResponse(BaseModel):
    content: str
    hashtags: List[str]
    suggested_time: Optional[str]
    platform: str


class EditRequest(BaseModel):
    content: str
    instruction: str  # "сделай короче", "добавь эмодзи", etc.


class EditResponse(BaseModel):
    content: str
    changes: List[str]


class ChatMessage(BaseModel):
    role: str  # user, assistant
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    context: Optional[str] = None  # current post content


class ChatResponse(BaseModel):
    message: str
    suggested_action: Optional[str] = None


@router.post("/generate", response_model=GenerateResponse)
async def generate_post(request: GenerateRequest):
    """
    Сгенерировать пост с помощью AI.
    """
    from ai.claude import generate_content

    try:
        result = await generate_content(
            topic=request.topic,
            platform=request.platform,
            style=request.style,
            language=request.language,
            max_length=request.max_length,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/edit", response_model=EditResponse)
async def edit_post(request: EditRequest):
    """
    Отредактировать пост по инструкции.
    """
    from ai.claude import edit_content

    try:
        result = await edit_content(
            content=request.content,
            instruction=request.instruction,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """
    Чат с AI ассистентом.
    Помогает с контентом, отвечает на вопросы.
    """
    from ai.claude import chat_completion

    try:
        result = await chat_completion(
            messages=[{"role": m.role, "content": m.content} for m in request.messages],
            context=request.context,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_channel(channel_url: str):
    """
    Проанализировать канал конкурента.
    Возвращает инсайты о стиле, темах, времени публикации.
    """
    # TODO: Parse channel and analyze
    return {
        "status": "analyzing",
        "channel": channel_url,
    }
