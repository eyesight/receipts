ALTER TABLE "recipes" ADD COLUMN "created_by" varchar;--> statement-breakpoint
CREATE INDEX "recipes_created_by_idx" ON "recipes" USING btree ("created_by");