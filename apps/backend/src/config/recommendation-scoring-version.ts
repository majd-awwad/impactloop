export const RECOMMENDATION_SCORER_VERSIONS = [
  "legacy-v1",
  "normalized-interests-v2",
  "canonical-taxonomy-v3",
] as const;

export type RecommendationScorerVersion =
  (typeof RECOMMENDATION_SCORER_VERSIONS)[number];

export const parseRecommendationScorerVersion = (
  value: string | undefined,
): RecommendationScorerVersion => {
  const normalized = value?.trim() || "legacy-v1";
  if (
    !RECOMMENDATION_SCORER_VERSIONS.includes(
      normalized as RecommendationScorerVersion,
    )
  ) {
    throw new Error(
      `Invalid RECOMMENDATION_SCORER_VERSION "${normalized}". Expected one of: ${RECOMMENDATION_SCORER_VERSIONS.join(", ")}`,
    );
  }

  return normalized as RecommendationScorerVersion;
};

// Captured once at module initialization. Changing the environment requires a
// process restart, which also clears the in-memory Learner Home cache.
export const RECOMMENDATION_SCORER_VERSION = parseRecommendationScorerVersion(
  process.env.RECOMMENDATION_SCORER_VERSION,
);
