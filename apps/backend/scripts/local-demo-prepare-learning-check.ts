/**
 * LOCAL demo prep for Learning Check screenshots (Simple LED Circuit).
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-learning-check.ts
 *   npm run demo:prepare:learning-check
 */
import { prisma } from '../src/database/prisma.js';
import { prepareLearningCheckDemo } from '../prisma/demo-data/prepare/prepare-learning-check.js';

prepareLearningCheckDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
