/**
 * LOCAL mobile-demo prep for Driver > Available Jobs.
 *
 * Run from apps/backend:
 *   npm run demo:prepare:driver-jobs
 */
import { prisma } from '../src/database/prisma.js';
import { prepareDriverAvailableJobsDemo } from '../prisma/demo-data/prepare/prepare-driver-available-jobs.js';

prepareDriverAvailableJobsDemo()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
