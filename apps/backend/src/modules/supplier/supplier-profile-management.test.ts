import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { after, before, describe, test } from 'node:test';

import { app } from '../../app.js';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

import {
  buildSupplierManagementVerification,
  calculateSupplierEssentialsCompletion,
  normalizeWorkingDays,
  normalizeWorkingHours,
} from './supplier-profile-management.js';
import { getSupplierProfileManagement } from './supplier.service.js';
import { updateSupplierProfileImagesSchema } from './supplier.validation.js';

const TEST_MARKER = '[test-supplier-profile-management]';
const createdUserIds: string[] = [];
const createdLocationIds: string[] = [];
let server: Server;
let baseUrl = '';

const createLocation = async (suffix: string) => {
  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Nablus',
      area: `${TEST_MARKER}-${suffix}`,
      addressLine: 'Owner-only address',
      latitude: 32.22,
      longitude: 35.26,
      visibility: 'PUBLIC',
      isApproximate: true,
      locationType: 'PICKUP_POINT',
    },
  });
  createdLocationIds.push(location.id);
  return location;
};

const createUser = async (input: {
  suffix: string;
  role: 'SUPPLIER' | 'LEARNER';
  supplierProfile?: Record<string, unknown>;
}) => {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} ${input.suffix}`,
      email: `${TEST_MARKER}-${input.suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      activeRole: input.role,
      roles: { create: [{ role: input.role, isPrimary: true }] },
      ...(input.role === 'SUPPLIER'
        ? { supplierProfile: { create: input.supplierProfile ?? {} } }
        : { learnerProfile: { create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' } } }),
    },
  });
  createdUserIds.push(user.id);
  return user;
};

const requestManagement = async (token?: string) =>
  fetch(`${baseUrl}/api/supplier/profile/manage`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

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
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  if (createdLocationIds.length) {
    await prisma.location.deleteMany({ where: { id: { in: createdLocationIds } } });
  }
});

