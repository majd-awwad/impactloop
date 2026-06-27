-- CreateEnum
CREATE TYPE "MaterialCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'USED', 'NEEDS_REPAIR');

-- CreateEnum
CREATE TYPE "MaterialSourceType" AS ENUM ('STUDENT_LEFTOVER', 'WORKSHOP_SURPLUS', 'FACTORY_SURPLUS', 'EDUCATIONAL_INSTITUTION');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('AVAILABLE', 'PENDING_RESERVATION', 'RESERVED', 'REUSED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "CategoryType" AS ENUM ('MATERIAL', 'PROJECT', 'BOTH');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('WORKSHOP', 'FACTORY', 'EDUCATIONAL_INSTITUTION');

-- CreateEnum
CREATE TYPE "VerificationDocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PickupType" AS ENUM ('SELF_PICKUP', 'DELIVERY_ALLOWED');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('WAITING_FOR_DRIVER', 'DRIVER_ASSIGNED', 'PICKED_UP', 'ON_THE_WAY', 'DELIVERED', 'CANCELLED', 'FAILED_PICKUP');

-- CreateEnum
CREATE TYPE "ReviewTargetType" AS ENUM ('SUPPLIER', 'DRIVER', 'MATERIAL');

-- CreateTable
CREATE TABLE "organization_profiles" (
    "id" TEXT NOT NULL,
    "supplier_profile_id" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "organization_type" "OrganizationType" NOT NULL,
    "contact_person_name" TEXT,
    "working_days" JSONB,
    "working_hours" JSONB,
    "business_location_id" TEXT,
    "verification_document_status" "VerificationDocumentStatus",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "parent_id" TEXT,
    "category_type" "CategoryType" NOT NULL,
    "icon_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "supplier_profile_id" TEXT,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "material_type" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "condition" "MaterialCondition" NOT NULL,
    "source_type" "MaterialSourceType" NOT NULL,
    "status" "MaterialStatus" NOT NULL DEFAULT 'AVAILABLE',
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'NIS',
    "location_id" TEXT NOT NULL,
    "pickup_allowed" BOOLEAN NOT NULL DEFAULT true,
    "delivery_allowed" BOOLEAN NOT NULL DEFAULT false,
    "pickup_notes" TEXT,
    "suggested_uses" TEXT,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "reused_at" TIMESTAMP(3),
    "reused_by_reservation_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_images" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "requester_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "quantity_requested" DECIMAL(12,3) NOT NULL,
    "message" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "pickup_window_start" TIMESTAMP(3),
    "pickup_window_end" TIMESTAMP(3),
    "pickup_type" "PickupType" NOT NULL DEFAULT 'SELF_PICKUP',
    "supplier_note" TEXT,
    "delivery_requested" BOOLEAN NOT NULL DEFAULT false,
    "delivery_status" "DeliveryStatus",
    "delivery_cost" DECIMAL(12,2),
    "dropoff_location_id" TEXT,
    "driver_profile_id" TEXT,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "reviewed_user_id" TEXT,
    "target_type" "ReviewTargetType" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "notification_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "related_entity_type" TEXT,
    "related_entity_id" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_profiles_supplier_profile_id_key" ON "organization_profiles"("supplier_profile_id");

-- CreateIndex
CREATE INDEX "organization_profiles_business_location_id_idx" ON "organization_profiles"("business_location_id");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "materials_reused_by_reservation_id_key" ON "materials"("reused_by_reservation_id");

-- CreateIndex
CREATE INDEX "materials_owner_id_idx" ON "materials"("owner_id");

-- CreateIndex
CREATE INDEX "materials_supplier_profile_id_idx" ON "materials"("supplier_profile_id");

-- CreateIndex
CREATE INDEX "materials_category_id_idx" ON "materials"("category_id");

-- CreateIndex
CREATE INDEX "materials_status_idx" ON "materials"("status");

-- CreateIndex
CREATE INDEX "materials_location_id_idx" ON "materials"("location_id");

-- CreateIndex
CREATE INDEX "material_images_material_id_idx" ON "material_images"("material_id");

-- CreateIndex
CREATE INDEX "reservations_owner_id_idx" ON "reservations"("owner_id");

-- CreateIndex
CREATE INDEX "reservations_requester_id_idx" ON "reservations"("requester_id");

-- CreateIndex
CREATE INDEX "reservations_material_id_idx" ON "reservations"("material_id");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reviews_reviewed_user_id_target_type_idx" ON "reviews"("reviewed_user_id", "target_type");

-- CreateIndex
CREATE INDEX "reviews_reservation_id_idx" ON "reviews"("reservation_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_supplier_profile_id_fkey" FOREIGN KEY ("supplier_profile_id") REFERENCES "supplier_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_profiles" ADD CONSTRAINT "organization_profiles_business_location_id_fkey" FOREIGN KEY ("business_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_supplier_profile_id_fkey" FOREIGN KEY ("supplier_profile_id") REFERENCES "supplier_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_reused_by_reservation_id_fkey" FOREIGN KEY ("reused_by_reservation_id") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_images" ADD CONSTRAINT "material_images_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_dropoff_location_id_fkey" FOREIGN KEY ("dropoff_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewed_user_id_fkey" FOREIGN KEY ("reviewed_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
