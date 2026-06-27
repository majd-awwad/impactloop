-- CreateEnum
CREATE TYPE "ProjectDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "LearningProjectStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectComponentRole" AS ENUM ('REQUIRED_MATERIAL', 'OPTIONAL_MATERIAL', 'TOOL', 'CONSUMABLE', 'ALTERNATIVE');

-- CreateEnum
CREATE TYPE "ProjectReviewStatus" AS ENUM ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProjectLinkType" AS ENUM ('YOUTUBE', 'GITHUB', 'ARTICLE', 'PDF', 'OTHER');

-- CreateTable
CREATE TABLE "learning_projects" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "short_description" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "ProjectDifficulty" NOT NULL,
    "estimated_duration_minutes" INTEGER,
    "cover_image_url" TEXT,
    "status" "LearningProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewed_by" TEXT,
    "review_note" TEXT,
    "steps_generated_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "ai_steps_generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_images" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_required_components" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "category_id" TEXT,
    "component_name" TEXT NOT NULL,
    "material_type" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "component_role" "ProjectComponentRole" NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "can_be_substituted" BOOLEAN NOT NULL DEFAULT false,
    "search_keywords" JSONB,
    "alternative_keywords" JSONB,
    "provided_by_user" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by_user" BOOLEAN NOT NULL DEFAULT false,
    "generated_or_suggested_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "review_status" "ProjectReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_required_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_steps" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "step_number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "generated_by_ai" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "review_status" "ProjectReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_links" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "link_type" "ProjectLinkType" NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "source_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_tags" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_tags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_projects_category_id_idx" ON "learning_projects"("category_id");

-- CreateIndex
CREATE INDEX "learning_projects_created_by_idx" ON "learning_projects"("created_by");

-- CreateIndex
CREATE INDEX "learning_projects_reviewed_by_idx" ON "learning_projects"("reviewed_by");

-- CreateIndex
CREATE INDEX "learning_projects_status_created_at_idx" ON "learning_projects"("status", "created_at");

-- CreateIndex
CREATE INDEX "project_images_project_id_idx" ON "project_images"("project_id");

-- CreateIndex
CREATE INDEX "project_required_components_project_id_idx" ON "project_required_components"("project_id");

-- CreateIndex
CREATE INDEX "project_required_components_category_id_idx" ON "project_required_components"("category_id");

-- CreateIndex
CREATE INDEX "project_required_components_review_status_idx" ON "project_required_components"("review_status");

-- CreateIndex
CREATE INDEX "project_steps_project_id_idx" ON "project_steps"("project_id");

-- CreateIndex
CREATE INDEX "project_steps_approved_by_idx" ON "project_steps"("approved_by");

-- CreateIndex
CREATE INDEX "project_steps_review_status_idx" ON "project_steps"("review_status");

-- CreateIndex
CREATE UNIQUE INDEX "project_steps_project_id_step_number_key" ON "project_steps"("project_id", "step_number");

-- CreateIndex
CREATE INDEX "project_links_project_id_idx" ON "project_links"("project_id");

-- CreateIndex
CREATE INDEX "project_tags_project_id_idx" ON "project_tags"("project_id");

-- CreateIndex
CREATE INDEX "project_tags_tag_idx" ON "project_tags"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "project_tags_project_id_tag_key" ON "project_tags"("project_id", "tag");

-- AddForeignKey
ALTER TABLE "learning_projects" ADD CONSTRAINT "learning_projects_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_projects" ADD CONSTRAINT "learning_projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_projects" ADD CONSTRAINT "learning_projects_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_images" ADD CONSTRAINT "project_images_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_required_components" ADD CONSTRAINT "project_required_components_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_required_components" ADD CONSTRAINT "project_required_components_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_steps" ADD CONSTRAINT "project_steps_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_links" ADD CONSTRAINT "project_links_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_tags" ADD CONSTRAINT "project_tags_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
