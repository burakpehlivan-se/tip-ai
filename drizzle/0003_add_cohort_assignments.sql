CREATE TABLE "cohort_case_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid NOT NULL,
	"case_id" text NOT NULL,
	"case_version" text NOT NULL,
	"title" text,
	"instructions" text,
	"due_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohort_memberships" (
	"cohort_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"added_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cohort_memberships_pkey" PRIMARY KEY("cohort_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cohort_case_assignments" ADD CONSTRAINT "cohort_case_assignments_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_case_assignments" ADD CONSTRAINT "cohort_case_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_memberships" ADD CONSTRAINT "cohort_memberships_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_memberships" ADD CONSTRAINT "cohort_memberships_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohort_memberships" ADD CONSTRAINT "cohort_memberships_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cohort_case_assignments_cohort_case_version_unique" ON "cohort_case_assignments" USING btree ("cohort_id","case_id","case_version");--> statement-breakpoint
CREATE INDEX "cohort_case_assignments_cohort_due_idx" ON "cohort_case_assignments" USING btree ("cohort_id","due_at");--> statement-breakpoint
CREATE INDEX "cohort_memberships_student_id_idx" ON "cohort_memberships" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cohorts_name_unique" ON "cohorts" USING btree ("name");--> statement-breakpoint
CREATE INDEX "cohorts_active_updated_idx" ON "cohorts" USING btree ("active","updated_at");