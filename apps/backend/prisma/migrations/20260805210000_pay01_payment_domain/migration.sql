-- CreateEnum
CREATE TYPE "PaymentPurpose" AS ENUM ('MATERIAL_SUBTOTAL', 'DELIVERY_FEE');

-- CreateEnum
CREATE TYPE "PaymentOrderStatus" AS ENUM ('REQUIRES_PAYMENT', 'CHECKOUT_PENDING', 'PAID', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentProviderType" AS ENUM ('MOCK');

-- CreateEnum
CREATE TYPE "PaymentProviderMode" AS ENUM ('LOCAL', 'SANDBOX');

-- CreateEnum
CREATE TYPE "PaymentProviderEventProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED_DUPLICATE', 'REJECTED');

-- CreateEnum
CREATE TYPE "PaymentRefundStatus" AS ENUM ('REQUESTED', 'PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL,
    "payer_user_id" TEXT NOT NULL,
    "purpose" "PaymentPurpose" NOT NULL,
    "cycle_number" INTEGER NOT NULL DEFAULT 1,
    "status" "PaymentOrderStatus" NOT NULL DEFAULT 'REQUIRES_PAYMENT',
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reservation_id" TEXT,
    "delivery_group_id" TEXT,
    "paid_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "refunded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_attempts" (
    "id" TEXT NOT NULL,
    "payment_order_id" TEXT NOT NULL,
    "provider" "PaymentProviderType" NOT NULL,
    "provider_mode" "PaymentProviderMode" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "provider_ref" TEXT,
    "checkout_ref" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "provider_metadata" JSONB,
    "expires_at" TIMESTAMP(3),
    "succeeded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_provider_events" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProviderType" NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payment_attempt_id" TEXT,
    "payload_json" JSONB NOT NULL,
    "signature_valid" BOOLEAN NOT NULL,
    "processing_status" "PaymentProviderEventProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
    "processing_error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_refunds" (
    "id" TEXT NOT NULL,
    "payment_order_id" TEXT NOT NULL,
    "payment_attempt_id" TEXT NOT NULL,
    "status" "PaymentRefundStatus" NOT NULL DEFAULT 'REQUESTED',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT,
    "provider_refund_ref" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "succeeded_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payment_orders_payer_user_id_status_idx" ON "payment_orders"("payer_user_id", "status");

-- CreateIndex
CREATE INDEX "payment_orders_status_created_at_idx" ON "payment_orders"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_orders_reservation_id_idx" ON "payment_orders"("reservation_id");

-- CreateIndex
CREATE INDEX "payment_orders_delivery_group_id_idx" ON "payment_orders"("delivery_group_id");

-- Purpose/source shape invariant
ALTER TABLE "payment_orders"
ADD CONSTRAINT "payment_orders_purpose_source_check"
CHECK (
  ("purpose" = 'MATERIAL_SUBTOTAL' AND "reservation_id" IS NOT NULL AND "delivery_group_id" IS NULL)
  OR
  ("purpose" = 'DELIVERY_FEE' AND "delivery_group_id" IS NOT NULL AND "reservation_id" IS NULL)
);

-- Positive cycle and amount; amount capped to INTEGER-safe minor units
ALTER TABLE "payment_orders"
ADD CONSTRAINT "payment_orders_cycle_positive_check"
CHECK ("cycle_number" > 0);

ALTER TABLE "payment_orders"
ADD CONSTRAINT "payment_orders_amount_positive_check"
CHECK ("amount" > 0 AND "amount" <= 21474836.47);

-- One material order per reservation cycle
CREATE UNIQUE INDEX "payment_orders_material_cycle_uidx"
ON "payment_orders" ("reservation_id", "cycle_number")
WHERE "purpose" = 'MATERIAL_SUBTOTAL' AND "reservation_id" IS NOT NULL;

-- One delivery-fee order per delivery-group cycle
CREATE UNIQUE INDEX "payment_orders_delivery_fee_cycle_uidx"
ON "payment_orders" ("delivery_group_id", "cycle_number")
WHERE "purpose" = 'DELIVERY_FEE' AND "delivery_group_id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "payment_attempts_payment_order_id_created_at_idx" ON "payment_attempts"("payment_order_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "payment_attempts_status_idx" ON "payment_attempts"("status");

ALTER TABLE "payment_attempts"
ADD CONSTRAINT "payment_attempts_amount_positive_check"
CHECK ("amount" > 0 AND "amount" <= 21474836.47);

ALTER TABLE "payment_attempts"
ADD CONSTRAINT "payment_attempts_amount_minor_positive_check"
CHECK ("amount_minor" > 0 AND "amount_minor" <= 2147483647);

-- Unique provider reference scoped by provider when present
CREATE UNIQUE INDEX "payment_attempts_provider_provider_ref_uidx"
ON "payment_attempts" ("provider", "provider_ref")
WHERE "provider_ref" IS NOT NULL;

-- At most one active (CREATED|PENDING) attempt per payment order
CREATE UNIQUE INDEX "payment_attempts_one_active_per_order_uidx"
ON "payment_attempts" ("payment_order_id")
WHERE "status" IN ('CREATED', 'PENDING');

-- CreateIndex
CREATE UNIQUE INDEX "payment_provider_events_provider_provider_event_id_key" ON "payment_provider_events"("provider", "provider_event_id");

-- CreateIndex
CREATE INDEX "payment_provider_events_payment_attempt_id_idx" ON "payment_provider_events"("payment_attempt_id");

-- CreateIndex
CREATE INDEX "payment_provider_events_processing_status_received_at_idx" ON "payment_provider_events"("processing_status", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "payment_refunds_payment_order_id_key" ON "payment_refunds"("payment_order_id");

ALTER TABLE "payment_refunds"
ADD CONSTRAINT "payment_refunds_amount_positive_check"
CHECK ("amount" > 0 AND "amount" <= 21474836.47);

-- CreateIndex
CREATE INDEX "payment_refunds_payment_attempt_id_idx" ON "payment_refunds"("payment_attempt_id");

-- CreateIndex
CREATE INDEX "payment_refunds_status_idx" ON "payment_refunds"("status");

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_delivery_group_id_fkey" FOREIGN KEY ("delivery_group_id") REFERENCES "delivery_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_provider_events" ADD CONSTRAINT "payment_provider_events_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_order_id_fkey" FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_attempt_id_fkey" FOREIGN KEY ("payment_attempt_id") REFERENCES "payment_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
