const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TATWEEL = /\u0640/gu;
const ARABIC_ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671]/gu;

/**
 * Normalizes lookup text only. It does not assert that two values are
 * semantically equivalent; aliases and reviewed mapping rules do that.
 */
export const normalizeTaxonomyAlias = (value: string): string => {
  if (typeof value !== 'string') {
    throw new TypeError('Taxonomy aliases must be strings.');
  }

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
    .replace(/\s*\/\s*/gu, ' / ')
    .replace(/[“”„‟"'`]/gu, '')
    .replace(/[^\p{L}\p{N}\s./-]/gu, ' ')
    .replace(/\s*-\s*/gu, '-')
    .replace(/\s*\.\s*/gu, '.')
    .replace(/\s+/gu, ' ')
    .trim();
};

export const normalizeTaxonomyCanonicalKey = (value: string): string => {
  const normalized = normalizeTaxonomyAlias(value);

  return normalized.replace(/\s+/gu, '-');
};

export const isValidTaxonomyCanonicalKey = (value: string): boolean =>
  /^(interest|material-family|material-form|project-topic|component):[a-z0-9][a-z0-9./-]*$/u.test(
    value,
  );

export const taxonomyLanguageFor = (value: string): 'EN' | 'AR' =>
  /[\u0600-\u06FF]/u.test(value) ? 'AR' : 'EN';
