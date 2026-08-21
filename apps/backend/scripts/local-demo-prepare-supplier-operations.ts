/**
 * LOCAL demo prep for Figure 3.56 supplier verification, governance, and pickup schedule.
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-supplier-operations.ts
 *   npm run demo:prepare:supplier-operations
 */
import { prisma } from '../src/database/prisma.js';
import { prepareSupplierOperationsDemo } from '../prisma/demo-data/prepare/prepare-supplier-operations.js';

prepareSupplierOperationsDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
