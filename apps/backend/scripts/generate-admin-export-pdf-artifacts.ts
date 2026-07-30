/**
 * Generates local PDF artifacts for manual visual verification.
 * Does not enable production PDF export.
 *
 * Usage (from apps/backend):
 *   npx tsx scripts/generate-admin-export-pdf-artifacts.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAdminExportPdfFeasibilityFixtureBuffer,
  buildReservationsPdfBuffer,
  type ReservationPdfRow,
} from '../src/modules/admin-export/admin-export.pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  '../tmp/admin-export-pdf-manual-verify',
);

const arabicMaterials = [
  'ألواح خشبية معاد استخدامها — Recycled Wood Panels',
  'حجز مواد تعليمية',
  'طلاء ومواد تشطيب (Acrylic)',
  'أنابيب PVC — Pipe Offcuts',
];

const learners = [
  'أحمد يوسف',
  'سارة خالد',
  'Learner Alice',
  'المتعلمة نورة',
];

const suppliers = [
  'مؤسسة إعادة التدوير',
  'Green Parts Co',
  'ورشة الخشب المحلي',
  'Supplier North',
];

const buildSyntheticRows = (count: number): ReservationPdfRow[] =>
  Array.from({ length: count }, (_, index) => ({
    reservationId: `R-2026-${String(index + 1).padStart(3, '0')}`,
    material: arabicMaterials[index % arabicMaterials.length]!,
    learner: learners[index % learners.length]!,
    supplier: suppliers[index % suppliers.length]!,
    status: index % 3 === 0 ? 'ACCEPTED' : index % 3 === 1 ? 'PENDING' : 'COMPLETED',
    quantityUnit: `${(index % 7) + 1} piece`,
    createdAt: `2026-07-${String((index % 28) + 1).padStart(2, '0')} 12:00:00`,
    deliveryStatus:
      index % 4 === 0 ? 'SCHEDULED' : index % 4 === 1 ? 'DELIVERED' : '',
  }));

const writeBuffer = (fileName: string, buffer: Buffer): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const filePath = path.join(OUT_DIR, fileName);
  fs.writeFileSync(filePath, buffer);
  return filePath;
};

const main = async () => {
  const fixture = await buildAdminExportPdfFeasibilityFixtureBuffer();
  const fixturePath = writeBuffer('feasibility-arabic-english.pdf', fixture);

  const seededRows = buildSyntheticRows(12);
  const seeded = await buildReservationsPdfBuffer({
    generatedAt: new Date('2026-07-30T12:00:00.000Z'),
    filters: { status: 'ACCEPTED', search: 'seed-demo' },
    totalCount: seededRows.length,
    statusSummary: { ACCEPTED: 4, PENDING: 4, COMPLETED: 4 },
    rows: seededRows,
  });
  const seededPath = writeBuffer('reservations-seeded-sample.pdf', seeded);

  const multipageRows = buildSyntheticRows(80);
  const multipage = await buildReservationsPdfBuffer({
    generatedAt: new Date('2026-07-30T12:00:00.000Z'),
    filters: { dateFrom: '2026-07-01', dateTo: '2026-07-30' },
    totalCount: multipageRows.length,
    statusSummary: { ACCEPTED: 27, PENDING: 27, COMPLETED: 26 },
    rows: multipageRows,
  });
  const multipagePath = writeBuffer(
    'reservations-multipage-3plus.pdf',
    multipage,
  );

  console.log(JSON.stringify({ fixturePath, seededPath, multipagePath }, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
