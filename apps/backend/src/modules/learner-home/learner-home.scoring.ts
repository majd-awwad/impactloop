import type {
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
  LearnerHomeSavedLocationContext,
  LearnerHomeSavedProjectComponent,
  LearnerBehaviorContext,
  LearnerAffinityProfile,
} from './learner-home.types.js';
import type { RecommendationScorerVersion } from '../../config/recommendation-scoring-version.js';
import { RECOMMENDATION_SCORER_VERSION } from '../../config/recommendation-scoring-version.js';
import {
  CANONICAL_SCORING_MODE,
  CanonicalScoringContextRequiredError,
  scoreCanonicalMaterialCandidate,
  type CanonicalMaterialScoringContext,
} from './learner-home.canonical-scoring.js';
import {
  buildInterestMatchReason,
  getInterestSearchTermsForKey,
  isCustomInterestKey,
  matchLearnerInterestsAgainstHaystack,
  matchLearnerInterestsAgainstHaystackForScorerVersion,
  matchLearnerInterestsAgainstMaterial,
  matchLearnerInterestsAgainstMaterialForScorerVersion,
  normalizeInterestToken,
  normalizeLearnerInterestKeys,
  normalizeText,
  resolveInterestKey,
  type LearnerInterestMatch,
} from './learner-interest-taxonomy.js';
import {
  createEmptyAffinityProfile,
  createEmptyBehaviorContext,
  hasLearnerActivity,
  hasMeaningfulBehaviorAffinity,
  matchesAffinityProfile,
  scoreMaterialBehaviorMatch,
  scoreProjectBehaviorMatch,
} from './learner-home.affinity.js';
import {
  FREE_MATERIAL_TIERS,
  SAVED_PROJECT_MATERIAL_TIERS,
  SUGGESTED_MATERIAL_TIERS,
  SUGGESTED_PROJECT_TIERS,
  type MaterialScoreAudit,
  type MaterialScoringTier,
  type SuggestedMaterialTier,
} from './learner-home.ranking.js';

export const resolveMaterialScorerVersion = (
  scorerVersion?: RecommendationScorerVersion,
): RecommendationScorerVersion => scorerVersion ?? RECOMMENDATION_SCORER_VERSION;

/**
 * RP-03.1 correction: legacy/normalized feature and relevance builders
 * (buildMaterialRecommendationFeature, getOrBuildMaterialFeaturePool,
 * scoreMaterialPoolWithFeatures, assessSuggestedMaterialRelevance,
 * buildMaterialScoringSharedState) must never process canonical-taxonomy-v3.
 * This is the single bounded resolver/assertion used by every one of them: it
 * resolves the explicit or process mode, then throws rather than silently
 * returning a canonical value. preScoreMaterialPool and the three direct
 * final material scorers are exempt — they retain their own canonical
 * dispatch with a required CanonicalMaterialScoringContext.
 */
export const resolveNonCanonicalMaterialScorerVersion = (
  scorerVersion?: RecommendationScorerVersion,
): Exclude<RecommendationScorerVersion, typeof CANONICAL_SCORING_MODE> => {
  const resolved = resolveMaterialScorerVersion(scorerVersion);
  if (resolved === CANONICAL_SCORING_MODE) {
    throw new CanonicalScoringContextRequiredError(
      'this legacy/normalized helper must never process canonical-taxonomy-v3; ' +
        'canonical scoring requires preScoreMaterialPool or a direct canonical-aware scorer with an explicit CanonicalMaterialScoringContext',
    );
  }
  return resolved;
};

/** Projects never use canonical-taxonomy-v3; force legacy-v1 when that mode is selected. */
export const resolveProjectScorerVersion = (
  scorerVersion?: RecommendationScorerVersion,
): RecommendationScorerVersion => {
  const resolved = resolveMaterialScorerVersion(scorerVersion);
  return resolved === CANONICAL_SCORING_MODE ? 'legacy-v1' : resolved;
};

const requireCanonicalContext = (
  context: CanonicalMaterialScoringContext | undefined,
): CanonicalMaterialScoringContext => {
  if (!context) {
    throw new CanonicalScoringContextRequiredError();
  }
  return context;
};

export const MATERIAL_SCORE_WEIGHTS = {
  interestMatch: 40,
  savedProjectComponent: 45,
  locationMatch: 25,
  free: 8,
  delivery: 6,
  popularityMax: 10,
  recencyMax: 5,
} as const;

export const PROJECT_SCORE_WEIGHTS = {
  interestMatch: 40,
  matchingMaterials: 20,
  popularityMax: 15,
  recencyMax: 5,
} as const;

export const UNAVAILABLE_MATERIAL_PENALTY = -1000;
export const ALREADY_LIKED_MATERIAL_PENALTY = 18;

