-- PAY-05D-R: PaymentAttempt must have exactly one owner (XOR).

ALTER TABLE "payment_attempts"
DROP CONSTRAINT IF EXISTS "payment_attempts_owner_check";

ALTER TABLE "payment_attempts"
ADD CONSTRAINT "payment_attempts_owner_xor_check"
CHECK (
  (
    "payment_order_id" IS NOT NULL
    AND "checkout_session_id" IS NULL
  )
  OR
  (
    "payment_order_id" IS NULL
    AND "checkout_session_id" IS NOT NULL
  )
);
