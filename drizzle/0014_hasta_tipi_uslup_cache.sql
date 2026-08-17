-- Hasta tipi üslup çeşitliliği: denemelere tip ataması + üslup dönüşüm önbelleği.
-- Klinik gerçek cevap sabit kalır; yalnızca üslup (hasta tipi) değişir ve
-- (vaka, tip, soru) üçlüsüne göre tembelce üretilip saklanır.
ALTER TABLE "learning_attempts" ADD COLUMN "hasta_tipi_id" text;
--> statement-breakpoint
ALTER TABLE "learning_attempts" ADD COLUMN "answers" jsonb;
--> statement-breakpoint
CREATE TABLE "cevap_cache" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"vaka_id" text NOT NULL,
	"hasta_tipi_id" text NOT NULL,
	"action_key" text NOT NULL,
	"orijinal_cevap" text NOT NULL,
	"donusturulmus_cevap" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "cevap_cache_vaka_tip_action_idx" ON "cevap_cache" USING btree ("vaka_id","hasta_tipi_id","action_key");
--> statement-breakpoint
CREATE INDEX "cevap_cache_vaka_tip_idx" ON "cevap_cache" USING btree ("vaka_id","hasta_tipi_id");
