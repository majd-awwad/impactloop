import type { LearningProjectStatus, Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  ADMIN_ACTIVITY_ACTIONS,
  ADMIN_ACTIVITY_TARGET_TYPES,
  logAdminActivity,
} from '../admin/admin-activity-log.js';

import {
  assertEditableProjectStatus,
  assertUniqueComponentName,
  buildComponentUpdateData,
} from './admin-learning-projects.component-enrichment.js';
import {
  assessComponentQuality,
  COMPONENT_EDITABLE_STATUSES,
  type ComponentQualityIssue,
} from './admin-learning-projects.component-quality.js';
import * as repository from './admin-learning-projects.repository.js';
import {
  appendVisualCoverageManualNote,
  buildAdminReviewContentFingerprint,
  buildAdminReviewImageCandidates,
  buildMinimizedAdminReviewSnapshot,
  executeAdminLearningProjectAiProviderReview,
  loadAdminReviewImageInputs,
  parsePersistedAdminAiReviewJson,
} from './admin-learning-projects.ai-review.js';
import type {
  AdminAiReviewBodyInput,
  AdminLearningProjectsListQuery,
  ModerationReasonInput,
  UpdateAdminLearningProjectComponentInput,
} from './admin-learning-projects.validation.js';

const decimalToNumber = (value: { toNumber(): number } | number): number =>
  typeof value === 'number' ? value : value.toNumber();

const parseKeywordJson = (value: Prisma.JsonValue | null | undefined) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

const toQualityInputs = (
  components: repository.AdminLearningProjectDetailRecord['requiredComponents'],
) =>
  components.map((component) => ({
    id: component.id,
    componentName: component.componentName,
    quantity: decimalToNumber(component.quantity),
    componentRole: component.componentRole,
    categoryId: component.categoryId,
    categoryType: component.category?.categoryType ?? null,
    categoryActive: component.category?.isActive ?? null,
    materialType: component.materialType,
    searchKeywords: parseKeywordJson(component.searchKeywords),
  }));

const buildComponentQualityReport = (
  project: repository.AdminLearningProjectDetailRecord,
) => {
  const assessment = assessComponentQuality(toQualityInputs(project.requiredComponents));

  return {
    hardIssues: assessment.hardIssues,
    softWarnings: assessment.softWarnings,
    canApprove: assessment.hardIssues.length === 0,
    byComponentId: assessment.byComponentId,
  };
};

const mapComponentQualityIssues = (
  componentId: string,
  report: ReturnType<typeof buildComponentQualityReport>,
): {
  hardIssues: ComponentQualityIssue[];
  softWarnings: ComponentQualityIssue[];
} => ({
  hardIssues: report.byComponentId[componentId]?.hardIssues ?? [],
  softWarnings: report.byComponentId[componentId]?.softWarnings ?? [],
});

const mapComponent = (
  component: repository.AdminLearningProjectDetailRecord['requiredComponents'][number],
  report: ReturnType<typeof buildComponentQualityReport>,
) => ({
  id: component.id,
  name: component.componentName,
  materialType: component.materialType,
  quantity: decimalToNumber(component.quantity),
  unit: component.unit,
  componentRole: component.componentRole,
  isRequired: component.isRequired,
  canBeSubstituted: component.canBeSubstituted,
  categoryId: component.categoryId,
  category: component.category
    ? {
        id: component.category.id,
        nameEn: component.category.nameEn,
        nameAr: component.category.nameAr,
      }
    : null,
  searchKeywords: parseKeywordJson(component.searchKeywords),
  alternativeKeywords: parseKeywordJson(component.alternativeKeywords),
  notes: component.notes,
  providedByUser: component.providedByUser,
  confirmedByUser: component.confirmedByUser,
  reviewStatus: component.reviewStatus,
  quality: mapComponentQualityIssues(component.id, report),
});

const resolvePrimaryRole = (
  roles: { role: string; isPrimary: boolean }[],
) => {
  const primary = roles.find((role) => role.isPrimary);
  return primary?.role ?? roles[0]?.role ?? null;
};

const mapAuthor = (
  user: repository.AdminLearningProjectDetailRecord['createdByUser'],
) => ({
  id: user.id,
  displayName: user.displayName,
  email: user.email,
  primaryRole: resolvePrimaryRole(user.roles),
});

