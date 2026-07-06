import { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import type { MaterialsQuery } from './materials.validation.js';

const buildSearchClauses = (q: string): Prisma.MaterialWhereInput[] => [
  {
    title: {
      contains: q,
      mode: 'insensitive',
    },
  },
  {
    description: {
      contains: q,
      mode: 'insensitive',
    },
  },
  {
    materialType: {
      contains: q,
      mode: 'insensitive',
    },
  },
  {
    tags: {
      some: {
        tag: {
          contains: q,
          mode: 'insensitive',
        },
      },
    },
  },
  {
    category: {
      nameEn: {
        contains: q,
        mode: 'insensitive',
      },
    },
  },
  {
    category: {
      nameAr: {
        contains: q,
        mode: 'insensitive',
      },
    },
  },
];

const buildMaterialsWhere = (
  query: MaterialsQuery,
): Prisma.MaterialWhereInput => {
  const where: Prisma.MaterialWhereInput = {
    status: query.status,
    category: {
      isActive: true,
      categoryType: {
        in: ['MATERIAL', 'BOTH'],
      },
    },
  };

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.condition) {
    where.condition = query.condition;
  }

  if (query.deliveryAvailable !== undefined) {
    where.deliveryAllowed = query.deliveryAvailable;
  }

  const locationFilters: Prisma.LocationWhereInput[] = [];

  if (query.city) {
    locationFilters.push({
      city: {
        contains: query.city,
        mode: 'insensitive',
      },
    });
  }

  if (query.area) {
    locationFilters.push({
      area: {
        contains: query.area,
        mode: 'insensitive',
      },
    });
  }

  if (locationFilters.length === 1) {
    where.location = locationFilters[0];
  } else if (locationFilters.length > 1) {
    where.location = {
      AND: locationFilters,
    };
  }

  if (query.pickupAllowed !== undefined) {
    where.pickupAllowed = query.pickupAllowed;
  }

  if (query.priceType === 'FREE') {
    where.isFree = true;
  }

  if (query.priceType === 'PAID') {
    where.isFree = false;
  }

  if (query.q) {
    where.OR = buildSearchClauses(query.q);
  }

  return where;
};

const materialInclude = {
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      isActive: true,
      categoryType: true,
    },
  },
  location: {
    select: {
      city: true,
      area: true,
      latitude: true,
      longitude: true,
    },
  },
  images: {
    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
    take: 1,
  },
  supplierProfile: {
    select: {
      publicName: true,
      user: {
        select: {
          displayName: true,
        },
      },
    },
  },
  owner: {
    select: {
      displayName: true,
    },
  },
} satisfies Prisma.MaterialInclude;

const materialDetailInclude = {
  ...materialInclude,
  images: {
    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      imageUrl: true,
      sortOrder: true,
      isCover: true,
      createdAt: true,
    },
  },
  supplierProfile: {
    select: {
      publicName: true,
      supplierType: true,
      verificationStatus: true,
      user: {
        select: {
          displayName: true,
        },
      },
    },
  },
} satisfies Prisma.MaterialInclude;

const buildMaterialsOrderBy = (
  sort: MaterialsQuery['sort'],
): Prisma.MaterialOrderByWithRelationInput[] => {
  if (sort === 'popular') {
    return [{ viewsCount: 'desc' }, { createdAt: 'desc' }];
  }

  return [{ createdAt: 'desc' }];
};

export type ViewerCoordinates = {
  latitude: number;
  longitude: number;
};

