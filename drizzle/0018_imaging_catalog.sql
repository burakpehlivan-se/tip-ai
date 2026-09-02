-- Independent source-record catalogue for the medical-image analysis workspace.
-- It deliberately does not reference clinical_cases, learning_attempts,
-- radiology_sources, ekg_sources, or synthea_* tables.
CREATE TYPE "public"."imaging_import_run_status" AS ENUM('running', 'succeeded', 'failed', 'review_required');--> statement-breakpoint
CREATE TYPE "public"."imaging_render_run_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."imaging_record_availability" AS ENUM('indexed', 'display_ready', 'unavailable', 'stale', 'retired');--> statement-breakpoint
CREATE TYPE "public"."imaging_taxonomy_status" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."imaging_attempt_status" AS ENUM('active', 'submitted', 'completed', 'abandoned');--> statement-breakpoint

CREATE TABLE "imaging_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_key" text NOT NULL,
	"version" text NOT NULL,
	"display_name" text NOT NULL,
	"modality" text NOT NULL,
	"source_uri" text,
	"attribution_uri" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "imaging_dataset_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"document_kind" text NOT NULL,
	"storage_key" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"mime_type" text NOT NULL,
	"title" text,
	"attribution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "imaging_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"status" "imaging_import_run_status" DEFAULT 'running' NOT NULL,
	"manifest_checksum" text NOT NULL,
	"metadata_checksum" text NOT NULL,
	"hmac_key_version" text,
	"discovered_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"imported_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_summary" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "imaging_render_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"import_run_id" uuid NOT NULL,
	"status" "imaging_render_run_status" DEFAULT 'running' NOT NULL,
	"renderer_version" text NOT NULL,
	"render_profile" text NOT NULL,
	"cursor" text,
	"discovered_count" integer DEFAULT 0 NOT NULL,
	"rendered_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_summary" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "imaging_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dataset_id" uuid NOT NULL,
	"import_run_id" uuid NOT NULL,
	"source_record_id" text NOT NULL,
	"source_subject_key" text,
	"modality" text NOT NULL,
	"source_age" integer,
	"source_sex" text,
	"view_position" text,
	"protocol" text,
	"metadata_checksum" text NOT NULL,
	"availability" "imaging_record_availability" DEFAULT 'indexed' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "imaging_record_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"render_run_id" uuid,
	"asset_role" text NOT NULL,
	"storage_key" text NOT NULL,
	"mime_type" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"size_bytes" bigint,
	"width" integer,
	"height" integer,
	"sampling_rate_hz" double precision,
	"renderer_version" text NOT NULL,
	"render_profile" text NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "imaging_record_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"record_id" uuid NOT NULL,
	"source_label_key" text NOT NULL,
	"source_label_code" text,
	"source_label_name" text NOT NULL,
	"category" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"provenance" text NOT NULL,
	"confidence" double precision,
	"source_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "imaging_answer_taxonomies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"modality" text NOT NULL,
	"version" text NOT NULL,
	"status" "imaging_taxonomy_status" DEFAULT 'draft' NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"scoring_version" text DEFAULT 'v1' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "imaging_answer_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taxonomy_id" uuid NOT NULL,
	"option_key" text NOT NULL,
	"display_label" text NOT NULL,
	"category" text,
	"source_label_mapping" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "imaging_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"taxonomy_id" uuid NOT NULL,
	"status" "imaging_attempt_status" DEFAULT 'active' NOT NULL,
	"record_snapshot" jsonb NOT NULL,
	"evaluation_snapshot" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE "imaging_interpretations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL UNIQUE,
	"selected_option_keys" jsonb NOT NULL,
	"likely_diagnosis" text,
	"structured_observations" jsonb NOT NULL,
	"free_text" text,
	"score" double precision,
	"feedback" jsonb,
	"evaluation_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
-- A completed interpretation must retain the label/provenance snapshot used for
-- its score even if the source record is later re-imported. The application may
-- set this column once inside its submit transaction, but never replace it.
CREATE FUNCTION "public"."imaging_attempts_prevent_evaluation_snapshot_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
	IF OLD."evaluation_snapshot" IS NOT NULL
		AND NEW."evaluation_snapshot" IS DISTINCT FROM OLD."evaluation_snapshot" THEN
		RAISE EXCEPTION 'imaging_attempts.evaluation_snapshot is immutable once set';
	END IF;
	RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER "imaging_attempts_evaluation_snapshot_immutable"
BEFORE UPDATE ON "imaging_attempts"
FOR EACH ROW EXECUTE FUNCTION "public"."imaging_attempts_prevent_evaluation_snapshot_mutation"();--> statement-breakpoint

