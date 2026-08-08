-- Canonical active key for pending role invitations.
-- Cleared when an invitation is no longer active so historical rows do not block re-invites.
ALTER TABLE "role_invitations"
ADD COLUMN "active_key" TEXT;

WITH "ranked_active" AS (
  SELECT
    "id",
    'pending:' || lower(trim("target_email")) || ':' || "target_role"::text AS "key",
    ROW_NUMBER() OVER (
      PARTITION BY lower(trim("target_email")), "target_role"
      ORDER BY "created_at" DESC
    ) AS "row_number"
  FROM "role_invitations"
  WHERE "status" = 'PENDING'
    AND "used_at" IS NULL
    AND "revoked_at" IS NULL
    AND "expires_at" > NOW()
    AND "target_email" IS NOT NULL
)
UPDATE "role_invitations" AS "invitation"
SET "active_key" = "ranked_active"."key"
FROM "ranked_active"
WHERE "invitation"."id" = "ranked_active"."id"
  AND "ranked_active"."row_number" = 1;

CREATE UNIQUE INDEX "role_invitations_active_key_key"
ON "role_invitations"("active_key");