const mapReviewer = (
  user: repository.AdminLearningProjectDetailRecord['reviewedByUser'],
) =>
  user
    ? {
        id: user.id,
        displayName: user.displayName,
        email: user.email,
      }
    : null;

const mapListItem = (project: repository.AdminLearningProjectListRecord) => ({
  id: project.id,
  title: project.title,
  shortDescription: project.shortDescription,
  coverImageUrl: project.coverImageUrl,
  status: project.status,
  difficulty: project.difficulty,
  category: {
    id: project.category.id,
    nameEn: project.category.nameEn,
    nameAr: project.category.nameAr,
  },
  author: mapAuthor(project.createdByUser),
  componentsCount: project._count.requiredComponents,
  stepsCount: project._count.steps,
  createdAt: project.createdAt.toISOString(),
  submittedAt: project.submittedAt?.toISOString() ?? null,
  reviewedAt: project.reviewedAt?.toISOString() ?? null,
});

const mapDetail = (project: repository.AdminLearningProjectDetailRecord) => {
  const componentQuality = buildComponentQualityReport(project);

  return {
  id: project.id,
  title: project.title,
  shortDescription: project.shortDescription,
  description: project.description,
  status: project.status,
  difficulty: project.difficulty,
  estimatedDurationMinutes: project.estimatedDurationMinutes,
  coverImageUrl: project.coverImageUrl,
  category: {
    id: project.category.id,
    nameEn: project.category.nameEn,
    nameAr: project.category.nameAr,
  },
  author: mapAuthor(project.createdByUser),
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
  submittedAt: project.submittedAt?.toISOString() ?? null,
  reviewedAt: project.reviewedAt?.toISOString() ?? null,
  reviewNote: project.reviewNote,
  rejectionReason: project.rejectionReason,
  changesRequestedReason: project.changesRequestedReason,
  hiddenAt: project.hiddenAt?.toISOString() ?? null,
  hiddenReason: project.hiddenReason,
  archivedAt: project.archivedAt?.toISOString() ?? null,
  archivedReason: project.archivedReason,
  reviewedBy: mapReviewer(project.reviewedByUser),
  images: project.images.map((image) => ({
    id: image.id,
    imageUrl: image.imageUrl,
    sortOrder: image.sortOrder,
  })),
  requiredComponents: project.requiredComponents.map((component) =>
    mapComponent(component, componentQuality),
  ),
  steps: project.steps.map((step) => ({
    id: step.id,
    stepNumber: step.stepNumber,
    title: step.title,
    description: step.description,
    imageUrl: step.imageUrl,
  })),
  links: project.links.map((link) => ({
    id: link.id,
    linkType: link.linkType,
    url: link.url,
    title: link.title,
    sourceName: link.sourceName,
  })),
  tags: project.tags.map((tag) => tag.tag),
  componentQuality: {
    hardIssues: componentQuality.hardIssues,
    softWarnings: componentQuality.softWarnings,
    canApprove: componentQuality.canApprove,
  },
  allowedActions: {
    ...getAllowedActions(project.status),
    canEditComponents: COMPONENT_EDITABLE_STATUSES.has(project.status),
  },
};
};

const connectReviewer = (userId: string): Prisma.LearningProjectUpdateInput => ({
  reviewedByUser: { connect: { id: userId } },
});

const APPROVE_FROM: LearningProjectStatus[] = [
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
  'REJECTED',
];

const REQUEST_CHANGES_FROM: LearningProjectStatus[] = [
  'PENDING_REVIEW',
  'PUBLISHED',
];

const REJECT_FROM: LearningProjectStatus[] = ['PENDING_REVIEW'];

const HIDE_FROM: LearningProjectStatus[] = ['PUBLISHED'];

const RESTORE_FROM: LearningProjectStatus[] = ['HIDDEN', 'ARCHIVED'];

const ARCHIVE_FROM: LearningProjectStatus[] = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'CHANGES_REQUESTED',
  'REJECTED',
  'HIDDEN',
];

export const getAllowedActions = (status: LearningProjectStatus) => ({
  canApprove: APPROVE_FROM.includes(status),
  canRequestChanges: REQUEST_CHANGES_FROM.includes(status),
  canReject: REJECT_FROM.includes(status),
  canHide: HIDE_FROM.includes(status),
  canRestore: RESTORE_FROM.includes(status),
  canArchive: ARCHIVE_FROM.includes(status),
});

