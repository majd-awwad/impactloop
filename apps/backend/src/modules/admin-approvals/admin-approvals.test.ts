import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { AppError } from '../../utils/app-error.js';

import { submitCategoryRequest } from '../category-requests/category-requests.service.js';
import { getCategoryRequestDraft } from '../category-requests/category-requests.service.js';

import {
  approveCategoryRequest,
  approvePriceRequest,
  createCategoryRequestApprover,
  getApprovalsSummary,
  listMaterialCategoryOptions,
  listMaterialFamilyOptions,
  rejectCategoryRequest,
  rejectPriceRequest,
} from './admin-approvals.service.js';
import {
  approveCategoryRequestSchema,
  normalizeCategoryNameForComparison,
  normalizeCategoryNameForDisplay,
} from './admin-approvals.validation.js';
import { findSuggestedCategoryForApproval } from './admin-approvals.repository.js';
import {
  auditCategoryTaxonomyOwnership,
  buildAuthoritativeLegacyCategoryIndex,
} from '../taxonomy/category-taxonomy-ownership.js';

const TEST_MARKER = '[test-admin-approvals]';

const PG_CONCURRENT_QUERY_WARNING =
  'Calling client.query() when the client is already executing a query is deprecated';

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

async function activeMaterialFamily() {
  return prisma.taxonomyConcept.findFirstOrThrow({
    where: { conceptType: 'MATERIAL_FAMILY', status: 'ACTIVE' },
    select: {
      id: true,
      canonicalKey: true,
      conceptType: true,
      status: true,
      labelEn: true,
      labelAr: true,
    },
  });
}

type ApprovalTestResources = {
  adminUserId?: string;
  supplierUserId?: string;
  categoryRequestId?: string;
  ownedCategoryIds?: string[];
  taxonomyConceptIds?: string[];
  priceRequestIds?: string[];
};

const cleanupApprovalTestExecution = async (resources: ApprovalTestResources) => {
  await prisma.$transaction(
    async (tx) => {
      const ownedCategoryIds = [
        ...new Set(resources.ownedCategoryIds ?? []),
      ];

      if (resources.categoryRequestId) {
        const request = await tx.categoryRequest.findUnique({
          where: { id: resources.categoryRequestId },
          select: { id: true, requestedByUserId: true },
        });
        assert.ok(request, 'The exact category request created by this test is missing.');
        assert.equal(request.requestedByUserId, resources.supplierUserId);

        await tx.notification.deleteMany({
          where: {
            userId: resources.supplierUserId,
            notificationType: 'CATEGORY_REQUEST_UPDATE',
            relatedEntityType: 'CATEGORY_REQUEST',
            relatedEntityId: request.id,
          },
        });
        await tx.adminActivityLog.deleteMany({
          where: {
            actorUserId: resources.adminUserId,
            targetType: 'CATEGORY_REQUEST',
            targetId: request.id,
          },
        });

        const deletedRequest = await tx.categoryRequest.deleteMany({
          where: {
            id: request.id,
            requestedByUserId: resources.supplierUserId,
          },
        });
        assert.equal(deletedRequest.count, 1, 'Failed to delete this test invocation\'s category request.');
      }

      if (ownedCategoryIds.length > 0) {
        const deletedCategories = await tx.category.deleteMany({
          where: { id: { in: ownedCategoryIds } },
        });
        assert.equal(
          deletedCategories.count,
          ownedCategoryIds.length,
          'Failed to delete every explicitly owned category for this test invocation.',
        );
      }
      if (resources.taxonomyConceptIds?.length) {
        await tx.taxonomyConcept.deleteMany({
          where: { id: { in: resources.taxonomyConceptIds } },
        });
      }

      if (resources.priceRequestIds?.length) {
        await tx.notification.deleteMany({
          where: {
            relatedEntityType: 'PRICE_RULE_REQUEST',
            relatedEntityId: { in: resources.priceRequestIds },
          },
        });
        await tx.adminActivityLog.deleteMany({
          where: {
            targetType: 'PRICE_RULE_REQUEST',
            targetId: { in: resources.priceRequestIds },
          },
        });
        await tx.priceRuleRequest.deleteMany({
          where: { id: { in: resources.priceRequestIds } },
        });
      }

      if (resources.supplierUserId) {
        const deletedSupplier = await tx.user.deleteMany({
          where: { id: resources.supplierUserId },
        });
        assert.equal(deletedSupplier.count, 1, 'Failed to delete this test invocation\'s supplier.');
      }
      if (resources.adminUserId) {
        const deletedAdmin = await tx.user.deleteMany({
          where: { id: resources.adminUserId },
        });
        assert.equal(deletedAdmin.count, 1, 'Failed to delete this test invocation\'s admin.');
      }
    },
    {
      isolationLevel: 'Serializable',
      maxWait: 5_000,
      timeout: 30_000,
    },
  );
};

