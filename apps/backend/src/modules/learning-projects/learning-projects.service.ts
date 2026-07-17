import { AppError } from '../../utils/app-error.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';
import {
  LEARNING_PROJECT_SUBMIT_SCOPE,
  runIdempotentOperation,
} from '../../services/idempotency.service.js';
import { invalidateLearnerHomeCache } from '../learner-home/learner-home.service.js';

import { getOrCreateBuildGuideConversation } from '../ai/ai.repository.js';

import * as learningProjectsRepository from './learning-projects.repository.js';
import {
  getBuildItemMaterialCandidates,
  linkBuildItemMaterial,
  mapLinkedMaterialSummary,
  mapLinkedReservationSummary,
  resolveBuildItemReadiness,
  resolveBuildItemStepUnlockReadiness,
  unlinkBuildItemMaterial,
} from './learning-projects.build-material-linking.js';
import type {
  LearningProjectsQuery,
  MyLearningProjectsQuery,
  ProjectReviewInput,
  SubmitLearningProjectInput,
  UpdateMyLearningProjectSubmissionInput,
  UpdateProjectBuildItemInput,
} from './learning-projects.validation.js';
import {
  assertUniqueSubmitComponentNames,
  normalizeSubmitComponent,
} from './learning-projects.submit-components.js';

type SubmitLearningProjectResponse = {
  id: string;
  title: string;
  status: string;
  submittedAt: string | null;
  message: string;
};

type ReviewSummary = {
  average: number;
  count: number;
};

type ProjectReviewRecord =
  Awaited<
    ReturnType<typeof learningProjectsRepository.findRecentReviewsForProject>
  >[number];

type ProjectBuildRecord = NonNullable<
  Awaited<ReturnType<typeof learningProjectsRepository.findProjectBuild>>
>;

const findBuildItem = (build: ProjectBuildRecord | null, itemId: string) =>
  build?.items.find((item) => item.id === itemId) ?? null;

const EDITABLE_SUBMISSION_STATUSES = new Set([
  'DRAFT',
  'CHANGES_REQUESTED',
  'PENDING_REVIEW',
]);

const decimalToSerializable = (value: { toNumber(): number } | number): number => {
  if (typeof value === 'number') {
    return value;
  }

  return value.toNumber();
};

const resolveAuthorName = (
  project: {
    createdByUser: {
      displayName: string;
      email: string;
    };
  },
) => project.createdByUser.displayName || project.createdByUser.email;

const mapCategory = (category: {
  id: string;
  nameEn: string;
  nameAr: string;
}) => ({
  id: category.id,
  nameEn: category.nameEn,
  nameAr: category.nameAr,
});

const mapRatingSummary = (summary: ReviewSummary | undefined) => {
  if (!summary || summary.count <= 0) {
    return null;
  }

  return {
    average: Math.round(summary.average * 10) / 10,
    count: summary.count,
  };
};

const mapProjectReview = (review: ProjectReviewRecord) => ({
  id: review.id,
  projectId: review.projectId,
  rating: review.rating,
  comment: review.comment,
  reviewerName: review.user.displayName || review.user.email,
  isViewerReview: false,
  createdAt: review.createdAt.toISOString(),
  updatedAt: review.updatedAt.toISOString(),
});

const mapLearningProjectListItem = (
  project: Awaited<
    ReturnType<typeof learningProjectsRepository.findLearningProjects>
  >['items'][number],
  engagement: {
    likesCount?: number;
    isLiked?: boolean;
    isSaved?: boolean;
    followersCount?: number;
    isFollowing?: boolean;
    ratingSummary?: ReviewSummary;
  } = {},
) => ({
  id: project.id,
  title: project.title,
  shortDescription: project.shortDescription,
  category: mapCategory(project.category),
  difficulty: project.difficulty,
  estimatedDurationMinutes: project.estimatedDurationMinutes,
  coverImageUrl: project.coverImageUrl,
  authorName: resolveAuthorName(project),
  tags: project.tags.map((tag) => tag.tag),
  ratingSummary: mapRatingSummary(engagement.ratingSummary),
  likesCount: engagement.likesCount ?? 0,
  isLiked: engagement.isLiked ?? false,
  isSaved: engagement.isSaved ?? false,
  followersCount: engagement.followersCount ?? 0,
  isFollowing: engagement.isFollowing ?? false,
  createdAt: project.createdAt.toISOString(),
});

const mapSubmissionActions = (status: string) => ({
  canView: true,
  canEdit: EDITABLE_SUBMISSION_STATUSES.has(status),
  canResubmit: status === 'CHANGES_REQUESTED',
  canViewPublic: status === 'PUBLISHED',
});

