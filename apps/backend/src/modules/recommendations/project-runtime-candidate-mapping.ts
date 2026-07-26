import type { ProjectDifficulty } from '../../generated/prisma/client.js';
import { selectSuggestedProjectItems } from '../learner-home/learner-home.section-builders.js';
import type { LearnerHomeProjectItem } from '../learner-home/learner-home.types.js';
import {
  buildCanonicalProjectRuntimeFeatures,
  canonicalConceptAssociationFromActiveKey,
  type CanonicalRuntimeFeatureAuthority,
} from './canonical-runtime-item-features.js';

export type ProjectComponentConceptSource = {
  isRequired: boolean;
  taxonomyConcepts: Array<{ concept: { canonicalKey: string } }>;
};

export type ProjectRuntimeCandidateFeatures = {
  categoryId?: string;
  difficulty: ProjectDifficulty;
  conceptKeys?: string[];
  componentConceptKeys?: string[];
};

export const selectRequiredComponentConceptKeys = (
  components: ProjectComponentConceptSource[],
): string[] => [
  ...new Set(
    components
      .filter((component) => component.isRequired)
      .flatMap((component) => component.taxonomyConcepts.map((entry) => entry.concept.canonicalKey)),
  ),
].sort();

const buildProjectItemFeatures = (
  candidate: ProjectRuntimeCandidateFeatures,
  authority: CanonicalRuntimeFeatureAuthority,
) =>
  buildCanonicalProjectRuntimeFeatures({
    authority,
    topicConcepts: (candidate.conceptKeys ?? []).map((canonicalKey) =>
      canonicalConceptAssociationFromActiveKey(authority, canonicalKey),
    ),
    componentConcepts: (candidate.componentConceptKeys ?? []).map(
      (canonicalKey) => ({
        ...canonicalConceptAssociationFromActiveKey(authority, canonicalKey),
        isRequired: true,
      }),
    ),
    difficulty: candidate.difficulty,
  });

export const projectItemFeatureNames = (
  candidate: ProjectRuntimeCandidateFeatures,
  authority: CanonicalRuntimeFeatureAuthority,
): string[] =>
  buildProjectItemFeatures(candidate, authority).features.map(([name]) => name);

export const countArtifactMappedCandidates = (
  candidates: ProjectRuntimeCandidateFeatures[],
  artifactFeatureNames: ReadonlySet<string>,
  authority: CanonicalRuntimeFeatureAuthority,
): { artifactMappedCandidateCount: number; missingArtifactCandidateCount: number } => {
  let artifactMappedCandidateCount = 0;
  for (const candidate of candidates) {
    const built = buildProjectItemFeatures(candidate, authority);
    const featureNames = built.features.map(([name]) => name);
    if (
      built.scoringEligible &&
      featureNames.every((name) => artifactFeatureNames.has(name))
    ) {
      artifactMappedCandidateCount += 1;
    }
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
