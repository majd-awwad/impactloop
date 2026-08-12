ALTER TABLE "project_help_sessions"
ADD COLUMN "auto_finalize_at" TIMESTAMP(3);

UPDATE "project_help_sessions" AS session
SET "auto_finalize_at" =
  selected_option."starts_at"
  + (session."duration_minutes" * INTERVAL '1 minute')
  + INTERVAL '24 hours'
FROM "project_help_session_time_options" AS selected_option
WHERE session."selected_time_option_id" = selected_option."id"
  AND session."status" = 'SCHEDULED'
  AND session."auto_finalize_at" IS NULL;

CREATE INDEX "project_help_sessions_status_auto_finalize_at_idx"
ON "project_help_sessions"("status", "auto_finalize_at");
