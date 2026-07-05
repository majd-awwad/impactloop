CREATE TABLE "project_follows" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_follows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_follows_project_id_user_id_key" ON "project_follows"("project_id", "user_id");
CREATE INDEX "project_follows_project_id_idx" ON "project_follows"("project_id");
CREATE INDEX "project_follows_user_id_idx" ON "project_follows"("user_id");

ALTER TABLE "project_follows" ADD CONSTRAINT "project_follows_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_follows" ADD CONSTRAINT "project_follows_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
