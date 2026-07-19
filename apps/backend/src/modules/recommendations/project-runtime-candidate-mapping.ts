import { createHash } from 'node:crypto';

export type ProjectComponentConceptSource = {
  isRequired: boolean;
  taxonomyConcepts: Array<{ concept: { canonicalKey: string } }>;
};

export type ProjectRuntimeCandidateFeatures = {
  categoryId: string;
  difficulty?: string;
  conceptKeys?: string[];
  componentConceptKeys?: string[];
};

export const categoryKey = (id: string) =>
  createHash('sha256').update(`impactloop-category:${id}`).digest('hex');

export const selectRequiredComponentConceptKeys = (
  components: ProjectComponentConceptSource[],
): string[] => [
  ...new Set(
    components
      .filter((component) => component.isRequired)
      .flatMap((component) => component.taxonomyConcepts.map((entry) => entry.concept.canonicalKey)),
  ),
].sort();

export const projectItemFeatureNames = (candidate: ProjectRuntimeCandidateFeatures): string[] => {
  const features = [`category:${categoryKey(candidate.categoryId)}`];
  for (const value of candidate.conceptKeys ?? []) features.push(`concept:${value}`);
  if (candidate.difficulty) features.push(`difficulty:${candidate.difficulty}`);
  for (const value of candidate.componentConceptKeys ?? []) features.push(`component:${value}`);
  return features;
};

export const countArtifactMappedCandidates = (
  candidates: ProjectRuntimeCandidateFeatures[],
  artifactFeatureNames: ReadonlySet<string>,
): { artifactMappedCandidateCount: number; missingArtifactCandidateCount: number } => {
  let artifactMappedCandidateCount = 0;
  for (const candidate of candidates) {
    const featureNames = projectItemFeatureNames(candidate);
    if (featureNames.every((name) => artifactFeatureNames.has(name))) artifactMappedCandidateCount += 1;
  }
  return {
    artifactMappedCandidateCount,
    missingArtifactCandidateCount: candidates.length - artifactMappedCandidateCount,
  };
};
