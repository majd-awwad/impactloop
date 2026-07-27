import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { NextFunction, Request, Response } from 'express';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { requireRoles } from '../../middlewares/role.middleware.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';
import { getMaterialById, getMaterials } from '../materials/materials.service.js';

import {
  followSupplierById,
  getPublicSupplierById,
  getPublicSupplierMaterials,
  unfollowSupplierById,
} from './public-suppliers.service.js';

const TEST_MARKER = '[test-public-suppliers]';

type TestContext = {
  supplierId: string;
  supplierProfileId: string;
  learnerId: string;
  otherLearnerId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdFollowerIds: string[];
  createdLocationIds: string[];
};

const ctx: TestContext = {
  supplierId: '',
  supplierProfileId: '',
  learnerId: '',
  otherLearnerId: '',
  categoryId: '',
  locationId: '',
  createdUserIds: [],
  createdMaterialIds: [],
  createdFollowerIds: [],
  createdLocationIds: [],
};

const learnerViewer = (userId: string): AccessTokenPayload => ({
  sub: userId,
  roles: ['LEARNER'],
});

async function createSupplierUser(emailSuffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');

  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} supplier ${emailSuffix}`,
      email: `${TEST_MARKER}-supplier-${emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: `${TEST_MARKER} Public Supplier ${emailSuffix}`,
          description: `${TEST_MARKER} public description`,
          avatarImageUrl: '/uploads/profiles/test-supplier-avatar.jpg',
          coverImageUrl: '/uploads/profiles/test-supplier-cover.jpg',
          verificationStatus: 'VERIFIED',
        },
      },
    },
    include: { supplierProfile: true },
  });

  ctx.createdUserIds.push(user.id);
  assert.ok(user.supplierProfile);
  return user;
}

async function createLearnerUser(emailSuffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');

  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} learner ${emailSuffix}`,
      email: `${TEST_MARKER}-learner-${emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
    },
  });

  ctx.createdUserIds.push(user.id);
  return user;
}

async function ensureCategoryAndLocation() {
  const category = await prisma.category.findFirst({
    where: { categoryType: { in: ['MATERIAL', 'BOTH'] }, isActive: true },
    select: { id: true },
  });
  assert.ok(category);
  ctx.categoryId = category.id;

  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: `${TEST_MARKER}-Nablus`,
      area: `${TEST_MARKER}-Industrial`,
      addressLine: `${TEST_MARKER} secret street 1`,
      latitude: 32.221234,
      longitude: 35.254321,
      visibility: 'ORDER_ONLY',
      isApproximate: true,
      locationType: 'MATERIAL_PICKUP',
    },
    select: { id: true },
  });
  ctx.locationId = location.id;
  ctx.createdLocationIds.push(location.id);
}