describe('admin approvals', () => {
  test('summary counts pending approvals', async () => {
    const summary = await getApprovalsSummary();
    assert.ok(typeof summary.pendingTotal === 'number');
  });

  test('category approval contract requires independently reviewed bilingual names', () => {
    assert.equal(approveCategoryRequestSchema.safeParse({}).success, false);
    assert.equal(
      approveCategoryRequestSchema.safeParse({
        resolution: 'USE_EXISTING_CATEGORY',
        existingCategoryId: 'category-1',
        nameEn: 'Mixed payload',
      }).success,
      false,
    );
    const missingEnglish = approveCategoryRequestSchema.safeParse({
      resolution: 'CREATE_NEW_CATEGORY',
      nameAr: 'زجاجيات المختبر',
      materialFamilyConceptId: 'concept-1',
    });
    assert.equal(missingEnglish.success, false);
    const missingArabic = approveCategoryRequestSchema.safeParse({
      resolution: 'CREATE_NEW_CATEGORY',
      nameEn: 'Lab Glassware',
      materialFamilyConceptId: 'concept-1',
    });
    assert.equal(missingArabic.success, false);
    assert.equal(
      approveCategoryRequestSchema.safeParse({
        resolution: 'CREATE_NEW_CATEGORY',
        finalName: 'Legacy name',
        materialFamilyConceptId: 'concept-1',
      }).success,
      false,
    );

    const valid = approveCategoryRequestSchema.safeParse({
      resolution: 'CREATE_NEW_CATEGORY',
      nameEn: ' Lab   Glassware ',
      nameAr: ' زجاجيات   المختبر ',
      materialFamilyConceptId: 'concept-1',
    });
    assert.equal(valid.success, true);
    if (valid.success && valid.data.resolution === 'CREATE_NEW_CATEGORY') {
      assert.equal(valid.data.nameEn, 'Lab Glassware');
      assert.equal(valid.data.nameAr, 'زجاجيات المختبر');
    }
    assert.equal(
      normalizeCategoryNameForDisplay(
        '  Art   and\tCraft\nSupplies  ',
      ),
      'Art and Craft Supplies',
    );
    assert.equal(
      normalizeCategoryNameForComparison(' Lab   Glassware ', 'EN'),
      'lab glassware',
    );
    assert.equal(
      normalizeCategoryNameForDisplay('mDf Composite Boards'),
      'mDf Composite Boards',
      'Display normalization must preserve spelling and capitalization.',
    );
    for (const term of [
      'CNC',
      'MDF',
      'PETG',
      'Arduino',
      'Raspberry Pi',
      '3D Printing',
    ]) {
      assert.equal(
        approveCategoryRequestSchema.safeParse({
          resolution: 'CREATE_NEW_CATEGORY',
          nameEn: term,
          nameAr: term,
          materialFamilyConceptId: 'concept-1',
        }).success,
        true,
        `${term} should be accepted as a bounded shared technical term.`,
      );
    }
    assert.equal(
      approveCategoryRequestSchema.safeParse({
        resolution: 'CREATE_NEW_CATEGORY',
        nameEn: 'زجاجيات المختبر',
        nameAr: 'زجاجيات المختبر',
        materialFamilyConceptId: 'concept-1',
      }).success,
      false,
    );
    assert.equal(
      approveCategoryRequestSchema.safeParse({
        resolution: 'CREATE_NEW_CATEGORY',
        nameEn: 'Lab Glassware',
        nameAr: 'English Only',
        materialFamilyConceptId: 'concept-1',
      }).success,
      false,
    );
    assert.equal(
      approveCategoryRequestSchema.safeParse({
        resolution: 'CREATE_NEW_CATEGORY',
        nameEn: 'Reusable Laboratory Tools',
        nameAr: 'Reusable Laboratory Tools',
        materialFamilyConceptId: 'concept-1',
      }).success,
      false,
      'An identical ordinary English phrase must not bypass Arabic validation.',
    );
    assert.equal(
      approveCategoryRequestSchema.safeParse({
        resolution: 'CREATE_NEW_CATEGORY',
        nameEn: 'Lab\u0000 Glassware',
        nameAr: 'زجاجيات المختبر',
        materialFamilyConceptId: 'concept-1',
      }).success,
      false,
    );
    assert.equal(
      approveCategoryRequestSchema.safeParse({
        resolution: 'CREATE_NEW_CATEGORY',
        nameEn:
          'Reusable Laboratory Glassware Materials for Schools and Universities with Many Different Shapes and Sizes',
        nameAr: 'زجاجيات المختبر',
        materialFamilyConceptId: 'concept-1',
      }).success,
      false,
    );
  });

  test('category suggestions retain exact bilingual matches and classify partial tokens', () => {
    const exactCategory = {
      id: 'exact-category',
      nameEn: 'Lab Glassware',
      nameAr: 'زجاجيات المختبر',
    } as any;
    const partialCategory = {
      id: 'partial-category',
      nameEn: 'Laboratory Equipment',
      nameAr: 'معدات تعليمية',
    } as any;
    const unrelatedCategory = {
      id: 'unrelated-category',
      nameEn: 'Wood Boards',
      nameAr: 'ألواح خشبية',
    } as any;
    const categories = [partialCategory, exactCategory, unrelatedCategory];

    assert.deepEqual(
      findSuggestedCategoryForApproval(categories, ' Lab   Glassware '),
      { category: exactCategory, matchType: 'EXACT_NAME' },
      'An English exact match must be retained and ranked before token matches.',
    );
    assert.deepEqual(
      findSuggestedCategoryForApproval(categories, 'زُجَاجِيَّات الـمختبر'),
      { category: exactCategory, matchType: 'EXACT_NAME' },
      'An Arabic exact match must use the reviewed Arabic comparison normalization.',
    );
    assert.deepEqual(
      findSuggestedCategoryForApproval(categories, 'Laboratory Tools'),
      { category: partialCategory, matchType: 'PARTIAL_TOKEN' },
    );
    assert.equal(
      findSuggestedCategoryForApproval(categories, 'Ceramic Tiles'),
      null,
      'Unrelated categories must not be suggested.',
    );
  });

  test('shared technical names require backend acknowledgement and record it', async (context) => {
    const resources: ApprovalTestResources = {};
    context.after(() => cleanupApprovalTestExecution(resources));
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} Shared Technical Name`,
        normalizedRequestedName: 'shared-technical-name',
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = request.id;
    const concept = await activeMaterialFamily();

    await assert.rejects(
      () =>
        approveCategoryRequest(admin.id, request.id, {
          resolution: 'CREATE_NEW_CATEGORY',
          nameEn: 'CNC',
          nameAr: 'CNC',
          materialFamilyConceptId: concept.id,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'SHARED_CATEGORY_NAME_ACKNOWLEDGEMENT_REQUIRED' &&
        (error.details as any)?.issues?.[0]?.path ===
          'sharedNameAcknowledged',
      'A direct service/API path must not bypass the acknowledgement.',
    );

    const approved = await approveCategoryRequest(admin.id, request.id, {
      resolution: 'CREATE_NEW_CATEGORY',
      nameEn: 'CNC',
      nameAr: 'CNC',
      materialFamilyConceptId: concept.id,
      sharedNameAcknowledged: true,
    });
    resources.ownedCategoryIds = [approved.category.id as string];
    const activity = await prisma.adminActivityLog.findFirstOrThrow({
      where: { action: 'CATEGORY_REQUEST_APPROVED', targetId: request.id },
    });
    assert.equal(
      (activity.metadata as any).sharedNameAcknowledged,
      true,
    );
  });

  test('use-existing approval reuses an owned category and preserves listing continuation', async (context) => {
    const resources: ApprovalTestResources = {};
    context.after(() => cleanupApprovalTestExecution(resources));
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;
    const concept = await activeMaterialFamily();
    const selectedCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} Existing resolution ${Date.now()}`,
        nameAr: `${TEST_MARKER} Existing resolution ${Date.now()}`,
        categoryType: 'MATERIAL',
        isActive: true,
        materialFamilyConceptId: concept.id,
      },
    });
    resources.ownedCategoryIds = [selectedCategory.id];
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: 'Specialized reusable lab item',
        normalizedRequestedName: `specialized-reusable-${Date.now()}`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
        listingDraftJson: {
          materialName: 'Reusable lab item',
          title: 'Reusable lab item',
        },
      },
    });
    resources.categoryRequestId = request.id;
    const categoryCount = await prisma.category.count();

    const approved = await approveCategoryRequest(admin.id, request.id, {
      resolution: 'USE_EXISTING_CATEGORY',
      existingCategoryId: selectedCategory.id,
    });

    assert.equal(approved.resolution, 'USE_EXISTING_CATEGORY');
    assert.equal(approved.request.approvedCategoryId, selectedCategory.id);
    assert.equal(approved.category.id, selectedCategory.id);
    assert.equal(await prisma.category.count(), categoryCount);
    const draft = await getCategoryRequestDraft(supplier.id, request.id);
    assert.equal(draft.canContinue, true);
    assert.equal(draft.approvedCategoryId, selectedCategory.id);

    const notification = await prisma.notification.findUniqueOrThrow({
      where: { eventKey: `material-review:category:${request.id}:APPROVED` },
    });
    assert.match(notification.body, /existing marketplace category/i);
    const activity = await prisma.adminActivityLog.findFirstOrThrow({
      where: { action: 'CATEGORY_REQUEST_APPROVED', targetId: request.id },
    });
    const metadata = activity.metadata as Record<string, unknown>;
    assert.equal(metadata.resolutionMode, 'USE_EXISTING_CATEGORY');
    assert.equal(metadata.selectedCategoryId, selectedCategory.id);
    assert.equal(metadata.materialFamilyConceptId, concept.id);
  });

  test('cleanup removes an explicitly owned existing fixture after approval fails before decision', async (context) => {
    const resources: ApprovalTestResources = { ownedCategoryIds: [] };
    let cleaned = false;
    context.after(async () => {
      if (!cleaned) await cleanupApprovalTestExecution(resources);
    });
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;
    const concept = await activeMaterialFamily();
    const fixture = await prisma.category.create({
      data: {
        nameEn: `Owned Existing Failure ${Date.now()}`,
        nameAr: `فئة مملوكة لفشل الاختبار ${Date.now()}`,
        categoryType: 'MATERIAL',
        isActive: true,
        materialFamilyConceptId: concept.id,
      },
    });
    resources.ownedCategoryIds!.push(fixture.id, fixture.id);
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: `Owned fixture failure ${Date.now()}`,
        normalizedRequestedName: `owned-fixture-failure-${Date.now()}`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = request.id;
    const approver = createCategoryRequestApprover({
      approveRequest: async () => null,
    });

    await assert.rejects(
      () =>
        approver(admin.id, request.id, {
          resolution: 'USE_EXISTING_CATEGORY',
          existingCategoryId: fixture.id,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'CATEGORY_REQUEST_NOT_PENDING',
    );
    assert.equal(
      (
        await prisma.categoryRequest.findUniqueOrThrow({
          where: { id: request.id },
        })
      ).approvedCategoryId,
      null,
    );

    await cleanupApprovalTestExecution(resources);
    cleaned = true;
    assert.equal(await prisma.category.count({ where: { id: fixture.id } }), 0);
    assert.equal(
      await prisma.categoryRequest.count({ where: { id: request.id } }),
      0,
    );
    assert.equal(
      await prisma.user.count({ where: { id: { in: [admin.id, supplier.id] } } }),
      0,
    );
  });

  test('cleanup preserves a pre-existing category used by an approved request', async (context) => {
    const resources: ApprovalTestResources = {};
    let cleaned = false;
    context.after(async () => {
      if (!cleaned) await cleanupApprovalTestExecution(resources);
    });
    const preExistingCategory = await prisma.category.findFirstOrThrow({
      where: {
        isActive: true,
        categoryType: { in: ['MATERIAL', 'BOTH'] },
        materialFamilyConcept: {
          is: { conceptType: 'MATERIAL_FAMILY', status: 'ACTIVE' },
        },
      },
      select: { id: true, nameEn: true },
    });
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: `Pre-existing cleanup safety ${Date.now()}`,
        normalizedRequestedName: `pre-existing-cleanup-${Date.now()}`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = request.id;

    const approved = await approveCategoryRequest(admin.id, request.id, {
      resolution: 'USE_EXISTING_CATEGORY',
      existingCategoryId: preExistingCategory.id,
    });
    assert.equal(approved.request.approvedCategoryId, preExistingCategory.id);
    assert.equal(resources.ownedCategoryIds, undefined);

    await cleanupApprovalTestExecution(resources);
    cleaned = true;
    assert.equal(
      await prisma.category.count({ where: { id: preExistingCategory.id } }),
      1,
      `Cleanup must preserve pre-existing category ${preExistingCategory.nameEn}.`,
    );
    assert.equal(
      await prisma.categoryRequest.count({ where: { id: request.id } }),
      0,
    );
    assert.equal(
      await prisma.user.count({ where: { id: { in: [admin.id, supplier.id] } } }),
      0,
    );
  });

  test('use-existing approval rejects inactive, non-material, and unowned categories', async (context) => {
    const resources: ApprovalTestResources = { ownedCategoryIds: [] };
    context.after(() => cleanupApprovalTestExecution(resources));
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;
    const concept = await activeMaterialFamily();
    const categories = await Promise.all([
      prisma.category.create({
        data: {
          nameEn: `${TEST_MARKER} Inactive existing ${Date.now()}`,
          nameAr: `${TEST_MARKER} Inactive existing ${Date.now()}`,
          categoryType: 'MATERIAL',
          isActive: false,
          materialFamilyConceptId: concept.id,
        },
      }),
      prisma.category.create({
        data: {
          nameEn: `${TEST_MARKER} Project existing ${Date.now()}`,
          nameAr: `${TEST_MARKER} Project existing ${Date.now()}`,
          categoryType: 'PROJECT',
          isActive: true,
        },
      }),
      prisma.category.create({
        data: {
          nameEn: `${TEST_MARKER} Unowned existing ${Date.now()}`,
          nameAr: `${TEST_MARKER} Unowned existing ${Date.now()}`,
          categoryType: 'MATERIAL',
          isActive: true,
        },
      }),
    ]);
    resources.ownedCategoryIds!.push(...categories.map(({ id }) => id));
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: 'Existing validation request',
        normalizedRequestedName: `existing-validation-${Date.now()}`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = request.id;

    for (const [category, code] of [
      [categories[0]!, 'EXISTING_CATEGORY_INACTIVE'],
      [categories[1]!, 'EXISTING_CATEGORY_TYPE_MISMATCH'],
      [categories[2]!, 'EXISTING_CATEGORY_UNOWNED'],
    ] as const) {
      await assert.rejects(
        () =>
          approveCategoryRequest(admin.id, request.id, {
            resolution: 'USE_EXISTING_CATEGORY',
            existingCategoryId: category.id,
          }),
        (error: unknown) => error instanceof AppError && error.code === code,
      );
    }
    assert.equal(
      (await prisma.categoryRequest.findUniqueOrThrow({ where: { id: request.id } })).status,
      'PENDING',
    );
  });

  test('material category options expose only active owned material-capable categories', async () => {
    const result = await listMaterialCategoryOptions();
    assert.ok(result.items.length > 0);
    assert.equal(
      result.items.every(
        (item) =>
          item.status === 'ACTIVE' &&
          (item.categoryType === 'MATERIAL' || item.categoryType === 'BOTH') &&
          item.materialFamily != null,
      ),
      true,
    );
  });

  test('material family options expose only active material families', async (context) => {
    const resources: ApprovalTestResources = { taxonomyConceptIds: [] };
    context.after(() => cleanupApprovalTestExecution(resources));
    const inactive = await prisma.taxonomyConcept.create({
      data: {
        canonicalKey: `material-family:test-inactive-${Date.now()}`,
        conceptType: 'MATERIAL_FAMILY',
        status: 'INACTIVE',
        labelEn: `${TEST_MARKER} Inactive`,
        labelAr: `${TEST_MARKER} Inactive`,
      },
    });
    const wrongType = await prisma.taxonomyConcept.create({
      data: {
        canonicalKey: `interest:test-active-${Date.now()}`,
        conceptType: 'INTEREST',
        status: 'ACTIVE',
        labelEn: `${TEST_MARKER} Wrong type`,
        labelAr: `${TEST_MARKER} Wrong type`,
      },
    });
    resources.taxonomyConceptIds!.push(inactive.id, wrongType.id);

    const result = await listMaterialFamilyOptions();
    assert.ok(result.items.length > 0);
    assert.equal(result.items.some(({ id }) => id === inactive.id), false);
    assert.equal(result.items.some(({ id }) => id === wrongType.id), false);
    assert.equal(
      result.items.every(
        ({ conceptType, status }) =>
          conceptType === 'MATERIAL_FAMILY' && status === 'ACTIVE',
      ),
      true,
    );
  });

  test('category approval rejects invalid concept states', async (context) => {
    const resources: ApprovalTestResources = { taxonomyConceptIds: [] };
    context.after(() => cleanupApprovalTestExecution(resources));
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} Invalid concept`,
        normalizedRequestedName: `invalid-concept-${Date.now()}`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = request.id;
    const inactive = await prisma.taxonomyConcept.create({
      data: {
        canonicalKey: `material-family:approval-inactive-${Date.now()}`,
        conceptType: 'MATERIAL_FAMILY',
        status: 'INACTIVE',
        labelEn: `${TEST_MARKER} Inactive approval`,
        labelAr: `${TEST_MARKER} Inactive approval`,
      },
    });
    const wrongType = await prisma.taxonomyConcept.create({
      data: {
        canonicalKey: `interest:approval-wrong-${Date.now()}`,
        conceptType: 'INTEREST',
        status: 'ACTIVE',
        labelEn: `${TEST_MARKER} Wrong approval`,
        labelAr: `${TEST_MARKER} Wrong approval`,
      },
    });
    resources.taxonomyConceptIds!.push(inactive.id, wrongType.id);

    for (const [conceptId, expectedCode] of [
      ['missing-concept-id', 'MATERIAL_FAMILY_NOT_FOUND'],
      [inactive.id, 'MATERIAL_FAMILY_INACTIVE'],
      [wrongType.id, 'TAXONOMY_CONCEPT_TYPE_MISMATCH'],
    ] as const) {
      await assert.rejects(
        () =>
          approveCategoryRequest(admin.id, request.id, {
            resolution: 'CREATE_NEW_CATEGORY',
            nameEn: `Invalid Approval Name ${Date.now()}`,
            nameAr: `اسم موافقة غير صالح ${Date.now()}`,
            materialFamilyConceptId: conceptId,
            adminJustification: 'The suggested category is not specific enough.',
          }),
        (error: unknown) => error instanceof AppError && error.code === expectedCode,
      );
    }
  });

  test('late activity failure rolls back the owned category and decision', async (context) => {
    const resources: ApprovalTestResources = {};
    context.after(() => cleanupApprovalTestExecution(resources));
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} Rollback`,
        normalizedRequestedName: `rollback-${Date.now()}`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = request.id;
    const concept = await activeMaterialFamily();
    const nameEn = `Rollback Category ${Date.now()}`;
    const nameAr = `فئة تراجع ${Date.now()}`;
    const approver = createCategoryRequestApprover({
      createActivity: async () => {
        throw new Error('simulated activity repository failure');
      },
    });

    await assert.rejects(
      () =>
        approver(admin.id, request.id, {
          resolution: 'CREATE_NEW_CATEGORY',
          nameEn,
          nameAr,
          materialFamilyConceptId: concept.id,
          adminJustification: 'The suggested category is not specific enough.',
        }),
      /simulated activity repository failure/,
    );

    const persistedRequest = await prisma.categoryRequest.findUniqueOrThrow({
      where: { id: request.id },
    });
    assert.equal(persistedRequest.status, 'PENDING');
    assert.equal(persistedRequest.approvedCategoryId, null);
    assert.equal(await prisma.category.count({ where: { nameEn } }), 0);
    assert.equal(
      await prisma.notification.count({
        where: { eventKey: `material-review:category:${request.id}:APPROVED` },
      }),
      0,
    );
  });

  test('category approval rejects a case-insensitive inactive name conflict', async (context) => {
    const resources: ApprovalTestResources = { ownedCategoryIds: [] };
    context.after(() => cleanupApprovalTestExecution(resources));
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;
    const conflictName = `Reusable   Laboratory Glassware ${Date.now()}`;
    const conflictNameAr = `زجاجيات مختبر موجودة ${Date.now()}`;
    const conflict = await prisma.category.create({
      data: {
        nameEn: conflictName,
        nameAr: conflictNameAr,
        categoryType: 'MATERIAL',
        isActive: false,
      },
    });
    resources.ownedCategoryIds!.push(conflict.id);
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} Conflict request`,
        normalizedRequestedName: `conflict-${Date.now()}`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = request.id;
    const concept = await activeMaterialFamily();

    await assert.rejects(
      () =>
        approveCategoryRequest(admin.id, request.id, {
          resolution: 'CREATE_NEW_CATEGORY',
          nameEn: conflictName.toUpperCase().replace(/\s+/gu, ' '),
          nameAr: `اسم عربي جديد ${Date.now()}`,
          materialFamilyConceptId: concept.id,
          adminJustification: 'The suggested category is not specific enough.',
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'CATEGORY_NAME_CONFLICT' &&
        (error.details as any).conflictingCategory.id === conflict.id &&
        (error.details as any).conflictingCategory.nameEn === conflictName &&
        (error.details as any).conflictingCategory.canUseExisting === false,
    );

    await assert.rejects(
      () =>
        approveCategoryRequest(admin.id, request.id, {
          resolution: 'CREATE_NEW_CATEGORY',
          nameEn: `Unique Laboratory Category ${Date.now()}`,
          nameAr: conflictNameAr
            .replace('زجاجيات', 'زُجَاجِيَات')
            .replace(/\s+/gu, '   '),
          materialFamilyConceptId: concept.id,
          adminJustification: 'The suggested category is not specific enough.',
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'CATEGORY_NAME_CONFLICT' &&
        (error.details as any).matchedProposedField === 'nameAr' &&
        (error.details as any).conflictingCategory.nameAr === conflictNameAr,
    );

    const crossColumnArabicName = `فئة متقاطعة ${Date.now()}`;
    const legacyCrossColumnCategory = await prisma.category.create({
      data: {
        nameEn: crossColumnArabicName,
        nameAr: `Legacy Arabic display ${Date.now()}`,
        categoryType: 'MATERIAL',
        isActive: false,
      },
    });
    resources.ownedCategoryIds!.push(legacyCrossColumnCategory.id);

    await assert.rejects(
      () =>
        approveCategoryRequest(admin.id, request.id, {
          resolution: 'CREATE_NEW_CATEGORY',
          nameEn: `Cross Column Laboratory Category ${Date.now()}`,
          nameAr: crossColumnArabicName.replace('فئة', 'فِئَة'),
          materialFamilyConceptId: concept.id,
          adminJustification: 'The suggested category is not specific enough.',
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'CATEGORY_NAME_CONFLICT' &&
        (error.details as any).matchedProposedField === 'nameAr' &&
        (error.details as any).matchedStoredField === 'nameEn' &&
        (error.details as any).conflictingCategory.nameEn ===
          crossColumnArabicName,
    );
  });

  test('material approval conflicts with BOTH but not PROJECT-only category names', async (context) => {
    const resources: ApprovalTestResources = { ownedCategoryIds: [] };
    context.after(() => cleanupApprovalTestExecution(resources));
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;
    const concept = await activeMaterialFamily();
    const suffix = Date.now();
    const bothNameEn = `Both Domain Conflict ${suffix}`;
    const bothNameAr = `تعارض مجال مزدوج ${suffix}`;
    const projectNameEn = `Shared Project Label ${suffix}`;
    const projectNameAr = `اسم مشروع مشترك ${suffix}`;
    const bothCategory = await prisma.category.create({
      data: {
        nameEn: bothNameEn,
        nameAr: bothNameAr,
        categoryType: 'BOTH',
        isActive: true,
        materialFamilyConceptId: concept.id,
      },
    });
    const projectCategory = await prisma.category.create({
      data: {
        nameEn: projectNameEn,
        nameAr: projectNameAr,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
    resources.ownedCategoryIds!.push(bothCategory.id, projectCategory.id);
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: `Material domain request ${suffix}`,
        normalizedRequestedName: `material-domain-request-${suffix}`,
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = request.id;

    await assert.rejects(
      () =>
        approveCategoryRequest(admin.id, request.id, {
          resolution: 'CREATE_NEW_CATEGORY',
          nameEn: bothNameEn.toUpperCase(),
          nameAr: `اسم مادة مستقل ${suffix}`,
          materialFamilyConceptId: concept.id,
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'CATEGORY_NAME_CONFLICT' &&
        (error.details as any).conflictingCategory.id === bothCategory.id,
    );

    const approved = await approveCategoryRequest(admin.id, request.id, {
      resolution: 'CREATE_NEW_CATEGORY',
      nameEn: projectNameEn,
      nameAr: projectNameAr,
      materialFamilyConceptId: concept.id,
    });
    const createdCategoryId = approved.category.id as string;
    resources.ownedCategoryIds!.push(createdCategoryId);
    const createdCategory = await prisma.category.findUniqueOrThrow({
      where: { id: createdCategoryId },
      include: {
        materialFamilyConcept: true,
        projectTopicConcept: true,
        _count: {
          select: {
            materials: true,
            learningProjects: true,
            projectRequiredComponents: true,
          },
        },
      },
    });

    assert.equal(createdCategory.categoryType, 'MATERIAL');
    assert.equal(createdCategory.nameEn, projectCategory.nameEn);
    assert.equal(createdCategory.nameAr, projectCategory.nameAr);
    assert.equal(createdCategory.materialFamilyConceptId, concept.id);
    assert.equal(createdCategory.projectTopicConceptId, null);
    assert.equal(approved.request.status, 'APPROVED');
    assert.equal(approved.request.approvedCategoryId, createdCategory.id);
    assert.equal(
      await prisma.notification.count({
        where: { eventKey: `material-review:category:${request.id}:APPROVED` },
      }),
      1,
    );
    assert.equal(
      await prisma.adminActivityLog.count({
        where: { action: 'CATEGORY_REQUEST_APPROVED', targetId: request.id },
      }),
      1,
    );
    const ownership = auditCategoryTaxonomyOwnership({
      category: createdCategory,
      conceptsByCanonicalKey: new Map([[concept.canonicalKey, concept]]),
    });
    assert.equal(ownership.readinessStatus, 'READY_SINGLE');
  });

  test('category approve creates category and marks request approved', async (context) => {
    const resources: ApprovalTestResources = {};
    context.after(() => cleanupApprovalTestExecution(resources));

    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;

    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} New Category`,
        normalizedRequestedName: 'new-category',
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = categoryRequest.id;

    const concept = await activeMaterialFamily();
    const executionSuffix = Date.now();
    const inputNameEn = `  FiNaL   Category\t${executionSuffix}\n`;
    const inputNameAr = `\nفئة   نهائية\t${executionSuffix}  `;
    const nameEn = `FiNaL Category ${executionSuffix}`;
    const nameAr = `فئة نهائية ${executionSuffix}`;
    const approved = await approveCategoryRequest(admin.id, categoryRequest.id, {
      resolution: 'CREATE_NEW_CATEGORY',
      nameEn: inputNameEn,
      nameAr: inputNameAr,
      materialFamilyConceptId: concept.id,
      adminJustification: 'The suggested category is not specific enough.',
    });
    resources.ownedCategoryIds = [approved.category.id as string];

    assert.equal(approved.request.status, 'APPROVED');
    assert.ok(approved.category.id);
    assert.equal(approved.category.nameEn, nameEn);
    assert.equal(approved.category.nameAr, nameAr);

    const createdCategory = await prisma.category.findUnique({
      where: { id: approved.category.id as string },
      include: {
        materialFamilyConcept: true,
        projectTopicConcept: true,
        _count: {
          select: {
            materials: true,
            learningProjects: true,
            projectRequiredComponents: true,
          },
        },
      },
    });
    assert.ok(createdCategory);
    assert.equal(createdCategory.nameEn, nameEn);
    assert.equal(createdCategory.nameAr, nameAr);
    assert.equal(createdCategory.materialFamilyConceptId, concept.id);
    assert.equal(createdCategory.projectTopicConceptId, null);
    assert.equal(createdCategory.materialFamilyConcept?.status, 'ACTIVE');
    assert.equal(createdCategory.materialFamilyConcept?.conceptType, 'MATERIAL_FAMILY');

    const legacy = buildAuthoritativeLegacyCategoryIndex();
    assert.equal(
      legacy.materialFamily.get(createdCategory.nameEn),
      undefined,
      'New category readiness must not require a legacy name mapping.',
    );
    const ownership = auditCategoryTaxonomyOwnership({
      category: createdCategory,
      conceptsByCanonicalKey: new Map([
        [concept.canonicalKey, concept],
      ]),
    });
    assert.equal(ownership.readinessStatus, 'READY_SINGLE');

    const notification = await prisma.notification.findUnique({
      where: {
        eventKey: `material-review:category:${categoryRequest.id}:APPROVED`,
      },
    });
    assert.ok(notification);
    const activity = await prisma.adminActivityLog.findFirst({
      where: {
        action: 'CATEGORY_REQUEST_APPROVED',
        targetId: categoryRequest.id,
      },
    });
    assert.ok(activity);
    assert.deepEqual(
      {
        materialFamilyConceptId: (activity.metadata as any).materialFamilyConceptId,
        materialFamilyCanonicalKey: (activity.metadata as any).materialFamilyCanonicalKey,
        materialFamilyConceptType: (activity.metadata as any).materialFamilyConceptType,
        resolutionMode: (activity.metadata as any).resolutionMode,
        finalNameEn: (activity.metadata as any).finalNameEn,
        finalNameAr: (activity.metadata as any).finalNameAr,
      },
      {
        materialFamilyConceptId: concept.id,
        materialFamilyCanonicalKey: concept.canonicalKey,
        materialFamilyConceptType: 'MATERIAL_FAMILY',
        resolutionMode: 'CREATE_NEW_CATEGORY',
        finalNameEn: nameEn,
        finalNameAr: nameAr,
      },
    );

    await assert.rejects(
      () =>
        approveCategoryRequest(admin.id, categoryRequest.id, {
          resolution: 'CREATE_NEW_CATEGORY',
          nameEn: `Final Category Again ${Date.now()}`,
          nameAr: `فئة نهائية أخرى ${Date.now()}`,
          materialFamilyConceptId: concept.id,
          adminJustification: 'The suggested category is not specific enough.',
        }),
      (error: unknown) =>
        error instanceof AppError && error.code === 'CATEGORY_REQUEST_NOT_PENDING',
    );
  });

  test('category reject requires suggested category when categories exist', async (context) => {
    const resources: ApprovalTestResources = {};
    context.after(() => cleanupApprovalTestExecution(resources));
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;

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
    resources.categoryRequestId = categoryRequest.id;

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

  test('category request submit rejects missing material context', async (context) => {
    const resources: ApprovalTestResources = {};
    context.after(() => cleanupApprovalTestExecution(resources));
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;

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

  test('category reject requires note and marks request rejected', async (context) => {
    const resources: ApprovalTestResources = {};
    context.after(() => cleanupApprovalTestExecution(resources));
    const admin = await createAdminUser();
    resources.adminUserId = admin.id;
    const supplier = await seedSupplierUser();
    resources.supplierUserId = supplier.id;

    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} Rejected Category`,
        normalizedRequestedName: 'rejected-category',
        requestedByUserId: supplier.id,
        status: 'PENDING',
      },
    });
    resources.categoryRequestId = categoryRequest.id;

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

  test('price approve/reject updates request status and approved max price', async (context) => {
    const resources: ApprovalTestResources = { priceRequestIds: [] };
    context.after(() => cleanupApprovalTestExecution(resources));
    const deprecationWarnings: string[] = [];
    const onWarning = (warning: Error) => {
      if (warning.name === 'DeprecationWarning') {
        deprecationWarnings.push(warning.message);
      }
    };

    process.on('warning', onWarning);

    try {
      const admin = await createAdminUser();
      resources.adminUserId = admin.id;
      const supplier = await seedSupplierUser();
      resources.supplierUserId = supplier.id;

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
      resources.priceRequestIds!.push(request.id);

      const approved = await approvePriceRequest(admin.id, request.id, {});
      assert.equal(approved.status, 'APPROVED');
      assert.equal(approved.requestedBy?.id, supplier.id);
      assert.ok('category' in approved);
      assert.ok('materialType' in approved);
      assert.ok('publishedMaterial' in approved);
      const approvedMax =
        (approved.adminApprovedMaxUnitPriceNis as any)?.toNumber?.() ??
        Number(approved.adminApprovedMaxUnitPriceNis);
      assert.equal(approvedMax, 25);

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
      resources.priceRequestIds!.push(request2.id);

      const rejected = await rejectPriceRequest(admin.id, request2.id, {
        adminNote: 'Too high',
        maxAllowedPrice: 20,
      });
      assert.equal(rejected.status, 'REJECTED');
      assert.equal(rejected.requestedBy?.id, supplier.id);
      assert.ok('category' in rejected);
      assert.ok('materialType' in rejected);
      assert.ok('publishedMaterial' in rejected);
      const rejectedMax =
        (rejected.adminApprovedMaxUnitPriceNis as any)?.toNumber?.() ??
        Number(rejected.adminApprovedMaxUnitPriceNis);
      assert.equal(rejectedMax, 20);
      assert.equal(rejected.aiSuggestedMaxUnitPriceNis, null);
    } finally {
      process.off('warning', onWarning);
    }

    assert.equal(
      deprecationWarnings.some((message) =>
        message.includes(PG_CONCURRENT_QUERY_WARNING),
      ),
      false,
      `Unexpected deprecation warnings: ${deprecationWarnings.join('; ')}`,
    );
  });
});
