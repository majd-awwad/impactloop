const FORMULA_PREFIX_PATTERN = /^[=+\-@\t]/;

export const escapeCsvField = (value: string): string => {
  if (
    value.includes('"') ||
    value.includes(',') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
};

export const sanitizeCsvCell = (value: unknown): string => {
  if (value == null) {
    return '';
  }

  const raw = String(value);
  const guarded = FORMULA_PREFIX_PATTERN.test(raw) ? `'${raw}` : raw;
  return escapeCsvField(guarded);
};

export const formatCsvRow = (cells: unknown[]): string =>
  cells.map(sanitizeCsvCell).join(',');

export const formatCsvHeaderRow = (headers: string[]): string =>
  headers.map(escapeCsvField).join(',');

export const CSV_UTF8_BOM = '\uFEFF';

export const buildCsvBuffer = (headers: string[], rows: unknown[][]): Buffer => {
  const lines = [formatCsvHeaderRow(headers), ...rows.map(formatCsvRow)];
  return Buffer.from(`${CSV_UTF8_BOM}${lines.join('\r\n')}\r\n`, 'utf8');
};

export type AdminExportFormatForFilename = 'csv' | 'xlsx' | 'pdf';

const sanitizeDateToken = (value: string): string | null => {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const buildExportFilename = (input: {
  domain: string;
  format: AdminExportFormatForFilename;
  exportedAt?: Date;
  dateFrom?: string;
  dateTo?: string;
}): string => {
  const extension =
    input.format === 'xlsx' ? 'xlsx' : input.format === 'pdf' ? 'pdf' : 'csv';
  const from = input.dateFrom ? sanitizeDateToken(input.dateFrom) : null;
  const to = input.dateTo ? sanitizeDateToken(input.dateTo) : null;

  if (from && to) {
    return `impactloop-${input.domain}-${from}-to-${to}.${extension}`;
  }

  const date = (input.exportedAt ?? new Date()).toISOString().slice(0, 10);
  return `impactloop-${input.domain}-${date}.${extension}`;
};

export const buildContentDisposition = (filename: string): string => {
  const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, '');
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
};