const assertTransition = (
  current: LearningProjectStatus,
  allowed: LearningProjectStatus[],
  actionLabel: string,
) => {
  if (!allowed.includes(current)) {
    throw new AppError(
      `Cannot ${actionLabel} while project status is ${current}.`,
      400,
      'INVALID_STATUS_TRANSITION',
      { status: current },
    );
  }
};

const loadProjectOrThrow = async (id: string) => {
  const project = await repository.findAdminLearningProjectById(id);
  if (!project) {
    throw new AppError('Learning project not found.', 404, 'NOT_FOUND');
  }
  return project;
};

const notifyAuthor = async (
  project: repository.AdminLearningProjectDetailRecord,
  title: string,
  body: string,
) => {
  await repository.createLearningProjectAuthorNotification({
    userId: project.createdBy,
    title,
    body,
    projectId: project.id,
  });
};

const logModeration = async (
  actorUserId: string,
  action: (typeof ADMIN_ACTIVITY_ACTIONS)[keyof typeof ADMIN_ACTIVITY_ACTIONS],
  project: repository.AdminLearningProjectDetailRecord,
  metadata: Record<string, unknown>,
) => {
  await logAdminActivity({
    actorUserId,
    action,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.LEARNING_PROJECT,
    targetId: project.id,
    targetLabel: project.title,
    metadata: metadata as Prisma.InputJsonValue,
  });
};

export const listAdminLearningProjects = async (
  query: AdminLearningProjectsListQuery,
) => {
  const [summary, categories, result] = await Promise.all([
    repository.countAdminLearningProjectsSummary(),
    repository.listProjectCategoriesForAdmin(),
    repository.listAdminLearningProjects(query),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / query.limit));

  return {
    summary,
    items: result.items.map(mapListItem),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages,
    },
    filterOptions: {
      statuses: [
        'DRAFT',
        'PENDING_REVIEW',
        'PUBLISHED',
        'CHANGES_REQUESTED',
        'REJECTED',
        'HIDDEN',
        'ARCHIVED',
      ],
      categories,
      difficulties: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'],
    },
  };
};

export const getAdminLearningProjectById = async (id: string) => {
  const project = await loadProjectOrThrow(id);
  return mapDetail(project);
};

const AI_REVIEW_ELIGIBLE_STATUSES: LearningProjectStatus[] = [
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
];

export const reviewAdminLearningProjectWithAi = async (
  id: string,
  input: AdminAiReviewBodyInput,
  generatedByAdminUserId: string,
) => {
  const project = await loadProjectOrThrow(id);

  if (!AI_REVIEW_ELIGIBLE_STATUSES.includes(project.status)) {
    throw new AppError(
      `AI review is not available while project status is ${project.status}.`,
      400,
      'AI_REVIEW_INELIGIBLE_STATUS',
      { status: project.status },
    );
  }

  const preProviderFingerprint = buildAdminReviewContentFingerprint(project);
  const { snapshot, coverage } = buildMinimizedAdminReviewSnapshot(project);

  let imageInputs: Awaited<ReturnType<typeof loadAdminReviewImageInputs>>['imageInputs'] =
    [];
  let visualCoverage: Awaited<ReturnType<typeof loadAdminReviewImageInputs>>['visualCoverage'];
  let release = () => {};

  try {
    const loaded = await loadAdminReviewImageInputs(project);
    imageInputs = loaded.imageInputs;
    visualCoverage = loaded.visualCoverage;
    release = loaded.release;
  } catch {
    const totalProjectImages = buildAdminReviewImageCandidates(project).length;
    visualCoverage = {
      totalProjectImages,
      includedImages: 0,
      noProjectImages: totalProjectImages === 0,
      visualCoverageUnavailable: totalProjectImages > 0,
      visualCoverageComplete: false,
    };
  }

  try {
    const providerResult = await executeAdminLearningProjectAiProviderReview(
      snapshot,
      coverage,
      input.locale,
      { imageInputs, visualCoverage },
    );
    const generatedAt = new Date();
    const review = appendVisualCoverageManualNote(
      providerResult.review,
      input.locale,
      visualCoverage,
    );

    await repository.persistAdminLearningProjectAiReviewGuarded({
      projectId: id,
      locale: input.locale,
      preProviderFingerprint,
      generatedByAdminUserId,
      generatedAt,
      provider: providerResult.provider,
      model: providerResult.model,
      coverage,
      review,
    });

    return {
      projectId: id,
      generatedAt: generatedAt.toISOString(),
      provider: providerResult.provider,
      model: providerResult.model,
      coverage,
      review,
    };
  } finally {
    release();
  }
};

