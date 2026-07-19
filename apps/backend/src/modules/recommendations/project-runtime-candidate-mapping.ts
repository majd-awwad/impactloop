import { createHash } from 'node:crypto';

import { selectSuggestedProjectItems } from '../learner-home/learner-home.section-builders.js';
import type { LearnerHomeProjectItem } from '../learner-home/learner-home.types.js';

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

const orderProjectItemsByRanking = (
  items: LearnerHomeProjectItem[],
  rankedCandidateKeys: string[],
): LearnerHomeProjectItem[] => {
  const ranks = new Map(rankedCandidateKeys.map((key, index) => [key, index]));
  const originalOrder = new Map(items.map((item, index) => [item, index]));
  const itemKey = (item: LearnerHomeProjectItem) => String(item.project.id ?? '');

  return [...items].sort((left, right) =>
    (ranks.get(itemKey(left)) ?? Number.MAX_SAFE_INTEGER) -
      (ranks.get(itemKey(right)) ?? Number.MAX_SAFE_INTEGER) ||
    (originalOrder.get(left) ?? 0) - (originalOrder.get(right) ?? 0),
  );
};

export const buildServedSuggestedProjectsItems = (input: {
  rankedCandidateKeys: string[];
  savedProjectIds: ReadonlySet<string>;
  limit: number;
  buildProjectItem: (projectId: string) => LearnerHomeProjectItem | undefined;
}): LearnerHomeProjectItem[] => {
  const seenKeys = new Set<string>();
  const eligibleItems: LearnerHomeProjectItem[] = [];

  for (const candidateKey of input.rankedCandidateKeys) {
    if (seenKeys.has(candidateKey)) {
      throw new Error('duplicate_served_project_candidate');
    }
    seenKeys.add(candidateKey);
    const item = input.buildProjectItem(candidateKey);
    if (!item) {
      throw new Error('project_hydration_failure');
    }
    if (item.score <= 0) continue;
    eligibleItems.push(item);
  }

  const unsavedItems = orderProjectItemsByRanking(
    eligibleItems.filter((item) => !input.savedProjectIds.has(String(item.project.id ?? ''))),
    input.rankedCandidateKeys,
  );
  const savedItems = orderProjectItemsByRanking(
    eligibleItems.filter((item) => input.savedProjectIds.has(String(item.project.id ?? ''))),
    input.rankedCandidateKeys,
  );

  return selectSuggestedProjectItems(unsavedItems, savedItems, input.limit);
};
