-- PAY-05D: reservation-scoped CheckoutSession aggregate for atomic multi-order settlement.

CREATE TYPE "PaymentCheckoutSessionStatus" AS ENUM (
  'CREATED',
  'CHECKOUT_PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'EXPIRED'
);

CREATE TYPE "PaymentCheckoutSessionItemStatus" AS ENUM (
  'PENDING',
  'SETTLED',
  'REFUNDED',
  'CANCELLED'
);

CREATE TABLE "payment_checkout_sessions" (
  "id" TEXT NOT NULL,
  "payer_user_id" TEXT NOT NULL,
  "reservation_id" TEXT NOT NULL,
  "delivery_group_id" TEXT,
  "status" "PaymentCheckoutSessionStatus" NOT NULL DEFAULT 'CREATED',
  "currency" TEXT NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "total_amount_minor" INTEGER NOT NULL,
  "expires_at" TIMESTAMP(3),
  "succeeded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_checkout_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_checkout_session_items" (
  "id" TEXT NOT NULL,
  "checkout_session_id" TEXT NOT NULL,
  "payment_order_id" TEXT NOT NULL,
  "purpose" "PaymentPurpose" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "amount_minor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "status" "PaymentCheckoutSessionItemStatus" NOT NULL DEFAULT 'PENDING',
  "refunded_amount_minor" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payment_checkout_session_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_checkout_sessions_payer_user_id_status_idx"
  ON "payment_checkout_sessions"("payer_user_id", "status");

CREATE INDEX "payment_checkout_sessions_reservation_id_created_at_idx"
  ON "payment_checkout_sessions"("reservation_id", "created_at" DESC);

CREATE INDEX "payment_checkout_sessions_delivery_group_id_idx"
  ON "payment_checkout_sessions"("delivery_group_id");

CREATE INDEX "payment_checkout_sessions_status_created_at_idx"
  ON "payment_checkout_sessions"("status", "created_at" DESC);

ALTER TABLE "payment_checkout_sessions"
ADD CONSTRAINT "payment_checkout_sessions_total_positive_check"
CHECK ("total_amount" > 0 AND "total_amount" <= 21474836.47);

ALTER TABLE "payment_checkout_sessions"
ADD CONSTRAINT "payment_checkout_sessions_total_minor_positive_check"
CHECK ("total_amount_minor" > 0 AND "total_amount_minor" <= 2147483647);

CREATE UNIQUE INDEX "payment_checkout_session_items_session_order_key"
  ON "payment_checkout_session_items"("checkout_session_id", "payment_order_id");

CREATE INDEX "payment_checkout_session_items_payment_order_id_idx"
  ON "payment_checkout_session_items"("payment_order_id");

CREATE INDEX "payment_checkout_session_items_checkout_session_id_idx"
  ON "payment_checkout_session_items"("checkout_session_id");

ALTER TABLE "payment_checkout_session_items"
ADD CONSTRAINT "payment_checkout_session_items_amount_positive_check"
CHECK ("amount" > 0 AND "amount" <= 21474836.47);

ALTER TABLE "payment_checkout_session_items"
ADD CONSTRAINT "payment_checkout_session_items_amount_minor_positive_check"
CHECK ("amount_minor" > 0 AND "amount_minor" <= 2147483647);

ALTER TABLE "payment_checkout_session_items"
ADD CONSTRAINT "payment_checkout_session_items_refunded_nonneg_check"
CHECK (
  "refunded_amount_minor" >= 0
  AND "refunded_amount_minor" <= "amount_minor"
);

ALTER TABLE "payment_checkout_sessions"
ADD CONSTRAINT "payment_checkout_sessions_payer_user_id_fkey"
FOREIGN KEY ("payer_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_checkout_sessions"
ADD CONSTRAINT "payment_checkout_sessions_reservation_id_fkey"
FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_checkout_sessions"
ADD CONSTRAINT "payment_checkout_sessions_delivery_group_id_fkey"
FOREIGN KEY ("delivery_group_id") REFERENCES "delivery_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_checkout_session_items"
ADD CONSTRAINT "payment_checkout_session_items_checkout_session_id_fkey"
FOREIGN KEY ("checkout_session_id") REFERENCES "payment_checkout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_checkout_session_items"
ADD CONSTRAINT "payment_checkout_session_items_payment_order_id_fkey"
FOREIGN KEY ("payment_order_id") REFERENCES "payment_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Allow session-owned attempts (multi-order charge) while keeping legacy order-owned attempts.
ALTER TABLE "payment_attempts"
ALTER COLUMN "payment_order_id" DROP NOT NULL;

ALTER TABLE "payment_attempts"
ADD COLUMN "checkout_session_id" TEXT;

CREATE INDEX "payment_attempts_checkout_session_id_created_at_idx"
  ON "payment_attempts"("checkout_session_id", "created_at" DESC);

ALTER TABLE "payment_attempts"
ADD CONSTRAINT "payment_attempts_checkout_session_id_fkey"
FOREIGN KEY ("checkout_session_id") REFERENCES "payment_checkout_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_attempts"
ADD CONSTRAINT "payment_attempts_owner_check"
CHECK (
  "payment_order_id" IS NOT NULL
  OR "checkout_session_id" IS NOT NULL
);

-- Recreate one-active-attempt uniqueness so NULL payment_order_id rows are excluded.
DROP INDEX IF EXISTS "payment_attempts_one_active_per_order_uidx";

CREATE UNIQUE INDEX "payment_attempts_one_active_per_order_uidx"
ON "payment_attempts" ("payment_order_id")
WHERE "status" IN ('CREATED', 'PENDING') AND "payment_order_id" IS NOT NULL;

CREATE UNIQUE INDEX "payment_attempts_one_active_per_session_uidx"
ON "payment_attempts" ("checkout_session_id")
WHERE "status" IN ('CREATED', 'PENDING') AND "checkout_session_id" IS NOT NULL;

-- At most one non-terminal checkout session may actively charge a given order.
CREATE UNIQUE INDEX "payment_checkout_session_items_one_active_session_per_order_uidx"
ON "payment_checkout_session_items" ("payment_order_id")
WHERE "status" = 'PENDING';
