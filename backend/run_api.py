"""
Web API runner (без Telegram бота)

Запускает только FastAPI сервер.
Бот отключён и сохранён в docs/archive/ для будущего использования.
"""
import os
import signal
import sys
import logging
import uvicorn
from dotenv import load_dotenv

# Load .env file
load_dotenv()

logger = logging.getLogger("yadro.runner")


def signal_handler(signum, frame):
    """Обработка сигналов завершения"""
    logger.info("Received signal %s, shutting down...", signum)
    sys.exit(0)


def main():
    # Регистрируем обработчики сигналов
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    port = int(os.environ.get("PORT", 8000))

    logger.info("Starting Yadro SMM API on port %s", port)
    logger.info("Database: %s", os.environ.get('DATABASE_PATH', 'data/yadro.db'))
    logger.info("Environment: %s", os.environ.get('APP_ENV', 'production'))

    uvicorn.run(
        "app.api.app:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )


if __name__ == "__main__":
    main()
