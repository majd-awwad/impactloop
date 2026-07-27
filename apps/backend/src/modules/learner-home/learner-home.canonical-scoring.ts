import type { RecommendationScorerVersion } from '../../config/recommendation-scoring-version.js';
import { isValidTaxonomyCanonicalKey } from '../taxonomy/taxonomy-normalization.js';
import { BEHAVIOR_SCORE_WEIGHTS } from './learner-home.affinity.js';
import {
  FREE_MATERIAL_TIERS,
  SUGGESTED_MATERIAL_TIERS,
  type MaterialScoringTier,
} from './learner-home.ranking.js';
import { normalizeText } from './learner-interest-taxonomy.js';
import type {
  LearnerBehaviorContext,
  LearnerHomeMaterialCandidate,
  LearnerHomeSavedLocationContext,
} from './learner-home.types.js';

/** Mirrors learner-home.scoring MATERIAL_SCORE_WEIGHTS / penalties (avoid circular import). */
const MATERIAL_SCORE_WEIGHTS = {
  locationMatch: 25,
  free: 8,
  delivery: 6,
  popularityMax: 10,
  recencyMax: 5,
} as const;
const UNAVAILABLE_MATERIAL_PENALTY = -1000;
const ALREADY_LIKED_MATERIAL_PENALTY = 18;

const locationMatches = (
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

const orderMaterialReasons = (reasons: string[]) => [...new Set(reasons)];

export type ScoredMaterialResultCompat = {
  score: number;
  reasons: string[];
  tier: MaterialScoringTier;
  hasPrimaryRelevance: boolean;
  fallbackOnly: boolean;
};

export const CANONICAL_SCORING_MODE = 'canonical-taxonomy-v3' as const;

export type CanonicalFallbackCode =
  | 'CANONICAL_LOADER_FALLBACK_LEGACY_V1'
  | 'CANONICAL_CONTEXT_INVARIANT_FALLBACK'
  | 'CANONICAL_SCORER_INVARIANT_FALLBACK';

export type CanonicalInternalReasonCode =
  | 'CANONICAL_INTEREST_RELATION_UNAVAILABLE'
  | 'CANONICAL_COMPONENT_RELATION_UNAVAILABLE'
  | 'MISSING_CANONICAL_ASSIGNMENT'
  | 'INVALID_FAMILY_CARDINALITY'
  | 'CANONICAL_FAMILY_OVERLAP'
  | 'CANONICAL_FORM_OVERLAP'
  | 'CANONICAL_RESERVED_IDENTITY'
  | 'CANONICAL_VIEWED_IDENTITY'
  | 'INVALID_CONCEPT_PROJECTION'
  | CanonicalFallbackCode;

export type CanonicalMaterialCoverage =
  | 'READY_FAMILY_AND_FORM'
  | 'READY_FAMILY_ONLY'
  | 'MISSING_CANONICAL_ASSIGNMENT'
  | 'INVALID_FAMILY_CARDINALITY'
  | 'INVALID_OR_DEFECTIVE';

export type MaterialConceptRowInput = {
  canonicalKey: string;
  conceptType: string;
  status: string;
};

export type CanonicalMaterialSemanticProfile = {
  materialId: string;
  familyKeys: string[];
  formKeys: string[];
  coverage: CanonicalMaterialCoverage;
  similarityEligible: boolean;
  diagnostics: CanonicalInternalReasonCode[];
};

export type CanonicalMaterialScoringContext = {
  requestedScoringMode: typeof CANONICAL_SCORING_MODE;
  effectiveScoringMode: typeof CANONICAL_SCORING_MODE | 'legacy-v1';
  fallbackCode: CanonicalFallbackCode | null;
  cacheable: boolean;
  candidateMaterialProfiles: ReadonlyMap<string, CanonicalMaterialSemanticProfile>;
  likedMaterialProfiles: ReadonlyMap<string, CanonicalMaterialSemanticProfile>;
  reservedMaterialProfiles: ReadonlyMap<string, CanonicalMaterialSemanticProfile>;
  viewedMaterialProfiles: ReadonlyMap<string, CanonicalMaterialSemanticProfile>;
};

export class CanonicalScoringContextRequiredError extends Error {
  readonly code = 'CANONICAL_CONTEXT_REQUIRED' as const;

  constructor(message = 'canonical-taxonomy-v3 requires an explicit CanonicalMaterialScoringContext') {
    super(message);
    this.name = 'CanonicalScoringContextRequiredError';
  }
}

/**
 * A candidate ID entering the scorer that is absent from the context's
 * profile map is a loader/context invariant violation, never a legitimate
 * missing material assignment. Availability status must not be checked
 * before this invariant, or an unavailable-but-context-incomplete candidate
 * could silently report a factual coverage that was never computed.
 */
export class CanonicalContextInvariantError extends Error {
  readonly code = 'CANONICAL_CONTEXT_INVARIANT' as const;

  constructor(message = 'canonical-taxonomy-v3 candidate missing from CanonicalMaterialScoringContext profile map') {
    super(message);
    this.name = 'CanonicalContextInvariantError';
  }
}

const asciiSort = (values: Iterable<string>): string[] =>
  [...values].sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));

