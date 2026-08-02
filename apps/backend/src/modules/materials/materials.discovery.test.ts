import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';
import {
  getOrBuildMaterialFeaturePool,
  resetMaterialFeaturePoolCacheForTests,
} from '../learner-home/learner-home.material-features.js';
import {
  getLearnerHome,
  invalidateAllLearnerHomeResponseCaches,
  invalidateLearnerHomeCache,
  invalidateLearnerHomeForReservationTransition,
} from '../learner-home/learner-home.service.js';
import type { LearnerHomeMaterialCandidate } from '../learner-home/learner-home.types.js';
import { runWithRecommendationEventOrigin } from '../recommendation-events/recommendation-event-origin.js';
import {
  recommendationToggleDeduplicationKey,
  runWithRecommendationToggleRequestContext,
} from '../recommendation-events/recommendation-events.service.js';

import {
  getMaterialById,
  getMaterialViewerState,
  getMaterials,
  getLikedMaterials,
  likeMaterialById,
  unlikeMaterialById,
  recordMaterialViewById,
} from './materials.service.js';
import {
  likedMaterialsQuerySchema,
  materialsQuerySchema,
} from './materials.validation.js';

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
  createdOutboxDeduplicationKeys: string[];
};

let toggleOperationSequence = 0;

async function runMaterialToggleOperation<T>(
  ctx: TestContext,
  learnerId: string,
  operation: () => Promise<T>,
) {
  const key = `${TEST_MARKER}-toggle-${Date.now()}-${++toggleOperationSequence}`;
  ctx.createdOutboxDeduplicationKeys.push(
    recommendationToggleDeduplicationKey(learnerId, key),
  );

  return runWithRecommendationEventOrigin('TEST', () =>
    runWithRecommendationToggleRequestContext(
      { headers: { 'idempotency-key': key } },
      operation,
    ),
  );
}

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

