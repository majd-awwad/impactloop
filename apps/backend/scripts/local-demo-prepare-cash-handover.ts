/**
 * One-off LOCAL demo prep: paid CASH delivery ready for learner handover
 * screenshots. Isolated from the ON_THE_WAY driver scenario.
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-cash-handover.ts
 *   npm run demo:prepare:cash-handover
 */
import { prisma } from '../src/database/prisma.js';
import { prepareCashHandoverDemo } from '../prisma/demo-data/prepare/prepare-cash-handover.js';

prepareCashHandoverDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
