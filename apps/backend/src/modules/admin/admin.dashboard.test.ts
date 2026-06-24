import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { NextFunction, Request, Response } from 'express';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import { requireRoles } from '../../middlewares/role.middleware.js';
import { buildAdminDashboard } from './admin.service.js';

const TEST_MARKER = '[test-admin-dashboard]';

type CreatedIds = {
  users: string[];
  materials: string[];
  reservations: string[];
  invitations: string[];
  categoryRequests: string[];
  priceRequests: string[];
  categoryId?: string;
  locationId?: string;
};

async function createBaseCategoryAndLocation(ids: CreatedIds) {
  const category = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Electronics`,
      nameAr: `${TEST_MARKER} إلكترونيات`,
      categoryType: 'MATERIAL',
      isActive: true,
    },
  });
  ids.categoryId = category.id;

  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Nablus',
      area: 'Rafidia',
      addressLine: 'Test street',
      isApproximate: true,
      visibility: 'PRIVATE',
    },
  });
  ids.locationId = location.id;
}

async function createUser(input: {
  role: 'LEARNER' | 'SUPPLIER' | 'ADMIN' | 'DRIVER';
  emailSuffix: string;
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.role} ${input.emailSuffix}`,
      email: `${TEST_MARKER}-${input.role}-${input.emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: input.role, isPrimary: true }],
      },
      ...(input.role === 'SUPPLIER'
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: `${TEST_MARKER} Supplier ${input.emailSuffix}`,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {}),
    },
  });
}

async function createMaterial(ids: CreatedIds, ownerId: string, status: 'AVAILABLE' | 'REUSED') {
  const material = await prisma.material.create({
    data: {
      ownerId,
      categoryId: ids.categoryId!,
      locationId: ids.locationId!,
      title: `${TEST_MARKER} material`,
      description: 'test',
      materialType: 'Resistor',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      sourceType: 'STUDENT_LEFTOVER',
      status,
      isFree: true,
      reusedAt: status === 'REUSED' ? new Date() : null,
    },
  });
  ids.materials.push(material.id);
  return material;
}

async function createReservation(ids: CreatedIds, input: { materialId: string; requesterId: string; ownerId: string }) {
  const reservation = await prisma.reservation.create({
    data: {
      materialId: input.materialId,
      requesterId: input.requesterId,
      ownerId: input.ownerId,
      quantityRequested: 1,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
  ids.reservations.push(reservation.id);
  return reservation;
}

describe('admin dashboard', () => {
  const ids: CreatedIds = {
    users: [],
    materials: [],
    reservations: [],
    invitations: [],
    categoryRequests: [],
    priceRequests: [],
  };

  before(async () => {
    await createBaseCategoryAndLocation(ids);

    const supplier = await createUser({ role: 'SUPPLIER', emailSuffix: 'a' });
    const learner = await createUser({ role: 'LEARNER', emailSuffix: 'b' });
    const admin = await createUser({ role: 'ADMIN', emailSuffix: 'c' });
    const driver = await createUser({ role: 'DRIVER', emailSuffix: 'd' });
    ids.users.push(supplier.id, learner.id, admin.id, driver.id);

    const available = await createMaterial(ids, supplier.id, 'AVAILABLE');
    const reused = await createMaterial(ids, supplier.id, 'REUSED');

    await createReservation(ids, {
      materialId: reused.id,
      requesterId: learner.id,
      ownerId: supplier.id,
    });

    const invitation = await prisma.roleInvitation.create({
      data: {
        targetEmail: `${TEST_MARKER}-invited@impactloop.test`,
        targetRole: 'ADMIN',
        tokenHash: `${TEST_MARKER}-token-hash-${Date.now()}`,
        invitedBy: admin.id,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
    });
    ids.invitations.push(invitation.id);

    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} New Category`,
        normalizedRequestedName: `${TEST_MARKER} new category`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    ids.categoryRequests.push(categoryRequest.id);

    const priceRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} Plastic`,
        normalizedMaterialName: `${TEST_MARKER} plastic`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    ids.priceRequests.push(priceRequest.id);

    assert.ok(available.id);
  });

  after(async () => {
    await prisma.priceRuleRequest.deleteMany({
      where: { id: { in: ids.priceRequests } },
    });
    await prisma.categoryRequest.deleteMany({
      where: { id: { in: ids.categoryRequests } },
    });
    await prisma.roleInvitation.deleteMany({
      where: { id: { in: ids.invitations } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: ids.reservations } },
    });
    await prisma.material.deleteMany({
      where: { id: { in: ids.materials } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ids.users } },
    });
    if (ids.locationId) {
      await prisma.location.deleteMany({ where: { id: ids.locationId } });
    }
    if (ids.categoryId) {
      await prisma.category.deleteMany({ where: { id: ids.categoryId } });
    }
  });

  test('buildAdminDashboard returns expected aggregate shape', async () => {
    const dashboard = await buildAdminDashboard();

    assert.equal(typeof dashboard.summary.totalUsers, 'number');
    assert.equal(dashboard.summary.totalUsers >= 4, true);
    assert.equal(dashboard.summary.totalSuppliers >= 1, true);
    assert.equal(dashboard.summary.totalMaterials >= 2, true);
    assert.equal(dashboard.summary.availableMaterials >= 1, true);
    assert.equal(dashboard.summary.completedReuse >= 1, true);
    assert.equal(dashboard.summary.activeInvitations >= 1, true);
    assert.equal(dashboard.pendingActions.categoryRequests >= 1, true);
    assert.equal(dashboard.pendingActions.priceRequests >= 1, true);
    assert.equal(dashboard.impact.reusedMaterials >= 1, true);
    assert.equal(dashboard.impact.completedReservations >= 1, true);
    assert.equal(dashboard.impact.learnersBenefited >= 1, true);
    assert.equal(dashboard.impact.suppliersContributed >= 1, true);
    assert.equal(Array.isArray(dashboard.impact.reuseByMonth), true);
    assert.equal(dashboard.impact.reuseByMonth.length, 6);
    assert.equal(Array.isArray(dashboard.materialsByCategory), true);
    assert.equal(Array.isArray(dashboard.reservationStatusBreakdown), true);
    assert.equal(Array.isArray(dashboard.recentInvitations), true);
    assert.equal(typeof dashboard.impact.estimatedCo2Kg, 'number');
    assert.equal(typeof dashboard.impact.estimatedCo2Label, 'string');
    assert.match(dashboard.impact.estimatedCo2Label, /kg CO₂e$/);
    assert.match(dashboard.impact.estimatedCo2Method, /Conservative MVP estimates/);
    assert.equal(typeof dashboard.impact.reuseCompletionRate, 'number');
    assert.equal(dashboard.impact.reuseCompletionRate >= 0, true);
    assert.equal(dashboard.impact.reuseCompletionRate <= 1, true);
    assert.equal(typeof dashboard.impact.co2ReuseProgress, 'number');
    assert.equal(dashboard.impact.co2ReuseProgress >= 0, true);
    assert.equal(dashboard.impact.co2ReuseProgress <= 1, true);
  });
});

describe('admin route guard middleware (requireRoles)', () => {
  test('returns 401 when unauthenticated', () => {
    const middleware = requireRoles('ADMIN');
    const req = {} as Request;
    const res = {} as Response;
    let nextErr: unknown;
    const next: NextFunction = (err?: unknown) => {
      nextErr = err;
    };

    middleware(req, res, next);

    assert.ok(nextErr);
    assert.equal((nextErr as { statusCode?: number }).statusCode, 401);
  });

  test('returns 403 when authenticated without ADMIN role', () => {
    const middleware = requireRoles('ADMIN');
    const req = { auth: { sub: 'user', roles: ['SUPPLIER'] } } as unknown as Request;
    const res = {} as Response;
    let nextErr: unknown;
    const next: NextFunction = (err?: unknown) => {
      nextErr = err;
    };

    middleware(req, res, next);

    assert.ok(nextErr);
    assert.equal((nextErr as { statusCode?: number }).statusCode, 403);
  });
});

