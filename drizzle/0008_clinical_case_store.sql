CREATE TYPE "public"."clinical_case_status" AS ENUM('taslak', 'aktif', 'arsiv');--> statement-breakpoint
CREATE TABLE "clinical_cases" (
	"case_id" text PRIMARY KEY NOT NULL,
	"poliklinik_key" text NOT NULL,
	"status" "clinical_case_status" NOT NULL,
	"review_status" text DEFAULT 'legacy' NOT NULL,
	"version" integer NOT NULL,
	"content_checksum" text,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "published_clinical_case_versions" (
	"case_id" text NOT NULL,
	"version" integer NOT NULL,
	"content_checksum" text NOT NULL,
	"approved_by" text NOT NULL,
	"approved_at" timestamp with time zone NOT NULL,
	"content" jsonb NOT NULL,
	CONSTRAINT "published_clinical_case_versions_pkey" PRIMARY KEY("case_id", "version")
);
--> statement-breakpoint
CREATE INDEX "clinical_cases_poliklinik_status_updated_idx" ON "clinical_cases" USING btree ("poliklinik_key","status","updated_at");--> statement-breakpoint
CREATE INDEX "clinical_cases_status_review_updated_idx" ON "clinical_cases" USING btree ("status","review_status","updated_at");--> statement-breakpoint
CREATE INDEX "published_clinical_case_versions_case_approved_idx" ON "published_clinical_case_versions" USING btree ("case_id","approved_at");