export { normalizeText, normalizeInterestToken as normalizeInterestKey };

export const normalizeInterests = (interests: string[]) =>
  normalizeLearnerInterestKeys(interests);

export const getInterestSearchTerms = (interest: string) => {
  const key = resolveInterestKey(interest);
  if (!key || isCustomInterestKey(key)) {
    return [] as string[];
  }

  return getInterestSearchTermsForKey(key);
};

const haystackForMaterial = (material: LearnerHomeMaterialCandidate) =>
  normalizeText(
    [
      material.title,
      material.description,
      material.materialType,
      material.categoryNameEn,
      material.categoryNameAr,
      ...material.tags,
    ].join(' '),
  );

const haystackForProject = (project: LearnerHomeProjectCandidate) =>
  normalizeText(
    [
      project.title,
      project.shortDescription,
      project.categoryNameEn,
      project.categoryNameAr,
      ...project.tags,
    ].join(' '),
  );

const haystackForComponent = (component: LearnerHomeSavedProjectComponent) =>
  normalizeText(
    [
      component.componentName,
      component.materialType,
      ...component.searchKeywords,
    ].join(' '),
  );

export const matchesInterest = (
  haystack: string,
  interests: string[],
): string | null => {
  const match = matchLearnerInterestsAgainstHaystack(haystack, interests);
  return match?.labelEn ?? null;
};

export const findMatchingSavedComponent = (
  material: LearnerHomeMaterialCandidate,
  components: LearnerHomeSavedProjectComponent[],
): LearnerHomeSavedProjectComponent | null => {
  const materialHaystack = haystackForMaterial(material);

  for (const component of components) {
    if (
      component.categoryId &&
      component.categoryId === material.categoryId
    ) {
      return component;
    }

    const componentHaystack = haystackForComponent(component);
    const componentName = normalizeText(component.componentName);
    if (
      componentName.length > 0 &&
      (materialHaystack.includes(componentName) ||
        normalizeText(material.title).includes(componentName))
    ) {
      return component;
    }

    if (
      component.searchKeywords.some((keyword) =>
        materialHaystack.includes(normalizeText(keyword)),
      )
    ) {
      return component;
    }

    const materialType = normalizeText(material.materialType);
    const componentType = normalizeText(component.materialType);
    if (
      componentType.length > 0 &&
      materialType.length > 0 &&
      (materialType.includes(componentType) || componentType.includes(materialType))
    ) {
      return component;
    }
  }

  return null;
};

export const materialMatchesProjectComponent = (
  material: LearnerHomeMaterialCandidate,
  component: LearnerHomeProjectCandidate['requiredComponents'][number],
): boolean => {
  if (component.categoryId && component.categoryId === material.categoryId) {
    return true;
  }

  const materialHaystack = haystackForMaterial(material);
  const componentName = normalizeText(component.componentName);
  if (
    componentName.length > 0 &&
    (materialHaystack.includes(componentName) ||
      normalizeText(material.title).includes(componentName))
  ) {
    return true;
  }

  return component.searchKeywords.some((keyword) =>
    materialHaystack.includes(normalizeText(keyword)),
  );
};

const scorePopularity = (viewsCount: number, likesCount: number, max: number) =>
  Math.min(max, Math.floor(viewsCount / 5) + likesCount * 2);

const scoreRecency = (createdAt: Date, max: number) => {
  const ageMs = Date.now() - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays <= 7) {
    return max;
  }

  if (ageDays <= 30) {
    return Math.max(1, max - 2);
  }

  return 1;
};

export const locationMatches = (
  material: LearnerHomeMaterialCandidate,
  location: LearnerHomeSavedLocationContext,
) => {
  const savedCity = normalizeText(location.city ?? '');
  if (savedCity.length === 0) {
    return false;
  }

  const materialCity = normalizeText(material.city);
  if (materialCity !== savedCity) {
    return false;
  }

  const savedArea = normalizeText(location.area ?? '');
  if (savedArea.length === 0) {
    return true;
  }

  return normalizeText(material.area ?? '') === savedArea;
};

export type MaterialRelevanceAssessment = {
  matchedInterest: string | null;
  matchedInterestKey: string | null;
  matchedInterestReason: string | null;
  matchedInterestScore: number;
  interestMatch: LearnerInterestMatch | null;
  matchedComponent: LearnerHomeSavedProjectComponent | null;
  matchedAffinityTerms: string[];
  locationMatch: boolean;
  hasPrimaryRelevance: boolean;
  allowsWeakOnlyFallback: boolean;
};

export type ScoredMaterialResult = {
  score: number;
  reasons: string[];
  tier: MaterialScoringTier;
  hasPrimaryRelevance: boolean;
  fallbackOnly: boolean;
  audit?: MaterialScoreAudit;
};

