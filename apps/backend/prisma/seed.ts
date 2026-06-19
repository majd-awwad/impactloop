import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

import { env } from '../src/config/env.js';
import { normalizeSearchText } from '../src/utils/normalize-search-text.js';
import {
  MATERIAL_CATEGORY_SEEDS,
  MATERIAL_TYPE_SEEDS,
} from './seeds/material-taxonomy.data.js';
import { seedSupplierReservations } from './seeds/seed-supplier-reservations.js';
import { seedSupplierNotifications } from './seeds/seed-supplier-notifications.js';

const databaseUrl = env.databaseUrl;

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const OBSOLETE_ALIAS_NORMALIZED_VALUES = new Set(
  ['رaspberry pi', 'رaspberry باي', 'سيرvo', 'درill'].map((alias) =>
    normalizeSearchText(alias),
  ),
);

const normalizeSeedAliases = (
  aliases: Array<{ alias: string; language?: string }>,
) => {
  const normalizedAliases = new Map<
    string,
    { alias: string; normalizedAlias: string; language: string | null }
  >();

  for (const alias of aliases) {
    const normalizedAlias = normalizeSearchText(alias.alias);

    if (!normalizedAliases.has(normalizedAlias)) {
      normalizedAliases.set(normalizedAlias, {
        alias: alias.alias,
        normalizedAlias,
        language: alias.language ?? null,
      });
    }
  }

  return [...normalizedAliases.values()];
};

const hasValidSeedPriceRule = (input: {
  nameEn: string;
  priceRule: {
    unit: string;
    maxAllowedUnitPriceNis?: number;
    maxAllowedTotalPriceNis?: number;
  };
}): boolean => {
  if (
    input.priceRule.maxAllowedUnitPriceNis == null &&
    input.priceRule.maxAllowedTotalPriceNis == null
  ) {
    console.warn(
      `Skipping invalid seed price rule for ${input.nameEn}: missing both max unit and max total price.`,
    );
    return false;
  }

  return true;
};

async function syncAliases(
  materialTypeId: string,
  aliases: Array<{ alias: string; language?: string }>,
) {
  const seedAliases = normalizeSeedAliases(aliases);

  await prisma.materialTypeAlias.deleteMany({
    where: {
      materialTypeId,
      normalizedAlias: { in: [...OBSOLETE_ALIAS_NORMALIZED_VALUES] },
    },
  });

  const existingAliases = await prisma.materialTypeAlias.findMany({
    where: { materialTypeId },
    select: { normalizedAlias: true },
  });
  const existingNormalizedAliases = new Set(
    existingAliases.map((alias) => alias.normalizedAlias),
  );

  for (const alias of seedAliases) {
    if (existingNormalizedAliases.has(alias.normalizedAlias)) {
      continue;
    }

    await prisma.materialTypeAlias.create({
      data: {
        materialTypeId,
        alias: alias.alias,
        normalizedAlias: alias.normalizedAlias,
        language: alias.language,
      },
    });
    existingNormalizedAliases.add(alias.normalizedAlias);
  }
}

async function syncManualActivePriceRule(
  materialTypeId: string,
  materialTypeName: string,
  priceRule: {
    unit: string;
    maxAllowedUnitPriceNis?: number;
    maxAllowedTotalPriceNis?: number;
  },
) {
  if (!hasValidSeedPriceRule({ nameEn: materialTypeName, priceRule })) {
    return;
  }

  await prisma.materialPriceRule.updateMany({
    where: {
      materialTypeId,
      currency: 'NIS',
      sourceType: 'MANUAL',
      status: 'ACTIVE',
      isActive: true,
      unit: { not: priceRule.unit },
    },
    data: {
      isActive: false,
      sourceNote:
        'Deactivated by seed because the reviewed manual unit changed.',
    },
  });

  const activeRules = await prisma.materialPriceRule.findMany({
    where: {
      materialTypeId,
      currency: 'NIS',
      unit: priceRule.unit,
      status: 'ACTIVE',
      isActive: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const [ruleToUpdate, ...duplicateRules] = activeRules;

  if (duplicateRules.length > 0) {
    await prisma.materialPriceRule.updateMany({
      where: { id: { in: duplicateRules.map((rule) => rule.id) } },
      data: {
        isActive: false,
        sourceNote:
          'Deactivated by seed to avoid duplicate active rules for the same material type, currency, and unit.',
      },
    });
  }

  const data = {
    currency: 'NIS',
    unit: priceRule.unit,
    maxAllowedUnitPriceNis: priceRule.maxAllowedUnitPriceNis ?? null,
    maxAllowedTotalPriceNis: priceRule.maxAllowedTotalPriceNis ?? null,
    sourceType: 'MANUAL' as const,
    status: 'ACTIVE' as const,
    sourceNote: 'Initial MVP reviewed internal price rule',
    isActive: true,
  };

  if (ruleToUpdate) {
    await prisma.materialPriceRule.update({
      where: { id: ruleToUpdate.id },
      data,
    });
    return;
  }

  await prisma.materialPriceRule.create({
    data: {
      materialTypeId,
      ...data,
    },
  });
}

async function seedCategories() {
  const categoryIds = new Map<string, string>();

  for (const category of MATERIAL_CATEGORY_SEEDS) {
    const existing = await prisma.category.findFirst({
      where: {
        nameEn: category.nameEn,
        categoryType: 'MATERIAL',
        parentId: null,
      },
      select: { id: true },
    });

    if (existing) {
      categoryIds.set(category.nameEn, existing.id);
      continue;
    }

    const created = await prisma.category.create({
      data: {
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        categoryType: 'MATERIAL',
      },
      select: { id: true },
    });

    categoryIds.set(category.nameEn, created.id);
  }

  return categoryIds;
}

async function seedMaterialTypes(categoryIds: Map<string, string>) {
  for (const [categoryNameEn, materialTypes] of Object.entries(MATERIAL_TYPE_SEEDS)) {
    const categoryId = categoryIds.get(categoryNameEn);

    if (!categoryId) {
      continue;
    }

    for (const materialType of materialTypes) {
      const normalizedName = normalizeSearchText(materialType.nameEn);
      const existing = await prisma.materialType.findFirst({
        where: {
          categoryId,
          normalizedName,
        },
        select: { id: true },
      });

      const savedMaterialType = existing
        ? await prisma.materialType.update({
            where: { id: existing.id },
            data: {
              nameAr: materialType.nameAr ?? null,
              defaultUnit: materialType.defaultUnit,
              normalizedName,
            },
            select: { id: true },
          })
        : await prisma.materialType.create({
            data: {
              categoryId,
              nameEn: materialType.nameEn,
              nameAr: materialType.nameAr ?? null,
              normalizedName,
              defaultUnit: materialType.defaultUnit,
            },
            select: { id: true },
          });

      await syncAliases(savedMaterialType.id, materialType.aliases);
      await syncManualActivePriceRule(
        savedMaterialType.id,
        materialType.nameEn,
        materialType.priceRule,
      );
    }
  }
}

async function main() {
  const categoryIds = await seedCategories();
  await seedMaterialTypes(categoryIds);
  await seedSupplierReservations(prisma);
  await seedSupplierNotifications(prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
