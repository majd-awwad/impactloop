-- Cash settlement reuses paid_at and stores only the missing collector identity.
ALTER TABLE "payment_orders"
ADD COLUMN "cash_collected_by_user_id" TEXT;

CREATE INDEX "payment_orders_cash_collected_by_user_id_idx"
ON "payment_orders"("cash_collected_by_user_id");

ALTER TABLE "payment_orders"
ADD CONSTRAINT "payment_orders_cash_collected_by_user_id_fkey"
FOREIGN KEY ("cash_collected_by_user_id") REFERENCES "users"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
