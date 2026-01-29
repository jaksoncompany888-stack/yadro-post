# AWS Server - Yadro Post (Frontend)

Основная документация: `/Users/mac/Desktop/yadro-smm/docs/AWS.md`

## Быстрый доступ

```bash
ssh -i /Users/mac/Desktop/yadro-key.pem ubuntu@35.156.188.57
```

## Деплой фронтенда

```bash
cd /home/ubuntu/yadro-post/frontend
git pull
npm install
npm run build
pm2 restart yadro-post-frontend
```

## PM2 команды

```bash
pm2 list
pm2 logs yadro-post-frontend
pm2 restart yadro-post-frontend
```

## Локальный путь

`/Users/mac/Desktop/yadro-post`

## На сервере

`/home/ubuntu/yadro-post/frontend`
