export type LearnerInterestMatchMode = 'keywords_only' | 'keywords_and_category';

export type LearnerInterestDefinition = {
  key: string;
  labelEn: string;
  labelAr: string | null;
  groupKey: string;
  groupLabelEn: string;
  relatedMaterialCategoryNames: string[];
  relatedProjectCategoryNames: string[];
  tags: string[];
  keywords: string[];
  aliases: string[];
  specificity: number;
  sortOrder: number;
  matchMode: LearnerInterestMatchMode;
};

export type LearnerInterestGroupDefinition = {
  key: string;
  labelEn: string;
  labelAr: string | null;
  sortOrder: number;
};

export type LearnerInterestMatchStrength = 'strong' | 'group' | 'custom';

export type InterestMatchSource =
  | 'tag'
  | 'title'
  | 'description'
  | 'materialType'
  | 'category'
  | 'custom';

export type LearnerInterestMatch = {
  key: string;
  labelEn: string;
  groupLabelEn: string;
  strength: LearnerInterestMatchStrength;
  scoreWeight: number;
  matchedSources?: InterestMatchSource[];
};

export type MaterialInterestMatchInput = {
  title: string;
  description: string;
  materialType: string;
  categoryNameEn: string;
  categoryNameAr?: string | null;
  tags: string[];
};

export type MaterialMatchHaystack = {
  full: string;
  content: string;
  category: string;
  title: string;
  description: string;
  materialType: string;
  tags: string;
};

const GROUPS: LearnerInterestGroupDefinition[] = [
  { key: 'electronics', labelEn: 'Electronics', labelAr: null, sortOrder: 1 },
  { key: 'woodworking', labelEn: 'Woodworking', labelAr: null, sortOrder: 2 },
  {
    key: 'fabric_textiles',
    labelEn: 'Fabric & Textiles',
    labelAr: null,
    sortOrder: 3,
  },
  { key: 'art_crafts', labelEn: 'Art & Crafts', labelAr: null, sortOrder: 4 },
  { key: 'recycling', labelEn: 'Recycling', labelAr: null, sortOrder: 5 },
  { key: 'home_diy', labelEn: 'Home DIY', labelAr: null, sortOrder: 6 },
];

