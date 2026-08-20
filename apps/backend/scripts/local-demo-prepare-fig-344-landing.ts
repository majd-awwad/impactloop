/**
 * Local demo prep for Figure 3.44 (logged-out landing / public discovery).
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-fig-344-landing.ts
 *   npm run demo:prepare:landing
 */
import { prisma } from '../src/database/prisma.js';
import { prepareLandingDemo } from '../prisma/demo-data/prepare/prepare-landing.js';

prepareLandingDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
