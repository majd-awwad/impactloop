import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';

import {
  approveSupplierVerification,
  listSupplierVerificationsForAdmin,
  rejectSupplierVerification,
  requestChangesForSupplierVerification,
} from './admin-supplier-verifications.service.js';

const TEST_MARKER = '[test-admin-supplier-verifications]';

type CreatedIds = {
  users: string[];
  supplierProfiles: string[];
  organizationProfiles: string[];
  locations: string[];
  notifications: string[];
};

const ids: CreatedIds = {
  users: [],
  supplierProfiles: [],
  organizationProfiles: [],
  locations: [],
  notifications: [],
};

async function createAdminUser() {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Admin`,
      email: `${TEST_MARKER}-admin-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createOrganizationSupplier(input: {
  emailSuffix: string;
  supplierType: 'WORKSHOP' | 'FACTORY' | 'EDUCATIONAL_INSTITUTION';
  organizationName: string;
  verificationStatus?: string;
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const location = await prisma.location.create({
    data: {
      country: 'Palestine',
      city: 'Nablus',
      area: 'Test Area',
      visibility: 'PRIVATE',
      isApproximate: true,
    },
  });
  ids.locations.push(location.id);

  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier ${input.emailSuffix}`,
      email: `${TEST_MARKER}-${input.emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: input.supplierType,
          publicName: input.organizationName,
          verificationStatus: input.verificationStatus ?? 'PENDING',
          verificationSubmittedAt: new Date(),
          defaultPickupLocationId: location.id,
          organizationProfile: {
            create: {
              organizationName: input.organizationName,
              organizationType: input.supplierType,
              verificationDocumentStatus: 'PENDING',
              verificationDocumentUrl: 'https://example.com/doc.pdf',
              verificationDocumentName: 'doc.pdf',
              businessLocationId: location.id,
            },
          },
        },
      },
    },
    include: {
      supplierProfile: {
        include: {
          organizationProfile: true,
        },
      },
    },
  });

  ids.users.push(user.id);
  if (user.supplierProfile) {
    ids.supplierProfiles.push(user.supplierProfile.id);
    if (user.supplierProfile.organizationProfile) {
      ids.organizationProfiles.push(user.supplierProfile.organizationProfile.id);
    }
  }

  return user;
}

before(() => {
  process.env.NODE_ENV = 'test';
});

after(async () => {
  if (ids.notifications.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: ids.notifications } },
    });
  }

  if (ids.organizationProfiles.length > 0) {
    await prisma.organizationProfile.deleteMany({
      where: { id: { in: ids.organizationProfiles } },
    });
  }

  if (ids.supplierProfiles.length > 0) {
    await prisma.supplierProfile.deleteMany({
      where: { id: { in: ids.supplierProfiles } },
    });
  }

  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({
      where: { id: { in: ids.locations } },
    });
  }

  if (ids.users.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: ids.users } },
    });
  }
});

describe('admin supplier verifications service', () => {
  test('lists organization supplier verification requests with filters', async () => {
    await createOrganizationSupplier({
      emailSuffix: 'workshop',
      supplierType: 'WORKSHOP',
      organizationName: `${TEST_MARKER} Workshop`,
    });

    const result = await listSupplierVerificationsForAdmin({
      page: 1,
      limit: 20,
      status: 'PENDING',
      search: TEST_MARKER,
      supplierType: 'WORKSHOP',
      city: 'Nablus',
    });

    assert.ok(result.items.length >= 1);
    assert.equal(result.items[0]?.verificationStatus, 'PENDING');
    assert.ok(result.summary.pending >= 1);
    assert.ok(result.pagination.total >= 1);
  });

  test('approve, reject, and request-changes update status and create notifications', async () => {
    const admin = await createAdminUser();
    const supplier = await createOrganizationSupplier({
      emailSuffix: 'review-flow',
      supplierType: 'FACTORY',
      organizationName: `${TEST_MARKER} Factory`,
      verificationStatus: 'PENDING',
    });

    const supplierProfileId = supplier.supplierProfile!.id;

    const approved = await approveSupplierVerification(admin.id, supplierProfileId, {
      adminNote: 'Looks good',
    });
    assert.equal(approved.verificationStatus, 'APPROVED');
    assert.ok(approved.reviewedAt);

    let notifications = await prisma.notification.findMany({
      where: {
        userId: supplier.id,
        relatedEntityId: supplierProfileId,
      },
    });
    ids.notifications.push(...notifications.map((item) => item.id));
    assert.ok(notifications.some((item) => item.notificationType === 'SUPPLIER_VERIFICATION_UPDATE'));

    await prisma.supplierProfile.update({
      where: { id: supplierProfileId },
      data: { verificationStatus: 'PENDING' },
    });

    const rejected = await rejectSupplierVerification(admin.id, supplierProfileId, {
      adminNote: 'Missing documents',
    });
    assert.equal(rejected.verificationStatus, 'REJECTED');
    assert.equal(rejected.adminNote, 'Missing documents');

    notifications = await prisma.notification.findMany({
      where: {
        userId: supplier.id,
        relatedEntityId: supplierProfileId,
      },
    });
    ids.notifications.push(
      ...notifications
        .map((item) => item.id)
        .filter((id) => !ids.notifications.includes(id)),
    );
    assert.ok(notifications.length >= 2);

    await prisma.supplierProfile.update({
      where: { id: supplierProfileId },
      data: { verificationStatus: 'PENDING' },
    });

    const changes = await requestChangesForSupplierVerification(
      admin.id,
      supplierProfileId,
      { adminNote: 'Upload a clearer license scan' },
    );
    assert.equal(changes.verificationStatus, 'CHANGES_REQUESTED');
    assert.equal(changes.adminNote, 'Upload a clearer license scan');
  });

  test('reject and request-changes require admin note in validation schema', async () => {
    const {
      approveSupplierVerificationSchema,
      rejectSupplierVerificationSchema,
    } = await import('./admin-supplier-verifications.validation.js');

    const approveEmptyBody = approveSupplierVerificationSchema.safeParse(
      undefined,
    );
    assert.equal(approveEmptyBody.success, true);

    const rejectResult = rejectSupplierVerificationSchema.safeParse({
      adminNote: '  ',
    });
    assert.equal(rejectResult.success, false);
  });
});