const materialInterestInput = (material: LearnerHomeMaterialCandidate) => ({
  title: material.title,
  description: material.description,
  materialType: material.materialType,
  categoryNameEn: material.categoryNameEn,
  categoryNameAr: material.categoryNameAr,
  tags: material.tags,
});

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
  matchedComponent: LearnerHomeSavedProjectComponent;
  interestMatch: LearnerInterestMatch | null;
  behaviorScore: number;
  hasBehaviorActivity: boolean;
}) => {
  const hasInterest = Boolean(input.interestMatch);
  const hasBehavior =
    input.hasBehaviorActivity && input.behaviorScore >= 12;

  if (hasInterest || hasBehavior) {
    return SAVED_PROJECT_MATERIAL_TIERS.savedProjectEnriched;
  }

  return SAVED_PROJECT_MATERIAL_TIERS.savedProjectComponent;
};

const materialReasonRank = (reason: string) => {
  const normalized = reason.toLowerCase();

  if (normalized.startsWith('matches your') && normalized.includes('interest')) {
    return 1;
  }
  if (normalized.includes('based on materials you liked')) {
    return 2;
  }
  if (
    normalized.includes('similar to materials you liked') ||
    normalized.includes('similar to your liked')
  ) {
    return 2;
  }
  if (normalized.includes('similar to materials you reserved')) {
    return 3;
  }
  if (normalized.includes('matches your recent activity')) {
    return 4;
  }
  if (
    normalized.includes('because you are building') ||
    normalized.includes('related to your saved projects') ||
    normalized.includes('related to materials in your activity')
  ) {
    return 4;
  }
  if (
    normalized.includes('useful for your saved') ||
    normalized.includes('matches required component')
  ) {
    return 5;
  }
  if (normalized.includes('near your saved location')) {
    return 6;
  }
  if (normalized.includes('free material')) {
    return 7;
  }
  if (normalized.includes('delivery')) {
    return 8;
  }
  if (normalized.includes('popular material')) {
    return 9;
  }
  if (normalized.includes('recently added')) {
    return 10;
  }

  return 11;
};

export const orderMaterialReasons = (reasons: string[]) => {
  const seen = new Set<string>();

  return [...reasons]
    .sort((left, right) => materialReasonRank(left) - materialReasonRank(right))
    .filter((reason) => {
      if (seen.has(reason)) {
        return false;
      }

      seen.add(reason);
      return true;
    });
};

export const assessSuggestedMaterialRelevance = (input: {
  material: LearnerHomeMaterialCandidate;
  interests: string[];
  savedComponents: LearnerHomeSavedProjectComponent[];
  savedLocation: LearnerHomeSavedLocationContext;
  behaviorAffinityProfile?: LearnerAffinityProfile;
  behavior?: LearnerBehaviorContext;
  scorerVersion?: RecommendationScorerVersion;
}): MaterialRelevanceAssessment => {
  // Sealed: this legacy/normalized relevance builder must never process
  // canonical-taxonomy-v3, even when called directly without going through
  // scoreSuggestedMaterial's own canonical dispatch first.
  const scorerVersion = resolveNonCanonicalMaterialScorerVersion(input.scorerVersion);
  const interestMatch =
    input.interests.length > 0
      ? matchLearnerInterestsAgainstMaterialForScorerVersion(
          materialInterestInput(input.material),
          input.interests,
          scorerVersion,
        )
      : null;
  const matchedInterest = interestMatch?.labelEn ?? null;
  const matchedInterestReason = interestMatch
    ? buildInterestMatchReason(interestMatch)
    : null;
  const matchedComponent = findMatchingSavedComponent(
    input.material,
    input.savedComponents,
  );
  const behavior = input.behavior ?? createEmptyBehaviorContext();
  const behaviorProfile =
    input.behaviorAffinityProfile ?? createEmptyAffinityProfile();
  const matchedAffinityTerms =
    hasLearnerActivity(behavior) && hasMeaningfulBehaviorAffinity(behaviorProfile)
      ? matchesAffinityProfile(haystackForMaterial(input.material), behaviorProfile)
      : [];
  const locationMatch = locationMatches(input.material, input.savedLocation);
  const hasPrimaryRelevance = Boolean(
    matchedComponent ||
      interestMatch ||
      matchedAffinityTerms.length > 0,
  );
  const allowsWeakOnlyFallback =
    input.interests.length === 0 &&
    input.savedComponents.length === 0 &&
    !hasLearnerActivity(behavior);

  return {
    matchedInterest,
    matchedInterestKey: interestMatch?.key ?? null,
    matchedInterestReason,
    matchedInterestScore: interestMatch?.scoreWeight ?? 0,
    interestMatch,
    matchedComponent,
    matchedAffinityTerms,
    locationMatch,
    hasPrimaryRelevance,
    allowsWeakOnlyFallback,
  };
};

