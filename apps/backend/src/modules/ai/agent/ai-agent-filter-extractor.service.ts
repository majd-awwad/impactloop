import type { z } from 'zod';

import type {
  matchProjectsByOwnedMaterialsInputSchema,
  searchAvailableMaterialsInputSchema,
} from './ai-tool.types.js';
import {
  extractBoundedMaxPrice,
  extractRequestedResultCount,
  stripBenignListPrefixForParsing,
} from './ai-agent-number-parser.service.js';

export type MaterialSearchFilters = Partial<
  z.infer<typeof searchAvailableMaterialsInputSchema>
>;

const normalize = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');

export const normalizeArabicVariants = (text: string): string =>
  text
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');

const includesAny = (text: string, terms: string[]): boolean =>
  terms.some((term) => text.includes(term.toLowerCase()));

const FREE_SYNONYMS = [
  'مجاني',
  'مجانية',
  'مجانًا',
  'مجانا',
  'مجانيه',
  'ببلاش',
  'فري',
  'فريي',
  'free',
  'no cost',
  'بدون سعر',
  'بدون تكلفة',
  'ما عليها سعر',
  'ما بدها مصاري',
  'ما بدهاش مصاري',
  'without cost',
  'zero price',
];

const PAID_SYNONYMS = ['مدفوع', 'بسعر', 'paid', 'with price'];

const MATERIAL_NOUNS = [
  'مواد',
  'مادة',
  'أشياء',
  'اشياء',
  'شغلات',
  'شغله',
  'قطع',
  'قِطع',
  'إشي',
  'اشي',
  'materials',
  'material',
  'supplies',
  'supply',
  'stuff',
  'parts',
  'pieces',
];

const SEARCH_VERBS = [
  'اعرض',
  'اعرضلي',
  'ورّيني',
  'وريني',
  'ورجيني',
  'هاتلي',
  'هات',
  'طلعلي',
  'طلع',
  'بدي',
  'بدّي',
  'شو في',
  'ايش في',
  'عندكم',
  'عندك',
  'في عندكم',
  'show',
  'find',
  'search',
  'list',
  'browse',
  'look for',
  'give me',
  'show me',
  'available',
  'متاح',
  'متاحة',
  'متوفر',
  'متوفره',
  'متوفرة',
];

const AVAILABILITY_TERMS = [
  'متوفر',
  'متوفره',
  'متوفرة',
  'متاح',
  'متاحة',
  'متوفرة',
  'موجود',
  'موجودة',
  'available',
  'in stock',
  'هالفترة',
  'هالفتره',
  'حاليا',
  'حاليًا',
  'الان',
  'الآن',
];

const NEAR_TERMS = [
  'near me',
  'nearby',
  'close to me',
  'around me',
  'قريب مني',
  'قريبة مني',
  'قريب علي',
  'قريب عليّ',
  'جنبي',
  'بالقرب',
  'حوالي',
  'حواليّ',
  'حواليني',
  'حولي',
];

const DELIVERY_TERMS = ['delivery', 'توصيل', 'بيوصل', 'deliver'];
const PICKUP_TERMS = ['pickup', 'استلام', 'self pickup', 'self-pickup'];

const CATEGORY_SYNONYMS: Array<{ terms: string[]; categoryText: string }> = [
  {
    terms: [
      'electronics',
      'electronic',
      'إلكترون',
      'الكترون',
      'إلكترونيات',
      'الكترونيات',
      'الالكترونيات',
      'الكترونيه',
      'دوائر كهربائية',
      'دوائر كهربائيه',
      'دوائر',
      'كهربائية',
      'كهربائيه',
    ],
    categoryText: 'electronics',
  },
  { terms: ['wood', 'خشب', 'نجارة', 'plywood'], categoryText: 'wood' },
  { terms: ['fabric', 'textile', 'قماش', 'خياطة'], categoryText: 'fabric' },
  { terms: ['plastic', 'بلاستيك'], categoryText: 'plastic' },
  { terms: ['metal', 'معدن', 'معادن'], categoryText: 'metal' },
];

const ITEM_QUERY_STOPWORDS = new Set(
  [
    ...SEARCH_VERBS,
    ...MATERIAL_NOUNS,
    ...AVAILABILITY_TERMS,
    ...FREE_SYNONYMS,
    ...PAID_SYNONYMS,
    ...NEAR_TERMS,
    ...DELIVERY_TERMS,
    ...PICKUP_TERMS,
    'available',
    'materials',
    'material',
    'مواد',
    'مادة',
    'أشياء',
    'اشياء',
    'متوفرة',
    'متاحة',
    'موجودة',
    'موجود',
    'تكون',
    'وتكون',
    'ورجيني',
    'وريني',
    'لي',
    'و',
    'في',
    'من',
    'على',
    'the',
    'for',
    'me',
    'under',
    'below',
    'شيكل',
    'nis',
    'تحت',
    'أقل',
    'اقل',
    'بحدود',
    'شو',
    'في',
    '؟',
    'electronics',
    'إلكترون',
    'الكترون',
    'إلكترونيات',
    'الكترونيات',
    'خشب',
    'wood',
    'delivery',
    'توصيل',
    'pickup',
    'استلام',
    'near',
    'قريب',
    'قريبة',
    'مني',
    'حوالي',
    'نابلس',
    'nablus',
    'رام الله',
    'ramallah',
    'رفيديا',
    'rafidia',
    'علاقة',
    'علاقه',
    'الها',
    'لها',
    'بتحتوي',
    'تحتوي',
    'بال',
    'بالا',
    'طيب',
    'related',
    'about',
    'هالفترة',
    'هالفتره',
    'حاليا',
    'حاليًا',
    'لل',
    'ال',
    'الالكترونية',
    'الإلكترونية',
    'الكترونية',
    'إلكترونية',
    'الدوائر',
    'دوائر',
    'عندكم',
    'عندك',
  ].map((term) => term.toLowerCase()),
);

const MATERIAL_RELATION_PATTERNS = [
  /(مواد|materials?).*(علاقة|علاقه|related|about|لل|ل|ب|في|تحتوي|بتحتوي)/i,
  /(شغلات|اشياء|أشياء|قطع).*(الكترون|إلكترون|electronics|arduino|خشب|wood|دوائر)/i,
  /(عندكم|عندك|في عندكم|do you have|have any).*(مواد|material|breadboard|arduino|حساس|شغلات|قطع)/i,
  /(شغلات|قطع).*(متاح|متوفر|available|هالفترة)/i,
  /(قطع|شغلات).*(مع|لل|ل|with).*(arduino|أردوينو|اردوينو)/i,
  /(مواد|شغلات|قطع).*(ببلاش|مجاني|free)/i,
  /(إشي|اشي|شي).*(مجاني|free|جنبي|قريب)/i,
];

const ARABIC_NUMBER_WORDS: Record<string, number> = {};

