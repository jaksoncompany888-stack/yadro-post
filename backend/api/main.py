"""
Yadro Post API
Главный файл FastAPI приложения
"""

import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api.routers import posts, channels, calendar, ai, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Skip DB init for now - use in-memory
    yield


def create_app() -> FastAPI:
    """Create FastAPI application."""

    app = FastAPI(
        title="Ядро Post API",
        description="API для планирования и публикации постов в соцсетях",
        version="1.0.0",
        lifespan=lifespan,
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://localhost:5173",
            "*",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(posts.router, prefix="/api/posts", tags=["posts"])
    app.include_router(channels.router, prefix="/api/channels", tags=["channels"])
    app.include_router(calendar.router, prefix="/api/calendar", tags=["calendar"])
    app.include_router(ai.router, prefix="/api/ai", tags=["ai"])

    @app.get("/health")
    async def health():
        return {"status": "healthy", "service": "yadro-post"}

    @app.get("/")
    async def root():
        return {
            "name": "Ядро Post",
            "version": "1.0.0",
            "description": "СММ планировщик с AI"
        }

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("API_PORT", 8000))
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