async function createMaterial(input: {
  ownerId: string;
  supplierProfileId?: string | null;
  title?: string;
  status?: 'AVAILABLE' | 'UNAVAILABLE' | 'REUSED';
  categoryId?: string;
}) {
  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      supplierProfileId:
        input.supplierProfileId === undefined
          ? ctx.supplierProfileId
          : input.supplierProfileId,
      categoryId: input.categoryId ?? ctx.categoryId,
      locationId: ctx.locationId,
      title: input.title ?? `${TEST_MARKER} Material ${Date.now()}`,
      description: `${TEST_MARKER} description`,
      materialType: 'Test',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: input.status ?? 'AVAILABLE',
      quantity: 5,
      unit: 'piece',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

function assertForbiddenPublicProfileFields(profile: Record<string, unknown>) {
  const forbiddenKeys = [
    'email',
    'phone',
    'userId',
    'user',
    'roles',
    'password',
    'refreshToken',
    'addressLine',
    'latitude',
    'longitude',
    'defaultPickupLocation',
    'organizationProfile',
    'verificationAdminNote',
    'verificationReviewedAt',
    'verificationReviewedById',
    'moderationReason',
    'invitation',
  ];

  for (const key of forbiddenKeys) {
    assert.equal(key in profile, false, `forbidden key exposed: ${key}`);
  }
}

describe('public suppliers SF-01', () => {
  before(async () => {
    await ensureCategoryAndLocation();

    const supplier = await createSupplierUser('primary');
    ctx.supplierId = supplier.id;
    ctx.supplierProfileId = supplier.supplierProfile!.id;

    const learner = await createLearnerUser('primary');
    ctx.learnerId = learner.id;

    const otherLearner = await createLearnerUser('secondary');
    ctx.otherLearnerId = otherLearner.id;
  });

  after(async () => {
    if (ctx.createdFollowerIds.length > 0) {
      await prisma.supplierFollower.deleteMany({
        where: { id: { in: ctx.createdFollowerIds } },
      });
    }

    if (ctx.createdMaterialIds.length > 0) {
      await prisma.material.deleteMany({
        where: { id: { in: ctx.createdMaterialIds } },
      });
    }

    if (ctx.createdLocationIds.length > 0) {
      await prisma.location.deleteMany({
        where: { id: { in: ctx.createdLocationIds } },
      });
    }

    if (ctx.createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: ctx.createdUserIds } },
      });
    }
  });

  test('guest can read public supplier profile with safe fields only', async () => {
    const profile = await getPublicSupplierById(ctx.supplierProfileId);

    assert.equal(profile.id, ctx.supplierProfileId);
    assert.equal(profile.displayName, `${TEST_MARKER} Public Supplier primary`);
    assert.equal(profile.isFollowedByViewer, false);
    assert.equal(typeof profile.materialsCount, 'number');
    assert.equal(typeof profile.followersCount, 'number');
    assertForbiddenPublicProfileFields(profile as Record<string, unknown>);
  });

  test('material list includes bounded supplier summary and preserves legacy fields', async () => {
    const unique = `${TEST_MARKER}-list-${Date.now()}`;
    const material = await createMaterial({
      ownerId: ctx.supplierId,
      title: `${unique} wood panels`,
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
    assert.equal(typeof listed?.supplierName, 'string');
    assert.equal('supplierType' in (listed as object), false);
    assert.equal('supplierVerified' in (listed as object), false);
    assert.equal('supplierProfile' in (listed as object), false);
    assert.equal('owner' in (listed as object), false);

    const supplier = (listed as { supplier?: Record<string, unknown> }).supplier;
    assert.ok(supplier);
    assert.equal(supplier.id, ctx.supplierProfileId);
    assert.equal(supplier.displayName, `${TEST_MARKER} Public Supplier primary`);
    assert.equal(supplier.avatarUrl, '/uploads/profiles/test-supplier-avatar.jpg');
    assert.equal(supplier.isFollowedByViewer, false);
    assert.equal('followersCount' in supplier, false);
  });

  test('material detail includes supplier summary with follower count', async () => {
    const unique = `${TEST_MARKER}-detail-${Date.now()}`;
    const material = await createMaterial({
      ownerId: ctx.supplierId,
      title: `${unique} detail stock`,
    });

    await followSupplierById(ctx.supplierProfileId, ctx.learnerId);

    const detail = await getMaterialById(
      material.id,
      learnerViewer(ctx.learnerId),
    );

    assert.equal(typeof detail.supplierName, 'string');
    assert.equal(detail.supplierType, 'INDIVIDUAL_SUPPLIER');
    assert.equal(detail.supplierVerified, true);
    assert.equal('supplierProfile' in detail, false);
    assert.equal('owner' in detail, false);

    const supplier = (detail as { supplier?: Record<string, unknown> }).supplier;
    assert.ok(supplier);
    assert.equal(supplier.id, ctx.supplierProfileId);
    assert.equal(supplier.isFollowedByViewer, true);
    assert.equal(typeof supplier.followersCount, 'number');
    assert.ok((supplier.followersCount as number) >= 1);
  });

  test('material without supplier profile omits nested supplier object', async () => {
    const orphanOwner = await createLearnerUser('orphan-owner');
    const unique = `${TEST_MARKER}-orphan-${Date.now()}`;
    const material = await createMaterial({
      ownerId: orphanOwner.id,
      supplierProfileId: null,
      title: `${unique} orphan material`,
    });

    const detail = await getMaterialById(material.id);
    assert.equal('supplier' in detail, false);
    assert.equal(typeof detail.supplierName, 'string');
  });

  test('learner follow, duplicate follow containment, and follower count', async () => {
    const before = await getPublicSupplierById(
      ctx.supplierProfileId,
      learnerViewer(ctx.otherLearnerId),
    );

    const followed = await followSupplierById(
      ctx.supplierProfileId,
      ctx.otherLearnerId,
    );
    assert.equal(followed.isFollowedByViewer, true);
    assert.equal(followed.followersCount, before.followersCount + 1);

    const duplicate = await followSupplierById(
      ctx.supplierProfileId,
      ctx.otherLearnerId,
    );
    assert.equal(duplicate.isFollowedByViewer, true);
    assert.equal(duplicate.followersCount, followed.followersCount);

    const profile = await getPublicSupplierById(
      ctx.supplierProfileId,
      learnerViewer(ctx.otherLearnerId),
    );
    assert.equal(profile.isFollowedByViewer, true);
    assert.equal(profile.followersCount, followed.followersCount);
  });

  test('unfollow and repeated unfollow remain stable', async () => {
    await followSupplierById(ctx.supplierProfileId, ctx.learnerId);
    const unfollowed = await unfollowSupplierById(
      ctx.supplierProfileId,
      ctx.learnerId,
    );
    assert.equal(unfollowed.isFollowedByViewer, false);

    const repeated = await unfollowSupplierById(
      ctx.supplierProfileId,
      ctx.learnerId,
    );
    assert.equal(repeated.isFollowedByViewer, false);
    assert.equal(repeated.followersCount, unfollowed.followersCount);
  });

  test('rejects self-follow', async () => {
    await assert.rejects(
      () => followSupplierById(ctx.supplierProfileId, ctx.supplierId),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'SELF_FOLLOW_NOT_ALLOWED');
        return true;
      },
    );
  });

  test('rejects missing supplier profile', async () => {
    const missingId = 'missing-supplier-profile-id';

    await assert.rejects(
      () => getPublicSupplierById(missingId),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );

    await assert.rejects(
      () => followSupplierById(missingId, ctx.learnerId),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('supplier materials respect existing public visibility rules', async () => {
    const visibleTitle = `${TEST_MARKER}-visible-${Date.now()}`;
    const hiddenTitle = `${TEST_MARKER}-hidden-${Date.now()}`;

    const visible = await createMaterial({
      ownerId: ctx.supplierId,
      title: visibleTitle,
      status: 'AVAILABLE',
    });
    const hidden = await createMaterial({
      ownerId: ctx.supplierId,
      title: hiddenTitle,
      status: 'UNAVAILABLE',
    });

    const inactiveCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} inactive`,
        nameAr: `${TEST_MARKER} inactive`,
        categoryType: 'MATERIAL',
        isActive: false,
      },
      select: { id: true },
    });

    const inactiveCategoryMaterial = await createMaterial({
      ownerId: ctx.supplierId,
      title: `${TEST_MARKER}-inactive-cat-${Date.now()}`,
      categoryId: inactiveCategory.id,
    });

    const result = await getPublicSupplierMaterials(ctx.supplierProfileId, {
      page: 1,
      limit: 50,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });

    const ids = result.items.map((item) => item.id);
    assert.ok(ids.includes(visible.id));
    assert.equal(ids.includes(hidden.id), false);
    assert.equal(ids.includes(inactiveCategoryMaterial.id), false);

    await prisma.material.delete({
      where: { id: inactiveCategoryMaterial.id },
    });
    ctx.createdMaterialIds = ctx.createdMaterialIds.filter(
      (id) => id !== inactiveCategoryMaterial.id,
    );
    await prisma.category.delete({ where: { id: inactiveCategory.id } });
  });

  test('isFollowedByViewer is false for guests and non-learners', async () => {
    await followSupplierById(ctx.supplierProfileId, ctx.learnerId);

    const guestProfile = await getPublicSupplierById(ctx.supplierProfileId);
    assert.equal(guestProfile.isFollowedByViewer, false);

    const supplierViewer: AccessTokenPayload = {
      sub: ctx.supplierId,
      roles: ['SUPPLIER'],
    };
    const supplierView = await getPublicSupplierById(
      ctx.supplierProfileId,
      supplierViewer,
    );
    assert.equal(supplierView.isFollowedByViewer, false);
  });

  test('follow route guards reject guest and non-learner mutations', () => {
    const middleware = requireRoles('LEARNER');
    const unauthenticatedReq = {} as Request;
    let unauthenticatedError: unknown;
    middleware(unauthenticatedReq, {} as Response, ((error?: unknown) => {
      unauthenticatedError = error;
    }) as NextFunction);
    assert.ok(unauthenticatedError);
    assert.equal((unauthenticatedError as AppError).statusCode, 401);

    const supplierReq = {
      auth: { sub: ctx.supplierId, roles: ['SUPPLIER'] },
    } as unknown as Request;
    let supplierError: unknown;
    middleware(supplierReq, {} as Response, ((error?: unknown) => {
      supplierError = error;
    }) as NextFunction);
    assert.ok(supplierError);
    assert.equal((supplierError as AppError).statusCode, 403);
  });

  test('supplier follow service does not invalidate learner home cache', () => {
    const source = readFileSync(
      new URL('./public-suppliers.service.ts', import.meta.url),
      'utf8',
    );
    const forbiddenToken = ['invalidate', 'LearnerHomeCache'].join('');

    assert.equal(source.includes(forbiddenToken), false);
  });

  test('supplier follow service does not reference recommendation emitters', () => {
    const source = readFileSync(
      new URL('./public-suppliers.service.ts', import.meta.url),
      'utf8',
    );

    assert.equal(source.includes('recommendation'), false);
    assert.equal(source.includes('LightFM'), false);
    assert.equal(source.includes('ranking'), false);
  });
});