const mapMyLearningProjectSubmissionCard = (
  project: Awaited<
    ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissions>
  >['items'][number],
) => ({
  id: project.id,
  title: project.title,
  shortDescription: project.shortDescription,
  status: project.status,
  category: mapCategory(project.category),
  difficulty: project.difficulty,
  estimatedDurationMinutes: project.estimatedDurationMinutes,
  estimatedTimeMinutes: project.estimatedDurationMinutes,
  submittedAt: project.submittedAt?.toISOString() ?? null,
  reviewedAt: project.reviewedAt?.toISOString() ?? null,
  createdAt: project.createdAt.toISOString(),
  updatedAt: project.updatedAt.toISOString(),
  changesRequestedReason:
    project.status === 'CHANGES_REQUESTED'
      ? project.changesRequestedReason
      : null,
  rejectionReason:
    project.status === 'REJECTED' ? project.rejectionReason : null,
  publicProjectPath:
    project.status === 'PUBLISHED' ? `/learning/${project.id}` : null,
  canViewPublic: project.status === 'PUBLISHED',
  availableActions: mapSubmissionActions(project.status),
});

const jsonStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

const mapMyLearningProjectSubmissionDetail = (
  project: NonNullable<
    Awaited<
      ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>
    >
  >,
) => ({
  ...mapMyLearningProjectSubmissionCard(project),
  description: project.description,
  coverImageUrl: project.coverImageUrl,
  reviewNote: project.reviewNote,
  changesRequestedReason: project.changesRequestedReason,
  rejectionReason: project.rejectionReason,
  requiredComponents: project.requiredComponents.map((component) => ({
    id: component.id,
    categoryId: component.categoryId,
    componentName: component.componentName,
    name: component.componentName,
    materialType: component.materialType,
    quantity: decimalToSerializable(component.quantity),
    unit: component.unit,
    componentRole: component.componentRole,
    isRequired: component.isRequired,
    canBeSubstituted: component.canBeSubstituted,
    searchKeywords: jsonStringList(component.searchKeywords),
    alternativeKeywords: jsonStringList(component.alternativeKeywords),
    providedByUser: component.providedByUser,
    confirmedByUser: component.confirmedByUser,
    generatedOrSuggestedByAi: component.generatedOrSuggestedByAi,
    reviewStatus: component.reviewStatus,
    notes: component.notes,
  })),
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
});

const mapLearningProjectDetail = (
  project: NonNullable<
    Awaited<ReturnType<typeof learningProjectsRepository.findLearningProjectById>>
  >,
  engagement: {
    likesCount?: number;
    isLiked?: boolean;
    isSaved?: boolean;
    followersCount?: number;
    isFollowing?: boolean;
    ratingSummary?: ReviewSummary;
    recentReviews?: ProjectReviewRecord[];
    viewerReview?: ProjectReviewRecord | null;
  } = {},
) => ({
  id: project.id,
  title: project.title,
  shortDescription: project.shortDescription,
  description: project.description,
  category: mapCategory(project.category),
  difficulty: project.difficulty,
  estimatedDurationMinutes: project.estimatedDurationMinutes,
  coverImageUrl: project.coverImageUrl,
  authorName: resolveAuthorName(project),
  images: project.images.map((image) => ({
    id: image.id,
    imageUrl: image.imageUrl,
    sortOrder: image.sortOrder,
  })),
  requiredComponents: project.requiredComponents.map((component) => ({
    id: component.id,
    categoryId: component.categoryId,
    componentName: component.componentName,
    materialType: component.materialType,
    quantity: decimalToSerializable(component.quantity),
    unit: component.unit,
    componentRole: component.componentRole,
    isRequired: component.isRequired,
    canBeSubstituted: component.canBeSubstituted,
    notes: component.notes,
  })),
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
  ratingSummary: mapRatingSummary(engagement.ratingSummary),
  recentReviews: (engagement.recentReviews ?? []).map((review) => ({
    ...mapProjectReview(review),
    isViewerReview: review.id === engagement.viewerReview?.id,
  })),
  viewerReview: engagement.viewerReview
    ? {
        ...mapProjectReview(engagement.viewerReview),
        isViewerReview: true,
      }
    : null,
  likesCount: engagement.likesCount ?? 0,
  isLiked: engagement.isLiked ?? false,
  isSaved: engagement.isSaved ?? false,
  followersCount: engagement.followersCount ?? 0,
  isFollowing: engagement.isFollowing ?? false,
  createdAt: project.createdAt.toISOString(),
});

