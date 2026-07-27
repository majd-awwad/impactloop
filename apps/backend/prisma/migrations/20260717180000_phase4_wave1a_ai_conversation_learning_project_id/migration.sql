-- AlterTable
ALTER TABLE "ai_conversations" ADD COLUMN "learning_project_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ai_conversations_learning_project_id_key" ON "ai_conversations"("learning_project_id");

-- CreateIndex
CREATE INDEX "ai_conversations_learning_project_id_idx" ON "ai_conversations"("learning_project_id");

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_mode_idx" ON "ai_conversations"("user_id", "mode");

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_learning_project_id_fkey" FOREIGN KEY ("learning_project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;