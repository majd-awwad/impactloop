import {
  AFFINITY_RELEVANCE_THRESHOLD,
  BEHAVIOR_SCORE_WEIGHTS,
  LIKED_SIMILARITY_SCORE_WEIGHTS,
  extractAffinityTermsFromMaterial,
  isQualifiedLikedSimilaritySharedTerm,
  extractAffinityTermsFromProject,
  hasLearnerActivity,
  hasMeaningfulBehaviorAffinity,
} from './learner-home.affinity.js';
import {
  ALL_LEARNER_INTEREST_KEYS,
  buildInterestMatchReason,
  buildMaterialMatchHaystack,
  isCustomInterestKey,
  matchCustomInterestKeyAgainstMaterial,
  matchInterestKeyAgainstMaterial,
  normalizeInterestToken,
  normalizeText,
  resolveInterestKey,
  resolveTermToInterestKey,
  type LearnerInterestMatch,
  type MaterialMatchHaystack,
} from './learner-interest-taxonomy.js';
import {
  FREE_MATERIAL_TIERS,
  SAVED_PROJECT_MATERIAL_TIERS,
  SUGGESTED_MATERIAL_TIERS,
  type MaterialScoringTier,
  type SuggestedMaterialTier,
} from './learner-home.ranking.js';
import {
  ALREADY_LIKED_MATERIAL_PENALTY,
  MATERIAL_SCORE_WEIGHTS,
  UNAVAILABLE_MATERIAL_PENALTY,
  locationMatches,
  orderMaterialReasons,
  type ScoredMaterialResult,
} from './learner-home.scoring.js';
import type {
  LearnerAffinityProfile,
  LearnerBehaviorContext,
  LearnerBehaviorMaterialSignal,
  LearnerBehaviorProjectSignal,
  LearnerHomeMaterialCandidate,
  LearnerHomeSavedLocationContext,
  LearnerHomeSavedProjectComponent,
} from './learner-home.types.js';

const FEATURE_CACHE_TTL_MS = 60_000;
const GENERIC_BROAD_INTEREST_KEYS = new Set(['electronics']);
const GENERIC_MATERIAL_TYPES = new Set([
  'general',
  'misc',
  'other',
  'electronics',
  'electronics components',
  'components',
]);

export type MaterialRecommendationFeature = {
  materialId: string;
  ownerId: string;
  candidate: LearnerHomeMaterialCandidate;
  haystackParts: MaterialMatchHaystack;
  normalizedTitle: string;
  normalizedCategory: string;
  normalizedMaterialType: string;
  categoryId: string;
  normalizedCity: string;
  normalizedArea: string;
  tags: Set<string>;
  specificTags: Set<string>;
  specificTerms: Set<string>;
  interestKeys: Set<string>;
  interestMatches: Map<string, LearnerInterestMatch>;
  titleTokens: Set<string>;
  popularityScore: number;
  recencyScore: number;
};

export type MaterialFeatureIndex = {
  byMaterialId: Map<string, MaterialRecommendationFeature>;
  byInterestKey: Map<string, Set<string>>;
  byTerm: Map<string, Set<string>>;
  byCategoryId: Map<string, Set<string>>;
  byCity: Map<string, Set<string>>;
  poolSignature: string;
};

type BehaviorSignalFeature = {
  specificTerms: Set<string>;
  specificTags: Set<string>;
  titleTokens: Set<string>;
  normalizedMaterialType: string;
  normalizedCategory: string;
  categoryNameEn: string;
  categoryNameAr: string;
  title: string;
};

type LikedMaterialFeature = BehaviorSignalFeature & {
  materialId: string;
  label: string | null;
};

type SavedComponentFeature = {
  component: LearnerHomeSavedProjectComponent;
  categoryId: string | null;
  normalizedComponentName: string;
  normalizedMaterialType: string;
  terms: Set<string>;
};

export type UserSignalProfile = {
  explicitInterestKeys: string[];
  customInterestKeys: string[];
  likedMaterialIds: Set<string>;
  likedMaterialSignals: LearnerBehaviorMaterialSignal[];
  likedFeatures: LikedMaterialFeature[];
  reservedFeatures: BehaviorSignalFeature[];
  viewedFeatures: BehaviorSignalFeature[];
  savedProjectFeatures: BehaviorSignalFeature[];
  inProgressBuildFeatures: BehaviorSignalFeature[];
  savedComponentFeatures: SavedComponentFeature[];
  behaviorAffinityKeys: Map<string, number>;
  savedLocation: LearnerHomeSavedLocationContext;
  hasActivity: boolean;
  allowsWeakOnlyFallback: boolean;
};