export const hasStrongMaterialReason = (reason: string) => {
  const normalized = reason.toLowerCase();
  return (
    normalized.startsWith('matches your') ||
    normalized.startsWith('related to your') ||
    normalized.includes('useful for your saved') ||
    normalized.includes('matches required component') ||
    normalized.includes('based on materials you liked') ||
    normalized.includes('similar to materials you reserved') ||
    normalized.includes('related to your saved projects') ||
    normalized.includes('matches your recent activity') ||
    normalized.includes('because you are building')
  );
};

export type MaterialScoringSharedState = {
  relevance: MaterialRelevanceAssessment;
  behaviorMatch: ReturnType<typeof scoreMaterialBehaviorMatch>;
  interestMatch: LearnerInterestMatch | null;
  locationMatch: boolean;
  matchedComponent: LearnerHomeSavedProjectComponent | null;
};

export const buildMaterialScoringSharedState = (input: {
  material: LearnerHomeMaterialCandidate;
  interests: string[];
  savedComponents: LearnerHomeSavedProjectComponent[];
  savedLocation: LearnerHomeSavedLocationContext;
  behaviorAffinityProfile?: LearnerAffinityProfile;
  behavior?: LearnerBehaviorContext;
  scorerVersion?: RecommendationScorerVersion;
}): MaterialScoringSharedState => {
  // Sealed: this legacy/normalized shared-state builder must never process
  // canonical-taxonomy-v3.
  const scorerVersion = resolveNonCanonicalMaterialScorerVersion(input.scorerVersion);
  const behavior = input.behavior ?? createEmptyBehaviorContext();
  const behaviorAffinityProfile =
    input.behaviorAffinityProfile ?? createEmptyAffinityProfile();
  const relevance = assessSuggestedMaterialRelevance({
    material: input.material,
    interests: input.interests,
    savedComponents: input.savedComponents,
    savedLocation: input.savedLocation,
    behaviorAffinityProfile,
    behavior,
    scorerVersion,
  });

  return {
    relevance,
    behaviorMatch: scoreMaterialBehaviorMatch({
      material: input.material,
      behaviorAffinityProfile,
      behavior,
    }),
    interestMatch: relevance.interestMatch,
    locationMatch: relevance.locationMatch,
    matchedComponent: relevance.matchedComponent,
  };
};

