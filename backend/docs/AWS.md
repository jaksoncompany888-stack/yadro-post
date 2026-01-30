# AWS Server — Ядро Post

**Последнее обновление:** 30 января 2026

## Сервер

| Параметр | Значение |
|----------|----------|
| **IP** | 35.156.188.57 |
| **URL** | http://35.156.188.57 |
| **Instance** | t2.micro (1GB RAM) |
| **OS** | Ubuntu 24.04 |
| **Region** | eu-central-1 (Frankfurt) |

## SSH

```bash
ssh -i ~/Desktop/yadro-key.pem ubuntu@35.156.188.57
```

**Ключ:** `~/Desktop/yadro-key.pem`
**Пользователь:** `ubuntu`

## Сервисы

| Сервис | Порт | Управление |
|--------|------|------------|
| Backend API | 8000 | `systemctl restart yadro-api` |
| Frontend | 3000 | `pm2 restart yadro-post-frontend` |
| Nginx | 80 | `systemctl restart nginx` |

## Пути на сервере

```
/home/ubuntu/yadro-post/
├── backend/           # FastAPI + Ядро SMM
│   ├── app/
│   ├── data/smm.db    # SQLite база
│   └── venv/          # Python virtualenv
└── frontend/          # Next.js
    └── .next/         # Build
```

## Команды

### Backend
```bash
# Статус
sudo systemctl status yadro-api

# Перезапуск
sudo systemctl restart yadro-api

# Логи
sudo journalctl -u yadro-api -f

# Health check
curl localhost:8000/health
```

### Frontend
```bash
# Статус
pm2 status

# Перезапуск
pm2 restart yadro-post-frontend

# Логи
pm2 logs yadro-post-frontend

# Rebuild
cd /home/ubuntu/yadro-post/frontend
rm -rf .next && npm run build
pm2 restart yadro-post-frontend
```

### Nginx
```bash
# Конфиг
sudo nano /etc/nginx/sites-available/yadro

# Проверить
sudo nginx -t

# Перезапуск
sudo systemctl restart nginx
```

## Деплой

### С локальной машины
```bash
cd ~/Desktop/yadro-post
./deploy.sh
```

### Вручную на сервере
```bash
# Backend
cd /home/ubuntu/yadro-post/backend
git pull
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart yadro-api

# Frontend
cd /home/ubuntu/yadro-post/frontend
git pull
npm install
npm run build
pm2 restart yadro-post-frontend
```

## Локальные пути (Mac)

| Что | Путь |
|----|------|
| Проект | `~/Desktop/yadro-post` |
| SSH ключ | `~/Desktop/yadro-key.pem` |

## Если не работает

1. **502 Bad Gateway** — backend упал
   ```bash
   sudo systemctl restart yadro-api
   ```

2. **ChunkLoadError** — старый кэш фронтенда
   ```bash
   cd /home/ubuntu/yadro-post/frontend
   rm -rf .next && npm run build
   pm2 restart yadro-post-frontend
   ```

3. **Сервер не отвечает** — AWS Console → EC2 → Reboot

## Swap

Настроен 1.8GB. Проверка:
```bash
free -h
```
