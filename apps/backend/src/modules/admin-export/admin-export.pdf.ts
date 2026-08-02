import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import PDFDocument from 'pdfkit';
import { render as shapeAndReorderVisual } from 'bidi-shaper';

import {
  ADMIN_EXPORT_PDF_ARABIC_FONT,
  ADMIN_EXPORT_PDF_LATIN_FONT,
  fontNameForPdfScript,
  paragraphAlignForText,
  prepareVisualPdfTextRuns,
  wrapPdfTextRuns,
  type PdfTextRun,
} from './admin-export.pdf-text.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Locked stack: pdfkit + bidi-shaper + Noto Sans (Latin) + Noto Naskh Arabic. */
export const ADMIN_EXPORT_PDF_LATIN_FONT_FILE = 'NotoSans-Regular.ttf';
export const ADMIN_EXPORT_PDF_ARABIC_FONT_FILE = 'NotoNaskhArabic-Regular.ttf';

export const resolveAdminExportPdfFontsDir = (): string =>
  path.resolve(__dirname, '../../../assets/fonts');

export const resolveAdminExportPdfLatinFontPath = (): string =>
  path.join(resolveAdminExportPdfFontsDir(), ADMIN_EXPORT_PDF_LATIN_FONT_FILE);

export const resolveAdminExportPdfArabicFontPath = (): string =>
  path.join(resolveAdminExportPdfFontsDir(), ADMIN_EXPORT_PDF_ARABIC_FONT_FILE);

/** @deprecated Prefer resolveAdminExportPdfArabicFontPath — kept for older tests. */
export const resolveAdminExportPdfFontPath = (): string =>
  resolveAdminExportPdfArabicFontPath();

export const assertAdminExportPdfFontsPresent = (): {
  latinFontPath: string;
  arabicFontPath: string;
} => {
  const latinFontPath = resolveAdminExportPdfLatinFontPath();
  const arabicFontPath = resolveAdminExportPdfArabicFontPath();
  if (!fs.existsSync(latinFontPath)) {
    throw new Error(`Missing Latin PDF font: ${latinFontPath}`);
  }
  if (!fs.existsSync(arabicFontPath)) {
    throw new Error(`Missing Arabic PDF font: ${arabicFontPath}`);
  }
  return { latinFontPath, arabicFontPath };
};

export type PdfStatusSummary = Record<string, number>;

export type ReservationPdfRow = {
  reservationId: string;
  material: string;
  learner: string;
  supplier: string;
  status: string;
  quantityUnit: string;
  createdAt: string;
  deliveryStatus: string;
};

export type BuildReservationsPdfInput = {
  generatedAt: Date;
  filters: Record<string, unknown>;
  totalCount: number;
  statusSummary: PdfStatusSummary;
  rows: ReservationPdfRow[];
};

const MARGIN = 36;
const PAGE_WIDTH = 842; // A4 landscape
const PAGE_HEIGHT = 595;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FOOTER_Y = PAGE_HEIGHT - 22;
const BOTTOM_CONTENT_LIMIT = PAGE_HEIGHT - MARGIN - 28;
const CELL_PADDING_X = 3;
const CELL_PADDING_Y = 3;
const LINE_HEIGHT_FACTOR = 1.35;

const COLUMNS: {
  key: keyof ReservationPdfRow;
  label: string;
  width: number;
}[] = [
  { key: 'reservationId', label: 'Reservation ID', width: 96 },
  { key: 'material', label: 'Material', width: 150 },
  { key: 'learner', label: 'Learner', width: 100 },
  { key: 'supplier', label: 'Supplier', width: 100 },
  { key: 'status', label: 'Status', width: 72 },
  { key: 'quantityUnit', label: 'Quantity', width: 64 },
  { key: 'createdAt', label: 'Created date', width: 90 },
  { key: 'deliveryStatus', label: 'Delivery status', width: 98 },
];

