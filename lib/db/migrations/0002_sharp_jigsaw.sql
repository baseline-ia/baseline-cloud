CREATE TABLE IF NOT EXISTS "corporate_skill_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"version" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"published_by_user_id" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "corporate_skills" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tool" text,
	"fail_closed" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "corporate_skills_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_skill_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"project_slug" text NOT NULL,
	"skill_id" text NOT NULL,
	"version_id" text,
	"fail_closed" boolean DEFAULT false NOT NULL,
	"assigned_by_user_id" text,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "corporate_skill_versions" ADD CONSTRAINT "corporate_skill_versions_skill_id_corporate_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."corporate_skills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "corporate_skill_versions" ADD CONSTRAINT "corporate_skill_versions_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "corporate_skills" ADD CONSTRAINT "corporate_skills_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_skill_assignments" ADD CONSTRAINT "project_skill_assignments_project_slug_projects_slug_fk" FOREIGN KEY ("project_slug") REFERENCES "public"."projects"("slug") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_skill_assignments" ADD CONSTRAINT "project_skill_assignments_skill_id_corporate_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."corporate_skills"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_skill_assignments" ADD CONSTRAINT "project_skill_assignments_version_id_corporate_skill_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."corporate_skill_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "project_skill_assignments" ADD CONSTRAINT "project_skill_assignments_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_skill_version" ON "corporate_skill_versions" USING btree ("skill_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_project_skill" ON "project_skill_assignments" USING btree ("project_slug","skill_id");