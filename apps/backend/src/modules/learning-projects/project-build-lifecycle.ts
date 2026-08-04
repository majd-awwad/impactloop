import type {
  Prisma,
  ProjectBuildStatus,
  ReservationStatus,
} from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import { projectBuildInclude } from './learning-projects.repository.js';
import { createProjectBuildCompletionSnapshot } from './project-build-completion-snapshot.js';

export const ACTIVE_PROJECT_BUILD_STATUSES = [
  'IN_PROGRESS',
  'PAUSED',
] as const satisfies readonly ProjectBuildStatus[];

const TERMINAL_RESERVATION_STATUSES = new Set<ReservationStatus>([
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
]);

const ARCHIVE_BLOCKING_RESERVATION_STATUSES = new Set<ReservationStatus>([
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'ACCEPTED',
  'AWAITING_RESOLUTION',
]);

export type BuildArchiveBlocker = {
  code:
    | 'ACTIVE_RESERVATION'
    | 'AWAITING_RESOLUTION'
    | 'OPEN_MATERIAL_REQUEST';
  reservationId?: string;
  materialRequestId?: string;
  message: string;
};

export const findActiveProjectBuildForProject = async (
  projectId: string,
  learnerId: string,
) =>
  prisma.projectBuild.findFirst({
    where: {
      projectId,
      learnerId,
      status: { in: [...ACTIVE_PROJECT_BUILD_STATUSES] },
    },
    include: projectBuildInclude,
    orderBy: [
      { status: 'asc' },
      { updatedAt: 'desc' },
      { id: 'asc' },
    ],
  });

export const findProjectBuildForLearner = async (input: {
  projectId: string;
  learnerId: string;
  buildId?: string;
}) => {
  if (input.buildId) {
    return prisma.projectBuild.findFirst({
      where: {
        id: input.buildId,
        projectId: input.projectId,
        learnerId: input.learnerId,
      },
      include: projectBuildInclude,
    });
  }

  const active = await findActiveProjectBuildForProject(
    input.projectId,
    input.learnerId,
  );
  if (active) {
    return active;
  }

  return prisma.projectBuild.findFirst({
    where: {
      projectId: input.projectId,
      learnerId: input.learnerId,
    },
    include: projectBuildInclude,
    orderBy: [{ attemptNumber: 'desc' }, { id: 'asc' }],
  });
};

export const findOwnedBuildById = async (buildId: string, learnerId: string) =>
  prisma.projectBuild.findFirst({
    where: { id: buildId, learnerId },
    include: projectBuildInclude,
  });