export type MaterialScoreRecord = {
  materialId: string;
  ownerId: string;
  candidate: LearnerHomeMaterialCandidate;
  suggested: ScoredMaterialResult;
  savedProjects: ScoredMaterialResult;
  free: ScoredMaterialResult;
};

type FeaturePoolCacheEntry = {
  expiresAt: number;
  poolSignature: string;
  features: MaterialRecommendationFeature[];
  index: MaterialFeatureIndex;
};

let featurePoolCache: FeaturePoolCacheEntry | null = null;

const tokenize = (value: string) =>
  normalizeInterestToken(value)
    .split(/[\s,;/|]+/)
    .filter((token) => token.length >= 2);

const scorePopularity = (viewsCount: number, likesCount: number, max: number) =>
  Math.min(max, Math.floor(viewsCount / 5) + likesCount * 2);

const scoreRecency = (createdAt: Date, max: number) => {
  const ageDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) return max;
  if (ageDays <= 30) return Math.max(1, max - 2);
  return 1;
};

const getSpecificMaterialTags = (
  signal: Pick<
    LearnerBehaviorMaterialSignal,
    'tags' | 'categoryNameEn' | 'categoryNameAr' | 'materialType'
  >,
) =>
  signal.tags.filter((tag) => {
    const normalizedTag = normalizeText(tag);
    return (
      normalizedTag.length >= 3 &&
      normalizedTag !== normalizeText(signal.categoryNameEn) &&
      normalizedTag !== normalizeText(signal.categoryNameAr) &&
      normalizedTag !== normalizeText(signal.materialType)
    );
  });

const buildSpecificTerms = (signal: {
  title: string;
  description: string;
  materialType: string;
  categoryNameEn: string;
  categoryNameAr: string;
  tags: string[];
}) => {
  const terms = new Set<string>();
  const materialSignal: LearnerBehaviorMaterialSignal = {
    materialId: 'feature',
    title: signal.title,
    description: signal.description,
    materialType: signal.materialType,
    categoryNameEn: signal.categoryNameEn,
    categoryNameAr: signal.categoryNameAr,
    tags: signal.tags,
  };

  for (const term of extractAffinityTermsFromMaterial({
    ...materialSignal,
    description: '',
  })) {
    if (!GENERIC_BROAD_INTEREST_KEYS.has(term)) {
      terms.add(term);
    }
  }

  for (const token of tokenize(signal.title)) {
    if (token.length >= 4) {
      const canonical = resolveTermToInterestKey(token);
      if (canonical && !GENERIC_BROAD_INTEREST_KEYS.has(canonical)) {
        terms.add(canonical);
      }
    }
  }

  return terms;
};

const buildTitleTokens = (title: string) =>
  new Set(tokenize(title).filter((token) => token.length >= 4));

const formatLikedMaterialLabel = (feature: LikedMaterialFeature) => {
  for (const token of feature.titleTokens) {
    const canonical = resolveTermToInterestKey(token);
    if (canonical && !GENERIC_BROAD_INTEREST_KEYS.has(canonical)) {
      if (canonical === 'arduino') return 'Arduino';
      if (canonical === 'fabric_textiles') return 'Fabric';
      return token.charAt(0).toUpperCase() + token.slice(1);
    }
  }

  for (const tag of feature.specificTags) {
    const canonical = resolveTermToInterestKey(tag);
    if (canonical === 'arduino') return 'Arduino';
    if (canonical === 'fabric_textiles') return 'Fabric';
  }

  return null;
};

const buildMaterialSignalFeature = (
  signal: LearnerBehaviorMaterialSignal,
): BehaviorSignalFeature => ({
  specificTerms: buildSpecificTerms(signal),
  specificTags: new Set(
    getSpecificMaterialTags(signal).map((tag) => normalizeText(tag)),
  ),
  titleTokens: buildTitleTokens(signal.title),
  normalizedMaterialType: normalizeText(signal.materialType),
  normalizedCategory: normalizeText(
    signal.categoryNameEn || signal.categoryNameAr,
  ),
  categoryNameEn: signal.categoryNameEn,
  categoryNameAr: signal.categoryNameAr,
  title: signal.title,
});

const buildProjectSignalFeature = (
  signal: LearnerBehaviorProjectSignal,
): BehaviorSignalFeature => {
  const terms = new Set<string>();
  for (const term of extractAffinityTermsFromProject(signal)) {
    if (!GENERIC_BROAD_INTEREST_KEYS.has(term)) {
      terms.add(term);
    }
  }

  return {
    specificTerms: terms,
    specificTags: new Set(signal.tags.map((tag) => normalizeText(tag))),
    titleTokens: buildTitleTokens(signal.title),
    normalizedMaterialType: '',
    normalizedCategory: normalizeText(
      signal.categoryNameEn || signal.categoryNameAr,
    ),
    categoryNameEn: signal.categoryNameEn,
    categoryNameAr: signal.categoryNameAr,
    title: signal.title,
  };
};

