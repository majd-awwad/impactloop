/**
 * LOCAL demo prep for Figure 3.57 driver profile, history, grouped job, and incidents.
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-driver-operations.ts
 *   npm run demo:prepare:driver-operations
 */
import { prisma } from '../src/database/prisma.js';
import { prepareDriverOperationsDemo } from '../prisma/demo-data/prepare/prepare-driver-operations.js';

prepareDriverOperationsDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
