import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import {
  createSupplierMaterial,
  deleteSupplierMaterial,
  getSupplierMaterial,
  getSupplierMaterials,
  updateSupplierMaterial,
} from './supplier.service.js';
import { AppError } from '../../utils/app-error.js';
import {
  createSupplierMaterialSchema,
  updateSupplierMaterialSchema,
} from './supplier.validation.js';

const TEST_MARKER = '[test-supplier-materials]';

type TestContext = {
  supplierId: string;
  otherSupplierId: string;
  categoryId: string;
  locationId: string;
  createdMaterialIds: string[];
  createdUserIds: string[];
  createdReservationIds: string[];
  learnerId: string;
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
  if (ctx.createdReservationIds.length) {
    await prisma.reservationStatusHistory.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: ctx.createdReservationIds } },
    });
  }

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
    createdReservationIds: [],
    learnerId: '',
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
    const learner = await prisma.user.findFirst({
      where: { roles: { some: { role: 'LEARNER' } } },
      select: { id: true },
    });

    assert.ok(learner, 'Expected at least one learner user');

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.learnerId = learner.id;
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

  test('includes delete eligibility in list items', async () => {
    const available = await createMaterial(
      ctx,
      ctx.supplierId,
      'delete-eligible',
      'AVAILABLE',
    );
    const reused = await createMaterial(
      ctx,
      ctx.supplierId,
      'delete-blocked-reused',
      'REUSED',
    );

    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      search: 'delete-',
    });

    const availableItem = result.items.find((item) => item.id === available.id);
    const reusedItem = result.items.find((item) => item.id === reused.id);

    assert.ok(availableItem);
    assert.equal(availableItem.canDelete, true);
    assert.equal(availableItem.deleteBlockedReason, null);

    assert.ok(reusedItem);
    assert.equal(reusedItem.canDelete, false);
    assert.equal(reusedItem.deleteBlockedReason, 'REUSED_HISTORY');
  });
});

describe('createSupplierMaterial', () => {
  const ctx: TestContext = {
    supplierId: '',
    otherSupplierId: '',
    categoryId: '',
    locationId: '',
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: '',
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${TEST_MARKER}-create`,
        visibility: 'PRIVATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser('create');

    assert.ok(category);
    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.createdUserIds.push(supplier.id);

    await prisma.supplierProfile.update({
      where: { userId: supplier.id },
      data: {
        supplierType: 'WORKSHOP',
        defaultPickupLocationId: location.id,
      },
    });
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.location.deleteMany({ where: { id: ctx.locationId } });
  });

  test('requires at least one material image in create schema', () => {
    const basePayload = {
      materialName: 'Test material',
      title: 'Reusable test material',
      description: 'Reusable test material description.',
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      isFree: true,
      price: null,
      currency: 'NIS',
      pickupAllowed: true,
      deliveryAllowed: false,
    };

    assert.equal(createSupplierMaterialSchema.safeParse(basePayload).success, false);
    assert.equal(
      createSupplierMaterialSchema.safeParse({
        ...basePayload,
        imageUrls: [],
      }).success,
      false,
    );
    assert.equal(
      createSupplierMaterialSchema.safeParse({
        ...basePayload,
        imageUrls: ['/uploads/materials/test-create.jpg'],
      }).success,
      true,
    );
  });

  test('derives source type from supplier profile and ignores client value', async () => {
    const material = await createSupplierMaterial(ctx.supplierId, {
      materialName: 'Unmatched create material',
      title: `${TEST_MARKER} create source derivation`,
      description: `${TEST_MARKER} create source derivation description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'FACTORY_SURPLUS',
      isFree: true,
      price: null,
      currency: 'NIS',
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ['/uploads/materials/test-create-source.jpg'],
    });
    ctx.createdMaterialIds.push(material.id);

    const persisted = await prisma.material.findUnique({
      where: { id: material.id },
      select: { sourceType: true, images: true },
    });

    assert.equal(persisted?.sourceType, 'WORKSHOP_SURPLUS');
    assert.equal(persisted?.images.length, 1);
  });
});

