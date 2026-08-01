-- CreateTable
CREATE TABLE "learning_project_admin_ai_reviews" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "review_schema_version" INTEGER NOT NULL DEFAULT 1,
    "content_fingerprint" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "coverage" JSONB NOT NULL,
    "review" JSONB NOT NULL,
    "generated_by_admin_user_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_project_admin_ai_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_project_admin_ai_reviews_project_id_idx" ON "learning_project_admin_ai_reviews"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_project_admin_ai_reviews_project_id_locale_key" ON "learning_project_admin_ai_reviews"("project_id", "locale");

-- AddForeignKey
ALTER TABLE "learning_project_admin_ai_reviews" ADD CONSTRAINT "learning_project_admin_ai_reviews_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_project_admin_ai_reviews" ADD CONSTRAINT "learning_project_admin_ai_reviews_generated_by_admin_user_id_fkey" FOREIGN KEY ("generated_by_admin_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;