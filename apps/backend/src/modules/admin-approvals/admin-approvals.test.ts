import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import { submitCategoryRequest } from '../category-requests/category-requests.service.js';

import {
  approveCategoryRequest,
  approvePriceRequest,
  getApprovalsSummary,
  rejectCategoryRequest,
  rejectPriceRequest,
} from './admin-approvals.service.js';

const TEST_MARKER = '[test-admin-approvals]';

async function createAdminUser() {
  const passwordHash = await hashPassword('TestPassword123!');
  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Admin`,
      email: `${TEST_MARKER}-admin-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
      emailVerifiedAt: new Date(),
    },
  });
}

async function seedSupplierUser() {
  const passwordHash = await hashPassword('SupplierPassword123!');
  const email = `supplier.${Date.now()}@impactloop.test`;
  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier`,
      email,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: `${TEST_MARKER} Supplier`,
          verificationStatus: 'NOT_REQUIRED',
        },
      },
    },
  });
}

describe('admin approvals', () => {
  test('summary counts pending approvals', async () => {
    const summary = await getApprovalsSummary();
    assert.ok(typeof summary.pendingTotal === 'number');
  });

  test('category approve creates category and marks request approved', async () => {
    const admin = await createAdminUser();
    const supplier = await seedSupplierUser();

    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} New Category`,
        normalizedRequestedName: 'new-category',
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });

    const approved = await approveCategoryRequest(admin.id, categoryRequest.id, {
      finalName: `${TEST_MARKER} Final Category`,
    });

    assert.equal(approved.request.status, 'APPROVED');
    assert.ok(approved.createdCategory.id);

    const createdCategory = await prisma.category.findUnique({
      where: { id: approved.createdCategory.id },
    });
    assert.ok(createdCategory);
  });

  test('category reject requires suggested category when categories exist', async () => {
    const admin = await createAdminUser();
    const supplier = await seedSupplierUser();

    const existingCategory = await prisma.category.findFirst({
      where: { isActive: true, categoryType: 'MATERIAL' },
      select: { id: true },
    });
    assert.ok(existingCategory, 'Expected at least one active material category');

    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} Reject Suggested`,
        normalizedRequestedName: 'reject-suggested',
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });

    await assert.rejects(
      () =>
        rejectCategoryRequest(admin.id, categoryRequest.id, {
          adminNote: 'Choose an existing category instead.',
        }),
      (error: unknown) => error instanceof AppError,
    );

    const rejected = await rejectCategoryRequest(admin.id, categoryRequest.id, {
      adminNote: 'Choose an existing category instead.',
      suggestedCategoryId: existingCategory.id,
    });

    assert.equal(rejected.request.status, 'REJECTED');
    assert.match(rejected.request.adminNote ?? '', /Suggested category:/);
  });

  test('category request submit rejects missing material context', async () => {
    const supplier = await seedSupplierUser();

    await assert.rejects(
      () =>
        submitCategoryRequest(supplier.id, {
          requestedName: `${TEST_MARKER} Incomplete`,
          listingDraftJson: {
            materialName: '',
            title: '',
            description: '',
            requestedCategoryName: `${TEST_MARKER} Incomplete`,
            condition: 'GOOD',
            quantity: 1,
            unit: 'piece',
            isFree: true,
            currency: 'NIS',
            pickupAllowed: true,
            deliveryAllowed: false,
            imageUrls: [],
          },
        }),
      (error: unknown) => error instanceof AppError,
    );
  });

  test('category reject requires note and marks request rejected', async () => {
    const admin = await createAdminUser();
    const supplier = await seedSupplierUser();

    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} Rejected Category`,
        normalizedRequestedName: 'rejected-category',
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });

    const existingCategory = await prisma.category.findFirst({
      where: { isActive: true, categoryType: 'MATERIAL' },
      select: { id: true },
    });

    const rejected = await rejectCategoryRequest(admin.id, categoryRequest.id, {
      adminNote: 'Choose an existing category instead.',
      suggestedCategoryId: existingCategory?.id,
    });

    assert.equal(rejected.request.status, 'REJECTED');
    assert.ok(rejected.request.adminNote);
  });

  test('price approve/reject updates request status and approved max price', async () => {
    const admin = await createAdminUser();
    const supplier = await seedSupplierUser();

    const request = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} Material`,
        normalizedMaterialName: 'material',
        unit: 'piece',
        supplierPriceNis: 25,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });

    const approved = await approvePriceRequest(admin.id, request.id, {});
    assert.equal(approved.status, 'APPROVED');

    const request2 = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} Material 2`,
        normalizedMaterialName: 'material-2',
        unit: 'piece',
        supplierPriceNis: 35,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });

    const rejected = await rejectPriceRequest(admin.id, request2.id, {
      adminNote: 'Too high',
      maxAllowedPrice: 20,
    });
    assert.equal(rejected.status, 'REJECTED');
    const approvedMax =
      // prisma decimal has toNumber; fallback for nullish
      (rejected.aiSuggestedMaxUnitPriceNis as any)?.toNumber?.() ??
      Number(rejected.aiSuggestedMaxUnitPriceNis);
    assert.equal(approvedMax, 20);
  });
});

