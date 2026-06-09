-- Stage 12.6.4 — Telegram platform users and notification history

CREATE TYPE "TelegramUserStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "TelegramNotificationType" AS ENUM (
  'QUEUE_ERROR',
  'PARSER_ERROR',
  'SMTP_ERROR',
  'PAYMENT_ERROR',
  'SECURITY_ALERT',
  'SYSTEM_ALERT',
  'STORAGE_WARNING'
);
CREATE TYPE "TelegramNotificationStatus" AS ENUM ('SENT', 'FAILED');

ALTER TYPE "SystemSettingCategory" ADD VALUE 'TELEGRAM';

CREATE TABLE "telegram_users" (
  "id" TEXT NOT NULL,
  "telegram_id" BIGINT NOT NULL,
  "username" TEXT,
  "first_name" TEXT,
  "last_name" TEXT,
  "language_code" TEXT,
  "status" "TelegramUserStatus" NOT NULL DEFAULT 'PENDING',
  "is_admin" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approved_at" TIMESTAMP(3),
  "approved_by" TEXT,
  CONSTRAINT "telegram_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_users_telegram_id_key" ON "telegram_users"("telegram_id");
CREATE INDEX "telegram_users_status_idx" ON "telegram_users"("status");
CREATE INDEX "telegram_users_created_at_idx" ON "telegram_users"("created_at");

ALTER TABLE "telegram_users"
  ADD CONSTRAINT "telegram_users_approved_by_fkey"
  FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "telegram_notifications" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "TelegramNotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" "TelegramNotificationStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "telegram_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telegram_notifications_user_id_idx" ON "telegram_notifications"("user_id");
CREATE INDEX "telegram_notifications_type_idx" ON "telegram_notifications"("type");
CREATE INDEX "telegram_notifications_status_idx" ON "telegram_notifications"("status");
CREATE INDEX "telegram_notifications_created_at_idx" ON "telegram_notifications"("created_at");

ALTER TABLE "telegram_notifications"
  ADD CONSTRAINT "telegram_notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "telegram_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