export const scoreSuggestedMaterial = (input: {
  material: LearnerHomeMaterialCandidate;
  interests: string[];
  savedComponents: LearnerHomeSavedProjectComponent[];
  savedLocation: LearnerHomeSavedLocationContext;
  behaviorAffinityProfile?: LearnerAffinityProfile;
  behavior?: LearnerBehaviorContext;
  includeAudit?: boolean;
  shared?: MaterialScoringSharedState;
  scorerVersion?: RecommendationScorerVersion;
  canonicalContext?: CanonicalMaterialScoringContext;
  /** Deterministic evaluation instant for the canonical branch only; ignored by legacy/normalized scoring. */
  now?: Date;
}): ScoredMaterialResult => {
  const scorerVersion = resolveMaterialScorerVersion(input.scorerVersion);
  if (scorerVersion === CANONICAL_SCORING_MODE) {
    const canonicalContext = requireCanonicalContext(input.canonicalContext);
    if (canonicalContext.effectiveScoringMode !== CANONICAL_SCORING_MODE) {
      throw new CanonicalScoringContextRequiredError(
        'canonical-taxonomy-v3 scoring requires effectiveScoringMode canonical-taxonomy-v3',
      );
    }
    return scoreCanonicalMaterialCandidate({
      candidate: input.material,
      context: canonicalContext,
      savedLocation: input.savedLocation,
      behavior: input.behavior ?? createEmptyBehaviorContext(),
      now: input.now,
      section: 'suggested',
    });
  }

  const reasons: string[] = [];
  let relevanceScore = 0;
  let bonusScore = 0;
  const behavior = input.behavior ?? createEmptyBehaviorContext();
  const behaviorAffinityProfile =
    input.behaviorAffinityProfile ?? createEmptyAffinityProfile();

  if (input.material.status !== 'AVAILABLE' || input.material.availableQuantity <= 0) {
    return {
      score: UNAVAILABLE_MATERIAL_PENALTY,
      reasons: [],
      tier: SUGGESTED_MATERIAL_TIERS.fallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
    };
  }

  const relevance =
    input.shared?.relevance ??
    assessSuggestedMaterialRelevance({
      material: input.material,
      interests: input.interests,
      savedComponents: input.savedComponents,
      savedLocation: input.savedLocation,
      behaviorAffinityProfile,
      behavior,
      scorerVersion: input.scorerVersion,
    });

  const behaviorMatch =
    input.shared?.behaviorMatch ??
    scoreMaterialBehaviorMatch({
      material: input.material,
      behaviorAffinityProfile,
      behavior,
    });

  const fallbackOnly =
    relevance.allowsWeakOnlyFallback &&
    !relevance.matchedComponent &&
    !relevance.interestMatch &&
    behaviorMatch.score === 0;

  const hasAnyRelevance =
    relevance.hasPrimaryRelevance || fallbackOnly || behaviorMatch.score > 0;

  if (!hasAnyRelevance && !relevance.allowsWeakOnlyFallback) {
    return {
      score: 0,
      reasons: [],
      tier: SUGGESTED_MATERIAL_TIERS.fallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
      audit: input.includeAudit
        ? {
            score: 0,
            tier: SUGGESTED_MATERIAL_TIERS.fallback,
            reasons: [],
            matchedInterestKey: null,
            matchStrength: null,
            matchedSources: [],
            passedRelevanceGate: false,
            fallbackOnly: false,
            relevanceScore: 0,
            bonusScore: 0,
          }
        : undefined,
    };
  }

  const tier = resolveSuggestedMaterialTier({
    matchedComponent: relevance.matchedComponent,
    interestMatch: relevance.interestMatch,
    behaviorScore: behaviorMatch.score,
    allowsWeakOnlyFallback: relevance.allowsWeakOnlyFallback,
    hasAnyRelevance,
    hasBehaviorActivity: hasLearnerActivity(behavior),
  });

  if (relevance.matchedInterestReason && relevance.interestMatch) {
    relevanceScore += relevance.matchedInterestScore;
    reasons.push(relevance.matchedInterestReason);
  }

  if (behaviorMatch.score > 0) {
    relevanceScore += behaviorMatch.score;
    reasons.push(...behaviorMatch.reasons);
  }

  if (relevance.matchedComponent) {
    relevanceScore += MATERIAL_SCORE_WEIGHTS.savedProjectComponent;
    reasons.push(
      `Useful for your saved ${relevance.matchedComponent.projectTitle} project`,
    );
    reasons.push(
      `Matches required component: ${relevance.matchedComponent.componentName}`,
    );
  }

  if (relevance.locationMatch) {
    bonusScore += MATERIAL_SCORE_WEIGHTS.locationMatch;
    if (tier <= SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom || fallbackOnly) {
      reasons.push('Available near your saved location');
    }
  }

  if (input.material.isFree) {
    bonusScore += MATERIAL_SCORE_WEIGHTS.free;
    if (fallbackOnly || tier >= SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom) {
      reasons.push('Free material');
    }
  }

  if (input.material.deliveryAllowed) {
    bonusScore += MATERIAL_SCORE_WEIGHTS.delivery;
    if (fallbackOnly || tier >= SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom) {
      reasons.push('Delivery available');
    }
  }

  const popularity = scorePopularity(
    input.material.viewsCount,
    input.material.likesCount,
    MATERIAL_SCORE_WEIGHTS.popularityMax,
  );
  if (popularity > 0) {
    bonusScore += popularity;
    if (fallbackOnly && popularity >= 4) {
      reasons.push('Popular material');
    }
  }

  const recencyScore = scoreRecency(
    input.material.createdAt,
    MATERIAL_SCORE_WEIGHTS.recencyMax,
  );
  if (fallbackOnly && recencyScore >= MATERIAL_SCORE_WEIGHTS.recencyMax - 1) {
    reasons.push('Recently added');
  }
  bonusScore += recencyScore;

  const isAlreadyLiked = behavior.likedMaterials.some(
    (signal) => signal.materialId === input.material.id,
  );

  let score = relevanceScore + bonusScore;
  if (isAlreadyLiked) {
    score -= ALREADY_LIKED_MATERIAL_PENALTY;
  }

  const matchStrength =
    relevance.interestMatch?.strength === 'strong'
      ? 'strong'
      : relevance.interestMatch?.strength === 'group'
        ? 'group'
        : relevance.interestMatch?.strength === 'custom'
          ? 'custom'
          : fallbackOnly
            ? 'fallback'
            : null;

  const orderedReasons = orderMaterialReasons(reasons);

  return {
    score,
    reasons: orderedReasons.slice(0, 4),
    tier,
    hasPrimaryRelevance: relevance.hasPrimaryRelevance,
    fallbackOnly,
    audit: input.includeAudit
      ? {
          score,
          tier,
          reasons: orderedReasons,
          matchedInterestKey: relevance.matchedInterestKey,
          matchStrength,
          matchedSources: relevance.interestMatch?.matchedSources ?? [],
          passedRelevanceGate: hasAnyRelevance,
          fallbackOnly,
          relevanceScore,
          bonusScore,
        }
      : undefined,
  };
};

