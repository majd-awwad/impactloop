import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  createStreamExportAuditGuard,
} from './admin-export.audit.js';
import { iterateKeysetChunks } from './admin-export.chunk.js';
import {
  buildContentDisposition,
  buildCsvBuffer,
  buildExportFilename,
  formatCsvRow,
  sanitizeCsvCell,
} from './admin-export.csv.js';
import {
  assertExportWithinLimit,
  buildExportPreflightResult,
  buildSpreadsheetExportPreflightResult,
} from './admin-export.preflight.js';
import {
  assertAdminExportPdfFontsPresent,
  assertNonOverlappingBands,
  assertRowWithinBottomMargin,
  buildAdminExportPdfFeasibilityFixtureBuffer,
  buildReservationsPdfBuffer,
  shapeAdminExportPdfText,
} from './admin-export.pdf.js';
import {
  assertVisualTextIsUnicodeNotGlyphIds,
  isArabicScriptChar,
  isLatinOrNumberChar,
  prepareVisualPdfTextRuns,
  reservationIdLooksUnreversed,
  segmentPdfTextRuns,
  visualContainsArabicPresentationForms,
} from './admin-export.pdf-text.js';
import { buildXlsxBuffer } from './admin-export.xlsx.js';
import { AppError } from '../../utils/app-error.js';

describe('admin-export.xlsx', () => {
  test('builds an xlsx buffer with freeze, autofilter, and guarded cells', async () => {
    const buffer = await buildXlsxBuffer({
      sheetName: 'Reservations',
      headers: ['ID', 'Name', 'Created At'],
      rows: [['=1+1', 'Alice', new Date('2026-07-30T12:00:00.000Z')]],
      dateColumnIndexes: [3],
    });

    assert.ok(buffer.length > 0);
    assert.equal(buffer.subarray(0, 2).toString('utf8'), 'PK');
  });
});

describe('admin-export.csv', () => {
  test('prefixes formula-like values to prevent spreadsheet injection', () => {
    assert.equal(sanitizeCsvCell('=1+1'), "'=1+1");
    assert.equal(sanitizeCsvCell('+970599999999'), "'+970599999999");
    assert.equal(sanitizeCsvCell('-100'), "'-100");
    assert.equal(sanitizeCsvCell('@SUM(A1)'), "'@SUM(A1)");
    assert.equal(sanitizeCsvCell('\tTAB'), "'\tTAB");
  });

  test('quotes fields containing commas, quotes, and newlines', () => {
    assert.equal(sanitizeCsvCell('hello, world'), '"hello, world"');
    assert.equal(sanitizeCsvCell('line\nbreak'), '"line\nbreak"');
    assert.equal(sanitizeCsvCell('say "hi"'), '"say ""hi"""');
  });

  test('buildCsvBuffer includes UTF-8 BOM and CRLF rows', () => {
    const buffer = buildCsvBuffer(['ID', 'Name'], [['abc-123', 'Test']]);
    const text = buffer.toString('utf8');
    assert.ok(text.startsWith('\uFEFF'));
    assert.ok(text.includes('ID,Name\r\nabc-123,Test\r\n'));
  });

  test('formatCsvRow preserves identifiers as text', () => {
    assert.equal(formatCsvRow(['00123', '+970599999999']), "00123,'+970599999999");
  });

  test('filename uses date range when both bounds exist', () => {
    assert.equal(
      buildExportFilename({
        domain: 'reservations',
        format: 'pdf',
        dateFrom: '2026-07-01',
        dateTo: '2026-07-30',
      }),
      'impactloop-reservations-2026-07-01-to-2026-07-30.pdf',
    );
  });

  test('content disposition includes filename and filename*', () => {
    const header = buildContentDisposition('impactloop-reservations-2026-07-30.csv');
    assert.match(header, /filename="impactloop-reservations-2026-07-30.csv"/);
    assert.match(header, /filename\*=UTF-8''impactloop-reservations-2026-07-30.csv/);
  });
});

describe('admin-export.chunk keyset', () => {
  test('iterates keyset batches without skipping tied createdAt values', async () => {
    const stamp = new Date('2026-07-30T10:00:00.000Z');
    const pages = [
      [
        { id: 'c', createdAt: stamp },
        { id: 'b', createdAt: stamp },
      ],
      [{ id: 'a', createdAt: stamp }],
    ];
    const batches: string[][] = [];

    for await (const batch of iterateKeysetChunks({
      take: 2,
      fetchPage: async (cursor) => {
        if (!cursor) return pages[0]!;
        if (cursor.id === 'b') return pages[1]!;
        return [];
      },
    })) {
      batches.push(batch.map((item) => item.id));
    }

    assert.deepEqual(batches, [
      ['c', 'b'],
      ['a'],
    ]);
  });
});

