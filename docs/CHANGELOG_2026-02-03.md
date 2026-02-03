# Изменения 3 февраля 2026

## Разделение Бот / Веб

### Что сделано
- Отключён Telegram бот, оставлен только веб-сервис
- Создан `run_api.py` — запуск только FastAPI без бота
- Код бота архивирован в `docs/archive/`
- Обновлён systemd сервис: `yadro-bot.service` → `yadro-api.service`
- Мигрированы данные из `smm_agent.db` в `yadro.db` (43 записи)

### Два бота
| Бот | Username | Назначение |
|-----|----------|------------|
| Авторизация | `@Yadro_enter_bot` | Telegram Login Widget |
| Постинг | `@YadroPost_bot` | Публикация в каналы |

### Переменные окружения (.env на сервере)
```env
APP_ENV=production
TELEGRAM_BOT_TOKEN=8377107170:AAEzZt5eSEWJQ7H4mTAc6vKcm4oEEKsa5x4
TELEGRAM_BOT_USERNAME=Yadro_enter_bot
TELEGRAM_POSTING_BOT_TOKEN=8278545947:AAH81TQs2eci-GxbsIV7ZiQiDK2nqdiIUvg
TELEGRAM_POSTING_BOT_USERNAME=YadroPost_bot
```

---

## Авторизация

### Проблема
Без авторизации можно было свободно лазить по сайту — middleware был отключён.

### Решение
1. **Middleware** — раскомментирован редирект на `/login`
2. **Cookie** — токен сохраняется в cookie при входе (middleware не имеет доступа к localStorage)
3. **Logout** — очищает и localStorage, и cookie

### Файлы изменены
- `frontend/src/middleware.ts` — редирект неавторизованных
- `frontend/src/app/login/page.tsx` — cookie при входе
- `frontend/src/lib/api.ts` — очистка cookie при выходе
- `frontend/src/components/auth-provider.tsx` — очистка cookie при выходе

---

## Страница логина

### Изменения
- Убран сайдбар (создан `LayoutWrapper` компонент)
- Добавлен переключатель темы (солнце/луна в правом верхнем углу)

### Файлы
- `frontend/src/components/layout-wrapper.tsx` — новый компонент
- `frontend/src/app/layout.tsx` — использует LayoutWrapper

---

## Доступ для разработчиков

### Способ 1: Localhost
На `localhost` и `127.0.0.1` авторизация не требуется.

### Способ 2: Dev-токен
```
http://35.156.188.57/?dev_token=yadro-dev-2026
```

**Как работает:**
1. Открываешь URL с параметром
2. Устанавливается cookie `dev_access=true` на 24 часа
3. Редирект на чистый URL
4. 24 часа можно ходить без авторизации

**Сменить токен:**
```env
DEV_ACCESS_TOKEN=твой-секрет
```

---

## Команды

### Деплой
```bash
# Из ~/Desktop/yadro-post
git add -A && git commit -m "описание" && git push

# На сервере (автоматически через SSH)
ssh -i ~/Desktop/yadro-key.pem ubuntu@35.156.188.57 \
  "cd /home/ubuntu/yadro-post && git pull && \
   cd frontend && npm run build && \
   pm2 restart yadro-post-frontend"
```

### Рестарт backend
```bash
ssh -i ~/Desktop/yadro-key.pem ubuntu@35.156.188.57 \
  "sudo systemctl restart yadro-api"
```

### Проверка логов
```bash
# Frontend
ssh -i ~/Desktop/yadro-key.pem ubuntu@35.156.188.57 "pm2 logs yadro-post-frontend"

# Backend
ssh -i ~/Desktop/yadro-key.pem ubuntu@35.156.188.57 "sudo journalctl -u yadro-api -f"
```

---

## Структура авторизации

```
Пользователь открывает сайт
        │
        ▼
    Middleware проверяет
        │
        ├── localhost? → пропустить
        │
        ├── ?dev_token=xxx? → установить cookie, пропустить
        │
        ├── dev_access cookie? → пропустить
        │
        ├── token cookie? → пропустить
        │
        └── нет токена → редирект на /login
```

---

## Что дальше

- [ ] Мультитенантность — у каждого пользователя свои данные
- [ ] Привязка каналов/конкурентов/стилей к user_id
- [ ] Фильтрация данных по user_id в API
