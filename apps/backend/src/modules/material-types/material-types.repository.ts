import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import { normalizeSearchText } from '../../utils/normalize-search-text.js';
import { decimalToNumber } from '../../utils/decimal.js';

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export const findActiveMaterialTypes = async (input: {
  categoryId?: string;
  query?: string;
  limit?: number;
}) => {
  const normalizedQuery = input.query ? normalizeSearchText(input.query) : undefined;

  return prisma.materialType.findMany({
    where: {
      isActive: true,
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(normalizedQuery
        ? {
            OR: [
              { nameEn: { contains: normalizedQuery, mode: 'insensitive' } },
              { nameAr: { contains: normalizedQuery, mode: 'insensitive' } },
              { normalizedName: { contains: normalizedQuery } },
              {
                aliases: {
                  some: {
                    OR: [
                      { alias: { contains: normalizedQuery, mode: 'insensitive' } },
                      { normalizedAlias: { contains: normalizedQuery } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      category: {
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
        },
      },
      aliases: {
        select: {
          alias: true,
        },
        take: 8,
      },
      priceRules: {
        where: {
          isActive: true,
          status: 'ACTIVE',
          currency: 'NIS',
        },
        select: { id: true },
        take: 1,
      },
    },
    orderBy: [{ nameEn: 'asc' }],
    take: input.limit ?? 50,
  });
};

export const findActiveMaterialTypesForMatching = async (
  categoryId: string,
  client?: PrismaClientLike,
) => {
  return (client ?? prisma).materialType.findMany({
    where: {
      isActive: true,
      categoryId,
    },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      normalizedName: true,
      defaultUnit: true,
      categoryId: true,
      aliases: {
        select: {
          alias: true,
          normalizedAlias: true,
        },
      },
    },
    orderBy: { nameEn: 'asc' },
  });
};

/** Global catalog for high-confidence cross-category suggestion only. */
export const findActiveMaterialTypesForGlobalMatching = async (
  client?: PrismaClientLike,
) => {
  return (client ?? prisma).materialType.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      normalizedName: true,
      defaultUnit: true,
      categoryId: true,
      category: {
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
        },
      },
      aliases: {
        select: {
          alias: true,
          normalizedAlias: true,
        },
      },
    },
    orderBy: { nameEn: 'asc' },
  });
};

export const findMaterialTypeById = async (
  materialTypeId: string,
  client?: PrismaClientLike,
) => {
  return (client ?? prisma).materialType.findUnique({
    where: { id: materialTypeId },
    include: {
      category: {
        select: {
          id: true,
          nameEn: true,
          nameAr: true,
        },
      },
    },
  });
};

export const findActivePriceRuleForMaterialType = async (
  materialTypeId: string,
  unit?: string,
  client?: PrismaClientLike,
) => {
  return (client ?? prisma).materialPriceRule.findFirst({
    where: {
      materialTypeId,
      isActive: true,
      status: 'ACTIVE',
      currency: 'NIS',
      ...(unit ? { unit } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });
};

export const mapPriceRuleDto = (rule: {
  id: string;
  materialTypeId: string;
  currency: string;
  unit: string;
  maxAllowedUnitPriceNis: { toNumber(): number } | number | null;
  maxAllowedTotalPriceNis: { toNumber(): number } | number | null;
  status: string;
  sourceType: string;
  isActive: boolean;
}) => ({
  id: rule.id,
  materialTypeId: rule.materialTypeId,
  currency: rule.currency,
  unit: rule.unit,
  maxAllowedUnitPriceNis: decimalToNumber(rule.maxAllowedUnitPriceNis),
  maxAllowedTotalPriceNis: decimalToNumber(rule.maxAllowedTotalPriceNis),
  status: rule.status,
  sourceType: rule.sourceType,
  isActive: rule.isActive,
});
