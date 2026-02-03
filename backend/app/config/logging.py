"""
Yadro Post - Logging Configuration
Структурированное логирование с поддержкой JSON
"""

import logging
import sys
import json
import os
from datetime import datetime
from typing import Any, Dict, Optional
from pathlib import Path


class JSONFormatter(logging.Formatter):
    """JSON форматтер для структурированных логов"""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Добавляем extra данные если есть
        if hasattr(record, "extra_data"):
            log_data["data"] = record.extra_data

        # Добавляем exception если есть
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data, ensure_ascii=False)


class ColoredFormatter(logging.Formatter):
    """Цветной форматтер для консоли"""

    COLORS = {
        "DEBUG": "\033[36m",     # Cyan
        "INFO": "\033[32m",      # Green
        "WARNING": "\033[33m",   # Yellow
        "ERROR": "\033[31m",     # Red
        "CRITICAL": "\033[35m",  # Magenta
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, self.RESET)
        record.levelname = f"{color}{record.levelname}{self.RESET}"
        return super().format(record)


def setup_logging(
    log_level: str = "INFO",
    json_logs: bool = False,
    log_file: Optional[str] = None
) -> logging.Logger:
    """
    Настройка логирования

    Args:
        log_level: Уровень логирования (DEBUG, INFO, WARNING, ERROR)
        json_logs: Использовать JSON формат (для продакшена)
        log_file: Путь к файлу логов (опционально)

    Returns:
        Настроенный logger
    """

    # Корневой logger
    logger = logging.getLogger("yadro")
    logger.setLevel(getattr(logging, log_level.upper()))

    # Очищаем существующие handlers
    logger.handlers.clear()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper()))

    if json_logs:
        console_handler.setFormatter(JSONFormatter())
    else:
        console_handler.setFormatter(ColoredFormatter(
            "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        ))

    logger.addHandler(console_handler)

    # File handler (опционально)
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(JSONFormatter())
        logger.addHandler(file_handler)

    return logger


class LoggerAdapter(logging.LoggerAdapter):
    """Адаптер для добавления контекста к логам"""

    def process(self, msg: str, kwargs: Dict[str, Any]) -> tuple:
        # Добавляем extra данные
        extra = kwargs.get("extra", {})
        extra.update(self.extra)
        kwargs["extra"] = extra
        return msg, kwargs


def get_logger(name: str, **context) -> LoggerAdapter:
    """
    Получить logger с контекстом

    Args:
        name: Имя логгера (например, "api.posts")
        **context: Дополнительный контекст (user_id, request_id и т.д.)

    Returns:
        Logger с контекстом
    """
    base_logger = logging.getLogger(f"yadro.{name}")
    return LoggerAdapter(base_logger, context)


# === Utility функции для логирования ===

def log_api_request(
    logger: logging.Logger,
    method: str,
    path: str,
    user_id: Optional[int] = None,
    **extra
):
    """Логирование API запроса"""
    logger.info(
        f"API {method} {path}",
        extra={"extra_data": {"user_id": user_id, **extra}}
    )


def log_ai_request(
    logger: logging.Logger,
    provider: str,
    model: str,
    prompt_length: int,
    response_length: int,
    duration_ms: float,
    **extra
):
    """Логирование AI запроса"""
    logger.info(
        f"AI request to {provider}/{model}",
        extra={"extra_data": {
            "provider": provider,
            "model": model,
            "prompt_length": prompt_length,
            "response_length": response_length,
            "duration_ms": duration_ms,
            **extra
        }}
    )


def log_error(
    logger: logging.Logger,
    error: Exception,
    context: str = "",
    **extra
):
    """Логирование ошибки"""
    logger.error(
        f"Error in {context}: {type(error).__name__}: {str(error)}",
        exc_info=True,
        extra={"extra_data": extra}
    )


# Определяем DEBUG из переменных окружения
DEBUG = os.environ.get("APP_ENV", "").lower() in ("development", "dev")

# Инициализация при импорте
root_logger = setup_logging(
    log_level="DEBUG" if DEBUG else "INFO",
    json_logs=not DEBUG
)