const buildNearestWhereClauses = (query: MaterialsQuery): Prisma.Sql[] => {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`m."status" = ${query.status}::"MaterialStatus"`,
    Prisma.sql`c."is_active" = true`,
    Prisma.sql`c."category_type" IN ('MATERIAL'::"CategoryType", 'BOTH'::"CategoryType")`,
  ];

  if (query.categoryId) {
    clauses.push(Prisma.sql`m."category_id" = ${query.categoryId}`);
  }

  if (query.condition) {
    clauses.push(
      Prisma.sql`m."condition" = ${query.condition}::"MaterialCondition"`,
    );
  }

  if (query.deliveryAvailable !== undefined) {
    clauses.push(
      Prisma.sql`m."delivery_allowed" = ${query.deliveryAvailable}`,
    );
  }

  if (query.pickupAllowed !== undefined) {
    clauses.push(Prisma.sql`m."pickup_allowed" = ${query.pickupAllowed}`);
  }

  if (query.priceType === 'FREE') {
    clauses.push(Prisma.sql`m."is_free" = true`);
  }

  if (query.priceType === 'PAID') {
    clauses.push(Prisma.sql`m."is_free" = false`);
  }

  if (query.city) {
    clauses.push(Prisma.sql`l."city" ILIKE ${`%${query.city}%`}`);
  }

  if (query.area) {
    clauses.push(Prisma.sql`l."area" ILIKE ${`%${query.area}%`}`);
  }

  if (query.q) {
    const pattern = `%${query.q}%`;
    clauses.push(Prisma.sql`(
      m."title" ILIKE ${pattern}
      OR m."description" ILIKE ${pattern}
      OR m."material_type" ILIKE ${pattern}
      OR c."name_en" ILIKE ${pattern}
      OR c."name_ar" ILIKE ${pattern}
      OR EXISTS (
        SELECT 1
        FROM "material_tags" mt
        WHERE mt."material_id" = m."id"
          AND mt."tag" ILIKE ${pattern}
      )
    )`);
  }

  return clauses;
};

const buildDistanceSql = (coordinates: ViewerCoordinates) => {
  const viewerPoint = Prisma.sql`ST_SetSRID(ST_MakePoint(${coordinates.longitude}, ${coordinates.latitude}), 4326)::geography`;

  return Prisma.sql`CASE
    WHEN l."location" IS NOT NULL THEN ST_Distance(l."location", ${viewerPoint})
    WHEN l."latitude" IS NOT NULL AND l."longitude" IS NOT NULL THEN
      ST_Distance(
        ST_SetSRID(ST_MakePoint(l."longitude"::double precision, l."latitude"::double precision), 4326)::geography,
        ${viewerPoint}
      )
    ELSE NULL
  END`;
};