const intersectsSets = (left: Set<string>, right: Set<string>) => {
  for (const value of left) {
    if (right.has(value)) {
      return true;
    }
  }
  return false;
};

const intersectSets = (left: Set<string>, right: Set<string>) => {
  const shared = new Set<string>();
  for (const value of left) {
    if (right.has(value)) {
      shared.add(value);
    }
  }
  return shared;
};

const hasSpecificCategoryMatch = (
  leftCategory: string,
  rightCategory: string,
) =>
  leftCategory.length >= 4 &&
  rightCategory.length >= 4 &&
  leftCategory === rightCategory &&
  !GENERIC_MATERIAL_TYPES.has(leftCategory);

const signalsOverlap = (
  material: MaterialRecommendationFeature,
  signal: BehaviorSignalFeature,
) => {
  if (intersectsSets(material.titleTokens, signal.titleTokens)) {
    return true;
  }
  if (intersectsSets(material.specificTags, signal.specificTags)) {
    return true;
  }
  const sharedTerms = intersectSets(material.specificTerms, signal.specificTerms);
  if (
    sharedTerms.size > 0 &&
    [...sharedTerms].some(isQualifiedLikedSimilaritySharedTerm)
  ) {
    return true;
  }
  if (
    material.normalizedMaterialType.length >= 4 &&
    signal.normalizedMaterialType.length >= 4 &&
    material.normalizedMaterialType === signal.normalizedMaterialType &&
    !GENERIC_MATERIAL_TYPES.has(material.normalizedMaterialType)
  ) {
    return true;
  }
  return hasSpecificCategoryMatch(
    material.normalizedCategory,
    signal.normalizedCategory,
  );
};

const buildPoolSignature = (materials: LearnerHomeMaterialCandidate[]) =>
  materials
    .map((material) => material.id)
    .sort()
    .join('|');

const indexTerm = (
  map: Map<string, Set<string>>,
  term: string,
  materialId: string,
) => {
  if (term.length < 2) return;
  const bucket = map.get(term) ?? new Set<string>();
  bucket.add(materialId);
  map.set(term, bucket);
};

export const buildMaterialRecommendationFeature = (
  material: LearnerHomeMaterialCandidate,
): MaterialRecommendationFeature => {
  const haystackParts = buildMaterialMatchHaystack({
    title: material.title,
    description: material.description,
    materialType: material.materialType,
    categoryNameEn: material.categoryNameEn,
    categoryNameAr: material.categoryNameAr,
    tags: material.tags,
  });
  const interestKeys = new Set<string>();
  const interestMatches = new Map<string, LearnerInterestMatch>();

  for (const key of ALL_LEARNER_INTEREST_KEYS) {
    const match = matchInterestKeyAgainstMaterial(haystackParts, key);
    if (match) {
      interestKeys.add(key);
      interestMatches.set(key, match);
    }
  }

  const specificTerms = buildSpecificTerms(material);
  const specificTags = new Set(
    getSpecificMaterialTags({
      tags: material.tags,
      categoryNameEn: material.categoryNameEn,
      categoryNameAr: material.categoryNameAr,
      materialType: material.materialType,
    }).map((tag) => normalizeText(tag)),
  );

  return {
    materialId: material.id,
    ownerId: material.ownerId,
    candidate: material,
    haystackParts,
    normalizedTitle: normalizeText(material.title),
    normalizedCategory: normalizeText(
      `${material.categoryNameEn} ${material.categoryNameAr}`,
    ),
    normalizedMaterialType: normalizeText(material.materialType),
    categoryId: material.categoryId,
    normalizedCity: normalizeText(material.city),
    normalizedArea: normalizeText(material.area ?? ''),
    tags: new Set(material.tags.map((tag) => normalizeText(tag))),
    specificTags,
    specificTerms,
    interestKeys,
    interestMatches,
    titleTokens: buildTitleTokens(material.title),
    popularityScore: scorePopularity(
      material.viewsCount,
      material.likesCount,
      MATERIAL_SCORE_WEIGHTS.popularityMax,
    ),
    recencyScore: scoreRecency(
      material.createdAt,
      MATERIAL_SCORE_WEIGHTS.recencyMax,
    ),
  };
};