describe('supplier profile management pure contracts', () => {
  test('essentials completion is stable at 0/5, partial, and 5/5', () => {
    assert.deepEqual(calculateSupplierEssentialsCompletion({
      publicName: null,
      supplierType: null,
      description: null,
      pickupLocation: null,
    }), {
      completedCount: 0,
      totalCount: 5,
      percentage: 0,
      missingFields: ['PUBLIC_NAME', 'SUPPLIER_TYPE', 'DESCRIPTION', 'PICKUP_LOCATION', 'LOCATION_VISIBILITY'],
    });

    const partial = calculateSupplierEssentialsCompletion({
      publicName: 'Supplier',
      supplierType: 'INDIVIDUAL_SUPPLIER',
      description: null,
      pickupLocation: { country: 'Palestine', city: 'Nablus', visibility: null },
    });
    assert.equal(partial.completedCount, 3);
    assert.deepEqual(partial.missingFields, ['DESCRIPTION', 'LOCATION_VISIBILITY']);

    const complete = calculateSupplierEssentialsCompletion({
      publicName: 'Supplier',
      supplierType: 'INDIVIDUAL_SUPPLIER',
      description: 'About this supplier',
      pickupLocation: { country: 'Palestine', city: 'Nablus', visibility: 'PUBLIC' },
    });
    assert.deepEqual(complete, { completedCount: 5, totalCount: 5, percentage: 100, missingFields: [] });
  });

  test('verification status normalization and action flags fail closed', () => {
    assert.equal(buildSupplierManagementVerification({ rawStatus: 'VERIFIED', supplierType: 'WORKSHOP' }).status, 'APPROVED');
    assert.equal(buildSupplierManagementVerification({ rawStatus: 'APPROVED', supplierType: 'WORKSHOP' }).isVerified, true);
    assert.deepEqual(buildSupplierManagementVerification({ rawStatus: 'PENDING', supplierType: 'WORKSHOP' }), {
      rawStatus: 'PENDING', status: 'PENDING', isVerified: false, canSubmit: false, canResubmit: false,
      adminNote: null, submittedAt: null, reviewedAt: null,
    });
    assert.equal(buildSupplierManagementVerification({ rawStatus: 'CHANGES_REQUESTED', supplierType: 'WORKSHOP' }).canResubmit, true);
    assert.equal(buildSupplierManagementVerification({ rawStatus: 'REJECTED', supplierType: 'WORKSHOP' }).canResubmit, true);
    assert.equal(buildSupplierManagementVerification({ rawStatus: 'UNVERIFIED', supplierType: 'WORKSHOP' }).canSubmit, true);
    assert.equal(buildSupplierManagementVerification({ rawStatus: 'NOT_REQUIRED', supplierType: 'INDIVIDUAL_SUPPLIER' }).isVerified, true);
    const unknown = buildSupplierManagementVerification({ rawStatus: 'not-a-status', supplierType: 'WORKSHOP', adminNote: 'internal' });
    assert.deepEqual(unknown, {
      rawStatus: 'not-a-status', status: 'UNKNOWN', isVerified: false, canSubmit: false, canResubmit: false,
      adminNote: null, submittedAt: null, reviewedAt: null,
    });
    assert.equal(buildSupplierManagementVerification({ rawStatus: 'REJECTED', supplierType: 'WORKSHOP', adminNote: 'Please update' }).adminNote, 'Please update');
    assert.equal(buildSupplierManagementVerification({ rawStatus: 'APPROVED', supplierType: 'WORKSHOP', adminNote: 'hidden' }).adminNote, null);
  });

  test('working schedule parsing preserves supported shapes and fails safely', () => {
    assert.deepEqual(normalizeWorkingDays(['MONDAY', ' TUESDAY ']), ['MONDAY', 'TUESDAY']);
    assert.equal(normalizeWorkingDays(['MONDAY', 2]), null);
    assert.deepEqual(normalizeWorkingHours({ from: '09:00', to: '17:00' }), { from: '09:00', to: '17:00' });
    assert.deepEqual(normalizeWorkingHours({ start: '09:00', end: '17:00' }), { start: '09:00', end: '17:00' });
    assert.equal(normalizeWorkingHours({ from: 9 }), null);
  });

  test('Supplier image patch accepts profile storage and HTTPS only', () => {
    assert.equal(updateSupplierProfileImagesSchema.safeParse({ avatarImageUrl: '/uploads/profiles/avatar.webp' }).success, true);
    assert.equal(updateSupplierProfileImagesSchema.safeParse({ coverImageUrl: 'https://cdn.example.com/cover.webp' }).success, true);
    assert.equal(updateSupplierProfileImagesSchema.safeParse({ avatarImageUrl: '/uploads/materials/avatar.webp' }).success, false);
    assert.equal(updateSupplierProfileImagesSchema.safeParse({ coverImageUrl: 'http://cdn.example.com/cover.webp' }).success, false);
    assert.equal(updateSupplierProfileImagesSchema.safeParse({ coverImageUrl: '/uploads/profiles/../cover.webp' }).success, false);
  });
});