const summarizeMaterialReadiness = (
  items: Array<{
    isReadyForBuild: boolean;
    status: string;
    linkedMaterial: unknown;
    linkedReservation: unknown;
  }>,
) => {
  let ready = 0;
  let linked = 0;
  let reserved = 0;
  let missing = 0;

  for (const item of items) {
    if (item.isReadyForBuild) {
      ready += 1;
      continue;
    }

    if (item.linkedReservation != null || item.status === 'RESERVED') {
      reserved += 1;
      continue;
    }

    if (item.linkedMaterial != null) {
      linked += 1;
      continue;
    }

    missing += 1;
  }

  return {
    ready,
    linked,
    reserved,
    missing,
    total: items.length,
  };
};

type DerivedBuildStepState = 'LOCKED' | 'CURRENT' | 'COMPLETED';

const deriveBuildStepViews = (input: {
  projectSteps: ProjectBuildRecord['project']['steps'];
  stepProgress: ProjectBuildRecord['stepProgress'];
  allMaterialsReady: boolean;
  buildStatus: ProjectBuildRecord['status'];
}) => {
  const completedAtByStepId = new Map(
    input.stepProgress
      .filter((row) => row.completedAt != null)
      .map((row) => [row.projectStepId, row.completedAt!.toISOString()]),
  );
  const total = input.projectSteps.length;
  const completed = input.projectSteps.filter((step) =>
    completedAtByStepId.has(step.id),
  ).length;
  const firstIncomplete = input.projectSteps.find(
    (step) => !completedAtByStepId.has(step.id),
  );

  if (!input.allMaterialsReady || total === 0) {
    return {
      steps: input.projectSteps.map((step) => ({
        stepId: step.id,
        stepNumber: step.stepNumber,
        title: step.title,
        description: step.description,
        imageUrl: step.imageUrl,
        state: (completedAtByStepId.has(step.id)
          ? 'COMPLETED'
          : 'LOCKED') as DerivedBuildStepState,
        completedAt: completedAtByStepId.get(step.id) ?? null,
      })),
      currentStep: null,
      completed,
      total,
      percent: 0,
      nextAction: total === 0 ? null : ('PREPARE_MATERIALS' as const),
    };
  }

  if (input.buildStatus === 'COMPLETED' || !firstIncomplete) {
    return {
      steps: input.projectSteps.map((step) => ({
        stepId: step.id,
        stepNumber: step.stepNumber,
        title: step.title,
        description: step.description,
        imageUrl: step.imageUrl,
        state: 'COMPLETED' as DerivedBuildStepState,
        completedAt: completedAtByStepId.get(step.id) ?? null,
      })),
      currentStep: null,
      completed: total,
      total,
      percent: 100,
      nextAction: 'BUILD_COMPLETED' as const,
    };
  }

  return {
    steps: input.projectSteps.map((step) => {
      const completedAt = completedAtByStepId.get(step.id) ?? null;
      let state: DerivedBuildStepState = 'LOCKED';

      if (completedAt) {
        state = 'COMPLETED';
      } else if (step.id === firstIncomplete.id) {
        state = 'CURRENT';
      }

      return {
        stepId: step.id,
        stepNumber: step.stepNumber,
        title: step.title,
        description: step.description,
        imageUrl: step.imageUrl,
        state,
        completedAt,
      };
    }),
    currentStep: {
      stepId: firstIncomplete.id,
      stepNumber: firstIncomplete.stepNumber,
      title: firstIncomplete.title,
    },
    completed,
    total,
    percent: Math.round((completed / total) * 100),
    nextAction: 'COMPLETE_CURRENT_STEP' as const,
  };
};

