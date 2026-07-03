-- CreateEnum
CREATE TYPE "NoShowReportReason" AS ENUM ('LEARNER_DID_NOT_ARRIVE', 'DRIVER_DID_NOT_ARRIVE', 'NO_RESPONSE_AFTER_PICKUP_WINDOW', 'OTHER');

-- CreateEnum
CREATE TYPE "NoShowReportStatus" AS ENUM ('PENDING_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NoShowReportTargetRole" AS ENUM ('LEARNER', 'DRIVER');

-- CreateTable
CREATE TABLE "reservation_messages" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "sender_user_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "no_show_reports" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "reporter_user_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "target_role" "NoShowReportTargetRole" NOT NULL,
    "reason_code" "NoShowReportReason" NOT NULL,
    "note" TEXT,
    "pickup_window_start" TIMESTAMP(3),
    "pickup_window_end" TIMESTAMP(3),
    "status" "NoShowReportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "no_show_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_messages_reservation_id_created_at_idx" ON "reservation_messages"("reservation_id", "created_at");

-- CreateIndex
CREATE INDEX "reservation_messages_sender_user_id_idx" ON "reservation_messages"("sender_user_id");

-- CreateIndex
CREATE INDEX "no_show_reports_status_created_at_idx" ON "no_show_reports"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "no_show_reports_target_user_id_status_idx" ON "no_show_reports"("target_user_id", "status");

-- CreateIndex
CREATE INDEX "no_show_reports_reporter_user_id_idx" ON "no_show_reports"("reporter_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "no_show_reports_reservation_id_target_user_id_key" ON "no_show_reports"("reservation_id", "target_user_id");

-- AddForeignKey
ALTER TABLE "reservation_messages" ADD CONSTRAINT "reservation_messages_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_messages" ADD CONSTRAINT "reservation_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_reports" ADD CONSTRAINT "no_show_reports_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_reports" ADD CONSTRAINT "no_show_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_reports" ADD CONSTRAINT "no_show_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "no_show_reports" ADD CONSTRAINT "no_show_reports_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
