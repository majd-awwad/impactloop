import { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { isMaterialSelectableCategory } from '../categories/categories.repository.js';

import {
  CATEGORY_DEMAND_METHODOLOGY_VERSION,
  CATEGORY_DEMAND_PERIOD_DAYS,
  CATEGORY_DEMAND_POSITIVE_RESERVATION_STATUSES,
  CATEGORY_DEMAND_PUBLIC_LISTING_STATUSES,
  CATEGORY_DEMAND_SOURCE,
  computeCategoryDemandScore,
  rankAndLimitCategoryDemand,
  type CategoryDemandEmptyStateReason,
  type CategoryDemandLevel,
  type CategoryDemandReasonCode,
} from './supplier.category-demand-metrics.js';

export type SupplierCategoryDemandPeriodDto = {
  days: number;
  from: string;
  to: string;
};

export type SupplierCategoryDemandMethodologyDto = {
  version: typeof CATEGORY_DEMAND_METHODOLOGY_VERSION;
  source: typeof CATEGORY_DEMAND_SOURCE;
};

export type SupplierCategoryDemandSignalsDto = {
  views: number;
  likes: number;
  reservations: number;
};

export type SupplierCategoryDemandItemDto = {
  categoryId: string;
  categoryNameEn: string;
  categoryNameAr: string;
  demandLevel: CategoryDemandLevel;
  score: number;
  signals: SupplierCategoryDemandSignalsDto;
  primaryReason: CategoryDemandReasonCode;
};

export type SupplierCategoryDemandDto = {
  period: SupplierCategoryDemandPeriodDto;
  methodology: SupplierCategoryDemandMethodologyDto;
  summaryTopCategoryIds: string[];
  items: SupplierCategoryDemandItemDto[];
  emptyStateReason: CategoryDemandEmptyStateReason | null;
};

type CategoryRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  categoryType: string;
  isActive: boolean;
};

type CountRow = {
  categoryId: string;
  count: bigint;
};

const toCountMap = (rows: CountRow[]) =>
  new Map(rows.map((row) => [row.categoryId, Number(row.count)]));

const resolvePeriod = (now = new Date()) => {
  const to = now;
  const from = new Date(to.getTime() - CATEGORY_DEMAND_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  return { from, to, days: CATEGORY_DEMAND_PERIOD_DAYS };
};

const loadEligibleCategories = async (): Promise<CategoryRow[]> => {
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      categoryType: { in: ['MATERIAL', 'BOTH'] },
    },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      categoryType: true,
      isActive: true,
    },
    orderBy: { id: 'asc' },
  });

  return categories.filter((category) =>
    isMaterialSelectableCategory(category.categoryType),
  );
};

const aggregateSignalCountsByCategory = async (input: {
  from: Date;
  to: Date;
  categoryIds: string[];
}) => {
  if (input.categoryIds.length === 0) {
    return {
      viewsByCategory: new Map<string, number>(),
      likesByCategory: new Map<string, number>(),
      reservationsByCategory: new Map<string, number>(),
    };
  }

  const categoryIdsSql = Prisma.join(input.categoryIds);
  const positiveStatusesSql = Prisma.join(
    [...CATEGORY_DEMAND_POSITIVE_RESERVATION_STATUSES].map(
      (status) => Prisma.sql`${status}`,
    ),
  );

  const [viewRows, likeRows, reservationRows] = await Promise.all([
    prisma.$queryRaw<CountRow[]>`
      SELECT m."category_id" AS "categoryId", COUNT(*)::bigint AS "count"
      FROM "material_views" mv
      INNER JOIN "materials" m ON m."id" = mv."material_id"
      WHERE mv."created_at" >= ${input.from}
        AND mv."created_at" <= ${input.to}
        AND m."category_id" IN (${categoryIdsSql})
      GROUP BY m."category_id"
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT m."category_id" AS "categoryId", COUNT(*)::bigint AS "count"
      FROM "material_likes" ml
      INNER JOIN "materials" m ON m."id" = ml."material_id"
      WHERE ml."created_at" >= ${input.from}
        AND ml."created_at" <= ${input.to}
        AND m."category_id" IN (${categoryIdsSql})
      GROUP BY m."category_id"
    `,
    prisma.$queryRaw<CountRow[]>`
      SELECT m."category_id" AS "categoryId", COUNT(*)::bigint AS "count"
      FROM "reservations" r
      INNER JOIN "materials" m ON m."id" = r."material_id"
      WHERE r."created_at" >= ${input.from}
        AND r."created_at" <= ${input.to}
        AND r."status"::text IN (${positiveStatusesSql})
        AND m."category_id" IN (${categoryIdsSql})
      GROUP BY m."category_id"
    `,
  ]);

  return {
    viewsByCategory: toCountMap(viewRows),
    likesByCategory: toCountMap(likeRows),
    reservationsByCategory: toCountMap(reservationRows),
  };
};