const mapProjectBuildItem = (
  item: ProjectBuildRecord['items'][number],
) => {
  const readiness = resolveBuildItemReadiness({
    status: item.status,
    linkedReservation: item.linkedReservation,
    linkedMaterial: item.linkedMaterial,
  });

  return {
    id: item.id,
    requiredComponentId: item.requiredComponentId,
    status: item.status,
    learnerNote: item.learnerNote,
    linkedMaterial: mapLinkedMaterialSummary(item.linkedMaterial),
    linkedReservation: mapLinkedReservationSummary(item.linkedReservation),
    isReadyForBuild: readiness.isReadyForBuild,
    readinessLabel: readiness.readinessLabel,
    component: {
      id: item.requiredComponent.id,
      categoryId: item.requiredComponent.categoryId,
      category: item.requiredComponent.category
        ? mapCategory(item.requiredComponent.category)
        : null,
      componentName: item.requiredComponent.componentName,
      materialType: item.requiredComponent.materialType,
      quantity: decimalToSerializable(item.requiredComponent.quantity),
      unit: item.requiredComponent.unit,
      componentRole: item.requiredComponent.componentRole,
      isRequired: item.requiredComponent.isRequired,
      canBeSubstituted: item.requiredComponent.canBeSubstituted,
      notes: item.requiredComponent.notes,
    },
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
};

const mapProjectBuild = (build: ProjectBuildRecord) => {
  const mappedItems = build.items.map((item) => mapProjectBuildItem(item));
  const readyItems = mappedItems.filter((item) => item.isReadyForBuild);
  const totalItems = mappedItems.length;
  const allMaterialsReadyForSteps =
    totalItems > 0 &&
    build.items.every((item) =>
      resolveBuildItemStepUnlockReadiness({
        status: item.status,
        linkedReservation: item.linkedReservation,
        linkedMaterial: item.linkedMaterial,
      }).isReadyForStepUnlock,
    );
  const materialReadiness = summarizeMaterialReadiness(mappedItems);
  const stepViews = deriveBuildStepViews({
    projectSteps: build.project.steps,
    stepProgress: build.stepProgress,
    allMaterialsReady: allMaterialsReadyForSteps,
    buildStatus: build.status,
  });

  return {
    id: build.id,
    projectId: build.projectId,
    learnerId: build.learnerId,
    status: build.status,
    startedAt: build.startedAt.toISOString(),
    completedAt: build.completedAt?.toISOString() ?? null,
    createdAt: build.createdAt.toISOString(),
    updatedAt: build.updatedAt.toISOString(),
    project: {
      id: build.project.id,
      title: build.project.title,
      shortDescription: build.project.shortDescription,
      coverImageUrl: build.project.coverImageUrl,
    },
    progress: {
      total: totalItems,
      ready: readyItems.length,
      percent:
        totalItems === 0 ? 0 : Math.round((readyItems.length / totalItems) * 100),
    },
    materialReadiness,
    stepProgress: {
      completed: stepViews.completed,
      total: stepViews.total,
      percent: stepViews.percent,
      currentStep: stepViews.currentStep,
      nextAction: stepViews.nextAction,
      steps: stepViews.steps,
    },
    items: mappedItems,
  };
};

const hydrateLearnerProjectBuild = async (
  build: ProjectBuildRecord,
  learnerId: string,
) => {
  const guideConversation =
    await learningProjectsRepository.findGuideConversationIdForBuild(
      learnerId,
      build.id,
    );

  return {
    ...mapProjectBuild(build),
    guideConversationId: guideConversation?.id ?? null,
  };
};

export const getLearningProjects = async (
  query: LearningProjectsQuery,
  viewer?: AccessTokenPayload,
) => {
  const result = await learningProjectsRepository.findLearningProjects(query);

  return mapLearningProjectListResult(result, query, viewer);
};

export const getSavedLearningProjects = async (
  query: LearningProjectsQuery,
  viewer: AccessTokenPayload,
) => {
  const result = await learningProjectsRepository.findSavedLearningProjects(
    query,
    viewer.sub,
  );

  return mapLearningProjectListResult(result, query, viewer);
};

export const getFollowedLearningProjects = async (
  query: LearningProjectsQuery,
  viewer: AccessTokenPayload,
) => {
  const result = await learningProjectsRepository.findFollowedLearningProjects(
    query,
    viewer.sub,
  );

  return mapLearningProjectListResult(result, query, viewer);
};

export const getMyLearningProjectSubmissions = async (
  query: MyLearningProjectsQuery,
  userId: string,
) => {
  const result =
    await learningProjectsRepository.findMyLearningProjectSubmissions(
      query,
      userId,
    );

  return {
    items: result.items.map(mapMyLearningProjectSubmissionCard),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
    },
  };
};

export const getMyLearningProjectSubmissionById = async (
  id: string,
  userId: string,
) => {
  const project =
    await learningProjectsRepository.findMyLearningProjectSubmissionById(
      id,
      userId,
    );

  if (!project) {
    throw new AppError('Learning project submission not found', 404, 'NOT_FOUND');
  }

  return mapMyLearningProjectSubmissionDetail(project);
};

