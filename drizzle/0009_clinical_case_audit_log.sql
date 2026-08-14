-- P2 expand migration: mevcut vaka tablolarını veya JSON kaynağını değiştirmez.
-- Geri alma, üretimde DROP TABLE değil ileri bir retention/archival migration'ı
-- ile yapılmalıdır; denetim kanıtı tasarım gereği silinmez.
CREATE TABLE "clinical_case_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" text NOT NULL,
	"event" text NOT NULL,
	"actor" text NOT NULL,
	"summary" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "clinical_case_audit_logs_case_created_idx" ON "clinical_case_audit_logs" USING btree ("case_id","created_at");
--> statement-breakpoint
CREATE INDEX "clinical_case_audit_logs_actor_created_idx" ON "clinical_case_audit_logs" USING btree ("actor","created_at");
