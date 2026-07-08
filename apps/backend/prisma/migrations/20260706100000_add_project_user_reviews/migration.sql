CREATE TABLE "project_user_reviews" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_user_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_user_reviews_project_id_user_id_key" ON "project_user_reviews"("project_id", "user_id");
CREATE INDEX "project_user_reviews_project_id_idx" ON "project_user_reviews"("project_id");
CREATE INDEX "project_user_reviews_user_id_idx" ON "project_user_reviews"("user_id");
CREATE INDEX "project_user_reviews_project_id_created_at_idx" ON "project_user_reviews"("project_id", "created_at" DESC);

ALTER TABLE "project_user_reviews" ADD CONSTRAINT "project_user_reviews_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_user_reviews" ADD CONSTRAINT "project_user_reviews_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
