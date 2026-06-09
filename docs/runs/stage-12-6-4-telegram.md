# Stage 12.6.4 — Telegram Platform

## Architecture

| Component | Path |
|-----------|------|
| Webhook (public) | `POST /api/v1/telegram/webhook` |
| Admin settings | `GET/PATCH /api/v1/system/telegram/settings` |
| Test connection | `POST /api/v1/system/telegram/settings/test` |
| Register webhook | `POST /api/v1/system/telegram/settings/register-webhook` |
| Users | `GET /api/v1/system/telegram/users`, approve/reject |
| History | `GET /api/v1/system/telegram/notifications` |

## Database

**Migration:** `20250610120500_m12_6_4_telegram_platform`

- `telegram_users` — registration via `/start`, status PENDING/APPROVED/REJECTED
- `telegram_notifications` — SENT/FAILED audit log per user

## Flow

1. Admin saves **Bot Token** → auto `setWebhook` → `https://crm-al.neeklo.ru/api/v1/telegram/webhook`
2. User sends `/start` → upsert `telegram_users` (PENDING) → welcome message with ID
3. Admin approves in **Система → Telegram → Пользователи**
4. Alerts (when `alerts.telegram_enabled`) → all APPROVED users + email + history row

## UI

- `/system/telegram/settings` — Bot Token, Webhook URL, статус
- `/system/telegram/users` — одобрение/отклонение
- `/system/telegram/history` — фильтры тип/пользователь/статус/дата

## Removed

- Chat ID field from alerts UI (manual lookup eliminated)
- `POST /v1/system/settings/alerts/test-telegram`
- Legacy `sendTelegramAlert(chatId)` in system-integrations

## Alert types

`QUEUE_ERROR`, `PARSER_ERROR`, `SMTP_ERROR`, `PAYMENT_ERROR`, `SECURITY_ALERT`, `SYSTEM_ALERT`, `STORAGE_WARNING`
