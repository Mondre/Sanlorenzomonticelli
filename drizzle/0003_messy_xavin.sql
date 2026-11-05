CREATE TABLE "request_privacy_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"controller_name" text NOT NULL,
	"controller_address" text NOT NULL,
	"contact_email" text NOT NULL,
	"body" text NOT NULL,
	"retention_days" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "privacy_retention_days" CHECK ("request_privacy_versions"."retention_days" BETWEEN 30 AND 365)
);
--> statement-breakpoint
CREATE TABLE "request_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_started" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registration_requests" ADD COLUMN "privacy_record_id" uuid;--> statement-breakpoint
ALTER TABLE "registration_requests" ADD COLUMN "submission_key" text;--> statement-breakpoint
ALTER TABLE "registration_requests" ADD COLUMN "updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "request_rate_expiry_idx" ON "request_rate_limits" USING btree ("window_started");--> statement-breakpoint
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_privacy_record_id_request_privacy_versions_id_fk" FOREIGN KEY ("privacy_record_id") REFERENCES "public"."request_privacy_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registration_requests" ADD CONSTRAINT "registration_requests_submission_key_unique" UNIQUE("submission_key");