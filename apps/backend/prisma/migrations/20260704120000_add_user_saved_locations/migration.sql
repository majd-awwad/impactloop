-- CreateTable
CREATE TABLE "user_saved_locations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_saved_locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_saved_locations_user_id_idx" ON "user_saved_locations"("user_id");

-- AddForeignKey
ALTER TABLE "user_saved_locations" ADD CONSTRAINT "user_saved_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_saved_locations" ADD CONSTRAINT "user_saved_locations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
