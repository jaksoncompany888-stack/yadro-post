# Telegram Bot Architecture (Архив)

> **Статус:** Временно отключен (февраль 2026)
> **Причина:** Разделение на независимый веб-сервис
> **Файл:** `backend/app/smm/bot.py` (1944 строки)

---

## Обзор

Telegram бот для генерации SMM контента. Использует Claude Sonnet 4 для генерации и редактирования постов.

## Зависимости

```python
# Telegram
from aiogram import Bot, Dispatcher, F, BaseMiddleware
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, ...
from aiogram.filters import Command
from aiogram.enums import ParseMode

# Внутренние
from app.storage import Database
from app.llm import LLMService
from app.llm.router import ModelRouter, RouterConfig
from app.smm.agent import SMMAgent
from app.smm.scheduler_tasks import SMMScheduler
```

## Конфигурация (.env)

```bash
TELEGRAM_BOT_TOKEN=...          # Токен бота
OPENAI_API_KEY=...              # Для Whisper (голосовые)
ANTHROPIC_API_KEY=...           # Claude Sonnet 4
DAILY_LIMIT=50                  # Лимит генераций/день
ALLOWED_USERS=123456,789012     # Белый список (опционально)
WEBAPP_URL=https://...          # URL Mini App
```

## Инициализация

```python
db = Database("data/smm_agent.db")  # ОТДЕЛЬНАЯ БАЗА!

router_config = RouterConfig(
    primary_model="claude-sonnet-4",
    task_model_overrides={
        "smm": "claude-sonnet-4",
        "smm_generate": "claude-sonnet-4",
        "smm_analyze": "claude-sonnet-4",
    }
)
router = ModelRouter(config=router_config)
llm = LLMService(db=db, router=router, mock_mode=False, ...)
agent = SMMAgent(db=db, llm=llm)

bot = Bot(token=BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.MARKDOWN))
dp = Dispatcher()
```

## Состояния пользователя

```python
user_states = {}   # {tg_id: {"state": "...", "data": {...}}}
pending_posts = {} # {tg_id: PostDraft}

# Возможные состояния:
# - "onboarding_channel"     → подключение канала
# - "onboarding_competitors" → добавление конкурентов
# - "post_topic"             → ввод темы поста
# - "editing"                → редактирование поста
# - "editing_draft"          → редактирование черновика
# - "set_publish_time"       → выбор времени публикации
```

## Handlers (основные)

### Команды

```python
@dp.message(Command("start"))
async def cmd_start(message: Message):
    # Приветствие + онбординг

@dp.message(Command("post"))
async def cmd_post(message: Message):
    # Создание нового поста

@dp.message(Command("draft"), Command("drafts"))
async def cmd_drafts(message: Message):
    # Список черновиков

@dp.message(Command("help"))
async def cmd_help(message: Message):
    # Справка
```

### Голосовые сообщения

```python
@dp.message(F.voice)
async def handle_voice(message: Message):
    # Скачать voice → Whisper API → текст → обработка
```

### Пересланные сообщения

```python
@dp.message(F.forward_from_chat)
async def handle_forward(message: Message):
    # Анализ пересланного поста конкурента
```

### Callback queries (кнопки)

```python
@dp.callback_query(F.data.startswith("pub_"))     # Публикация
@dp.callback_query(F.data.startswith("draft_"))   # В черновики
@dp.callback_query(F.data == "edit")              # Редактирование
@dp.callback_query(F.data == "regenerate")        # Заново
@dp.callback_query(F.data.startswith("delete_"))  # Удалить
@dp.callback_query(F.data.startswith("schedule_")) # Отложенная публикация
```

## Генерация поста

