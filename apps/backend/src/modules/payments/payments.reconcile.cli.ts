/**
 * Dev/admin CLI for PAY-02 obligation reconciliation.
 *
 * Usage:
 *   npx tsx src/modules/payments/payments.reconcile.cli.ts
 *   npx tsx src/modules/payments/payments.reconcile.cli.ts --apply
 *
 * Default is dry-run. Prefer reseeding local demo DBs when practical.
 * Does not invoke provider checkout.
 */
import { prisma } from '../../database/prisma.js';
import { reconcileAcceptedPaymentObligations } from './payments.reconcile.js';

const apply = process.argv.includes('--apply');

try {
  const result = await reconcileAcceptedPaymentObligations({ dryRun: !apply });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