const INTERESTS: LearnerInterestDefinition[] = [
  {
    key: 'electronics',
    labelEn: 'Electronics',
    labelAr: null,
    groupKey: 'electronics',
    groupLabelEn: 'Electronics',
    relatedMaterialCategoryNames: ['Electronics'],
    relatedProjectCategoryNames: ['Electronics', 'Robotics'],
    tags: ['electronics', 'electronic'],
    keywords: ['electronics', 'electronic', 'component', 'electrical'],
    aliases: ['electronic', 'electrical repair', 'electrical'],
    specificity: 50,
    sortOrder: 1,
    matchMode: 'keywords_and_category',
  },
  {
    key: 'arduino',
    labelEn: 'Arduino',
    labelAr: null,
    groupKey: 'electronics',
    groupLabelEn: 'Electronics',
    relatedMaterialCategoryNames: ['Electronics'],
    relatedProjectCategoryNames: ['Electronics', 'Robotics'],
    tags: ['arduino', 'microcontroller'],
    keywords: ['arduino', 'uno', 'nano', 'microcontroller', 'mcu'],
    aliases: ['arduino boards'],
    specificity: 90,
    sortOrder: 2,
    matchMode: 'keywords_only',
  },
  {
    key: 'robotics',
    labelEn: 'Robotics',
    labelAr: null,
    groupKey: 'electronics',
    groupLabelEn: 'Electronics',
    relatedMaterialCategoryNames: ['Electronics', 'Robotics'],
    relatedProjectCategoryNames: ['Robotics', 'Electronics'],
    tags: ['robotics', 'robot'],
    keywords: [
      'robotics',
      'robot',
      'servo',
      'motor',
      'actuator',
      'wheels',
      'chassis',
    ],
    aliases: ['robot', 'robots'],
    specificity: 88,
    sortOrder: 3,
    matchMode: 'keywords_only',
  },
  {
    key: 'sensors',
    labelEn: 'Sensors',
    labelAr: null,
    groupKey: 'electronics',
    groupLabelEn: 'Electronics',
    relatedMaterialCategoryNames: ['Electronics'],
    relatedProjectCategoryNames: ['Electronics', 'Robotics'],
    tags: ['sensor'],
    keywords: [
      'sensor',
      'ultrasonic',
      'temperature sensor',
      'light sensor',
      'motion sensor',
      'pir',
      'gyro',
    ],
    aliases: ['sensor modules'],
    specificity: 86,
    sortOrder: 4,
    matchMode: 'keywords_only',
  },
  {
    key: 'circuits',
    labelEn: 'Circuits',
    labelAr: null,
    groupKey: 'electronics',
    groupLabelEn: 'Electronics',
    relatedMaterialCategoryNames: ['Electronics'],
    relatedProjectCategoryNames: ['Electronics'],
    tags: ['circuit', 'pcb'],
    keywords: [
      'circuit',
      'resistor',
      'capacitor',
      'breadboard',
      'soldering',
      'pcb',
      'transistor',
      'diode',
    ],
    aliases: ['circuit building', 'electronic circuits'],
    specificity: 84,
    sortOrder: 5,
    matchMode: 'keywords_only',
  },
  {
    key: 'displays',
    labelEn: 'Displays',
    labelAr: null,
    groupKey: 'electronics',
    groupLabelEn: 'Electronics',
    relatedMaterialCategoryNames: ['Electronics'],
    relatedProjectCategoryNames: ['Electronics', 'Robotics'],
    tags: ['display', 'lcd'],
    keywords: ['display', 'lcd', 'screen', 'oled', 'tft', 'monitor', 'module'],
    aliases: ['lcd display', 'display module'],
    specificity: 83,
    sortOrder: 6,
    matchMode: 'keywords_only',
  },
  {
    key: 'wires_connectors',
    labelEn: 'Wires & Connectors',
    labelAr: null,
    groupKey: 'electronics',
    groupLabelEn: 'Electronics',
    relatedMaterialCategoryNames: ['Electronics'],
    relatedProjectCategoryNames: ['Electronics', 'Robotics'],
    tags: ['wire', 'connector', 'cable'],
    keywords: [
      'wire',
      'wires',
      'jumper',
      'cable',
      'connector',
      'header',
      'dupont',
      'breadboard wire',
    ],
    aliases: ['wires and connectors', 'wires & connectors', 'cables'],
    specificity: 82,
    sortOrder: 7,
    matchMode: 'keywords_only',
  },
  {
    key: 'audio_media',
    labelEn: 'Audio & Media',
    labelAr: null,
    groupKey: 'electronics',
    groupLabelEn: 'Electronics',
    relatedMaterialCategoryNames: ['Electronics'],
    relatedProjectCategoryNames: ['Electronics'],
    tags: ['audio', 'speaker', 'media'],
    keywords: [
      'audio',
      'speaker',
      'microphone',
      'amplifier',
      'sound',
      'media',
      'mp3',
      'bluetooth audio',
      'headphone',
    ],
    aliases: ['audio and media', 'audio media'],
    specificity: 87,
    sortOrder: 8,
    matchMode: 'keywords_only',
  },
  {
    key: 'woodworking',
    labelEn: 'Woodworking',
    labelAr: null,
    groupKey: 'woodworking',
    groupLabelEn: 'Woodworking',
    relatedMaterialCategoryNames: ['Woodworking', 'Wood', 'Wood & Timber', 'Wood & Panels'],
    relatedProjectCategoryNames: ['Woodworking'],
    tags: ['wood', 'woodworking'],
    keywords: ['wood', 'woodworking', 'plywood', 'timber', 'board', 'pallet', 'lumber'],
    aliases: ['wood working', 'wood work'],
    specificity: 80,
    sortOrder: 9,
    matchMode: 'keywords_only',
  },
  {
    key: 'fabric_textiles',
    labelEn: 'Fabric & Textiles',
    labelAr: null,
    groupKey: 'fabric_textiles',
    groupLabelEn: 'Fabric & Textiles',
    relatedMaterialCategoryNames: ['Textiles', 'Fabric & Textiles', 'Fabric & Textile'],
    relatedProjectCategoryNames: ['Textiles', 'Fashion'],
    tags: ['fabric', 'textile'],
    keywords: [
      'fabric',
      'textile',
      'textiles',
      'cloth',
      'cotton',
      'sewing',
      'fabric scrap',
      'fabric remnants',
    ],
    aliases: [
      'fabric and textiles',
      'fashion and textiles',
      'fabric textiles',
    ],
    specificity: 80,
    sortOrder: 10,
    matchMode: 'keywords_only',
  },
  {
    key: 'art_crafts',
    labelEn: 'Art & Crafts',
    labelAr: null,
    groupKey: 'art_crafts',
    groupLabelEn: 'Art & Crafts',
    relatedMaterialCategoryNames: [
      'Art & Crafts',
      'Art and Crafts',
      'Art, Craft & Molding',
    ],
    relatedProjectCategoryNames: ['Art & Crafts', 'Art and Crafts', 'Recycling Crafts'],
    tags: ['art project', 'craft project', 'handmade'],
    keywords: [
      'art project',
      'craft project',
      'arts and crafts',
      'handmade',
      'paint supplies',
      'painting',
      'wax mold',
      'candle mold',
      'silicone mold',
      'resin mold',
      'clay',
      'pottery',
      'sculpture',
      'craft glue',
      'glue gun',
      'craft cardboard',
      'cardboard craft',
      'molding',
    ],
    aliases: [
      'art and crafts',
      'art & crafts',
      'art and design',
      'crafts and handmade work',
    ],
    specificity: 78,
    sortOrder: 11,
    matchMode: 'keywords_only',
  },
  {
    key: 'recycling',
    labelEn: 'Recycling',
    labelAr: null,
    groupKey: 'recycling',
    groupLabelEn: 'Recycling',
    relatedMaterialCategoryNames: ['Recycling', 'Packaging'],
    relatedProjectCategoryNames: ['Recycling', 'Sustainability', 'Recycling Crafts'],
    tags: ['recycling', 'reuse'],
    keywords: [
      'reuse',
      'reused',
      'recycled',
      'recyclable',
      'leftover',
      'upcycling',
      'packaging reuse',
    ],
    aliases: ['recycling and upcycling', 'upcycling', 'packaging reuse'],
    specificity: 75,
    sortOrder: 12,
    matchMode: 'keywords_only',
  },
  {
    key: 'home_diy',
    labelEn: 'Home DIY',
    labelAr: null,
    groupKey: 'home_diy',
    groupLabelEn: 'Home DIY',
    relatedMaterialCategoryNames: [
      'Home DIY',
      'Home Improvement',
      'Household Reusables',
    ],
    relatedProjectCategoryNames: ['Home DIY', 'Home Improvement', 'Home Experiments'],
    tags: ['diy', 'home'],
    keywords: ['diy', 'repair', 'home', 'organizer', 'furniture', 'household'],
    aliases: [
      'home diy',
      'home improvement',
      'household repair',
      'interior design',
      'furniture',
    ],
    specificity: 74,
    sortOrder: 13,
    matchMode: 'keywords_only',
  },
];

