-- CreateEnum
CREATE TYPE "LearnerMaterialRequestStatus" AS ENUM ('OPEN', 'FULFILLED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "LearnerMaterialRequestMatchStatus" AS ENUM ('SUGGESTED', 'DISMISSED', 'RESERVATION_CREATED', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "learner_material_requests" (
    "id" TEXT NOT NULL,
    "learner_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "requested_item_name" TEXT NOT NULL,
    "normalized_requested_item_name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "alternatives_allowed" BOOLEAN NOT NULL DEFAULT true,
    "location_country" TEXT NOT NULL,
    "location_city" TEXT NOT NULL,
    "location_area" TEXT,
    "source_saved_location_id" TEXT,
    "project_id" TEXT,
    "project_build_id" TEXT,
    "project_build_item_id" TEXT,
    "status" "LearnerMaterialRequestStatus" NOT NULL DEFAULT 'OPEN',
    "needed_by" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "fulfilled_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_material_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_material_request_matches" (
    "id" TEXT NOT NULL,
    "material_request_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "supplier_user_id" TEXT NOT NULL,
    "status" "LearnerMaterialRequestMatchStatus" NOT NULL DEFAULT 'SUGGESTED',
    "match_reason_code" TEXT,
    "ranking_score" INTEGER,
    "reservation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learner_material_request_matches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learner_material_requests_learner_id_status_idx" ON "learner_material_requests"("learner_id", "status");

-- CreateIndex
CREATE INDEX "learner_material_requests_status_expires_at_idx" ON "learner_material_requests"("status", "expires_at");

-- CreateIndex
CREATE INDEX "learner_material_requests_category_id_idx" ON "learner_material_requests"("category_id");

-- CreateIndex
CREATE INDEX "learner_material_requests_normalized_requested_item_name_lea_idx" ON "learner_material_requests"("normalized_requested_item_name", "learner_id", "status");

-- CreateIndex
CREATE INDEX "learner_material_requests_location_city_idx" ON "learner_material_requests"("location_city");

-- CreateIndex
CREATE INDEX "learner_material_requests_source_saved_location_id_idx" ON "learner_material_requests"("source_saved_location_id");

-- CreateIndex
CREATE INDEX "learner_material_requests_project_id_idx" ON "learner_material_requests"("project_id");

-- CreateIndex
CREATE INDEX "learner_material_requests_project_build_id_idx" ON "learner_material_requests"("project_build_id");

-- CreateIndex
CREATE INDEX "learner_material_requests_project_build_item_id_idx" ON "learner_material_requests"("project_build_item_id");

-- CreateIndex
CREATE INDEX "learner_material_request_matches_supplier_user_id_status_idx" ON "learner_material_request_matches"("supplier_user_id", "status");

-- CreateIndex
CREATE INDEX "learner_material_request_matches_material_request_id_status_idx" ON "learner_material_request_matches"("material_request_id", "status");

-- CreateIndex
CREATE INDEX "learner_material_request_matches_reservation_id_idx" ON "learner_material_request_matches"("reservation_id");

-- CreateIndex
CREATE UNIQUE INDEX "learner_material_request_matches_material_request_id_materi_key" ON "learner_material_request_matches"("material_request_id", "material_id");

-- AddForeignKey
ALTER TABLE "learner_material_requests" ADD CONSTRAINT "learner_material_requests_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_material_requests" ADD CONSTRAINT "learner_material_requests_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_material_requests" ADD CONSTRAINT "learner_material_requests_source_saved_location_id_fkey" FOREIGN KEY ("source_saved_location_id") REFERENCES "user_saved_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_material_requests" ADD CONSTRAINT "learner_material_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "learning_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_material_requests" ADD CONSTRAINT "learner_material_requests_project_build_id_fkey" FOREIGN KEY ("project_build_id") REFERENCES "project_builds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_material_requests" ADD CONSTRAINT "learner_material_requests_project_build_item_id_fkey" FOREIGN KEY ("project_build_item_id") REFERENCES "project_build_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_material_request_matches" ADD CONSTRAINT "learner_material_request_matches_material_request_id_fkey" FOREIGN KEY ("material_request_id") REFERENCES "learner_material_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_material_request_matches" ADD CONSTRAINT "learner_material_request_matches_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_material_request_matches" ADD CONSTRAINT "learner_material_request_matches_supplier_user_id_fkey" FOREIGN KEY ("supplier_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_material_request_matches" ADD CONSTRAINT "learner_material_request_matches_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
