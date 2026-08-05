import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

import { createReservation } from '../reservations/reservations.service.js';
import { fulfillRequestFromCompletedReservation } from '../learner-material-requests/learner-material-requests.service.js';
import { createNotificationIfMissing } from '../notifications/notifications.repository.js';
import { createSupplierMaterialIdempotent } from '../supplier/supplier.service.js';
import type { CreateSupplierMaterialInput } from '../supplier/supplier.validation.js';

const TEST_MARKER = '[test-supplier-material-requests]';

const ids = {
  users: [] as string[],
  categories: [] as string[],
  requests: [] as string[],
  locations: [] as string[],
  materials: [] as string[],
  matches: [] as string[],
  reservations: [] as string[],
};

let server: Server;
let baseUrl = '';

const createUser = async (suffix: string, role: 'LEARNER' | 'SUPPLIER') => {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${suffix}`,
      email: `${TEST_MARKER}-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      activeRole: role,
      roles: { create: [{ role, isPrimary: true }] },
      ...(role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} ${suffix}`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {
            learnerProfile: {
              create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
            },
          }),
    },
  });
  ids.users.push(user.id);
  return user;
};

const createCategory = async (suffix: string) => {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} ${suffix}`,
      nameAr: `${TEST_MARKER} ${suffix} ar`,
      categoryType: 'MATERIAL',
      isActive: true,
    },
  });
  ids.categories.push(category.id);
  return category;
};

const createLocation = async (city: string) => {
  const location = await prisma.location.create({
    data: {
      country: 'PS',
      city,
      area: `${TEST_MARKER}-area`,
      isApproximate: true,
      visibility: 'ORDER_ONLY',
      locationType: 'MATERIAL_PICKUP',
    },
  });
  ids.locations.push(location.id);
  return location;
};

const createMaterial = async (input: {
  ownerId: string;
  categoryId: string;
  locationId: string;
  title: string;
  quantity?: number;
}) => {
  const profile = await prisma.supplierProfile.findUnique({
    where: { userId: input.ownerId },
    select: { id: true },
  });
  const material = await prisma.material.create({
    data: {
      ownerId: input.ownerId,
      supplierProfileId: profile?.id,
      categoryId: input.categoryId,
      locationId: input.locationId,
      title: input.title,
      description: `${TEST_MARKER} description`,
      materialType: 'Test material',
      quantity: input.quantity ?? 5,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'WORKSHOP_SURPLUS',
      status: 'AVAILABLE',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });
  ids.materials.push(material.id);
  return material;
};

const createLearnerRequest = async (input: {
  learnerId: string;
  categoryId: string;
  requestedItemName: string;
  city: string;
  area?: string | null;
  alternativesAllowed?: boolean;
  neededBy?: Date | null;
}) => {
  const created = await prisma.learnerMaterialRequest.create({
    data: {
      learner: { connect: { id: input.learnerId } },
      category: { connect: { id: input.categoryId } },
      requestedItemName: input.requestedItemName,
      normalizedRequestedItemName: input.requestedItemName.toLowerCase(),
      quantity: 1,
      unit: 'piece',
      alternativesAllowed: input.alternativesAllowed ?? true,
      locationCountry: 'PS',
      locationCity: input.city,
      locationArea: input.area ?? null,
      status: 'OPEN',
      neededBy: input.neededBy ?? null,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  ids.requests.push(created.id);
  return created;
};

before(async () => {
  process.env.NODE_ENV = 'test';
  server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (ids.reservations.length) {
    await prisma.reservationStatusHistory.deleteMany({
      where: { reservationId: { in: ids.reservations } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: ids.reservations } },
    });
  }
  if (ids.matches.length) {
    await prisma.learnerMaterialRequestMatch.deleteMany({
      where: { id: { in: ids.matches } },
    });
  }
  if (ids.requests.length) {
    await prisma.learnerMaterialRequest.deleteMany({
      where: { id: { in: ids.requests } },
    });
  }
  if (ids.materials.length) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
  }
  await prisma.notification.deleteMany({
    where: { relatedEntityId: { in: ids.requests } },
  });
  if (ids.users.length) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }
  if (ids.locations.length) {
    await prisma.location.deleteMany({ where: { id: { in: ids.locations } } });
  }
  if (ids.categories.length) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.categories } },
    });
  }
});

