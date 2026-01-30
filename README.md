
1. **Объединение проектов**
   - Убрано дублирование `backend/` + `yadro-smm-core/`
   - Единая кодовая база
   - Всё в одном месте

2. **JWT Аутентификация**
   - Регистрация: `POST /api/auth/register`
   - Логин: `POST /api/auth/login`
   - Защищённые endpoints
   - Хранение паролей через bcrypt

3. **Единая PostgreSQL БД**
   - Все данные в одной базе
   - SQLAlchemy async
   - Alembic миграции

4. **Error Handling + Logging**
   - Try-except везде
   - Structured logging
   - Sentry интеграция (опционально)

### Фаза 2: Ключевые фичи ✅

5. **AI генерация постов**
   ```python
   POST /api/ai/generate
   {
       "topic": "искусственный интеллект",
       "platform": "telegram",
       "style": "casual"
   }
   ```

6. **Автопостинг (APScheduler)**
   - Публикация по расписанию
   - Retry при ошибке
   - Автоматический сбор аналитики

7. **Реальная аналитика**
   ```python
   GET /api/analytics/posts/{id}
   # Возвращает: views, likes, shares, comments
   ```

8. **Провайдеры (Telegram + VK)**
   - Унифицированный интерфейс
   - Автоматическая адаптация контента
   - Сбор статистики

---

## 📦 Установка

### 1. Клонировать

```bash
git clone <your-repo>
cd yadro-unified
```

### 2. Backend

```bash
cd backend

# Виртуальное окружение
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Зависимости
pip install -r requirements.txt

# .env файл
cp .env.example .env
# Заполните:
# - DATABASE_URL
# - SECRET_KEY
# - ANTHROPIC_API_KEY
# - TELEGRAM_BOT_TOKEN

# Запуск
python main.py
```

### 3. Frontend (без изменений)

```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 API Endpoints

### Auth

```bash
# Регистрация
POST /api/auth/register
{
    "email": "user@example.com",
    "username": "user",
    "password": "strong_password"
}

# Логин
POST /api/auth/login
{
    "username": "user",
    "password": "strong_password"
}
# Возвращает: {"access_token": "...", "token_type": "bearer"}

# Профиль
GET /api/auth/me
Headers: Authorization: Bearer <token>
```

### Channels

```bash
# Добавить канал
POST /api/channels
Headers: Authorization: Bearer <token>
{
    "platform": "telegram",
    "channel_id": "@mychannel",
    "name": "Мой канал",
    "access_token": "bot_token_here"
}

# Список каналов
GET /api/channels
Headers: Authorization: Bearer <token>

# Удалить
DELETE /api/channels/{id}
Headers: Authorization: Bearer <token>
```

### Posts

```bash
# Создать пост
POST /api/posts
Headers: Authorization: Bearer <token>
{
    "channel_id": 1,
    "title": "Мой пост",
    "content": "Контент поста",
    "scheduled_time": "2026-02-01T18:00:00"
}

# Список постов
GET /api/posts?status=scheduled
Headers: Authorization: Bearer <token>
```

### AI Generation

```bash
# Генерация поста
POST /api/ai/generate
Headers: Authorization: Bearer <token>
{
    "topic": "блокчейн технологии",
    "platform": "telegram",
    "style": "casual"
}

# Редактирование
POST /api/ai/edit
Headers: Authorization: Bearer <token>
{
    "text": "Исходный текст",
    "instruction": "Сделай короче"
}
```

### Analytics

```bash
# Аналитика поста
GET /api/analytics/posts/{id}
Headers: Authorization: Bearer <token>

# Возвращает:
{
    "post_id": 1,
    "analytics": [
        {
            "views": 1234,
            "likes": 56,
            "shares": 12,
            "comments": 8,
            "collected_at": "2026-01-29T20:00:00"
        }
    ]
}
```
## 🗄️ База данных

### Таблицы:

- `users` - Пользователи (JWT auth)
- `channels` - Каналы пользователей
- `posts` - Посты
- `analytics` - Метрики постов

---

## 🚀 Деплой

### Docker Compose (рекомендуется)

```bash
docker-compose up --build
```

### Вручную

```bash
# Backend
cd backend
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker

# Frontend
cd frontend
npm run build
npm start
```

---

## 🎯 Быстрый старт

```bash
# 1. Установите PostgreSQL
# 2. Создайте БД
createdb yadro_post

# 3. Backend
cd backend
pip install -r requirements.txt
cp .env.example .env
python main.py

# 4. Frontend
cd frontend
npm install
npm run dev

# 5. Откройте
# Backend: http://localhost:8000/docs
# Frontend: http://localhost:3000
```

-