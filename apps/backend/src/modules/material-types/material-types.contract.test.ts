import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';

import { getActivePriceRuleForMaterialType, searchMaterialTypes } from './material-types.service.js';
import {
  materialTypeIdParamsSchema,
  searchMaterialTypesQuerySchema,
} from './material-types.validation.js';

const TEST_MARKER = '[test-material-types-contract]';

let baseUrl = '';
let server: Server | null = null;

const ids = {
  categories: [] as string[],
  materialTypes: [] as string[],
  priceRules: [] as string[],
};

before(async () => {
  process.env.JWT_ACCESS_SECRET ??= 'material-types-contract-access-secret';
  process.env.JWT_REFRESH_SECRET ??= 'material-types-contract-refresh-secret';

  const { app } = await import('../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server!.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (ids.priceRules.length > 0) {
    await prisma.materialPriceRule.deleteMany({ where: { id: { in: ids.priceRules } } });
  }
  if (ids.materialTypes.length > 0) {
    await prisma.materialTypeAlias.deleteMany({
      where: { materialTypeId: { in: ids.materialTypes } },
    });
    await prisma.materialType.deleteMany({ where: { id: { in: ids.materialTypes } } });
  }
  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('material types validation contract', () => {
  test('search query rejects empty q and accepts optional filters', () => {
    assert.equal(searchMaterialTypesQuerySchema.safeParse({ q: '' }).success, false);
    assert.equal(searchMaterialTypesQuerySchema.safeParse({}).success, true);
    assert.equal(
      searchMaterialTypesQuerySchema.safeParse({ categoryId: 'cat-1', q: 'wire' }).success,
      true,
    );
  });

  test('params schema requires non-empty id', () => {
    assert.equal(materialTypeIdParamsSchema.safeParse({ id: '' }).success, false);
    assert.equal(materialTypeIdParamsSchema.safeParse({ id: 'type-1' }).success, true);
  });
});

describe('material types HTTP contract', () => {
  test('search endpoint is public and returns items envelope', async () => {
    const response = await fetch(`${baseUrl}/api/material-types`);
    assert.equal(response.status, 200);

    const body = (await response.json()) as {
      data: { items: unknown[] };
    };
    assert.ok(Array.isArray(body.data.items));
  });

  test('price-rule endpoint returns 404 for unknown material type', async () => {
    const response = await fetch(
      `${baseUrl}/api/material-types/clxxxxxxxxxxxxxxxxxxxxxxxxx/price-rule`,
    );
    assert.equal(response.status, 404);
  });
});

describe('material types service contract', () => {
  test('search returns active material types with price-rule flag', async () => {
    const category = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Metals`,
        nameAr: `${TEST_MARKER} معادن`,
        categoryType: 'MATERIAL',
        isActive: true,
      },
    });
    ids.categories.push(category.id);

    const materialType = await prisma.materialType.create({
      data: {
        categoryId: category.id,
        nameEn: `${TEST_MARKER} Copper Wire`,
        nameAr: `${TEST_MARKER} سلك نحاس`,
        normalizedName: `copper-wire-${Date.now()}`,
        defaultUnit: 'meter',
        isActive: true,
      },
    });
    ids.materialTypes.push(materialType.id);

    const priceRule = await prisma.materialPriceRule.create({
      data: {
        materialTypeId: materialType.id,
        unit: 'meter',
        maxAllowedUnitPriceNis: 12,
        currency: 'NIS',
        status: 'ACTIVE',
        sourceType: 'MANUAL',
        isActive: true,
      },
    });
    ids.priceRules.push(priceRule.id);

    const result = await searchMaterialTypes({
      categoryId: category.id,
      q: 'Copper',
    });

    const match = result.items.find((item) => item.id === materialType.id);
    assert.ok(match);
    assert.equal(match!.hasActivePriceRule, true);
    assert.equal(match!.defaultUnit, 'meter');
  });

  test('getActivePriceRuleForMaterialType returns dto or null and rejects missing type', async () => {
    await assert.rejects(
      () => getActivePriceRuleForMaterialType('clxxxxxxxxxxxxxxxxxxxxxxxxx'),
      (error: unknown) =>
        error instanceof AppError && error.statusCode === 404 && error.code === 'NOT_FOUND',
    );

    const category = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} No rule category`,
        nameAr: `${TEST_MARKER} بدون قاعدة`,
        categoryType: 'MATERIAL',
        isActive: true,
      },
    });
    ids.categories.push(category.id);

    const materialType = await prisma.materialType.create({
      data: {
        categoryId: category.id,
        nameEn: `${TEST_MARKER} Bare component`,
        nameAr: `${TEST_MARKER} مكون`,
        normalizedName: `bare-component-${Date.now()}`,
        defaultUnit: 'piece',
        isActive: true,
      },
    });
    ids.materialTypes.push(materialType.id);

    const withoutRule = await getActivePriceRuleForMaterialType(materialType.id);
    assert.equal(withoutRule, null);
  });
});