const formatFilterSummary = (filters: Record<string, unknown>): string => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (value == null || value === '') continue;
    parts.push(`${key}=${String(value)}`);
  }
  return parts.length > 0
    ? parts.join(', ')
    : 'None (all matching reservations)';
};

const registerPdfFonts = (doc: PDFKit.PDFDocument): void => {
  const { latinFontPath, arabicFontPath } = assertAdminExportPdfFontsPresent();
  doc.registerFont(ADMIN_EXPORT_PDF_LATIN_FONT, latinFontPath);
  doc.registerFont(ADMIN_EXPORT_PDF_ARABIC_FONT, arabicFontPath);
};

const measureRunWidth = (
  doc: PDFKit.PDFDocument,
  run: PdfTextRun,
  fontSize: number,
): number => {
  doc.font(fontNameForPdfScript(run.script)).fontSize(fontSize);
  return doc.widthOfString(run.text, { features: [] });
};

const lineStep = (fontSize: number): number => fontSize * LINE_HEIGHT_FACTOR;

const drawVisualRunsAt = (
  doc: PDFKit.PDFDocument,
  runs: PdfTextRun[],
  x: number,
  y: number,
  fontSize: number,
): number => {
  let cursor = x;
  for (const run of runs) {
    doc.font(fontNameForPdfScript(run.script)).fontSize(fontSize);
    const width = doc.widthOfString(run.text, { features: [] });
    doc.text(run.text, cursor, y, {
      lineBreak: false,
      features: [],
    });
    cursor += width;
  }
  return cursor - x;
};

/**
 * Draw logical text using the locked visual-run pipeline.
 * Returns the Y coordinate immediately below the drawn block.
 */
export const drawPdfLogicalTextBlock = (
  doc: PDFKit.PDFDocument,
  logicalText: string,
  box: { x: number; y: number; width: number },
  fontSize: number,
  align: 'left' | 'right' | 'auto' = 'auto',
): number => {
  const runs = prepareVisualPdfTextRuns(logicalText);
  const resolvedAlign =
    align === 'auto' ? paragraphAlignForText(logicalText) : align;
  const lines = wrapPdfTextRuns(runs, box.width, (run) =>
    measureRunWidth(doc, run, fontSize),
  );
  let y = box.y;
  for (const line of lines) {
    const startX =
      resolvedAlign === 'right'
        ? box.x + Math.max(0, box.width - line.width)
        : box.x;
    drawVisualRunsAt(doc, line.runs, startX, y, fontSize);
    y += lineStep(fontSize);
  }
  return y;
};

export const measurePdfLogicalTextHeight = (
  doc: PDFKit.PDFDocument,
  logicalText: string,
  width: number,
  fontSize: number,
): number => {
  const runs = prepareVisualPdfTextRuns(logicalText);
  const lines = wrapPdfTextRuns(runs, width, (run) =>
    measureRunWidth(doc, run, fontSize),
  );
  return Math.max(lineStep(fontSize), lines.length * lineStep(fontSize));
};

export type PdfLayoutBand = {
  startY: number;
  endY: number;
};

export type PdfRowLayout = {
  index: number;
  page: number;
  y: number;
  height: number;
  bottom: number;
};

/** Pure layout check helpers — used by unit tests (not visual proof). */
export const assertNonOverlappingBands = (bands: PdfLayoutBand[]): void => {
  const sorted = [...bands].sort((a, b) => a.startY - b.startY);
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (cur.startY < prev.endY) {
      throw new Error(
        `Overlapping layout bands at y=${cur.startY} (previous ended ${prev.endY})`,
      );
    }
  }
};

export const assertRowWithinBottomMargin = (
  row: PdfRowLayout,
  bottomLimit: number,
): void => {
  if (row.y < 0 || row.height <= 0) {
    throw new Error(`Invalid row geometry y=${row.y} height=${row.height}`);
  }
  if (row.bottom > bottomLimit) {
    throw new Error(
      `Row ${row.index} extends past bottom margin (${row.bottom} > ${bottomLimit})`,
    );
  }
};