const validateLearningProjectSubmissionInput = async (
  input: SubmitLearningProjectInput | UpdateMyLearningProjectSubmissionInput,
) => {
  const category = await learningProjectsRepository.findProjectCategoryForSubmit(
    input.categoryId,
  );

  if (!category) {
    throw new AppError(
      'Project category not found or inactive.',
      400,
      'INVALID_CATEGORY',
    );
  }

  if (input.requiredComponents?.length) {
    assertUniqueSubmitComponentNames(input.requiredComponents);
  }

  const normalizedComponents = (input.requiredComponents ?? []).map(
    (component) => ({
      id:
        'id' in component && typeof component.id === 'string'
          ? component.id
          : undefined,
      component: normalizeSubmitComponent(component),
    }),
  );
  const componentCategoryIds = [
    ...new Set(
      normalizedComponents
        .map((entry) => entry.component.categoryId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  if (componentCategoryIds.length > 0) {
    const validCategories =
      await learningProjectsRepository.findMaterialCategoriesForSubmit(
        componentCategoryIds,
      );
    const validCategoryIds = new Set(validCategories.map((entry) => entry.id));
    const invalidCategoryId = componentCategoryIds.find(
      (categoryId) => !validCategoryIds.has(categoryId),
    );

    if (invalidCategoryId) {
      throw new AppError(
        'Component material category must be an active MATERIAL or BOTH category.',
        400,
        'INVALID_COMPONENT_CATEGORY',
      );
    }
  }

  return normalizedComponents;
};

export const updateMyLearningProjectSubmissionById = async (
  id: string,
  userId: string,
  input: UpdateMyLearningProjectSubmissionInput,
) => {
  const project =
    await learningProjectsRepository.findMyLearningProjectSubmissionById(
      id,
      userId,
    );

  if (!project) {
    throw new AppError('Learning project submission not found', 404, 'NOT_FOUND');
  }

  if (!EDITABLE_SUBMISSION_STATUSES.has(project.status)) {
    throw new AppError(
      'This project submission cannot be edited in its current status.',
      409,
      'PROJECT_NOT_EDITABLE',
      { status: project.status },
    );
  }

  const normalizedComponents =
    await validateLearningProjectSubmissionInput(input);

  const updated = await learningProjectsRepository.updateMyLearningProjectSubmission({
    id,
    userId,
    categoryId: input.categoryId,
    title: input.title,
    shortDescription: input.shortDescription,
    description: input.description,
    difficulty: input.difficulty,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    coverImageUrl: input.coverImageUrl,
    requiredComponents:
      input.requiredComponents === undefined ? undefined : normalizedComponents,
    steps: input.steps,
    links: input.links,
  });

  if (!updated) {
    const latest =
      await learningProjectsRepository.findMyLearningProjectSubmissionById(
        id,
        userId,
      );

    if (!latest) {
      throw new AppError('Learning project submission not found', 404, 'NOT_FOUND');
    }

    if (!EDITABLE_SUBMISSION_STATUSES.has(latest.status)) {
      throw new AppError(
        'This project submission cannot be edited in its current status.',
        409,
        'PROJECT_NOT_EDITABLE',
        { status: latest.status },
      );
    }

    throw new AppError(
      'This project submission changed while you were editing. Refresh and try again.',
      409,
      'PROJECT_NOT_EDITABLE',
      { status: latest.status },
    );
  }

  return mapMyLearningProjectSubmissionDetail(updated);
};

export const resubmitMyLearningProjectSubmissionById = async (
  id: string,
  userId: string,
) => {
  const project =
    await learningProjectsRepository.findMyLearningProjectSubmissionById(
      id,
      userId,
    );

  if (!project) {
    throw new AppError('Learning project submission not found', 404, 'NOT_FOUND');
  }

  if (project.status !== 'CHANGES_REQUESTED') {
    throw new AppError(
      'Only submissions with requested changes can be resubmitted.',
      409,
      'PROJECT_NOT_RESUBMITTABLE',
      { status: project.status },
    );
  }

  await validateLearningProjectSubmissionInput({
    title: project.title,
    shortDescription: project.shortDescription,
    description: project.description,
    categoryId: project.categoryId,
    difficulty: project.difficulty,
    estimatedDurationMinutes: project.estimatedDurationMinutes ?? undefined,
    coverImageUrl: project.coverImageUrl,
    requiredComponents: project.requiredComponents.map((component) => ({
      id: component.id,
      name: component.componentName,
      quantity: decimalToSerializable(component.quantity),
      unit: component.unit,
      notes: component.notes ?? undefined,
      isRequired: component.isRequired,
      componentRole:
        component.componentRole === 'OPTIONAL_MATERIAL' ||
        component.componentRole === 'ALTERNATIVE'
          ? 'REQUIRED_MATERIAL'
          : component.componentRole,
      materialType: component.materialType,
      categoryId: component.categoryId ?? undefined,
      searchKeywords: jsonStringList(component.searchKeywords),
      canBeSubstituted: component.canBeSubstituted,
    })),
    steps: project.steps.map((step) => ({
      title: step.title,
      description: step.description,
    })),
    links: project.links.map((link) => ({
      url: link.url,
      title: link.title ?? undefined,
    })),
  });

  const result =
    await learningProjectsRepository.resubmitMyLearningProjectSubmission(
      id,
      userId,
    );

  if (result.count === 0) {
    throw new AppError(
      'Only submissions with requested changes can be resubmitted.',
      409,
      'PROJECT_NOT_RESUBMITTABLE',
      { status: project.status },
    );
  }

  return getMyLearningProjectSubmissionById(id, userId);
};

const mapLearningProjectListResult = async (
  result: Awaited<
    ReturnType<typeof learningProjectsRepository.findLearningProjects>
  >,
  query: LearningProjectsQuery,
  viewer?: AccessTokenPayload,
) => {
  const projectIds = result.items.map((item) => item.id);
  const [
    likesByProjectId,
    likedProjectIds,
    savedProjectIds,
    followsByProjectId,
    followedProjectIds,
    reviewSummariesByProjectId,
  ] = await Promise.all([
    learningProjectsRepository.countLikesByProjectIds(projectIds),
    learningProjectsRepository.findLikedProjectIds(viewer?.sub, projectIds),
    learningProjectsRepository.findSavedProjectIds(viewer?.sub, projectIds),
    learningProjectsRepository.countFollowsByProjectIds(projectIds),
    learningProjectsRepository.findFollowedProjectIds(viewer?.sub, projectIds),
    learningProjectsRepository.summarizeReviewsByProjectIds(projectIds),
  ]);

  return {
    items: result.items.map((item) =>
      mapLearningProjectListItem(item, {
        likesCount: likesByProjectId.get(item.id) ?? 0,
        isLiked: likedProjectIds.has(item.id),
        isSaved: savedProjectIds.has(item.id),
        followersCount: followsByProjectId.get(item.id) ?? 0,
        isFollowing: followedProjectIds.has(item.id),
        ratingSummary: reviewSummariesByProjectId.get(item.id),
      }),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
    },
  };
};

export const getLearningProjectById = async (
  id: string,
  viewer?: AccessTokenPayload,
) => {
  const project = await learningProjectsRepository.findLearningProjectById(id);

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  const [
    likesByProjectId,
    likedProjectIds,
    savedProjectIds,
    followsByProjectId,
    followedProjectIds,
    reviewSummariesByProjectId,
    recentReviews,
    viewerReview,
  ] = await Promise.all([
    learningProjectsRepository.countLikesByProjectIds([project.id]),
    learningProjectsRepository.findLikedProjectIds(viewer?.sub, [project.id]),
    learningProjectsRepository.findSavedProjectIds(viewer?.sub, [project.id]),
    learningProjectsRepository.countFollowsByProjectIds([project.id]),
    learningProjectsRepository.findFollowedProjectIds(viewer?.sub, [
      project.id,
    ]),
    learningProjectsRepository.summarizeReviewsByProjectIds([project.id]),
    learningProjectsRepository.findRecentReviewsForProject(project.id),
    learningProjectsRepository.findReviewForViewer(project.id, viewer?.sub),
  ]);

  return mapLearningProjectDetail(project, {
    likesCount: likesByProjectId.get(project.id) ?? 0,
    isLiked: likedProjectIds.has(project.id),
    isSaved: savedProjectIds.has(project.id),
    followersCount: followsByProjectId.get(project.id) ?? 0,
    isFollowing: followedProjectIds.has(project.id),
    ratingSummary: reviewSummariesByProjectId.get(project.id),
    recentReviews,
    viewerReview,
  });
};

export const getMyProjectBuildById = async (
  id: string,
  userId: string,
) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  const build = await learningProjectsRepository.findProjectBuild(id, userId);

  return build ? hydrateLearnerProjectBuild(build, userId) : null;
};

export const getOwnedProjectBuildByBuildId = async (
  buildId: string,
  userId: string,
) => {
  const build = await learningProjectsRepository.findOwnedProjectBuildByBuildId(
    buildId,
    userId,
  );

  return build ? mapProjectBuild(build) : null;
};

export const listActiveProjectBuildsForLearner = async (userId: string) => {
  const builds =
    await learningProjectsRepository.findActiveProjectBuildsForLearner(userId);

  return builds.map((build) => mapProjectBuild(build));
};

export const startProjectBuildById = async (
  id: string,
  userId: string,
) => {
  const existingBuild = await learningProjectsRepository.findProjectBuild(
    id,
    userId,
  );
  const build = await learningProjectsRepository.startProjectBuild(id, userId);

  if (!build) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  if (!existingBuild || existingBuild.items.length !== build.items.length) {
    invalidateLearnerHomeCache(userId);
  }

  return hydrateLearnerProjectBuild(build, userId);
};

export const updateProjectBuildItemById = async (
  id: string,
  userId: string,
  itemId: string,
  input: UpdateProjectBuildItemInput,
) => {
  const previousItem = findBuildItem(
    await learningProjectsRepository.findProjectBuild(id, userId),
    itemId,
  );
  const build = await learningProjectsRepository.updateProjectBuildItem({
    projectId: id,
    learnerId: userId,
    itemId,
    status: input.status,
    learnerNote: input.learnerNote ?? null,
  });

  if (!build) {
    throw new AppError('Project build item not found', 404, 'NOT_FOUND');
  }

  if (previousItem?.status !== findBuildItem(build, itemId)?.status) {
    invalidateLearnerHomeCache(userId);
  }

  return hydrateLearnerProjectBuild(build, userId);
};

export const getBuildItemMaterialCandidatesById = async (
  projectId: string,
  userId: string,
  itemId: string,
) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    projectId,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  return getBuildItemMaterialCandidates({
    projectId,
    learnerId: userId,
    itemId,
  });
};

export const linkBuildItemMaterialById = async (
  projectId: string,
  userId: string,
  itemId: string,
  materialId: string,
) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    projectId,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  const previousItem = findBuildItem(
    await learningProjectsRepository.findProjectBuild(projectId, userId),
    itemId,
  );

  const build = await linkBuildItemMaterial({
    projectId,
    learnerId: userId,
    itemId,
    materialId,
  });

  if (
    previousItem?.linkedMaterialId !==
    findBuildItem(build, itemId)?.linkedMaterialId
  ) {
    invalidateLearnerHomeCache(userId);
  }

  return hydrateLearnerProjectBuild(build, userId);
};

