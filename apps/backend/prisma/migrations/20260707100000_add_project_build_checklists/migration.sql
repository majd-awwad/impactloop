-- CreateEnum
CREATE TYPE "ProjectBuildStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectBuildItemStatus" AS ENUM ('MISSING', 'ALREADY_OWNED', 'AVAILABLE', 'RESERVED', 'ALTERNATIVE');

-- CreateTable
CREATE TABLE "project_builds" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "status" "ProjectBuildStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_builds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_build_items" (
    "id" TEXT NOT NULL,
    "build_id" TEXT NOT NULL,
    "required_component_id" TEXT NOT NULL,
    "status" "ProjectBuildItemStatus" NOT NULL DEFAULT 'MISSING',
    "learner_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_build_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_builds_project_id_learner_id_key" ON "project_builds"("project_id", "learner_id");

-- CreateIndex
CREATE INDEX "project_builds_learner_id_idx" ON "project_builds"("learner_id");

-- CreateIndex
CREATE INDEX "project_builds_project_id_idx" ON "project_builds"("project_id");

-- CreateIndex
CREATE INDEX "project_builds_status_idx" ON "project_builds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "project_build_items_build_id_required_component_id_key" ON "project_build_items"("build_id", "required_component_id");

-- CreateIndex
CREATE INDEX "project_build_items_build_id_idx" ON "project_build_items"("build_id");

-- CreateIndex
CREATE INDEX "project_build_items_required_component_id_idx" ON "project_build_items"("required_component_id");

-- CreateIndex
CREATE INDEX "project_build_items_status_idx" ON "project_build_items"("status");

-- AddForeignKey
ALTER TABLE "project_builds" ADD CONSTRAINT "project_builds_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_builds" ADD CONSTRAINT "project_builds_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_build_items" ADD CONSTRAINT "project_build_items_build_id_fkey" FOREIGN KEY ("build_id") REFERENCES "project_builds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_build_items" ADD CONSTRAINT "project_build_items_required_component_id_fkey" FOREIGN KEY ("required_component_id") REFERENCES "project_required_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;
