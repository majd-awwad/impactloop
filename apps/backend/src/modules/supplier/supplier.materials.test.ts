import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import { getSupplierMaterials } from './supplier.service.js';

const TEST_MARKER = '[test-supplier-materials]';

type TestContext = {
  supplierId: string;
  otherSupplierId: string;
  categoryId: string;
  locationId: string;
  createdMaterialIds: string[];
  createdUserIds: string[];
};

async function createSupplierUser(emailSuffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} supplier ${emailSuffix}`,
      email: `${TEST_MARKER}-${emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: 'SUPPLIER', isPrimary: true }],
      },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: `${TEST_MARKER} Workshop ${emailSuffix}`,
          verificationStatus: 'VERIFIED',
        },
      },
    },
    include: { supplierProfile: true },
  });
}

async function createMaterial(
  ctx: TestContext,
  ownerId: string,
  title: string,
  status:
    | 'AVAILABLE'
    | 'PENDING_RESERVATION'
    | 'RESERVED'
    | 'REUSED'
    | 'UNAVAILABLE' = 'AVAILABLE',
  isFree = false,
) {
  const profile = await prisma.supplierProfile.findUnique({
    where: { userId: ownerId },
    select: { id: true },
  });

  const material = await prisma.material.create({
    data: {
      ownerId,
      supplierProfileId: profile?.id,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} ${title}`,
      description: `${TEST_MARKER} ${title} description`,
      materialType: 'Test material',
      quantity: 2,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status,
      isFree,
      price: isFree ? null : 15,
    },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdMaterialIds.length) {
    await prisma.materialImage.deleteMany({
      where: { materialId: { in: ctx.createdMaterialIds } },
    });
    await prisma.material.deleteMany({
      where: { id: { in: ctx.createdMaterialIds } },
    });
  }

  if (ctx.createdUserIds.length) {
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.supplierProfile.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('getSupplierMaterials', () => {
  const defaultQuery = {
    page: 1,
    limit: 100,
    isFree: undefined,
  } as const;

  const ctx: TestContext = {
    supplierId: '',
    otherSupplierId: '',
    categoryId: '',
    locationId: '',
    createdMaterialIds: [],
    createdUserIds: [],
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });

    assert.ok(category, 'Expected at least one material category');

    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: TEST_MARKER,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });

    const supplier = await createSupplierUser('primary');
    const otherSupplier = await createSupplierUser('other');

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.createdUserIds.push(supplier.id, otherSupplier.id);

    for (let index = 0; index < 11; index += 1) {
      await createMaterial(ctx, ctx.supplierId, `owned-${index}`);
    }

    await createMaterial(ctx, ctx.otherSupplierId, 'other-supplier');
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.location.deleteMany({ where: { id: ctx.locationId } });
  });

  test('returns only materials owned by the supplier', async () => {
    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
    });

    assert.ok(result.items.length >= 11);
    assert.ok(
      result.items.every((item) => item.title.includes(TEST_MARKER)),
    );
    assert.ok(
      result.items.every((item) => !item.title.includes('other-supplier')),
    );
  });

  test('paginates results', async () => {
    const page1 = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      limit: 5,
    });
    const page2 = await getSupplierMaterials(ctx.supplierId, {
      page: 2,
      limit: 5,
      isFree: undefined,
    });

    assert.equal(page1.pagination.page, 1);
    assert.equal(page1.pagination.limit, 5);
    assert.ok(page1.pagination.totalItems >= 11);
    assert.ok(page1.pagination.totalPages >= 3);
    assert.equal(page1.items.length, 5);
    assert.equal(page2.items.length, 5);
    assert.notEqual(page1.items[0]?.id, page2.items[0]?.id);
  });

  test('filters by status', async () => {
    await createMaterial(
      ctx,
      ctx.supplierId,
      'reserved-item',
      'RESERVED',
    );

    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      status: 'RESERVED',
    });

    assert.ok(result.items.length >= 1);
    assert.ok(result.items.every((item) => item.status === 'RESERVED'));
  });

  test('searches by title', async () => {
    await createMaterial(ctx, ctx.supplierId, 'unique-search-term');

    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      search: 'unique-search-term',
    });

    assert.equal(result.items.length, 1);
    assert.match(result.items[0]!.title, /unique-search-term/);
  });

  test('filters by categoryId', async () => {
    const secondCategory = await prisma.category.findFirst({
      where: {
        categoryType: { in: ['MATERIAL', 'BOTH'] },
        id: { not: ctx.categoryId },
      },
      select: { id: true },
    });

    assert.ok(secondCategory, 'Expected a second material category');

    await createMaterial(ctx, ctx.supplierId, 'category-a');
    const categorized = await createMaterial(
      ctx,
      ctx.supplierId,
      'category-b',
    );
    await prisma.material.update({
      where: { id: categorized.id },
      data: { categoryId: secondCategory.id },
    });

    const filtered = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      categoryId: secondCategory.id,
    });

    assert.ok(filtered.items.length >= 1);
    assert.ok(
      filtered.items.every((item) => item.category?.id === secondCategory.id),
    );
    assert.ok(filtered.categories.some((category) => category.count > 0));
    assert.ok(
      filtered.categoryFacets.some((category) => category.count > 0),
    );
  });

  test('categoryFacets reflect supplier-owned materials only', async () => {
    const secondCategory = await prisma.category.findFirst({
      where: {
        categoryType: { in: ['MATERIAL', 'BOTH'] },
        id: { not: ctx.categoryId },
      },
      select: { id: true },
    });

    assert.ok(secondCategory, 'Expected a second material category');

    const otherMaterial = await createMaterial(
      ctx,
      ctx.otherSupplierId,
      'other-supplier-only',
    );
    await prisma.material.update({
      where: { id: otherMaterial.id },
      data: { categoryId: secondCategory.id },
    });

    const supplierCountInSecondCategory = await prisma.material.count({
      where: {
        ownerId: ctx.supplierId,
        categoryId: secondCategory.id,
      },
    });

    const result = await getSupplierMaterials(ctx.supplierId, defaultQuery);
    const facet = result.categoryFacets.find(
      (entry) => entry.id === secondCategory.id,
    );

    if (supplierCountInSecondCategory === 0) {
      assert.equal(facet, undefined);
    } else {
      assert.ok(facet);
      assert.equal(facet.count, supplierCountInSecondCategory);
    }
  });

  test('filters by isFree', async () => {
    await createMaterial(ctx, ctx.supplierId, 'paid-item', 'AVAILABLE', false);
    await createMaterial(ctx, ctx.supplierId, 'free-item', 'AVAILABLE', true);

    const freeResult = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      isFree: true,
    });

    assert.ok(freeResult.items.length >= 1);
    assert.ok(freeResult.items.every((item) => item.isFree));
  });

  test('includes images in list items', async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      'with-image',
    );

    await prisma.materialImage.create({
      data: {
        materialId: material.id,
        imageUrl:
          'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
        isCover: true,
      },
    });

    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      search: 'with-image',
    });

    assert.equal(result.items.length, 1);
    assert.ok(result.items[0]!.images.length >= 1);
    assert.ok(result.items[0]!.images[0]!.imageUrl.length > 0);
  });
});