describe('supplier profile management persisted contract', () => {
  test('owner read is bounded to profile data and keeps exact owner location private', async () => {
    const location = await createLocation('owner');
    const supplier = await createUser({
      suffix: 'owner',
      role: 'SUPPLIER',
      supplierProfile: {
        supplierType: 'WORKSHOP',
        publicName: 'Owner Workshop',
        description: 'A complete workshop profile',
        verificationStatus: 'VERIFIED',
        verificationAdminNote: 'must not appear while approved',
        verificationSubmittedAt: new Date('2026-01-01T00:00:00.000Z'),
        verificationReviewedAt: new Date('2026-01-02T00:00:00.000Z'),
        defaultPickupLocationId: location.id,
        avatarImageUrl: '/uploads/materials/legacy-avatar.webp',
        organizationProfile: {
          create: {
            organizationName: 'Owner Workshop',
            organizationType: 'WORKSHOP',
            contactPersonName: 'Owner Contact',
            workingDays: ['MONDAY', 'TUESDAY'],
            workingHours: { from: '09:00', to: '17:00' },
          },
        },
      },
    });

    const result = await getSupplierProfileManagement(supplier.id);
    assert.equal(result.identity?.supplierProfileId, (await prisma.supplierProfile.findUnique({ where: { userId: supplier.id }, select: { id: true } }))?.id);
    assert.equal(result.pickupLocation?.addressLine, 'Owner-only address');
    assert.equal(result.pickupLocation?.visibility, 'PUBLIC');
    assert.equal(result.pickupLocation?.isApproximate, true);
    assert.equal(result.verification.status, 'APPROVED');
    assert.equal(result.verification.isVerified, true);
    assert.equal(result.verification.adminNote, null);
    assert.deepEqual(result.organization?.workingDays, ['MONDAY', 'TUESDAY']);
    assert.deepEqual(result.organization?.workingHours, { from: '09:00', to: '17:00' });
    assert.equal(result.completion.percentage, 100);
    assert.equal(result.identity?.avatarImageUrl, '/uploads/materials/legacy-avatar.webp');
    assert.equal('email' in result, false);
    assert.equal('metrics' in result, false);
    assert.equal('followers' in result, false);
    assert.equal('materials' in result, false);
    assert.equal('pickupAllowed' in result, false);
    assert.equal('deliveryAllowed' in result, false);
  });

  test('new/incomplete and individual Supplier profiles remain truthful', async () => {
    const incomplete = await createUser({ suffix: 'incomplete', role: 'SUPPLIER', supplierProfile: { supplierType: 'WORKSHOP', verificationStatus: 'UNVERIFIED' } });
    const incompleteResult = await getSupplierProfileManagement(incomplete.id);
    assert.equal(incompleteResult.completion.completedCount, 1);
    assert.deepEqual(incompleteResult.completion.missingFields, ['PUBLIC_NAME', 'DESCRIPTION', 'PICKUP_LOCATION', 'LOCATION_VISIBILITY']);
    assert.equal(incompleteResult.verification.canSubmit, true);
    assert.equal(incompleteResult.organization, null);

    const individual = await createUser({ suffix: 'individual', role: 'SUPPLIER', supplierProfile: { supplierType: 'INDIVIDUAL_SUPPLIER', publicName: 'Individual', description: 'Individual supplier', verificationStatus: 'NOT_REQUIRED' } });
    const individualResult = await getSupplierProfileManagement(individual.id);
    assert.equal(individualResult.verification.status, 'NOT_REQUIRED');
    assert.equal(individualResult.verification.canSubmit, false);
    assert.equal(individualResult.organization, null);
  });

  test('unauthenticated and non-Supplier callers are rejected by the route', async () => {
    const unauthenticated = await requestManagement();
    assert.equal(unauthenticated.status, 401);

    const learner = await createUser({ suffix: 'learner', role: 'LEARNER' });
    const learnerToken = signAccessToken({ sub: learner.id, roles: ['LEARNER'] });
    const forbidden = await requestManagement(learnerToken);
    assert.equal(forbidden.status, 403);
  });

  test('Supplier caller can read only their own management workspace', async () => {
    const firstLocation = await createLocation('first');
    const first = await createUser({ suffix: 'first', role: 'SUPPLIER', supplierProfile: { supplierType: 'INDIVIDUAL_SUPPLIER', publicName: 'First Supplier', description: 'First description', defaultPickupLocationId: firstLocation.id, verificationStatus: 'NOT_REQUIRED' } });
    const secondLocation = await createLocation('second');
    const second = await createUser({ suffix: 'second', role: 'SUPPLIER', supplierProfile: { supplierType: 'INDIVIDUAL_SUPPLIER', publicName: 'Second Supplier', description: 'Second description', defaultPickupLocationId: secondLocation.id, verificationStatus: 'NOT_REQUIRED' } });

    const firstToken = signAccessToken({ sub: first.id, roles: ['SUPPLIER'] });
    const response = await requestManagement(firstToken);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { data: { identity: { publicName: string } } };
    assert.equal(body.data.identity.publicName, 'First Supplier');
    assert.notEqual(body.data.identity.publicName, 'Second Supplier');
  });
});
