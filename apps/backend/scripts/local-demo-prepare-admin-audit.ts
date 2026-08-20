/**
 * LOCAL demo prep: realistic Admin Audit Log activity via real admin actions.
 *
 * Run from apps/backend:
 *   npx tsx scripts/local-demo-prepare-admin-audit.ts
 *   npm run demo:prepare:admin-audit
 */
import { prisma } from '../src/database/prisma.js';
import { prepareAdminAuditDemo } from '../prisma/demo-data/prepare/prepare-admin-audit.js';

prepareAdminAuditDemo()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
