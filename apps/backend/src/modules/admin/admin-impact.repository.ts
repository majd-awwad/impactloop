import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

const COMPLETED_RESERVATION_WHERE: Prisma.ReservationWhereInput = {
  status: 'COMPLETED',
};

const COMPLETED_LINKED_BUILD_ITEM_WHERE: Prisma.ProjectBuildItemWhereInput = {
  linkedReservationId: { not: null },
  linkedReservation: {
    status: 'COMPLETED',
  },
};

export const countCompletedReuseEvents = async (): Promise<number> => {
  return prisma.reservation.count({ where: COMPLETED_RESERVATION_WHERE });
};

export const countDistinctMaterialsReused = async (): Promise<number> => {
  const grouped = await prisma.reservation.groupBy({
    by: ['materialId'],
    where: COMPLETED_RESERVATION_WHERE,
  });

  return grouped.length;
};

export const countLearnersBenefited = async (): Promise<number> => {
  const grouped = await prisma.reservation.groupBy({
    by: ['requesterId'],
    where: COMPLETED_RESERVATION_WHERE,
  });

  return grouped.length;
};

export const countSuppliersContributed = async (): Promise<number> => {
  const grouped = await prisma.reservation.groupBy({
    by: ['ownerId'],
    where: COMPLETED_RESERVATION_WHERE,
  });

  return grouped.length;
};

export const groupCompletedReuseByCategory = async () => {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; nameEn: string; nameAr: string; count: number | bigint }>
  >`
    SELECT
      c."id" AS "id",
      c."name_en" AS "nameEn",
      c."name_ar" AS "nameAr",
      COUNT(*)::int AS "count"
    FROM "reservations" r
    INNER JOIN "materials" m ON m."id" = r."material_id"
    INNER JOIN "categories" c ON c."id" = m."category_id"
    WHERE r."status"::text = 'COMPLETED'
    GROUP BY c."id", c."name_en", c."name_ar"
    ORDER BY "count" DESC, c."name_en" ASC
  `;

  return rows.map((row) => ({
    nameEn: row.nameEn,
    nameAr: row.nameAr,
    completedReuseEvents: Number(row.count),
  }));
};

export const groupCompletedReuseByMonth = async (fromInclusive: Date) => {
  const rows = await prisma.$queryRaw<
    Array<{ month: string; count: number | bigint }>
  >`
    SELECT
      to_char(date_trunc('month', r."completed_at"), 'YYYY-MM') AS "month",
      COUNT(*)::int AS "count"
    FROM "reservations" r
    WHERE r."status"::text = 'COMPLETED'
      AND r."completed_at" IS NOT NULL
      AND r."completed_at" >= ${fromInclusive}
    GROUP BY 1
    ORDER BY 1
  `;

  return rows
    .filter((row) => typeof row.month === 'string' && row.month.length > 0)
    .map((row) => ({
      month: row.month,
      completedReuseEvents: Number(row.count),
    }));
};

export const listCompletedReuseEventsForCo2Estimate = async () => {
  const rows = await prisma.reservation.findMany({
    where: COMPLETED_RESERVATION_WHERE,
    select: {
      quantityRequested: true,
      material: {
        select: {
          unit: true,
          category: {
            select: { nameEn: true },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    quantity: Number(row.quantityRequested),
    unit: row.material.unit,
    categoryNameEn: row.material.category.nameEn,
  }));
};

export const getLearningImpactCounts = async () => {
  const [componentsFulfilled, buildGroups] = await Promise.all([
    prisma.projectBuildItem.count({
      where: COMPLETED_LINKED_BUILD_ITEM_WHERE,
    }),
    prisma.projectBuildItem.groupBy({
      by: ['buildId'],
      where: COMPLETED_LINKED_BUILD_ITEM_WHERE,
    }),
  ]);

  const buildIds = buildGroups.map((row) => row.buildId);
  if (buildIds.length === 0) {
    return {
      componentsFulfilled,
      buildsSupported: 0,
      projectsSupported: 0,
    };
  }

  const builds = await prisma.projectBuild.findMany({
    where: { id: { in: buildIds } },
    select: { projectId: true },
  });

  const projectIds = new Set(builds.map((build) => build.projectId));

  return {
    componentsFulfilled,
    buildsSupported: buildIds.length,
    projectsSupported: projectIds.size,
  };
};
