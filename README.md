# AI Gateway & Agent Access Platform

SaaS-платформа для выпуска API-ключей доступа к AI-моделям и AI-агентам через единый шлюз OpenRouter.

## Стек

**Frontend:** React, Vite, TypeScript, TailwindCSS, shadcn/ui, React Query, Zustand

**Backend:** NestJS, Prisma, PostgreSQL, Redis, BullMQ

## Быстрый старт

### 1. Инфраструктура

```bash
docker compose up -d
```

### 2. Backend

```bash
cp apps/api/.env.example apps/api/.env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
```

### 3. Frontend

```bash
npm run dev:web
```

### 4. Всё вместе

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001/api

## Учётные записи (после seed)

| Email | Пароль | Роль |
|-------|--------|------|
| admin@ai-gateway.local | admin123 | Admin |
| dev@ai-gateway.local | dev123 | Developer |

## API Gateway

### Chat Completions

```bash
curl -X POST http://localhost:3001/api/v1/chat/completions \
  -H "Authorization: Bearer agw_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'
```

### Agent Chat

```bash
curl -X POST http://localhost:3001/api/v1/agents/lawyer/chat \
  -H "Authorization: Bearer agw_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Проверь договор"}]}'
```

### Usage API

- `GET /api/v1/usage` — общая статистика
- `GET /api/v1/usage/models` — по моделям
- `GET /api/v1/usage/daily` — по дням
- `GET /api/v1/usage/monthly` — по месяцам
- `GET /api/v1/usage/keys` — по ключам

## Основные возможности

- Авторизация (email + пароль + опциональный 2FA)
- Роли: User, Developer, Admin
- Управление API ключами с лимитами и IP/домен ограничениями
- Цепочки fallback моделей
- Кастомная тарификация (себестоимость / продажная цена / маржа)
- Каталог моделей OpenRouter с лейблами (FREE, CHEAP, FAST, PREMIUM...)
- AI Агенты (Юрист, Маркетолог, Копирайтер, Разработчик, Поддержка)
- Аналитика и аудит
- Светлая / тёмная тема
- Command Palette (Ctrl+K)

## Структура проекта

```
apps/
  api/          # NestJS backend
  web/          # React frontend
docker-compose.yml
```

## OpenRouter

Добавьте ключ OpenRouter в `.env`:

```
OPENROUTER_DEFAULT_KEY=sk-or-v1-...
```

Или через Admin → Providers в интерфейсе.
