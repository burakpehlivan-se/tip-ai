-- FHIR kaynakları idempotent içe aktarılır. Kaynak kimliği ham klinik veriyi
-- içermez: FHIR id'si veya yükleyicinin ürettiği SHA-256 özeti saklanır.
ALTER TABLE "synthea_conditions" ADD COLUMN "source_id" text;
--> statement-breakpoint
ALTER TABLE "synthea_observations" ADD COLUMN "source_id" text;
--> statement-breakpoint
ALTER TABLE "synthea_medications" ADD COLUMN "source_id" text;
--> statement-breakpoint
ALTER TABLE "synthea_procedures" ADD COLUMN "source_id" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "synthea_conditions_source_id_unique" ON "synthea_conditions" USING btree ("source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "synthea_observations_source_id_unique" ON "synthea_observations" USING btree ("source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "synthea_medications_source_id_unique" ON "synthea_medications" USING btree ("source_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "synthea_procedures_source_id_unique" ON "synthea_procedures" USING btree ("source_id");
