/**
 * LOCAL demo prep for Figure 3.34 (notification inbox) and Figure 3.35
 * (reservation-message deep link).
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-notifications.ts
 *   npm run demo:prepare:notifications
 */
import { prisma } from '../src/database/prisma.js';
import { prepareNotificationDemo } from '../prisma/demo-data/prepare/prepare-notifications.js';

prepareNotificationDemo()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
