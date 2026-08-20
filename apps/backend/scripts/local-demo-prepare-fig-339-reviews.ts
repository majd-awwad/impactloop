/**
 * LOCAL demo prep for Figure 3.39 (project reviews + comment thread).
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-fig-339-reviews.ts
 *   npm run demo:prepare:reviews
 */
import { prisma } from '../src/database/prisma.js';
import { prepareReviewDemo } from '../prisma/demo-data/prepare/prepare-reviews.js';

prepareReviewDemo()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
