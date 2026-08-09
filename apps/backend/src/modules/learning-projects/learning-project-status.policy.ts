import type {
  LearningProjectStatus,
  ProjectBuildStatus,
} from '../../generated/prisma/client.js';

export const EDITABLE_LEARNING_PROJECT_SUBMISSION_STATUSES = [
  'DRAFT',
  'CHANGES_REQUESTED',
  'PENDING_REVIEW',
] as const satisfies readonly LearningProjectStatus[];

export const SUBMITTABLE_LEARNING_PROJECT_STATUSES = [
  'DRAFT',
] as const satisfies readonly LearningProjectStatus[];

export const RESUBMITTABLE_LEARNING_PROJECT_STATUSES = [
  'CHANGES_REQUESTED',
] as const satisfies readonly LearningProjectStatus[];

export const ACTIVE_PROJECT_BUILD_STATUSES = [
  'IN_PROGRESS',
  'PAUSED',
] as const satisfies readonly ProjectBuildStatus[];

export const isLearningProjectSubmissionEditable = (
  status: LearningProjectStatus,
): boolean =>
  (
    EDITABLE_LEARNING_PROJECT_SUBMISSION_STATUSES as readonly LearningProjectStatus[]
  ).includes(status);

export const isLearningProjectSubmittable = (
  status: LearningProjectStatus,
): boolean =>
  (SUBMITTABLE_LEARNING_PROJECT_STATUSES as readonly LearningProjectStatus[]).includes(
    status,
  );

export const isLearningProjectResubmittable = (
  status: LearningProjectStatus,
): boolean =>
  (
    RESUBMITTABLE_LEARNING_PROJECT_STATUSES as readonly LearningProjectStatus[]
  ).includes(status);

export const isActiveProjectBuildStatus = (
  status: ProjectBuildStatus,
): boolean =>
  (ACTIVE_PROJECT_BUILD_STATUSES as readonly ProjectBuildStatus[]).includes(
    status,
  );
