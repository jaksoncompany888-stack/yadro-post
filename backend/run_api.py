"""
Web API runner (без Telegram бота)

Запускает только FastAPI сервер.
Бот отключён и сохранён в docs/archive/ для будущего использования.
"""
import os
import signal
import sys
import uvicorn
from dotenv import load_dotenv

# Load .env file
load_dotenv()


def signal_handler(signum, frame):
    """Обработка сигналов завершения"""
    print(f"[API] Received signal {signum}, shutting down...")
    sys.exit(0)


def main():
    # Регистрируем обработчики сигналов
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    port = int(os.environ.get("PORT", 8000))

    print(f"[API] Starting Yadro SMM API on port {port}")
    print(f"[API] Database: {os.environ.get('DATABASE_PATH', 'data/yadro.db')}")
    print(f"[API] Environment: {os.environ.get('APP_ENV', 'production')}")

    uvicorn.run(
        "app.api.app:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )


if __name__ == "__main__":
    main()