const aggregatePublicListingCountsByCategory = async (
  categoryIds: string[],
) => {
  if (categoryIds.length === 0) {
    return new Map<string, number>();
  }

  const groups = await prisma.material.groupBy({
    by: ['categoryId'],
    where: {
      categoryId: { in: categoryIds },
      status: {
        in: [...CATEGORY_DEMAND_PUBLIC_LISTING_STATUSES],
      },
    },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.categoryId, group._count._all]));
};

export const getSupplierCategoryDemand = async (
  limit: number,
  now = new Date(),
): Promise<SupplierCategoryDemandDto> => {
  const period = resolvePeriod(now);
  const methodology = {
    version: CATEGORY_DEMAND_METHODOLOGY_VERSION,
    source: CATEGORY_DEMAND_SOURCE,
  } as const;

  const categories = await loadEligibleCategories();
  if (categories.length === 0) {
    return {
      period: {
        days: period.days,
        from: period.from.toISOString(),
        to: period.to.toISOString(),
      },
      methodology,
      summaryTopCategoryIds: [],
      items: [],
      emptyStateReason: 'NO_ACTIVE_CATEGORIES',
    };
  }

  const categoryIds = categories.map((category) => category.id);
  const [signalCounts, listingCounts] = await Promise.all([
    aggregateSignalCountsByCategory({
      from: period.from,
      to: period.to,
      categoryIds,
    }),
    aggregatePublicListingCountsByCategory(categoryIds),
  ]);

  const scored = categories.map((category) => {
    const views = signalCounts.viewsByCategory.get(category.id) ?? 0;
    const likes = signalCounts.likesByCategory.get(category.id) ?? 0;
    const reservations =
      signalCounts.reservationsByCategory.get(category.id) ?? 0;
    const listingCount = listingCounts.get(category.id) ?? 0;
    const metrics = computeCategoryDemandScore({
      views,
      likes,
      reservations,
      listingCount,
    });

    return {
      categoryId: category.id,
      categoryNameEn: category.nameEn,
      categoryNameAr: category.nameAr,
      activityValue: metrics.activityValue,
      score: metrics.score,
      includeInResults: metrics.includeInResults,
      demandLevel: metrics.demandLevel,
      primaryReason: metrics.primaryReason,
      signals: { views, likes, reservations },
    };
  });

  const ranked = rankAndLimitCategoryDemand(scored, limit);
  const items: SupplierCategoryDemandItemDto[] = ranked
    .filter(
      (
        item,
      ): item is typeof item & { demandLevel: CategoryDemandLevel } =>
        item.demandLevel != null,
    )
    .map((item) => ({
      categoryId: item.categoryId,
      categoryNameEn: item.categoryNameEn,
      categoryNameAr: item.categoryNameAr,
      demandLevel: item.demandLevel,
      score: item.score,
      signals: item.signals,
      primaryReason: item.primaryReason,
    }));

  return {
    period: {
      days: period.days,
      from: period.from.toISOString(),
      to: period.to.toISOString(),
    },
    methodology,
    summaryTopCategoryIds: items.slice(0, 3).map((item) => item.categoryId),
    items,
    emptyStateReason: items.length === 0 ? 'NO_RECENT_ACTIVITY' : null,
  };
};
