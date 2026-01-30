# Changelog - Yadro Post Unified

## [2.0.0] - 2026-01-29

### ✨ ФАЗА 1: Стабильность

#### Добавлено
- **Объединённая архитектура**: Слияние `backend/` и `yadro-smm-core/` в единый проект
- **JWT аутентификация**: 
  - Регистрация (`/api/auth/register`)
  - Логин (`/api/auth/login`)
  - Защищённые endpoints
  - Bcrypt для паролей
- **Единая PostgreSQL БД**:
  - Модели: `User`, `Channel`, `Post`, `Analytics`
  - SQLAlchemy async
  - Alembic миграции (готовность)
- **Error handling**: Try-except во всех критичных местах
- **Structured logging**: Логирование всех операций

#### Удалено
- Дублирование кода между проектами
- Хардкод `ALLOWED_USER_IDS`
- SQLite база из core
- Разрозненные auth системы

---

### 🚀 ФАЗА 2: Ключевые фичи

#### Добавлено

**AI генерация постов:**
- Генерация по теме через Claude Sonnet 4
- Стили: casual, formal, funny
- Автоматические хештеги
- Рекомендуемое время публикации
- Endpoints:
  - `POST /api/ai/generate`
  - `POST /api/ai/edit`

**Автопостинг (APScheduler):**
- Автоматическая публикация по `scheduled_time`
- Retry логика (3 попытки с задержкой 5 мин)
- Обновление статуса поста (draft → scheduled → published)
- Задачи в фоне

**Реальная аналитика:**
- Автоматический сбор метрик:
  - Через 1 час после публикации
  - Затем каждые 24 часа
- Таблица `analytics` с историей
- Endpoint `GET /api/analytics/posts/{id}`
- Поддержка Telegram + VK

**Провайдеры социальных сетей:**
- `SocialProvider` - базовый класс
- `TelegramProvider` - публикация через Bot API
- `VKProvider` - публикация через VK API
- `InstagramProvider` - заглушка для будущего
- Унифицированный интерфейс
- Автоматическая адаптация контента (HTML для TG, plain для VK)
- Сбор статистики

**AI сервис:**
- `AIService` класс для работы с Claude
- Генерация постов по теме
- Редактирование постов
- Mock режим если нет API ключа
- Разные температуры для каждого стиля

#### Изменено
- API теперь требует аутентификацию (Bearer token)
- Структура проекта упрощена
- Улучшена обработка ошибок

---

## Сравнение версий

| Функция | v1.0 (старая) | v2.0 (новая) |
|---------|--------------|--------------|
| Проектов | 2 (backend + core) | 1 (unified) |
| БД | PostgreSQL + SQLite | PostgreSQL |
| Auth | Whitelist IDs | JWT |
| Публикация | Ручная | Авто (scheduler) |
| Аналитика | Mock | Реальная |
| Error handling | Частично | Везде |
| Logging | print() | structured |

---

## Breaking Changes

⚠️ **API несовместим с v1.0:**

- Все endpoints теперь требуют `Authorization: Bearer <token>`
- URL изменён: `/api/posts` вместо `/posts`
- Структура ответов изменена (Pydantic models)
- Нет обратной совместимости

---

## Следующие шаги (Фаза 3)

- [ ] Мобильная версия
- [ ] Telegram API (вместо веб-парсинга)
- [ ] Instagram провайдер
- [ ] Twitter/X интеграция
- [ ] Командная работа (роли)
- [ ] Тарифные планы

---

**Авторы:** Yadro Team  
**Лицензия:** Proprietary