export const unlinkBuildItemMaterialById = async (
  projectId: string,
  userId: string,
  itemId: string,
) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    projectId,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  const previousItem = findBuildItem(
    await learningProjectsRepository.findProjectBuild(projectId, userId),
    itemId,
  );

  const build = await unlinkBuildItemMaterial({
    projectId,
    learnerId: userId,
    itemId,
  });

  const updatedItem = findBuildItem(build, itemId);
  if (
    previousItem?.linkedMaterialId !== updatedItem?.linkedMaterialId ||
    previousItem?.linkedReservationId !== updatedItem?.linkedReservationId
  ) {
    invalidateLearnerHomeCache(userId);
  }

  return hydrateLearnerProjectBuild(build, userId);
};

export const linkBuildItemReservationById = async (
  projectId: string,
  userId: string,
  itemId: string,
  reservationId: string,
) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    projectId,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  const previousItem = findBuildItem(
    await learningProjectsRepository.findProjectBuild(projectId, userId),
    itemId,
  );

  const build = await learningProjectsRepository.linkBuildItemReservation({
    projectId,
    learnerId: userId,
    itemId,
    reservationId,
  });

  if (!build) {
    throw new AppError('Project build not found', 404, 'NOT_FOUND');
  }

  if (
    previousItem?.linkedReservationId !==
    findBuildItem(build, itemId)?.linkedReservationId
  ) {
    invalidateLearnerHomeCache(userId);
  }

  return hydrateLearnerProjectBuild(build, userId);
};