export const getSavedAdminLearningProjectAiReview = async (
  id: string,
  input: AdminAiReviewBodyInput,
) => {
  const project = await loadProjectOrThrow(id);
  const currentFingerprint = buildAdminReviewContentFingerprint(project);
  const persisted = await repository.findPersistedAdminLearningProjectAiReview(
    id,
    input.locale,
  );

  if (!persisted) {
    return {
      projectId: id,
      locale: input.locale,
      savedReview: null,
    };
  }

  const { coverage, review, schemaVersion } = parsePersistedAdminAiReviewJson({
    reviewSchemaVersion: persisted.reviewSchemaVersion,
    coverage: persisted.coverage,
    review: persisted.review,
  });

  return {
    projectId: id,
    locale: input.locale,
    savedReview: {
      generatedAt: persisted.generatedAt.toISOString(),
      generatedByAdminUserId: persisted.generatedByAdminUserId,
      provider: persisted.provider,
      model: persisted.model,
      schemaVersion,
      coverage,
      review,
      isStale: persisted.contentFingerprint !== currentFingerprint,
    },
  };
};

export const approveAdminLearningProject = async (
  actorUserId: string,
  id: string,
) => {
  const project = await loadProjectOrThrow(id);
  assertTransition(project.status, APPROVE_FROM, 'approve');

  const quality = buildComponentQualityReport(project);
  if (!quality.canApprove) {
    throw new AppError(
      'Project cannot be approved until component quality issues are resolved.',
      400,
      'COMPONENT_QUALITY_HARD_ISSUES',
      {
        hardIssues: quality.hardIssues,
        softWarnings: quality.softWarnings,
      },
    );
  }

  const now = new Date();
  const updated = await repository.updateLearningProjectModeration(id, {
    status: 'PUBLISHED',
    reviewedAt: now,
    reviewNote: null,
    rejectionReason: null,
    changesRequestedReason: null,
    hiddenAt: null,
    hiddenBy: null,
    hiddenReason: null,
    archivedAt: null,
    archivedBy: null,
    archivedReason: null,
    ...connectReviewer(actorUserId),
  });

  await logModeration(actorUserId, ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_APPROVED, updated, {
    status: 'PUBLISHED',
    authorId: updated.createdBy,
  });
  await notifyAuthor(
    updated,
    'Learning project approved',
    `Your project "${updated.title}" was approved and is now published in the Learning Hub.`,
  );

  return mapDetail(updated);
};

export const requestChangesAdminLearningProject = async (
  actorUserId: string,
  id: string,
  input: ModerationReasonInput,
) => {
  const project = await loadProjectOrThrow(id);
  assertTransition(project.status, REQUEST_CHANGES_FROM, 'request changes');

  const now = new Date();
  const updated = await repository.updateLearningProjectModeration(id, {
    status: 'CHANGES_REQUESTED',
    reviewedAt: now,
    changesRequestedReason: input.reason,
    reviewNote: input.reason,
    ...connectReviewer(actorUserId),
  });

  await logModeration(
    actorUserId,
    ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_CHANGES_REQUESTED,
    updated,
    { status: 'CHANGES_REQUESTED', reason: input.reason },
  );
  await notifyAuthor(
    updated,
    'Changes requested for your project',
    `Your project "${updated.title}" needs changes before it can be published. Reason: ${input.reason}`,
  );

  return mapDetail(updated);
};

export const rejectAdminLearningProject = async (
  actorUserId: string,
  id: string,
  input: ModerationReasonInput,
) => {
  const project = await loadProjectOrThrow(id);
  assertTransition(project.status, REJECT_FROM, 'reject');

  const now = new Date();
  const updated = await repository.updateLearningProjectModeration(id, {
    status: 'REJECTED',
    reviewedAt: now,
    rejectionReason: input.reason,
    reviewNote: input.reason,
    ...connectReviewer(actorUserId),
  });

  await logModeration(actorUserId, ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_REJECTED, updated, {
    status: 'REJECTED',
    reason: input.reason,
  });
  await notifyAuthor(
    updated,
    'Learning project rejected',
    `Your project "${updated.title}" was not approved. Reason: ${input.reason}`,
  );

  return mapDetail(updated);
};