const INTEREST_BY_KEY = new Map(INTERESTS.map((interest) => [interest.key, interest]));
const GROUP_BY_KEY = new Map(GROUPS.map((group) => [group.key, group]));

export const CUSTOM_INTEREST_PREFIX = 'custom:';

export const isCustomInterestKey = (raw: string) =>
  normalizeText(raw).startsWith(CUSTOM_INTEREST_PREFIX);

const normalizeCustomInterestSuffix = (suffix: string): string | null => {
  const normalized = suffix
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (normalized.length < 2 || normalized.length > 80) {
    return null;
  }

  return `${CUSTOM_INTEREST_PREFIX}${normalized}`;
};

export const toCustomInterestKey = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (isCustomInterestKey(trimmed)) {
    return normalizeCustomInterestSuffix(trimmed.slice(CUSTOM_INTEREST_PREFIX.length));
  }

  return normalizeCustomInterestSuffix(trimmed);
};

export const normalizeText = (value: string) => value.trim().toLowerCase();

export const normalizeInterestToken = (value: string) =>
  normalizeText(value)
    .replace(/_/g, ' ')
    .replace(/&/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeToken = (token: string) => {
  if (token.length > 4 && token.endsWith('s')) {
    return token.slice(0, -1);
  }

  return token;
};

const tokenize = (value: string) =>
  normalizeInterestToken(value)
    .split(/[\s,;/|]+/)
    .filter((token) => token.length >= 2)
    .map(normalizeToken);

const LEGACY_ALIAS_TO_KEY = new Map<string, string>();

for (const interest of INTERESTS) {
  LEGACY_ALIAS_TO_KEY.set(normalizeInterestToken(interest.key), interest.key);
  LEGACY_ALIAS_TO_KEY.set(normalizeInterestToken(interest.labelEn), interest.key);

  for (const alias of interest.aliases) {
    LEGACY_ALIAS_TO_KEY.set(normalizeInterestToken(alias), interest.key);
  }

  for (const tag of interest.tags) {
    LEGACY_ALIAS_TO_KEY.set(normalizeInterestToken(tag), interest.key);
  }
}

LEGACY_ALIAS_TO_KEY.set(normalizeInterestToken('art crafts'), 'art_crafts');

export const resolveInterestKey = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }

  if (isCustomInterestKey(trimmed)) {
    return toCustomInterestKey(trimmed);
  }

  const normalized = normalizeInterestToken(trimmed);
  if (normalized.length === 0) {
    return null;
  }

  if (INTEREST_BY_KEY.has(normalized.replace(/\s+/g, '_'))) {
    return normalized.replace(/\s+/g, '_');
  }

  return LEGACY_ALIAS_TO_KEY.get(normalized) ?? null;
};