async function createLearnerUser(suffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: 'LEARNER', isPrimary: true }],
      },
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
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
  if (ctx.createdOutboxDeduplicationKeys.length) {
    await prisma.recommendationEventOutbox.deleteMany({
      where: {
        deduplicationKey: { in: ctx.createdOutboxDeduplicationKeys },
      },
    });
  }

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
    createdOutboxDeduplicationKeys: [],
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

  test('nearest sort orders by viewer distance without exposing exact coordinates', async () => {
    const unique = `${TEST_MARKER}-nearest-${Date.now()}`;
    const farMaterial = await createMaterial(ctx, {
      title: `${unique} far stock`,
      locationId: ctx.locationId,
    });
    const nearMaterial = await createMaterial(ctx, {
      title: `${unique} near stock`,
      locationId: ctx.areaLocationId,
    });

    const result = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'nearest',
      latitude: 31.904,
      longitude: 35.204,
    });

    const ids = result.items.map((item) => item.id);
    assert.equal(ids[0], nearMaterial.id);
    assert.ok(ids.indexOf(nearMaterial.id) < ids.indexOf(farMaterial.id));

    const listedNear = result.items.find((item) => item.id === nearMaterial.id);
    assert.ok(listedNear);
    const listedNearRecord = listedNear as Record<string, unknown>;
    assert.equal('latitude' in listedNear!, false);
    assert.equal('longitude' in listedNear!, false);
    assert.equal('addressLine' in listedNear!, false);
    assert.equal('location' in listedNear!, false);
    assert.equal(listedNearRecord.approximateLatitude, 31.9);
    assert.equal(listedNearRecord.approximateLongitude, 35.2);
    assert.equal(typeof listedNearRecord.approximateDistanceKm, 'number');
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

  test('GET material detail is pure and explicit views are idempotent', async () => {
    const unique = `${TEST_MARKER}-views-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} views stock`,
      viewsCount: 3,
    });

    const first = await getMaterialById(material.id);
    assert.equal(first.viewsCount, 3);

    const second = await getMaterialById(material.id);
    assert.equal(second.viewsCount, 3);

    await recordMaterialViewById(material.id, `${unique}-operation-1`);
    const replay = await recordMaterialViewById(
      material.id,
      `${unique}-operation-1`,
    );
    assert.equal(replay.recorded, false);
    await recordMaterialViewById(material.id, `${unique}-operation-2`);

    const viewRows = await prisma.materialView.count({
      where: { materialId: material.id },
    });
    assert.equal(viewRows, 2);
  });

  test('viewer state exposes likes and explicit authenticated views deduplicate', async () => {
    const unique = `${TEST_MARKER}-viewer-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} viewer stock`,
    });
    const learner = await createLearnerUser(`viewer-${Date.now()}`);
    ctx.createdUserIds.push(learner.id);

    await runMaterialToggleOperation(ctx, learner.id, () =>
      likeMaterialById(material.id, learner.id),
    );

    const viewer: AccessTokenPayload = {
      sub: learner.id,
      roles: ['LEARNER'],
    };
    const detail = await getMaterialViewerState(material.id, viewer);

    assert.equal(detail.isLiked, true);
    await runWithRecommendationEventOrigin('TEST', () =>
      recordMaterialViewById(material.id, `${unique}-view`, viewer),
    );

    const historicalView = await prisma.materialView.findFirstOrThrow({
      where: { materialId: material.id, viewerUserId: learner.id },
      select: { id: true, createdAt: true },
    });

    const repeat = await runWithRecommendationEventOrigin('TEST', () =>
      recordMaterialViewById(material.id, `${unique}-view`, viewer),
    );
    assert.equal(repeat.recorded, true);

    const trackedViews = await prisma.materialView.findMany({
      where: { materialId: material.id, viewerUserId: learner.id },
      orderBy: { createdAt: 'asc' },
    });
    assert.equal(trackedViews.length, 1);
    assert.equal(trackedViews[0]?.id, historicalView.id);
    assert.equal(
      trackedViews[0]?.createdAt.toISOString(),
      historicalView.createdAt.toISOString(),
    );
  });

  test('material likes are idempotent and exposed on list/detail', async () => {
    const unique = `${TEST_MARKER}-likes-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} liked stock`,
    });
    const learner = await createLearnerUser(`likes-${Date.now()}`);
    ctx.createdUserIds.push(learner.id);

    const liked = await runMaterialToggleOperation(ctx, learner.id, () =>
      likeMaterialById(material.id, learner.id),
    );
    const likedAgain = await runMaterialToggleOperation(ctx, learner.id, () =>
      likeMaterialById(material.id, learner.id),
    );
    assert.equal(liked.likesCount, 1);
    assert.equal(likedAgain.likesCount, 1);
    assert.equal(likedAgain.isLiked, true);

    const authenticatedList = await getMaterials(
      {
        page: 1,
        limit: 20,
        q: unique,
        status: 'AVAILABLE',
        priceType: 'ANY',
        sort: 'newest',
      },
      { sub: learner.id, roles: ['LEARNER'] },
    );
    const authenticatedItem = authenticatedList.items.find(
      (item) => item.id === material.id,
    );
    assert.ok(authenticatedItem);
    assert.equal(authenticatedItem?.likesCount, 1);
    assert.equal(authenticatedItem?.isLiked, true);

    const publicList = await getMaterials({
      page: 1,
      limit: 20,
      q: unique,
      status: 'AVAILABLE',
      priceType: 'ANY',
      sort: 'newest',
    });
    const publicItem = publicList.items.find((item) => item.id === material.id);
    assert.ok(publicItem);
    assert.equal(publicItem?.likesCount, 1);
    assert.equal(publicItem?.isLiked, false);

    const unliked = await runMaterialToggleOperation(ctx, learner.id, () =>
      unlikeMaterialById(material.id, learner.id),
    );
    const unlikedAgain = await runMaterialToggleOperation(ctx, learner.id, () =>
      unlikeMaterialById(material.id, learner.id),
    );
    assert.equal(unliked.likesCount, 0);
    assert.equal(unliked.isLiked, false);
    assert.equal(unlikedAgain.likesCount, 0);
    assert.equal(unlikedAgain.isLiked, false);
  });

  test('liked collection is user-scoped, visible, ordered, and bounded', async () => {
    const unique = `${TEST_MARKER}-collection-${Date.now()}`;
    const learner = await createLearnerUser(`collection-${Date.now()}`);
    const otherLearner = await createLearnerUser(
      `collection-other-${Date.now()}`,
    );
    ctx.createdUserIds.push(learner.id, otherLearner.id);

    const oldMaterial = await createMaterial(ctx, {
      title: `${unique} old`,
    });
    const middleMaterial = await createMaterial(ctx, {
      title: `${unique} middle`,
      status: 'PENDING_RESERVATION',
    });
    const newestMaterial = await createMaterial(ctx, {
      title: `${unique} newest`,
      status: 'RESERVED',
    });
    const hiddenMaterial = await createMaterial(ctx, {
      title: `${unique} unavailable`,
    });
    const otherMaterial = await createMaterial(ctx, {
      title: `${unique} other learner`,
    });

    await prisma.materialLike.createMany({
      data: [
        {
          userId: learner.id,
          materialId: oldMaterial.id,
          createdAt: new Date('2026-07-27T00:00:00.000Z'),
        },
        {
          userId: learner.id,
          materialId: middleMaterial.id,
          createdAt: new Date('2026-07-28T00:00:00.000Z'),
        },
        {
          userId: learner.id,
          materialId: newestMaterial.id,
          createdAt: new Date('2026-07-29T00:00:00.000Z'),
        },
        {
          userId: learner.id,
          materialId: hiddenMaterial.id,
          createdAt: new Date('2026-07-30T00:00:00.000Z'),
        },
        {
          userId: otherLearner.id,
          materialId: otherMaterial.id,
          createdAt: new Date('2026-07-31T00:00:00.000Z'),
        },
      ],
    });
    await prisma.material.update({
      where: { id: hiddenMaterial.id },
      data: { status: 'UNAVAILABLE' },
    });

    const firstPage = await getLikedMaterials(learner.id, {
      page: 1,
      limit: 2,
    });
    assert.deepEqual(
      firstPage.items.map((item) => item.material.id),
      [newestMaterial.id, middleMaterial.id],
    );
    assert.equal(firstPage.items.every((item) => item.material.isLiked), true);
    assert.deepEqual(firstPage.pagination, {
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    const secondPage = await getLikedMaterials(learner.id, {
      page: 2,
      limit: 2,
    });
    assert.deepEqual(
      secondPage.items.map((item) => item.material.id),
      [oldMaterial.id],
    );
    assert.equal(
      firstPage.items.some((item) => item.material.id === otherMaterial.id),
      false,
    );
    assert.deepEqual(likedMaterialsQuerySchema.parse({}), {
      page: 1,
      limit: 20,
    });
    assert.throws(() => likedMaterialsQuerySchema.parse({ limit: 101 }));
  });

  test('material like and unlike invalidate only the acting learner home cache', async () => {
    const unique = `${TEST_MARKER}-home-cache-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} Arduino Uno`,
    });
    const learnerA = await createLearnerUser(`home-cache-a-${Date.now()}`);
    const learnerB = await createLearnerUser(`home-cache-b-${Date.now()}`);
    ctx.createdUserIds.push(learnerA.id, learnerB.id);

    const learnerAHome = await getLearnerHome(learnerA.id);
    const learnerBHome = await getLearnerHome(learnerB.id);

    const featureCandidate: LearnerHomeMaterialCandidate = {
      id: 'shared-feature-material',
      ownerId: ctx.supplierId,
      title: 'Shared feature material',
      description: 'Shared recommendation feature cache fixture',
      materialType: 'Electronics component',
      categoryId: ctx.categoryId,
      categoryNameEn: 'Electronics',
      categoryNameAr: 'Electronics',
      status: 'AVAILABLE',
      isFree: true,
      deliveryAllowed: false,
      pickupAllowed: true,
      viewsCount: 0,
      likesCount: 0,
      city: 'Nablus',
      area: null,
      tags: ['arduino'],
      createdAt: new Date(),
      availableQuantity: 1,
      mapped: {},
    };
    resetMaterialFeaturePoolCacheForTests();
    const sharedFeaturesBefore = getOrBuildMaterialFeaturePool([
      featureCandidate,
    ]);

    await runMaterialToggleOperation(ctx, learnerA.id, () =>
      likeMaterialById(material.id, learnerA.id),
    );

    const sharedFeaturesAfterLike = getOrBuildMaterialFeaturePool([
      featureCandidate,
    ]);

    const learnerAAfterLike = await getLearnerHome(learnerA.id);
    const learnerBAfterLike = await getLearnerHome(learnerB.id);

    assert.notStrictEqual(learnerAAfterLike, learnerAHome);
    assert.strictEqual(learnerBAfterLike, learnerBHome);
    assert.strictEqual(
      sharedFeaturesAfterLike.features,
      sharedFeaturesBefore.features,
    );

    resetMaterialFeaturePoolCacheForTests();
    const sharedFeaturesBeforeUnlike = getOrBuildMaterialFeaturePool([
      featureCandidate,
    ]);
    await runMaterialToggleOperation(ctx, learnerA.id, () =>
      unlikeMaterialById(material.id, learnerA.id),
    );
    const sharedFeaturesAfterUnlike = getOrBuildMaterialFeaturePool([
      featureCandidate,
    ]);

    const learnerAAfterUnlike = await getLearnerHome(learnerA.id);
    const learnerBAfterUnlike = await getLearnerHome(learnerB.id);

    assert.notStrictEqual(learnerAAfterUnlike, learnerAAfterLike);
    assert.strictEqual(learnerBAfterUnlike, learnerBHome);
    assert.strictEqual(
      sharedFeaturesAfterUnlike.features,
      sharedFeaturesBeforeUnlike.features,
    );
    assert.doesNotThrow(() => invalidateLearnerHomeCache('missing-learner'));
    resetMaterialFeaturePoolCacheForTests();
  });

  test('failed material like and unlike leave the learner home cache intact', async () => {
    const learner = await createLearnerUser(`failed-home-cache-${Date.now()}`);
    ctx.createdUserIds.push(learner.id);
    const cachedHome = await getLearnerHome(learner.id);
    const missingMaterialId = `${TEST_MARKER}-missing-like-${Date.now()}`;

    await assert.rejects(() =>
      runMaterialToggleOperation(ctx, learner.id, () =>
        likeMaterialById(missingMaterialId, learner.id),
      ),
    );
    assert.strictEqual(await getLearnerHome(learner.id), cachedHome);

    await assert.rejects(() =>
      runMaterialToggleOperation(ctx, learner.id, () =>
        unlikeMaterialById(missingMaterialId, learner.id),
      ),
    );
    assert.strictEqual(await getLearnerHome(learner.id), cachedHome);
  });

  test('availability-changing reservation transitions clear every learner home response cache', async () => {
    const learnerA = await createLearnerUser(`reservation-cache-a-${Date.now()}`);
    const learnerB = await createLearnerUser(`reservation-cache-b-${Date.now()}`);
    ctx.createdUserIds.push(learnerA.id, learnerB.id);

    const learnerAHome = await getLearnerHome(learnerA.id);
    const learnerBHome = await getLearnerHome(learnerB.id);

    invalidateLearnerHomeForReservationTransition('PENDING', 'ACCEPTED');
    assert.strictEqual(await getLearnerHome(learnerA.id), learnerAHome);
    assert.strictEqual(await getLearnerHome(learnerB.id), learnerBHome);

    invalidateLearnerHomeForReservationTransition('PENDING', 'EXPIRED');
    assert.notStrictEqual(await getLearnerHome(learnerA.id), learnerAHome);
    assert.notStrictEqual(await getLearnerHome(learnerB.id), learnerBHome);

    assert.doesNotThrow(() => invalidateAllLearnerHomeResponseCaches());
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

  test('nearest sort validation requires one valid viewer location source', () => {
    assert.equal(
      materialsQuerySchema.safeParse({
        sort: 'nearest',
        latitude: 31.9,
      }).success,
      false,
    );
    assert.equal(
      materialsQuerySchema.safeParse({
        sort: 'nearest',
        latitude: 91,
        longitude: 35.2,
      }).success,
      false,
    );
    assert.equal(
      materialsQuerySchema.safeParse({
        sort: 'nearest',
      }).success,
      false,
    );
    assert.equal(
      materialsQuerySchema.safeParse({
        sort: 'nearest',
        latitude: 31.9,
        longitude: 35.2,
        savedLocationId: 'saved-location-id',
      }).success,
      false,
    );
    assert.equal(
      materialsQuerySchema.safeParse({
        sort: 'nearest',
        latitude: 31.9,
        longitude: 35.2,
      }).success,
      true,
    );
  });

  test('public list and detail expose only approximate location fields', async () => {
    const unique = `${TEST_MARKER}-privacy-${Date.now()}`;
    const material = await createMaterial(ctx, {
      title: `${unique} privacy stock`,
      locationId: ctx.locationId,
    });

    await prisma.material.update({
      where: { id: material.id },
      data: {
        pickupNotes: 'Use the side entrance at the exact warehouse door.',
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
    assert.equal(listed?.city, `${TEST_MARKER}-Nablus`);
    assert.equal(listed?.area, `${TEST_MARKER}-Industrial`);
    assert.equal('latitude' in listed!, false);
    assert.equal('longitude' in listed!, false);
    assert.equal('addressLine' in listed!, false);
    assert.equal('pickupNotes' in listed!, false);
    assert.equal('location' in listed!, false);
    const listedRecord = listed as Record<string, unknown>;
    assert.equal(listedRecord.approximateLatitude, 32.22);
    assert.equal(listedRecord.approximateLongitude, 35.25);
    assert.equal('supplierProfile' in listed!, false);
    assert.equal('owner' in listed!, false);
    assert.equal(typeof listed?.viewsCount, 'number');

    const detail = await getMaterialById(material.id);
    assert.equal(detail.city, `${TEST_MARKER}-Nablus`);
    assert.equal(detail.area, `${TEST_MARKER}-Industrial`);
    assert.equal('latitude' in detail, false);
    assert.equal('longitude' in detail, false);
    assert.equal('addressLine' in detail, false);
    assert.equal('pickupNotes' in detail, false);
    assert.equal('location' in detail, false);
    assert.equal('approximateLatitude' in detail, false);
    assert.equal('approximateLongitude' in detail, false);
    assert.equal('supplierProfile' in detail, false);
    assert.equal('owner' in detail, false);
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

  test('public detail includes extended safe fields and omits precise pickup data', async () => {
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
    assert.equal(detail.suggestedUses, 'Useful for Arduino motor projects.');
    assert.equal(detail.sourceType, 'WORKSHOP_SURPLUS');
    assert.equal(detail.pickupAllowed, false);
    assert.equal(detail.deliveryAvailable, true);
    assert.equal(detail.supplierType, 'INDIVIDUAL_SUPPLIER');
    assert.equal(detail.supplierVerified, true);
    assert.equal('latitude' in detail, false);
    assert.equal('longitude' in detail, false);
    assert.equal('addressLine' in detail, false);
    assert.equal('pickupNotes' in detail, false);
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
    }) as unknown as {
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