const isActive = (status: string) => status === 'ACTIVE';

const isWellFormedFamilyKey = (key: string) =>
  isValidTaxonomyCanonicalKey(key) && key.startsWith('material-family:');

const isWellFormedFormKey = (key: string) =>
  isValidTaxonomyCanonicalKey(key) && key.startsWith('material-form:');

/**
 * Projects persisted concept rows into a deterministic material semantic profile.
 * Concept/database IDs must not be passed in and never affect eligibility.
 */
export const projectCanonicalMaterialProfile = (
  materialId: string,
  rows: readonly MaterialConceptRowInput[],
): CanonicalMaterialSemanticProfile => {
  const diagnostics: CanonicalInternalReasonCode[] = [];
  const familySet = new Set<string>();
  const formSet = new Set<string>();

  for (const row of rows) {
    if (!isActive(row.status)) {
      diagnostics.push('INVALID_CONCEPT_PROJECTION');
      continue;
    }

    if (row.conceptType === 'MATERIAL_FAMILY') {
      if (!isWellFormedFamilyKey(row.canonicalKey)) {
        diagnostics.push('INVALID_CONCEPT_PROJECTION');
        continue;
      }
      familySet.add(row.canonicalKey);
      continue;
    }

    if (row.conceptType === 'MATERIAL_FORM') {
      if (!isWellFormedFormKey(row.canonicalKey)) {
        diagnostics.push('INVALID_CONCEPT_PROJECTION');
        continue;
      }
      formSet.add(row.canonicalKey);
      continue;
    }

    diagnostics.push('INVALID_CONCEPT_PROJECTION');
  }

  const familyKeys = asciiSort(familySet);
  const formKeys = asciiSort(formSet);
  const uniqueDiagnostics = asciiSort(new Set(diagnostics)) as CanonicalInternalReasonCode[];

  if (familyKeys.length === 0) {
    return {
      materialId,
      familyKeys,
      formKeys: [],
      coverage: 'MISSING_CANONICAL_ASSIGNMENT',
      similarityEligible: false,
      diagnostics: uniqueDiagnostics.includes('MISSING_CANONICAL_ASSIGNMENT')
        ? uniqueDiagnostics
        : (['MISSING_CANONICAL_ASSIGNMENT', ...uniqueDiagnostics] as CanonicalInternalReasonCode[]),
    };
  }

  if (familyKeys.length > 1) {
    return {
      materialId,
      familyKeys,
      formKeys,
      coverage: 'INVALID_FAMILY_CARDINALITY',
      similarityEligible: false,
      diagnostics: [
        'INVALID_FAMILY_CARDINALITY',
        ...uniqueDiagnostics.filter((code) => code !== 'INVALID_FAMILY_CARDINALITY'),
      ] as CanonicalInternalReasonCode[],
    };
  }

  return {
    materialId,
    familyKeys,
    formKeys,
    coverage: formKeys.length > 0 ? 'READY_FAMILY_AND_FORM' : 'READY_FAMILY_ONLY',
    similarityEligible: true,
    diagnostics: uniqueDiagnostics,
  };
};

export const buildCanonicalProfileMap = (
  materialIds: readonly string[],
  rowsByMaterialId: ReadonlyMap<string, readonly MaterialConceptRowInput[]>,
): Map<string, CanonicalMaterialSemanticProfile> => {
  const uniqueIds = asciiSort(new Set(materialIds));
  const map = new Map<string, CanonicalMaterialSemanticProfile>();
  for (const materialId of uniqueIds) {
    map.set(
      materialId,
      projectCanonicalMaterialProfile(materialId, rowsByMaterialId.get(materialId) ?? []),
    );
  }
  return map;
};

