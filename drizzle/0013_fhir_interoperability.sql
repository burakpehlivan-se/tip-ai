-- FHIR birlikte çalışabilirlik katmanı. Kod sistemleri, klinik projeksiyonun
-- hangi sözlükten geldiğini korur; kaynak manifesti ham FHIR gövdesini DB'ye
-- kopyalamadan özgün arşivi doğrulanabilir tutar.
ALTER TABLE "synthea_conditions" ADD COLUMN "code_system" text;
--> statement-breakpoint
ALTER TABLE "synthea_observations" ADD COLUMN "code_system" text;
--> statement-breakpoint
ALTER TABLE "synthea_medications" ADD COLUMN "code_system" text;
--> statement-breakpoint
ALTER TABLE "synthea_procedures" ADD COLUMN "code_system" text;
--> statement-breakpoint
ALTER TABLE "synthea_encounters" ADD COLUMN "code_system" text;
--> statement-breakpoint
ALTER TABLE "synthea_allergies" ADD COLUMN "code_system" text;
--> statement-breakpoint
ALTER TABLE "synthea_immunizations" ADD COLUMN "code_system" text;
--> statement-breakpoint
ALTER TABLE "synthea_care_plans" ADD COLUMN "code_system" text;
--> statement-breakpoint
ALTER TABLE "synthea_diagnostic_reports" ADD COLUMN "code_system" text;
--> statement-breakpoint
CREATE TABLE "fhir_source_archives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_uri" text NOT NULL,
	"source_format" text NOT NULL,
	"fhir_version" text,
	"file_count" integer NOT NULL,
	"size_bytes" bigint NOT NULL,
	"manifest_hash" text NOT NULL,
	"raw_payload_retained_in_db" boolean NOT NULL DEFAULT false,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"last_verified_at" timestamp with time zone NOT NULL DEFAULT now(),
	CONSTRAINT "fhir_source_archives_manifest_hash_unique" UNIQUE("manifest_hash")
);
--> statement-breakpoint
CREATE TABLE "fhir_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"archive_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"files" integer NOT NULL,
	"invalid_files" integer NOT NULL,
	"resource_types" jsonb NOT NULL,
	"imported_counts" jsonb NOT NULL,
	"unsupported" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "fhir_import_runs_archive_created_idx" ON "fhir_import_runs" USING btree ("archive_id", "created_at");
--> statement-breakpoint
ALTER TABLE "fhir_import_runs" ADD CONSTRAINT "fhir_import_runs_archive_id_fhir_source_archives_id_fk" FOREIGN KEY ("archive_id") REFERENCES "fhir_source_archives"("id") ON DELETE RESTRICT ON UPDATE no action;
--> statement-breakpoint
COMMENT ON TABLE "fhir_source_archives" IS 'FHIR kaynak dizininin değişmez manifestidir; ham gövde/PHI DBde tutulmaz.';
--> statement-breakpoint
COMMENT ON TABLE "fhir_import_runs" IS 'FHIR içe aktarma kapsama ve desteklenmeyen kaynak denetim kaydıdır.';
