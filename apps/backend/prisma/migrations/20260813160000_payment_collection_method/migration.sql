-- CreateEnum
CREATE TYPE "PaymentCollectionMethod" AS ENUM ('CARD', 'CASH');

-- AlterTable
ALTER TABLE "reservations"
ADD COLUMN "payment_method" "PaymentCollectionMethod" NOT NULL DEFAULT 'CARD';

-- AlterTable
ALTER TABLE "delivery_groups"
ADD COLUMN "payment_method" "PaymentCollectionMethod" NOT NULL DEFAULT 'CARD';

-- AlterTable
ALTER TABLE "payment_orders"
ADD COLUMN "payment_method" "PaymentCollectionMethod" NOT NULL DEFAULT 'CARD';
