-- Additive canonical notification contract. Existing columns remain for
-- backwards compatibility with generic notification consumers.
ALTER TABLE "notifications"
  ADD COLUMN "read_at" TIMESTAMP(3),
  ADD COLUMN "event_key" TEXT,
  ADD COLUMN "entity_type" TEXT,
  ADD COLUMN "entity_id" TEXT,
  ADD COLUMN "action_type" TEXT,
  ADD COLUMN "metadata" JSONB,
  ADD COLUMN "resolved_at" TIMESTAMP(3),
  ADD COLUMN "actor_id" TEXT;

CREATE UNIQUE INDEX "notifications_event_key_key"
  ON "notifications"("event_key");

CREATE INDEX "notifications_user_id_created_at_id_idx"
  ON "notifications"("user_id", "created_at" DESC, "id" DESC);

CREATE INDEX "notifications_user_id_entity_type_entity_id_idx"
  ON "notifications"("user_id", "entity_type", "entity_id");