export const detectBuildArchiveBlockers = async (
  buildId: string,
): Promise<BuildArchiveBlocker[]> => {
  const items = await prisma.projectBuildItem.findMany({
    where: { buildId },
    select: {
      linkedReservation: {
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const blockers: BuildArchiveBlocker[] = [];

  for (const item of items) {
    const reservation = item.linkedReservation;
    if (!reservation) {
      continue;
    }

    if (reservation.status === 'AWAITING_RESOLUTION') {
      blockers.push({
        code: 'AWAITING_RESOLUTION',
        reservationId: reservation.id,
        message: 'Resolve the reservation awaiting resolution before archiving.',
      });
      continue;
    }

    if (ARCHIVE_BLOCKING_RESERVATION_STATUSES.has(reservation.status)) {
      blockers.push({
        code: 'ACTIVE_RESERVATION',
        reservationId: reservation.id,
        message: 'Cancel or complete active reservations before archiving.',
      });
    }
  }

  const openRequest = await prisma.learnerMaterialRequest.findFirst({
    where: {
      projectBuildId: buildId,
      status: 'OPEN',
    },
    select: { id: true },
  });

  if (openRequest) {
    blockers.push({
      code: 'OPEN_MATERIAL_REQUEST',
      materialRequestId: openRequest.id,
      message: 'Close or fulfill open material requests before archiving.',
    });
  }

  return blockers;
};

export const pauseProjectBuild = async (buildId: string, learnerId: string) =>
  prisma.$transaction(async (tx) => {
    const build = await tx.projectBuild.findFirst({
      where: { id: buildId, learnerId },
      select: { id: true, status: true, pausedAt: true },
    });

    if (!build) {
      throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
    }

    if (build.status === 'PAUSED') {
      return tx.projectBuild.findUniqueOrThrow({
        where: { id: build.id },
        include: projectBuildInclude,
      });
    }

    if (build.status !== 'IN_PROGRESS') {
      throw new AppError(
        'Only in-progress builds can be paused.',
        409,
        'BUILD_NOT_PAUSABLE',
      );
    }

    const pausedAt = new Date();
    await tx.projectBuild.update({
      where: { id: build.id },
      data: {
        status: 'PAUSED',
        pausedAt,
      },
    });

    return tx.projectBuild.findUniqueOrThrow({
      where: { id: build.id },
      include: projectBuildInclude,
    });
  });

export const resumeProjectBuild = async (buildId: string, learnerId: string) =>
  prisma.$transaction(async (tx) => {
    const build = await tx.projectBuild.findFirst({
      where: { id: buildId, learnerId },
      select: { id: true, status: true },
    });

    if (!build) {
      throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
    }

    if (build.status === 'IN_PROGRESS') {
      return tx.projectBuild.findUniqueOrThrow({
        where: { id: build.id },
        include: projectBuildInclude,
      });
    }

    if (build.status !== 'PAUSED') {
      throw new AppError(
        'Only paused builds can be resumed.',
        409,
        'BUILD_NOT_RESUMABLE',
      );
    }

    await tx.projectBuild.update({
      where: { id: build.id },
      data: {
        status: 'IN_PROGRESS',
        pausedAt: null,
      },
    });

    return tx.projectBuild.findUniqueOrThrow({
      where: { id: build.id },
      include: projectBuildInclude,
    });
  });

export const archiveProjectBuild = async (buildId: string, learnerId: string) => {
  const blockers = await detectBuildArchiveBlockers(buildId);
  if (blockers.length > 0) {
    throw new AppError(
      'This build cannot be archived until linked workflows are resolved.',
      409,
      'BUILD_ARCHIVE_BLOCKED',
      { blockers },
    );
  }

  return prisma.$transaction(async (tx) => {
    const build = await tx.projectBuild.findFirst({
      where: { id: buildId, learnerId },
      select: { id: true, status: true, archivedAt: true },
    });

    if (!build) {
      throw new AppError('Project build not found.', 404, 'BUILD_NOT_FOUND');
    }

    if (build.status === 'ARCHIVED') {
      return tx.projectBuild.findUniqueOrThrow({
        where: { id: build.id },
        include: projectBuildInclude,
      });
    }

    if (build.status === 'COMPLETED') {
      throw new AppError(
        'Completed builds cannot be archived.',
        409,
        'BUILD_NOT_ARCHIVABLE',
      );
    }

    const archivedAt = new Date();
    await tx.projectBuild.update({
      where: { id: build.id },
      data: {
        status: 'ARCHIVED',
        archivedAt,
        pausedAt: null,
      },
    });

    return tx.projectBuild.findUniqueOrThrow({
      where: { id: build.id },
      include: projectBuildInclude,
    });
  });
};

export const createProjectBuildAttempt = async (
  projectId: string,
  learnerId: string,
) => {
  const active = await findActiveProjectBuildForProject(projectId, learnerId);
  if (active) {
    throw new AppError(
      'An active build already exists for this project.',
      409,
      'BUILD_ALREADY_ACTIVE',
      { buildId: active.id, status: active.status },
    );
  }

  return prisma.$transaction(async (tx) => {
    const project = await tx.learningProject.findFirst({
      where: {
        id: projectId,
        status: 'PUBLISHED',
        hiddenAt: null,
        archivedAt: null,
      },
      select: {
        id: true,
        requiredComponents: {
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!project) {
      return null;
    }

    const latest = await tx.projectBuild.findFirst({
      where: { projectId, learnerId },
      orderBy: [{ attemptNumber: 'desc' }, { id: 'asc' }],
      select: { attemptNumber: true },
    });

    const attemptNumber = (latest?.attemptNumber ?? 0) + 1;

    const build = await tx.projectBuild.create({
      data: {
        projectId,
        learnerId,
        attemptNumber,
        status: 'IN_PROGRESS',
        items: project.requiredComponents.length
          ? {
              create: project.requiredComponents.map((component) => ({
                requiredComponentId: component.id,
              })),
            }
          : undefined,
      },
      select: { id: true },
    });

    return tx.projectBuild.findUniqueOrThrow({
      where: { id: build.id },
      include: projectBuildInclude,
    });
  });
};

export const startOrReturnProjectBuild = async (
  projectId: string,
  learnerId: string,
) => {
  const active = await findActiveProjectBuildForProject(projectId, learnerId);
  if (active) {
    return active;
  }

  const existing = await prisma.projectBuild.findFirst({
    where: { projectId, learnerId },
    select: { id: true },
  });

  if (existing) {
    throw new AppError(
      'Use build again to start a new attempt after completing or archiving.',
      409,
      'BUILD_AGAIN_REQUIRED',
    );
  }

  return createProjectBuildAttempt(projectId, learnerId);
};

const buildListOrderBy = (
  statusFilter: ProjectBuildStatus | 'ACTIVE',
): Prisma.ProjectBuildOrderByWithRelationInput[] => {
  if (statusFilter === 'COMPLETED') {
    return [{ completedAt: 'desc' }, { id: 'asc' }];
  }
  if (statusFilter === 'ARCHIVED') {
    return [{ archivedAt: 'desc' }, { id: 'asc' }];
  }
  return [{ updatedAt: 'desc' }, { id: 'asc' }];
};

export const listLearnerBuilds = async (input: {
  learnerId: string;
  status?: ProjectBuildStatus | 'ACTIVE';
  page: number;
  limit: number;
}) => {
  const where: Prisma.ProjectBuildWhereInput = {
    learnerId: input.learnerId,
  };

  if (input.status === 'ACTIVE') {
    where.status = { in: [...ACTIVE_PROJECT_BUILD_STATUSES] };
  } else if (input.status) {
    where.status = input.status;
  }

  const skip = (input.page - 1) * input.limit;
  const orderBy = buildListOrderBy(input.status ?? 'IN_PROGRESS');

  const [items, total] = await Promise.all([
    prisma.projectBuild.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            title: true,
            shortDescription: true,
            coverImageUrl: true,
            estimatedDurationMinutes: true,
            difficulty: true,
          },
        },
        completionStory: {
          select: {
            reflection: true,
            caption: true,
            photos: {
              orderBy: { sortOrder: 'asc' },
              take: 1,
              select: { imageUrl: true },
            },
          },
        },
        completionSnapshot: {
          select: { snapshot: true },
        },
        _count: {
          select: {
            items: true,
            stepProgress: true,
          },
        },
      },
      orderBy,
      skip,
      take: input.limit,
    }),
    prisma.projectBuild.count({ where }),
  ]);

  return { items, total };
};

export const markProjectBuildCompleted = async (buildId: string) => {
  const completedAt = new Date();
  const build = await prisma.projectBuild.update({
    where: { id: buildId },
    data: {
      status: 'COMPLETED',
      completedAt,
      pausedAt: null,
    },
    include: projectBuildInclude,
  });

  await createProjectBuildCompletionSnapshot(build);
  return build;
};

export const isReservationTerminal = (status: ReservationStatus) =>
  TERMINAL_RESERVATION_STATUSES.has(status);
