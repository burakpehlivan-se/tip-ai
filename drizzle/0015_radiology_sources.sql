-- Göğüs röntgeni kaynağı: sentetik vaka → gerçek ChestX-ray14 görüntüsü eşlemesi.
-- Bulgu etiketi + yaş + cinsiyet üzerinden deterministik eşleştirilir; ham
-- görüntü DB'de tutulmaz, yalnızca dosya indeksi saklanır.
CREATE TABLE "radiology_sources" (
	"case_id" text PRIMARY KEY NOT NULL,
	"image_index" text NOT NULL,
	"finding_label" text NOT NULL,
	"source" text DEFAULT 'chestxray14' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "radiology_sources" ADD CONSTRAINT "radiology_sources_case_id_clinical_cases_case_id_fk" FOREIGN KEY ("case_id") REFERENCES "clinical_cases"("case_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "radiology_sources_image_idx" ON "radiology_sources" USING btree ("image_index");
