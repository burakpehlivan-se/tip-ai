-- Synthea DB: sentetik hasta verisinin ilişkisel kopyası.
-- Kaynak: data/raw/synthea/*.csv (scripts/load-synthea.ts ile yüklenir).
-- Synthea verisi tamamen sentetiktir; gerçek kişi/PHI içermez.
CREATE TABLE "synthea_patients" (
	"id" text PRIMARY KEY NOT NULL,
	"birthdate" timestamp with time zone,
	"deathdate" timestamp with time zone,
	"first" text,
	"last" text,
	"gender" text NOT NULL,
	"race" text,
	"ethnicity" text,
	"marital" text,
	"city" text,
	"state" text,
	"zip" text
);
--> statement-breakpoint
CREATE INDEX "synthea_patients_gender_idx" ON "synthea_patients" USING btree ("gender");
--> statement-breakpoint
CREATE TABLE "synthea_conditions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"start" timestamp with time zone,
	"stop" timestamp with time zone,
	"code" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "synthea_conditions_patient_idx" ON "synthea_conditions" USING btree ("patient_id");
--> statement-breakpoint
CREATE INDEX "synthea_conditions_code_idx" ON "synthea_conditions" USING btree ("code");
--> statement-breakpoint
CREATE TABLE "synthea_observations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"date" timestamp with time zone,
	"category" text,
	"code" text NOT NULL,
	"description" text,
	"value" text,
	"value_num" double precision,
	"units" text,
	"type" text
);
--> statement-breakpoint
CREATE INDEX "synthea_observations_patient_idx" ON "synthea_observations" USING btree ("patient_id");
--> statement-breakpoint
CREATE INDEX "synthea_observations_code_idx" ON "synthea_observations" USING btree ("code");
--> statement-breakpoint
CREATE TABLE "synthea_medications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"start" timestamp with time zone,
	"stop" timestamp with time zone,
	"code" text,
	"description" text,
	"reason_code" text,
	"reason_description" text
);
--> statement-breakpoint
CREATE INDEX "synthea_medications_patient_idx" ON "synthea_medications" USING btree ("patient_id");
--> statement-breakpoint
CREATE INDEX "synthea_medications_code_idx" ON "synthea_medications" USING btree ("code");
--> statement-breakpoint
CREATE TABLE "synthea_procedures" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"start" timestamp with time zone,
	"stop" timestamp with time zone,
	"code" text,
	"description" text,
	"reason_code" text,
	"reason_description" text
);
--> statement-breakpoint
CREATE INDEX "synthea_procedures_patient_idx" ON "synthea_procedures" USING btree ("patient_id");
--> statement-breakpoint
CREATE INDEX "synthea_procedures_code_idx" ON "synthea_procedures" USING btree ("code");
--> statement-breakpoint
CREATE TABLE "synthea_encounters" (
	"id" text PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"start" timestamp with time zone,
	"stop" timestamp with time zone,
	"encounter_class" text,
	"code" text,
	"description" text,
	"reason_code" text,
	"reason_description" text
);
--> statement-breakpoint
CREATE INDEX "synthea_encounters_patient_idx" ON "synthea_encounters" USING btree ("patient_id");
--> statement-breakpoint
CREATE INDEX "synthea_encounters_class_idx" ON "synthea_encounters" USING btree ("encounter_class");
--> statement-breakpoint
CREATE TABLE "synthea_imaging_studies" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"patient_id" text NOT NULL,
	"encounter_id" text,
	"date" timestamp with time zone,
	"bodysite_code" text,
	"bodysite_description" text,
	"modality_code" text,
	"modality_description" text,
	"procedure_code" text
);
--> statement-breakpoint
CREATE INDEX "synthea_imaging_studies_patient_idx" ON "synthea_imaging_studies" USING btree ("patient_id");
--> statement-breakpoint
ALTER TABLE "synthea_conditions" ADD CONSTRAINT "synthea_conditions_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_observations" ADD CONSTRAINT "synthea_observations_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_medications" ADD CONSTRAINT "synthea_medications_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_procedures" ADD CONSTRAINT "synthea_procedures_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_encounters" ADD CONSTRAINT "synthea_encounters_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "synthea_imaging_studies" ADD CONSTRAINT "synthea_imaging_studies_patient_id_synthea_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "synthea_patients"("id") ON DELETE cascade ON UPDATE no action;
