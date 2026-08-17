-- FHIR'de bulunan ek klinik kaynaklar. Hasta kimliği, adresi, iletişim bilgisi
-- veya ham FHIR gövdesi bu tablolara yazılmaz.
CREATE TABLE "synthea_allergies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"start" timestamp with time zone,
	"stop" timestamp with time zone,
	"code" text,
	"description" text,
	"category" text,
	"clinical_status" text,
	"verification_status" text,
	CONSTRAINT "synthea_allergies_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE INDEX "synthea_allergies_patient_idx" ON "synthea_allergies" USING btree ("patient_id");
--> statement-breakpoint
CREATE TABLE "synthea_immunizations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"date" timestamp with time zone,
	"code" text,
	"description" text,
	"status" text,
	CONSTRAINT "synthea_immunizations_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE INDEX "synthea_immunizations_patient_idx" ON "synthea_immunizations" USING btree ("patient_id");
--> statement-breakpoint
CREATE TABLE "synthea_care_plans" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"start" timestamp with time zone,
	"stop" timestamp with time zone,
	"category" text,
	"code" text,
	"description" text,
	"status" text,
	CONSTRAINT "synthea_care_plans_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE INDEX "synthea_care_plans_patient_idx" ON "synthea_care_plans" USING btree ("patient_id");
--> statement-breakpoint
CREATE TABLE "synthea_diagnostic_reports" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"date" timestamp with time zone,
	"code" text,
	"description" text,
	"status" text,
	CONSTRAINT "synthea_diagnostic_reports_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE INDEX "synthea_diagnostic_reports_patient_idx" ON "synthea_diagnostic_reports" USING btree ("patient_id");
--> statement-breakpoint
CREATE TABLE "synthea_case_sources" (
	"case_id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"source" text NOT NULL DEFAULT 'synthea',
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "synthea_case_sources_patient_idx" ON "synthea_case_sources" USING btree ("patient_id");
--> statement-breakpoint
CREATE TABLE "synthea_history_access_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "synthea_history_access_audit_case_created_idx" ON "synthea_history_access_audit" USING btree ("case_id", "created_at");
--> statement-breakpoint
ALTER TABLE "synthea_allergies" ADD CONSTRAINT "synthea_allergies_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_immunizations" ADD CONSTRAINT "synthea_immunizations_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_care_plans" ADD CONSTRAINT "synthea_care_plans_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_diagnostic_reports" ADD CONSTRAINT "synthea_diagnostic_reports_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_case_sources" ADD CONSTRAINT "synthea_case_sources_case_id_clinical_cases_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "clinical_cases"("case_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_case_sources" ADD CONSTRAINT "synthea_case_sources_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_history_access_audit" ADD CONSTRAINT "synthea_history_access_audit_case_id_clinical_cases_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "clinical_cases"("case_id") ON DELETE cascade ON UPDATE no action;
