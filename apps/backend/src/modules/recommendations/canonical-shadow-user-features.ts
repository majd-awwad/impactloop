import type {
  LearnerInterestRegistryConcept,
  LearnerInterestResolution,
  LearnerInterestResolutionStatus,
  LearnerInterestUnmappedReason,
} from '../taxonomy/learner-interest-resolver.js';
import { resolveLearnerInterests } from '../taxonomy/learner-interest-resolver.js';
import type { WeightedFeature } from './recommendations.ml-feature.types.js';
import { asciiCompare } from './recommendations.compare.js';

export { asciiCompare } from './recommendations.compare.js';

export type ArtifactUserFeatureOverlapStatus =
  | 'NO_RUNTIME_FEATURES'
  | 'ZERO_OVERLAP'
  | 'PARTIAL_OVERLAP'
  | 'FULL_OVERLAP';

export type CanonicalShadowUserFeatures = {
  features: WeightedFeature[];
  resolutionStatus: LearnerInterestResolutionStatus;
  mappedInputCount: number;
  unmappedInputCount: number;
  canonicalFeatureCount: number;
  unmappedReasonCounts: Partial<Record<LearnerInterestUnmappedReason, number>>;
  candidateIndependent: true;
  hasDeclaredInterestFeatures: boolean;
};

export type ArtifactUserFeatureOverlap = {
  canonicalUserFeatureCount: number;
  artifactMatchedUserFeatureCount: number;
  artifactMissingUserFeatureCount: number;
  artifactUserFeatureOverlapStatus: ArtifactUserFeatureOverlapStatus;
};

export const buildCanonicalShadowUserFeatures = (input: {
  resolution: LearnerInterestResolution;
}): CanonicalShadowUserFeatures => {
  const { resolution } = input;
  const uniqueKeys = [...new Set(resolution.canonicalKeys)].sort(asciiCompare);
  const features: WeightedFeature[] = uniqueKeys.map((token) => [token, 1]);

  const unmappedReasonCounts: Partial<
    Record<LearnerInterestUnmappedReason, number>
  > = {};
  for (const entry of resolution.unmapped) {
    unmappedReasonCounts[entry.reason] =
      (unmappedReasonCounts[entry.reason] ?? 0) + 1;
  }

  return {
    features,
    resolutionStatus: resolution.status,
    mappedInputCount: resolution.mappedInputCount,
    unmappedInputCount: resolution.unmappedInputCount,
    canonicalFeatureCount: features.length,
    unmappedReasonCounts,
    candidateIndependent: true,
    hasDeclaredInterestFeatures: features.length > 0,
  };
};

export const computeArtifactUserFeatureOverlap = (input: {
  runtimeFeatures: readonly WeightedFeature[];
  artifactUserFeatureNames: ReadonlySet<string> | readonly string[];
}): ArtifactUserFeatureOverlap => {
  const vocab =
    input.artifactUserFeatureNames instanceof Set
      ? input.artifactUserFeatureNames
      : new Set(input.artifactUserFeatureNames);

  const runtimeNames = [
    ...new Set(input.runtimeFeatures.map(([name]) => name)),
  ];
  const canonicalUserFeatureCount = runtimeNames.length;

  if (canonicalUserFeatureCount === 0) {
    return {
      canonicalUserFeatureCount: 0,
      artifactMatchedUserFeatureCount: 0,
      artifactMissingUserFeatureCount: 0,
      artifactUserFeatureOverlapStatus: 'NO_RUNTIME_FEATURES',
    };
  }

  let artifactMatchedUserFeatureCount = 0;
  for (const name of runtimeNames) {
    if (vocab.has(name)) artifactMatchedUserFeatureCount += 1;
  }
  const artifactMissingUserFeatureCount =
    canonicalUserFeatureCount - artifactMatchedUserFeatureCount;

  let artifactUserFeatureOverlapStatus: ArtifactUserFeatureOverlapStatus;
  if (artifactMatchedUserFeatureCount === 0) {
    artifactUserFeatureOverlapStatus = 'ZERO_OVERLAP';
  } else if (artifactMissingUserFeatureCount === 0) {
    artifactUserFeatureOverlapStatus = 'FULL_OVERLAP';
  } else {
    artifactUserFeatureOverlapStatus = 'PARTIAL_OVERLAP';
  }

  return {
    canonicalUserFeatureCount,
    artifactMatchedUserFeatureCount,
    artifactMissingUserFeatureCount,
    artifactUserFeatureOverlapStatus,
  };
};

const isAbsentOrEmptyInterests = (
  storedInterests: readonly string[] | null | undefined,
): boolean =>
  storedInterests == null ||
  (Array.isArray(storedInterests) && storedInterests.length === 0);

export const resolveCanonicalShadowUserFeatures = async (input: {
  storedInterests: readonly string[] | null | undefined;
  loadRegistry: () => Promise<readonly LearnerInterestRegistryConcept[]>;
}): Promise<CanonicalShadowUserFeatures> => {
  // True NO_INTERESTS (null/undefined/[]) skips taxonomy loading entirely.
  // Blank, malformed, custom, or unresolved values still require the registry.
  if (isAbsentOrEmptyInterests(input.storedInterests)) {
    const resolution = resolveLearnerInterests(input.storedInterests, []);
    return buildCanonicalShadowUserFeatures({ resolution });
  }

  const registry = await input.loadRegistry();
  const resolution = resolveLearnerInterests(input.storedInterests, registry);
  return buildCanonicalShadowUserFeatures({ resolution });
};
