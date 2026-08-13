ALTER TABLE "auth_sessions" ADD COLUMN "device_label" text;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "auth_sessions_user_active_idx" ON "auth_sessions" USING btree ("user_id","revoked_at","expires_at");