describe('getSupplierMaterial', () => {
  const ctx: TestContext = {
    supplierId: '',
    otherSupplierId: '',
    categoryId: '',
    locationId: '',
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: '',
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${TEST_MARKER}-single`,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser('single');
    const otherSupplier = await createSupplierUser('single-other');

    assert.ok(category);
    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.createdUserIds.push(supplier.id, otherSupplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('returns owned material by id', async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      'single-owned',
      'AVAILABLE',
    );

    const result = await getSupplierMaterial(ctx.supplierId, material.id);

    assert.equal(result.id, material.id);
    assert.match(result.title, /single-owned/);
    assert.ok(result.category);
    assert.ok(Array.isArray(result.images));
  });

  test('rejects another supplier material', async () => {
    const material = await createMaterial(
      ctx,
      ctx.otherSupplierId,
      'single-other',
      'AVAILABLE',
    );

    await assert.rejects(
      () => getSupplierMaterial(ctx.supplierId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });
});

describe('updateSupplierMaterial', () => {
  const ctx: TestContext = {
    supplierId: '',
    otherSupplierId: '',
    categoryId: '',
    locationId: '',
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: '',
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${TEST_MARKER}-update`,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser('update');
    const otherSupplier = await createSupplierUser('update-other');

    assert.ok(category);
    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.createdUserIds.push(supplier.id, otherSupplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('updates safe editable fields for owned material', async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      'editable-item',
      'AVAILABLE',
    );

    const before = await prisma.material.findUnique({
      where: { id: material.id },
      select: { categoryId: true, isFree: true, price: true },
    });

    const updated = await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: `${TEST_MARKER} Updated title`,
      description: `${TEST_MARKER} Updated description`,
      quantity: 7,
      unit: 'packs',
      condition: 'LIKE_NEW',
      pickupAllowed: false,
      deliveryAllowed: false,
      pickupNotes: 'Ring bell on arrival',
      suggestedUses: 'Student robotics kits',
    });

    assert.equal(updated.title, `${TEST_MARKER} Updated title`);
    assert.equal(updated.quantity, 7);
    assert.equal(updated.unit, 'packs');
    assert.equal(updated.condition, 'LIKE_NEW');
    assert.equal(updated.pickupNotes, 'Ring bell on arrival');

    const after = await prisma.material.findUnique({
      where: { id: material.id },
      select: { categoryId: true, isFree: true, price: true },
    });

    assert.deepEqual(after, before);
  });

  test('rejects editing another supplier material', async () => {
    const material = await createMaterial(
      ctx,
      ctx.otherSupplierId,
      'not-editable',
      'AVAILABLE',
    );

    await assert.rejects(
      () =>
        updateSupplierMaterial(ctx.supplierId, material.id, {
          title: 'Hacked',
          description: 'Hacked',
          quantity: 1,
          unit: 'piece',
          condition: 'GOOD',
          pickupAllowed: true,
          deliveryAllowed: false,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('rejects invalid quantity in request schema', () => {
    const result = updateSupplierMaterialSchema.safeParse({
      title: 'Valid title',
      description: 'Valid description',
      quantity: 0,
      unit: 'piece',
      condition: 'GOOD',
      pickupAllowed: true,
      deliveryAllowed: false,
    });

    assert.equal(result.success, false);
  });

  test('does not create duplicate material on update', async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      'no-duplicate',
      'AVAILABLE',
    );

    const countBefore = await prisma.material.count({
      where: { ownerId: ctx.supplierId },
    });

    await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: `${TEST_MARKER} no-duplicate-updated`,
      description: `${TEST_MARKER} no-duplicate description`,
      quantity: 4,
      unit: 'pack',
      condition: 'GOOD',
      pickupAllowed: true,
      deliveryAllowed: false,
    });

    const countAfter = await prisma.material.count({
      where: { ownerId: ctx.supplierId },
    });

    assert.equal(countBefore, countAfter);
  });

  test('read-only fields remain unchanged after update', async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      'readonly-check',
      'AVAILABLE',
      false,
    );

    const before = await prisma.material.findUnique({
      where: { id: material.id },
      select: {
        ownerId: true,
        categoryId: true,
        isFree: true,
        price: true,
        locationId: true,
      },
    });

    await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: `${TEST_MARKER} readonly-updated`,
      description: `${TEST_MARKER} readonly description`,
      quantity: 9,
      unit: 'kit',
      condition: 'USED',
      pickupAllowed: false,
      deliveryAllowed: true,
      pickupNotes: 'Updated notes',
      suggestedUses: 'Updated uses',
    });

    const after = await prisma.material.findUnique({
      where: { id: material.id },
      select: {
        ownerId: true,
        categoryId: true,
        isFree: true,
        price: true,
        locationId: true,
      },
    });

    assert.deepEqual(after, before);
  });
});

describe('deleteSupplierMaterial', () => {
  const ctx: TestContext = {
    supplierId: '',
    otherSupplierId: '',
    categoryId: '',
    locationId: '',
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: '',
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: 'Nablus',
        area: `${TEST_MARKER}-delete`,
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser('delete');
    const otherSupplier = await createSupplierUser('delete-other');
    const learner = await prisma.user.findFirst({
      where: { roles: { some: { role: 'LEARNER' } } },
      select: { id: true },
    });

    assert.ok(category);
    assert.ok(learner);

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.learnerId = learner.id;
    ctx.createdUserIds.push(supplier.id, otherSupplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test('deletes AVAILABLE material without reservation history', async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      'delete-available',
      'AVAILABLE',
    );

    await deleteSupplierMaterial(ctx.supplierId, material.id);

    const deleted = await prisma.material.findUnique({
      where: { id: material.id },
    });

    assert.equal(deleted, null);
    ctx.createdMaterialIds = ctx.createdMaterialIds.filter(
      (id) => id !== material.id,
    );
  });

  test('rejects REUSED material', async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      'delete-reused',
      'REUSED',
    );

    await assert.rejects(
      () => deleteSupplierMaterial(ctx.supplierId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /reused material history/i);
        return true;
      },
    );
  });

  test('rejects material with completed reservation history', async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      'delete-with-completed',
      'AVAILABLE',
    );

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ctx.createdReservationIds.push(reservation.id);

    await assert.rejects(
      () => deleteSupplierMaterial(ctx.supplierId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /active requests/i);
        return true;
      },
    );
  });
});
