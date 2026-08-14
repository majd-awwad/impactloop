-- Slice 3 separates learner preference compatibility from operational timing
-- and records recoverable physical delivery attempts.
ALTER TYPE "DeliveryStatus" ADD VALUE 'REDELIVERY_PENDING';
ALTER TYPE "DeliveryStatus" ADD VALUE 'REDELIVERY_SCHEDULED';

CREATE TYPE "DeliveryAttemptFailureReason" AS ENUM (
  'LEARNER_UNREACHABLE',
  'LEARNER_REQUESTED_RESCHEDULE',
  'ADDRESS_OR_ACCESS_ISSUE',
  'OTHER_RETRYABLE',
  'OTHER_FINAL'
);

CREATE TYPE "DeliveryAttemptOutcome" AS ENUM (
  'FAILED_RETRYABLE',
  'FAILED_FINAL'
);

ALTER TABLE "delivery_groups"
ALTER COLUMN "window_start" DROP NOT NULL,
ALTER COLUMN "window_end" DROP NOT NULL;

ALTER TABLE "deliveries"
ADD COLUMN "schedule_occurrence" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "delivery_attempts" (
  "id" TEXT NOT NULL,
  "delivery_id" TEXT NOT NULL,
  "driver_profile_id" TEXT NOT NULL,
  "attempt_number" INTEGER NOT NULL,
  "attempted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "failure_reason" "DeliveryAttemptFailureReason" NOT NULL,
  "learner_contact_attempted" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "outcome" "DeliveryAttemptOutcome" NOT NULL,
  "retry_window_start" TIMESTAMP(3),
  "retry_window_end" TIMESTAMP(3),
  "retry_deadline" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "delivery_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "delivery_attempts_delivery_id_attempt_number_key"
ON "delivery_attempts"("delivery_id", "attempt_number");

CREATE INDEX "delivery_attempts_driver_profile_id_attempted_at_idx"
ON "delivery_attempts"("driver_profile_id", "attempted_at" DESC);

CREATE INDEX "delivery_attempts_delivery_id_attempted_at_idx"
ON "delivery_attempts"("delivery_id", "attempted_at" DESC);

ALTER TABLE "delivery_attempts"
ADD CONSTRAINT "delivery_attempts_delivery_id_fkey"
FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "delivery_attempts"
ADD CONSTRAINT "delivery_attempts_driver_profile_id_fkey"
FOREIGN KEY ("driver_profile_id") REFERENCES "driver_profiles"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