describe('Supplier material requests feed filters', () => {
  test('categoryId, city, alternativesAllowed and unansweredByMe narrow the feed', async () => {
    const learner = await createUser('feed-learner', 'LEARNER');
    const supplier = await createUser('feed-supplier', 'SUPPLIER');
    const categoryA = await createCategory('feed-cat-a');
    const categoryB = await createCategory('feed-cat-b');
    const supplierToken = signAccessToken({
      sub: supplier.id,
      roles: ['SUPPLIER'],
    });

    const requestA = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: categoryA.id,
      requestedItemName: `${TEST_MARKER} widget A`,
      city: 'Ramallah',
      alternativesAllowed: true,
    });
    const requestB = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: categoryB.id,
      requestedItemName: `${TEST_MARKER} widget B`,
      city: 'Nablus',
      alternativesAllowed: false,
    });

    const byCategory = await fetch(
      `${baseUrl}/api/supplier/material-requests?categoryId=${categoryA.id}`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    assert.equal(byCategory.status, 200);
    const byCategoryBody = (await byCategory.json()) as {
      data: { items: Array<{ id: string }> };
    };
    assert.ok(byCategoryBody.data.items.some((item) => item.id === requestA.id));
    assert.equal(
      byCategoryBody.data.items.some((item) => item.id === requestB.id),
      false,
    );

    const byCity = await fetch(
      `${baseUrl}/api/supplier/material-requests?city=Nablus`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    const byCityBody = (await byCity.json()) as {
      data: { items: Array<{ id: string }> };
    };
    assert.ok(byCityBody.data.items.some((item) => item.id === requestB.id));
    assert.equal(
      byCityBody.data.items.some((item) => item.id === requestA.id),
      false,
    );

    const byAlternatives = await fetch(
      `${baseUrl}/api/supplier/material-requests?alternativesAllowed=false`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    const byAlternativesBody = (await byAlternatives.json()) as {
      data: { items: Array<{ id: string }> };
    };
    assert.ok(
      byAlternativesBody.data.items.some((item) => item.id === requestB.id),
    );
    assert.equal(
      byAlternativesBody.data.items.some((item) => item.id === requestA.id),
      false,
    );

    const location = await createLocation('Nablus');
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: categoryA.id,
      locationId: location.id,
      title: `${TEST_MARKER} feed material`,
    });

    const suggestResponse = await fetch(
      `${baseUrl}/api/supplier/material-requests/${requestA.id}/suggestions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supplierToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ materialId: material.id, confirmWeakMatch: true }),
      },
    );
    assert.equal(suggestResponse.status, 201);
    const suggestBody = (await suggestResponse.json()) as {
      data: { ownMatches?: Array<{ id: string }> };
    };
    const matchId = suggestBody.data.ownMatches?.[0]?.id;
    assert.ok(matchId);
    ids.matches.push(matchId!);

    const unanswered = await fetch(
      `${baseUrl}/api/supplier/material-requests?unansweredByMe=true`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    const unansweredBody = (await unanswered.json()) as {
      data: { items: Array<{ id: string }> };
    };
    assert.equal(
      unansweredBody.data.items.some((item) => item.id === requestA.id),
      false,
    );
    assert.ok(unansweredBody.data.items.some((item) => item.id === requestB.id));
  });

  test('limit is clamped to a maximum of 50', async () => {
    const supplier = await createUser('limit-supplier', 'SUPPLIER');
    const supplierToken = signAccessToken({
      sub: supplier.id,
      roles: ['SUPPLIER'],
    });

    // The shared pagination schema itself hard-caps `limit` at 100, so use a
    // value within that ceiling (80) to exercise this module's own 50 clamp.
    const response = await fetch(
      `${baseUrl}/api/supplier/material-requests?limit=80`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { data: { limit: number } };
    assert.equal(body.data.limit, 50);

    const overCeiling = await fetch(
      `${baseUrl}/api/supplier/material-requests?limit=999`,
      { headers: { Authorization: `Bearer ${supplierToken}` } },
    );
    assert.equal(overCeiling.status, 400);
  });

  test('unauthenticated and non-supplier requests are rejected', async () => {
    const learner = await createUser('auth-learner', 'LEARNER');
    const learnerToken = signAccessToken({
      sub: learner.id,
      roles: ['LEARNER'],
    });

    assert.equal(
      (await fetch(`${baseUrl}/api/supplier/material-requests/some-id/candidate-materials`))
        .status,
      401,
    );
    assert.equal(
      (
        await fetch(
          `${baseUrl}/api/supplier/material-requests/some-id/candidate-materials`,
          { headers: { Authorization: `Bearer ${learnerToken}` } },
        )
      ).status,
      403,
    );
  });
});

describe('Supplier suggestion idempotency', () => {
  test('suggesting the same material twice returns the existing match', async () => {
    const learner = await createUser('idempotent-learner', 'LEARNER');
    const supplier = await createUser('idempotent-supplier', 'SUPPLIER');
    const category = await createCategory('idempotent-cat');
    const location = await createLocation('Ramallah');
    const supplierToken = signAccessToken({
      sub: supplier.id,
      roles: ['SUPPLIER'],
    });

    const request = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: category.id,
      requestedItemName: `${TEST_MARKER} idempotent widget`,
      city: 'Ramallah',
    });
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} idempotent material`,
    });

    const firstSuggest = async () =>
      fetch(
        `${baseUrl}/api/supplier/material-requests/${request.id}/suggestions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supplierToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ materialId: material.id, confirmWeakMatch: true }),
        },
      );

    const first = await firstSuggest();
    assert.equal(first.status, 201);
    const firstBody = (await first.json()) as {
      data: { ownMatches?: Array<{ id: string }> };
    };
    const matchId = firstBody.data.ownMatches?.[0]?.id;
    assert.ok(matchId);
    ids.matches.push(matchId!);

    const second = await firstSuggest();
    assert.equal(second.status, 201);
    const secondBody = (await second.json()) as {
      data: { ownMatches?: Array<{ id: string }> };
    };
    assert.equal(secondBody.data.ownMatches?.[0]?.id, matchId);

    const matchCount = await prisma.learnerMaterialRequestMatch.count({
      where: { materialRequestId: request.id, materialId: material.id },
    });
    assert.equal(matchCount, 1);
  });
});

describe('Reservation integration with material request matches', () => {
  test('creating a reservation with a valid materialRequestMatchId links the match', async () => {
    const learner = await createUser('reservation-learner', 'LEARNER');
    const supplier = await createUser('reservation-supplier', 'SUPPLIER');
    const category = await createCategory('reservation-cat');
    const location = await createLocation('Ramallah');

    const request = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: category.id,
      requestedItemName: `${TEST_MARKER} reservation widget`,
      city: 'Ramallah',
    });
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} reservation material`,
      quantity: 3,
    });

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: request.id } },
        material: { connect: { id: material.id } },
        supplierUser: { connect: { id: supplier.id } },
        status: 'SUGGESTED',
        matchReasonCode: 'CATEGORY_MATCH',
        rankingScore: 150,
      },
    });
    ids.matches.push(match.id);

    const reservation = await createReservation(learner.id, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      materialRequestMatchId: match.id,
    });
    ids.reservations.push(reservation.id);

    const linkedMatch = await prisma.learnerMaterialRequestMatch.findUnique({
      where: { id: match.id },
    });
    assert.equal(linkedMatch?.status, 'RESERVATION_CREATED');
    assert.equal(linkedMatch?.reservationId, reservation.id);
  });

  test('rejects a materialRequestMatchId that does not belong to the requester', async () => {
    const learnerOwner = await createUser('mismatch-learner-owner', 'LEARNER');
    const otherLearner = await createUser('mismatch-learner-other', 'LEARNER');
    const supplier = await createUser('mismatch-supplier', 'SUPPLIER');
    const category = await createCategory('mismatch-cat');
    const location = await createLocation('Ramallah');

    const request = await createLearnerRequest({
      learnerId: learnerOwner.id,
      categoryId: category.id,
      requestedItemName: `${TEST_MARKER} mismatch widget`,
      city: 'Ramallah',
    });
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} mismatch material`,
    });
    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: request.id } },
        material: { connect: { id: material.id } },
        supplierUser: { connect: { id: supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    await assert.rejects(
      () =>
        createReservation(otherLearner.id, {
          materialId: material.id,
          quantityRequested: 1,
          fulfillmentMethod: 'PICKUP',
          materialRequestMatchId: match.id,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test('rejects a materialRequestMatchId for a different material', async () => {
    const learner = await createUser('material-mismatch-learner', 'LEARNER');
    const supplier = await createUser('material-mismatch-supplier', 'SUPPLIER');
    const category = await createCategory('material-mismatch-cat');
    const location = await createLocation('Ramallah');

    const request = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: category.id,
      requestedItemName: `${TEST_MARKER} material mismatch widget`,
      city: 'Ramallah',
    });
    const matchedMaterial = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} matched material`,
    });
    const otherMaterial = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} other material`,
    });
    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: request.id } },
        material: { connect: { id: matchedMaterial.id } },
        supplierUser: { connect: { id: supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    await assert.rejects(
      () =>
        createReservation(learner.id, {
          materialId: otherMaterial.id,
          quantityRequested: 1,
          fulfillmentMethod: 'PICKUP',
          materialRequestMatchId: match.id,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        return true;
      },
    );
  });
});

describe('Material request fulfillment on completed reservation', () => {
  test('fulfillRequestFromCompletedReservation marks the request fulfilled and notifies the learner', async () => {
    const learner = await createUser('fulfill-learner', 'LEARNER');
    const supplier = await createUser('fulfill-supplier', 'SUPPLIER');
    const category = await createCategory('fulfill-cat');
    const location = await createLocation('Ramallah');

    const request = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: category.id,
      requestedItemName: `${TEST_MARKER} fulfillment widget`,
      city: 'Ramallah',
    });
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} fulfillment material`,
    });

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: learner.id,
        ownerId: supplier.id,
        quantityRequested: 1,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ids.reservations.push(reservation.id);

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: request.id } },
        material: { connect: { id: material.id } },
        supplierUser: { connect: { id: supplier.id } },
        status: 'RESERVATION_CREATED',
        reservation: { connect: { id: reservation.id } },
      },
    });
    ids.matches.push(match.id);

    // Mirrors the production wiring in supplier-reservations.service.ts /
    // driver.service.ts: fulfillment + notification are triggered together
    // whenever a reservation linked to a match transitions to COMPLETED.
    const fulfilled = await fulfillRequestFromCompletedReservation(
      reservation.id,
    );
    assert.ok(fulfilled);
    assert.equal(fulfilled?.status, 'FULFILLED');
    assert.equal(fulfilled?.transitionedToFulfilled, true);
    assert.equal(fulfilled?.learnerId, learner.id);

    if (fulfilled?.transitionedToFulfilled) {
      await createNotificationIfMissing({
        userId: fulfilled.learnerId,
        notificationType: 'MATERIAL_REQUEST_FULFILLED',
        title: 'Material request fulfilled',
        body: `Your request "${fulfilled.requestedItemName}" was marked fulfilled after a completed reservation.`,
        relatedEntityType: 'MATERIAL_REQUEST',
        relatedEntityId: fulfilled.id,
        eventKey: `mr:fulfilled:${fulfilled.id}`,
        entityType: 'MATERIAL_REQUEST',
        entityId: fulfilled.id,
        actionType: 'OPEN_ENTITY',
      });
    }

    const refreshedRequest = await prisma.learnerMaterialRequest.findUnique({
      where: { id: request.id },
    });
    assert.equal(refreshedRequest?.status, 'FULFILLED');

    const notification = await prisma.notification.findUnique({
      where: { eventKey: `mr:fulfilled:${request.id}` },
    });
    assert.ok(notification);
    assert.equal(notification?.userId, learner.id);
    assert.equal(notification?.notificationType, 'MATERIAL_REQUEST_FULFILLED');
  });
});

