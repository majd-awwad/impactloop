-- Existing meetings remain on the legacy generic-join path. New provisioning
-- explicitly opts sessions into participant registration after this migration.
ALTER TABLE "project_help_sessions"
ADD COLUMN "zoom_registration_required" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "zoom_learner_registrant_id" TEXT,
ADD COLUMN "zoom_learner_join_url" TEXT,
ADD COLUMN "zoom_learner_registered_at" TIMESTAMP(3);