const measureRowHeight = (
  doc: PDFKit.PDFDocument,
  row: ReservationPdfRow,
  fontSize: number,
): number => {
  let maxContent = lineStep(fontSize);
  for (const column of COLUMNS) {
    const text = String(row[column.key] ?? '');
    const height = measurePdfLogicalTextHeight(
      doc,
      text,
      column.width - CELL_PADDING_X * 2,
      fontSize,
    );
    maxContent = Math.max(maxContent, height);
  }
  return maxContent + CELL_PADDING_Y * 2;
};

const createPdfDocument = (): PDFKit.PDFDocument =>
  new PDFDocument({
    size: [PAGE_WIDTH, PAGE_HEIGHT],
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    autoFirstPage: true,
    bufferPages: true,
    info: {
      Title: 'ImpactLoop Reservations Report',
      Author: 'ImpactLoop Admin',
    },
  });

const drawPageFooter = (doc: PDFKit.PDFDocument, pageNumber: number): void => {
  doc.font(ADMIN_EXPORT_PDF_LATIN_FONT).fontSize(8);
  doc.text(`Page ${pageNumber}`, MARGIN, FOOTER_Y, {
    width: CONTENT_WIDTH,
    align: 'center',
    lineBreak: false,
    features: [],
  });
};

const drawTableHeader = (doc: PDFKit.PDFDocument, y: number): number => {
  const fontSize = 8;
  const headerHeight =
    Math.max(
      ...COLUMNS.map((column) =>
        measurePdfLogicalTextHeight(
          doc,
          column.label,
          column.width - CELL_PADDING_X * 2,
          fontSize,
        ),
      ),
    ) + CELL_PADDING_Y * 2;

  doc
    .save()
    .rect(MARGIN, y, CONTENT_WIDTH, headerHeight)
    .fill('#f0f0f0')
    .restore();

  let x = MARGIN;
  for (const column of COLUMNS) {
    drawPdfLogicalTextBlock(
      doc,
      column.label,
      {
        x: x + CELL_PADDING_X,
        y: y + CELL_PADDING_Y,
        width: column.width - CELL_PADDING_X * 2,
      },
      fontSize,
      'left',
    );
    x += column.width;
  }

  doc
    .moveTo(MARGIN, y + headerHeight)
    .lineTo(MARGIN + CONTENT_WIDTH, y + headerHeight)
    .strokeColor('#666666')
    .lineWidth(0.5)
    .stroke();

  return y + headerHeight + 4;
};

