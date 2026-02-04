"""
FastAPI Application

Main entry point for the API.
"""

import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from .posts import router as posts_router
from .calendar import router as calendar_router
from .channels import router as channels_router
from .user_channels import router as user_channels_router
from .notes import router as notes_router
from .users import router as users_router
from .auth import router as auth_router
from .resources import router as resources_router
from .deps import get_db, get_memory
from ..config.logging import get_logger
from ..storage.migrations import run_migrations

logger = get_logger("api")


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every incoming HTTP request with method, path, status and duration."""

    async def dispatch(self, request: Request, call_next) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        logger.info(
            "%s %s -> %d [%.1fms]",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            extra={"extra_data": {
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
            }}
        )
        return response


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    db = get_db()

    # Versioned migrations (idempotent, auto-detects version on existing DBs)
    run_migrations(db.connection)

    # Register SMM tools with services
    from ..tools.smm_tools import register_smm_tools
    from ..memory.service import MemoryService

    memory_service = MemoryService(db)
    register_smm_tools(memory_service=memory_service)
    logger.info("SMM tools registered")

    yield


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------


def create_app() -> FastAPI:
    """Create FastAPI application."""

    app = FastAPI(
        title="Yadro SMM API",
        description="API for SMM Agent - posts, calendar, AI generation",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Request logging (outermost — added first, runs last in LIFO stack)
    app.add_middleware(RequestLoggingMiddleware)

    # CORS for Mini App and web
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://web.telegram.org",
            "https://*.telegram.org",
            "http://localhost:3000",
            "http://localhost:5173",
            "*",  # TODO: restrict in production
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    app.include_router(auth_router, prefix="/api")
    app.include_router(posts_router, prefix="/api")
    app.include_router(calendar_router, prefix="/api")
    app.include_router(channels_router, prefix="/api")
    app.include_router(user_channels_router, prefix="/api")
    app.include_router(notes_router, prefix="/api")
    app.include_router(users_router, prefix="/api")
    app.include_router(resources_router, prefix="/api")

    # Health check
    @app.get("/health")
    async def health():
        return {"status": "ok"}

    # API info
    @app.get("/api")
    async def api_info():
        return {
            "name": "Yadro SMM API",
            "version": "1.0.0",
            "endpoints": {
                "auth": "/api/auth",
                "posts": "/api/posts",
                "calendar": "/api/calendar",
                "channels": "/api/channels",
                "user_channels": "/api/user-channels",
                "notes": "/api/notes",
                "users": "/api/users",
                "resources": "/api/resources",
                "generate": "/api/posts/generate",
                "edit": "/api/posts/edit",
                "analyze": "/api/channels/analyze",
            }
        }

    # Error handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.error(
            "Unhandled exception: %s %s: %s",
            request.method, request.url.path, exc,
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": str(exc),
            }
        )

    return app


# Create app instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("API_PORT", 8000))
    uvicorn.run(
        "app.api.app:app",
        host="0.0.0.0",
        port=port,
        reload=True,
    )