const setsIntersect = (left: readonly string[], right: readonly string[]) => {
  if (left.length === 0 || right.length === 0) {
    return false;
  }
  const rightSet = new Set(right);
  return left.some((key) => rightSet.has(key));
};

type OverlapKind = 'form' | 'family' | null;

const resolveCanonicalOverlap = (
  candidate: CanonicalMaterialSemanticProfile,
  other: CanonicalMaterialSemanticProfile,
): OverlapKind => {
  if (!candidate.similarityEligible || !other.similarityEligible) {
    return null;
  }
  if (setsIntersect(candidate.formKeys, other.formKeys)) {
    return 'form';
  }
  if (setsIntersect(candidate.familyKeys, other.familyKeys)) {
    return 'family';
  }
  return null;
};

/**
 * Canonical material scoring only supports liked/reserved/viewed material
 * signals. The broad learner-home.affinity.hasLearnerActivity also counts
 * saved/liked/followed projects and in-progress builds, whose
 * project→material semantics are disabled under canonical-taxonomy-v3.
 * Using that broad predicate here would let project-only activity suppress
 * the weak-only fallback gate (location/free/popularity/recency) even
 * though it can never produce a canonical match.
 */
const hasCanonicalSupportedMaterialActivity = (behavior: LearnerBehaviorContext): boolean =>
  behavior.likedMaterials.length > 0 ||
  behavior.reservedMaterials.length > 0 ||
  behavior.viewedMaterials.length > 0;

const scorePopularity = (viewsCount: number, likesCount: number, max: number) =>
  Math.min(max, Math.floor(viewsCount / 5) + likesCount * 2);

const scoreRecency = (createdAt: Date, max: number, nowMs: number) => {
  const ageMs = nowMs - createdAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) {
    return max;
  }
  if (ageDays <= 30) {
    return Math.max(1, max - 2);
  }
  return 1;
};

export type CanonicalMaterialScoreBreakdown = {
  likedSimilarity: number;
  reservedSimilarity: number;
  viewedSimilarity: number;
  location: number;
  free: number;
  delivery: number;
  popularity: number;
  recency: number;
  /** Positive magnitude, subtracted — same sign convention as alreadyLikedPenalty. */
  alreadyLikedPenalty: number;
  /** Positive magnitude, subtracted. Non-zero only for the unavailable/non-free-in-free penalty (-1000). */
  unavailablePenalty: number;
  interest: 0;
  savedComponent: 0;
  affinity: 0;
  savedRelatedProject: 0;
  continuedBuild: 0;
};

export type CanonicalScoredMaterialResult = ScoredMaterialResultCompat & {
  internalReasonCodes: CanonicalInternalReasonCode[];
  semanticCoverage: CanonicalMaterialCoverage;
  components: CanonicalMaterialScoreBreakdown;
};

const emptyBreakdown = (): CanonicalMaterialScoreBreakdown => ({
  likedSimilarity: 0,
  reservedSimilarity: 0,
  viewedSimilarity: 0,
  location: 0,
  free: 0,
  delivery: 0,
  popularity: 0,
  recency: 0,
  alreadyLikedPenalty: 0,
  unavailablePenalty: 0,
  interest: 0,
  savedComponent: 0,
  affinity: 0,
  savedRelatedProject: 0,
  continuedBuild: 0,
});

const resolveCanonicalSuggestedTier = (input: {
  hasBehaviorActivity: boolean;
  behaviorScore: number;
  allowsWeakOnlyFallback: boolean;
  hasAnyRelevance: boolean;
}): MaterialScoringTier => {
  if (input.hasBehaviorActivity && input.behaviorScore >= 12) {
    return SUGGESTED_MATERIAL_TIERS.behaviorStrong;
  }
  if (input.allowsWeakOnlyFallback && input.hasAnyRelevance) {
    return SUGGESTED_MATERIAL_TIERS.fallback;
  }
  return SUGGESTED_MATERIAL_TIERS.fallback;
};

export const assertCanonicalContextPresent = (
  context: CanonicalMaterialScoringContext | undefined | null,
): CanonicalMaterialScoringContext => {
  if (!context) {
    throw new CanonicalScoringContextRequiredError();
  }
  return context;
};

