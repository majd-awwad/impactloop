-- AlterTable
ALTER TABLE "users" ADD COLUMN "active_role" "UserRole";

-- Backfill active_role from existing roles
UPDATE "users" u
SET "active_role" = sub.role
FROM (
  SELECT DISTINCT ON (ur.user_id)
    ur.user_id,
    ur.role
  FROM "user_roles" ur
  ORDER BY
    ur.user_id,
    CASE
      WHEN ur.is_primary = true THEN 0
      WHEN ur.role = 'ADMIN' THEN 1
      WHEN ur.role = 'DRIVER' THEN 2
      WHEN ur.role = 'MODERATOR' THEN 3
      WHEN ur.role = 'SUPPLIER' THEN 4
      WHEN ur.role = 'LEARNER' THEN 5
      ELSE 6
    END,
    ur.created_at ASC
) sub
WHERE u.id = sub.user_id
  AND u.active_role IS NULL;
