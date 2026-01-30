# Ядро Post - Полная документация

## Обзор проекта

**Ядро Post** — SMM-планировщик с AI для Telegram и VK. Создан с нуля, вдохновлён дизайном Postiz, но без использования их кода.

- **Лицензия**: Собственная (без AGPL ограничений)
- **Цветовая схема**: Тёмная тема с фиолетовыми акцентами (планируется смена на тёплые цвета ядра Земли)

---

## Архитектура

```
yadro-post/
├── backend/           # FastAPI (Python)
│   ├── api/           # REST endpoints
│   │   ├── main.py    # Главный файл приложения
│   │   └── routers/   # Роутеры
│   │       ├── posts.py     # CRUD постов
│   │       ├── channels.py  # Управление каналами
│   │       ├── calendar.py  # Календарь событий
│   │       ├── ai.py        # AI генерация
│   │       └── auth.py      # Аутентификация
│   ├── ai/
│   │   └── claude.py  # Интеграция с Claude Sonnet 4
│   ├── integrations/
│   │   ├── telegram.py  # Telegram Bot API
│   │   └── vk.py        # VK API
│   ├── models/
│   │   └── database.py  # SQLAlchemy модели
│   └── scheduler/
│       └── publisher.py # APScheduler для отложенных постов
├── frontend/          # Next.js 14 (TypeScript)
│   └── src/
│       ├── app/       # App Router страницы
│       │   ├── page.tsx           # Календарь (главная)
│       │   ├── agent/page.tsx     # AI Агент чат
│       │   ├── analytics/page.tsx # Аналитика
│       │   ├── media/page.tsx     # Медиа-библиотека
│       │   ├── integrations/page.tsx # Подключение соцсетей
│       │   ├── settings/page.tsx  # Настройки
│       │   └── plugins/page.tsx   # Плагины
│       ├── components/
│       │   ├── sidebar.tsx        # Боковая навигация
│       │   ├── calendar.tsx       # Недельный календарь
│       │   ├── channels-sidebar.tsx # Список каналов
│       │   └── ai-assistant.tsx   # Плавающий AI чат
│       ├── lib/
│       │   └── api.ts   # API клиент
│       └── store/
│           └── index.ts # Zustand state
└── docker-compose.yaml
```

---

## Стек технологий

### Backend
- **FastAPI** 0.109.0 — асинхронный Python фреймворк
- **Anthropic** — Claude Sonnet 4 для AI генерации
- **python-telegram-bot** 21.0.1 — Telegram интеграция
- **vk-api** 11.9.9 — VK интеграция
- **SQLAlchemy** + asyncpg — PostgreSQL ORM
- **APScheduler** — планирование отложенных постов
- **Redis** — кэширование

### Frontend
- **Next.js** 14 с App Router
- **TypeScript**
- **Tailwind CSS** — стилизация
- **Zustand** — state management
- **React Query** — API запросы
- **Lucide React** — иконки

### Инфраструктура
- **Docker Compose** — оркестрация
- **PostgreSQL** 15 — база данных
- **Redis** 7 — кэш

---

## Функционал

### 1. Календарь постов
- Недельный вид с временными слотами
- Drag & drop планирование
- Цветовая маркировка по каналам

### 2. AI Агент (Claude Sonnet 4)
- Генерация постов на любую тему
- Автоматические хэштеги
- Рекомендация времени публикации
- Редактирование по инструкции
- Чат-интерфейс

### 3. Интеграции
- **Telegram**: добавление бота в канал, команда /connect
- **VK**: OAuth токен + ID сообщества

### 4. Аналитика
- Статистика по каналам
- Охват и вовлечённость
- Графики активности

### 5. Медиа-библиотека
- Загрузка изображений и видео
- Организация по папкам

---

## Конфигурация

### Переменные окружения (.env)

```bash
# Security
SECRET_KEY=yadro-post-secret-key-2024

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Telegram Bot
TELEGRAM_TOKEN=8097085611:AAFxhPKq...

# VK API
VK_TOKEN=
```

### Порты

| Сервис | Порт |
|--------|------|
| Frontend | 3000 |
| Backend | 8000 |
| PostgreSQL | 5432 |
| Redis | 6379 |

---

## Запуск

```bash
# 1. Клонировать
cd yadro-post

# 2. Настроить
cp .env.example .env
# Добавить API ключи

# 3. Запустить
docker compose up -d

# 4. Открыть
open http://35.156.188.57
```

---

## API Endpoints

### Health
```bash
GET /health
```

### Посты
```bash
GET /api/posts          # Список постов
POST /api/posts         # Создать пост
PUT /api/posts/{id}     # Обновить
DELETE /api/posts/{id}  # Удалить
```

### Каналы
```bash
GET /api/channels       # Список каналов
POST /api/channels      # Подключить канал
DELETE /api/channels/{id}
```

### AI
```bash
POST /api/ai/generate   # Генерация поста
POST /api/ai/edit       # Редактирование
POST /api/ai/chat       # Чат с AI
```

### Пример генерации
```bash
curl -X POST http://localhost:8000/api/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "криптовалюты",
    "platform": "telegram",
    "language": "ru"
  }'
```

---

## AI Генерация (claude.py)

```python
MODEL = "claude-sonnet-4-20250514"

# Генерация возвращает:
{
    "content": "Текст поста",
    "hashtags": ["#крипта", "#биткоин"],
    "suggested_time": "19:00",
    "platform": "telegram"
}
```

### Стили
- `formal` — деловой стиль, без эмодзи
- `casual` — неформальный, умеренно эмодзи
- `funny` — с юмором, много эмодзи

---

## Подключение Telegram канала

1. Создать бота через @BotFather
2. Получить токен и добавить в .env
3. Добавить бота в канал как администратора
4. В интерфейсе нажать "Подключить Telegram"
5. Отправить в канал `/connect CODE`
6. Нажать "Проверить подключение"

---

## Подключение VK

1. Создать приложение VK: https://vk.com/editapp?act=create
2. Получить Access Token с правами manage
3. В интерфейсе ввести токен и ID сообщества
4. Нажать "Подключить"

---

## Цветовая схема (текущая)

```javascript
// tailwind.config.js
primary: {
  DEFAULT: '#8b5cf6', // Фиолетовый
  // ...
}

// globals.css
.gradient-purple {
  background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
}
```

### Планируемая смена (тёплые цвета ядра Земли)
- Жёлтый: #fbbf24
- Оранжевый: #f97316
- Красный: #ef4444
- Бордовый: #be123c

---

## Демо для клиентов

Проект запущен локально: http://35.156.188.57

Для демо на продакшене:
1. Развернуть на VPS (DigitalOcean, Hetzner)
2. Настроить домен
3. Добавить SSL (Let's Encrypt)
4. Настроить nginx reverse proxy

---

## Roadmap

- [ ] Смена цветовой схемы на тёплые тона
- [ ] Полноценное подключение Telegram
- [ ] Отложенная публикация
- [ ] Аналитика с реальными данными
- [ ] Мобильная адаптация
- [ ] Многопользовательский режим

---

## Контакты

Проект: **Ядро Post**
Автор: Private
Версия: 1.0.0