const findNearestMaterialIds = async (
  query: MaterialsQuery,
  coordinates: ViewerCoordinates,
) => {
  const skip = (query.page - 1) * query.limit;
  const whereSql = Prisma.join(buildNearestWhereClauses(query), ' AND ');
  const distanceSql = buildDistanceSql(coordinates);

  const [rows, totalRows] = await Promise.all([
    prisma.$queryRaw<{ id: string; distanceKm: number | null }[]>`
      SELECT m."id" AS "id", (${distanceSql}) / 1000.0 AS "distanceKm"
      FROM "materials" m
      INNER JOIN "categories" c ON c."id" = m."category_id"
      INNER JOIN "locations" l ON l."id" = m."location_id"
      WHERE ${whereSql}
      ORDER BY (${distanceSql}) ASC NULLS LAST, m."created_at" DESC
      OFFSET ${skip}
      LIMIT ${query.limit}
    `,
    prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*)::bigint AS "total"
      FROM "materials" m
      INNER JOIN "categories" c ON c."id" = m."category_id"
      INNER JOIN "locations" l ON l."id" = m."location_id"
      WHERE ${whereSql}
    `,
  ]);

  return {
    rows,
    total: Number(totalRows[0]?.total ?? 0n),
  };
};

export const findMaterials = async (
  query: MaterialsQuery,
  coordinates?: ViewerCoordinates,
) => {
  const where = buildMaterialsWhere(query);
  const skip = (query.page - 1) * query.limit;

  if (query.sort === 'nearest' && coordinates) {
    const nearest = await findNearestMaterialIds(query, coordinates);
    const ids = nearest.rows.map((row) => row.id);

    if (ids.length === 0) {
      return {
        items: [],
        total: nearest.total,
        distanceByMaterialId: new Map<string, number | null>(),
      };
    }

    const orderById = new Map(ids.map((id, index) => [id, index]));
    const distanceByMaterialId = new Map(
      nearest.rows.map((row) => [row.id, row.distanceKm]),
    );
    const items = await prisma.material.findMany({
      where: { id: { in: ids } },
      include: materialInclude,
    });

    items.sort(
      (left, right) =>
        (orderById.get(left.id) ?? 0) - (orderById.get(right.id) ?? 0),
    );

    return {
      items,
      total: nearest.total,
      distanceByMaterialId,
    };
  }

  const [items, total] = await Promise.all([
    prisma.material.findMany({
      where,
      include: materialInclude,
      orderBy: buildMaterialsOrderBy(query.sort),
      skip,
      take: query.limit,
    }),
    prisma.material.count({ where }),
  ]);

  return { items, total, distanceByMaterialId: new Map<string, number | null>() };
};

export const recordMaterialView = async (
  id: string,
  viewerUserId?: string,
  viewSource = 'detail',
) => {
  return prisma.$transaction(async (tx) => {
    if (viewerUserId) {
      const existingView = await tx.materialView.findFirst({
        where: {
          materialId: id,
          viewerUserId,
        },
        select: {
          id: true,
        },
      });

      if (existingView) {
        return tx.material.findUniqueOrThrow({
          where: { id },
          select: {
            viewsCount: true,
          },
        });
      }
    }

    await tx.materialView.create({
      data: {
        materialId: id,
        viewerUserId: viewerUserId ?? null,
        viewSource,
      },
    });

    return tx.material.update({
      where: { id },
      data: {
        viewsCount: {
          increment: 1,
        },
      },
      select: {
        viewsCount: true,
      },
    });
  });
};

export const findMaterialById = async (id: string) => {
  return prisma.material.findFirst({
    where: {
      id,
      status: {
        in: ['AVAILABLE', 'PENDING_RESERVATION', 'RESERVED'],
      },
      category: {
        isActive: true,
        categoryType: {
          in: ['MATERIAL', 'BOTH'],
        },
      },
    },
    include: materialDetailInclude,
  });
};

export const findPublicMaterialById = async (id: string) => {
  return prisma.material.findFirst({
    where: {
      id,
      status: {
        in: ['AVAILABLE', 'PENDING_RESERVATION', 'RESERVED'],
      },
      category: {
        isActive: true,
        categoryType: {
          in: ['MATERIAL', 'BOTH'],
        },
      },
    },
    select: {
      id: true,
    },
  });
};

export const countLikesByMaterialIds = async (materialIds: string[]) => {
  if (materialIds.length === 0) {
    return new Map<string, number>();
  }

  const groups = await prisma.materialLike.groupBy({
    by: ['materialId'],
    where: { materialId: { in: materialIds } },
    _count: { _all: true },
  });

  return new Map(groups.map((group) => [group.materialId, group._count._all]));
};

export const findLikedMaterialIds = async (
  userId: string | undefined,
  materialIds: string[],
) => {
  if (!userId || materialIds.length === 0) {
    return new Set<string>();
  }

  const likes = await prisma.materialLike.findMany({
    where: {
      userId,
      materialId: { in: materialIds },
    },
    select: {
      materialId: true,
    },
  });

  return new Set(likes.map((like) => like.materialId));
};

export const setMaterialLiked = async (materialId: string, userId: string) => {
  await prisma.materialLike.upsert({
    where: {
      materialId_userId: {
        materialId,
        userId,
      },
    },
    create: {
      materialId,
      userId,
    },
    update: {},
  });
};

export const unsetMaterialLiked = async (materialId: string, userId: string) => {
  await prisma.materialLike.deleteMany({
    where: {
      materialId,
      userId,
    },
  });
};

export const countLikesForMaterial = async (materialId: string) => {
  return prisma.materialLike.count({
    where: { materialId },
  });
};