export const createSuccessfulCanonicalContext = (input: {
  candidateMaterialProfiles: ReadonlyMap<string, CanonicalMaterialSemanticProfile>;
  likedMaterialProfiles: ReadonlyMap<string, CanonicalMaterialSemanticProfile>;
  reservedMaterialProfiles: ReadonlyMap<string, CanonicalMaterialSemanticProfile>;
  viewedMaterialProfiles: ReadonlyMap<string, CanonicalMaterialSemanticProfile>;
}): CanonicalMaterialScoringContext => ({
  requestedScoringMode: CANONICAL_SCORING_MODE,
  effectiveScoringMode: CANONICAL_SCORING_MODE,
  fallbackCode: null,
  cacheable: true,
  candidateMaterialProfiles: input.candidateMaterialProfiles,
  likedMaterialProfiles: input.likedMaterialProfiles,
  reservedMaterialProfiles: input.reservedMaterialProfiles,
  viewedMaterialProfiles: input.viewedMaterialProfiles,
});

export const createFallbackCanonicalContext = (
  fallbackCode: CanonicalFallbackCode,
): CanonicalMaterialScoringContext => ({
  requestedScoringMode: CANONICAL_SCORING_MODE,
  effectiveScoringMode: 'legacy-v1',
  fallbackCode,
  cacheable: false,
  candidateMaterialProfiles: new Map(),
  likedMaterialProfiles: new Map(),
  reservedMaterialProfiles: new Map(),
  viewedMaterialProfiles: new Map(),
});

export const algorithmVersionForEffectiveMode = (
  effectiveScoringMode: RecommendationScorerVersion,
): string => `learner-home-v1:${effectiveScoringMode}`;

/**
 * A single material effectiveScoringMode cannot describe project scoring
 * (projects always force-delegate to legacy-v1 under a canonical request).
 * This bounded, internal-only diagnostic tracks both domains plus fallback
 * state so algorithm identity stamping stays truthful and fallbackCode is
 * never silently dropped after context construction.
 */
export type LearnerHomeModeDecision = {
  requestedMaterialScoringMode: RecommendationScorerVersion;
  effectiveMaterialScoringMode: RecommendationScorerVersion;
  effectiveProjectScoringMode: RecommendationScorerVersion;
  fallbackCode: CanonicalFallbackCode | null;
  cacheable: boolean;
};

export const buildLearnerHomeModeDecision = (input: {
  requestedMaterialScoringMode: RecommendationScorerVersion;
  effectiveMaterialScoringMode: RecommendationScorerVersion;
  fallbackCode: CanonicalFallbackCode | null;
  cacheable: boolean;
}): LearnerHomeModeDecision => ({
  requestedMaterialScoringMode: input.requestedMaterialScoringMode,
  effectiveMaterialScoringMode: input.effectiveMaterialScoringMode,
  // Projects never use canonical-taxonomy-v3, independent of whether material
  // scoring succeeded canonically or fell back to legacy-v1.
  effectiveProjectScoringMode:
    input.requestedMaterialScoringMode === CANONICAL_SCORING_MODE
      ? 'legacy-v1'
      : input.requestedMaterialScoringMode,
  fallbackCode: input.fallbackCode,
  cacheable: input.cacheable,
});

/**
 * Truthful full-home algorithm stamp. Returns the simple single-mode form
 * when both domains agree (the common case: legacy/normalized requests, or a
 * canonical request that fell back on both domains), and an explicit mixed
 * form when material is canonical and project is legacy. Never stamps a
 * project ranking as canonical-taxonomy-v3.
 */
export const algorithmVersionForModeDecision = (
  decision: Pick<
    LearnerHomeModeDecision,
    'effectiveMaterialScoringMode' | 'effectiveProjectScoringMode'
  >,
): string =>
  decision.effectiveMaterialScoringMode === decision.effectiveProjectScoringMode
    ? algorithmVersionForEffectiveMode(decision.effectiveMaterialScoringMode)
    : `learner-home-v1:material=${decision.effectiveMaterialScoringMode};project=${decision.effectiveProjectScoringMode}`;

