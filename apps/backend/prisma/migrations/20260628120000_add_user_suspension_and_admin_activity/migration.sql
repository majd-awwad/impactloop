-- AlterTable
ALTER TABLE "users" ADD COLUMN "suspension_reason" TEXT,
ADD COLUMN "suspended_at" TIMESTAMP(3),
ADD COLUMN "suspended_by_id" TEXT,
ADD COLUMN "reactivated_at" TIMESTAMP(3),
ADD COLUMN "reactivated_by_id" TEXT;

-- CreateTable
CREATE TABLE "admin_activity_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "target_label" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "users_suspended_by_id_idx" ON "users"("suspended_by_id");

-- CreateIndex
CREATE INDEX "users_reactivated_by_id_idx" ON "users"("reactivated_by_id");

-- CreateIndex
CREATE INDEX "admin_activity_logs_created_at_idx" ON "admin_activity_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_activity_logs_actor_user_id_idx" ON "admin_activity_logs"("actor_user_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_suspended_by_id_fkey" FOREIGN KEY ("suspended_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_reactivated_by_id_fkey" FOREIGN KEY ("reactivated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_activity_logs" ADD CONSTRAINT "admin_activity_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