export const normalizeLearnerInterestKeys = (interests: string[]) => {
  const keys = interests
    .map((interest) => resolveInterestKey(interest))
    .filter((interest): interest is string => interest != null);

  return [...new Set(keys)];
};

export const getLearnerInterestDefinition = (key: string) =>
  INTEREST_BY_KEY.get(key) ?? null;

export const getLearnerInterestLabel = (keyOrRaw: string) => {
  const trimmed = keyOrRaw.trim();
  if (isCustomInterestKey(trimmed)) {
    const suffix = trimmed.slice(CUSTOM_INTEREST_PREFIX.length);
    return suffix
      .replace(/_/g, ' ')
      .split(' ')
      .filter((part) => part.length > 0)
      .map((part) => `${part[0]!.toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }

  const key = resolveInterestKey(trimmed) ?? trimmed;
  return INTEREST_BY_KEY.get(key)?.labelEn ?? trimmed;
};

export const getInterestSearchTermsForKey = (key: string) => {
  const interest = INTEREST_BY_KEY.get(key);
  if (!interest) {
    return [] as string[];
  }

  const terms = new Set<string>([
    normalizeInterestToken(interest.key),
    normalizeInterestToken(interest.labelEn),
    ...interest.tags.map(normalizeInterestToken),
    ...interest.keywords.map(normalizeInterestToken),
  ]);

  for (const token of tokenize(interest.labelEn)) {
    terms.add(token);
  }

  return [...terms].filter((term) => term.length >= 2);
};

const haystackIncludesTerm = (haystack: string, term: string) => {
  const normalizedTerm = normalizeInterestToken(term);
  if (normalizedTerm.length < 2) {
    return false;
  }

  if (haystack.includes(normalizedTerm)) {
    return true;
  }

  return tokenize(normalizedTerm).every(
    (token) => token.length >= 3 && haystack.includes(token),
  );
};

export const buildMaterialMatchHaystack = (
  input: MaterialInterestMatchInput,
): MaterialMatchHaystack => {
  const title = normalizeInterestToken(input.title);
  const description = normalizeInterestToken(input.description);
  const materialType = normalizeInterestToken(input.materialType);
  const category = normalizeInterestToken(
    [input.categoryNameEn, input.categoryNameAr ?? ''].join(' '),
  );
  const tags = normalizeInterestToken(input.tags.join(' '));

  return {
    full: [title, description, materialType, category, tags].join(' '),
    content: [title, description, materialType, tags].join(' '),
    category,
    title,
    description,
    materialType,
    tags,
  };
};

const findKeywordMatchSources = (
  parts: MaterialMatchHaystack,
  interest: LearnerInterestDefinition,
): InterestMatchSource[] => {
  const sources = new Set<InterestMatchSource>();
  const terms = [...interest.tags, ...interest.keywords];

  for (const term of terms) {
    if (haystackIncludesTerm(parts.title, term)) {
      sources.add('title');
    }
    if (haystackIncludesTerm(parts.description, term)) {
      sources.add('description');
    }
    if (haystackIncludesTerm(parts.materialType, term)) {
      sources.add('materialType');
    }
    if (haystackIncludesTerm(parts.tags, term)) {
      sources.add('tag');
    }
  }

  return [...sources];
};

const matchesContentKeywords = (
  parts: MaterialMatchHaystack,
  interest: LearnerInterestDefinition,
) => findKeywordMatchSources(parts, interest).length > 0;

const matchesCategoryNames = (
  categoryHaystack: string,
  categoryNames: string[],
) =>
  categoryNames.some((categoryName) => {
    const normalizedCategory = normalizeInterestToken(categoryName);
    return (
      normalizedCategory.length >= 3 &&
      categoryHaystack.includes(normalizedCategory)
    );
  });

export const matchCustomInterestKeyAgainstMaterial = (
  parts: MaterialMatchHaystack,
  key: string,
): LearnerInterestMatch | null => {
  const label = getLearnerInterestLabel(key);
  const normalizedLabel = normalizeInterestToken(label);
  if (normalizedLabel.length < 2) {
    return null;
  }

  if (haystackIncludesTerm(parts.content, normalizedLabel)) {
    return {
      key,
      labelEn: label,
      groupLabelEn: 'Custom',
      strength: 'custom',
      scoreWeight: 12,
      matchedSources: ['custom'],
    };
  }

  const tokens = normalizedLabel.split(' ').filter((token) => token.length >= 4);
  if (
    tokens.length > 0 &&
    tokens.every((token) => parts.content.includes(token))
  ) {
    return {
      key,
      labelEn: label,
      groupLabelEn: 'Custom',
      strength: 'custom',
      scoreWeight: 10,
      matchedSources: ['custom'],
    };
  }

  return null;
};

export const matchInterestKeyAgainstMaterial = (
  parts: MaterialMatchHaystack,
  key: string,
): LearnerInterestMatch | null => {
  const interest = INTEREST_BY_KEY.get(key);
  if (!interest) {
    return null;
  }

  const keywordSources = findKeywordMatchSources(parts, interest);
  if (keywordSources.length > 0) {
    return {
      key: interest.key,
      labelEn: interest.labelEn,
      groupLabelEn: interest.groupLabelEn,
      strength: 'strong',
      scoreWeight: 40,
      matchedSources: keywordSources,
    };
  }

  if (interest.matchMode !== 'keywords_and_category') {
    return null;
  }

  if (
    matchesCategoryNames(parts.category, interest.relatedMaterialCategoryNames)
  ) {
    return {
      key: interest.key,
      labelEn: interest.labelEn,
      groupLabelEn: interest.groupLabelEn,
      strength: 'group',
      scoreWeight: 18,
      matchedSources: ['category'],
    };
  }

  return null;
};

export const matchInterestKeyAgainstHaystack = (
  haystack: string,
  key: string,
): LearnerInterestMatch | null => {
  const parts: MaterialMatchHaystack = {
    full: normalizeInterestToken(haystack),
    content: normalizeInterestToken(haystack),
    category: '',
    title: normalizeInterestToken(haystack),
    description: '',
    materialType: '',
    tags: '',
  };

  return matchInterestKeyAgainstMaterial(parts, key);
};

export const matchLearnerInterestsAgainstMaterial = (
  material: MaterialInterestMatchInput,
  interestKeys: string[],
): LearnerInterestMatch | null => {
  const parts = buildMaterialMatchHaystack(material);
  let bestMatch: LearnerInterestMatch | null = null;

  for (const key of interestKeys) {
    const resolvedKey = resolveInterestKey(key);
    if (!resolvedKey) {
      continue;
    }

    const match = isCustomInterestKey(resolvedKey)
      ? matchCustomInterestKeyAgainstMaterial(parts, resolvedKey)
      : matchInterestKeyAgainstMaterial(parts, resolvedKey);

    if (!match) {
      continue;
    }

    const interest = INTEREST_BY_KEY.get(resolvedKey);
    const rankingScore =
      match.scoreWeight + (interest?.specificity ?? 0) / 100;

    if (
      !bestMatch ||
      rankingScore >
        bestMatch.scoreWeight +
          (INTEREST_BY_KEY.get(bestMatch.key)?.specificity ?? 0) / 100
    ) {
      bestMatch = match;
    }
  }

  return bestMatch;
};

export const matchLearnerInterestsAgainstHaystack = (
  haystack: string,
  interestKeys: string[],
): LearnerInterestMatch | null => {
  const parts: MaterialMatchHaystack = {
    full: normalizeInterestToken(haystack),
    content: normalizeInterestToken(haystack),
    category: normalizeInterestToken(haystack),
    title: normalizeInterestToken(haystack),
    description: '',
    materialType: '',
    tags: '',
  };

  let bestMatch: LearnerInterestMatch | null = null;

  for (const key of interestKeys) {
    const resolvedKey = resolveInterestKey(key);
    if (!resolvedKey || isCustomInterestKey(resolvedKey)) {
      continue;
    }

    const match = matchInterestKeyAgainstMaterial(parts, resolvedKey);
    if (!match) {
      continue;
    }

    const interest = INTEREST_BY_KEY.get(resolvedKey)!;
    const rankingScore = match.scoreWeight + interest.specificity / 100;

    if (
      !bestMatch ||
      rankingScore >
        bestMatch.scoreWeight +
          (INTEREST_BY_KEY.get(bestMatch.key)?.specificity ?? 0) / 100
    ) {
      bestMatch = match;
    }
  }

  return bestMatch;
};

export const buildInterestMatchReason = (match: LearnerInterestMatch) => {
  if (match.strength === 'strong') {
    return `Matches your ${match.labelEn} interest`;
  }

  if (match.strength === 'custom') {
    return `Related to your ${match.labelEn} interest`;
  }

  return `Related to your ${match.groupLabelEn} interest`;
};

export const hasStrongInterestMatchReason = (reason: string) => {
  const normalized = reason.toLowerCase();
  return (
    normalized.startsWith('matches your') ||
    normalized.startsWith('related to your')
  );
};

export const validateInterestInputs = (interests: string[] | undefined) => {
  if (interests === undefined) {
    return undefined;
  }

  const invalid = interests.filter((interest) => resolveInterestKey(interest) == null);
  if (invalid.length > 0) {
    return {
      valid: false as const,
      invalid,
    };
  }

  return {
    valid: true as const,
    interests: normalizeLearnerInterestKeys(interests),
  };
};

export const sanitizeInterestInputs = (interests: string[] | undefined) => {
  if (interests === undefined) {
    return undefined;
  }

  return normalizeLearnerInterestKeys(interests);
};

export const getLearnerInterestOptionsResponse = () => ({
  groups: GROUPS.sort((left, right) => left.sortOrder - right.sortOrder).map(
    (group) => ({
      key: group.key,
      label: group.labelEn,
      labelAr: group.labelAr,
      items: INTERESTS.filter((interest) => interest.groupKey === group.key)
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((interest) => ({
          key: interest.key,
          label: interest.labelEn,
          labelAr: interest.labelAr,
        })),
    }),
  ),
});

const MIN_SUBSTRING_INTEREST_TERM_LENGTH = 4;

const interestSearchTermMatches = (normalized: string, term: string) => {
  if (normalized === term) {
    return true;
  }

  if (term.length < MIN_SUBSTRING_INTEREST_TERM_LENGTH) {
    return false;
  }

  return normalized.includes(term);
};

export const resolveTermToInterestKey = (rawTerm: string): string | null => {
  const normalized = normalizeInterestToken(rawTerm);
  if (normalized.length < 2) {
    return null;
  }

  const direct = resolveInterestKey(rawTerm);
  if (direct) {
    return direct;
  }

  let bestMatch: { key: string; termLength: number; specificity: number } | null =
    null;

  for (const interest of INTERESTS) {
    for (const term of getInterestSearchTermsForKey(interest.key)) {
      if (!interestSearchTermMatches(normalized, term)) {
        continue;
      }

      const candidate = {
        key: interest.key,
        termLength: term.length,
        specificity: interest.specificity,
      };

      if (
        !bestMatch ||
        candidate.termLength > bestMatch.termLength ||
        (candidate.termLength === bestMatch.termLength &&
          candidate.specificity > bestMatch.specificity)
      ) {
        bestMatch = candidate;
      }
    }
  }

  return bestMatch?.key ?? null;
};

export const ALL_LEARNER_INTEREST_KEYS = INTERESTS.map((interest) => interest.key);