```python
async def generate_for_user(tg_id: int, topic: str, message: Message):
    # 1. Проверка rate limit
    if not check_rate_limit(tg_id):
        return "Лимит исчерпан"

    # 2. Статусное сообщение
    status_msg = await message.answer("🔄 Генерирую пост...")

    # 3. Генерация через agent
    draft = agent.generate_post(tg_id, topic)

    # 4. Сохранение в pending
    pending_posts[tg_id] = draft

    # 5. Отправка с кнопками
    await send_post(message, draft.text, reply_markup=post_keyboard(draft.task_id))
```

## Редактирование поста

```python
async def process_edit(tg_id: int, instruction: str, message: Message):
    old_draft = pending_posts.get(tg_id)

    # agent.edit_post() делает:
    # 1. Точечные правки (regex) для простых инструкций
    # 2. LLM правки для творческих инструкций
    new_text = agent.edit_post(tg_id, old_draft.text, instruction, topic=old_draft.topic)

    # Обновляем pending
    pending_posts[tg_id] = PostDraft(new_text, old_draft.topic, old_draft.task_id, old_draft.channel_id)

    await send_post(message, new_text, reply_markup=post_keyboard(old_draft.task_id))
```

## Rate Limiting

```python
user_usage = {}  # {tg_id: {"date": "2026-01-27", "count": 5}}
DAILY_LIMIT_PER_USER = 50

def check_rate_limit(tg_id: int) -> bool:
    today = datetime.now().strftime("%Y-%m-%d")
    usage = user_usage.get(tg_id, {"date": today, "count": 0})

    if usage["date"] != today:
        user_usage[tg_id] = {"date": today, "count": 1}
        return True

    if usage["count"] >= DAILY_LIMIT_PER_USER:
        return False

    user_usage[tg_id]["count"] += 1
    return True
```

## Middleware

```python
class WhitelistMiddleware(BaseMiddleware):
    """Проверка белого списка на ВСЕ события."""

    async def __call__(self, handler, event, data):
        user = event.from_user
        if ALLOWED_USER_IDS and user.id not in ALLOWED_USER_IDS:
            await event.answer("🚫 Доступ закрыт")
            return
        return await handler(event, data)
```

## Форматирование для Telegram

```python
def _sanitize_html(text: str) -> str:
    """Очистка HTML — оставляем только <b>, <i>, <u>, <code>, <a>"""

def _markdown_to_html(text: str) -> str:
    """**text** → <b>text</b>"""
```

## Публикация

```python
async def publish_post(tg_id: int, task_id: int, callback: CallbackQuery):
    draft = pending_posts.get(tg_id)
    channel_id = draft.channel_id or agent.get_channel_id(tg_id)

    # Отправка через Telegram Bot API
    await bot.send_message(chat_id=channel_id, text=draft.text, parse_mode="HTML")

    # Сохранение в память как успешный пост
    agent.save_successful_post(tg_id, draft.text)
```

---

## Что НЕ используется в вебе

1. **aiogram** — вся библиотека Telegram Bot API
2. **user_states** — in-memory состояния (веб stateless)
3. **pending_posts** — временное хранение (веб использует БД)
4. **WhitelistMiddleware** — фильтрация пользователей
5. **Голосовые сообщения** — Whisper API для транскрипции
6. **Keyboards** — Telegram inline keyboards
7. **Rate limiting** — веб использует nginx

---

## Восстановление бота

Для повторного включения бота:

1. Раскомментировать в `run_all.py`:
```python
async def run_bot():
    from app.smm.bot import main
    await main()
```

2. Добавить в systemd service:
```bash
ExecStart=... run_all.py  # вместо run_api.py
```

3. Убедиться что `.env` содержит:
```bash
TELEGRAM_BOT_TOKEN=...
ALLOWED_USERS=...  # если нужен белый список
```

---

## База данных бота

**Файл:** `data/smm_agent.db`

Содержит:
- Все данные введённые через бота
- Каналы и конкуренты пользователей бота
- История генераций и редактирований
- Метрики использования LLM

**ВАЖНО:** Эта база ОТДЕЛЬНАЯ от веб-базы (`yadro.db`). При миграции нужно объединить данные.