export const scoreMaterialForSavedProjects = (input: {
  material: LearnerHomeMaterialCandidate;
  interests: string[];
  savedComponents: LearnerHomeSavedProjectComponent[];
  savedLocation: LearnerHomeSavedLocationContext;
  behaviorAffinityProfile?: LearnerAffinityProfile;
  behavior?: LearnerBehaviorContext;
  shared?: MaterialScoringSharedState;
  suggestedBase?: ScoredMaterialResult;
  scorerVersion?: RecommendationScorerVersion;
  canonicalContext?: CanonicalMaterialScoringContext;
  /** Deterministic evaluation instant for the canonical branch only; ignored by legacy/normalized scoring. */
  now?: Date;
}): ScoredMaterialResult => {
  const scorerVersion = resolveMaterialScorerVersion(input.scorerVersion);
  if (scorerVersion === CANONICAL_SCORING_MODE) {
    const canonicalContext = requireCanonicalContext(input.canonicalContext);
    if (canonicalContext.effectiveScoringMode !== CANONICAL_SCORING_MODE) {
      throw new CanonicalScoringContextRequiredError(
        'canonical-taxonomy-v3 scoring requires effectiveScoringMode canonical-taxonomy-v3',
      );
    }
    return scoreCanonicalMaterialCandidate({
      candidate: input.material,
      context: canonicalContext,
      savedLocation: input.savedLocation,
      behavior: input.behavior ?? createEmptyBehaviorContext(),
      now: input.now,
      section: 'savedProjects',
    });
  }

  const matchedComponent =
    input.shared?.matchedComponent ??
    findMatchingSavedComponent(input.material, input.savedComponents);

  if (!matchedComponent) {
    return {
      score: UNAVAILABLE_MATERIAL_PENALTY,
      reasons: [],
      tier: SUGGESTED_MATERIAL_TIERS.fallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
    };
  }

  const base = input.suggestedBase ?? scoreSuggestedMaterial(input);
  if (base.score <= UNAVAILABLE_MATERIAL_PENALTY / 2) {
    return base;
  }

  const matchedInterest =
    input.shared?.interestMatch ??
    (input.interests.length > 0
      ? input.scorerVersion
        ? matchLearnerInterestsAgainstMaterialForScorerVersion(
            materialInterestInput(input.material),
            input.interests,
            input.scorerVersion,
          )
        : matchLearnerInterestsAgainstMaterial(
            materialInterestInput(input.material),
            input.interests,
          )
      : null);
  const behavior = input.behavior ?? createEmptyBehaviorContext();
  const behaviorMatch =
    input.shared?.behaviorMatch ??
    scoreMaterialBehaviorMatch({
      material: input.material,
      behaviorAffinityProfile:
        input.behaviorAffinityProfile ?? createEmptyAffinityProfile(),
      behavior,
    });

  const tier = resolveSavedProjectMaterialTier({
    matchedComponent,
    interestMatch: matchedInterest,
    behaviorScore: behaviorMatch.score,
    hasBehaviorActivity: hasLearnerActivity(behavior),
  });

  const reasons = orderMaterialReasons([
    `Useful for your saved ${matchedComponent.projectTitle} project`,
    `Matches required component: ${matchedComponent.componentName}`,
    ...base.reasons,
    ...(matchedInterest && matchedInterest.strength === 'strong'
      ? [buildInterestMatchReason(matchedInterest)]
      : []),
  ]);

  return {
    score: base.score + MATERIAL_SCORE_WEIGHTS.savedProjectComponent,
    reasons,
    tier,
    hasPrimaryRelevance: true,
    fallbackOnly: false,
  };
};