export const buildMaterialFeatureIndex = (
  features: MaterialRecommendationFeature[],
  poolSignature: string,
): MaterialFeatureIndex => {
  const byMaterialId = new Map(
    features.map((feature) => [feature.materialId, feature]),
  );
  const byInterestKey = new Map<string, Set<string>>();
  const byTerm = new Map<string, Set<string>>();
  const byCategoryId = new Map<string, Set<string>>();
  const byCity = new Map<string, Set<string>>();

  for (const feature of features) {
    for (const key of feature.interestKeys) {
      indexTerm(byInterestKey, key, feature.materialId);
    }
    for (const term of feature.specificTerms) {
      indexTerm(byTerm, term, feature.materialId);
    }
    for (const tag of feature.specificTags) {
      indexTerm(byTerm, tag, feature.materialId);
    }
    indexTerm(byCategoryId, feature.categoryId, feature.materialId);
    if (feature.normalizedCity.length > 0) {
      indexTerm(byCity, feature.normalizedCity, feature.materialId);
    }
  }

  return {
    byMaterialId,
    byInterestKey,
    byTerm,
    byCategoryId,
    byCity,
    poolSignature,
  };
};

export const getOrBuildMaterialFeaturePool = (
  materials: LearnerHomeMaterialCandidate[],
) => {
  const poolSignature = buildPoolSignature(materials);
  const now = Date.now();

  if (
    featurePoolCache &&
    featurePoolCache.poolSignature === poolSignature &&
    featurePoolCache.expiresAt > now
  ) {
    return {
      features: featurePoolCache.features,
      index: featurePoolCache.index,
    };
  }

  const features = materials.map((material) =>
    buildMaterialRecommendationFeature(material),
  );
  const index = buildMaterialFeatureIndex(features, poolSignature);
  featurePoolCache = {
    expiresAt: now + FEATURE_CACHE_TTL_MS,
    poolSignature,
    features,
    index,
  };

  return { features, index };
};

export const resetMaterialFeaturePoolCacheForTests = () => {
  featurePoolCache = null;
};

const buildSavedComponentFeature = (
  component: LearnerHomeSavedProjectComponent,
): SavedComponentFeature => {
  const terms = new Set<string>();
  const normalizedComponentName = normalizeText(component.componentName);
  const normalizedMaterialType = normalizeText(component.materialType);

  if (normalizedComponentName.length >= 3) {
    terms.add(normalizedComponentName);
  }
  if (normalizedMaterialType.length >= 3) {
    terms.add(normalizedMaterialType);
  }
  for (const keyword of component.searchKeywords) {
    const normalized = normalizeText(keyword);
    if (normalized.length >= 3) {
      terms.add(normalized);
    }
  }

  return {
    component,
    categoryId: component.categoryId,
    normalizedComponentName,
    normalizedMaterialType,
    terms,
  };
};

export const buildUserSignalProfile = (input: {
  interests: string[];
  savedComponents: LearnerHomeSavedProjectComponent[];
  savedLocation: LearnerHomeSavedLocationContext;
  behavior: LearnerBehaviorContext;
  behaviorAffinityProfile: LearnerAffinityProfile;
}): UserSignalProfile => {
  const explicitInterestKeys: string[] = [];
  const customInterestKeys: string[] = [];

  for (const interest of input.interests) {
    const resolved = resolveInterestKey(interest);
    if (!resolved) continue;
    if (isCustomInterestKey(resolved)) {
      customInterestKeys.push(resolved);
    } else {
      explicitInterestKeys.push(resolved);
    }
  }

  const behaviorAffinityKeys = new Map<string, number>();
  for (const [term, weight] of input.behaviorAffinityProfile.entries()) {
    if (weight >= AFFINITY_RELEVANCE_THRESHOLD) {
      behaviorAffinityKeys.set(term, weight);
    }
  }

  return {
    explicitInterestKeys,
    customInterestKeys,
    likedMaterialIds: new Set(
      input.behavior.likedMaterials.map((signal) => signal.materialId),
    ),
    likedMaterialSignals: input.behavior.likedMaterials,
    likedFeatures: input.behavior.likedMaterials.map((signal) => ({
      ...buildMaterialSignalFeature(signal),
      materialId: signal.materialId,
      label: null,
    })).map((feature) => ({
      ...feature,
      label: formatLikedMaterialLabel(feature),
    })),
    reservedFeatures: input.behavior.reservedMaterials.map(
      buildMaterialSignalFeature,
    ),
    viewedFeatures: input.behavior.viewedMaterials.map(
      buildMaterialSignalFeature,
    ),
    savedProjectFeatures: input.behavior.savedProjects.map(
      buildProjectSignalFeature,
    ),
    inProgressBuildFeatures: input.behavior.inProgressBuildProjects.map(
      buildProjectSignalFeature,
    ),
    savedComponentFeatures: input.savedComponents.map(buildSavedComponentFeature),
    behaviorAffinityKeys,
    savedLocation: input.savedLocation,
    hasActivity: hasLearnerActivity(input.behavior),
    allowsWeakOnlyFallback:
      input.interests.length === 0 &&
      input.savedComponents.length === 0 &&
      !hasLearnerActivity(input.behavior),
  };
};

