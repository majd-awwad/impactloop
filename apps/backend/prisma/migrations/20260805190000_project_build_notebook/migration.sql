-- CreateTable
CREATE TABLE "project_build_notebooks" (
    "id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_build_notebooks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_build_notebooks_build_id_key" ON "project_build_notebooks"("build_id");

-- AddForeignKey
ALTER TABLE "project_build_notebooks" ADD CONSTRAINT "project_build_notebooks_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "project_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
