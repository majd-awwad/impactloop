CREATE TABLE "project_likes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_likes_project_id_user_id_key" ON "project_likes"("project_id", "user_id");
CREATE INDEX "project_likes_project_id_idx" ON "project_likes"("project_id");
CREATE INDEX "project_likes_user_id_idx" ON "project_likes"("user_id");

ALTER TABLE "project_likes"
ADD CONSTRAINT "project_likes_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_likes"
ADD CONSTRAINT "project_likes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