const pickBestInterestMatch = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
): LearnerInterestMatch | null => {
  let bestMatch: LearnerInterestMatch | null = null;

  for (const key of [...user.explicitInterestKeys, ...user.customInterestKeys]) {
    const resolved = resolveInterestKey(key);
    if (!resolved) continue;

    const match = isCustomInterestKey(resolved)
      ? matchCustomInterestKeyAgainstMaterial(feature.haystackParts, resolved)
      : feature.interestMatches.get(resolved) ?? null;

    if (!match) continue;

    const rankingScore = match.scoreWeight;
    const bestRanking = bestMatch?.scoreWeight ?? -1;
    if (!bestMatch || rankingScore > bestRanking) {
      bestMatch = match;
    }
  }

  return bestMatch;
};

const findMatchingSavedComponentFeature = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
): LearnerHomeSavedProjectComponent | null => {
  for (const saved of user.savedComponentFeatures) {
    if (saved.categoryId && saved.categoryId === feature.categoryId) {
      return saved.component;
    }

    if (
      saved.normalizedComponentName.length > 0 &&
      (feature.normalizedTitle.includes(saved.normalizedComponentName) ||
        feature.haystackParts.full.includes(saved.normalizedComponentName))
    ) {
      return saved.component;
    }

    if (intersectsSets(saved.terms, feature.specificTerms)) {
      return saved.component;
    }

    if (
      saved.normalizedMaterialType.length > 0 &&
      feature.normalizedMaterialType.length > 0 &&
      (feature.normalizedMaterialType.includes(saved.normalizedMaterialType) ||
        saved.normalizedMaterialType.includes(feature.normalizedMaterialType))
    ) {
      return saved.component;
    }
  }

  return null;
};

const matchAffinityTerms = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
) => {
  const matched: string[] = [];
  for (const [term] of user.behaviorAffinityKeys) {
    if (feature.interestKeys.has(term) || feature.specificTerms.has(term)) {
      matched.push(term);
    }
  }
  return matched;
};

const scoreLikedSimilarity = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
) => {
  if (user.likedFeatures.length === 0) {
    return {
      score: 0,
      reason: null,
      isExactLikedItem: false,
    };
  }

  if (user.likedMaterialIds.has(feature.materialId)) {
    return {
      score: 0,
      reason: null,
      isExactLikedItem: true,
    };
  }

  let bestScore = 0;
  let bestReason: string | null = null;

  for (const liked of user.likedFeatures) {
    let score = 0;
    const sharedTerms = new Set<string>();
    let hasTagOverlap = false;

    for (const tag of feature.specificTags) {
      if (liked.specificTags.has(tag)) {
        hasTagOverlap = true;
        sharedTerms.add(tag);
        score += LIKED_SIMILARITY_SCORE_WEIGHTS.tagOverlap;
      }
    }

    for (const term of feature.specificTerms) {
      if (liked.specificTerms.has(term)) {
        sharedTerms.add(term);
        score += LIKED_SIMILARITY_SCORE_WEIGHTS.taxonomyTerm;
      }
    }

    if (
      feature.normalizedMaterialType.length >= 4 &&
      feature.normalizedMaterialType === liked.normalizedMaterialType &&
      !GENERIC_MATERIAL_TYPES.has(feature.normalizedMaterialType)
    ) {
      score += LIKED_SIMILARITY_SCORE_WEIGHTS.specificMaterialType;
    }

    const hasCategoryMatch = hasSpecificCategoryMatch(
      feature.normalizedCategory,
      liked.normalizedCategory,
    );
    const hasQualifiedOverlap =
      hasTagOverlap ||
      hasCategoryMatch ||
      [...sharedTerms].some(isQualifiedLikedSimilaritySharedTerm);

    if (
      !hasQualifiedOverlap ||
      score < LIKED_SIMILARITY_SCORE_WEIGHTS.minScoreForMatch ||
      sharedTerms.size === 0
    ) {
      continue;
    }

    score = Math.min(BEHAVIOR_SCORE_WEIGHTS.likedSimilar, score);
    const reason = liked.label
      ? `Similar to your liked ${liked.label} materials`
      : 'Similar to materials you liked';

    if (score > bestScore) {
      bestScore = score;
      bestReason = reason;
    }
  }

  return {
    score: bestScore,
    reason: bestReason,
    isExactLikedItem: false,
  };
};