export const likeLearningProjectById = async (id: string, userId: string) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  await learningProjectsRepository.setProjectLiked(id, userId);
  invalidateLearnerHomeCache(userId);
  const likesCount = await learningProjectsRepository.countLikesForProject(id);

  return {
    projectId: id,
    likesCount,
    isLiked: true,
  };
};

export const unlikeLearningProjectById = async (id: string, userId: string) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  await learningProjectsRepository.unsetProjectLiked(id, userId);
  invalidateLearnerHomeCache(userId);
  const likesCount = await learningProjectsRepository.countLikesForProject(id);

  return {
    projectId: id,
    likesCount,
    isLiked: false,
  };
};

export const saveLearningProjectById = async (id: string, userId: string) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  await learningProjectsRepository.setProjectSaved(id, userId);
  invalidateLearnerHomeCache(userId);

  return {
    projectId: id,
    isSaved: true,
  };
};

export const unsaveLearningProjectById = async (id: string, userId: string) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  await learningProjectsRepository.unsetProjectSaved(id, userId);
  invalidateLearnerHomeCache(userId);

  return {
    projectId: id,
    isSaved: false,
  };
};

export const followLearningProjectById = async (id: string, userId: string) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  await learningProjectsRepository.setProjectFollowed(id, userId);
  invalidateLearnerHomeCache(userId);
  const followersCount =
    await learningProjectsRepository.countFollowsForProject(id);

  return {
    projectId: id,
    followersCount,
    isFollowing: true,
  };
};

export const unfollowLearningProjectById = async (
  id: string,
  userId: string,
) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  await learningProjectsRepository.unsetProjectFollowed(id, userId);
  invalidateLearnerHomeCache(userId);
  const followersCount =
    await learningProjectsRepository.countFollowsForProject(id);

  return {
    projectId: id,
    followersCount,
    isFollowing: false,
  };
};

