const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TATWEEL = /\u0640/gu;
const ARABIC_ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671]/gu;

/**
 * Matching-only normalizer for supplier material names.
 * Stronger Arabic + punctuation folding than storage `normalizeSearchText`,
 * without rewriting persisted MaterialType.normalizedName values.
 */
export const normalizeMaterialReferenceText = (value: string): string => {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(TATWEEL, '')
    .replace(ARABIC_DIACRITICS, '')
    .replace(ARABIC_ALEF_VARIANTS, 'ا')
    .replace(/ى/gu, 'ي')
    .replace(/_/gu, ' ')
    .replace(/\s*&\s*/gu, ' and ')
    .replace(/[／⁄]/gu, '/')
    .replace(/[“”„‟"'`]/gu, '')
    .replace(/[^\p{L}\p{N}\s./-]/gu, ' ')
    .replace(/\s*-\s*/gu, '-')
    .replace(/\s*\.\s*/gu, '.')
    .replace(/\s+/gu, ' ')
    .trim();
};

/** Compact form for model-number equality (hc-sr04 === hc sr04). */
export const compactMaterialReferenceText = (value: string): string =>
  normalizeMaterialReferenceText(value).replace(/[\s./-]+/gu, '');

/**
 * Tokens used for mixed Arabic/English model matching.
 * Drops ultra-short / over-broad tokens that cause false positives.
 */
export const tokenizeMaterialReferenceText = (value: string): string[] => {
  const normalized = normalizeMaterialReferenceText(value);
  if (!normalized) {
    return [];
  }

  const blocked = new Set([
    'motor',
    'motors',
    'sensor',
    'sensors',
    'board',
    'boards',
    'driver',
    'drivers',
    'module',
    'modules',
    'cable',
    'bridge',
    'channel',
    'gear',
    'metal',
    'micro',
    'kit',
    'starter',
    'with',
    'and',
    'for',
    'the',
    'مع',
    'من',
    'على',
    'في',
  ]);

  return normalized
    .split(/[\s./-]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !blocked.has(token));
};
