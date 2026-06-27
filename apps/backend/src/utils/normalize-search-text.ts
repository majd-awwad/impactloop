const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;
const TATWEEL = /\u0640/g;

export const normalizeSearchText = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(TATWEEL, '')
    .replace(ARABIC_DIACRITICS, '')
    .replace(/\s+/g, ' ');
};