ALTER TABLE "imaging_dataset_documents" ADD CONSTRAINT "imaging_dataset_documents_dataset_id_imaging_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."imaging_datasets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_import_runs" ADD CONSTRAINT "imaging_import_runs_dataset_id_imaging_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."imaging_datasets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_render_runs" ADD CONSTRAINT "imaging_render_runs_dataset_id_imaging_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."imaging_datasets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_render_runs" ADD CONSTRAINT "imaging_render_runs_import_run_id_imaging_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."imaging_import_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_records" ADD CONSTRAINT "imaging_records_dataset_id_imaging_datasets_id_fk" FOREIGN KEY ("dataset_id") REFERENCES "public"."imaging_datasets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_records" ADD CONSTRAINT "imaging_records_import_run_id_imaging_import_runs_id_fk" FOREIGN KEY ("import_run_id") REFERENCES "public"."imaging_import_runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_record_assets" ADD CONSTRAINT "imaging_record_assets_record_id_imaging_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."imaging_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_record_assets" ADD CONSTRAINT "imaging_record_assets_render_run_id_imaging_render_runs_id_fk" FOREIGN KEY ("render_run_id") REFERENCES "public"."imaging_render_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_record_labels" ADD CONSTRAINT "imaging_record_labels_record_id_imaging_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."imaging_records"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_answer_options" ADD CONSTRAINT "imaging_answer_options_taxonomy_id_imaging_answer_taxonomies_id_fk" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."imaging_answer_taxonomies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_attempts" ADD CONSTRAINT "imaging_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_attempts" ADD CONSTRAINT "imaging_attempts_record_id_imaging_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."imaging_records"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_attempts" ADD CONSTRAINT "imaging_attempts_taxonomy_id_imaging_answer_taxonomies_id_fk" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."imaging_answer_taxonomies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "imaging_interpretations" ADD CONSTRAINT "imaging_interpretations_attempt_id_imaging_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."imaging_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "imaging_datasets_key_version_unique" ON "imaging_datasets" USING btree ("dataset_key", "version");--> statement-breakpoint
CREATE INDEX "imaging_datasets_modality_published_idx" ON "imaging_datasets" USING btree ("modality", "published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "imaging_dataset_documents_dataset_storage_unique" ON "imaging_dataset_documents" USING btree ("dataset_id", "storage_key");--> statement-breakpoint
CREATE INDEX "imaging_dataset_documents_dataset_kind_idx" ON "imaging_dataset_documents" USING btree ("dataset_id", "document_kind");--> statement-breakpoint
CREATE INDEX "imaging_import_runs_dataset_status_started_idx" ON "imaging_import_runs" USING btree ("dataset_id", "status", "started_at");--> statement-breakpoint
CREATE INDEX "imaging_import_runs_dataset_manifest_idx" ON "imaging_import_runs" USING btree ("dataset_id", "manifest_checksum");--> statement-breakpoint
CREATE INDEX "imaging_render_runs_dataset_status_started_idx" ON "imaging_render_runs" USING btree ("dataset_id", "status", "started_at");--> statement-breakpoint
CREATE INDEX "imaging_render_runs_import_run_idx" ON "imaging_render_runs" USING btree ("import_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "imaging_records_dataset_source_record_unique" ON "imaging_records" USING btree ("dataset_id", "source_record_id");--> statement-breakpoint
CREATE INDEX "imaging_records_catalog_idx" ON "imaging_records" USING btree ("modality", "availability", "published_at");--> statement-breakpoint
CREATE INDEX "imaging_records_dataset_import_idx" ON "imaging_records" USING btree ("dataset_id", "import_run_id");--> statement-breakpoint
CREATE INDEX "imaging_records_subject_key_idx" ON "imaging_records" USING btree ("dataset_id", "source_subject_key");--> statement-breakpoint
CREATE UNIQUE INDEX "imaging_record_assets_version_unique" ON "imaging_record_assets" USING btree ("record_id", "asset_role", "renderer_version", "render_profile");--> statement-breakpoint
CREATE UNIQUE INDEX "imaging_record_assets_one_published_display_image_unique" ON "imaging_record_assets" USING btree ("record_id") WHERE "imaging_record_assets"."asset_role" = 'display_image' AND "imaging_record_assets"."published_at" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "imaging_record_assets_record_role_published_idx" ON "imaging_record_assets" USING btree ("record_id", "asset_role", "published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "imaging_record_labels_record_source_key_unique" ON "imaging_record_labels" USING btree ("record_id", "source_label_key");--> statement-breakpoint
CREATE INDEX "imaging_record_labels_record_primary_idx" ON "imaging_record_labels" USING btree ("record_id", "is_primary");--> statement-breakpoint
CREATE UNIQUE INDEX "imaging_answer_taxonomies_modality_version_unique" ON "imaging_answer_taxonomies" USING btree ("modality", "version");--> statement-breakpoint
CREATE INDEX "imaging_answer_taxonomies_modality_status_idx" ON "imaging_answer_taxonomies" USING btree ("modality", "status", "published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "imaging_answer_options_taxonomy_option_key_unique" ON "imaging_answer_options" USING btree ("taxonomy_id", "option_key");--> statement-breakpoint
CREATE INDEX "imaging_answer_options_taxonomy_active_order_idx" ON "imaging_answer_options" USING btree ("taxonomy_id", "active", "sort_order");--> statement-breakpoint
CREATE INDEX "imaging_attempts_student_status_updated_idx" ON "imaging_attempts" USING btree ("student_id", "status", "updated_at");--> statement-breakpoint
CREATE INDEX "imaging_attempts_student_record_idx" ON "imaging_attempts" USING btree ("student_id", "record_id");--> statement-breakpoint
CREATE INDEX "imaging_interpretations_created_idx" ON "imaging_interpretations" USING btree ("created_at");