describe('Publish-from-request suggestion hook', () => {
  test('creating a material with suggestToMaterialRequestId auto-creates a suggestion', async () => {
    const learner = await createUser('publish-hook-learner', 'LEARNER');
    const supplier = await createUser('publish-hook-supplier', 'SUPPLIER');

    const taxonomyCategory = await prisma.category.findFirst({
      where: {
        categoryType: { in: ['MATERIAL', 'BOTH'] },
        isActive: true,
        materialFamilyConceptId: { not: null },
        materialFamilyConcept: {
          status: 'ACTIVE',
          conceptType: 'MATERIAL_FAMILY',
        },
      },
      select: { id: true },
    });
    assert.ok(taxonomyCategory, 'expected a seeded taxonomy category to exist');

    const location = await createLocation('Ramallah');
    await prisma.supplierProfile.update({
      where: { userId: supplier.id },
      data: { defaultPickupLocationId: location.id },
    });

    const request = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: taxonomyCategory!.id,
      requestedItemName: `${TEST_MARKER} publish hook widget`,
      city: 'Ramallah',
    });

    const payload: CreateSupplierMaterialInput = {
      materialName: 'Unmatched create material',
      title: `${TEST_MARKER} publish hook material`,
      description: `${TEST_MARKER} publish hook material description`,
      categoryId: taxonomyCategory!.id,
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      isFree: true,
      price: null,
      currency: 'NIS',
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: [`/uploads/materials/${TEST_MARKER}-publish-hook.jpg`],
      useDefaultPickupLocation: true,
      suggestToMaterialRequestId: request.id,
    };

    const key = `${TEST_MARKER}-publish-hook-${Date.now()}`;
    const created = await createSupplierMaterialIdempotent(
      supplier.id,
      payload,
      key,
    );
    ids.materials.push(created.response.id);

    const match = await prisma.learnerMaterialRequestMatch.findUnique({
      where: {
        materialRequestId_materialId: {
          materialRequestId: request.id,
          materialId: created.response.id,
        },
      },
    });
    assert.ok(match, 'expected the publish-from-request hook to create a suggestion');
    assert.equal(match?.status, 'SUGGESTED');
    ids.matches.push(match!.id);

    const { getSupplierCandidateMaterialsForRequest } = await import(
      './supplier-material-requests.service.js'
    );
    const candidates = await getSupplierCandidateMaterialsForRequest(
      supplier.id,
      request.id,
      30,
    );
    assert.ok(
      !candidates.items.some(
        (item) => item.materialId === created.response.id,
      ),
      'auto-suggested publish-from-request material must not remain a candidate',
    );
  });
});