export const scoreFreeNearbyMaterial = (input: {
  material: LearnerHomeMaterialCandidate;
  savedLocation: LearnerHomeSavedLocationContext;
  interests?: string[];
  behaviorAffinityProfile?: LearnerAffinityProfile;
  behavior?: LearnerBehaviorContext;
  shared?: MaterialScoringSharedState;
  scorerVersion?: RecommendationScorerVersion;
  canonicalContext?: CanonicalMaterialScoringContext;
  /** Deterministic evaluation instant for the canonical branch only; ignored by legacy/normalized scoring. */
  now?: Date;
}): ScoredMaterialResult => {
  const scorerVersion = resolveMaterialScorerVersion(input.scorerVersion);
  if (scorerVersion === CANONICAL_SCORING_MODE) {
    const canonicalContext = requireCanonicalContext(input.canonicalContext);
    if (canonicalContext.effectiveScoringMode !== CANONICAL_SCORING_MODE) {
      throw new CanonicalScoringContextRequiredError(
        'canonical-taxonomy-v3 scoring requires effectiveScoringMode canonical-taxonomy-v3',
      );
    }
    return scoreCanonicalMaterialCandidate({
      candidate: input.material,
      context: canonicalContext,
      savedLocation: input.savedLocation,
      behavior: input.behavior ?? createEmptyBehaviorContext(),
      now: input.now,
      section: 'free',
    });
  }

  if (
    input.material.status !== 'AVAILABLE' ||
    input.material.availableQuantity <= 0 ||
    !input.material.isFree
  ) {
    return {
      score: UNAVAILABLE_MATERIAL_PENALTY,
      reasons: [],
      tier: FREE_MATERIAL_TIERS.freeFallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
    };
  }

  const behavior = input.behavior ?? createEmptyBehaviorContext();
  const behaviorAffinityProfile =
    input.behaviorAffinityProfile ?? createEmptyAffinityProfile();
  const interests = input.interests ?? [];
  const interestMatch =
    input.shared?.interestMatch ??
    (interests.length > 0
      ? input.scorerVersion
        ? matchLearnerInterestsAgainstMaterialForScorerVersion(
            materialInterestInput(input.material),
            interests,
            input.scorerVersion,
          )
        : matchLearnerInterestsAgainstMaterial(
            materialInterestInput(input.material),
            interests,
          )
      : null);
  const behaviorMatch =
    input.shared?.behaviorMatch ??
    scoreMaterialBehaviorMatch({
      material: input.material,
      behaviorAffinityProfile,
      behavior,
    });
  const nearLocation =
    input.shared?.locationMatch ??
    locationMatches(input.material, input.savedLocation);
  const hasPersonalSignal =
    Boolean(interestMatch) ||
    (hasLearnerActivity(behavior) && behaviorMatch.score > 0);

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
    } else if (behaviorMatch.reasons.length > 0) {
      reasons.push(behaviorMatch.reasons[0]!);
    }
  }

  score += scorePopularity(
    input.material.viewsCount,
    input.material.likesCount,
    MATERIAL_SCORE_WEIGHTS.popularityMax,
  );
  score += scoreRecency(input.material.createdAt, MATERIAL_SCORE_WEIGHTS.recencyMax);

  return {
    score,
    reasons: orderMaterialReasons(reasons),
    tier,
    hasPrimaryRelevance: hasPersonalSignal,
    fallbackOnly: !hasPersonalSignal && !nearLocation,
  };
};

export type ScoredProjectResult = {
  score: number;
  reasons: string[];
  tier: (typeof SUGGESTED_PROJECT_TIERS)[keyof typeof SUGGESTED_PROJECT_TIERS];
};

const resolveSuggestedProjectTier = (input: {
  interestMatch: LearnerInterestMatch | null;
  behaviorScore: number;
  hasBehaviorActivity: boolean;
  hasMatchingMaterials: boolean;
}) => {
  if (input.interestMatch) {
    return SUGGESTED_PROJECT_TIERS.interestMatch;
  }

  if (input.hasBehaviorActivity && input.behaviorScore >= 12) {
    return SUGGESTED_PROJECT_TIERS.behaviorStrong;
  }

  if (input.hasMatchingMaterials) {
    return SUGGESTED_PROJECT_TIERS.matchingMaterials;
  }

  return SUGGESTED_PROJECT_TIERS.popularFallback;
};

