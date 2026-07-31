import ExcelJS from 'exceljs';

const FORMULA_PREFIX_PATTERN = /^[=+\-@\t]/;

/**
 * Convert export cell values for ExcelJS.
 *
 * Empty/missing values MUST be `null` (not `''`). Writing an empty string
 * creates a shared-string entry whose index is stored in `<v>`. When that
 * cell also has a date number format, Excel treats the shared-string index
 * as a date serial (e.g. index 34 → 1900-02-03).
 */
const guardCellValue = (
  value: unknown,
): string | number | boolean | Date | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value instanceof Date) {
    return value;
  }

  const text = String(value);
  if (text.length === 0) {
    return null;
  }

  if (FORMULA_PREFIX_PATTERN.test(text)) {
    return `'${text}`;
  }

  return text;
};

export const buildXlsxBuffer = async (input: {
  sheetName: string;
  headers: string[];
  rows: unknown[][];
  /** 1-based column indexes that should display as dates */
  dateColumnIndexes?: number[];
  /** 1-based column indexes that should wrap long text */
  wrapColumnIndexes?: number[];
}): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(input.sheetName);

  worksheet.addRow(input.headers);
  for (const row of input.rows) {
    worksheet.addRow(row.map(guardCellValue));
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };

  worksheet.views = [{ state: 'frozen', ySplit: 1 }];
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: input.headers.length },
  };

  const dateColumns = new Set(input.dateColumnIndexes ?? []);
  for (const columnIndex of dateColumns) {
    worksheet.getColumn(columnIndex).numFmt = 'yyyy-mm-dd hh:mm';
  }

  const wrapColumns = new Set(input.wrapColumnIndexes ?? []);
  for (const columnIndex of wrapColumns) {
    worksheet.getColumn(columnIndex).alignment = { wrapText: true, vertical: 'top' };
  }

  for (let columnIndex = 1; columnIndex <= input.headers.length; columnIndex += 1) {
    const column = worksheet.getColumn(columnIndex);
    const maxCellLength = Math.max(
      input.headers[columnIndex - 1]?.length ?? 10,
      ...input.rows.map((row) => String(row[columnIndex - 1] ?? '').length),
      10,
    );
    column.width = Math.min(
      wrapColumns.has(columnIndex) ? 48 : 48,
      Math.max(wrapColumns.has(columnIndex) ? 24 : 10, Math.min(maxCellLength, 48)),
    );
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
};
