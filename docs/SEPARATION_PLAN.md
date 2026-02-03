# План разделения Бот / Веб

**Дата:** 3 февраля 2026
**Цель:** Отключить Telegram бота, оставить только веб-сервис

---

## Текущая архитектура

```
run_all.py
├── Thread: FastAPI (веб API) на порту 8000
│   └── База: data/yadro.db
│
└── Main: Telegram Bot (aiogram)
    └── База: data/smm_agent.db  ← ОТДЕЛЬНАЯ!
```

**Проблемы:**
1. Две разные базы данных
2. Бот и веб запускаются вместе
3. Общие компоненты дублируются

---

## Целевая архитектура

```
run_api.py (НОВЫЙ)
└── FastAPI (веб API) на порту 8000
    └── База: data/yadro.db (единственная)

bot.py (АРХИВ - не запускается)
└── Документация в docs/BOT_ARCHITECTURE.md
```

---

## Шаги разделения

### 1. Создать run_api.py (только веб)

```python
"""
Web API runner (без Telegram бота)
"""
import uvicorn
from dotenv import load_dotenv

load_dotenv()

if __name__ == "__main__":
    uvicorn.run(
        "app.api.app:app",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
```

### 2. Обновить systemd сервис

```bash
# /etc/systemd/system/yadro-api.service (ПЕРЕИМЕНОВАТЬ)
[Unit]
Description=Yadro SMM Web API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/yadro-post/backend
EnvironmentFile=/home/ubuntu/yadro-post/backend/.env
Environment=PORT=8000
ExecStart=/home/ubuntu/yadro-post/backend/venv/bin/python run_api.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### 3. Объединить базы данных

**Из smm_agent.db скопировать:**
- `memory_items` (каналы, конкуренты, стили)
- `llm_costs` (статистика использования)
- `tasks` (история задач)

**Скрипт миграции:**
```python
import sqlite3

src = sqlite3.connect("data/smm_agent.db")
dst = sqlite3.connect("data/yadro.db")

# Копируем memory_items
for row in src.execute("SELECT * FROM memory_items"):
    dst.execute("INSERT OR IGNORE INTO memory_items VALUES (?,?,?,?,?,?,?)", row)

dst.commit()
```

### 4. Удалить зависимости бота

**Из requirements.txt убрать (опционально):**
```
aiogram==3.x
```

**Из run_all.py убрать:**
```python
# async def run_bot():
#     from app.smm.bot import main
#     await main()
```

### 5. Архивировать код бота

Файлы для архива:
- `backend/app/smm/bot.py` → `docs/archive/bot.py`
- `backend/app/smm/scheduler_tasks.py` → `docs/archive/scheduler_tasks.py`

---

## Что остаётся в вебе

### Используется:
- `app/smm/agent.py` — SMMAgent (генерация, редактирование)
- `app/llm/` — LLMService, ModelRouter
- `app/memory/` — MemoryService (FTS5)
- `app/executor/` — Executor, Plans, Steps
- `app/tools/` — ChannelParser, NewsMonitor
- `app/storage/` — Database
- `app/api/` — все REST endpoints

### НЕ используется (но сохраняем):
- `app/smm/bot.py` — Telegram handlers
- `app/smm/scheduler_tasks.py` — автопубликация

---

## Проверка после разделения

1. [ ] Сайт открывается: http://35.156.188.57
2. [ ] Логин работает (email + Telegram Widget)
3. [ ] Генерация постов работает: /api/posts/generate
4. [ ] Редактирование работает: /api/posts/edit
5. [ ] Анализ каналов работает: /api/channels/analyze
6. [ ] Публикация работает (через Telegram Provider)

---

## Восстановление бота (на будущее)

1. Создать отдельный сервис `yadro-bot.service`
2. Использовать ОДНУ базу данных (yadro.db)
3. Изменить bot.py строка 44:
   ```python
   db = Database(os.environ.get("DATABASE_PATH", "data/yadro.db"))
   ```
4. Запустить параллельно с API

---

## Риски

| Риск | Митигация |
|------|-----------|
| Потеря данных из smm_agent.db | Сделать бекап перед миграцией |
| Telegram Login не работает | Оставить BOT_TOKEN в .env |
| Публикация сломается | Telegram Provider использует BOT_TOKEN |

---

## Команды выполнения

```bash
# 1. На сервере: бекап
ssh ubuntu@35.156.188.57
cp data/smm_agent.db data/smm_agent.db.backup
cp data/yadro.db data/yadro.db.backup

# 2. Локально: создать run_api.py, закоммитить
# 3. На сервере: git pull

# 4. На сервере: обновить systemd
sudo mv /etc/systemd/system/yadro-bot.service /etc/systemd/system/yadro-api.service
sudo nano /etc/systemd/system/yadro-api.service  # изменить ExecStart
sudo systemctl daemon-reload
sudo systemctl restart yadro-api

# 5. Проверить
curl http://localhost:8000/health
```
