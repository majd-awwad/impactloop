/**
 * One-off LOCAL demo prep: internally consistent ON_THE_WAY delivery.
 * Isolated from the CASH handover scenario.
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-driver-ontheway.ts
 *   npm run demo:prepare:driver-ontheway
 */
import { prisma } from '../src/database/prisma.js';
import { prepareDriverOnTheWayDemo } from '../prisma/demo-data/prepare/prepare-driver-ontheway.js';

prepareDriverOnTheWayDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
