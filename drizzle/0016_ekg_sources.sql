-- EKG kaynağı: sentetik vaka → gerçek PTB-XL EKG kaydı eşlemesi.
-- Tanı (SCP kodu) + yaş + cinsiyet üzerinden deterministik eşleştirilir;
-- ham sinyal DB'de tutulmaz, render edilmiş PNG dosya indeksi saklanır.
--
-- Not: case_id, clinical_cases'a FK bağlamaz. EKG vakaları (kardiyoloji::stemi
-- vb.) JSON case store'da yaşar; clinical_cases yalnızca synthea üretimi
-- vakaları içerir. FK olsaydı JSON store vakalarına eşleme kırılırdı.
CREATE TABLE "ekg_sources" (
	"case_id" text PRIMARY KEY NOT NULL,
	"ecg_id" integer NOT NULL,
	"image_index" text NOT NULL,
	"scp_codes" jsonb,
	"finding_label" text NOT NULL,
	"source" text DEFAULT 'ptbxl' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ekg_sources_image_idx" ON "ekg_sources" USING btree ("image_index");
