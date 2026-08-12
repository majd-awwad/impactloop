import { prisma } from '../../database/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';

export const listLearnerHelpSessionProjectOptions = async (input: {
  learnerId: string;
  q?: string;
  page: number;
  limit: number;
}) => {
  const q = input.q?.trim();
  const where: Prisma.ProjectBuildWhereInput = {
    learnerId: input.learnerId,
    status: { in: ['IN_PROGRESS', 'PAUSED'] },
    helpSessions: { none: { activeKey: { not: null } } },
    project: {
      createdBy: { not: input.learnerId },
      createdByUser: {
        accountStatus: 'ACTIVE' as const,
        roles: { some: { role: 'LEARNER' as const } },
      },
      helpSessionOffering: {
        is: {
          isEnabled: true,
          OR: [{ allow15Minutes: true }, { allow30Minutes: true }],
        },
      },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              {
                createdByUser: {
                  displayName: {
                    contains: q,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    },
  };

  const [items, total] = await Promise.all([
    prisma.projectBuild.findMany({
      where,
      select: {
        id: true,
        project: {
          select: {
            id: true,
            title: true,
            coverImageUrl: true,
            difficulty: true,
            estimatedDurationMinutes: true,
            createdBy: true,
            createdByUser: {
              select: {
                id: true,
                displayName: true,
                profileImageUrl: true,
              },
            },
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.projectBuild.count({ where }),
  ]);

  return {
    items: items.map((build) => ({
      buildId: build.id,
      project: {
        id: build.project.id,
        title: build.project.title,
        coverImageUrl: build.project.coverImageUrl,
        difficulty: build.project.difficulty,
        estimatedDurationMinutes: build.project.estimatedDurationMinutes,
        creator: {
          id: build.project.createdByUser.id,
          displayName: build.project.createdByUser.displayName,
          avatarUrl: build.project.createdByUser.profileImageUrl,
        },
      },
    })),
    pagination: {
      page: input.page,
      limit: input.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / input.limit)),
    },
  };
};