const extractMaxPrice = (text: string): number | undefined =>
  extractBoundedMaxPrice(text);

const extractCityArea = (text: string): { city?: string; area?: string } => {
  if (/nablus|نابلس/i.test(text)) {
    return { city: 'Nablus' };
  }
  if (/ramallah|رام الله|ال بireh|البيرة/i.test(text)) {
    return { city: 'Ramallah' };
  }
  if (/rafidia|رفيديا/i.test(text)) {
    return { area: 'Rafidia', city: 'Nablus' };
  }

  const cityMatch = text.match(
    /(?:in|at|near|around|ب|في|حوالي)\s+([a-z\u0600-\u06ff]{3,40})/i,
  );
  if (
    cityMatch?.[1] &&
    !includesAny(cityMatch[1], [
      'me',
      'مني',
      'مواد',
      'مادة',
      'اشياء',
      'أشياء',
      'عندكم',
      'عندك',
      'شغلات',
      'قطع',
      'الدوائر',
      'دوائر',
      'متاح',
      'متوفر',
      'هالفترة',
    ])
  ) {
    return { city: cityMatch[1].trim() };
  }

  return {};
};

export const extractMaterialSearchFilters = (
  userMessage: string,
): MaterialSearchFilters => {
  const normalized = normalize(userMessage);
  const filters: MaterialSearchFilters = {
    limit: extractRequestedResultCount(userMessage) ?? 10,
  };

  if (includesAny(normalized, FREE_SYNONYMS)) {
    filters.isFree = true;
  }

  if (includesAny(normalized, PAID_SYNONYMS) && filters.isFree !== true) {
    filters.isFree = false;
  }

  const maxPrice = extractMaxPrice(normalized);
  if (maxPrice != null) {
    filters.maxPrice = maxPrice;
  }

  if (includesAny(normalized, NEAR_TERMS)) {
    filters.nearLearner = true;
    filters.sort = 'nearest';
  }

  if (includesAny(normalized, DELIVERY_TERMS)) {
    filters.deliveryAllowed = true;
  }

  if (includesAny(normalized, PICKUP_TERMS)) {
    filters.pickupAllowed = true;
  }

  for (const category of CATEGORY_SYNONYMS) {
    const normalizedArabic = normalizeArabicVariants(normalized);
    if (
      includesAny(normalized, category.terms) ||
      includesAny(normalizedArabic, category.terms.map((t) => normalizeArabicVariants(t)))
    ) {
      filters.categoryText = category.categoryText;
      break;
    }
  }

  const location = extractCityArea(userMessage);
  if (location.city) {
    filters.city = location.city;
  }
  if (location.area) {
    filters.area = location.area;
  }

  if (includesAny(normalized, ['arduino', 'اردوينو', 'أردوينو'])) {
    filters.categoryText = filters.categoryText ?? 'electronics';
    filters.query = filters.query ?? 'Arduino';
  }

  if (
    /(مع|لل|ل|with|for|بتنفع\s+ل|تنفع\s+ل).*(arduino|اردوينو|أردوينو)/i.test(
      userMessage,
    ) ||
    /(arduino|اردوينو|أردوينو).*(قطع|شغلات|مواد|parts|materials)/i.test(userMessage)
  ) {
    filters.categoryText = filters.categoryText ?? 'electronics';
    filters.query = filters.query ?? 'Arduino';
  }
  if (includesAny(normalized, ['sensor', 'sensors', 'حساس', 'حساسات'])) {
    filters.query = filters.query ?? 'sensor';
  }
  if (includesAny(normalized, ['motor', 'motors', 'محرك', 'محركات', 'dc motor'])) {
    filters.query = filters.query ?? 'motor';
  }
  if (includesAny(normalized, ['breadboard', 'بريدبورد'])) {
    filters.query = filters.query ?? 'breadboard';
  }
  if (includesAny(normalized, ['plywood', 'acrylic'])) {
    filters.query = filters.query ?? normalized.match(/plywood|acrylic/i)?.[0];
  }

  return filters;
};

const isLowQualityMaterialQuery = (query: string): boolean => {
  const normalized = normalizeArabicVariants(normalize(query));
  if (!normalized) {
    return true;
  }

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }

  return tokens.every(
    (token) =>
      token.length <= 3 ||
      ITEM_QUERY_STOPWORDS.has(token) ||
      /^(لل|ال|في|من|مع|و|هال|هذا|هذه)$/u.test(token),
  );
};