const scoreBehaviorFromFeatures = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
  likedSimilarity: ReturnType<typeof scoreLikedSimilarity>,
) => {
  if (!user.hasActivity) {
    return { score: 0, reasons: [] as string[], matchedAffinityTerms: [] as string[] };
  }

  const matchedAffinityTerms = matchAffinityTerms(feature, user);
  let score = 0;
  const reasons: string[] = [];

  if (
    hasMeaningfulBehaviorAffinity(
      new Map([...user.behaviorAffinityKeys.entries()]),
    ) &&
    matchedAffinityTerms.length > 0
  ) {
    const topWeight = Math.max(
      ...matchedAffinityTerms.map((term) => user.behaviorAffinityKeys.get(term) ?? 0),
    );
    score += Math.min(
      BEHAVIOR_SCORE_WEIGHTS.affinityMatchMax,
      Math.round(topWeight * 12),
    );
  }

  const reservedMatch = user.reservedFeatures.some((signal) =>
    signalsOverlap(feature, signal),
  );
  if (reservedMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.reservedSimilar;
    reasons.push('Similar to materials you reserved');
  }

  if (likedSimilarity.score > 0 && likedSimilarity.reason) {
    score += likedSimilarity.score;
    reasons.push(likedSimilarity.reason);
  }

  const viewedMatch = user.viewedFeatures.some((signal) =>
    signalsOverlap(feature, signal),
  );
  if (viewedMatch && !reservedMatch && likedSimilarity.score === 0) {
    score += BEHAVIOR_SCORE_WEIGHTS.viewedSimilar;
    reasons.push('Matches your recent activity');
  }

  const savedProjectMatch = user.savedProjectFeatures.some((signal) =>
    signalsOverlap(feature, signal),
  );
  if (savedProjectMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.savedRelatedProject;
    reasons.push('Related to your saved projects');
  }

  const buildMatch = user.inProgressBuildFeatures.find((signal) =>
    signalsOverlap(feature, signal),
  );
  if (buildMatch) {
    score += BEHAVIOR_SCORE_WEIGHTS.continuedBuild;
    const categoryLabel =
      buildMatch.categoryNameEn.trim() || buildMatch.title.trim() || 'project';
    reasons.push(`Because you are building a ${categoryLabel} project`);
  }

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 2),
    matchedAffinityTerms,
  };
};

const resolveSuggestedMaterialTier = (input: {
  matchedComponent: LearnerHomeSavedProjectComponent | null;
  interestMatch: LearnerInterestMatch | null;
  behaviorScore: number;
  allowsWeakOnlyFallback: boolean;
  hasAnyRelevance: boolean;
  hasBehaviorActivity: boolean;
}): SuggestedMaterialTier => {
  if (input.interestMatch?.strength === 'strong') {
    return SUGGESTED_MATERIAL_TIERS.interestStrong;
  }
  if (input.hasBehaviorActivity && input.behaviorScore >= 12) {
    return SUGGESTED_MATERIAL_TIERS.behaviorStrong;
  }
  if (input.matchedComponent) {
    return SUGGESTED_MATERIAL_TIERS.savedProjectComponent;
  }
  if (
    input.interestMatch?.strength === 'group' ||
    input.interestMatch?.strength === 'custom'
  ) {
    return SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom;
  }
  if (input.allowsWeakOnlyFallback && input.hasAnyRelevance) {
    return SUGGESTED_MATERIAL_TIERS.fallback;
  }
  return SUGGESTED_MATERIAL_TIERS.fallback;
};

const resolveSavedProjectMaterialTier = (input: {
  interestMatch: LearnerInterestMatch | null;
  behaviorScore: number;
  hasBehaviorActivity: boolean;
}) => {
  const hasInterest = Boolean(input.interestMatch);
  const hasBehavior = input.hasBehaviorActivity && input.behaviorScore >= 12;
  if (hasInterest || hasBehavior) {
    return SAVED_PROJECT_MATERIAL_TIERS.savedProjectEnriched;
  }
  return SAVED_PROJECT_MATERIAL_TIERS.savedProjectComponent;
};

type MaterialScoringContext = {
  interestMatch: LearnerInterestMatch | null;
  matchedComponent: LearnerHomeSavedProjectComponent | null;
  likedSimilarity: ReturnType<typeof scoreLikedSimilarity>;
  behavior: ReturnType<typeof scoreBehaviorFromFeatures>;
};