const drawSummaryHeader = (
  doc: PDFKit.PDFDocument,
  input: BuildReservationsPdfInput,
): number => {
  let y = MARGIN;
  const bands: PdfLayoutBand[] = [];

  const titleEnd = drawPdfLogicalTextBlock(
    doc,
    'ImpactLoop Reservations Report',
    { x: MARGIN, y, width: CONTENT_WIDTH },
    16,
    'left',
  );
  bands.push({ startY: y, endY: titleEnd });
  y = titleEnd + 6;

  const generated = `Generated: ${input.generatedAt.toISOString()}`;
  const generatedEnd = drawPdfLogicalTextBlock(
    doc,
    generated,
    { x: MARGIN, y, width: CONTENT_WIDTH },
    9,
    'left',
  );
  bands.push({ startY: y, endY: generatedEnd });
  y = generatedEnd + 8;

  const filtersLabel = 'Active filters';
  const filtersEndLabel = drawPdfLogicalTextBlock(
    doc,
    filtersLabel,
    { x: MARGIN, y, width: CONTENT_WIDTH },
    9,
    'left',
  );
  y = filtersEndLabel + 2;
  const filterBody = formatFilterSummary(input.filters);
  const filterBoxTop = y;
  const filterHeight = measurePdfLogicalTextHeight(
    doc,
    filterBody,
    CONTENT_WIDTH - 12,
    8,
  );
  doc
    .save()
    .rect(MARGIN, filterBoxTop, CONTENT_WIDTH, filterHeight + 8)
    .strokeColor('#cccccc')
    .lineWidth(0.5)
    .stroke()
    .restore();
  const filtersEnd = drawPdfLogicalTextBlock(
    doc,
    filterBody,
    { x: MARGIN + 6, y: filterBoxTop + 4, width: CONTENT_WIDTH - 12 },
    8,
    'left',
  );
  bands.push({ startY: filterBoxTop, endY: filtersEnd + 4 });
  y = filtersEnd + 12;

  const totalLine = `Total matching reservations: ${input.totalCount}`;
  const totalEnd = drawPdfLogicalTextBlock(
    doc,
    totalLine,
    { x: MARGIN, y, width: CONTENT_WIDTH },
    9,
    'left',
  );
  bands.push({ startY: y, endY: totalEnd });
  y = totalEnd + 6;

  const summaryParts = Object.entries(input.statusSummary)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `${status}: ${count}`);
  const statusLine = `Status summary: ${
    summaryParts.length > 0 ? summaryParts.join(' | ') : 'n/a'
  }`;
  const statusEnd = drawPdfLogicalTextBlock(
    doc,
    statusLine,
    { x: MARGIN, y, width: CONTENT_WIDTH },
    8,
    'left',
  );
  bands.push({ startY: y, endY: statusEnd });
  assertNonOverlappingBands(bands);

  return statusEnd + 14;
};

const drawDataRow = (
  doc: PDFKit.PDFDocument,
  row: ReservationPdfRow,
  y: number,
  rowHeight: number,
): void => {
  const fontSize = 7;
  let x = MARGIN;
  for (const column of COLUMNS) {
    drawPdfLogicalTextBlock(
      doc,
      String(row[column.key] ?? ''),
      {
        x: x + CELL_PADDING_X,
        y: y + CELL_PADDING_Y,
        width: column.width - CELL_PADDING_X * 2,
      },
      fontSize,
      'auto',
    );
    x += column.width;
  }

  doc
    .moveTo(MARGIN, y + rowHeight)
    .lineTo(MARGIN + CONTENT_WIDTH, y + rowHeight)
    .strokeColor('#dddddd')
    .lineWidth(0.4)
    .stroke();
};

export const buildReservationsPdfBuffer = async (
  input: BuildReservationsPdfInput,
): Promise<Buffer> => {
  assertAdminExportPdfFontsPresent();

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = createPdfDocument();
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    registerPdfFonts(doc);

    let pageNumber = 1;
    const rowLayouts: PdfRowLayout[] = [];

    const beginPage = (includeSummary: boolean): number => {
      if (!includeSummary) {
        doc.addPage();
        pageNumber += 1;
      }
      drawPageFooter(doc, pageNumber);
      if (includeSummary) {
        const afterSummary = drawSummaryHeader(doc, input);
        return drawTableHeader(doc, afterSummary);
      }
      return drawTableHeader(doc, MARGIN);
    };

    let y = beginPage(true);
    const bodyFontSize = 7;

    for (let index = 0; index < input.rows.length; index += 1) {
      const row = input.rows[index]!;
      const rowHeight = measureRowHeight(doc, row, bodyFontSize);

      if (y + rowHeight > BOTTOM_CONTENT_LIMIT) {
        y = beginPage(false);
      }

      const layout: PdfRowLayout = {
        index,
        page: pageNumber,
        y,
        height: rowHeight,
        bottom: y + rowHeight,
      };
      assertRowWithinBottomMargin(layout, BOTTOM_CONTENT_LIMIT);
      rowLayouts.push(layout);

      drawDataRow(doc, row, y, rowHeight);
      y += rowHeight;
    }

    // Structural safety: adjacent rows on the same page must not overlap.
    for (let i = 1; i < rowLayouts.length; i += 1) {
      const prev = rowLayouts[i - 1]!;
      const cur = rowLayouts[i]!;
      if (prev.page === cur.page) {
        assertNonOverlappingBands([
          { startY: prev.y, endY: prev.bottom },
          { startY: cur.y, endY: cur.bottom },
        ]);
      }
    }

    doc.end();
  });
};

