import type { z } from 'zod';

import type {
  findProjectsWithinBudgetInputSchema,
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
      'إلكترونية',
      'الكترونية',
      'إلكترونيه',
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

const PRICE_FILTER_TERMS = [
  'وسعرها',
  'سعرها',
  'سعر',
  'أقل',
  'اقل',
  'شيكل',
  'شيكلات',
  'nis',
  'under',
  'below',
  'max',
  'maximum',
  'price',
];

export const isMaterialSearchNoiseQuery = (query: string | undefined): boolean => {
  if (!query?.trim()) {
    return true;
  }

  const normalized = normalizeArabicVariants(normalize(query));
  if (!normalized) {
    return true;
  }

  if (/(وسعرها|سعرها|شيكل|اقل|أقل)/i.test(normalized)) {
    return true;
  }

  if (/^(ية|يه|ه)$/iu.test(normalized)) {
    return true;
  }

  return isLowQualityMaterialQuery(query);
};

export const normalizeMaterialCategoryText = (
  categoryText: string | undefined,
): string | undefined => {
  if (!categoryText?.trim()) {
    return undefined;
  }

  const normalized = normalizeArabicVariants(normalize(categoryText));
  for (const category of CATEGORY_SYNONYMS) {
    if (
      category.terms.some(
        (term) =>
          normalizeArabicVariants(normalize(term)) === normalized ||
          normalized.includes(normalizeArabicVariants(normalize(term))),
      )
    ) {
      return category.categoryText;
    }
  }

  return categoryText.trim();
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
    ...PRICE_FILTER_TERMS,
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
  if (isMaterialSearchNoiseQuery(candidate)) {
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
  if (!query || isMaterialSearchNoiseQuery(query)) {
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

/**
 * Keyword/regex intent detectors in this module are used only by
 * `buildSemanticFallbackPlan` after semantic planner failure in production v2.
 * They must not be invoked as a primary routing path before Gemini.
 */
export type PlatformGuidanceTopic =
  | 'MATERIAL_RESERVATION'
  | 'SAVE_PROJECT'
  | 'MATERIAL_DELIVERY'
  | 'RESERVATION_AFTER_SUPPLIER'
  | 'GENERAL_PLATFORM';

const hasPlatformGuidanceHowToCue = (text: string, normalized: string): boolean =>
  /(كيف\s+(?:أ|ا)?(?:قدر|قدر|بقدر)|how\s+(?:can|do)\s+i|how\s+to|كيف\s+(?:أ|ا)?(?:حفظ|احفظ|احجز|اطلب|أطلب|أنشر|انشر)|what\s+(?:happens|is\s+the\s+process)|شو\s+بيصير|شو\s+بصير|ما\s+الخطوات|what\s+are\s+the\s+steps)/i.test(
    normalized,
  ) ||
  /(كيف\s+(?:أ|ا)?(?:قدر|قدر)|how\s+(?:can|do)\s+i)/i.test(text) ||
  /(شو\s+أعمل|شو\s+اعمل|what\s+(?:should|do)\s+i\s+do)/i.test(normalized);

export const LEARNER_RESERVATION_STATUS_QUERY_MARKER =
  'learnerReservationStatusQuery' as const;

export const isLearnerReservationStatusQueryPlan = (
  toolInput: Record<string, unknown> | undefined,
): boolean => toolInput?.[LEARNER_RESERVATION_STATUS_QUERY_MARKER] === true;

export const detectLearnerReservationStatusQuery = (
  userMessage: string,
): boolean => {
  const normalized = normalizeArabicVariants(normalize(userMessage));
  if (hasPlatformGuidanceHowToCue(userMessage, normalized)) {
    return false;
  }

  const asksOwnData =
    /(هل\s+عندي|do\s+i\s+have|show\s+my|list\s+my|my\s+reservations?)/i.test(
      normalized,
    );
  const mentionsReservations = /(حجوز|reservation)/i.test(normalized);

  return asksOwnData && mentionsReservations;
};

export const LEARNER_RESERVATION_TERMINAL_STATUSES = new Set([
  'EXPIRED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
]);

export const isLearnerPendingReservationQuery = (userMessage: string): boolean => {
  const normalized = normalizeArabicVariants(normalize(userMessage));
  return (
    /(معلقه|pending)/i.test(normalized) &&
    !/(كل|all|any|اي|أي)/i.test(normalized)
  );
};

export const isLearnerAllReservationsQuery = (userMessage: string): boolean => {
  const normalized = normalizeArabicVariants(normalize(userMessage));
  return /(كل\s+حجوزاتي|كل\s+حجوزات|all\s+my\s+reservations|every\s+reservation)/i.test(
    normalized,
  );
};

export const filterLearnerReservationsForStatusQuery = <
  T extends { status: string },
>(
  reservations: T[],
  scope: 'pending' | 'all',
): T[] => {
  if (scope === 'pending') {
    return reservations.filter((reservation) => reservation.status === 'PENDING');
  }

  return reservations;
};

export const detectSupplierPublishGuidanceIntent = (
  userMessage: string,
): boolean => {
  if (detectEducationalLearningIntent(userMessage)) {
    return false;
  }

  const normalized = normalizeArabicVariants(normalize(userMessage));
  if (isImperativePlatformAction(userMessage, normalized)) {
    return false;
  }

  const mentionsMaterial = /(مواد|مادة|ماده|materials?|listing)/i.test(normalized);
  const publishCue =
    /(أنشر|انشر|publish|listing|list\s+a\s+material|post\s+a\s+material)/i.test(
      normalized,
    );
  const howToCue = hasPlatformGuidanceHowToCue(userMessage, normalized);
  const supplierCue = /(supplier|مورد|بائع|vendor)/i.test(normalized);

  return mentionsMaterial && publishCue && (howToCue || supplierCue || /عندي/i.test(normalized));
};

export const detectAppMaterialNavigationGuidanceIntent = (
  userMessage: string,
): boolean => {
  if (detectEducationalLearningIntent(userMessage)) {
    return false;
  }

  const normalized = normalizeArabicVariants(normalize(userMessage));
  const hasAppContext =
    /(من\s+التطبيق|بالتطبيق|in\s+the\s+app|on\s+impactloop|impactloop|حجوزاتي|my\s+reservations)/i.test(
      normalized,
    );
  const navigationCue =
    /(وين\s+بروح|وين\s+أروح|أين\s+أذهب|اين\s+اذهب|where\s+(?:do\s+i\s+go|should\s+i\s+go|to\s+go))/i.test(
      normalized,
    );
  const materialCue = /(مواد|مادة|ماده|material)/i.test(normalized);
  const interestCue =
    /(عجبتني|عجبني|لقيت|وجدت|found|like|liked|interested)/i.test(normalized);

  return hasAppContext && navigationCue && materialCue && interestCue;
};

export const isMaterialUseContextQuery = (userMessage: string): boolean =>
  /(?:مع|لل|لـ|ل\s|with|for|usable\s+with|use\s+with|أستخدمها\s+مع|للاردو|لأردو|للاردنو)\s*(?:arduino|اردو|أردو|اردنو|esp32|robot|روبوت)/i.test(
    userMessage,
  ) ||
  /(?:arduino|اردو|أردو|اردنو).*(?:مواد|materials|قطع|parts)/i.test(userMessage);

export const detectProjectSearchIntent = (userMessage: string): boolean => {
  if (detectEducationalLearningIntent(userMessage)) {
    return false;
  }
  if (detectProjectsWithinBudgetIntent(userMessage)) {
    return false;
  }

  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalize(parsedMessage);
  const asksProjects = /(مشاريع|projects)/i.test(normalized);
  const searchCue =
    includesAny(normalized, SEARCH_VERBS) ||
    /(مناسبة|suitable|for\s+beginners?|مبتدئ|beginner)/i.test(normalized);

  return asksProjects && searchCue;
};

export const hasTrustedProjectMaterialContext = (userMessage: string): boolean => {
  if (hasContextualProjectMaterialReference(userMessage)) {
    return true;
  }

  if (isMaterialUseContextQuery(userMessage)) {
    return false;
  }

  if (isExplicitMaterialSearchCommand(userMessage)) {
    return false;
  }

  if (detectProjectSearchIntent(userMessage)) {
    return false;
  }

  const normalized = normalize(stripBenignListPrefixForParsing(userMessage));
  if (/(مشروع|project)/i.test(normalized)) {
    if (/(?:بدي|بدك|want to|i want to)\s+(?:أعمل|اعمل|build|make)/i.test(userMessage)) {
      return true;
    }
    if (extractProjectTitleQuery(userMessage) != null) {
      return true;
    }
  }

  return false;
};

export const shouldCorrectToMaterialSearch = (userMessage: string): boolean =>
  isExplicitMaterialSearchCommand(userMessage) &&
  !hasTrustedProjectMaterialContext(userMessage);

const isReservationWorkflowGuidanceQuestion = (
  userMessage: string,
  normalized: string,
): boolean =>
  /(شو\s+أعمل|شو\s+اعمل|what\s+(?:should|do)\s+i\s+do)/i.test(normalized) &&
  /(اطلب|أطلب|طلب|قطعة|piece|order|reserve|حجز|احجز)/i.test(normalized) &&
  /(مواد|مادة|material)/i.test(normalized);

const isImperativePlatformAction = (
  userMessage: string,
  normalized: string,
): boolean => {
  if (hasPlatformGuidanceHowToCue(userMessage, normalized)) {
    return false;
  }

  return (
    /(?:^|\s)(?:احجزلي|احجز\s+لي|احفظلي|احفظ\s+لي|الغ\s+لي|الغي\s+لي|احجز\s+ها?|reserve\s+(?:this|me|the)|book\s+(?:this|me|the)|save\s+(?:this|for\s+me|the))/i.test(
      userMessage,
    ) ||
    /(?:احجزلي|احجز\s+لي|احفظلي|احفظ\s+لي|reserve\s+for\s+me|book\s+for\s+me)/i.test(
      normalized,
    ) ||
    (/(احجز|احفظ|reserve|book|save|cancel)\s+(لي|me)\b/i.test(normalized) &&
      !/(كيف|how)\b/i.test(normalized))
  );
};

export const detectPlatformGuidanceIntent = (
  userMessage: string,
): PlatformGuidanceTopic | null => {
  if (detectEducationalLearningIntent(userMessage)) {
    return null;
  }

  const normalized = normalizeArabicVariants(normalize(userMessage));

  if (isImperativePlatformAction(userMessage, normalized)) {
    return null;
  }

  if (isReservationWorkflowGuidanceQuestion(userMessage, normalized)) {
    return 'MATERIAL_RESERVATION';
  }

  if (detectLearnerReservationStatusQuery(userMessage)) {
    return null;
  }

  if (detectAppMaterialNavigationGuidanceIntent(userMessage)) {
    return 'MATERIAL_RESERVATION';
  }

  if (detectSupplierPublishGuidanceIntent(userMessage)) {
    return 'GENERAL_PLATFORM';
  }

  const hasAppContext =
    /(من\s+التطبيق|بالتطبيق|in\s+the\s+app|on\s+impactloop|impactloop|حجوزاتي|my\s+reservations)/i.test(
      normalized,
    );
  const isHowTo = hasPlatformGuidanceHowToCue(userMessage, normalized);

  if (!isHowTo && !hasAppContext) {
    return null;
  }

  if (
    /(احجز|حجز|reserve|reservation|booking|حجوز)/i.test(normalized) &&
    /(بعد|after|موافق|approve|supplier|مورد|تأكيد|confirm|اقتراح|proposal)/i.test(
      normalized,
    )
  ) {
    return 'RESERVATION_AFTER_SUPPLIER';
  }

  if (
    /(احجز|حجز|reserve|reservation|booking|حجوز)/i.test(normalized) &&
    (isHowTo || hasAppContext)
  ) {
    return 'MATERIAL_RESERVATION';
  }

  if (
    /(احفظ|حفظ|save)/i.test(normalized) &&
    /(مشروع|project)/i.test(normalized) &&
    (isHowTo || hasAppContext)
  ) {
    return 'SAVE_PROJECT';
  }

  if (
    /(توصيل|delivery|deliver)/i.test(normalized) &&
    (isHowTo || hasAppContext)
  ) {
    return 'MATERIAL_DELIVERY';
  }

  if (detectMaterialSearchIntent(userMessage).detected) {
    return null;
  }

  if (detectOwnedMaterialsProjectIntent(userMessage)) {
    return null;
  }

  if (detectProjectMaterialAvailabilityIntent(userMessage)) {
    return null;
  }

  if (
    isHowTo &&
    /(تطبيق|app|impactloop|platform|حجز|حفظ|توصيل|reservation|delivery|مشروع|project)/i.test(
      normalized,
    )
  ) {
    return 'GENERAL_PLATFORM';
  }

  return null;
};

export const detectDeterministicPlatformActionIntent = (
  userMessage: string,
): boolean => {
  if (detectPlatformGuidanceIntent(userMessage)) {
    return false;
  }

  const normalized = normalizeArabicVariants(normalize(userMessage));
  if (
    /(هل\s+عندي|do\s+i\s+have|are\s+there)/i.test(normalized) &&
    /(حجوز|reservation)/i.test(normalized)
  ) {
    return false;
  }

  if (isImperativePlatformAction(userMessage, normalized)) {
    return true;
  }

  return (
    (/\b(save|reserve|book|link|start|unlink|cancel)\b/i.test(normalized) ||
      /(احفظ|احفظلي|احجز|احجزلي|اربط|ابدأ|ابدألي|الغي|إلغاء|الغ)/i.test(
        normalized,
      )) &&
    !hasPlatformGuidanceHowToCue(userMessage, normalized)
  );
};

export const detectAmbiguousLearnerRequest = (userMessage: string): boolean => {
  const normalized = normalizeArabicVariants(normalize(userMessage)).trim();
  return /^(اعملها|اعملو|do it|هاتها|بدي إياها|بدي اياها|بدّي إياها)[\s؟?!.]*$/iu.test(
    normalized,
  );
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

  if (
    /(?:مشاريع|projects)/i.test(normalized) &&
    extractProjectTitleQuery(userMessage) == null &&
    (/(?:ضمن\s+ميزانيتي|within\s+(?:my\s+)?budget|بحد\s+أقصى|up\s+to|under|maximum|max\b|أقل\s+من)/i.test(
      parsedMessage,
    ) ||
      /\d+(?:\.\d+)?\s*(?:nis|shekels?|شيكل|₪)/i.test(parsedMessage))
  ) {
    return false;
  }

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

export type BudgetComparisonMode = 'LT' | 'LTE';

export type ParsedBudgetBound = {
  maxBudgetNis: number;
  comparisonMode: BudgetComparisonMode;
};

const MAX_PROJECT_BUDGET_NIS = 10_000;

const sanitizeBudgetAmount = (value: number): number | undefined => {
  if (!Number.isFinite(value) || value <= 0 || value > MAX_PROJECT_BUDGET_NIS) {
    return undefined;
  }
  return Math.round(value * 100) / 100;
};

export const extractBudgetBound = (text: string): ParsedBudgetBound | undefined => {
  const parsedMessage = stripBenignListPrefixForParsing(text);
  const normalized = normalize(parsedMessage);

  const strictCue =
    /(?:\bunder\b|\bbelow\b|\bless\s+than\b|أقل\s+من|اقل\s+من)(?!\s*من)/i;
  const inclusiveCue =
    /(?:up\s+to|maximum|max\b|within|no\s+more\s+than|بحد\s+أقصى|حد\s+أقصى|ما\s+بتجاوز|ما\s+يتجاوز|لا\s+يتجاوز|لا\s+تتجاوز|ميزانيتي|ضمن\s+ميزانيتي|تتجاوز|within\s+a\s+budget)/i;

  const amountPatterns = [
    /(?:under|below|less\s+than|أقل\s+من|اقل\s+من|up\s+to|maximum|max|within|no\s+more\s+than|بحد\s+أقصى|حد\s+أقصى|ميزانيتي|ضمن\s+ميزانيتي|بميزانية|بحوالي|معي)\s*(\d+(?:\.\d+)?)/i,
    /(\d+(?:\.\d+)?)\s*(?:nis|shekels?|شيكل|شاقل|₪)/i,
  ];

  let amount: number | undefined;
  for (const pattern of amountPatterns) {
    const match = parsedMessage.match(pattern) ?? normalized.match(pattern);
    if (match?.[1]) {
      amount = sanitizeBudgetAmount(Number(match[1]));
      if (amount != null) {
        break;
      }
    }
  }

  if (amount == null) {
    const fallback = extractBoundedMaxPrice(parsedMessage);
    if (fallback != null) {
      amount = sanitizeBudgetAmount(fallback);
    }
  }

  if (amount == null) {
    return undefined;
  }

  const comparisonMode: BudgetComparisonMode =
    strictCue.test(parsedMessage) || strictCue.test(normalized) ? 'LT' : 'LTE';

  if (
    !strictCue.test(parsedMessage) &&
    !strictCue.test(normalized) &&
    !inclusiveCue.test(parsedMessage) &&
    !inclusiveCue.test(normalized) &&
    !/(?:budget|ميزانية|شيكل|nis|₪)/i.test(parsedMessage)
  ) {
    return undefined;
  }

  return { maxBudgetNis: amount, comparisonMode };
};

export const isProjectsWithinBudgetNumericFollowUp = (userMessage: string): boolean =>
  /^\s*\d+(?:\.\d+)?\s*(?:nis|شيكل|₪|shekels?)?\s*[.!?؟]*\s*$/iu.test(userMessage.trim());

const PROJECTS_WITHIN_BUDGET_CLARIFICATION_PATTERNS = [
  /what is your maximum budget in nis/i,
  /maximum budget in nis/i,
  /ما الحد الأقصى لميزانيتك بالشيكل/i,
  /الحد الأقصى لميزانيتك/i,
];

export const isProjectsWithinBudgetClarificationPrompt = (text: string): boolean =>
  PROJECTS_WITHIN_BUDGET_CLARIFICATION_PATTERNS.some((pattern) => pattern.test(text));

export const hasRecentProjectsWithinBudgetClarification = (input: {
  recentMessages: Array<{ role: 'USER' | 'ASSISTANT'; text: string }>;
}): boolean => {
  const lastAssistant = [...input.recentMessages]
    .reverse()
    .find((message) => message.role === 'ASSISTANT');
  return lastAssistant
    ? isProjectsWithinBudgetClarificationPrompt(lastAssistant.text)
    : false;
};

const PROJECT_BUDGET_CONFIRMATION_PATTERNS = [
  /هل تقصد مشروع/i,
  /did you mean the .+ project\?/i,
];

export const isProjectBudgetConfirmationPrompt = (text: string): boolean =>
  PROJECT_BUDGET_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(text));

export const hasRecentProjectBudgetConfirmation = (input: {
  recentMessages: Array<{ role: 'USER' | 'ASSISTANT'; text: string }>;
}): boolean => {
  const lastAssistant = [...input.recentMessages]
    .reverse()
    .find((message) => message.role === 'ASSISTANT');
  return lastAssistant
    ? isProjectBudgetConfirmationPrompt(lastAssistant.text)
    : false;
};

export const resolveProjectsWithinBudgetNumericContinuation = (
  userMessage: string,
  conversationContext: {
    recentMessages: Array<{ role: 'USER' | 'ASSISTANT'; text: string }>;
  },
): z.infer<typeof findProjectsWithinBudgetInputSchema> | null => {
  if (!isProjectsWithinBudgetNumericFollowUp(userMessage)) {
    return null;
  }
  if (!hasRecentProjectsWithinBudgetClarification(conversationContext)) {
    return null;
  }

  const amountMatch = userMessage.trim().match(/^(\d+(?:\.\d+)?)/);
  const amount = amountMatch?.[1] ? sanitizeBudgetAmount(Number(amountMatch[1])) : undefined;
  if (amount == null) {
    return null;
  }

  const priorUserMessage = [...conversationContext.recentMessages]
    .reverse()
    .find(
      (message) =>
        message.role === 'USER' &&
        !isProjectsWithinBudgetNumericFollowUp(message.text) &&
        (extractBudgetBound(message.text) != null ||
          /(?:مشاريع|projects|مشروع|project).{0,40}(?:بحد|بميزانية|under|within|budget|أقل|اقل)/i.test(
            message.text,
          ) ||
          /(?:ضمن\s+ميزانيتي|within\s+(?:my\s+)?budget)/i.test(message.text)),
    );

  const base = priorUserMessage
    ? parseProjectsWithinBudgetInput(priorUserMessage.text)
    : parseProjectsWithinBudgetInput(userMessage);

  return {
    ...base,
    maxBudgetNis: amount,
    comparisonMode: base.comparisonMode ?? 'LTE',
  };
};

export const detectProjectsWithinBudgetIntent = (userMessage: string): boolean => {
  if (detectEducationalLearningIntent(userMessage)) {
    return false;
  }
  if (detectOwnedMaterialsProjectIntent(userMessage)) {
    return false;
  }
  if (/(احجز|reserve|book)\b/i.test(userMessage)) {
    return false;
  }
  if (detectProjectBudgetEstimationIntent(userMessage)) {
    return false;
  }

  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalize(parsedMessage);
  const budgetBound = extractBudgetBound(userMessage);

  const asksProjects =
    /(مشاريع|projects)/i.test(normalized) ||
    /(?:بدي|بدك|اعرض|ورجيني|ورّيني|show|find|شو|what).{0,40}(?:مشروع|project)/i.test(
      parsedMessage,
    ) ||
    /(?:مشروع|project).{0,40}(?:بحد|بميزانية|under|within|budget|أقل|اقل)/i.test(
      parsedMessage,
    ) ||
    /(بقدر\s+أعمل|أقدر\s+أعمل|can\s+(?:i|we)\s+build|which\s+projects?)/i.test(
      parsedMessage,
    ) ||
    /(ضمن\s+ميزانيتي|within\s+(?:my\s+)?budget)/i.test(parsedMessage);

  if (!budgetBound) {
    return asksProjects && /(ضمن\s+ميزانيتي|within\s+(?:my\s+)?budget|بميزانية)/i.test(
      parsedMessage,
    );
  }

  return asksProjects;
};

export const parseProjectsWithinBudgetInput = (
  userMessage: string,
): z.infer<typeof findProjectsWithinBudgetInputSchema> => {
  const parsedMessage = stripBenignListPrefixForParsing(userMessage);
  const normalized = normalize(parsedMessage);
  const budgetBound = extractBudgetBound(userMessage);

  const input: {
    maxBudgetNis: number;
    comparisonMode: BudgetComparisonMode;
    category?: string;
    difficulty?: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
    query?: string;
    projectLimit?: number;
    includePartial?: boolean;
  } = {
    maxBudgetNis: budgetBound?.maxBudgetNis ?? 0,
    comparisonMode: budgetBound?.comparisonMode ?? 'LTE',
    includePartial: true,
    projectLimit: extractRequestedResultCount(parsedMessage) ?? 8,
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

  const explicitTitle = extractProjectTitleQuery(userMessage);
  if (explicitTitle && !budgetBound) {
    const sanitizedQuery = sanitizeProjectsWithinBudgetQuery(
      explicitTitle,
      input.category,
    );
    if (sanitizedQuery) {
      input.query = sanitizedQuery;
    }
  } else if (
    !input.category &&
    includesAny(normalized, ['robot', 'robotics', 'روبوت', 'arduino', 'اردوينو'])
  ) {
    if (includesAny(normalized, ['arduino', 'اردوينو', 'أردوينو'])) {
      input.query = 'Arduino';
    } else if (includesAny(normalized, ['robot', 'robotics', 'روبوت'])) {
      input.query = 'robot';
    }
  }

  return input;
};

const PROJECTS_WITHIN_BUDGET_QUERY_NOISE = [
  'within my budget',
  'within budget',
  'my budget',
  'budget',
  'ضمن ميزانيتي',
  'بميزانية',
  'ميزانيتي',
  'ميزانية',
  'بحد أقصى',
  'بحد اقصى',
  'maximum',
  'max',
  'under',
  'up to',
  'أقل من',
  'اقل من',
  'شيكل',
  'nis',
  'shekel',
  'shekels',
  'project',
  'projects',
  'مشروع',
  'مشاريع',
];

export const sanitizeProjectsWithinBudgetQuery = (
  rawQuery: string,
  category?: string,
): string | undefined => {
  let cleaned = rawQuery.trim();
  if (!cleaned) {
    return undefined;
  }

  cleaned = cleaned
    .replace(/(?:ضمن\s+ميزانيتي|within\s+(?:my\s+)?budget|بميزانية)/giu, ' ')
    .replace(/(?:بحد\s+أقصى|بحد\s+اقصى|up\s+to|under|maximum|max\b|أقل\s+من|اقل\s+من)/giu, ' ')
    .replace(/\d+(?:\.\d+)?\s*(?:nis|shekels?|شيكل|₪)?/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const categoryTerms = new Set(
    CATEGORY_SYNONYMS.flatMap((entry) =>
      category && entry.categoryText === category
        ? entry.terms.map((term) => term.toLowerCase())
        : [],
    ),
  );

  const tokens = cleaned
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => {
      if (!token) {
        return false;
      }
      const lower = token.toLowerCase();
      if (PROJECTS_WITHIN_BUDGET_QUERY_NOISE.includes(lower)) {
        return false;
      }
      if (categoryTerms.has(lower)) {
        return false;
      }
      return true;
    });

  const sanitized = tokens.join(' ').trim();
  return sanitized.length >= 2 ? sanitized : undefined;
};

export const detectProjectMaterialAvailabilityIntent = (
  userMessage: string,
): boolean => {
  if (detectProjectsWithinBudgetIntent(userMessage)) {
    return false;
  }
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
  if (shouldCorrectToMaterialSearch(userMessage)) {
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
    'كم',
    'بكلفني',
    'بكلف',
    'تكلفة',
    'تكلفه',
    'سعر',
    'السعر',
    'cost',
    'price',
    'much',
    'how',
    'estimate',
    'احسب',
    'احسبلي',
    'قديش',
    'pay',
    'budget',
  ].map((term) => term.toLowerCase()),
);

export const stripProjectBudgetCostSuffix = (text: string): string =>
  text
    .replace(
      /\s+(?:كم\s+)?(?:بكلف(?:ني)?|بكلف|تكلفة|تكلفه|سعر|السعر|how\s+much(?:\s+does)?|what.*cost|would\s+cost|price|estimate|احسب(?:لي)?|قديش|pay|budget).*$/iu,
      '',
    )
    .trim();

export const stripProjectBudgetCostPrefix = (text: string): string =>
  text
    .replace(
      /^(?:كم\s+)?(?:بكلف(?:ني)?|بكلف|تكلفة|تكلفه|سعر|السعر|how\s+much(?:\s+does)?|what.*cost|would\s+cost|price|estimate|احسب(?:لي)?|قديش|pay|budget)\s+(?:مشروع|project)?\s*/iu,
      '',
    )
    .trim();

const normalizeExtractedProjectTitle = (candidate: string): string =>
  stripProjectBudgetCostSuffix(stripProjectBudgetCostPrefix(candidate))
    .replace(/^(المطلوبة|المطلوب|required|the)\s+/i, '')
    .replace(/\s+من\s+المنصة$/i, '')
    .replace(/[؟?.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120)
    .trim();

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
    const normalized = normalizeExtractedProjectTitle(actionFirstTitle);
    if (normalized.length >= 3 && !isGenericComponentDescriptorTitle(normalized)) {
      return normalized;
    }
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
      const normalized = normalizeExtractedProjectTitle(candidate);
      if (normalized.length < 3 || isGenericComponentDescriptorTitle(normalized)) {
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
    plan.categoryText = normalizeMaterialCategoryText(filters.categoryText);
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
  const normalized = normalize(trimmed);

  if (
    /^(?:ورجيني|ورّيني|وريني)\s+\S+/iu.test(normalized) &&
    !/^(?:ورجيني|ورّيني|وريني)\s*[?.!،.]*$/i.test(normalized) &&
    !/^(?:ورجيني|ورّيني|وريني)\s*(?:اللي|يلي|هذول|هاي|هذي)\s*[?.!،.]*$/iu.test(
      normalized,
    )
  ) {
    return false;
  }

  return (
    /^(?:آه|اه|أجل|ايوه|ايوا|نعم|أكيد|تمام|yes|yeah|yep|sure|ok|okay|please|go\s+ahead)\s*[?.!،.]*$/i.test(
      normalized,
    ) ||
    /^(?:ورجيني|ورّيني|وريني)\s*[?.!،.]*$/i.test(normalized) ||
    /^(?:آه|اه|أجل|ايوه|ايوا|نعم|أكيد|تمام)[\s،,]+(?:ورجيني|ورّيني|وريني)\s*[?.!،.]*$/i.test(
      normalized,
    )
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
