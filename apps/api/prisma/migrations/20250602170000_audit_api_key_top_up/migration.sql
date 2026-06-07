-- Add missing audit action for balance top-ups
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'API_KEY_TOP_UP';
