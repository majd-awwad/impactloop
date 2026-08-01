import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

const PUBLIC_PROJECT_WHERE: Prisma.LearningProjectWhereInput = {
  status: 'PUBLISHED',
  category: {
    isActive: true,
    categoryType: {
      in: ['PROJECT', 'BOTH'],
    },
  },
};

const buildConfirmedProjectLinkedItemsWhere = (
  supplierUserId: string,
): Prisma.ProjectBuildItemWhereInput => ({
  linkedReservationId: { not: null },
  linkedReservation: {
    status: 'COMPLETED',
    ownerId: supplierUserId,
  },
  build: {
    project: {
      is: PUBLIC_PROJECT_WHERE,
    },
  },
});

export type SupplierProjectSupportSummary = {
  projectsSupported: number;
  projectComponentsSupported: number;
  learnerBuildsHelped: number;
  completedLinkedReservations: number;
  latestSupportedProjects: {
    projectId: string;
    title: string;
    categoryName: string | null;
    completedAt: string;
  }[];
};

export const emptySupplierProjectSupportSummary =
  (): SupplierProjectSupportSummary => ({
    projectsSupported: 0,
    projectComponentsSupported: 0,
    learnerBuildsHelped: 0,
    completedLinkedReservations: 0,
    latestSupportedProjects: [],
  });

/**
 * Derived supplier project impact from completed build-linked reservations.
 * Future analytics can join the same path without an event table:
 * project_build_items.linked_reservation_id → reservations (COMPLETED) → project_builds → learning_projects.
 */
export const getSupplierProjectSupportSummary = async (
  supplierUserId: string,
): Promise<SupplierProjectSupportSummary> => {
  const items = await prisma.projectBuildItem.findMany({
    where: buildConfirmedProjectLinkedItemsWhere(supplierUserId),
    select: {
      linkedReservationId: true,
      build: {
        select: {
          id: true,
          projectId: true,
          project: {
            select: {
              id: true,
              title: true,
              category: {
                select: {
                  nameEn: true,
                },
              },
            },
          },
        },
      },
      linkedReservation: {
        select: {
          id: true,
          completedAt: true,
        },
      },
    },
  });

  const projectIds = new Set<string>();
  const buildIds = new Set<string>();
  const reservationIds = new Set<string>();
  const projectLatestCompletion = new Map<
    string,
    {
      projectId: string;
      title: string;
      categoryName: string | null;
      completedAt: Date;
    }
  >();

  for (const item of items) {
    const build = item.build;
    const project = build.project;
    const reservation = item.linkedReservation;

    projectIds.add(build.projectId);
    buildIds.add(build.id);

    if (item.linkedReservationId) {
      reservationIds.add(item.linkedReservationId);
    }

    const completedAt = reservation?.completedAt;
    if (!completedAt) {
      continue;
    }

    const existing = projectLatestCompletion.get(build.projectId);
    if (!existing || completedAt > existing.completedAt) {
      projectLatestCompletion.set(build.projectId, {
        projectId: project.id,
        title: project.title,
        categoryName: project.category.nameEn,
        completedAt,
      });
    }
  }

  const latestSupportedProjects = [...projectLatestCompletion.values()]
    .sort(
      (left, right) =>
        right.completedAt.getTime() - left.completedAt.getTime(),
    )
    .slice(0, 3)
    .map((entry) => ({
      projectId: entry.projectId,
      title: entry.title,
      categoryName: entry.categoryName,
      completedAt: entry.completedAt.toISOString(),
    }));

  return {
    projectsSupported: projectIds.size,
    projectComponentsSupported: items.length,
    learnerBuildsHelped: buildIds.size,
    completedLinkedReservations: reservationIds.size,
    latestSupportedProjects,
  };
};
