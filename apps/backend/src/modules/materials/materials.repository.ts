import type { Prisma } from '../../generated/prisma/client.js';

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

  if (query.city) {
    where.location = {
      city: {
        contains: query.city,
        mode: 'insensitive',
      },
    };
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
    },
  },
  images: {
    where: {
      isCover: true,
    },
    take: 1,
    orderBy: {
      sortOrder: 'asc' as const,
    },
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

export const findMaterials = async (query: MaterialsQuery) => {
  const where = buildMaterialsWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.material.findMany({
      where,
      include: materialInclude,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: query.limit,
    }),
    prisma.material.count({ where }),
  ]);

  return { items, total };
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
    include: materialInclude,
  });
};
