-- CreateTable
CREATE TABLE "project_build_step_progress" (
    "id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "project_step_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_build_step_progress_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ai_conversations" ADD COLUMN "project_build_id" TEXT;

-- CreateIndex
CREATE INDEX "project_build_step_progress_build_id_idx" ON "project_build_step_progress"("build_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_build_step_progress_build_id_project_step_id_key" ON "project_build_step_progress"("build_id", "project_step_id");

-- CreateIndex
CREATE INDEX "project_build_step_progress_project_step_id_idx" ON "project_build_step_progress"("project_step_id");

-- CreateIndex
CREATE INDEX "ai_conversations_project_build_id_idx" ON "ai_conversations"("project_build_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_conversations_user_id_project_build_id_key" ON "ai_conversations"("user_id", "project_build_id");

-- AddForeignKey
ALTER TABLE "project_build_step_progress" ADD CONSTRAINT "project_build_step_progress_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "project_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_build_step_progress" ADD CONSTRAINT "project_build_step_progress_project_step_id_fkey" FOREIGN KEY ("project_step_id") REFERENCES "project_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_project_build_id_fkey" FOREIGN KEY ("project_build_id") REFERENCES "project_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
