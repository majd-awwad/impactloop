/**
 * LOCAL demo prep for Figure 3.36 (Project Help Session request/detail).
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-help-session.ts
 *   npm run demo:prepare:help-session
 */
import { prisma } from '../src/database/prisma.js';
import { prepareHelpSessionDemo } from '../prisma/demo-data/prepare/prepare-help-session.js';

prepareHelpSessionDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
