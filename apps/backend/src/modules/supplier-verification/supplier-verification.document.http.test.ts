import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import type { Express } from 'express';

import { prisma } from '../../database/prisma.js';
import {
  ensureSupplierVerificationUploadsDir,
  publicSupplierVerificationDocumentUrl,
  SUPPLIER_VERIFICATION_UPLOADS_DIR,
} from '../uploads/verification-uploads.storage.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

const TEST_MARKER = '[test-supplier-verification-document-http]';
const DOCUMENT_BYTES = Buffer.from('%PDF-1.4 impactloop-verification-test');

let app: Express;
let adminToken = '';
let ownerToken = '';
let otherSupplierToken = '';
let adminUserId = '';
let ownerUserId = '';
let otherSupplierUserId = '';
let supplierProfileId = '';
let organizationProfileId = '';
let locationId = '';
let documentFilename = '';
let documentUrl = '';

before(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp({ recommendationEventOrigin: 'TEST' });

  ensureSupplierVerificationUploadsDir();
  documentFilename = `verification_testdoc_${Date.now()}_deadbeef.pdf`;
  documentUrl = publicSupplierVerificationDocumentUrl(documentFilename);
  fs.writeFileSync(
    path.join(SUPPLIER_VERIFICATION_UPLOADS_DIR, documentFilename),
    DOCUMENT_BYTES,
  );

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
  locationId = location.id;

  const admin = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Admin`,
      email: `${TEST_MARKER}-admin-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
    },
  });
  adminUserId = admin.id;
  adminToken = signAccessToken({ sub: admin.id, roles: ['ADMIN'] });

  const owner = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Owner`,
      email: `${TEST_MARKER}-owner-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: 'WORKSHOP',
          publicName: `${TEST_MARKER} Workshop`,
          verificationStatus: 'PENDING',
          verificationSubmittedAt: new Date(),
          defaultPickupLocationId: location.id,
          organizationProfile: {
            create: {
              organizationName: `${TEST_MARKER} Workshop`,
              organizationType: 'WORKSHOP',
              verificationDocumentStatus: 'PENDING',
              verificationDocumentUrl: documentUrl,
              verificationDocumentName: 'business-license.pdf',
              businessLocationId: location.id,
            },
          },
        },
      },
    },
    include: {
      supplierProfile: {
        include: { organizationProfile: true },
      },
    },
  });
  ownerUserId = owner.id;
  ownerToken = signAccessToken({ sub: owner.id, roles: ['SUPPLIER'] });
  supplierProfileId = owner.supplierProfile!.id;
  organizationProfileId = owner.supplierProfile!.organizationProfile!.id;

  const otherSupplier = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Other`,
      email: `${TEST_MARKER}-other-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL',
          publicName: `${TEST_MARKER} Individual`,
          verificationStatus: 'NOT_REQUIRED',
        },
      },
    },
  });
  otherSupplierUserId = otherSupplier.id;
  otherSupplierToken = signAccessToken({
    sub: otherSupplier.id,
    roles: ['SUPPLIER'],
  });
});

after(async () => {
  const filePath = path.join(
    SUPPLIER_VERIFICATION_UPLOADS_DIR,
    documentFilename,
  );
  if (documentFilename && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  if (organizationProfileId) {
    await prisma.organizationProfile.deleteMany({
      where: { id: organizationProfileId },
    });
  }

  const supplierIds = [supplierProfileId].filter(Boolean);
  if (supplierIds.length > 0) {
    await prisma.supplierProfile.deleteMany({
      where: { id: { in: supplierIds } },
    });
  }

  await prisma.supplierProfile.deleteMany({
    where: { userId: otherSupplierUserId },
  });

  if (locationId) {
    await prisma.location.deleteMany({ where: { id: locationId } });
  }

  const userIds = [adminUserId, ownerUserId, otherSupplierUserId].filter(
    Boolean,
  );
  if (userIds.length > 0) {
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

const request = async (
  requestPath: string,
  options: { token?: string; method?: string } = {},
) => {
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(
      `http://127.0.0.1:${address.port}${requestPath}`,
      {
        method: options.method ?? 'GET',
        headers: options.token
          ? { Authorization: `Bearer ${options.token}` }
          : undefined,
      },
    );
    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      body,
      contentType,
      contentDisposition: response.headers.get('content-disposition') ?? '',
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

describe('supplier verification document access', () => {
  test('anonymous static path no longer serves verification documents', async () => {
    const result = await request(documentUrl);
    assert.notEqual(result.status, 200);
    assert.ok(result.status === 401 || result.status === 403 || result.status === 404);
  });

  test('admin document download requires authentication', async () => {
    const result = await request(
      `/api/admin/supplier-verifications/${supplierProfileId}/document`,
    );
    assert.equal(result.status, 401);
  });

  test('admin can download verification document', async () => {
    const result = await request(
      `/api/admin/supplier-verifications/${supplierProfileId}/document`,
      { token: adminToken },
    );
    assert.equal(result.status, 200);
    assert.match(result.contentType, /application\/pdf/);
    assert.match(result.contentDisposition, /business-license\.pdf/);
    assert.ok(Buffer.isBuffer(result.body));
    assert.equal(
      (result.body as Buffer).compare(DOCUMENT_BYTES),
      0,
    );
  });

  test('owner supplier can download their verification document', async () => {
    const result = await request('/api/supplier/verification/document', {
      token: ownerToken,
    });
    assert.equal(result.status, 200);
    assert.match(result.contentType, /application\/pdf/);
    assert.ok(Buffer.isBuffer(result.body));
    assert.equal(
      (result.body as Buffer).compare(DOCUMENT_BYTES),
      0,
    );
  });

  test('other supplier cannot download another org verification document', async () => {
    const result = await request('/api/supplier/verification/document', {
      token: otherSupplierToken,
    });
    assert.equal(result.status, 404);
  });
});
