import type { InterestMatchSource } from './learner-interest-taxonomy.js';

export const SUGGESTED_MATERIAL_TIERS = {
  interestStrong: 1,
  behaviorStrong: 2,
  savedProjectComponent: 3,
  interestWeakOrCustom: 4,
  fallback: 5,
} as const;

export const SAVED_PROJECT_MATERIAL_TIERS = {
  savedProjectComponent: 1,
  savedProjectEnriched: 2,
  componentCategory: 3,
} as const;

export const FREE_MATERIAL_TIERS = {
  freeNearLocation: 1,
  freeInterestOrBehavior: 2,
  freeFallback: 3,
} as const;

export const SUGGESTED_PROJECT_TIERS = {
  interestMatch: 1,
  behaviorStrong: 2,
  matchingMaterials: 3,
  popularFallback: 4,
} as const;

export type SuggestedMaterialTier =
  (typeof SUGGESTED_MATERIAL_TIERS)[keyof typeof SUGGESTED_MATERIAL_TIERS];

export type FreeMaterialTier =
  (typeof FREE_MATERIAL_TIERS)[keyof typeof FREE_MATERIAL_TIERS];

export type MaterialScoringTier = SuggestedMaterialTier | FreeMaterialTier;

export type RankedMaterialItem<T> = {
  item: T;
  score: number;
  tier: SuggestedMaterialTier;
  reasons: string[];
  hasPrimaryRelevance: boolean;
  fallbackOnly: boolean;
};

export const compareRankedMaterialItems = <T>(
  left: RankedMaterialItem<T>,
  right: RankedMaterialItem<T>,
) => {
  if (left.tier !== right.tier) {
    return left.tier - right.tier;
  }

  return right.score - left.score;
};

export const selectTieredSuggestedMaterials = <T>(
  items: RankedMaterialItem<T>[],
  limit: number,
): RankedMaterialItem<T>[] => {
  const sorted = [...items].sort(compareRankedMaterialItems);

  const interestAndBehavior = sorted.filter(
    (item) => item.tier <= SUGGESTED_MATERIAL_TIERS.behaviorStrong,
  );
  if (interestAndBehavior.length > 0) {
    return interestAndBehavior.slice(0, Math.min(interestAndBehavior.length, limit));
  }

  const savedProjectMatches = sorted.filter(
    (item) => item.tier === SUGGESTED_MATERIAL_TIERS.savedProjectComponent,
  );
  if (savedProjectMatches.length > 0) {
    return savedProjectMatches.slice(0, limit);
  }

  const weakMatches = sorted.filter(
    (item) => item.tier === SUGGESTED_MATERIAL_TIERS.interestWeakOrCustom,
  );
  if (weakMatches.length > 0) {
    return weakMatches.slice(0, limit);
  }

  return sorted
    .filter((item) => item.tier === SUGGESTED_MATERIAL_TIERS.fallback)
    .slice(0, limit);
};

export const sortAllRankedMaterials = <T>(
  items: RankedMaterialItem<T>[],
): RankedMaterialItem<T>[] => [...items].sort(compareRankedMaterialItems);

export type MaterialScoreAudit = {
  score: number;
  tier: SuggestedMaterialTier;
  reasons: string[];
  matchedInterestKey: string | null;
  matchStrength: 'strong' | 'group' | 'custom' | 'fallback' | null;
  matchedSources: InterestMatchSource[];
  passedRelevanceGate: boolean;
  fallbackOnly: boolean;
  relevanceScore: number;
  bonusScore: number;
};
