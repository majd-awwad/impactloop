import { detectDirection, render as shapeAndReorderVisual } from 'bidi-shaper';

/**
 * Proven PDF text pipeline (do not revert to single-font / features:[] on logical text):
 *
 * 1. logical Unicode input
 * 2. bidi-shaper `render()` → visual-order Unicode (Arabic Presentation Forms + Latin/digits)
 * 3. segment visual string into arabic vs latin/number runs
 * 4. draw each run with the matching registered TTF (Noto Naskh / Noto Sans)
 * 5. pass `features: []` only for pre-shaped presentation forms so fontkit does not re-shape
 *
 * `render()` returns Unicode code points, never glyph indices. Never feed glyph IDs to doc.text().
 */

export type PdfScript = 'arabic' | 'latin';

export type PdfTextRun = {
  script: PdfScript;
  text: string;
};

export const ADMIN_EXPORT_PDF_LATIN_FONT = 'NotoSans';
export const ADMIN_EXPORT_PDF_ARABIC_FONT = 'NotoNaskhArabic';

const isArabicCodePoint = (cp: number): boolean =>
  (cp >= 0x0600 && cp <= 0x06ff) ||
  (cp >= 0x0750 && cp <= 0x077f) ||
  (cp >= 0x08a0 && cp <= 0x08ff) ||
  (cp >= 0xfb50 && cp <= 0xfdff) ||
  (cp >= 0xfe70 && cp <= 0xfeff);

export const isArabicScriptChar = (char: string): boolean => {
  const cp = char.codePointAt(0);
  return cp != null && isArabicCodePoint(cp);
};

export const isLatinOrNumberChar = (char: string): boolean => {
  const cp = char.codePointAt(0);
  if (cp == null) return false;
  if (isArabicCodePoint(cp)) return false;
  // ASCII letters, digits, common punctuation/symbols used in IDs/emails/dates.
  return (
    (cp >= 0x20 && cp <= 0x7e) ||
    (cp >= 0xa0 && cp <= 0xff) ||
    (cp >= 0x2000 && cp <= 0x206f) ||
    (cp >= 0x20a0 && cp <= 0x20cf)
  );
};

/** Detect contiguous Arabic vs non-Arabic runs on a logical (or visual) string. */
export const segmentPdfTextRuns = (text: string): PdfTextRun[] => {
  const runs: PdfTextRun[] = [];
  for (const char of text) {
    const script: PdfScript = isArabicScriptChar(char) ? 'arabic' : 'latin';
    const last = runs[runs.length - 1];
    if (last && last.script === script) {
      last.text += char;
    } else {
      runs.push({ script, text: char });
    }
  }
  return runs;
};

/**
 * Transform logical text into font-ready visual runs.
 * Numbers and reservation IDs stay in logical order inside LTR embeddings (UAX #9).
 */
export const prepareVisualPdfTextRuns = (logicalText: string): PdfTextRun[] => {
  const visual = shapeAndReorderVisual(logicalText);
  assertVisualTextIsUnicodeNotGlyphIds(visual);
  return segmentPdfTextRuns(visual);
};

export const fontNameForPdfScript = (script: PdfScript): string =>
  script === 'arabic'
    ? ADMIN_EXPORT_PDF_ARABIC_FONT
    : ADMIN_EXPORT_PDF_LATIN_FONT;

export const paragraphAlignForText = (
  logicalText: string,
): 'left' | 'right' =>
  detectDirection(logicalText) === 'rtl' ? 'right' : 'left';

/**
 * Guard: bidi-shaper must emit Unicode (incl. presentation forms), not raw glyph IDs
 * stuffed into the BMP as if they were characters.
 */
export const assertVisualTextIsUnicodeNotGlyphIds = (visual: string): void => {
  for (const char of visual) {
    const cp = char.codePointAt(0);
    if (cp == null) {
      throw new Error('PDF text pipeline produced an empty code point');
    }
    // Glyph IDs from Noto fonts are typically small integers; genuine text uses
    // ASCII, Arabic blocks, or Arabic Presentation Forms. Reject lone C0 controls
    // other than tab/newline that would indicate a corrupt transform.
    if (cp < 0x09 || (cp > 0x0d && cp < 0x20)) {
      throw new Error(
        `PDF text pipeline produced invalid control code U+${cp.toString(16)}`,
      );
    }
  }
};

export const visualContainsArabicPresentationForms = (visual: string): boolean => {
  for (const char of visual) {
    const cp = char.codePointAt(0)!;
    if (
      (cp >= 0xfb50 && cp <= 0xfdff) ||
      (cp >= 0xfe70 && cp <= 0xfeff)
    ) {
      return true;
    }
  }
  return false;
};

export const reservationIdLooksUnreversed = (
  logical: string,
  visual: string,
): boolean => {
  const idMatch = logical.match(/\bR-\d{4}-\d+\b/);
  if (!idMatch) return true;
  return visual.includes(idMatch[0]!);
};

export type MeasuredLine = {
  runs: PdfTextRun[];
  width: number;
};

export type MeasureRunWidth = (run: PdfTextRun) => number;

/** Wrap visual runs into lines that fit `maxWidth` without splitting mid-run when possible. */
export const wrapPdfTextRuns = (
  runs: PdfTextRun[],
  maxWidth: number,
  measure: MeasureRunWidth,
): MeasuredLine[] => {
  if (runs.length === 0) {
    return [{ runs: [], width: 0 }];
  }

  const lines: MeasuredLine[] = [];
  let current: PdfTextRun[] = [];
  let currentWidth = 0;

  const flush = () => {
    lines.push({ runs: current, width: currentWidth });
    current = [];
    currentWidth = 0;
  };

  const pushRun = (run: PdfTextRun) => {
    const width = measure(run);
    if (current.length > 0 && currentWidth + width > maxWidth) {
      flush();
    }
    if (width > maxWidth && run.text.length > 1) {
      // Hard-split oversized single run by code points.
      let chunk = '';
      for (const char of run.text) {
        const next = { script: run.script, text: chunk + char };
        const nextWidth = measure(next);
        if (chunk && nextWidth > maxWidth) {
          const piece = { script: run.script, text: chunk };
          if (current.length > 0 && currentWidth + measure(piece) > maxWidth) {
            flush();
          }
          current.push(piece);
          currentWidth += measure(piece);
          flush();
          chunk = char;
        } else {
          chunk += char;
        }
      }
      if (chunk) {
        const piece = { script: run.script, text: chunk };
        if (current.length > 0 && currentWidth + measure(piece) > maxWidth) {
          flush();
        }
        current.push(piece);
        currentWidth += measure(piece);
      }
      return;
    }

    current.push(run);
    currentWidth += width;
  };

  for (const run of runs) {
    // Prefer wrapping on spaces inside latin runs.
    if (run.script === 'latin' && run.text.includes(' ')) {
      const parts = run.text.split(/(\s+)/);
      for (const part of parts) {
        if (!part) continue;
        pushRun({ script: 'latin', text: part });
      }
    } else {
      pushRun(run);
    }
  }

  if (current.length > 0 || lines.length === 0) {
    flush();
  }

  return lines;
};
