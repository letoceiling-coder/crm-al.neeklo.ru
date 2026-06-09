# Stage 12.6.4 — Production Validation

**Date:** 2026-06-08  
**Script:** `deploy/stage-12-6-4-production-validation.py`

## Results — 11/11 PASS (GO)

| # | Check | Result |
|---|-------|--------|
| 1 | Admin login | PASS |
| 2 | Launch Center 100% GO | PASS |
| 3 | Telegram settings API | PASS |
| 4 | Telegram users API | PASS |
| 5 | Telegram notifications API | PASS |
| 6 | Telegram webhook (public) | PASS |
| 7 | YooKassa-only payments | PASS |
| 8 | Web bundle «Центр запуска» | PASS |
| 9 | Web bundle telegram routes | PASS |
| 10 | Web bundle «Сохранить» | PASS |
| 11 | Web bundle «Проверить подключение» | PASS |

## Launch Center

**100% — GO**

## PM2

6/6 CRM processes online after deploy + `prisma generate`.

## Post-deploy note

After migration, run `npx prisma generate` on server (included in deploy script) — required for `telegramUser` Prisma delegates.

## Manual verification pending (requires Bot Token)

- Telegram `/start` registration flow
- Admin approve → Telegram message
- Alert delivery to APPROVED users

These require ops to configure Bot Token in **Система → Telegram → Настройки**.