export const scoreSuggestedProject = (input: {
  project: LearnerHomeProjectCandidate;
  interests: string[];
  availableMaterials: LearnerHomeMaterialCandidate[];
  behaviorAffinityProfile?: LearnerAffinityProfile;
  behavior?: LearnerBehaviorContext;
  scorerVersion?: RecommendationScorerVersion;
}): ScoredProjectResult => {
  const reasons: string[] = [];
  let score = 0;
  const behavior = input.behavior ?? createEmptyBehaviorContext();
  const behaviorAffinityProfile =
    input.behaviorAffinityProfile ?? createEmptyAffinityProfile();
  const scorerVersion = resolveProjectScorerVersion(input.scorerVersion);

  const haystack = haystackForProject(input.project);
  let interestMatch: LearnerInterestMatch | null = null;
  if (input.interests.length > 0) {
    interestMatch = matchLearnerInterestsAgainstHaystackForScorerVersion(
      haystack,
      input.interests,
      scorerVersion,
    );
    if (interestMatch) {
      score += interestMatch.scoreWeight;
      reasons.push(buildInterestMatchReason(interestMatch));
    }
  }

  const behaviorMatch = scoreProjectBehaviorMatch({
    project: input.project,
    behaviorAffinityProfile,
    behavior,
  });
  if (behaviorMatch.score > 0) {
    score += behaviorMatch.score;
    reasons.push(...behaviorMatch.reasons);
  }

  const hasMatchingMaterials = input.project.requiredComponents.some((component) =>
    input.availableMaterials.some((material) =>
      materialMatchesProjectComponent(material, component),
    ),
  );
  if (hasMatchingMaterials) {
    score += PROJECT_SCORE_WEIGHTS.matchingMaterials;
    reasons.push('Required components have available matching materials');
  }

  const popularity = Math.min(
    PROJECT_SCORE_WEIGHTS.popularityMax,
    input.project.likesCount +
      input.project.savesCount * 2 +
      Math.min(input.project.reviewCount, 5),
  );
  if (popularity > 0) {
    score += popularity;
    if (popularity >= 8) {
      reasons.push('Popular with learners');
    }
  }

  score += scoreRecency(input.project.createdAt, PROJECT_SCORE_WEIGHTS.recencyMax);

  const tier = resolveSuggestedProjectTier({
    interestMatch,
    behaviorScore: behaviorMatch.score,
    hasBehaviorActivity: hasLearnerActivity(behavior),
    hasMatchingMaterials,
  });

  return {
    score,
    reasons: [...new Set(reasons)].slice(0, 3),
    tier,
  };
};

export const scorePopularProject = (
  project: LearnerHomeProjectCandidate,
): ScoredProjectResult => {
  const popularity = Math.min(
    PROJECT_SCORE_WEIGHTS.popularityMax,
    project.likesCount +
      project.savesCount * 2 +
      Math.min(project.reviewCount, 5),
  );

  const reasons =
    popularity >= 8 ? ['Popular with learners'] : ['Featured learning project'];

  return {
    score:
      popularity +
      scoreRecency(project.createdAt, PROJECT_SCORE_WEIGHTS.recencyMax),
    reasons,
    tier: SUGGESTED_PROJECT_TIERS.popularFallback,
  };
};

export const applyDiversityCap = <T>(
  items: T[],
  limit: number,
  getOwnerKey: (item: T) => string,
  maxPerOwner = 1,
) => {
  const selected: T[] = [];
  const ownerCounts = new Map<string, number>();

  for (const item of items) {
    if (selected.length >= limit) {
      break;
    }

    const ownerKey = getOwnerKey(item);
    const currentCount = ownerCounts.get(ownerKey) ?? 0;
    if (currentCount >= maxPerOwner) {
      continue;
    }

    ownerCounts.set(ownerKey, currentCount + 1);
    selected.push(item);
  }

  return selected;
};

export const resolveSuggestedMaterialsSubtitle = (input: {
  hasInterests: boolean;
  hasBehavior: boolean;
  items: Array<{ reasons: string[] }>;
}) => {
  if (!input.hasInterests && !input.hasBehavior) {
    return 'Starter suggestions from available materials. Add interests to personalize this feed.';
  }

  if (input.items.length === 0) {
    return input.hasInterests
      ? 'Choose interests to improve your suggestions.'
      : 'Keep exploring materials and projects to improve your suggestions.';
  }

  if (input.hasInterests && !input.hasBehavior) {
    return 'Personalized from your interests and saved projects.';
  }

  if (input.hasInterests && input.hasBehavior) {
    return 'Personalized from your interests, saved projects, and activity.';
  }

  return 'Personalized from your recent activity.';
};

export const hasStrongProjectReason = (reason: string) => {
  const normalized = reason.toLowerCase();
  return (
    normalized.startsWith('matches your') ||
    normalized.includes('related to your saved projects') ||
    normalized.includes('matches your recent activity') ||
    normalized.includes('based on projects you liked') ||
    normalized.includes('because you are building') ||
    normalized.includes('related to materials in your activity')
  );
};

export const resolveSuggestedProjectsSubtitle = (input: {
  hasInterests: boolean;
  hasBehavior: boolean;
  items: Array<{ reasons: string[] }>;
}) => {
  if (!input.hasInterests && !input.hasBehavior) {
    return 'Starter suggestions from available projects. Add interests to personalize this feed.';
  }

  if (input.items.length === 0) {
    return input.hasInterests
      ? 'Choose interests to see project recommendations.'
      : 'Keep exploring materials and projects to improve your suggestions.';
  }

  const hasPrimaryItems = input.items.some((item) =>
    item.reasons.some((reason) => hasStrongProjectReason(reason)),
  );

  if (!hasPrimaryItems) {
    return 'We could not find many direct matches yet. Showing useful learning projects.';
  }

  if (!input.hasInterests && input.hasBehavior) {
    return 'Personalized from your recent activity.';
  }

  return 'Personalized from your interests, saved projects, and activity.';
};