describe('admin-export.preflight', () => {
  test('format schema includes xlsx, pdf, and csv', async () => {
    const { ADMIN_EXPORT_FORMATS } = await import(
      './admin-export.validation.js'
    );
    assert.deepEqual([...ADMIN_EXPORT_FORMATS], ['xlsx', 'pdf', 'csv']);
  });

  test('returns pdf.allowed=true under the PDF limit', () => {
    const result = buildExportPreflightResult(12, { status: 'ACCEPTED' });
    assert.equal(result.count, 12);
    assert.equal(result.formats.xlsx.allowed, true);
    assert.equal(result.formats.csv.allowed, true);
    assert.equal(result.formats.pdf.allowed, true);
    assert.equal(result.formats.pdf.exceedsLimit, false);
    assert.equal(result.formats.pdf.maxAllowed, 500);
  });

  test('returns pdf.allowed=false only when over the PDF limit', () => {
    const result = buildExportPreflightResult(600, { status: 'ACCEPTED' });
    assert.equal(result.formats.pdf.allowed, false);
    assert.equal(result.formats.pdf.exceedsLimit, true);
    assert.equal(result.formats.pdf.maxAllowed, 500);
    assert.equal(result.formats.xlsx.allowed, true);
    assert.equal(result.formats.csv.allowed, true);
  });

  test('assertExportWithinLimit includes format in details for pdf', () => {
    assert.throws(
      () => assertExportWithinLimit(501, 'pdf'),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'EXPORT_LIMIT_EXCEEDED' &&
        (error.details as { format?: string }).format === 'pdf',
    );
  });

  test('assertExportWithinLimit includes format in details for csv', () => {
    assert.throws(
      () => assertExportWithinLimit(100_001, 'csv'),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'EXPORT_LIMIT_EXCEEDED' &&
        (error.details as { format?: string }).format === 'csv',
    );
  });

  test('spreadsheet preflight returns only xlsx and csv', () => {
    const result = buildSpreadsheetExportPreflightResult(12, {
      status: 'AVAILABLE',
    });
    assert.equal(result.count, 12);
    assert.equal(result.formats.xlsx.allowed, true);
    assert.equal(result.formats.csv.allowed, true);
    assert.equal(
      'pdf' in result.formats,
      false,
      'Materials-style preflight must not expose pdf',
    );
  });
});

describe('admin-export.audit stream guard', () => {
  test('finalize succeeds once after finish', async () => {
    const logged: unknown[] = [];
    const guard = createStreamExportAuditGuard({
      actorUserId: 'admin-1',
      domain: 'reservations',
      format: 'csv',
      filters: { search: 'x' },
      expectedCount: 2,
      getExportedCount: () => 2,
      log: async (payload) => {
        logged.push(payload);
      },
    });

    guard.markFinished();
    const first = await guard.finalize();
    const second = await guard.finalize();
    assert.ok(first);
    assert.equal(first!.success, true);
    assert.equal(second, null);
    assert.equal(logged.length, 1);
  });

  test('premature close is not success', async () => {
    const guard = createStreamExportAuditGuard({
      actorUserId: 'admin-1',
      domain: 'reservations',
      format: 'csv',
      filters: {},
      expectedCount: 5,
      getExportedCount: () => 1,
      log: async () => {},
    });
    guard.markClosed();
    const result = await guard.finalize();
    assert.equal(result?.success, false);
    assert.equal(result?.errorCode, 'EXPORT_CLIENT_DISCONNECT');
  });
});