const buildMaterialScoringContext = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
): MaterialScoringContext => {
  const likedSimilarity = scoreLikedSimilarity(feature, user);
  return {
    interestMatch: pickBestInterestMatch(feature, user),
    matchedComponent: findMatchingSavedComponentFeature(feature, user),
    likedSimilarity,
    behavior: scoreBehaviorFromFeatures(feature, user, likedSimilarity),
  };
};

const buildSuggestedScore = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
  ctx: MaterialScoringContext,
): ScoredMaterialResult => {
  const material = feature.candidate;
  if (material.status !== 'AVAILABLE' || material.availableQuantity <= 0) {
    return {
      score: UNAVAILABLE_MATERIAL_PENALTY,
      reasons: [],
      tier: SUGGESTED_MATERIAL_TIERS.fallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
    };
  }

  const { interestMatch, matchedComponent, likedSimilarity, behavior } = ctx;
  const locationMatch = locationMatches(material, user.savedLocation);
  const hasPrimaryRelevance = Boolean(
    matchedComponent || interestMatch || behavior.matchedAffinityTerms.length > 0,
  );
  const fallbackOnly =
    user.allowsWeakOnlyFallback &&
    !matchedComponent &&
    !interestMatch &&
    behavior.score === 0;
  const hasAnyRelevance =
    hasPrimaryRelevance || fallbackOnly || behavior.score > 0;

  if (!hasAnyRelevance && !user.allowsWeakOnlyFallback) {
    return {
      score: 0,
      reasons: [],
      tier: SUGGESTED_MATERIAL_TIERS.fallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
    };
  }

  const tier = resolveSuggestedMaterialTier({
    matchedComponent,
    interestMatch,
    behaviorScore: behavior.score,
    allowsWeakOnlyFallback: user.allowsWeakOnlyFallback,
    hasAnyRelevance,
    hasBehaviorActivity: user.hasActivity,
  });

  const reasons: string[] = [];
  let relevanceScore = 0;
  let bonusScore = 0;

  if (interestMatch) {
    relevanceScore += interestMatch.scoreWeight;
    reasons.push(buildInterestMatchReason(interestMatch));
  }
  if (behavior.score > 0) {
    relevanceScore += behavior.score;
    reasons.push(...behavior.reasons);
  }
  if (matchedComponent) {
    relevanceScore += MATERIAL_SCORE_WEIGHTS.savedProjectComponent;
    reasons.push(
      `Useful for your saved ${matchedComponent.projectTitle} project`,
    );
    reasons.push(
      `Matches required component: ${matchedComponent.componentName}`,
    );
  }
  if (locationMatch) {
    bonusScore += MATERIAL_SCORE_WEIGHTS.locationMatch;
    if (tier <= SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom || fallbackOnly) {
      reasons.push('Available near your saved location');
    }
  }
  if (material.isFree) {
    bonusScore += MATERIAL_SCORE_WEIGHTS.free;
    if (fallbackOnly || tier >= SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom) {
      reasons.push('Free material');
    }
  }
  if (material.deliveryAllowed) {
    bonusScore += MATERIAL_SCORE_WEIGHTS.delivery;
    if (fallbackOnly || tier >= SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom) {
      reasons.push('Delivery available');
    }
  }
  if (feature.popularityScore > 0) {
    bonusScore += feature.popularityScore;
    if (fallbackOnly && feature.popularityScore >= 4) {
      reasons.push('Popular material');
    }
  }
  if (fallbackOnly && feature.recencyScore >= MATERIAL_SCORE_WEIGHTS.recencyMax - 1) {
    reasons.push('Recently added');
  }
  bonusScore += feature.recencyScore;

  let score = relevanceScore + bonusScore;
  if (likedSimilarity.isExactLikedItem) {
    score -= ALREADY_LIKED_MATERIAL_PENALTY;
  }

  return {
    score,
    reasons: orderMaterialReasons(reasons).slice(0, 4),
    tier,
    hasPrimaryRelevance,
    fallbackOnly,
  };
};