describe('Candidate materials exclude already-matched materials', () => {
  test('suggested materials leave the candidate list but stay in ownMatches', async () => {
    const {
      getSupplierCandidateMaterialsForRequest,
      suggestMaterialForRequest,
      getSupplierMaterialRequest,
    } = await import('./supplier-material-requests.service.js');

    const learner = await createUser('cand-excl-learner', 'LEARNER');
    const supplier = await createUser('cand-excl-supplier', 'SUPPLIER');
    const category = await createCategory('cand-excl-cat');
    const location = await createLocation('Ramallah');

    const request = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: category.id,
      requestedItemName: `${TEST_MARKER} matching motor`,
      city: 'Ramallah',
    });

    const suggestedMaterial = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} matching motor 12V`,
    });
    const otherMaterial = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} matching motor spare`,
    });

    const before = await getSupplierCandidateMaterialsForRequest(
      supplier.id,
      request.id,
      30,
    );
    assert.ok(
      before.items.some((item) => item.materialId === suggestedMaterial.id),
      'unsuggested matching material should appear as a candidate',
    );
    assert.ok(
      before.items.some((item) => item.materialId === otherMaterial.id),
      'second unsuggested matching material should appear as a candidate',
    );

    await suggestMaterialForRequest(supplier.id, request.id, {
      materialId: suggestedMaterial.id,
      confirmWeakMatch: false,
    });

    const match = await prisma.learnerMaterialRequestMatch.findUnique({
      where: {
        materialRequestId_materialId: {
          materialRequestId: request.id,
          materialId: suggestedMaterial.id,
        },
      },
    });
    assert.ok(match);
    ids.matches.push(match!.id);

    const after = await getSupplierCandidateMaterialsForRequest(
      supplier.id,
      request.id,
      30,
    );
    assert.ok(
      !after.items.some((item) => item.materialId === suggestedMaterial.id),
      'suggested material must leave the candidate list',
    );
    assert.ok(
      after.items.some((item) => item.materialId === otherMaterial.id),
      'other unsuggested materials must remain available',
    );

    const detail = await getSupplierMaterialRequest(supplier.id, request.id);
    assert.equal(detail.respondedByMe, true);
    assert.ok(
      (detail.ownMatches ?? []).some(
        (entry) =>
          entry.materialId === suggestedMaterial.id &&
          entry.status === 'SUGGESTED',
      ),
      'suggested material must remain visible under already-suggested history',
    );

    // Duplicate suggestion stays idempotent / conflict-safe.
    const again = await suggestMaterialForRequest(supplier.id, request.id, {
      materialId: suggestedMaterial.id,
      confirmWeakMatch: false,
    });
    assert.ok(
      (again.ownMatches ?? []).some(
        (entry) => entry.materialId === suggestedMaterial.id,
      ),
    );
    const matchCount = await prisma.learnerMaterialRequestMatch.count({
      where: {
        materialRequestId: request.id,
        materialId: suggestedMaterial.id,
      },
    });
    assert.equal(matchCount, 1);
  });
});