export const scoreCanonicalMaterialCandidate = (input: {
  candidate: LearnerHomeMaterialCandidate;
  context: CanonicalMaterialScoringContext;
  savedLocation: LearnerHomeSavedLocationContext;
  behavior: LearnerBehaviorContext;
  now?: Date;
  section?: 'suggested' | 'savedProjects' | 'free';
}): CanonicalScoredMaterialResult => {
  const context = assertCanonicalContextPresent(input.context);
  if (context.effectiveScoringMode !== CANONICAL_SCORING_MODE) {
    throw new CanonicalScoringContextRequiredError(
      'scoreCanonicalMaterialCandidate requires effectiveScoringMode canonical-taxonomy-v3',
    );
  }

  const nowMs = (input.now ?? new Date()).getTime();
  const material = input.candidate;
  const internalReasonCodes: CanonicalInternalReasonCode[] = [
    'CANONICAL_INTEREST_RELATION_UNAVAILABLE',
    'CANONICAL_COMPONENT_RELATION_UNAVAILABLE',
  ];
  const components = emptyBreakdown();

  // Context completeness is checked before availability. A candidate that is
  // absent from the profile map is always a loader/context invariant, even
  // when the material itself happens to be unavailable — it must never be
  // reported as a legitimate missing assignment or a silently-zeroed profile.
  const candidateProfile = context.candidateMaterialProfiles.get(material.id);
  if (!candidateProfile) {
    throw new CanonicalContextInvariantError(
      'canonical-taxonomy-v3 candidate missing from CanonicalMaterialScoringContext.candidateMaterialProfiles',
    );
  }

  // Complete-behavior-map invariant: every liked/reserved/viewed signal ID
  // must exist in its respective profile map, independent of this
  // candidate's own eligibility or availability. A missing map entry is a
  // context invariant violation, not a legitimate zero-overlap result (which
  // requires a present-but-ineligible profile, e.g.
  // MISSING_CANONICAL_ASSIGNMENT). Checked unconditionally so an all-
  // unavailable pool cannot silently hide an incomplete behavior map.
  for (const liked of input.behavior.likedMaterials) {
    if (!context.likedMaterialProfiles.has(liked.materialId)) {
      throw new CanonicalContextInvariantError(
        'canonical-taxonomy-v3 liked-material behavior signal missing from CanonicalMaterialScoringContext.likedMaterialProfiles',
      );
    }
  }
  for (const reserved of input.behavior.reservedMaterials) {
    if (!context.reservedMaterialProfiles.has(reserved.materialId)) {
      throw new CanonicalContextInvariantError(
        'canonical-taxonomy-v3 reserved-material behavior signal missing from CanonicalMaterialScoringContext.reservedMaterialProfiles',
      );
    }
  }
  for (const viewed of input.behavior.viewedMaterials) {
    if (!context.viewedMaterialProfiles.has(viewed.materialId)) {
      throw new CanonicalContextInvariantError(
        'canonical-taxonomy-v3 viewed-material behavior signal missing from CanonicalMaterialScoringContext.viewedMaterialProfiles',
      );
    }
  }

  if (material.status !== 'AVAILABLE' || material.availableQuantity <= 0) {
    // Contribution-exact: the returned breakdown must be able to derive the
    // penalty score, not just report zeros alongside a nonzero score.
    components.unavailablePenalty = Math.abs(UNAVAILABLE_MATERIAL_PENALTY);
    return {
      score: UNAVAILABLE_MATERIAL_PENALTY,
      reasons: [],
      tier: SUGGESTED_MATERIAL_TIERS.fallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
      internalReasonCodes,
      semanticCoverage: candidateProfile.coverage,
      components,
    };
  }

  internalReasonCodes.push(...candidateProfile.diagnostics);
  if (candidateProfile.coverage === 'MISSING_CANONICAL_ASSIGNMENT') {
    internalReasonCodes.push('MISSING_CANONICAL_ASSIGNMENT');
  }
  if (candidateProfile.coverage === 'INVALID_FAMILY_CARDINALITY') {
    internalReasonCodes.push('INVALID_FAMILY_CARDINALITY');
  }

  const hasActivity = hasCanonicalSupportedMaterialActivity(input.behavior);
  const likedIds = new Set(input.behavior.likedMaterials.map((row) => row.materialId));
  const isAlreadyLiked = likedIds.has(material.id);

  // Liked similarity: exclude self before overlap.
  let likedScore = 0;
  let likedReason: string | null = null;
  let likedOverlap: OverlapKind = null;
  if (candidateProfile.similarityEligible) {
    for (const liked of input.behavior.likedMaterials) {
      if (liked.materialId === material.id) {
        continue;
      }
      // Guaranteed present by the completeness check above.
      const likedProfile = context.likedMaterialProfiles.get(liked.materialId)!;
      const overlap = resolveCanonicalOverlap(candidateProfile, likedProfile);
      if (overlap === 'form') {
        likedScore = BEHAVIOR_SCORE_WEIGHTS.likedSimilar;
        likedOverlap = 'form';
        likedReason = 'Similar to materials you liked';
        break;
      }
      if (overlap === 'family' && likedOverlap === null) {
        likedScore = Math.floor(BEHAVIOR_SCORE_WEIGHTS.likedSimilar / 2);
        likedOverlap = 'family';
        likedReason = 'Similar to materials you liked';
      }
    }
  }
  if (likedOverlap === 'form') {
    internalReasonCodes.push('CANONICAL_FORM_OVERLAP');
  } else if (likedOverlap === 'family') {
    internalReasonCodes.push('CANONICAL_FAMILY_OVERLAP');
  }
  components.likedSimilarity = likedScore;

  // Reserved: identity first, else form/family overlap.
  let reservedScore = 0;
  let reservedReason: string | null = null;
  const reservedIdentity = input.behavior.reservedMaterials.some(
    (signal) => signal.materialId === material.id,
  );
  if (reservedIdentity) {
    reservedScore = BEHAVIOR_SCORE_WEIGHTS.reservedSimilar;
    reservedReason = 'Similar to materials you reserved';
    internalReasonCodes.push('CANONICAL_RESERVED_IDENTITY');
  } else if (candidateProfile.similarityEligible) {
    let reservedOverlap: OverlapKind = null;
    for (const reserved of input.behavior.reservedMaterials) {
      // Guaranteed present by the completeness check above.
      const reservedProfile = context.reservedMaterialProfiles.get(reserved.materialId)!;
      const overlap = resolveCanonicalOverlap(candidateProfile, reservedProfile);
      if (overlap === 'form') {
        reservedScore = BEHAVIOR_SCORE_WEIGHTS.reservedSimilar;
        reservedOverlap = 'form';
        reservedReason = 'Similar to materials you reserved';
        break;
      }
      if (overlap === 'family' && reservedOverlap === null) {
        reservedScore = Math.floor(BEHAVIOR_SCORE_WEIGHTS.reservedSimilar / 2);
        reservedOverlap = 'family';
        reservedReason = 'Similar to materials you reserved';
      }
    }
    if (reservedOverlap === 'form') {
      internalReasonCodes.push('CANONICAL_FORM_OVERLAP');
    } else if (reservedOverlap === 'family') {
      internalReasonCodes.push('CANONICAL_FAMILY_OVERLAP');
    }
  }
  components.reservedSimilarity = reservedScore;

  // Viewed: only if no reserved match and liked similarity score === 0.
  let viewedScore = 0;
  let viewedReason: string | null = null;
  if (reservedScore === 0 && likedScore === 0) {
    const viewedIdentity = input.behavior.viewedMaterials.some(
      (signal) => signal.materialId === material.id,
    );
    if (viewedIdentity) {
      viewedScore = BEHAVIOR_SCORE_WEIGHTS.viewedSimilar;
      viewedReason = 'Matches your recent activity';
      internalReasonCodes.push('CANONICAL_VIEWED_IDENTITY');
    } else if (candidateProfile.similarityEligible) {
      let viewedOverlap: OverlapKind = null;
      for (const viewed of input.behavior.viewedMaterials) {
        // Guaranteed present by the completeness check above.
        const viewedProfile = context.viewedMaterialProfiles.get(viewed.materialId)!;
        const overlap = resolveCanonicalOverlap(candidateProfile, viewedProfile);
        if (overlap === 'form') {
          viewedScore = BEHAVIOR_SCORE_WEIGHTS.viewedSimilar;
          viewedOverlap = 'form';
          viewedReason = 'Matches your recent activity';
          break;
        }
        if (overlap === 'family' && viewedOverlap === null) {
          viewedScore = Math.floor(BEHAVIOR_SCORE_WEIGHTS.viewedSimilar / 2);
          viewedOverlap = 'family';
          viewedReason = 'Matches your recent activity';
        }
      }
      if (viewedOverlap === 'form') {
        internalReasonCodes.push('CANONICAL_FORM_OVERLAP');
      } else if (viewedOverlap === 'family') {
        internalReasonCodes.push('CANONICAL_FAMILY_OVERLAP');
      }
    }
  }
  components.viewedSimilarity = viewedScore;

  const behaviorScore = likedScore + reservedScore + viewedScore;
  // Interests and saved-components contribute 0 under canonical, so weak-only
  // fallback depends only on absence of learner activity (same activity gate).
  const allowsWeakOnlyFallback = !hasActivity;

  // Primary relevance never from interest/component/affinity (all disabled).
  const hasPrimaryRelevance = false;
  const fallbackOnly = allowsWeakOnlyFallback && behaviorScore === 0;
  const hasAnyRelevance = hasPrimaryRelevance || fallbackOnly || behaviorScore > 0;

  if (!hasAnyRelevance && !allowsWeakOnlyFallback) {
    // The already-liked penalty applies even when no other signal establishes
    // relevance (e.g. the candidate is itself the learner's only liked
    // material). Score must reflect the penalty rather than reporting 0 while
    // the component field disagrees.
    if (isAlreadyLiked) {
      components.alreadyLikedPenalty = ALREADY_LIKED_MATERIAL_PENALTY;
    }
    return {
      score: isAlreadyLiked ? -ALREADY_LIKED_MATERIAL_PENALTY : 0,
      reasons: [],
      tier: SUGGESTED_MATERIAL_TIERS.fallback,
      hasPrimaryRelevance: false,
      fallbackOnly: false,
      internalReasonCodes: asciiSort(new Set(internalReasonCodes)) as CanonicalInternalReasonCode[],
      semanticCoverage: candidateProfile.coverage,
      components,
    };
  }

  const locationMatch = locationMatches(material, input.savedLocation);
  let bonusScore = 0;
  const reasons: string[] = [];

  if (behaviorScore > 0) {
    if (reservedReason) {
      reasons.push(reservedReason);
    }
    if (likedReason) {
      reasons.push(likedReason);
    }
    if (viewedReason) {
      reasons.push(viewedReason);
    }
  }

  if (locationMatch) {
    components.location = MATERIAL_SCORE_WEIGHTS.locationMatch;
    bonusScore += components.location;
  }
  if (material.isFree) {
    components.free = MATERIAL_SCORE_WEIGHTS.free;
    bonusScore += components.free;
  }
  if (material.deliveryAllowed) {
    components.delivery = MATERIAL_SCORE_WEIGHTS.delivery;
    bonusScore += components.delivery;
  }

  components.popularity = scorePopularity(
    material.viewsCount,
    material.likesCount,
    MATERIAL_SCORE_WEIGHTS.popularityMax,
  );
  bonusScore += components.popularity;

  components.recency = scoreRecency(
    material.createdAt,
    MATERIAL_SCORE_WEIGHTS.recencyMax,
    nowMs,
  );
  bonusScore += components.recency;

  if (isAlreadyLiked) {
    components.alreadyLikedPenalty = ALREADY_LIKED_MATERIAL_PENALTY;
  }

  const section = input.section ?? 'suggested';

  if (section === 'free') {
    if (!material.isFree) {
      return {
        score: UNAVAILABLE_MATERIAL_PENALTY,
        reasons: [],
        tier: FREE_MATERIAL_TIERS.freeFallback,
        hasPrimaryRelevance: false,
        fallbackOnly: false,
        internalReasonCodes: asciiSort(new Set(internalReasonCodes)) as CanonicalInternalReasonCode[],
        semanticCoverage: candidateProfile.coverage,
        components: {
          ...emptyBreakdown(),
          unavailablePenalty: Math.abs(UNAVAILABLE_MATERIAL_PENALTY),
        },
      };
    }

    const hasPersonalSignal = hasActivity && behaviorScore > 0;
    let freeScore = MATERIAL_SCORE_WEIGHTS.free * 2;
    const freeReasons: string[] = ['Free material'];
    let freeTier: MaterialScoringTier = FREE_MATERIAL_TIERS.freeFallback;

    if (locationMatch) {
      freeScore += MATERIAL_SCORE_WEIGHTS.locationMatch;
      freeReasons.push('Free material near your saved location');
      freeTier = FREE_MATERIAL_TIERS.freeNearLocation;
    } else if (hasPersonalSignal) {
      freeTier = FREE_MATERIAL_TIERS.freeInterestOrBehavior;
      const personalReason = reservedReason ?? likedReason ?? viewedReason;
      if (personalReason) {
        freeReasons.push(personalReason);
      }
    }

    freeScore += components.popularity;
    freeScore += components.recency;

    return {
      score: freeScore,
      reasons: orderMaterialReasons(freeReasons).slice(0, 4),
      tier: freeTier,
      // §30b: canonical liked/reserved/viewed never establish primary relevance.
      hasPrimaryRelevance: false,
      fallbackOnly: !hasPersonalSignal && !locationMatch,
      internalReasonCodes: asciiSort(new Set(internalReasonCodes)) as CanonicalInternalReasonCode[],
      semanticCoverage: candidateProfile.coverage,
      // Contribution-exact: freeScore = free*2 + [location if match] +
      // popularity + recency only. Behavior overlap (liked/reserved/viewed)
      // and delivery affect only tier/reason text in this section — they are
      // reported as zero here so the breakdown never claims a contribution
      // the formula does not actually make.
      components: {
        likedSimilarity: 0,
        reservedSimilarity: 0,
        viewedSimilarity: 0,
        location: locationMatch ? MATERIAL_SCORE_WEIGHTS.locationMatch : 0,
        free: MATERIAL_SCORE_WEIGHTS.free * 2,
        delivery: 0,
        popularity: components.popularity,
        recency: components.recency,
        alreadyLikedPenalty: 0,
        unavailablePenalty: 0,
        interest: 0,
        savedComponent: 0,
        affinity: 0,
        savedRelatedProject: 0,
        continuedBuild: 0,
      },
    };
  }

  // suggested + savedProjects share base; saved-component contribution is 0 under canonical.
  const tier = resolveCanonicalSuggestedTier({
    hasBehaviorActivity: hasActivity,
    behaviorScore,
    allowsWeakOnlyFallback,
    hasAnyRelevance,
  });

  if (locationMatch && (tier <= SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom || fallbackOnly)) {
    reasons.push('Available near your saved location');
  }
  if (material.isFree && (fallbackOnly || tier >= SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom)) {
    reasons.push('Free material');
  }
  if (
    material.deliveryAllowed &&
    (fallbackOnly || tier >= SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom)
  ) {
    reasons.push('Delivery available');
  }
  if (fallbackOnly && components.popularity >= 4) {
    reasons.push('Popular material');
  }
  if (fallbackOnly && components.recency >= MATERIAL_SCORE_WEIGHTS.recencyMax - 1) {
    reasons.push('Recently added');
  }

  let score = behaviorScore + bonusScore;
  if (isAlreadyLiked) {
    score -= ALREADY_LIKED_MATERIAL_PENALTY;
  }

  return {
    score,
    reasons: orderMaterialReasons(reasons).slice(0, 4),
    tier,
    hasPrimaryRelevance: false,
    fallbackOnly,
    internalReasonCodes: asciiSort(new Set(internalReasonCodes)) as CanonicalInternalReasonCode[],
    semanticCoverage: candidateProfile.coverage,
    components,
  };
};

