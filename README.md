# Ядро Post

СММ планировщик с AI для Telegram и VK.

## Возможности

- 📅 Календарь постов с планированием
- 🤖 AI-генерация контента (Claude)
- 📱 Telegram каналы и группы
- 💬 VK сообщества
- 🎨 Тёмная тема

## Быстрый старт

```bash
# 1. Клонировать
git clone <repo>
cd yadro-post

# 2. Настроить
cp .env.example .env
# Добавить ANTHROPIC_API_KEY и TELEGRAM_TOKEN

# 3. Запустить
docker compose up -d

# 4. Открыть
open http://35.156.188.57
```

## Структура

```
yadro-post/
├── backend/           # FastAPI
│   ├── api/           # REST endpoints
│   ├── ai/            # Claude integration
│   ├── integrations/  # Telegram, VK
│   ├── models/        # SQLAlchemy models
│   └── scheduler/     # APScheduler
├── frontend/          # Next.js
│   └── src/
│       ├── app/       # Pages
│       ├── components/# UI components
│       ├── lib/       # API client
│       └── store/     # Zustand state
└── docker-compose.yaml
```

## API

```bash
# Health
curl http://localhost:8000/health

# Генерация поста
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"topic": "криптовалюты", "platform": "telegram"}'
```

## Порты

| Сервис | Порт |
|--------|------|
| Frontend | 3000 |
| Backend | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
