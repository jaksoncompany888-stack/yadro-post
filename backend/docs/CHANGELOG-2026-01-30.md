# Changelog 30 января 2026

## Авторизация — Email + Telegram

### Backend (`backend/app/api/auth.py`)

**Новые endpoints:**
| Endpoint | Метод | Описание |
|----------|-------|----------|
| `/api/auth/register` | POST | Регистрация по email/password |
| `/api/auth/login` | POST | Вход по email/password |
| `/api/auth/telegram/login` | POST | Вход через Telegram Widget |
| `/api/auth/logout` | POST | Выход |
| `/api/auth/me` | GET | Текущий пользователь |
| `/api/auth/refresh` | POST | Обновление токена |
| `/api/auth/telegram/config` | GET | Конфиг для Telegram Widget |

**Безопасность:**
- Пароли хэшируются через bcrypt
- JWT токены с 30-дневным сроком жизни
- Валидация email на бэкенде (regex)
- Минимум 6 символов для пароля

### База данных (`backend/app/storage/schema.py`)

**Новые поля в таблице users:**
```sql
email TEXT UNIQUE,
password_hash TEXT,
first_name TEXT,
last_name TEXT
```

**Миграция:** Автоматическая при старте API (`backend/app/api/app.py`)

### Frontend (`frontend/src/app/login/page.tsx`)

**Полностью переписана страница:**
- Табы "Вход" / "Регистрация"
- Форма входа: email + пароль
- Форма регистрации: имя + фамилия + email + пароль + подтверждение
- Telegram Login Widget (альтернативный вход)
- Показ/скрытие пароля
- Валидация полей
- Состояния: idle, loading, success, error

### Sidebar (`frontend/src/components/sidebar.tsx`)

**Добавлено:**
- Кнопка "Выйти" внизу (desktop)
- Кнопка "Выйти" в mobile меню "Ещё"
- Фильтрация меню по роли пользователя

---

## Редактирование черновиков

### Frontend (`frontend/src/app/drafts/page.tsx`)
- Кнопка "Редактировать" всегда видна (не только при hover)
- Ссылка ведёт на `/create?edit=ID`

### Frontend (`frontend/src/app/create/page.tsx`)
- Поддержка параметра `?edit=ID`
- Загрузка черновика по ID при открытии
- Обновление существующего черновика (не создание нового)

---

## API клиент (`frontend/src/lib/api.ts`)

**Новые методы:**
```typescript
authApi.register({ email, password, first_name, last_name })
authApi.login({ email, password })
authApi.logout()
```

---

## Зависимости (`backend/requirements.txt`)

**Добавлено:**
```
bcrypt==4.1.2
```

---

## Деплой

**Сервер:** AWS EC2 (35.156.188.57)
**URL:** http://35.156.188.57

**Команды:**
```bash
# SSH
ssh -i ~/Desktop/yadro-key.pem ubuntu@35.156.188.57

# Backend
sudo systemctl restart yadro-api

# Frontend
pm2 restart yadro-post-frontend

# Полный деплой (локально)
./deploy.sh
```

**Установка bcrypt на сервере:**
```bash
cd /home/ubuntu/yadro-post/backend
source venv/bin/activate
pip install bcrypt==4.1.2
```

---

## Исправленные баги

1. **ChunkLoadError** — после деплоя браузер кэшировал старые chunks
   - Решение: `rm -rf .next && npm run build`

2. **PM2 wrong directory** — процесс запускался из `/home/ubuntu/`
   - Решение: удалить неправильный процесс, использовать существующий `yadro-post-frontend`

---

## Изменённые файлы

| Файл | Изменения |
|------|-----------|
| `backend/app/api/auth.py` | Email регистрация/вход, bcrypt |
| `backend/app/api/app.py` | Миграция для email полей |
| `backend/app/storage/schema.py` | email, password_hash, first_name, last_name |
| `backend/requirements.txt` | bcrypt==4.1.2 |
| `frontend/src/app/login/page.tsx` | Полностью переписана |
| `frontend/src/app/drafts/page.tsx` | Видимая кнопка редактирования |
| `frontend/src/app/create/page.tsx` | Поддержка ?edit=ID |
| `frontend/src/components/sidebar.tsx` | Кнопка выхода, фильтр по ролям |
| `frontend/src/lib/api.ts` | authApi.register, authApi.login |

---

## Git

```bash
git add .
git commit -m "Этап 2: Email + Telegram авторизация, редактирование черновиков"
git push
```