export const scoreCanonicalMaterialPool = (input: {
  materials: LearnerHomeMaterialCandidate[];
  context: CanonicalMaterialScoringContext;
  savedLocation: LearnerHomeSavedLocationContext;
  behavior: LearnerBehaviorContext;
  now?: Date;
}): Array<{
  material: LearnerHomeMaterialCandidate;
  ownerId: string;
  scores: {
    suggested: CanonicalScoredMaterialResult;
    savedProjects: CanonicalScoredMaterialResult;
    free: CanonicalScoredMaterialResult;
  };
}> => {
  const context = assertCanonicalContextPresent(input.context);
  for (const material of input.materials) {
    if (!context.candidateMaterialProfiles.has(material.id)) {
      throw new CanonicalContextInvariantError(
        'canonical-taxonomy-v3 candidate missing from CanonicalMaterialScoringContext.candidateMaterialProfiles',
      );
    }
  }

  // Captured exactly once for the whole pool. Every candidate's suggested,
  // saved-project, and free calculations share this identical instant, so
  // recency (and any other time-derived component) cannot diverge between
  // candidates — or between pool orderings — merely because wall-clock time
  // advanced between individual scoring calls.
  const evaluationTime = input.now ?? new Date();

  return input.materials.map((material) => {
    const suggested = scoreCanonicalMaterialCandidate({
      candidate: material,
      context,
      savedLocation: input.savedLocation,
      behavior: input.behavior,
      now: evaluationTime,
      section: 'suggested',
    });
    // Saved-projects section: same score as suggested under canonical (component +0).
    const savedProjects: CanonicalScoredMaterialResult = {
      ...suggested,
      // Keep explicit marker that component relation is unavailable.
      internalReasonCodes: asciiSort(
        new Set([
          ...suggested.internalReasonCodes,
          'CANONICAL_COMPONENT_RELATION_UNAVAILABLE' as const,
        ]),
      ) as CanonicalInternalReasonCode[],
    };
    const free = scoreCanonicalMaterialCandidate({
      candidate: material,
      context,
      savedLocation: input.savedLocation,
      behavior: input.behavior,
      now: evaluationTime,
      section: 'free',
    });

    return {
      material,
      ownerId: material.ownerId,
      scores: { suggested, savedProjects, free },
    };
  });
};
