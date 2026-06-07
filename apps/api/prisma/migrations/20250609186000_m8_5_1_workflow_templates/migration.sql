-- M8_5_1: Workflow templates catalog
CREATE TABLE IF NOT EXISTS "workflow_template_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workflow_template_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_template_categories_slug_key" ON "workflow_template_categories"("slug");

CREATE TABLE IF NOT EXISTS "workflow_templates" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_type" "WorkflowTriggerType" NOT NULL,
    "trigger_config" JSONB NOT NULL DEFAULT '{}',
    "schedule_cron" TEXT,
    "steps" JSONB NOT NULL DEFAULT '[]',
    "graph" JSONB NOT NULL DEFAULT '{}',
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_templates_slug_key" ON "workflow_templates"("slug");
CREATE INDEX IF NOT EXISTS "workflow_templates_category_id_idx" ON "workflow_templates"("category_id");
CREATE INDEX IF NOT EXISTS "workflow_templates_trigger_type_idx" ON "workflow_templates"("trigger_type");

ALTER TABLE "workflow_templates" ADD CONSTRAINT "workflow_templates_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "workflow_template_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflows" ADD CONSTRAINT "workflows_source_template_id_fkey"
    FOREIGN KEY ("source_template_id") REFERENCES "workflow_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed categories
INSERT INTO "workflow_template_categories" ("id", "slug", "name", "description", "sort_order")
VALUES
    ('wft-cat-crm', 'crm', 'CRM', 'Автоматизация CRM событий', 1),
    ('wft-cat-comms', 'communications', 'Коммуникации', 'Telegram, Email, MAX', 2),
    ('wft-cat-knowledge', 'knowledge', 'База знаний', 'Индексация и обработка документов', 3)
ON CONFLICT ("slug") DO NOTHING;

-- Seed templates
INSERT INTO "workflow_templates" ("id", "category_id", "slug", "name", "description", "trigger_type", "trigger_config", "steps", "graph", "updated_at")
VALUES
(
    'wft-lead-telegram',
    'wft-cat-comms',
    'new-lead-telegram',
    'Новый лид → Telegram',
    'Уведомление в Telegram при создании лида',
    'CRM_EVENT',
    '{"event":"LEAD_CREATED"}',
    '[{"stepKey":"start","stepType":"START","position":0,"configuration":{}},{"stepKey":"notify","stepType":"TOOL","position":1,"configuration":{"payloadTemplate":"Новый лид: {{trigger.name}}"}},{"stepKey":"end","stepType":"END","position":2,"configuration":{}}]',
    '{"edges":[{"from":"start","to":"notify"},{"from":"notify","to":"end"}]}',
    CURRENT_TIMESTAMP
),
(
    'wft-lead-task',
    'wft-cat-crm',
    'new-lead-task',
    'Новый лид → Задача',
    'Создание задачи при новом лиде',
    'CRM_EVENT',
    '{"event":"LEAD_CREATED"}',
    '[{"stepKey":"start","stepType":"START","position":0,"configuration":{}},{"stepKey":"task","stepType":"CRM","position":1,"configuration":{"entityType":"TASK","action":"create","data":{"title":"Обработать лид {{trigger.name}}"}}},{"stepKey":"end","stepType":"END","position":2,"configuration":{}}]',
    '{"edges":[{"from":"start","to":"task"},{"from":"task","to":"end"}]}',
    CURRENT_TIMESTAMP
),
(
    'wft-email-crm',
    'wft-cat-crm',
    'email-to-crm',
    'Email → CRM',
    'Создание лида из входящего email',
    'INTEGRATION_EVENT',
    '{"event":"email.received"}',
    '[{"stepKey":"start","stepType":"START","position":0,"configuration":{}},{"stepKey":"lead","stepType":"CRM","position":1,"configuration":{"entityType":"LEAD","action":"create"}},{"stepKey":"end","stepType":"END","position":2,"configuration":{}}]',
    '{"edges":[{"from":"start","to":"lead"},{"from":"lead","to":"end"}]}',
    CURRENT_TIMESTAMP
),
(
    'wft-telegram-assistant',
    'wft-cat-comms',
    'telegram-to-assistant',
    'Telegram → Ассистент',
    'Ответ ассистента на сообщение Telegram',
    'INTEGRATION_EVENT',
    '{"event":"telegram.received"}',
    '[{"stepKey":"start","stepType":"START","position":0,"configuration":{}},{"stepKey":"assistant","stepType":"ASSISTANT","position":1,"configuration":{"promptTemplate":"{{trigger.content}}"}},{"stepKey":"end","stepType":"END","position":2,"configuration":{}}]',
    '{"edges":[{"from":"start","to":"assistant"},{"from":"assistant","to":"end"}]}',
    CURRENT_TIMESTAMP
),
(
    'wft-doc-index',
    'wft-cat-knowledge',
    'document-index',
    'Документ → Индексация',
    'Обработка документа после индексации',
    'KB_EVENT',
    '{"event":"DOCUMENT_INDEXED"}',
    '[{"stepKey":"start","stepType":"START","position":0,"configuration":{}},{"stepKey":"memory","stepType":"MEMORY_WRITE","position":1,"configuration":{"contentTemplate":"Indexed: {{trigger.documentId}}"}},{"stepKey":"end","stepType":"END","position":2,"configuration":{}}]',
    '{"edges":[{"from":"start","to":"memory"},{"from":"memory","to":"end"}]}',
    CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
