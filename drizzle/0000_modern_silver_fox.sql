CREATE TYPE "public"."contact_status" AS ENUM('new', 'approved', 'rejected', 'enrolled', 'replied', 'opted_out');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"title" text NOT NULL,
	"company_name" text NOT NULL,
	"company_size" integer,
	"company_location" text,
	"industry" text,
	"status" "contact_status" DEFAULT 'new' NOT NULL,
	"apollo_id" text,
	"current_phase_id" uuid,
	"enrolled_at" timestamp,
	"replied_at" timestamp,
	"opted_out_at" timestamp,
	"open_count" integer DEFAULT 0 NOT NULL,
	"last_opened_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"direction" "message_direction" NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"resend_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_id" uuid NOT NULL,
	"phase_number" integer NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"delay_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"phase_id" uuid NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"resend_id" text
);
--> statement-breakpoint
CREATE TABLE "sequences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"daily_limit" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
