# Storo

Storo — веб-приложение для управления инвентарями: создание коллекций, поиск, теги, доступ, обсуждения, пользовательские поля, загрузка изображений и вход через Google.

## Стек

- Frontend: React 19, TypeScript, Vite, Ant Design, SignalR client
- Backend: ASP.NET Core (.NET 10), Entity Framework Core, PostgreSQL, SignalR
- Хранилище файлов: Supabase Storage
- Авторизация: Google OAuth 2.0
- Контейнеризация: Docker, Docker Compose
- Хостинг: Render (frontend + backend), PostgreSQL на Render

## Структура

- `frontend` — клиентское приложение и nginx-конфиг
- `backend/backend` — API и бизнес-логика
- `docker-compose.yml` — локальный запуск frontend + backend

## Запуск локально через Docker

1. Подготовить переменные окружения backend:

```powershell
Copy-Item backend/backend/.env.example backend/backend/.env
```

2. Заполнить `backend/backend/.env`:

- `ConnectionStrings__Postgres`
- `Authentication__Google__ClientId`
- `Authentication__Google__ClientSecret`
- `Auth__ExternalProviders__0=google`
- `SUPABASE_URL`
- `SUPABASE_BUCKET`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_PUBLIC_KEY`

3. Запустить:

```bash
docker compose up --build
```

4. Проверить:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5108`
- Swagger: `http://localhost:5108/swagger`

## Хостинг (Render)

Текущие URL:

- Frontend: `https://storo-9sy7.onrender.com`
- Backend: `https://storo-backend-latest.onrender.com`