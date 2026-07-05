import { AppError } from '../../utils/app-error.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';
import {
  LEARNING_PROJECT_SUBMIT_SCOPE,
  runIdempotentOperation,
} from '../../services/idempotency.service.js';

import * as learningProjectsRepository from './learning-projects.repository.js';
import type {
  LearningProjectsQuery,
  SubmitLearningProjectInput,
} from './learning-projects.validation.js';

type SubmitLearningProjectResponse = {
  id: string;
  title: string;
  status: string;
  submittedAt: string | null;
  message: string;
};

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
  ratingSummary: null,
  likesCount: engagement.likesCount ?? 0,
  isLiked: engagement.isLiked ?? false,
  isSaved: engagement.isSaved ?? false,
  followersCount: engagement.followersCount ?? 0,
  isFollowing: engagement.isFollowing ?? false,
  createdAt: project.createdAt.toISOString(),
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
  ratingSummary: null,
  likesCount: engagement.likesCount ?? 0,
  isLiked: engagement.isLiked ?? false,
  isSaved: engagement.isSaved ?? false,
  followersCount: engagement.followersCount ?? 0,
  isFollowing: engagement.isFollowing ?? false,
  createdAt: project.createdAt.toISOString(),
});

export const getLearningProjects = async (
  query: LearningProjectsQuery,
  viewer?: AccessTokenPayload,
) => {
  const result = await learningProjectsRepository.findLearningProjects(query);
  const projectIds = result.items.map((item) => item.id);
  const [
    likesByProjectId,
    likedProjectIds,
    savedProjectIds,
    followsByProjectId,
    followedProjectIds,
  ] = await Promise.all([
    learningProjectsRepository.countLikesByProjectIds(projectIds),
    learningProjectsRepository.findLikedProjectIds(viewer?.sub, projectIds),
    learningProjectsRepository.findSavedProjectIds(viewer?.sub, projectIds),
    learningProjectsRepository.countFollowsByProjectIds(projectIds),
    learningProjectsRepository.findFollowedProjectIds(viewer?.sub, projectIds),
  ]);

  return {
    items: result.items.map((item) =>
      mapLearningProjectListItem(item, {
        likesCount: likesByProjectId.get(item.id) ?? 0,
        isLiked: likedProjectIds.has(item.id),
        isSaved: savedProjectIds.has(item.id),
        followersCount: followsByProjectId.get(item.id) ?? 0,
        isFollowing: followedProjectIds.has(item.id),
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
  ] = await Promise.all([
    learningProjectsRepository.countLikesByProjectIds([project.id]),
    learningProjectsRepository.findLikedProjectIds(viewer?.sub, [project.id]),
    learningProjectsRepository.findSavedProjectIds(viewer?.sub, [project.id]),
    learningProjectsRepository.countFollowsByProjectIds([project.id]),
    learningProjectsRepository.findFollowedProjectIds(viewer?.sub, [
      project.id,
    ]),
  ]);

  return mapLearningProjectDetail(project, {
    likesCount: likesByProjectId.get(project.id) ?? 0,
    isLiked: likedProjectIds.has(project.id),
    isSaved: savedProjectIds.has(project.id),
    followersCount: followsByProjectId.get(project.id) ?? 0,
    isFollowing: followedProjectIds.has(project.id),
  });
};

export const likeLearningProjectById = async (id: string, userId: string) => {
  const project = await learningProjectsRepository.findPublicLearningProjectById(
    id,
  );

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  await learningProjectsRepository.setProjectLiked(id, userId);
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
  const followersCount =
    await learningProjectsRepository.countFollowsForProject(id);

  return {
    projectId: id,
    followersCount,
    isFollowing: false,
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
          requiredComponents: input.requiredComponents,
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
