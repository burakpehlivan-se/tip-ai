CREATE TYPE "public"."learning_attempt_status" AS ENUM('active', 'completed', 'abandoned', 'expired');--> statement-breakpoint
CREATE TABLE "learning_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"case_id" text NOT NULL,
	"case_version" text,
	"poliklinik_key" text NOT NULL,
	"status" "learning_attempt_status" DEFAULT 'active' NOT NULL,
	"case_snapshot" jsonb NOT NULL,
	"asked_actions" jsonb NOT NULL,
	"requested_tests" jsonb NOT NULL,
	"evaluation" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "learning_attempts" ADD CONSTRAINT "learning_attempts_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_attempts_student_status_updated_idx" ON "learning_attempts" USING btree ("student_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "learning_attempts_case_id_idx" ON "learning_attempts" USING btree ("case_id");