export const extractMaterialItemQuery = (
  userMessage: string,
  filters: MaterialSearchFilters,
): string | undefined => {
  if (filters.query) {
    return filters.query;
  }

  let working = normalize(userMessage);
  for (const term of [
    ...SEARCH_VERBS,
    ...MATERIAL_NOUNS,
    ...AVAILABILITY_TERMS,
    ...FREE_SYNONYMS,
    ...PAID_SYNONYMS,
    ...NEAR_TERMS,
    ...DELIVERY_TERMS,
    ...PICKUP_TERMS,
    ...CATEGORY_SYNONYMS.flatMap((entry) => entry.terms),
  ]) {
    working = working.replace(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
  }

  working = working
    .replace(/\b\d+\b/g, ' ')
    .replace(/(?:under|below|max|تحت|أقل|اقل|شيكل|nis)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = working
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !ITEM_QUERY_STOPWORDS.has(token));

  if (tokens.length === 0) {
    return undefined;
  }

  if (
    filters.categoryText &&
    tokens.every(
      (token) => token.length <= 4 || ITEM_QUERY_STOPWORDS.has(token.toLowerCase()),
    )
  ) {
    return undefined;
  }

  const candidate = tokens.join(' ').slice(0, 120);
  if (isLowQualityMaterialQuery(candidate)) {
    return undefined;
  }

  return candidate;
};

const ITEM_QUERY_ALIASES: Record<string, string> = {
  حساسات: 'sensor',
  حساس: 'sensor',
  حساسه: 'sensor',
};

export const normalizeMaterialItemQuery = (
  query: string | undefined,
): string | undefined => {
  if (!query) {
    return undefined;
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return undefined;
  }

  const alias = ITEM_QUERY_ALIASES[trimmed.toLowerCase()];
  return alias ?? trimmed;
};

export const detectEducationalLearningIntent = (userMessage: string): boolean => {
  const normalized = normalize(userMessage);
  const educationalCue =
    /(كيف\s+(?:ب|أ)?ستخدم|how\s+(?:do\s+i|to)\s+use|اشرحلي|اشرح|explain|شو\s+هي|what\s+is|what\s+are|الفرق\s+بين|difference\s+between|احكيلي\s+كيف|teach\s+me)/i.test(
      normalized,
    );
  const platformSearchCue =
    /(اعرض|وريني|ورجيني|بدي|عندكم|عندك|show\s+me|find|search|available|متوفرة|مجاني|free|هل\s+عندكم)/i.test(
      normalized,
    );

  return educationalCue && !platformSearchCue;
};

export const detectComparisonFollowUpIntent = (userMessage: string): boolean => {
  const normalized = normalize(userMessage);
  const asksWhich =
    /(أي\s+واحدة|اي\s+واحدة|أي\s+واحد|اي\s+واحد|أي\s+مشروع|اي\s+مشروع|which\s+one|which\s+is)/i.test(
      normalized,
    ) ||
    /^(أي|اي)\s+(أرخص|ارخص|أقرب|اقرب|أسهل|اسهل|أقل|اقل)/i.test(userMessage);

  const namesCriterion =
    /(أرخص|ارخص|أقرب|اقرب|أسهل|اسهل|cheaper|closer|nearest|easier|easiest|أقل وقت|وقته أقل|وقت أقل|مدته أقل|مدة أقل|shorter|less time|takes less time|which one is shorter|أسرع|مين بخلص أسرع|مبتدئ|beginner|أنسب للمبتدئ|انسب للمبتدئ|مكوناته متوفرة|أكثر مكونات|more components|أقل مكونات|fewer components|أقل خطوات|fewer steps|وقت أقصر|وقت اقصر|بوقت أقصر)/i.test(
      userMessage,
    );

  return asksWhich && namesCriterion;
};

export const detectMaterialDetailsIntent = (userMessage: string): boolean => {
  const normalized = normalize(userMessage);
  return (
    (/(details?|info|more about|تفاصيل|معلومات)/i.test(userMessage) &&
      /(مادة|مواد|material)/i.test(normalized)) ||
    /(احكيلي|اخبرني|tell me|حكيلي).*(عن|about).*(مادة|مواد|material)/i.test(
      userMessage,
    ) ||
    (/(احكيلي|اخبرني|tell me|حكيلي)/i.test(userMessage) &&
      /(أول|الاول|اول|first|second|ثاني|الثاني)/i.test(userMessage) &&
      /(مادة|مواد|material)/i.test(normalized)) ||
    (/(احكيلي|اخبرني|حكيلي)/i.test(userMessage) &&
      /(مقارنة|comparison)/i.test(userMessage) &&
      /(أرخص|ارخص|أقرب|اقرب|أسهل|اسهل)/i.test(userMessage))
  );
};

export const detectActiveProjectBuildsIntent = (userMessage: string): boolean => {
  const normalized = normalize(userMessage);
  return (
    /\b(active|current|in progress|started)\b.*\b(build|builds|project|projects)\b/i.test(
      userMessage,
    ) ||
    /(بلشت فيها|بشتغل عليها|قيد التنفيذ|بدأت فيها|شغال عليها|بلشت فيه)/i.test(
      normalized,
    ) ||
    /(المشاريع).*(بلشت|بدأت|بشتغل|قيد التنفيذ|شغال)/i.test(normalized) ||
    /(مشاريعي).*(قيد|نشطة|active|بلشت)/i.test(normalized) ||
    /(اعرض|وريني|ورجيني).*(المشاريع).*(بلشت|بدأت|بشتغل)/i.test(normalized)
  );
};

export const detectMaterialSearchIntent = (userMessage: string): {
  detected: boolean;
  confidence: number;
} => {
  if (detectComparisonFollowUpIntent(userMessage)) {
    return { detected: false, confidence: 0.08 };
  }

  if (detectMaterialDetailsIntent(userMessage)) {
    return { detected: false, confidence: 0.1 };
  }

  if (
    /(مواد|materials?).*(متوفرة|متاحة|available|موجود)/i.test(userMessage) &&
    (/(مشروع|project)/i.test(userMessage) ||
      /(?:بدي|want to|i want to)\s+(?:أعمل|اعمل|build|make)/i.test(userMessage) ||
      /\b(build|make)\s+(?:the\s+)?[A-Za-z]/i.test(userMessage) ||
      /(هاد المشروع|هذا المشروع|this project|إله|له)/i.test(userMessage))
  ) {
    return { detected: false, confidence: 0.12 };
  }

  const normalized = normalize(userMessage);
  const hasMaterialNoun = includesAny(normalized, MATERIAL_NOUNS);
  const hasSearchVerb = includesAny(normalized, SEARCH_VERBS);
  const hasRelationPhrase = MATERIAL_RELATION_PATTERNS.some((pattern) =>
    pattern.test(userMessage),
  );
  const filters = extractMaterialSearchFilters(userMessage);
  const hasStructuredFilter =
    filters.isFree != null ||
    filters.maxPrice != null ||
    filters.nearLearner === true ||
    filters.deliveryAllowed === true ||
    filters.pickupAllowed === true ||
    Boolean(filters.categoryText) ||
    Boolean(filters.city) ||
    Boolean(filters.area) ||
    Boolean(filters.query);

  if (detectEducationalLearningIntent(userMessage)) {
    return { detected: false, confidence: 0.15 };
  }

  if (shouldDeferMaterialSearchForOwnedMaterialsProjectUse(userMessage)) {
    return { detected: false, confidence: 0.18 };
  }

  if (hasMaterialNoun && (hasSearchVerb || hasStructuredFilter || hasRelationPhrase)) {
    return { detected: true, confidence: hasStructuredFilter ? 0.96 : 0.9 };
  }

  if (hasRelationPhrase && hasStructuredFilter) {
    return { detected: true, confidence: 0.94 };
  }

  if (hasMaterialNoun && includesAny(normalized, AVAILABILITY_TERMS)) {
    return { detected: true, confidence: 0.88 };
  }

  if (hasSearchVerb && hasStructuredFilter) {
    return { detected: true, confidence: 0.84 };
  }

  if (hasStructuredFilter && includesAny(normalized, AVAILABILITY_TERMS)) {
    return { detected: true, confidence: 0.86 };
  }

  if (filters.categoryText && includesAny(normalized, [...SEARCH_VERBS, ...AVAILABILITY_TERMS, ...FREE_SYNONYMS])) {
    return { detected: true, confidence: 0.85 };
  }

  return { detected: false, confidence: 0.2 };
};

export const isExplicitMaterialSearchCommand = (userMessage: string): boolean => {
  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalize(parsedMessage);

  if (
    (/(مواد|materials?).*(متوفرة|متاحة|available|موجود)/i.test(normalized) ||
      (/\b(available|currently available)\b/i.test(normalized) &&
        /\b(materials?|listings?)\b/i.test(normalized))) &&
    (/(مشروع|project)/i.test(normalized) ||
      /(?:بدي|want to|i want to)\s+(?:أعمل|اعمل|build|make)/i.test(parsedMessage) ||
      /\b(build|make)\s+(?:the\s+)?[A-Za-z]/i.test(parsedMessage) ||
      /(إله|له|this project|the project)/i.test(parsedMessage) ||
      /\bhelp\s+me\s+(?:build|make)\b/i.test(parsedMessage))
  ) {
    return false;
  }

  if (
    /(?:اعرض|ورجيني|وريني|ورّيني|طلعلي|هاتلي|دور(?:لي)?\s+على|show\s+me|find|search\s+for|list|browse)\s+.*(?:مواد|مادة|materials?)/iu.test(
      parsedMessage,
    )
  ) {
    return true;
  }

  if (
    /(?:شو\s+في|ايش\s+في|what(?:'s| is)\s+available).*(?:مواد|materials?)/iu.test(
      parsedMessage,
    )
  ) {
    return true;
  }

  if (
    /(?:دور(?:لي)?\s+على|اعرض(?:لي)?)\s+.+\s+(?:موجود|متوفرة?|بالمنصة|available)/iu.test(
      parsedMessage,
    )
  ) {
    return true;
  }

  if (
    includesAny(normalized, NEAR_TERMS) &&
    includesAny(normalized, SEARCH_VERBS)
  ) {
    return true;
  }

  if (
    includesAny(normalized, MATERIAL_NOUNS) &&
    includesAny(normalized, [...SEARCH_VERBS, ...AVAILABILITY_TERMS, ...NEAR_TERMS])
  ) {
    return true;
  }

  if (
    /^(?:اعرض|ورجيني|وريني|show|find|search)\b/iu.test(parsedMessage) &&
    includesAny(normalized, MATERIAL_NOUNS)
  ) {
    return true;
  }

  return false;
};

export const shouldDeferMaterialSearchForOwnedMaterialsProjectUse = (
  userMessage: string,
): boolean => {
  if (detectEducationalLearningIntent(userMessage)) {
    return false;
  }

  if (isExplicitMaterialSearchCommand(userMessage)) {
    return false;
  }

  return (
    detectOwnedMaterialsProjectIntent(userMessage) ||
    detectOwnedMaterialsSemanticParaphrase(userMessage) ||
    detectBareOwnedMaterialsPossession(userMessage) ||
    detectOwnedMaterialsBuildFollowUp(userMessage) ||
    isAffirmativeOwnedMaterialsContinuation(userMessage) ||
    /fit\s+(?:an?\s+)?(?:impactloop\s+)?projects?/i.test(userMessage) ||
    (/(?:leftover|remaining)\s+components?/i.test(userMessage) &&
      /project/i.test(userMessage))
  );
};

export const detectBuildGapIntent = (userMessage: string): boolean => {
  const normalized = normalize(userMessage);
  return /(ناقص|ناقصني|نقص|missing|what.?s left|gap|يلزمني|باقي|ظل علي|شو ظل)/i.test(
    normalized,
  );
};

export const detectProjectComponentsIntent = (userMessage: string): boolean => {
  if (detectBuildGapIntent(userMessage)) {
    return false;
  }

  if (
    /fit\s+(?:an?\s+)?(?:impactloop\s+)?projects?/i.test(userMessage) ||
    /use\s+them\s+in\s+one\s+of\s+your\s+projects?/i.test(userMessage) ||
    (/(?:leftover|remaining)\s+components?/i.test(userMessage) &&
      /project/i.test(userMessage))
  ) {
    return false;
  }

  const normalized = normalize(userMessage);
  return (
    /(required components|components needed|components for|project components|what components|which parts)/i.test(
      userMessage,
    ) ||
    /(what|which).*(components|parts).*(need|required|for)/i.test(userMessage) ||
    /(مكونات|components).*(مطلوب|required|للمشروع|لمشروع|for project)/i.test(
      normalized,
    ) ||
    /(مواد|materials).*(مطلوب|required).*(مشروع|project)/i.test(normalized) ||
    /(شو|ما|اعرض).*(مكونات|components)/i.test(normalized) ||
    /(مكونات|components).*(مشروع|project)/i.test(normalized) ||
    /(شو|ما|أي|اي).*(لازم|محتاج|بده|بتحتاج).*(أجهز|اجهز|جهز|تحضير|تنفيذ|عمل)/i.test(
      normalized,
    ) ||
    /(أي|اي).*(قطع|مكونات).*(مطلوب|لازم|للمشروع|لمشروع)/i.test(normalized) ||
    /(شو|ما).*(بده|بتحتاج|محتاج).*(مشروع|project)/i.test(normalized) ||
    /(شو|ما)\s*(بده|بتحتاج|محتاج|مكوناته|القطع|لازم)/i.test(normalized) ||
    /(محتاج|لازم).*(عشان|ل).*(أعمل|انفذ|تنفيذ|بناء)/i.test(normalized) ||
    (/(عرضته|السابق|اللي\s+عرضته|فوق|obstacle|robot|روبوت|بوت)/i.test(userMessage) &&
      /(شو|ما)\s*(بده|محتاج|مكونات|لازم)/i.test(normalized))
  );
};

export type RecommendationSubtype =
  | 'MATERIALS'
  | 'PROJECTS'
  | 'NEXT_ACTIONS'
  | 'MIXED';

export const classifyRecommendationSubtype = (
  userMessage: string,
): RecommendationSubtype => {
  const normalized = normalize(userMessage);

  const explicitMaterials =
    (/(مواد|materials|احجز|reserve)/i.test(userMessage) &&
      /(اقترح|انصحني|بتنصحني|recommend|suggest)/i.test(userMessage)) ||
    /(اقترح|انصحني).*(مواد|materials)/i.test(userMessage);

  if (explicitMaterials) {
    return 'MATERIALS';
  }

  const nextActionCue =
    /(next step|continue build|اكمل|أكمل|الخطوة|خطوة|باقي|continue)/i.test(
      normalized,
    );

  if (nextActionCue) {
    return 'NEXT_ACTIONS';
  }

  const mixedCue =
    /(شو في اقتراحات|what recommendations|اقتراحات|suggestions)/i.test(
      userMessage,
    ) && !explicitMaterials;

  if (mixedCue) {
    return 'MIXED';
  }

  const projectOrActionCue =
    /(مشروع|project|مشاريع|أعمل|اعمل|أبدأ|ابدأ|what should i|build next|make)/i.test(
      userMessage,
    ) ||
    /(بتنصحني|انصحني|اقترح).*(أعمل|اعمل|ابدأ|أبدأ)/i.test(userMessage) ||
    /(حسب|بناءً على|based on).*(اهتمامات|interests)/i.test(userMessage);

  if (projectOrActionCue) {
    return 'PROJECTS';
  }

  if (/(recommend|suggest|انصحني|بتنصحني|اقترح)/i.test(userMessage)) {
    return 'PROJECTS';
  }

  return 'MATERIALS';
};

export const detectComponentMaterialMatchingIntent = (
  userMessage: string,
): boolean => {
  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalize(parsedMessage);
  return (
    /(لاقي|لاقيلي|find|match|suggest).*(مواد|materials).*(مكون|component|ناقص|missing)/i.test(
      normalized,
    ) ||
    /(مواد).*(مكون|ناقص|missing)/i.test(normalized) ||
    /(materials?).*(missing component|for the missing)/i.test(normalized) ||
    /^(.+?)\s*:\s*(?:لاقي|لاقيلي|find|match)/i.test(parsedMessage)
  );
};

export const hasContextualProjectMaterialReference = (userMessage: string): boolean =>
  /(هاد المشروع|هذا المشروع|هالمشروع|the project|this project|إله|له|لها|له؟)/i.test(
    userMessage,
  );

export const detectProjectBudgetEstimationFollowUp = (userMessage: string): boolean =>
  /(كم\s+بكلف|تكلفة|تكلفه|how\s+much|what.*cost|estimate|مجموع|مجموعهم|subtotal|السعر|احسب|احسبلي|قديش|أدفع|ادفع|pay|total)/i.test(
    userMessage,
  ) &&
  /(إله|له|لها|هم|هن|them|it|this project|the project|المواد|materials)/i.test(
    userMessage,
  );

export const detectProjectBudgetEstimationIntent = (
  userMessage: string,
): boolean => {
  if (detectEducationalLearningIntent(userMessage)) {
    return false;
  }
  if (detectOwnedMaterialsProjectIntent(userMessage)) {
    return false;
  }
  if (detectBuildGapIntent(userMessage)) {
    return false;
  }
  if (detectComponentMaterialMatchingIntent(userMessage)) {
    return false;
  }
  if (/(احجز|reserve|book)\b/i.test(userMessage)) {
    return false;
  }

  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalize(parsedMessage);

  const asksCost =
    /(كم\s+بكلف|تكلفة|تكلفه|سعر|السعر|احسب|احسبلي|how\s+much|cost|price|estimate|cheapest|pay|مجموع|مجموعهم|subtotal|budget|قديش|أدفع|ادفع|would\s+cost|would\s+pay)/i.test(
      normalized,
    ) || detectProjectBudgetEstimationFollowUp(userMessage);

  const asksForProject =
    /(مشروع|project)/i.test(normalized) ||
    extractProjectTitleQuery(userMessage) != null ||
    hasContextualProjectMaterialReference(userMessage) ||
    detectProjectBudgetEstimationFollowUp(userMessage) ||
    /(?:بدي|بدك|want to|i want to)\s+(?:أعمل|اعمل|build|make)/i.test(parsedMessage) ||
    /\b(build|make)\s+(?:the\s+)?[A-Za-z]/i.test(parsedMessage) ||
    /\bhelp\s+me\s+(?:build|make)\b/i.test(parsedMessage) ||
    /\bfor\s+(?:the\s+)?[A-Za-z][\w\s-]{2,}/i.test(parsedMessage);

  if (!asksCost || !asksForProject) {
    return false;
  }

  if (
    isExplicitMaterialSearchCommand(userMessage) &&
    !hasContextualProjectMaterialReference(userMessage) &&
    !/(how\s+much|cost|price|estimate|budget|تكلفة|كم\s+بكلف)/i.test(normalized)
  ) {
    return false;
  }

  return true;
};

export const detectProjectMaterialAvailabilityIntent = (
  userMessage: string,
): boolean => {
  if (detectProjectBudgetEstimationIntent(userMessage)) {
    return false;
  }
  if (detectEducationalLearningIntent(userMessage)) {
    return false;
  }
  if (detectOwnedMaterialsProjectIntent(userMessage)) {
    return false;
  }
  if (detectBuildGapIntent(userMessage)) {
    return false;
  }
  if (detectComponentMaterialMatchingIntent(userMessage)) {
    return false;
  }
  if (
    isExplicitMaterialSearchCommand(userMessage) &&
    !hasContextualProjectMaterialReference(userMessage)
  ) {
    return false;
  }
  if (/(احجز|reserve|book)\b/i.test(userMessage)) {
    return false;
  }

  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalize(parsedMessage);

  if (
    /(مشروعي|my project|my build|بنيت|build checklist|قائمة البناء)/i.test(
      normalized,
    ) &&
    /(ناقص|missing|checklist|قائمة)/i.test(normalized)
  ) {
    return false;
  }

  const isSelectionFollowUp =
    detectProjectMaterialAvailabilitySelectionFollowUp(userMessage);

  const asksAvailableMaterials =
    /(مواد|materials?|listings?|مكونات).*(متوفرة|متاحة|available|موجود)/i.test(
      normalized,
    ) ||
    /(شو|what).*(موجود|available|can i get|can get|بلاقي|find).*(مواد|materials?|listings?|مكونات|platform|منصة|impactloop)/i.test(
      normalized,
    ) ||
    (/(بالمنصة|on impactloop|on the platform|here|عندكم)/i.test(normalized) &&
      /(مواد|materials?|listings?|مكونات)/i.test(normalized)) ||
    isSelectionFollowUp;

  const asksForProject =
    /(مشروع|project)/i.test(normalized) ||
    extractProjectTitleQuery(userMessage) != null ||
    hasContextualProjectMaterialReference(userMessage) ||
    /(?:بدي|بدك|want to|i want to)\s+(?:أعمل|اعمل|build|make)/i.test(parsedMessage) ||
    /\b(build|make)\s+(?:the\s+)?[A-Za-z]/i.test(parsedMessage) ||
    /\bhelp\s+me\s+(?:build|make)\b/i.test(parsedMessage) ||
    isSelectionFollowUp;

  return asksAvailableMaterials && asksForProject;
};

export const shouldDeferMaterialSearchForProjectMaterialAvailability = (
  userMessage: string,
): boolean => detectProjectMaterialAvailabilityIntent(userMessage);

const GENERIC_COMPONENT_DESCRIPTOR_TITLES = new Set([
  'الناقصة',
  'الناقص',
  'missing',
  'missing components',
  'required',
  'المطلوبة',
  'المطلوب',
  'the missing',
  'the required',
]);

const PROJECT_QUERY_STOPWORDS = new Set(
  [
    'project',
    'projects',
    'build',
    'make',
    'available',
    'materials',
    'material',
    'the',
    'a',
    'an',
    'for',
    'مشروع',
    'مشاريع',
    'أعمل',
    'اعمل',
    'المواد',
    'المتوفرة',
    'متوفرة',
    'متاحة',
    'بدي',
    'شو',
    'ما',
    'لمشروع',
    'something',
    'anything',
    'available',
    'nice',
    'حلو',
    'حلوة',
    'beautiful',
    'cool',
  ].map((term) => term.toLowerCase()),
);

export const normalizeProjectQueryText = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tokenizeProjectQuery = (query: string): string[] => {
  const normalized = normalizeProjectQueryText(query);
  if (!normalized) {
    return [];
  }

  return [
    ...new Set(
      normalized
        .split(' ')
        .map((token) => token.trim())
        .filter((token) => token.length >= 2 && !PROJECT_QUERY_STOPWORDS.has(token)),
    ),
  ];
};

export const isGenericProjectBrowseQuery = (query: string): boolean => {
  const tokens = tokenizeProjectQuery(query);
  return tokens.length === 0;
};

export const detectProjectMaterialAvailabilitySelectionFollowUp = (
  userMessage: string,
): boolean => {
  const trimmed = stripBenignListPrefixForParsing(userMessage).trim();
  return /^(?:الأول|الاول|اول|أول|first|second|ثاني|الثاني|third|ثالث|الثالث|fourth|رابع)$/iu.test(
    trimmed,
  );
};

const isGenericComponentDescriptorTitle = (candidate: string): boolean => {
  const normalized = candidate
    .trim()
    .replace(/[؟?.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (GENERIC_COMPONENT_DESCRIPTOR_TITLES.has(normalized)) {
    return true;
  }
  return /^(ال)?ناقص(ة|ين|ات)?$/i.test(normalized) || /^missing$/i.test(normalized);
};

export const extractProjectTitleQuery = (userMessage: string): string | undefined => {
  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const actionFirstColon = parsedMessage.match(
    /(?:لاقي|لاقيلي|find|match|مواد).+?:\s*(.+)$/i,
  );
  const actionFirstTitle = actionFirstColon?.[1]?.trim();
  if (
    actionFirstTitle &&
    actionFirstTitle.length >= 3 &&
    !isGenericComponentDescriptorTitle(actionFirstTitle)
  ) {
    return actionFirstTitle
      .replace(/[؟?.!]+$/g, '')
      .replace(/\s+/g, ' ')
      .slice(0, 120);
  }

  const patterns = [
    /(?:اعرض|افتح|ورجيني|ورّيني|وريني|اطلعلي|هاتلي|بدي\s+أشوف|بدي\s+اشوف)\s+(?:لي\s+)?(?:مشروع|project)\s+(.+?)(?:\?|$)/iu,
    /(?:show\s+me|open)\s+(?:the\s+)?(?:مشروع|project)\s+(.+?)(?:\?|$)/i,
    /(?:بدي|بدك|biddi|want to|i want to)\s+(?:أعمل|اعمل|build|make)\s+(.+?)(?:[،,]|$|\?|شو|what|ما)/i,
    /^(.+?)\s*:\s*(?:لاقي|لاقيلي|find|match)/i,
    /^(.+?)\s+(?:شو|ما|أي|اي)\s+(?:لازم|محتاج|بده|بتحتاج|قطع|مكونات)/i,
    /^(.+?)[؟?]\s*(?:أي|اي|what|which)/i,
    /^([A-Za-z][A-Za-z0-9\s&.-]{2,80})\s+[\u0600-\u06FF]/u,
    /^(.+?)\s+(?:شو|ما)\s+(?:مكونات|components)/i,
    /(?:بمشروع|لمشروع|للمشروع|for project|project)\s+(.+?)(?:\?|$)/i,
    /\bfor\s+(?:the\s+)?([A-Za-z][A-Za-z0-9\s&.-]{2,80}?)(?:\s+cost)?(?:\?|$)/i,
    /(?:مشروع|project)\s+(.+?)(?:\?|$)/i,
    /(?:مكونات|components)\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of patterns) {
    const match = parsedMessage.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && candidate.length >= 3) {
      const normalized = candidate
        .replace(/^(المطلوبة|المطلوب|required|the)\s+/i, '')
        .replace(/\s+من\s+المنصة$/i, '')
        .replace(/[؟?.!]+$/g, '')
        .replace(/\s+/g, ' ')
        .slice(0, 120);
      if (isGenericComponentDescriptorTitle(normalized)) {
        continue;
      }
      return normalized;
    }
  }

  return undefined;
};

export const mergeMaterialSearchPlan = (
  userMessage: string,
): z.infer<typeof searchAvailableMaterialsInputSchema> => {
  const filters = extractMaterialSearchFilters(userMessage);
  const extractedQuery = extractMaterialItemQuery(userMessage, filters);
  const query = normalizeMaterialItemQuery(filters.query ?? extractedQuery);
  const plan: z.infer<typeof searchAvailableMaterialsInputSchema> = {
    limit: filters.limit ?? 10,
  };

  if (query) {
    plan.query = query;
  }
  if (filters.categoryText) {
    plan.categoryText = filters.categoryText;
  }
  if (filters.isFree != null) {
    plan.isFree = filters.isFree;
  }
  if (filters.maxPrice != null) {
    plan.maxPrice = filters.maxPrice;
  }
  if (filters.minPrice != null) {
    plan.minPrice = filters.minPrice;
  }
  if (filters.nearLearner != null) {
    plan.nearLearner = filters.nearLearner;
  }
  if (filters.maxDistanceKm != null) {
    plan.maxDistanceKm = filters.maxDistanceKm;
  }
  if (filters.city) {
    plan.city = filters.city;
  }
  if (filters.area) {
    plan.area = filters.area;
  }
  if (filters.pickupAllowed != null) {
    plan.pickupAllowed = filters.pickupAllowed;
  }
  if (filters.deliveryAllowed != null) {
    plan.deliveryAllowed = filters.deliveryAllowed;
  }
  if (filters.sort) {
    plan.sort = filters.sort;
  }

  return plan;
};

export const messageImpliesFreeFilter = (userMessage: string): boolean =>
  includesAny(normalize(userMessage), FREE_SYNONYMS);

const OWNED_MATERIALS_OWNERSHIP_CUES = [
  'عندي',
  'معي',
  'معاي',
  'لقيت',
  'وجدت',
  'i have',
  "i've got",
  'i got',
  'i found',
  'with my',
  'leftover',
];

const OWNED_MATERIALS_BUILD_CUES = [
  'شو أقدر أعمل',
  'شو اقدر اعمل',
  'شو مشروع مناسب',
  'شو بقدر أبني',
  'شو بقدر ابني',
  'شو مشاريع',
  'مشاريع باستخدام',
  'شو مشروع',
  'ايش أقدر أعمل',
  'إيش أقدر أعمل',
  'what can i build',
  'what can i make',
  'what projects',
  'projects using',
  'what can i do with',
  'what can we build',
  'build using',
  'make with',
  'what can you build',
];

const OWNED_MATERIALS_NEGATIVE_OWNERSHIP_CUES = [
  'ما عندي',
  'مش عندي',
  "don't have",
  'do not have',
];

const OWNED_MATERIAL_GENERIC_BLOCKLIST = new Set(
  [
    'material',
    'materials',
    'component',
    'components',
    'board',
    'item',
    'items',
    'part',
    'parts',
    'piece',
    'pieces',
    'stuff',
    'مادة',
    'مواد',
    'قطعة',
    'قطع',
    'مكوّن',
    'مكون',
    'مكونات',
    'لوح',
    'شيء',
    'اشي',
    'إشي',
  ].map((term) => normalizeArabicVariants(normalize(term))),
);

const OWNED_MATERIAL_ALIAS_GROUPS: string[][] = [
  ['arduino', 'arduino uno', 'arduino nano', 'اردوينو', 'أردوينو'],
  ['jumper wires', 'jumper wire', 'wires', 'wire', 'أسلاك', 'اسلاك', 'سلك'],
  ['cardboard', 'carton', 'كرتون', 'ورق مقوى'],
  ['led', 'leds', 'ليد'],
  ['resistor', 'resistors', 'مقاومة', 'مقاومات'],
  ['motor', 'dc motor', 'محرك', 'موتور'],
  ['breadboard', 'لوحة تجارب', 'بريدبورد'],
];

const normalizeOwnedMaterialLabel = (value: string): string =>
  normalizeArabicVariants(normalize(value));

const splitOwnedMaterialSegments = (segment: string): string[] =>
  segment
    .split(
      /\s+و\s+|\s+و(?=[\u0600-\u06FFa-zA-Z])|(?<=[a-zA-Z0-9])و(?=[\u0600-\u06FFa-zA-Z])|\s+and\s+|،|,|\/|\+/iu,
    )
    .map((part) =>
      part
        .trim()
        .replace(/^[وف]\s+/i, '')
        .replace(/[؟?.!]+$/g, '')
        .trim(),
    )
    .filter((part) => part.length > 0);

const extractOwnedMaterialsSegment = (userMessage: string): string | null => {
  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const patterns = [
    /(?:عندي|معي|معاي)\s+(.+?)(?:،|,|\s+)(?:شو|ما|ايش|إيش)\s+(?:أقدر|اقدر|بقدر)/iu,
    /(?:عندي|معي|معاي)\s+(.+?)(?:\?|؟|$)/iu,
    /(?:شو|ما)\s+(?:بقدر|أقدر|اقدر)\s+(?:أبني|ابني)\s+باستخدام\s+(.+?)(?:\?|؟|$)/iu,
    /(?:مشاريع|مشروع)\s+باستخدام\s+(.+?)(?:\?|؟|$)/iu,
    /\bi\s+have\s+(.+?)(?:\.|,|\s+)(?:what\s+can\s+i\s+(?:build|make)|what\s+projects)/iu,
    /what\s+(?:projects\s+can\s+i\s+make|can\s+i\s+(?:make|build))\s+with\s+(.+?)(?:\?|$)/iu,
    /what\s+can\s+i\s+do\s+with\s+(?:an\s+|a\s+|the\s+)?(.+?)(?:\?|$)/iu,
    /(?:what|which)\s+projects?\s+use\s+(?:an\s+|a\s+|the\s+)?(.+?)(?:\?|$)/iu,
    /what\s+project\s+uses\s+(?:an\s+|a\s+|the\s+)?(.+?)(?:\?|$)/iu,
    /projects?\s+that\s+use\s+(.+?)(?:\?|$)/iu,
    /projects?\s+using\s+(.+?)(?:\?|$)/iu,
    /what\s+can\s+i\s+build\s+using\s+(.+?)(?:\?|$)/iu,
  ];

  for (const pattern of patterns) {
    const match = parsedMessage.match(pattern);
    const segment = match?.[1]?.trim();
    if (segment && segment.length >= 2) {
      return segment
        .replace(/(?:فيها?|فيه)\s*$/iu, '')
        .replace(/[؟?.!]+$/g, '')
        .trim();
    }
  }

  return null;
};

export const detectOwnedMaterialsProjectIntent = (userMessage: string): boolean => {
  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalizeOwnedMaterialLabel(parsedMessage);

  if (
    OWNED_MATERIALS_NEGATIVE_OWNERSHIP_CUES.some((cue) =>
      normalized.includes(normalizeOwnedMaterialLabel(cue)),
    )
  ) {
    return false;
  }

  const hasOwnershipCue = OWNED_MATERIALS_OWNERSHIP_CUES.some((cue) =>
    normalized.includes(normalizeOwnedMaterialLabel(cue)),
  );
  const hasBuildCue = OWNED_MATERIALS_BUILD_CUES.some((cue) =>
    normalized.includes(normalizeOwnedMaterialLabel(cue)),
  );

  if (hasOwnershipCue && hasBuildCue) {
    return true;
  }

  if (
    /(?:شو|ما)\s+(?:بقدر|أقدر|اقدر)\s+(?:أبني|ابني)\s+باستخدام/i.test(parsedMessage) ||
    /(?:مشاريع|مشروع)\s+باستخدام/i.test(parsedMessage) ||
    /what\s+(?:projects\s+can\s+i\s+make|can\s+i\s+(?:make|build))\s+with/i.test(
      parsedMessage,
    ) ||
    /what\s+can\s+i\s+do\s+with/i.test(parsedMessage) ||
    /(?:what|which)\s+projects?\s+use/i.test(parsedMessage) ||
    /what\s+project\s+uses/i.test(parsedMessage) ||
    /projects?\s+that\s+use/i.test(parsedMessage) ||
    /projects?\s+using/i.test(parsedMessage) ||
    /what\s+can\s+i\s+build\s+using/i.test(parsedMessage)
  ) {
    return extractOwnedMaterialsSegment(parsedMessage) != null;
  }

  return false;
};

const isGenericOwnedMaterialLabel = (value: string): boolean => {
  const normalized = normalizeOwnedMaterialLabel(value);
  if (normalized.length === 0) {
    return true;
  }

  const tokens = normalized.split(/\s+/).filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => OWNED_MATERIAL_GENERIC_BLOCKLIST.has(token));
};

export const parseOwnedMaterialsFromMessage = (userMessage: string): string[] => {
  const segment = extractOwnedMaterialsSegment(userMessage);
  if (!segment) {
    return [];
  }

  const seen = new Set<string>();
  const materials: string[] = [];

  for (const raw of splitOwnedMaterialSegments(segment)) {
    const trimmed = raw.trim().slice(0, 80);
    if (trimmed.length === 0 || isGenericOwnedMaterialLabel(trimmed)) {
      continue;
    }

    const key = normalizeOwnedMaterialLabel(trimmed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    materials.push(trimmed);
    if (materials.length >= 12) {
      break;
    }
  }

  return materials;
};

export const parseOwnedMaterialsProjectInput = (
  userMessage: string,
): z.infer<typeof matchProjectsByOwnedMaterialsInputSchema> => {
  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalizeOwnedMaterialLabel(parsedMessage);
  const materials = parseOwnedMaterialsFromMessage(parsedMessage);
  const input: z.infer<typeof matchProjectsByOwnedMaterialsInputSchema> = {
    materials,
    limit: extractRequestedResultCount(parsedMessage) ?? 10,
  };

  if (includesAny(normalized, ['beginner', 'مبتدئ', 'مبتدئين'])) {
    input.difficulty = 'BEGINNER';
  } else if (includesAny(normalized, ['intermediate', 'متوسط'])) {
    input.difficulty = 'INTERMEDIATE';
  } else if (includesAny(normalized, ['advanced', 'متقدم'])) {
    input.difficulty = 'ADVANCED';
  }

  for (const entry of CATEGORY_SYNONYMS) {
    if (includesAny(normalized, entry.terms)) {
      input.category = entry.categoryText;
      break;
    }
  }

  return input;
};

export const ownedMaterialAliasGroups = () => OWNED_MATERIAL_ALIAS_GROUPS;

export const normalizeOwnedMaterialForMatching = normalizeOwnedMaterialLabel;

const dedupeOwnedMaterialLabels = (values: string[]): string[] => {
  const seen = new Set<string>();
  const materials: string[] = [];

  for (const raw of values) {
    const trimmed = raw.trim().slice(0, 80);
    if (trimmed.length === 0 || isGenericOwnedMaterialLabel(trimmed)) {
      continue;
    }

    const key = normalizeOwnedMaterialLabel(trimmed);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    materials.push(trimmed);
    if (materials.length >= 12) {
      break;
    }
  }

  return materials;
};

export const extractBareOwnedMaterialsFromMessage = (userMessage: string): string[] => {
  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const patterns = [
    /(?:عندي|معي|معاي|لقيت|وجدت)\s+(.+?)(?:،|,|\s+ب(?:نفع|قدر|أقدر|استفيد)|\?|؟|$)/iu,
    /\b(?:i\s+have|i\s+found|i\s+got|i've\s+got)\s+(.+?)(?:\?|\.|,|$)/iu,
  ];

  for (const pattern of patterns) {
    const match = parsedMessage.match(pattern);
    const segment = match?.[1]?.trim();
    if (!segment || segment.length < 2) {
      continue;
    }

    return dedupeOwnedMaterialLabels(
      splitOwnedMaterialSegments(
        segment.replace(/(?:فيها?|فيه)\s*$/iu, '').replace(/[؟?.!]+$/g, '').trim(),
      ),
    );
  }

  return [];
};

export const detectOwnedMaterialsBuildFollowUp = (userMessage: string): boolean => {
  if (detectEducationalLearningIntent(userMessage)) {
    return false;
  }

  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  return (
    /(?:شو|ما|ايش|إيش)\s+(?:بعمل|اعمل|أعمل|بقدر\s+أعمل|بقدر\s+اعمل)\s*(?:فيها?|فيه|بهم|بها)?/iu.test(
      parsedMessage,
    ) ||
    /what\s+(?:can|should|could)\s+(?:i|we)\s+do(?:\s+with\s+(?:them|these|it))?/iu.test(
      parsedMessage,
    ) ||
    /what\s+to\s+do\s+with/i.test(parsedMessage)
  );
};

export const detectOwnedMaterialsSemanticParaphrase = (userMessage: string): boolean => {
  if (detectEducationalLearningIntent(userMessage)) {
    return false;
  }

  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalizeOwnedMaterialLabel(parsedMessage);
  const hasOwnershipCue = OWNED_MATERIALS_OWNERSHIP_CUES.some((cue) =>
    normalized.includes(normalizeOwnedMaterialLabel(cue)),
  );
  if (!hasOwnershipCue) {
    return false;
  }

  return (
    /(?:مشروع|مشاريع|project|projects|build|make|اعمل|أعمل|استفيد|reuse|benefit|فيها?|فيه|فيهم|here)/iu.test(
      parsedMessage,
    ) && extractBareOwnedMaterialsFromMessage(userMessage).length > 0
  );
};

export const detectBareOwnedMaterialsPossession = (userMessage: string): boolean => {
  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalizeOwnedMaterialLabel(parsedMessage);

  if (
    OWNED_MATERIALS_NEGATIVE_OWNERSHIP_CUES.some((cue) =>
      normalized.includes(normalizeOwnedMaterialLabel(cue)),
    )
  ) {
    return false;
  }

  const hasOwnershipCue = OWNED_MATERIALS_OWNERSHIP_CUES.some((cue) =>
    normalized.includes(normalizeOwnedMaterialLabel(cue)),
  );
  if (!hasOwnershipCue) {
    return false;
  }

  if (detectOwnedMaterialsProjectIntent(userMessage)) {
    return false;
  }

  return extractBareOwnedMaterialsFromMessage(userMessage).length > 0;
};

export const isAffirmativeOwnedMaterialsContinuation = (userMessage: string): boolean => {
  const trimmed = userMessage.trim();
  return /^(?:آه|اه|أجل|ايوه|ايوا|نعم|ورجيني|ورّيني|أكيد|تمام|yes|yeah|yep|sure|ok|okay|please|go\s+ahead)(?:\s|[,.،]|$)/i.test(
    trimmed,
  );
};

const OWNED_MATERIALS_PROJECT_CONTEXT_MARKERS = [
  'مشاريع impactloop التي يمكن تنفيذها',
  'impactloop projects that use these materials',
  'ما المواد أو القطع المتوفرة لديك',
  'what materials or components do you have',
];

export const hasRecentOwnedMaterialsProjectContext = (input: {
  recentMessages?: Array<{ role: 'USER' | 'ASSISTANT'; text: string }>;
}): boolean => {
  if (!input.recentMessages?.length) {
    return false;
  }

  return input.recentMessages.slice(-6).some((message) => {
    const normalized = normalizeOwnedMaterialLabel(message.text);
    if (message.role === 'ASSISTANT') {
      return (
        OWNED_MATERIALS_PROJECT_CONTEXT_MARKERS.some((marker) =>
          normalized.includes(normalizeOwnedMaterialLabel(marker)),
        ) ||
        /(?:ما|what)\s+.*(?:المواد|materials|components)/i.test(message.text) ||
        /(?:محتار|not sure what).*(?:مشروع|project)/i.test(message.text)
      );
    }

    return /(?:بدي|أريد|want).*(?:مشروع|project)/i.test(message.text) &&
      /(?:محتار|مش عارف|not sure|confused)/i.test(message.text);
  });
};

export const resolveOwnedMaterialsFromConversation = (
  userMessage: string,
  recentMessages?: Array<{ role: 'USER' | 'ASSISTANT'; text: string }>,
): string[] => {
  const fromMessage = dedupeOwnedMaterialLabels([
    ...parseOwnedMaterialsFromMessage(userMessage),
    ...extractBareOwnedMaterialsFromMessage(userMessage),
  ]);
  if (fromMessage.length > 0) {
    return fromMessage;
  }

  if (!recentMessages?.length) {
    return [];
  }

  for (const message of [...recentMessages].reverse()) {
    if (message.role !== 'USER') {
      continue;
    }

    const materials = dedupeOwnedMaterialLabels([
      ...parseOwnedMaterialsFromMessage(message.text),
      ...extractBareOwnedMaterialsFromMessage(message.text),
    ]);
    if (materials.length > 0) {
      return materials;
    }
  }

  return [];
};
