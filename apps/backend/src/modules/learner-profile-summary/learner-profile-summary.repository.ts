import { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import {
  buildContinuableProjectBuildWhere,
  CONTINUE_PROJECT_BUILD_ORDER_BY,
  PUBLIC_CONTINUE_PROJECT_WHERE,
} from '../learning-projects/project-build-continuation.js';
import {
  ACTIVE_RESERVATION_STATUSES,
  COMPLETED_RESERVATION_STATUSES,
} from '../reservations/reservation-status.js';
import { countVisibleLikedMaterials as countVisibleMaterialLikes } from '../materials/materials.repository.js';

export type ProfileCompletionContext = {
  displayName: string;
  phone: string | null;
  learnerProfile: {
    learnerType: string | null;
    skillLevel: string | null;
    interests: string[];
    bio: string | null;
  } | null;
};

export const findProfileCompletionContext = (
  userId: string,
): Promise<ProfileCompletionContext | null> =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      phone: true,
      learnerProfile: {
        select: {
          learnerType: true,
          skillLevel: true,
          interests: true,
          bio: true,
        },
      },
    },
  });

export const hasUsableSavedLocation = async (userId: string): Promise<boolean> => {
  const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM "user_saved_locations" AS saved
      INNER JOIN "locations" AS location
        ON location."id" = saved."location_id"
      WHERE saved."user_id" = ${userId}
        AND BTRIM(saved."label") <> ''
        AND BTRIM(location."country") <> ''
        AND BTRIM(location."city") <> ''
    ) AS "exists"
  `);

  return rows[0]?.exists === true;
};

export const summarizeLearnerReservationCounts = async (userId: string) => {
  const groups = await prisma.reservation.groupBy({
    by: ['status'],
    where: {
      requesterId: userId,
      status: {
        in: [
          ...ACTIVE_RESERVATION_STATUSES,
          ...COMPLETED_RESERVATION_STATUSES,
        ],
      },
    },
    _count: { _all: true },
  });

  const activeStatuses = new Set<string>(ACTIVE_RESERVATION_STATUSES);
  return groups.reduce(
    (summary, group) => {
      if (activeStatuses.has(group.status)) {
        summary.activeReservationsCount += group._count._all;
      } else if (group.status === 'COMPLETED') {
        summary.completedReservationsCount += group._count._all;
      }
      return summary;
    },
    { activeReservationsCount: 0, completedReservationsCount: 0 },
  );
};

export const countVisibleSavedProjects = (userId: string): Promise<number> =>
  prisma.projectSave.count({
    where: { userId, project: PUBLIC_CONTINUE_PROJECT_WHERE },
  });

export const countVisibleFollowedProjects = (userId: string): Promise<number> =>
  prisma.projectFollow.count({
    where: { userId, project: PUBLIC_CONTINUE_PROJECT_WHERE },
  });

export const countVisibleLikedMaterials = (userId: string): Promise<number> =>
  countVisibleMaterialLikes(userId);

export const countActiveBuilds = (userId: string): Promise<number> =>
  prisma.projectBuild.count({
    where: buildContinuableProjectBuildWhere(userId),
  });

export const countCompletedBuilds = (userId: string): Promise<number> =>
  prisma.projectBuild.count({
    where: { learnerId: userId, status: 'COMPLETED' },
  });

export const findLatestContinueProject = (userId: string) =>
  prisma.projectBuild.findFirst({
    where: buildContinuableProjectBuildWhere(userId),
    orderBy: CONTINUE_PROJECT_BUILD_ORDER_BY,
    select: {
      id: true,
      projectId: true,
      updatedAt: true,
      _count: {
        select: {
          stepProgress: { where: { completedAt: { not: null } } },
        },
      },
      project: {
        select: {
          title: true,
          coverImageUrl: true,
          _count: { select: { steps: true } },
        },
      },
    },
  });
