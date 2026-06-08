-- M12_5: system integrations — payment provider config defaults + platform org for secrets
INSERT INTO "organizations" ("id", "type", "name", "slug", "created_at", "updated_at")
SELECT 'org_platform_system', 'COMPANY', 'Platform System', 'platform-system', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "organizations" WHERE "slug" = 'platform-system');

UPDATE "payment_providers" SET "config" = jsonb_build_object(
  'displayName', CASE "provider"
    WHEN 'YOOKASSA' THEN 'YooKassa'
    WHEN 'STRIPE' THEN 'Stripe'
    WHEN 'ROBOKASSA' THEN 'Robokassa'
    WHEN 'CLOUDPAYMENTS' THEN 'CloudPayments'
  END,
  'testMode', true,
  'shopId', '',
  'secretKeySecretId', null,
  'webhookPath', '/api/v1/payments/webhook/' || lower("provider"::text),
  'returnPath', '/billing/invoices?paid=1'
), "updated_at" = NOW()
WHERE "config" = '{}'::jsonb OR "config" IS NULL;

INSERT INTO "system_settings" ("id", "key", "value", "type", "category", "is_encrypted", "updated_at")
VALUES
  ('cm12ss000000000000smtpmeta', 'smtp.config', '{"host":"","port":587,"tls":true,"user":"","from":"noreply@crm-al.neeklo.ru","passwordSecretId":null}', 'JSON', 'EMAIL', false, NOW())
ON CONFLICT ("key") DO NOTHING;
