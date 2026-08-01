CREATE TABLE "project_saves" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_saves_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_saves_project_id_user_id_key" ON "project_saves"("project_id", "user_id");
CREATE INDEX "project_saves_project_id_idx" ON "project_saves"("project_id");
CREATE INDEX "project_saves_user_id_idx" ON "project_saves"("user_id");

ALTER TABLE "project_saves"
ADD CONSTRAINT "project_saves_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_saves"
ADD CONSTRAINT "project_saves_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
