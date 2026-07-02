-- AlterTable
ALTER TABLE "supplier_profiles" ADD COLUMN     "avatar_image_url" TEXT,
ADD COLUMN     "cover_image_url" TEXT;

-- CreateTable
CREATE TABLE "supplier_followers" (
    "id" TEXT NOT NULL,
    "supplier_profile_id" TEXT NOT NULL,
    "follower_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_followers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_likes" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_views" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "viewer_user_id" TEXT,
    "view_source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_followers_supplier_profile_id_idx" ON "supplier_followers"("supplier_profile_id");

-- CreateIndex
CREATE INDEX "supplier_followers_follower_user_id_idx" ON "supplier_followers"("follower_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_followers_supplier_profile_id_follower_user_id_key" ON "supplier_followers"("supplier_profile_id", "follower_user_id");

-- CreateIndex
CREATE INDEX "material_likes_material_id_idx" ON "material_likes"("material_id");

-- CreateIndex
CREATE INDEX "material_likes_user_id_idx" ON "material_likes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_likes_material_id_user_id_key" ON "material_likes"("material_id", "user_id");

-- CreateIndex
CREATE INDEX "material_views_material_id_idx" ON "material_views"("material_id");

-- CreateIndex
CREATE INDEX "material_views_viewer_user_id_idx" ON "material_views"("viewer_user_id");

-- AddForeignKey
ALTER TABLE "supplier_followers" ADD CONSTRAINT "supplier_followers_supplier_profile_id_fkey" FOREIGN KEY ("supplier_profile_id") REFERENCES "supplier_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_followers" ADD CONSTRAINT "supplier_followers_follower_user_id_fkey" FOREIGN KEY ("follower_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_likes" ADD CONSTRAINT "material_likes_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_likes" ADD CONSTRAINT "material_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_views" ADD CONSTRAINT "material_views_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_views" ADD CONSTRAINT "material_views_viewer_user_id_fkey" FOREIGN KEY ("viewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