/** Deterministic Arabic/Latin feasibility fixture samples (manual visual check). */
export const ADMIN_EXPORT_PDF_FEASIBILITY_SAMPLES: {
  label: string;
  text: string;
}[] = [
  { label: 'Latin title', text: 'ImpactLoop Reservations Report' },
  { label: 'Arabic title', text: 'تقرير حجوزات ImpactLoop' },
  { label: 'Arabic only', text: 'حجز مواد تعليمية' },
  { label: 'English only', text: 'Reservation R-2026-001' },
  {
    label: 'Mixed Arabic and English',
    text: 'الحجز R-2026-001 للمتعلم أحمد',
  },
  {
    label: 'Arabic with numbers and date',
    text: 'عدد الحجوزات: 12 — 2026/07/30',
  },
  {
    label: 'Long mixed material name',
    text: 'ألواح خشبية معاد استخدامها — Recycled Wood Panels',
  },
  { label: 'Arabic learner name', text: 'المتعلمة سارة يوسف' },
  { label: 'Arabic supplier name', text: 'مؤسسة إعادة التدوير' },
  { label: 'Latin email', text: 'learner@example.com' },
  { label: 'Latin ID', text: 'res_01HZX9K2M' },
  {
    label: 'Punctuation and parentheses',
    text: 'الحالة (ACCEPTED) — الكمية: 3',
  },
];

export const buildAdminExportPdfFeasibilityFixtureBuffer =
  async (): Promise<Buffer> => {
    assertAdminExportPdfFontsPresent();

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = createPdfDocument();
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      registerPdfFonts(doc);

      let y = MARGIN;
      y =
        drawPdfLogicalTextBlock(
          doc,
          'ImpactLoop PDF Feasibility Fixture',
          { x: MARGIN, y, width: CONTENT_WIDTH },
          16,
          'left',
        ) + 8;
      y =
        drawPdfLogicalTextBlock(
          doc,
          'Manual visual check only — automated tests do not prove rendering.',
          { x: MARGIN, y, width: CONTENT_WIDTH },
          9,
          'left',
        ) + 12;

      for (const sample of ADMIN_EXPORT_PDF_FEASIBILITY_SAMPLES) {
        const needed =
          measurePdfLogicalTextHeight(doc, sample.label, CONTENT_WIDTH, 8) +
          measurePdfLogicalTextHeight(doc, sample.text, CONTENT_WIDTH, 12) +
          20;
        if (y + needed > BOTTOM_CONTENT_LIMIT) {
          doc.addPage();
          y = MARGIN;
        }

        y =
          drawPdfLogicalTextBlock(
            doc,
            sample.label,
            { x: MARGIN, y, width: CONTENT_WIDTH },
            8,
            'left',
          ) + 2;
        y =
          drawPdfLogicalTextBlock(
            doc,
            sample.text,
            { x: MARGIN, y, width: CONTENT_WIDTH },
            12,
            'auto',
          ) + 14;

        // Keep a structural trace that IDs are not reversed in the visual string.
        const visual = shapeAndReorderVisual(sample.text);
        if (sample.text.includes('R-2026-001') && !visual.includes('R-2026-001')) {
          reject(new Error(`Reservation ID reversed in fixture sample: ${sample.label}`));
          return;
        }
      }

      doc.end();
    });
  };

export { shapeAndReorderVisual as shapeAdminExportPdfText };
