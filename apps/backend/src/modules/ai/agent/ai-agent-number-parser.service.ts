const ARABIC_DIGITS: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

const WORD_TO_NUMBER: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  twentyfive: 25,
  thirty: 30,
  fifty: 50,
  hundred: 100,
  عشر: 10,
  عشرة: 10,
  خمسة: 5,
  خمس: 5,
  خمستعش: 15,
  خمسطعش: 15,
  خمسهعش: 15,
  خمسهعشر: 15,
  عشرين: 20,
  عشرينه: 20,
  خمسةوعشرين: 25,
  خمسهوعشرين: 25,
  خمسين: 50,
  مية: 100,
  مئه: 100,
  مئة: 100,
};

const MAX_PRICE = 10_000;

const normalizeNumberText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/[٠-٩]/g, (digit) => ARABIC_DIGITS[digit] ?? digit)
    .replace(/\s+/g, ' ')
    .trim();

const compactArabicWords = (text: string): string =>
  text.replace(/\s+/g, '').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

const parseCompoundArabicNumber = (text: string): number | undefined => {
  const compact = compactArabicWords(text);

  const fifteen =
    /(خمستعش|خمسطعش|خمسهعش|خمسهعشر|خمسةعشر|خمسه عشر)/u;
  if (fifteen.test(compact)) {
    return 15;
  }

  const twentyFive = /(خمسةوعشرين|خمسهوعشرين|خمسه وعشرين)/u;
  if (twentyFive.test(compact)) {
    return 25;
  }

  const twenty = /(عشرين|عشرينه)/u;
  if (twenty.test(compact)) {
    return 20;
  }

  const fifty = /(خمسين)/u;
  if (fifty.test(compact)) {
    return 50;
  }

  const hundred = /(مية|مئه|مئة)/u;
  if (hundred.test(compact)) {
    return 100;
  }

  const ten = /(عشر|عشره)/u;
  if (ten.test(compact)) {
    return 10;
  }

  const five = /(خمس|خمسه)/u;
  if (five.test(compact)) {
    return 5;
  }

  return undefined;
};

const parseEnglishNumberWord = (text: string): number | undefined => {
  const normalized = normalizeNumberText(text);

  const multiWordPatterns: Array<{ pattern: RegExp; value: number }> = [
    { pattern: /\bone\s+hundred\b/i, value: 100 },
    { pattern: /\btwenty\s+five\b/i, value: 25 },
    { pattern: /\bfifteen\b/i, value: 15 },
    { pattern: /\btwenty\b/i, value: 20 },
    { pattern: /\bfifty\b/i, value: 50 },
    { pattern: /\bten\b/i, value: 10 },
    { pattern: /\bfive\b/i, value: 5 },
  ];

  for (const entry of multiWordPatterns) {
    if (entry.pattern.test(normalized)) {
      return entry.value;
    }
  }

  return undefined;
};

const sanitizePrice = (value: number | undefined): number | undefined => {
  if (value == null || !Number.isFinite(value) || value < 0 || value > MAX_PRICE) {
    return undefined;
  }
  return value;
};

export const extractBoundedMaxPrice = (text: string): number | undefined => {
  const normalized = normalizeNumberText(text);

  const digitMatch = normalized.match(
    /(?:under|below|max|up to|تحت|أقل من|اقل من|اقل|أقل|بحدود|بسعر أقصاه|أقصاه|اقصاه|ما بتجاوز|ما يتجاوز|لا يتجاوز|لا تتجاوز|بتجاوز|يتجاوز)\s*(\d+(?:\.\d+)?)/i,
  );
  if (digitMatch?.[1]) {
    return sanitizePrice(Number(digitMatch[1]));
  }

  const priceCue =
    /(ما\s+بتجاوز|ما\s+يتجاوز|لا\s+يتجاوز|لا\s+تتجاوز|أقل\s+من|اقل\s+من|less\s+than|تحت|بحدود|under|below|max|up\s+to)/i;
  if (!priceCue.test(normalized)) {
    return undefined;
  }

  const compound = parseCompoundArabicNumber(normalized);
  if (compound != null) {
    return sanitizePrice(compound);
  }

  const english = parseEnglishNumberWord(normalized);
  if (english != null) {
    return sanitizePrice(english);
  }

  for (const [word, value] of Object.entries(WORD_TO_NUMBER)) {
    if (normalized.includes(word.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase())) {
      return sanitizePrice(value);
    }
    if (normalized.includes(word)) {
      return sanitizePrice(value);
    }
  }

  return undefined;
};

const MAX_RESULT_COUNT = 10;

export const stripBenignListPrefixForParsing = (text: string): string =>
  text.trim().replace(/^\s*[\d٠-٩]+[.)]\s*/u, '');

const sanitizeResultCount = (value: number | undefined): number | undefined => {
  if (value == null || !Number.isFinite(value) || value < 1) {
    return undefined;
  }

  return Math.min(Math.trunc(value), MAX_RESULT_COUNT);
};

export const extractRequestedResultCount = (text: string): number | undefined => {
  const raw = stripBenignListPrefixForParsing(text);
  const normalized = normalizeNumberText(raw);

  if (/مشروعين/u.test(raw) || /مادتين|مادتان/u.test(raw)) {
    return 2;
  }
  if (/(?:مشروع|ماده|مادة)\s*واحد|مشروع\s*واحده/u.test(raw)) {
    return 1;
  }
  if (/ثلاث(?:ة)?\s*(?:مشاريع|مواد)|٣\s*(?:مشاريع|مواد)/u.test(raw)) {
    return 3;
  }
  if (/\btwo\s+(?:projects?|materials?)/i.test(raw)) {
    return 2;
  }
  if (/\bone\s+(?:project|material)/i.test(raw)) {
    return 1;
  }
  if (/\bthree\s+(?:projects?|materials?)/i.test(raw)) {
    return 3;
  }

  const explicitCount =
    normalized.match(/\b(\d+)\s*(?:projects?|materials?|مشاريع|مواد|ماده|مادة)\b/i) ??
    normalized.match(/(?:اعرض|اعرضي|هات|show)\s*(?:لي|me)?\s*(\d+)/i);
  if (explicitCount?.[1]) {
    return sanitizeResultCount(Number(explicitCount[1]));
  }

  return undefined;
};
