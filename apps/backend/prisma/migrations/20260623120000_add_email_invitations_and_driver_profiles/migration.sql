-- CreateEnum
CREATE TYPE "RoleInvitationSendStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "TransportationType" AS ENUM ('CAR', 'MOTORCYCLE', 'BICYCLE', 'WALKING');

-- CreateEnum
CREATE TYPE "DriverProfileStatus" AS ENUM ('ACTIVE');

-- AlterTable
ALTER TABLE "role_invitations"
ADD COLUMN "send_status" "RoleInvitationSendStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "sent_at" TIMESTAMP(3),
ADD COLUMN "send_error" TEXT,
ADD COLUMN "provider_message_id" TEXT,
ADD COLUMN "revoked_at" TIMESTAMP(3),
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill updated_at for existing rows
UPDATE "role_invitations" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

-- CreateIndex
CREATE INDEX "role_invitations_send_status_idx" ON "role_invitations"("send_status");

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "address_line" TEXT,
    "transportation_type" "TransportationType" NOT NULL,
    "availability_note" TEXT,
    "status" "DriverProfileStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_user_id_key" ON "driver_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
