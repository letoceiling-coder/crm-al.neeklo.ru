-- M2_6: Domain Profile (platform-global reputation)
CREATE TABLE "domain_profiles" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "total_requests" INTEGER NOT NULL DEFAULT 0,
    "successful_parses" INTEGER NOT NULL DEFAULT 0,
    "failed_parses" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION,
    "average_chars" INTEGER,
    "average_quality_score" DOUBLE PRECISION,
    "recommended_mode" "ParserMode",
    "anti_bot_detected" BOOLEAN NOT NULL DEFAULT false,
    "captcha_detected" BOOLEAN NOT NULL DEFAULT false,
    "last_parsed_at" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "domain_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domain_profiles_domain_key" ON "domain_profiles"("domain");

-- Platform seed: recommended parser modes
INSERT INTO "domain_profiles" ("id", "domain", "recommended_mode", "updated_at")
VALUES
  ('dp-consultant-ru', 'consultant.ru', 'LEGAL_DEEP', CURRENT_TIMESTAMP),
  ('dp-sudrf-ru', 'sudrf.ru', 'LEGAL_FAST', CURRENT_TIMESTAMP),
  ('dp-sudact-ru', 'sudact.ru', 'LEGAL_FAST', CURRENT_TIMESTAMP),
  ('dp-pravo-gov-ru', 'pravo.gov.ru', 'LEGAL_FAST', CURRENT_TIMESTAMP),
  ('dp-ozon-ru', 'ozon.ru', 'MARKETPLACE_HARD', CURRENT_TIMESTAMP),
  ('dp-wildberries-ru', 'wildberries.ru', 'MARKETPLACE_HARD', CURRENT_TIMESTAMP),
  ('dp-market-yandex-ru', 'market.yandex.ru', 'MARKETPLACE_HARD', CURRENT_TIMESTAMP)
ON CONFLICT ("domain") DO NOTHING;
