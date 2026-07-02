import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';

import { getMaterialById, getMaterials } from './materials.service.js';
import { materialsQuerySchema } from './materials.validation.js';

const TEST_MARKER = '[test-materials-discovery]';

type TestContext = {
  supplierId: string;
  categoryId: string;
  otherCategoryId: string | null;
  locationId: string;
  areaLocationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdLocationIds: string[];
};

async function createSupplierUser(suffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} supplier ${suffix}`,
      email: `${TEST_MARKER}-supplier-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: 'SUPPLIER', isPrimary: true }],
      },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: `${TEST_MARKER} supplier ${suffix}`,
          verificationStatus: 'VERIFIED',
        },
      },
    },
    select: { id: true },
  });
}

async function createMaterial(
  ctx: TestContext,
  input: {
    title: string;
    description?: string;
    categoryId?: string;
    locationId?: string;
    isFree?: boolean;
    deliveryAllowed?: boolean;
    pickupAllowed?: boolean;
    viewsCount?: number;
    status?: 'AVAILABLE' | 'PENDING_RESERVATION' | 'RESERVED';
  },
) {
  const supplierProfile = await prisma.supplierProfile.findUnique({
    where: { userId: ctx.supplierId },
    select: { id: true },
  });

  const material = await prisma.material.create({
    data: {
      ownerId: ctx.supplierId,
      supplierProfileId: supplierProfile?.id,
      categoryId: input.categoryId ?? ctx.categoryId,
      locationId: input.locationId ?? ctx.locationId,
      title: input.title,
      description: input.description ?? `${input.title} description`,
      materialType: 'Discovery test material',
      quantity: 4,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status ?? 'AVAILABLE',
      isFree: input.isFree ?? true,
      deliveryAllowed: input.deliveryAllowed ?? false,
      pickupAllowed: input.pickupAllowed ?? true,
      viewsCount: input.viewsCount ?? 0,
    },
    select: { id: true },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdMaterialIds.length) {
    await prisma.material.deleteMany({
      where: { id: { in: ctx.createdMaterialIds } },
    });
  }

  if (ctx.createdLocationIds.length) {
    await prisma.location.deleteMany({
      where: { id: { in: ctx.createdLocationIds } },
    });
  }

  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe('public material discovery', () => {
  const ctx: TestContext = {
    supplierId: '',
    categoryId: '',
    otherCategoryId: null,
    locationId: '',
    areaLocationId: '',
    createdUserIds: [],
    createdMaterialIds: [],
    createdLocationIds: [],
  };

  before(async () => {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        categoryType: { in: ['MATERIAL', 'BOTH'] },
      },
      orderBy: { nameEn: 'asc' },
      take: 2,
      select: { id: true },
    });

    assert.ok(categories.length >= 1);
    ctx.categoryId = categories[0]!.id;
    ctx.otherCategoryId = categories[1]?.id ?? null;

    const cityLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: `${TEST_MARKER}-Nablus`,
        area: `${TEST_MARKER}-Industrial`,
        addressLine: 'Secret address',
        latitude: 32.2211,
        longitude: 35.2544,
        visibility: 'PRIVATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    const areaLocation = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: `${TEST_MARKER}-Ramallah`,
        area: `${TEST_MARKER}-Downtown`,
        addressLine: 'Another secret address',
        latitude: 31.9038,
        longitude: 35.2034,
        visibility: 'PRIVATE',
        isApproximate: true,
      },
      select: { id: true },
    });

    ctx.locationId = cityLocation.id;
    ctx.areaLocationId = areaLocation.id;
    ctx.createdLocationIds.push(cityLocation.id, areaLocation.id);

    const supplier = await createSupplierUser('discovery');
    ctx.supplierId = supplier.id;
    ctx.createdUserIds.push(supplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('q filter matches title', async () => {
    const unique = `${TEST_MARKER}-q-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} reclaimed panels`,
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });

    assert.ok(result.items.some((item) => item.id === material.id));
  });

  test('priceType FREE filter works', async () => {
    const unique = `${TEST_MARKER}-free-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} free stock`,
      isFree: true,
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'FREE',
      sort: 'newest',
    });

    assert.ok(result.items.some((item) => item.id === material.id));
    assert.equal(result.items.every((item) => item.isFree), true);
  });

  test('deliveryAvailable filter works', async () => {
    const unique = `${TEST_MARKER}-delivery-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} delivery stock`,
      deliveryAllowed: true,
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'ANY',
      deliveryAvailable: true,
      sort: 'newest',
    });

    assert.ok(result.items.some((item) => item.id === material.id));
    assert.equal(result.items.every((item) => item.deliveryAvailable), true);
  });

  test('pickupAllowed filter works', async () => {
    const unique = `${TEST_MARKER}-pickup-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} pickup stock`,
      pickupAllowed: true,
      deliveryAllowed: false,
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'ANY',
      pickupAllowed: true,
      sort: 'newest',
    });

    assert.ok(result.items.some((item) => item.id === material.id));
    assert.equal(result.items.every((item) => item.pickupAllowed), true);
  });

  test('categoryId filter works', async () => {
    const unique = `${TEST_MARKER}-category-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} category stock`,
      categoryId: ctx.categoryId,
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      categoryId: ctx.categoryId,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });

    assert.ok(result.items.some((item) => item.id === material.id));
    assert.equal(result.items.every((item) => item.category.id === ctx.categoryId), true);
  });

  test('city and area filters work', async () => {
    const unique = `${TEST_MARKER}-location-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} location stock`,
      locationId: ctx.areaLocationId,
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      city: `${TEST_MARKER}-Ramallah`,
      area: `${TEST_MARKER}-Downtown`,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });

    assert.ok(result.items.some((item) => item.id === material.id));
  });

  test('pagination metadata works', async () => {
    const unique = `${TEST_MARKER}-page-${Date.now()}`;
    await createMaterial(ctx, { title: `${unique} one` });
    await createMaterial(ctx, { title: `${unique} two` });

    const pageOne = await getMaterials({
      page: 1,
      limit: 1,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });

    assert.equal(pageOne.pagination.page, 1);
    assert.equal(pageOne.pagination.limit, 1);
    assert.ok(pageOne.pagination.total >= 2);
    assert.ok(pageOne.pagination.totalPages >= 2);
    assert.equal(pageOne.items.length, 1);

    const pageTwo = await getMaterials({
      page: 2,
      limit: 1,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });

    assert.equal(pageTwo.pagination.page, 2);
    assert.equal(pageTwo.items.length, 1);
    assert.notEqual(pageOne.items[0]?.id, pageTwo.items[0]?.id);
  });

  test('sort popular orders by viewsCount desc', async () => {
    const unique = `${TEST_MARKER}-popular-${Date.now()}`;
    const lowViews = await createMaterial(ctx, {
      title: `${unique} low views`,
      viewsCount: 2,
    });
    const highViews = await createMaterial(ctx, {
      title: `${unique} high views`,
      viewsCount: 42,
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'popular',
    });

    const ids = result.items.map((item) => item.id);
    assert.ok(ids.includes(lowViews.id));
    assert.ok(ids.includes(highViews.id));
    assert.equal(ids.indexOf(highViews.id) < ids.indexOf(lowViews.id), true);
  });

  test('GET material detail increments viewsCount', async () => {
    const unique = `${TEST_MARKER}-views-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} views stock`,
      viewsCount: 3,
    });

    const first = await getMaterialById(material.id);
    assert.equal(first.viewsCount, 4);

    const second = await getMaterialById(material.id);
    assert.equal(second.viewsCount, 5);
  });

  test('missing material detail does not increment viewsCount', async () => {
    const missingId = `${TEST_MARKER}-missing-${Date.now()}`;

    await assert.rejects(
      () => getMaterialById(missingId),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );

    const count = await prisma.material.count({
      where: { id: missingId },
    });
    assert.equal(count, 0);
  });

  test('condition filter works', async () => {
    const unique = `${TEST_MARKER}-condition-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} like new stock`,
    });

    await prisma.material.update({
      where: { id: material.id },
      data: { condition: 'LIKE_NEW' },
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      condition: 'LIKE_NEW',
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });

    assert.ok(result.items.some((item) => item.id === material.id));
    assert.equal(result.items.every((item) => item.condition === 'LIKE_NEW'), true);
  });

  test('priceType PAID filter works', async () => {
    const unique = `${TEST_MARKER}-paid-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} paid stock`,
      isFree: false,
    });

    await prisma.material.update({
      where: { id: material.id },
      data: { price: 25, currency: 'NIS' },
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'PAID',
      sort: 'newest',
    });

    assert.ok(result.items.some((item) => item.id === material.id));
    assert.equal(result.items.every((item) => item.isFree === false), true);
  });

  test('empty filtered results return sane pagination', async () => {
    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: `${TEST_MARKER}-no-matches-${Date.now()}`,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });

    assert.equal(result.items.length, 0);
    assert.equal(result.pagination.total, 0);
    assert.equal(result.pagination.totalPages, 0);
    assert.equal(result.pagination.page, 1);
    assert.equal(result.pagination.limit, 20);
  });

  test('invalid sort values are rejected by query validation', () => {
    const result = materialsQuerySchema.safeParse({
      page: '1',
      limit: '20',
      sort: 'distance',
    });

    assert.equal(result.success, false);
  });

  test('public list and detail omit precise pickup fields', async () => {
    const unique = `${TEST_MARKER}-privacy-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} privacy stock`,
      locationId: ctx.locationId,
    });

    const listed = (
      await getMaterials({
        page: 1,
        limit: 20,
        q: unique,
        status: 'AVAILABLE',
        priceType: 'ANY',
        sort: 'newest',
      })
    ).items.find((item) => item.id === material.id);

    assert.ok(listed);
    assert.equal(listed?.city, `${TEST_MARKER}-Nablus`);
    assert.equal(listed?.area, `${TEST_MARKER}-Industrial`);
    assert.equal('latitude' in listed!, false);
    assert.equal('longitude' in listed!, false);
    assert.equal('addressLine' in listed!, false);
    assert.equal(typeof listed?.viewsCount, 'number');

    const detail = await getMaterialById(material.id);
    assert.equal('latitude' in detail, false);
    assert.equal('longitude' in detail, false);
    assert.equal('addressLine' in detail, false);
    assert.equal(typeof detail.viewsCount, 'number');
  });

  test('public list and detail include primaryImageUrl when image exists', async () => {
    const unique = `${TEST_MARKER}-image-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} photo stock`,
    });
    const imageUrl = '/uploads/materials/test-discovery-cover.jpg';

    await prisma.materialImage.create({
      data: {
        materialId: material.id,
        imageUrl,
        sortOrder: 0,
        isCover: false,
      },
    });

    const listed = (
      await getMaterials({
        page: 1,
        limit: 20,
        q: unique,
        status: 'AVAILABLE',
        priceType: 'ANY',
        sort: 'newest',
      })
    ).items.find((item) => item.id === material.id);

    assert.ok(listed);
    assert.equal(listed?.primaryImageUrl, imageUrl);
    assert.equal(listed?.imageUrl, imageUrl);

    const detail = await getMaterialById(material.id);
    assert.ok(detail);
    assert.equal(detail.primaryImageUrl, imageUrl);
    assert.equal(detail.imageUrl, imageUrl);
    assert.equal('latitude' in detail, false);
    assert.equal('longitude' in detail, false);
  });

  test('primaryImageUrl prefers cover image over lower sort order', async () => {
    const unique = `${TEST_MARKER}-cover-pref-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} cover preference stock`,
    });
    const secondaryUrl = '/uploads/materials/secondary.jpg';
    const coverUrl = '/uploads/materials/cover.jpg';

    await prisma.materialImage.create({
      data: {
        materialId: material.id,
        imageUrl: secondaryUrl,
        sortOrder: 0,
        isCover: false,
      },
    });
    await prisma.materialImage.create({
      data: {
        materialId: material.id,
        imageUrl: coverUrl,
        sortOrder: 1,
        isCover: true,
      },
    });

    const listed = (
      await getMaterials({
        page: 1,
        limit: 20,
        q: unique,
        status: 'AVAILABLE',
        priceType: 'ANY',
        sort: 'newest',
      })
    ).items.find((item) => item.id === material.id);

    assert.ok(listed);
    assert.equal(listed?.primaryImageUrl, coverUrl);

    const detail = await getMaterialById(material.id);
    assert.ok(detail);
    assert.equal(detail.primaryImageUrl, coverUrl);
  });

  test('public detail includes extended safe fields and omits precise location', async () => {
    const unique = `${TEST_MARKER}-detail-fields-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} extended detail stock`,
      pickupAllowed: false,
      deliveryAllowed: true,
    });

    await prisma.material.update({
      where: { id: material.id },
      data: {
        pickupNotes: 'Call one hour before pickup.',
        suggestedUses: 'Useful for Arduino motor projects.',
      },
    });

    const detail = await getMaterialById(material.id);

    assert.ok(detail);
    assert.equal(detail.pickupNotes, 'Call one hour before pickup.');
    assert.equal(detail.suggestedUses, 'Useful for Arduino motor projects.');
    assert.equal(detail.sourceType, 'WORKSHOP_SURPLUS');
    assert.equal(detail.pickupAllowed, false);
    assert.equal(detail.deliveryAvailable, true);
    assert.equal(detail.supplierType, 'INDIVIDUAL_SUPPLIER');
    assert.equal(detail.supplierVerified, true);
    assert.equal('latitude' in detail, false);
    assert.equal('longitude' in detail, false);
    assert.equal('addressLine' in detail, false);
    assert.equal('ownerId' in detail, false);
    assert.equal('isOwnMaterial' in detail, false);
  });

  test('authenticated owner receives reserve enrichment on detail', async () => {
    const unique = `${TEST_MARKER}-own-material-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} own material stock`,
    });

    const detail = await getMaterialById(material.id, {
      sub: ctx.supplierId,
      roles: ['SUPPLIER'],
    }) as {
      isOwnMaterial: boolean;
      canReserve: boolean;
      reserveBlockReason: string | null;
    };

    assert.equal(detail.isOwnMaterial, true);
    assert.equal(detail.canReserve, false);
    assert.equal(detail.reserveBlockReason, 'OWN_MATERIAL');
  });

  test('public detail returns ordered images array and keeps primaryImageUrl', async () => {
    const unique = `${TEST_MARKER}-gallery-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} gallery stock`,
    });
    const secondaryUrl = '/uploads/materials/gallery-secondary.jpg';
    const coverUrl = '/uploads/materials/gallery-cover.jpg';

    await prisma.materialImage.createMany({
      data: [
        {
          materialId: material.id,
          imageUrl: secondaryUrl,
          sortOrder: 0,
          isCover: false,
        },
        {
          materialId: material.id,
          imageUrl: coverUrl,
          sortOrder: 1,
          isCover: true,
        },
      ],
    });

    const detail = await getMaterialById(material.id);

    assert.ok(Array.isArray(detail.images));
    assert.equal(detail.images.length, 2);
    assert.equal(detail.images[0]?.url, coverUrl);
    assert.equal(detail.images[0]?.isCover, true);
    assert.equal(detail.images[0]?.isPrimary, true);
    assert.equal(detail.images[1]?.url, secondaryUrl);
    assert.equal(detail.primaryImageUrl, coverUrl);
    assert.equal(detail.imageUrl, coverUrl);
    assert.equal('latitude' in detail, false);
    assert.equal('longitude' in detail, false);
    assert.equal('addressLine' in detail, false);
  });
});
