-- CreateEnum
CREATE TYPE "ReservationStatusGroup" AS ENUM ('RESERVATION', 'DELIVERY');

-- AlterTable
ALTER TABLE "reservations"
ADD COLUMN "rejection_reason" TEXT,
ADD COLUMN "accepted_at" TIMESTAMP(3),
ADD COLUMN "rejected_at" TIMESTAMP(3),
ADD COLUMN "cancelled_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "reservation_status_history" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "status_group" "ReservationStatusGroup" NOT NULL DEFAULT 'RESERVATION',
    "old_status" TEXT,
    "new_status" TEXT NOT NULL,
    "changed_by" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_status_history_reservation_id_idx" ON "reservation_status_history"("reservation_id");

-- CreateIndex
CREATE INDEX "reservation_status_history_status_group_idx" ON "reservation_status_history"("status_group");

-- CreateIndex
CREATE INDEX "reservation_status_history_changed_by_idx" ON "reservation_status_history"("changed_by");

-- AddForeignKey
ALTER TABLE "reservation_status_history" ADD CONSTRAINT "reservation_status_history_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_status_history" ADD CONSTRAINT "reservation_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
