import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import {
  isAllowedBuildCompletionImageMime,
  publicBuildCompletionImageUrl,
} from './build-completion-uploads.storage.js';

export const COMPLETION_STORY_MAX_REFLECTION_LENGTH = 3000;
export const COMPLETION_STORY_MAX_CAPTION_LENGTH = 120;
export const COMPLETION_STORY_MAX_PHOTOS = 6;

const mapCompletionPhoto = (photo: {
  id: string;
  imageUrl: string;
  caption: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: photo.id,
  imageUrl: photo.imageUrl,
  caption: photo.caption,
  sortOrder: photo.sortOrder,
  createdAt: photo.createdAt.toISOString(),
  updatedAt: photo.updatedAt.toISOString(),
});

export const mapCompletionStory = (
  story: Prisma.ProjectBuildCompletionStoryGetPayload<{
    include: { photos: true };
  }> | null,
) => {
  if (!story) {
    return null;
  }

  return {
    reflection: story.reflection,
    caption: story.caption,
    updatedAt: story.updatedAt.toISOString(),
    photos: story.photos
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(mapCompletionPhoto),
  };
};

const assertBuildOwnerCanEditStory = async (buildId: string, learnerId: string) => {
  const build = await prisma.projectBuild.findFirst({
    where: { id: buildId, learnerId },
    select: { id: true, status: true },
  });

  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  if (build.status !== 'COMPLETED') {
    throw new AppError(
      'Completion story is only available for completed builds.',
      409,
      'BUILD_NOT_COMPLETED',
    );
  }

  return build;
};

export const getProjectBuildCompletionStory = async (
  buildId: string,
  learnerId: string,
) => {
  const build = await prisma.projectBuild.findFirst({
    where: { id: buildId, learnerId },
    select: { id: true, status: true },
  });

  if (!build) {
    throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
  }

  const story = await prisma.projectBuildCompletionStory.findUnique({
    where: { buildId },
    include: {
      photos: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return mapCompletionStory(story);
};

export const upsertProjectBuildCompletionStory = async (
  buildId: string,
  learnerId: string,
  input: { reflection?: string | null; caption?: string | null },
) => {
  await assertBuildOwnerCanEditStory(buildId, learnerId);

  if (
    input.reflection != null &&
    input.reflection.length > COMPLETION_STORY_MAX_REFLECTION_LENGTH
  ) {
    throw new AppError(
      `Reflection must be at most ${COMPLETION_STORY_MAX_REFLECTION_LENGTH} characters.`,
      400,
      'VALIDATION_ERROR',
    );
  }

  if (
    input.caption != null &&
    input.caption.length > COMPLETION_STORY_MAX_CAPTION_LENGTH
  ) {
    throw new AppError(
      `Caption must be at most ${COMPLETION_STORY_MAX_CAPTION_LENGTH} characters.`,
      400,
      'VALIDATION_ERROR',
    );
  }

  const story = await prisma.projectBuildCompletionStory.upsert({
    where: { buildId },
    create: {
      buildId,
      reflection: input.reflection ?? null,
      caption: input.caption ?? null,
    },
    update: {
      ...(input.reflection !== undefined ? { reflection: input.reflection } : {}),
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
    },
    include: {
      photos: {
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  return mapCompletionStory(story);
};

export const addProjectBuildCompletionPhoto = async (
  buildId: string,
  learnerId: string,
  file: Express.Multer.File,
  caption?: string | null,
) => {
  await assertBuildOwnerCanEditStory(buildId, learnerId);

  if (!isAllowedBuildCompletionImageMime(file.mimetype)) {
    throw new AppError(
      'Only JPG, PNG, and WebP images are allowed.',
      400,
      'VALIDATION_ERROR',
    );
  }

  if (caption != null && caption.length > COMPLETION_STORY_MAX_CAPTION_LENGTH) {
    throw new AppError(
      `Caption must be at most ${COMPLETION_STORY_MAX_CAPTION_LENGTH} characters.`,
      400,
      'VALIDATION_ERROR',
    );
  }

  return prisma.$transaction(async (tx) => {
    const story = await tx.projectBuildCompletionStory.upsert({
      where: { buildId },
      create: { buildId },
      update: {},
      select: { id: true },
    });

    const photoCount = await tx.projectBuildCompletionPhoto.count({
      where: { storyId: story.id },
    });

    if (photoCount >= COMPLETION_STORY_MAX_PHOTOS) {
      throw new AppError(
        `You can upload at most ${COMPLETION_STORY_MAX_PHOTOS} photos.`,
        400,
        'COMPLETION_PHOTO_LIMIT',
      );
    }

    const photo = await tx.projectBuildCompletionPhoto.create({
      data: {
        storyId: story.id,
        imageUrl: publicBuildCompletionImageUrl(file.filename),
        caption: caption ?? null,
        sortOrder: photoCount,
      },
    });

    await tx.projectBuildCompletionStory.update({
      where: { id: story.id },
      data: { updatedAt: new Date() },
    });

    return mapCompletionPhoto(photo);
  });
};

export const deleteProjectBuildCompletionPhoto = async (
  buildId: string,
  learnerId: string,
  photoId: string,
) => {
  await assertBuildOwnerCanEditStory(buildId, learnerId);

  const story = await prisma.projectBuildCompletionStory.findUnique({
    where: { buildId },
    select: { id: true },
  });

  if (!story) {
    throw new AppError('Completion photo not found.', 404, 'NOT_FOUND');
  }

  const deleted = await prisma.projectBuildCompletionPhoto.deleteMany({
    where: {
      id: photoId,
      storyId: story.id,
    },
  });

  if (deleted.count === 0) {
    throw new AppError('Completion photo not found.', 404, 'NOT_FOUND');
  }

  const remaining = await prisma.projectBuildCompletionPhoto.findMany({
    where: { storyId: story.id },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });

  await prisma.$transaction(
    remaining.map((photo, index) =>
      prisma.projectBuildCompletionPhoto.update({
        where: { id: photo.id },
        data: { sortOrder: index },
      }),
    ),
  );

  await prisma.projectBuildCompletionStory.update({
    where: { id: story.id },
    data: { updatedAt: new Date() },
  });
};
