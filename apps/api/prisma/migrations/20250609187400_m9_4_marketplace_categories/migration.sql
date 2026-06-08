-- M9_4: Marketplace categories
CREATE TABLE IF NOT EXISTS "marketplace_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketplace_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "marketplace_categories_slug_key" ON "marketplace_categories"("slug");

ALTER TABLE "marketplace_packages" ADD CONSTRAINT "marketplace_packages_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "marketplace_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "marketplace_categories" ("id", "slug", "name", "description", "sort_order")
VALUES
    ('mp-cat-assistants', 'assistants', 'Ассистенты', 'AI-ассистенты для различных задач', 1),
    ('mp-cat-sales', 'sales', 'Продажи', 'Пакеты для отдела продаж', 2),
    ('mp-cat-legal', 'legal', 'Юристы', 'Юридические ассистенты и шаблоны', 3),
    ('mp-cat-marketing', 'marketing', 'Маркетинг', 'Маркетинговая автоматизация', 4),
    ('mp-cat-support', 'support', 'Поддержка', 'Клиентская поддержка', 5),
    ('mp-cat-realestate', 'realestate', 'Недвижимость', 'Риелторы и агентства', 6),
    ('mp-cat-education', 'education', 'Образование', 'Обучение и курсы', 7),
    ('mp-cat-crm', 'crm', 'CRM', 'CRM-сценарии и интеграции', 8),
    ('mp-cat-automation', 'automation', 'Автоматизация', 'Workflow и automation packages', 9),
    ('mp-cat-knowledge', 'knowledge', 'Базы знаний', 'Шаблоны баз знаний', 10),
    ('mp-cat-integrations', 'integrations', 'Интеграции', 'Готовые интеграции', 11)
ON CONFLICT ("slug") DO NOTHING;