describe('Lazy UNAVAILABLE match refresh', () => {
  test('marks SUGGESTED matches UNAVAILABLE and notifies when material becomes REUSED', async () => {
    const { getSupplierMaterialRequest } = await import(
      './supplier-material-requests.service.js'
    );
    const { getLearnerMaterialRequest } = await import(
      '../learner-material-requests/learner-material-requests.service.js'
    );

    const learner = await createUser('unavail-learner', 'LEARNER');
    const supplier = await createUser('unavail-supplier', 'SUPPLIER');
    const category = await createCategory('unavail-cat');
    const location = await createLocation('Nablus');

    const request = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: category.id,
      requestedItemName: `${TEST_MARKER} DC motor`,
      city: 'Nablus',
    });
    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} DC motor listing`,
    });

    const match = await prisma.learnerMaterialRequestMatch.create({
      data: {
        materialRequest: { connect: { id: request.id } },
        material: { connect: { id: material.id } },
        supplierUser: { connect: { id: supplier.id } },
        status: 'SUGGESTED',
      },
    });
    ids.matches.push(match.id);

    await prisma.material.update({
      where: { id: material.id },
      data: { status: 'REUSED' },
    });

    await getSupplierMaterialRequest(supplier.id, request.id);

    const refreshedMatch = await prisma.learnerMaterialRequestMatch.findUnique({
      where: { id: match.id },
    });
    assert.equal(refreshedMatch?.status, 'UNAVAILABLE');

    const notification = await prisma.notification.findUnique({
      where: { eventKey: `mr:unavail:${match.id}` },
    });
    assert.ok(notification);
    assert.equal(notification?.userId, learner.id);
    assert.equal(
      notification?.notificationType,
      'MATERIAL_REQUEST_MATCH_UNAVAILABLE',
    );

    // Second refresh must not create a duplicate notification.
    await getLearnerMaterialRequest(learner.id, request.id);
    const notificationCount = await prisma.notification.count({
      where: { eventKey: `mr:unavail:${match.id}` },
    });
    assert.equal(notificationCount, 1);
  });
});

describe('E2E smoke: DC motor request → suggest → reserve → complete → fulfill', () => {
  test('full learner↔supplier material request happy path', async () => {
    const { suggestMaterialForRequest } = await import(
      './supplier-material-requests.service.js'
    );
    const { listSupplierMaterialRequests } = await import(
      './supplier-material-requests.service.js'
    );

    const learner = await createUser('e2e-learner', 'LEARNER');
    const supplier = await createUser('e2e-supplier', 'SUPPLIER');
    const category = await createCategory('e2e-dc-motor');
    const location = await createLocation('Ramallah');

    const request = await createLearnerRequest({
      learnerId: learner.id,
      categoryId: category.id,
      requestedItemName: `${TEST_MARKER} DC motor`,
      city: 'Ramallah',
      area: 'Al-Bireh',
    });

    const feed = await listSupplierMaterialRequests(supplier.id, {
      page: 1,
      limit: 50,
      alternativesAllowed: undefined,
      unansweredByMe: undefined,
    });
    const feedItem = feed.items.find((item) => item.id === request.id);
    assert.ok(feedItem, 'supplier should see the open request');
    assert.equal(feedItem.location.city, 'Ramallah');
    assert.equal(feedItem.location.area, 'Al-Bireh');
    assert.equal(feedItem.location.country, 'PS');
    assert.ok(!('learnerId' in feedItem));
    assert.ok(!('latitude' in feedItem));
    assert.ok(!('sourceSavedLocationId' in feedItem));

    const material = await createMaterial({
      ownerId: supplier.id,
      categoryId: category.id,
      locationId: location.id,
      title: `${TEST_MARKER} DC motor 12V`,
    });

    await suggestMaterialForRequest(supplier.id, request.id, {
      materialId: material.id,
      confirmWeakMatch: false,
    });

    const match = await prisma.learnerMaterialRequestMatch.findUnique({
      where: {
        materialRequestId_materialId: {
          materialRequestId: request.id,
          materialId: material.id,
        },
      },
    });
    assert.ok(match);
    assert.equal(match?.status, 'SUGGESTED');
    ids.matches.push(match!.id);

    const suggestionNotification = await prisma.notification.findUnique({
      where: { eventKey: `mr:suggest:${match!.id}` },
    });
    assert.ok(suggestionNotification);
    assert.equal(suggestionNotification?.userId, learner.id);

    const reservation = await createReservation(learner.id, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      materialRequestMatchId: match!.id,
    });
    ids.reservations.push(reservation.id);

    const linkedMatch = await prisma.learnerMaterialRequestMatch.findUnique({
      where: { id: match!.id },
    });
    assert.equal(linkedMatch?.status, 'RESERVATION_CREATED');
    assert.equal(linkedMatch?.reservationId, reservation.id);

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    const fulfilled = await fulfillRequestFromCompletedReservation(
      reservation.id,
    );
    assert.ok(fulfilled);
    assert.equal(fulfilled?.status, 'FULFILLED');

    await createNotificationIfMissing({
      userId: fulfilled!.learnerId,
      notificationType: 'MATERIAL_REQUEST_FULFILLED',
      title: 'Material request fulfilled',
      body: `Your request "${fulfilled!.requestedItemName}" was marked fulfilled after a completed reservation.`,
      relatedEntityType: 'MATERIAL_REQUEST',
      relatedEntityId: fulfilled!.id,
      eventKey: `mr:fulfilled:${fulfilled!.id}`,
      entityType: 'MATERIAL_REQUEST',
      entityId: fulfilled!.id,
      actionType: 'OPEN_ENTITY',
    });

    const finalRequest = await prisma.learnerMaterialRequest.findUnique({
      where: { id: request.id },
    });
    assert.equal(finalRequest?.status, 'FULFILLED');
  });
});