const buildSavedProjectsScore = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
  suggested: ScoredMaterialResult,
  ctx: MaterialScoringContext,
): ScoredMaterialResult => {
  const matchedComponent = ctx.matchedComponent;
  if (!matchedComponent) {
    return {
      score: UNAVAILABLE_MATERIAL_PENALTY,
      reasons: [],
      tier: SUGGESTED_MATERIAL_TIERS.fallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
    };
  }

  if (suggested.score <= UNAVAILABLE_MATERIAL_PENALTY / 2) {
    return suggested;
  }

  const { interestMatch, behavior } = ctx;
  const tier = resolveSavedProjectMaterialTier({
    interestMatch,
    behaviorScore: behavior.score,
    hasBehaviorActivity: user.hasActivity,
  });

  const reasons = orderMaterialReasons([
    `Useful for your saved ${matchedComponent.projectTitle} project`,
    `Matches required component: ${matchedComponent.componentName}`,
    ...suggested.reasons,
    ...(interestMatch && interestMatch.strength === 'strong'
      ? [buildInterestMatchReason(interestMatch)]
      : []),
  ]);

  return {
    score: suggested.score + MATERIAL_SCORE_WEIGHTS.savedProjectComponent,
    reasons,
    tier,
    hasPrimaryRelevance: true,
    fallbackOnly: false,
  };
};

const buildFreeScore = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
  ctx: MaterialScoringContext,
): ScoredMaterialResult => {
  const material = feature.candidate;
  if (
    material.status !== 'AVAILABLE' ||
    material.availableQuantity <= 0 ||
    !material.isFree
  ) {
    return {
      score: UNAVAILABLE_MATERIAL_PENALTY,
      reasons: [],
      tier: FREE_MATERIAL_TIERS.freeFallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
    };
  }

  const { interestMatch, behavior } = ctx;
  const nearLocation = locationMatches(material, user.savedLocation);
  const hasPersonalSignal =
    Boolean(interestMatch) || (user.hasActivity && behavior.score > 0);

  const reasons = ['Free material'];
  let score = MATERIAL_SCORE_WEIGHTS.free * 2;
  let tier: MaterialScoringTier = FREE_MATERIAL_TIERS.freeFallback;

  if (nearLocation) {
    score += MATERIAL_SCORE_WEIGHTS.locationMatch;
    reasons.push('Free material near your saved location');
    tier = FREE_MATERIAL_TIERS.freeNearLocation;
  } else if (hasPersonalSignal) {
    tier = FREE_MATERIAL_TIERS.freeInterestOrBehavior;
    if (interestMatch) {
      reasons.push(buildInterestMatchReason(interestMatch));
    } else if (behavior.reasons.length > 0) {
      reasons.push(behavior.reasons[0]!);
    }
  }

  score += feature.popularityScore;
  score += feature.recencyScore;

  return {
    score,
    reasons: orderMaterialReasons(reasons),
    tier,
    hasPrimaryRelevance: hasPersonalSignal,
    fallbackOnly: !hasPersonalSignal && !nearLocation,
  };
};

const buildMaterialScoreRecord = (
  feature: MaterialRecommendationFeature,
  user: UserSignalProfile,
): MaterialScoreRecord => {
  const ctx = buildMaterialScoringContext(feature, user);
  const suggested = buildSuggestedScore(feature, user, ctx);
  return {
    materialId: feature.materialId,
    ownerId: feature.ownerId,
    candidate: feature.candidate,
    suggested,
    savedProjects: buildSavedProjectsScore(feature, user, suggested, ctx),
    free: buildFreeScore(feature, user, ctx),
  };
};

export const scoreMaterialPoolWithFeatures = (input: {
  materials: LearnerHomeMaterialCandidate[];
  interests: string[];
  savedComponents: LearnerHomeSavedProjectComponent[];
  savedLocation: LearnerHomeSavedLocationContext;
  behavior: LearnerBehaviorContext;
  behaviorAffinityProfile: LearnerAffinityProfile;
}): MaterialScoreRecord[] => {
  const { features } = getOrBuildMaterialFeaturePool(input.materials);
  const user = buildUserSignalProfile(input);

  return features.map((feature) => buildMaterialScoreRecord(feature, user));
};

export type PreScoredMaterialEntry = {
  material: LearnerHomeMaterialCandidate;
  ownerId: string;
  scores: {
    suggested: ScoredMaterialResult;
    savedProjects: ScoredMaterialResult;
    free: ScoredMaterialResult;
  };
};

export const preScoreMaterialPool = (input: {
  materials: LearnerHomeMaterialCandidate[];
  interests: string[];
  savedComponents: LearnerHomeSavedProjectComponent[];
  savedLocation: LearnerHomeSavedLocationContext;
  behavior: LearnerBehaviorContext;
  behaviorAffinityProfile: LearnerAffinityProfile;
}): PreScoredMaterialEntry[] =>
  scoreMaterialPoolWithFeatures(input).map((record) => ({
    material: record.candidate,
    ownerId: record.ownerId,
    scores: {
      suggested: record.suggested,
      savedProjects: record.savedProjects,
      free: record.free,
    },
  }));