export const hideAdminLearningProject = async (
  actorUserId: string,
  id: string,
  input: ModerationReasonInput,
) => {
  const project = await loadProjectOrThrow(id);
  assertTransition(project.status, HIDE_FROM, 'hide');

  const now = new Date();
  const updated = await repository.updateLearningProjectModeration(id, {
    status: 'HIDDEN',
    hiddenAt: now,
    hiddenBy: actorUserId,
    hiddenReason: input.reason,
    reviewedAt: now,
    reviewNote: input.reason,
    ...connectReviewer(actorUserId),
  });

  await logModeration(actorUserId, ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_HIDDEN, updated, {
    status: 'HIDDEN',
    reason: input.reason,
  });
  await notifyAuthor(
    updated,
    'Learning project unpublished',
    `Your project "${updated.title}" was hidden from the Learning Hub. Reason: ${input.reason}`,
  );

  return mapDetail(updated);
};

export const restoreAdminLearningProject = async (
  actorUserId: string,
  id: string,
) => {
  const project = await loadProjectOrThrow(id);
  assertTransition(project.status, RESTORE_FROM, 'restore');

  const now = new Date();
  const updated = await repository.updateLearningProjectModeration(id, {
    status: 'PUBLISHED',
    reviewedAt: now,
    hiddenAt: null,
    hiddenBy: null,
    hiddenReason: null,
    archivedAt: null,
    archivedBy: null,
    archivedReason: null,
    ...connectReviewer(actorUserId),
  });

  await logModeration(actorUserId, ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_RESTORED, updated, {
    status: 'PUBLISHED',
  });
  await notifyAuthor(
    updated,
    'Learning project restored',
    `Your project "${updated.title}" is published again in the Learning Hub.`,
  );

  return mapDetail(updated);
};

export const archiveAdminLearningProject = async (
  actorUserId: string,
  id: string,
  input: ModerationReasonInput,
) => {
  const project = await loadProjectOrThrow(id);
  assertTransition(project.status, ARCHIVE_FROM, 'archive');

  const now = new Date();
  const updated = await repository.updateLearningProjectModeration(id, {
    status: 'ARCHIVED',
    archivedAt: now,
    archivedBy: actorUserId,
    archivedReason: input.reason,
    reviewedAt: now,
    reviewNote: input.reason,
    ...connectReviewer(actorUserId),
  });

  await logModeration(actorUserId, ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_ARCHIVED, updated, {
    status: 'ARCHIVED',
    reason: input.reason,
  });
  await notifyAuthor(
    updated,
    'Learning project archived',
    `Your project "${updated.title}" was archived and removed from the Learning Hub. Reason: ${input.reason}`,
  );

  return mapDetail(updated);
};

export const updateAdminLearningProjectComponent = async (
  actorUserId: string,
  projectId: string,
  componentId: string,
  input: UpdateAdminLearningProjectComponentInput,
) => {
  const project = await loadProjectOrThrow(projectId);
  assertEditableProjectStatus(project.status);

  const component = project.requiredComponents.find((item) => item.id === componentId);
  if (!component) {
    throw new AppError('Project component not found.', 404, 'NOT_FOUND');
  }

  if (input.componentName !== undefined) {
    assertUniqueComponentName(
      project.requiredComponents,
      componentId,
      input.componentName,
    );
  }

  const updateData = await buildComponentUpdateData(input, {
    componentName: component.componentName,
    materialType: component.materialType,
    reviewStatus: component.reviewStatus,
  });

  const updatedComponent = await repository.updateAdminLearningProjectComponent({
    projectId,
    componentId,
    data: updateData,
  });

  if (!updatedComponent) {
    throw new AppError('Project component not found.', 404, 'NOT_FOUND');
  }

  const refreshed = await loadProjectOrThrow(projectId);

  await logModeration(
    actorUserId,
    ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_COMPONENT_ENRICHED,
    refreshed,
    {
      componentId,
      changedFields: Object.keys(input),
    },
  );

  return mapDetail(refreshed);
};
