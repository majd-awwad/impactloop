import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  resolveProjectConceptAssignments,
  toProjectTopicConceptIds,
  type ProjectConceptAssignmentConceptType,
  type ProjectConceptAssignmentConceptStatus,
} from './project-concept-assignment.js';

type TaxonomyWriteClient = typeof prisma | Prisma.TransactionClient;

export const PROJECT_CATEGORY_TAXONOMY_NOT_READY_MESSAGE =
  'This category is not ready for project publishing. Please choose another category or contact support.';

export const PROJECT_CONCEPT_ASSIGNMENT_INTERNAL_MESSAGE =
  'Project concept assignment failed due to an internal error.';

export type CategoryProjectTopicOwnershipProjection = {
  id: string;
  categoryType: 'MATERIAL' | 'PROJECT' | 'BOTH';
  isActive: boolean;
  projectTopicConceptId: string | null;
  projectTopicConcept: {
    id: string;
    canonicalKey: string;
    conceptType: ProjectConceptAssignmentConceptType;
    status: ProjectConceptAssignmentConceptStatus;
  } | null;
};

export const loadCategoryProjectTopicOwnership = async (
  client: TaxonomyWriteClient,
  categoryId: string,
): Promise<CategoryProjectTopicOwnershipProjection | null> => {
  return client.category.findUnique({
    where: { id: categoryId },
    select: {
      id: true,
      categoryType: true,
      isActive: true,
      projectTopicConceptId: true,
      projectTopicConcept: {
        select: {
          id: true,
          canonicalKey: true,
          conceptType: true,
          status: true,
        },
      },
    },
  });
};

const throwCategoryTaxonomyNotReady = (reason: string): never => {
  throw new AppError(
    PROJECT_CATEGORY_TAXONOMY_NOT_READY_MESSAGE,
    409,
    'CATEGORY_TAXONOMY_NOT_READY',
    { reason },
  );
};

const throwInternalAssignmentError = (reason: string): never => {
  throw new AppError(
    PROJECT_CONCEPT_ASSIGNMENT_INTERNAL_MESSAGE,
    500,
    'INTERNAL_ERROR',
    { reason },
  );
};

export const resolveExpectedProjectTopicConceptIds = (
  ownership: CategoryProjectTopicOwnershipProjection,
): string[] => {
  const result = resolveProjectConceptAssignments({
    category: {
      id: ownership.id,
      categoryType: ownership.categoryType,
      isActive: ownership.isActive,
      projectTopicConceptId: ownership.projectTopicConceptId,
      projectTopicConcept: ownership.projectTopicConcept
        ? {
            id: ownership.projectTopicConcept.id,
            canonicalKey: ownership.projectTopicConcept.canonicalKey,
            conceptType: ownership.projectTopicConcept.conceptType,
            status: ownership.projectTopicConcept.status,
          }
        : null,
    },
  });

  if (result.status === 'BLOCKED_INVALID_CATEGORY_OWNERSHIP') {
    return throwCategoryTaxonomyNotReady('BLOCKED_INVALID_CATEGORY_OWNERSHIP');
  }

  try {
    return toProjectTopicConceptIds(result);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'TOPIC_RESOLVE_FAILED';
    if (reason === 'BLOCKED_INVALID_CATEGORY_OWNERSHIP') {
      return throwCategoryTaxonomyNotReady(reason);
    }
    return throwInternalAssignmentError(reason);
  }
};

export const syncLearningProjectTopicAssignments = async (
  client: TaxonomyWriteClient,
  projectId: string,
  expectedConceptIds: readonly string[],
): Promise<void> => {
  if (expectedConceptIds.length !== 1) {
    throwInternalAssignmentError('TOPIC_CARDINALITY');
  }
  const expectedId = expectedConceptIds[0]!;
  if (!expectedId || expectedId.trim().length === 0) {
    throwInternalAssignmentError('TOPIC_CONCEPT_ID_BLANK');
  }

  const currentRows = await client.learningProjectConcept.findMany({
    where: { projectId },
    select: { conceptId: true },
  });
  const currentIds = currentRows.map((row) => row.conceptId);
  const currentSet = new Set(currentIds);
  const desiredSet = new Set(expectedConceptIds);
  const setsEqual =
    currentSet.size === desiredSet.size
    && expectedConceptIds.every((conceptId) => currentSet.has(conceptId));

  if (setsEqual) {
    return;
  }

  await client.learningProjectConcept.deleteMany({
    where: { projectId },
  });
  await client.learningProjectConcept.createMany({
    data: expectedConceptIds.map((conceptId) => ({
      projectId,
      conceptId,
    })),
  });
};

export const reconcileLearningProjectTopics = async (
  client: TaxonomyWriteClient,
  projectId: string,
  categoryId: string,
): Promise<void> => {
  const ownership = await loadCategoryProjectTopicOwnership(client, categoryId);
  if (!ownership) {
    throw new AppError('Category not found', 404, 'NOT_FOUND');
  }
  const expectedConceptIds = resolveExpectedProjectTopicConceptIds(ownership);
  await syncLearningProjectTopicAssignments(client, projectId, expectedConceptIds);
};

export type ProjectTopicLifecycleDeps = {
  reconcileLearningProjectTopics: (
    client: TaxonomyWriteClient,
    projectId: string,
    categoryId: string,
  ) => Promise<void>;
};

export const defaultProjectTopicLifecycleDeps: ProjectTopicLifecycleDeps = {
  reconcileLearningProjectTopics,
};