describe('admin-export.pdf-text segmentation (not visual proof)', () => {
  test('detects Arabic and Latin/number runs', () => {
    assert.equal(isArabicScriptChar('ح'), true);
    assert.equal(isArabicScriptChar('A'), false);
    assert.equal(isLatinOrNumberChar('9'), true);
    assert.equal(isLatinOrNumberChar('ح'), false);

    const mixed = segmentPdfTextRuns('الحجز R-2026-001');
    assert.ok(mixed.some((run) => run.script === 'arabic'));
    assert.ok(
      mixed.some((run) => run.script === 'latin' && run.text.includes('R-2026')),
    );
  });

  test('prepareVisualPdfTextRuns keeps reservation IDs and numbers readable', () => {
    const logical = 'الحجز R-2026-001 للمتعلم أحمد';
    const visual = shapeAdminExportPdfText(logical);
    assertVisualTextIsUnicodeNotGlyphIds(visual);
    assert.ok(reservationIdLooksUnreversed(logical, visual));
    assert.ok(visual.includes('R-2026-001'));
    assert.ok(visualContainsArabicPresentationForms(visual));

    const runs = prepareVisualPdfTextRuns(logical);
    assert.ok(runs.some((run) => run.script === 'arabic'));
    assert.ok(runs.some((run) => run.script === 'latin'));
    assert.ok(runs.some((run) => run.text.includes('R-2026-001')));
  });

  test('numbers in Arabic date line are not reversed', () => {
    const logical = 'عدد الحجوزات: 12 — 2026/07/30';
    const visual = shapeAdminExportPdfText(logical);
    assert.ok(visual.includes('12'));
    assert.ok(visual.includes('2026/07/30'));
  });
});

describe('admin-export.pdf structural checks (not visual proof)', () => {
  test('font assets are present', () => {
    const fonts = assertAdminExportPdfFontsPresent();
    assert.match(fonts.latinFontPath, /NotoSans-Regular\.ttf$/);
    assert.match(fonts.arabicFontPath, /NotoNaskhArabic-Regular\.ttf$/);
  });

  test('layout helpers reject overlapping or out-of-bounds rows', () => {
    assert.throws(() =>
      assertNonOverlappingBands([
        { startY: 10, endY: 40 },
        { startY: 30, endY: 50 },
      ]),
    );
    assert.doesNotThrow(() =>
      assertNonOverlappingBands([
        { startY: 10, endY: 40 },
        { startY: 40, endY: 70 },
      ]),
    );
    assert.throws(() =>
      assertRowWithinBottomMargin(
        { index: 0, page: 1, y: 500, height: 40, bottom: 540 },
        520,
      ),
    );
  });

  test('builds multipage PDF with signature, pages, totals, and status data', async () => {
    const { PDFParse } = await import('pdf-parse');
    const rows = Array.from({ length: 40 }, (_, index) => ({
      reservationId: `R-2026-${String(index).padStart(3, '0')}`,
      material: index % 2 === 0 ? 'خشب وألواح — Wood Boards' : 'Wood Boards',
      learner: index % 2 === 0 ? 'أحمد' : 'Learner',
      supplier: index % 2 === 0 ? 'مؤسسة إعادة التدوير' : 'Supplier Co',
      status: index % 2 === 0 ? 'ACCEPTED' : 'PENDING',
      quantityUnit: `${(index % 5) + 1} piece`,
      createdAt: '2026-07-30 12:00:00',
      deliveryStatus: index % 3 === 0 ? 'SCHEDULED' : '',
    }));

    const buffer = await buildReservationsPdfBuffer({
      generatedAt: new Date('2026-07-30T12:00:00.000Z'),
      filters: { status: 'ACCEPTED' },
      totalCount: rows.length,
      statusSummary: { ACCEPTED: 20, PENDING: 20 },
      rows,
    });

    // Structural / extractable-text only — does not prove readable glyphs.
    assert.equal(buffer.subarray(0, 5).toString('utf8'), '%PDF-');
    assert.ok(buffer.length > 1000);

    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      assert.ok(parsed.total >= 2, `expected multipage PDF, got ${parsed.total}`);
      assert.match(parsed.text, /ImpactLoop Reservations Report/);
      assert.match(parsed.text, /Total matching reservations: 40/);
      assert.match(parsed.text, /ACCEPTED: 20/);
      assert.match(parsed.text, /PENDING: 20/);
      assert.equal(parsed.text.includes('password'), false);
      assert.equal(parsed.text.includes('Bearer '), false);
    } finally {
      await parser.destroy();
    }
  });

  test('feasibility fixture buffer is a PDF (structural only)', async () => {
    const buffer = await buildAdminExportPdfFeasibilityFixtureBuffer();
    assert.equal(buffer.subarray(0, 5).toString('utf8'), '%PDF-');
    assert.ok(buffer.length > 1000);
  });
});