export const reviewLearningProjectById = async (
  id: string,
  userId: string,
  input: ProjectReviewInput,
) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  const review = await learningProjectsRepository.upsertProjectReview({
    projectId: id,
    userId,
    rating: input.rating,
    comment: input.comment ?? null,
  });
  const summaries = await learningProjectsRepository.summarizeReviewsByProjectIds(
    [id],
  );

  return {
    projectId: id,
    review: {
      ...mapProjectReview(review),
      isViewerReview: true,
    },
    ratingSummary: mapRatingSummary(summaries.get(id)),
  };
};

export const deleteLearningProjectReviewById = async (
  id: string,
  userId: string,
) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  await learningProjectsRepository.deleteProjectReview(id, userId);
  const summaries = await learningProjectsRepository.summarizeReviewsByProjectIds(
    [id],
  );

  return {
    projectId: id,
    viewerReview: null,
    ratingSummary: mapRatingSummary(summaries.get(id)),
  };
};

export const submitLearningProjectForReview = async (
  userId: string,
  input: SubmitLearningProjectInput,
  idempotencyKey: string,
) => {
  const category = await learningProjectsRepository.findProjectCategoryForSubmit(
    input.categoryId,
  );

  if (!category) {
    throw new AppError(
      'Project category not found or inactive.',
      400,
      'INVALID_CATEGORY',
    );
  }

  if (input.requiredComponents?.length) {
    assertUniqueSubmitComponentNames(input.requiredComponents);
  }

  const normalizedComponents = (input.requiredComponents ?? []).map((component) =>
    normalizeSubmitComponent(component),
  );
  const componentCategoryIds = [
    ...new Set(
      normalizedComponents
        .map((component) => component.categoryId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  if (componentCategoryIds.length > 0) {
    const validCategories =
      await learningProjectsRepository.findMaterialCategoriesForSubmit(
        componentCategoryIds,
      );
    const validCategoryIds = new Set(validCategories.map((entry) => entry.id));
    const invalidCategoryId = componentCategoryIds.find(
      (categoryId) => !validCategoryIds.has(categoryId),
    );

    if (invalidCategoryId) {
      throw new AppError(
        'Component material category must be an active MATERIAL or BOTH category.',
        400,
        'INVALID_COMPONENT_CATEGORY',
      );
    }
  }

  return runIdempotentOperation<SubmitLearningProjectResponse>({
    userId,
    scope: LEARNING_PROJECT_SUBMIT_SCOPE,
    key: idempotencyKey,
    payload: input,
    resourceType: 'LEARNING_PROJECT',
    getResourceId: (response) => response.id,
    handler: async (tx) => {
      const project =
        await learningProjectsRepository.createLearningProjectForReview({
          createdBy: userId,
          categoryId: input.categoryId,
          title: input.title,
          shortDescription: input.shortDescription,
          description: input.description,
          difficulty: input.difficulty,
          estimatedDurationMinutes: input.estimatedDurationMinutes,
          coverImageUrl: input.coverImageUrl,
          requiredComponents: normalizedComponents,
          steps: input.steps,
          links: input.links,
          client: tx,
        });

      return {
        id: project.id,
        title: project.title,
        status: project.status,
        submittedAt: project.submittedAt?.toISOString() ?? null,
        message: 'Your project was submitted for admin review.',
      };
    },
  });
};

export const completeProjectBuildStepById = async (
  projectId: string,
  userId: string,
  stepId: string,
) => {
  const result = await learningProjectsRepository.completeProjectBuildStep({
    projectId,
    learnerId: userId,
    stepId,
  });

  const build = await learningProjectsRepository.findProjectBuild(
    projectId,
    userId,
  );

  if (!build) {
    throw new AppError('Project build not found', 404, 'BUILD_NOT_FOUND');
  }

  if (!result.noOp) {
    invalidateLearnerHomeCache(userId);
  }

  return hydrateLearnerProjectBuild(build, userId);
};

export const getOrCreateBuildGuideConversationByProjectId = async (
  projectId: string,
  userId: string,
  locale = 'en',
) => {
  const build = await learningProjectsRepository.findProjectBuild(
    projectId,
    userId,
  );

  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  const mappedBuild = mapProjectBuild(build);
  const conversation = await getOrCreateBuildGuideConversation({
    userId,
    projectBuildId: build.id,
    locale,
    projectTitle: build.project.title,
  });

  return {
    conversation: {
      id: conversation.id,
      kind: 'BUILD_GUIDE' as const,
      locale: conversation.locale,
      title: conversation.title,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
    },
    buildContext: {
      buildId: build.id,
      projectId: build.projectId,
      projectTitle: build.project.title,
      buildStatus: build.status,
      materialReadiness: mappedBuild.materialReadiness,
      currentStep: mappedBuild.stepProgress.currentStep,
      stepProgress: {
        completed: mappedBuild.stepProgress.completed,
        total: mappedBuild.stepProgress.total,
        percent: mappedBuild.stepProgress.percent,
      },
    },
  };
};
