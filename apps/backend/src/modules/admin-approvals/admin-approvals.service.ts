import type { Prisma, MaterialCondition } from '../../generated/prisma/index.js';

import {
  applyConditionPriceMultiplier,
  conditionPriceMultiplier,
} from '../../constants/material-condition-factors.js';
import { AppError } from '../../utils/app-error.js';
import { prisma } from '../../database/prisma.js';
import { decimalToNumber } from '../../utils/decimal.js';
import { createNotification } from '../notifications/notifications.repository.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

import {
  ADMIN_ACTIVITY_ACTIONS,
  ADMIN_ACTIVITY_TARGET_TYPES,
  logAdminActivity,
} from '../admin/admin-activity-log.js';
import * as repository from './admin-approvals.repository.js';
import type {
  ApprovalsListQuery,
  ApproveCategoryRequestInput,
  ApprovePriceRequestInput,
  RejectCategoryRequestInput,
  RejectPriceRequestInput,
} from './admin-approvals.validation.js';
import {
  isAllowedIdenticalSharedTechnicalName,
  normalizeCategoryNameForDisplay,
} from './admin-approvals.validation.js';

type ApprovalSummaryDto = {
  pendingTotal: number;
  approvedTotal: number;
  rejectedTotal: number;
  categoryPending: number;
  pricePending: number;
};

const countByStatus = (
  rows: Array<{ status: string; _count: { _all: number } }>,
) => {
  const result = { pending: 0, approved: 0, rejected: 0 };
  for (const row of rows) {
    switch (row.status) {
      case 'APPROVED':
        result.approved += row._count._all;
        break;
      case 'REJECTED':
        result.rejected += row._count._all;
        break;
      default:
        result.pending += row._count._all;
        break;
    }
  }
  return result;
};

export const getApprovalsSummary = async (): Promise<ApprovalSummaryDto> => {
  const { category, price } = await repository.countApprovalsSummary();
  const categoryCounts = countByStatus(category);
  const priceCounts = countByStatus(price);

  const pendingTotal = categoryCounts.pending + priceCounts.pending;
  const approvedTotal = categoryCounts.approved + priceCounts.approved;
  const rejectedTotal = categoryCounts.rejected + priceCounts.rejected;

  return {
    pendingTotal,
    approvedTotal,
    rejectedTotal,
    categoryPending: categoryCounts.pending,
    pricePending: priceCounts.pending,
  };
};

const buildPagination = (query: ApprovalsListQuery, total: number) => ({
  page: query.page,
  limit: query.limit,
  total,
});

type CategoryRequestListItemDto = {
  id: string;
  requestedName: string;
  status: string;
  createdAt: string;
  supplierName: string | null;
  supplierEmail: string | null;
  supplierOrganization: string | null;
  adminNote: string | null;
  approvedCategoryId: string | null;
  materialTitle: string | null;
  materialDescription: string | null;
  quantity: number | null;
  unit: string | null;
  condition: string | null;
  sourceType: string | null;
  locationLabel: string | null;
  categoryRequestReason: string | null;
  similarCategories: string[];
  suggestedCategory: ApprovalCategoryOptionDto | null;
};

type ApprovalCategoryOptionDto = {
  id: string;
  nameEn: string;
  nameAr: string;
  categoryType: string;
  status: 'ACTIVE';
  materialCount: number;
  materialFamily: {
    id: string;
    canonicalKey: string;
    labelEn: string;
    labelAr: string;
  } | null;
  matchType?: repository.ApprovalCategoryMatchType;
};

const mapApprovalCategoryOption = (
  category: repository.ApprovalCategoryRecord,
  matchType?: repository.ApprovalCategoryMatchType,
): ApprovalCategoryOptionDto => ({
  id: category.id,
  nameEn: category.nameEn,
  nameAr: category.nameAr,
  categoryType: category.categoryType,
  status: 'ACTIVE',
  materialCount: category._count.materials,
  materialFamily: category.materialFamilyConcept
    ? {
        id: category.materialFamilyConcept.id,
        canonicalKey: category.materialFamilyConcept.canonicalKey,
        labelEn: category.materialFamilyConcept.labelEn,
        labelAr: category.materialFamilyConcept.labelAr,
      }
    : null,
  ...(matchType ? { matchType } : {}),
});

const readDraftString = (draft: unknown, key: string): string | null => {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return null;
  }
  const value = (draft as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const readDraftNumber = (draft: unknown, key: string): number | null => {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return null;
  }
  const value = (draft as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const extractLocationLabel = (draft: unknown): string | null => {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return null;
  }
  const record = draft as Record<string, unknown>;
  if (record.useDefaultPickupLocation === true) {
    return 'Supplier default pickup location';
  }
  const pickup = record.pickupLocation;
  if (!pickup || typeof pickup !== 'object' || Array.isArray(pickup)) {
    return null;
  }
  const location = pickup as Record<string, unknown>;
  const city = typeof location.city === 'string' ? location.city.trim() : '';
  const area = typeof location.area === 'string' ? location.area.trim() : '';
  const parts = [city, area].filter((part) => part.length > 0);
  return parts.length > 0 ? parts.join(', ') : null;
};

const mapCategoryRequestContext = (listingDraftJson: unknown) => {
  const materialName = readDraftString(listingDraftJson, 'materialName');
  const title = readDraftString(listingDraftJson, 'title');
  const materialTitle = materialName ?? title;

  return {
    materialTitle,
    materialDescription: readDraftString(listingDraftJson, 'description'),
    quantity: readDraftNumber(listingDraftJson, 'quantity'),
    unit: readDraftString(listingDraftJson, 'unit'),
    condition: readDraftString(listingDraftJson, 'condition'),
    sourceType: readDraftString(listingDraftJson, 'sourceType'),
    locationLabel: extractLocationLabel(listingDraftJson),
    categoryRequestReason: readDraftString(listingDraftJson, 'categoryRequestReason'),
  };
};

export const listCategoryRequestsForAdmin = async (query: ApprovalsListQuery) => {
  const skip = (query.page - 1) * query.limit;

  const where: Prisma.CategoryRequestWhereInput = {};
  if (query.status) {
    where.status = query.status;
  }
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { requestedName: { contains: search, mode: 'insensitive' } },
      { requestedBy: { displayName: { contains: search, mode: 'insensitive' } } },
      { requestedBy: { email: { contains: search, mode: 'insensitive' } } },
      {
        requestedBy: {
          supplierProfile: { is: { publicName: { contains: search, mode: 'insensitive' } } },
        },
      },
      {
        requestedBy: {
          supplierProfile: {
            is: { organizationProfile: { is: { organizationName: { contains: search, mode: 'insensitive' } } } },
          },
        },
      },
    ];
  }

  const { items, total } = await repository.listCategoryRequestsForAdmin({
    where,
    skip,
    take: query.limit,
  });

  const activeMaterialCategories =
    await repository.listActiveMaterialCategoryOptions();
  const mapped: CategoryRequestListItemDto[] = items.map((item) => {
      const context = mapCategoryRequestContext(item.listingDraftJson);
      const suggested = repository.findSuggestedCategoryForApproval(
        activeMaterialCategories,
        item.requestedName,
      );

      return {
        id: item.id,
        requestedName: item.requestedName,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        supplierName: item.requestedBy.displayName,
        supplierEmail: item.requestedBy.email,
        supplierOrganization:
          item.requestedBy.supplierProfile?.organizationProfile?.organizationName ??
          item.requestedBy.supplierProfile?.publicName ??
          null,
        adminNote: item.moderatorNote,
        approvedCategoryId: item.approvedCategoryId,
        ...context,
        similarCategories: suggested
          ? [...new Set([suggested.category.nameEn, suggested.category.nameAr])]
          : [],
        suggestedCategory: suggested
          ? mapApprovalCategoryOption(suggested.category, suggested.matchType)
          : null,
      };
    });

  return {
    items: mapped,
    pagination: buildPagination(query, total),
  };
};

export const listMaterialFamilyOptions = async () => ({
  items: await repository.listActiveMaterialFamilyOptions(),
});

export const listMaterialCategoryOptions = async () => ({
  items: (await repository.listActiveMaterialCategoryOptions()).map(
    (category) => mapApprovalCategoryOption(category),
  ),
});

type CategoryApprovalDependencies = {
  runTransaction: <T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ) => Promise<T>;
  findRequest: typeof repository.findCategoryRequestByIdForApproval;
  findConcept: typeof repository.findTaxonomyConceptByIdForApproval;
  findExistingCategory: typeof repository.findExistingCategoryByIdForApproval;
  listActiveCategories: typeof repository.listActiveMaterialCategoryOptions;
  findSuggestedCategory: typeof repository.findSuggestedCategoryForApproval;
  findNameConflict: typeof repository.findCategoryNameConflictForApproval;
  createCategory: typeof repository.createOwnedMaterialCategoryForApproval;
  approveRequest: typeof repository.markPendingCategoryRequestApproved;
  createNotification: typeof repository.createCategoryApprovalNotification;
  createActivity: typeof repository.createCategoryApprovalActivity;
};

const categoryApprovalDependencies: CategoryApprovalDependencies = {
  runTransaction: runSerializableTransaction,
  findRequest: repository.findCategoryRequestByIdForApproval,
  findConcept: repository.findTaxonomyConceptByIdForApproval,
  findExistingCategory: repository.findExistingCategoryByIdForApproval,
  listActiveCategories: repository.listActiveMaterialCategoryOptions,
  findSuggestedCategory: repository.findSuggestedCategoryForApproval,
  findNameConflict: repository.findCategoryNameConflictForApproval,
  createCategory: repository.createOwnedMaterialCategoryForApproval,
  approveRequest: repository.markPendingCategoryRequestApproved,
  createNotification: repository.createCategoryApprovalNotification,
  createActivity: repository.createCategoryApprovalActivity,
};

const fieldError = (
  message: string,
  code: string,
  path:
    | 'materialFamilyConceptId'
    | 'existingCategoryId'
    | 'nameEn'
    | 'nameAr'
    | 'adminJustification'
    | 'sharedNameAcknowledged',
  statusCode = 400,
  details: Record<string, unknown> = {},
) =>
  new AppError(message, statusCode, code, {
    issues: [{ path, message, code }],
    ...details,
  });

export const createCategoryRequestApprover = (
  overrides: Partial<CategoryApprovalDependencies> = {},
) => {
  const dependencies = { ...categoryApprovalDependencies, ...overrides };

  return async (
    adminId: string,
    id: string,
    input: ApproveCategoryRequestInput,
  ) => {
    return dependencies.runTransaction(async (tx) => {
      const existing = await dependencies.findRequest(tx, id);
      if (!existing) {
        throw new AppError('Category request not found', 404, 'NOT_FOUND');
      }
      if (existing.status !== 'PENDING') {
        throw new AppError(
          'Only pending category requests can be approved.',
          409,
          'CATEGORY_REQUEST_NOT_PENDING',
        );
      }

      let resolutionMode: 'USE_EXISTING_CATEGORY' | 'CREATE_NEW_CATEGORY';
      let approvedCategoryId: string;
      let categoryNameEn: string;
      let categoryNameAr: string;
      let concept: NonNullable<
        Awaited<ReturnType<typeof repository.findTaxonomyConceptByIdForApproval>>
      >;
      let responseCategory: Record<string, unknown>;
      let adminJustification: string | null = null;
      let sharedNameAcknowledged = false;

      if (input.resolution === 'USE_EXISTING_CATEGORY') {
        resolutionMode = input.resolution;
        const selected = await dependencies.findExistingCategory(
          tx,
          input.existingCategoryId.trim(),
        );
        if (!selected) {
          throw fieldError(
            'Selected existing category was not found.',
            'EXISTING_CATEGORY_NOT_FOUND',
            'existingCategoryId',
          );
        }
        if (
          selected.categoryType !== 'MATERIAL' &&
          selected.categoryType !== 'BOTH'
        ) {
          throw fieldError(
            'Selected category cannot be used for materials.',
            'EXISTING_CATEGORY_TYPE_MISMATCH',
            'existingCategoryId',
          );
        }
        if (!selected.isActive) {
          throw fieldError(
            'Selected existing category is inactive.',
            'EXISTING_CATEGORY_INACTIVE',
            'existingCategoryId',
          );
        }
        if (!selected.materialFamilyConceptId || !selected.materialFamilyConcept) {
          throw fieldError(
            'Selected category does not have material-family ownership.',
            'EXISTING_CATEGORY_UNOWNED',
            'existingCategoryId',
          );
        }
        if (selected.materialFamilyConcept.conceptType !== 'MATERIAL_FAMILY') {
          throw fieldError(
            'Selected category has invalid material-family ownership.',
            'EXISTING_CATEGORY_FAMILY_TYPE_MISMATCH',
            'existingCategoryId',
          );
        }
        if (selected.materialFamilyConcept.status !== 'ACTIVE') {
          throw fieldError(
            'Selected category material family is inactive.',
            'EXISTING_CATEGORY_FAMILY_INACTIVE',
            'existingCategoryId',
          );
        }
        approvedCategoryId = selected.id;
        categoryNameEn = selected.nameEn;
        categoryNameAr = selected.nameAr;
        concept = selected.materialFamilyConcept;
        responseCategory = mapApprovalCategoryOption(selected);
      } else {
        resolutionMode = input.resolution;
        const nameEn = normalizeCategoryNameForDisplay(input.nameEn);
        const nameAr = normalizeCategoryNameForDisplay(input.nameAr);
        const sharedTechnicalName = isAllowedIdenticalSharedTechnicalName(
          nameEn,
          nameAr,
        );
        if (sharedTechnicalName && input.sharedNameAcknowledged !== true) {
          throw fieldError(
            'Confirm that the identical technical term is intentionally used in both language fields.',
            'SHARED_CATEGORY_NAME_ACKNOWLEDGEMENT_REQUIRED',
            'sharedNameAcknowledged',
          );
        }
        sharedNameAcknowledged = input.sharedNameAcknowledged === true;
        const materialFamilyConceptId = input.materialFamilyConceptId.trim();
        const selectedConcept = await dependencies.findConcept(
          tx,
          materialFamilyConceptId,
        );
        if (!selectedConcept) {
          throw fieldError(
            'Selected material family was not found.',
            'MATERIAL_FAMILY_NOT_FOUND',
            'materialFamilyConceptId',
          );
        }
        if (selectedConcept.conceptType !== 'MATERIAL_FAMILY') {
          throw fieldError(
            'Selected taxonomy concept is not a material family.',
            'TAXONOMY_CONCEPT_TYPE_MISMATCH',
            'materialFamilyConceptId',
          );
        }
        if (selectedConcept.status !== 'ACTIVE') {
          throw fieldError(
            'Selected material family is inactive.',
            'MATERIAL_FAMILY_INACTIVE',
            'materialFamilyConceptId',
          );
        }
        concept = selectedConcept;

        const activeMaterialCategories =
          await dependencies.listActiveCategories(tx);
        const suggested = dependencies.findSuggestedCategory(
          activeMaterialCategories,
          existing.requestedName,
        );
        adminJustification = input.adminJustification?.trim() || null;
        if (suggested?.matchType === 'EXACT_NAME' && !adminJustification) {
          throw fieldError(
            'Explain why the suggested existing category does not fit.',
            'CREATE_CATEGORY_JUSTIFICATION_REQUIRED',
            'adminJustification',
          );
        }

        const conflict = await dependencies.findNameConflict(tx, {
          nameEn,
          nameAr,
        });
        if (conflict) {
          const conflictingCategory = conflict.category;
          const family = conflictingCategory.materialFamilyConcept;
          const canUseExisting =
            conflictingCategory.isActive &&
            (conflictingCategory.categoryType === 'MATERIAL' ||
              conflictingCategory.categoryType === 'BOTH') &&
            family?.conceptType === 'MATERIAL_FAMILY' &&
            family.status === 'ACTIVE';
          throw fieldError(
            'A category with this name already exists.',
            'CATEGORY_NAME_CONFLICT',
            conflict.proposedField,
            409,
            {
              matchedProposedField: conflict.proposedField,
              matchedStoredField: conflict.storedField,
              conflictingCategory: {
                id: conflictingCategory.id,
                nameEn: conflictingCategory.nameEn,
                nameAr: conflictingCategory.nameAr,
                canUseExisting,
                materialFamily: family
                  ? {
                      canonicalKey: family.canonicalKey,
                      labelEn: family.labelEn,
                      labelAr: family.labelAr,
                    }
                  : null,
              },
            },
          );
        }

        const createdCategory = await dependencies.createCategory(tx, {
          nameEn,
          nameAr,
          materialFamilyConceptId: concept.id,
        });
        approvedCategoryId = createdCategory.id;
        categoryNameEn = createdCategory.nameEn;
        categoryNameAr = createdCategory.nameAr;
        responseCategory = {
          id: createdCategory.id,
          nameEn: createdCategory.nameEn,
          nameAr: createdCategory.nameAr,
          categoryType: createdCategory.categoryType,
          status: 'ACTIVE',
          materialCount: 0,
          materialFamily: {
            id: concept.id,
            canonicalKey: concept.canonicalKey,
            labelEn: concept.labelEn,
            labelAr: concept.labelAr,
          },
          materialFamilyConceptId: createdCategory.materialFamilyConceptId,
          projectTopicConceptId: createdCategory.projectTopicConceptId,
        };
      }

      const updatedRequest = await dependencies.approveRequest(tx, {
        requestId: existing.id,
        approvedCategoryId,
      });
      if (!updatedRequest) {
        throw new AppError(
          'Only pending category requests can be approved.',
          409,
          'CATEGORY_REQUEST_NOT_PENDING',
        );
      }

      await dependencies.createNotification(tx, {
        userId: existing.requestedByUserId,
        requestId: existing.id,
        requestedName: existing.requestedName,
        adminId,
        resolutionMode,
        categoryNameEn,
        categoryNameAr,
      });
      await dependencies.createActivity(tx, {
        adminId,
        requestId: existing.id,
        requestedName: existing.requestedName,
        resolutionMode,
        categoryNameEn,
        categoryNameAr,
        approvedCategoryId,
        supplierEmail: existing.requestedBy.email,
        adminJustification,
        sharedNameAcknowledged,
        concept,
      });

      return {
        request: {
          id: updatedRequest.id,
          requestedName: updatedRequest.requestedName,
          status: updatedRequest.status,
          adminNote: updatedRequest.moderatorNote,
          approvedCategoryId: updatedRequest.approvedCategoryId,
          createdAt: updatedRequest.createdAt.toISOString(),
          updatedAt: updatedRequest.updatedAt.toISOString(),
        },
        resolution: resolutionMode,
        category: responseCategory,
      };
    });
  };
};

export const approveCategoryRequest = createCategoryRequestApprover();

export const rejectCategoryRequest = async (
  adminId: string,
  id: string,
  input: RejectCategoryRequestInput,
) => {
  const existing = await repository.findCategoryRequestByIdForAdmin(id);
  if (!existing) {
    throw new AppError('Category request not found', 404, 'NOT_FOUND');
  }

  if (existing.status !== 'PENDING') {
    throw new AppError('Only pending requests can be rejected', 409, 'CONFLICT');
  }

  const suggestedCategoryId = input.suggestedCategoryId?.trim() || null;

  const activeCategoryCount = await prisma.category.count({
    where: { isActive: true, categoryType: 'MATERIAL' },
  });
  if (activeCategoryCount > 0 && !suggestedCategoryId) {
    throw new AppError(
      'Suggested existing category is required when categories are available.',
      400,
      'VALIDATION_ERROR',
    );
  }

  const suggestedCategoryName = suggestedCategoryId
    ? (
        await prisma.category.findUnique({
          where: { id: suggestedCategoryId },
          select: { nameEn: true, isActive: true },
        })
      )?.nameEn ?? null
    : null;

  const readableAdminNote = suggestedCategoryId
    ? `Suggested category: ${suggestedCategoryName ?? 'Unknown category'}\nReason: ${input.adminNote.trim()}`
    : input.adminNote.trim();

  const updated = await repository.rejectCategoryRequest({
    requestId: existing.id,
    adminNote: readableAdminNote,
    suggestedCategoryId,
  });

  const readableBody = suggestedCategoryId
    ? `Your category request "${existing.requestedName}" was rejected. Suggested category: ${suggestedCategoryName ?? 'Unknown category'}. Reason: ${input.adminNote.trim()}`
    : `Your category request "${existing.requestedName}" was rejected. Reason: ${input.adminNote.trim()}`;

  await createNotification({
      userId: existing.requestedByUserId,
      notificationType: 'CATEGORY_REQUEST_UPDATE',
      title: 'Category request rejected',
      body: readableBody,
      relatedEntityType: 'CATEGORY_REQUEST',
      relatedEntityId: existing.id,
      eventKey: `material-review:category:${existing.id}:REJECTED`,
      entityType: 'CATEGORY_REQUEST',
      entityId: existing.id,
      actionType: 'EDIT_LISTING',
      actorId: adminId,
  });

  await logAdminActivity({
    actorUserId: adminId,
    action: ADMIN_ACTIVITY_ACTIONS.CATEGORY_REQUEST_REJECTED,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.CATEGORY_REQUEST,
    targetId: existing.id,
    targetLabel: existing.requestedName,
    metadata: {
      adminNote: input.adminNote.trim(),
      suggestedCategoryId,
      suggestedCategoryName,
      supplierEmail: existing.requestedBy.email,
    },
  });

  return {
    request: {
      id: updated.id,
      requestedName: updated.requestedName,
      status: updated.status,
      adminNote: updated.moderatorNote,
      approvedCategoryId: updated.approvedCategoryId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
};

type PriceRequestListItemDto = {
  id: string;
  status: string;
  createdAt: string;
  materialTitle: string | null;
  supplierName: string | null;
  supplierEmail: string | null;
  supplierOrganization: string | null;
  categoryName: string | null;
  unit: string | null;
  condition: string | null;
  quantity: number | null;
  supplierPriceNis: number | null;
  aiSuggestedMaxUnitPriceNis: number | null;
  aiSuggestedMaxTotalPriceNis: number | null;
  conditionMultiplier: number | null;
  adjustedMaxUnitPriceNis: number | null;
  adminNote: string | null;
};

const resolvePriceRequestCondition = (
  condition: string | null,
  listingDraftJson: unknown,
): MaterialCondition | null => {
  const draftCondition = readDraftString(listingDraftJson, 'condition');
  const raw = condition ?? draftCondition;
  if (
    raw === 'NEW' ||
    raw === 'LIKE_NEW' ||
    raw === 'GOOD' ||
    raw === 'USED' ||
    raw === 'NEEDS_REPAIR'
  ) {
    return raw;
  }

  return null;
};

export const listPriceRequestsForAdmin = async (query: ApprovalsListQuery) => {
  const skip = (query.page - 1) * query.limit;

  const where: Prisma.PriceRuleRequestWhereInput = {};
  if (query.status) {
    where.status = query.status;
  }
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { materialName: { contains: search, mode: 'insensitive' } },
      { normalizedMaterialName: { contains: search, mode: 'insensitive' } },
      { requestedBy: { displayName: { contains: search, mode: 'insensitive' } } },
      { requestedBy: { email: { contains: search, mode: 'insensitive' } } },
      { category: { nameEn: { contains: search, mode: 'insensitive' } } },
      { materialType: { nameEn: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const { items, total } = await repository.listPriceRuleRequestsForAdmin({
    where,
    skip,
    take: query.limit,
  });

  const mapped: PriceRequestListItemDto[] = items.map((item) => {
    const baseMax = decimalToNumber(item.aiSuggestedMaxUnitPriceNis);
    const selectedCondition = resolvePriceRequestCondition(
      item.condition,
      item.listingDraftJson,
    );
    const multiplier = selectedCondition
      ? conditionPriceMultiplier(selectedCondition)
      : null;
    const adjustedMax =
      baseMax != null && selectedCondition
        ? applyConditionPriceMultiplier(baseMax, selectedCondition)
        : null;

    return {
      id: item.id,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      materialTitle: item.publishedMaterial?.title ?? item.materialName ?? null,
      supplierName: item.requestedBy?.displayName ?? null,
      supplierEmail: item.requestedBy?.email ?? null,
      supplierOrganization:
        item.requestedBy?.supplierProfile?.organizationProfile?.organizationName ??
        item.requestedBy?.supplierProfile?.publicName ??
        null,
      categoryName: item.category?.nameEn ?? null,
      unit: item.unit ?? item.materialType?.defaultUnit ?? null,
      condition: selectedCondition,
      quantity: decimalToNumber(item.quantity),
      supplierPriceNis: decimalToNumber(item.supplierPriceNis),
      aiSuggestedMaxUnitPriceNis: baseMax,
      aiSuggestedMaxTotalPriceNis: decimalToNumber(
        item.aiSuggestedMaxTotalPriceNis,
      ),
      conditionMultiplier: multiplier,
      adjustedMaxUnitPriceNis: adjustedMax,
      adminNote: item.moderatorNote,
    };
  });

  return {
    items: mapped,
    pagination: buildPagination(query, total),
  };
};

const ensurePendingPriceRequest = async (id: string) => {
  const existing = await repository.findPriceRuleRequestByIdForAdmin(id);
  if (!existing) {
    throw new AppError('Price request not found', 404, 'NOT_FOUND');
  }
  const requesterId = existing.requestedByUserId;
  if (!requesterId) {
    throw new AppError('Price request is missing a requester', 409, 'CONFLICT');
  }
  if (existing.status !== 'PENDING') {
    throw new AppError('Only pending requests can be reviewed', 409, 'CONFLICT');
  }
  return { ...existing, requestedByUserId: requesterId };
};

export const approvePriceRequest = async (
  adminId: string,
  id: string,
  input: ApprovePriceRequestInput,
) => {
  const existing = await ensurePendingPriceRequest(id);
  const requesterId = existing.requestedByUserId;

  const approvedMax =
    existing.supplierPriceNis == null ? null : decimalToNumber(existing.supplierPriceNis);

  const updated = await repository.updatePriceRuleRequestDecision({
    id: existing.id,
    status: 'APPROVED',
    moderatorNote: input.adminNote?.trim() || null,
    approvedMaxAllowedUnitPriceNis: approvedMax,
  });

  await createNotification({
      userId: requesterId,
      notificationType: 'PRICE_REQUEST_UPDATE',
      title: 'Price request approved',
      body: 'Your requested price was approved.',
      relatedEntityType: 'PRICE_RULE_REQUEST',
      relatedEntityId: existing.id,
      eventKey: `material-review:price:${existing.id}:APPROVED`,
      entityType: 'PRICE_RULE_REQUEST',
      entityId: existing.id,
      actionType: 'CONTINUE_LISTING',
      actorId: adminId,
  });

  const priceTargetLabel =
    existing.publishedMaterial?.title ?? existing.materialName ?? 'Price request';

  await logAdminActivity({
    actorUserId: adminId,
    action: ADMIN_ACTIVITY_ACTIONS.PRICE_REQUEST_APPROVED,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.PRICE_RULE_REQUEST,
    targetId: existing.id,
    targetLabel: priceTargetLabel,
    metadata: {
      adminNote: input.adminNote?.trim() || null,
      supplierEmail: existing.requestedBy?.email ?? null,
      categoryName: existing.category?.nameEn ?? null,
      approvedMaxUnitPriceNis: approvedMax,
    },
  });

  return updated;
};

export const rejectPriceRequest = async (
  adminId: string,
  id: string,
  input: RejectPriceRequestInput,
) => {
  const existing = await ensurePendingPriceRequest(id);
  const requesterId = existing.requestedByUserId;
  const maxAllowed = input.maxAllowedPrice;
  const note = input.adminNote.trim();

  const updated = await repository.updatePriceRuleRequestDecision({
    id: existing.id,
    status: 'REJECTED',
    moderatorNote: `Max allowed unit price: ${maxAllowed} NIS\nReason: ${note}`,
    approvedMaxAllowedUnitPriceNis: maxAllowed,
  });

  await createNotification({
      userId: requesterId,
      notificationType: 'PRICE_REQUEST_UPDATE',
      title: 'Price request rejected',
      body: `Your requested price was rejected. Maximum allowed price: ${maxAllowed} NIS. Reason: ${note}`,
      relatedEntityType: 'PRICE_RULE_REQUEST',
      relatedEntityId: existing.id,
      eventKey: `material-review:price:${existing.id}:REJECTED`,
      entityType: 'PRICE_RULE_REQUEST',
      entityId: existing.id,
      actionType: 'EDIT_LISTING',
      actorId: adminId,
  });

  const priceTargetLabel =
    existing.publishedMaterial?.title ?? existing.materialName ?? 'Price request';

  await logAdminActivity({
    actorUserId: adminId,
    action: ADMIN_ACTIVITY_ACTIONS.PRICE_REQUEST_REJECTED,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.PRICE_RULE_REQUEST,
    targetId: existing.id,
    targetLabel: priceTargetLabel,
    metadata: {
      adminNote: note,
      maxAllowedPrice: maxAllowed,
      supplierEmail: existing.requestedBy?.email ?? null,
      materialTitle: priceTargetLabel,
    },
  });

  return updated;
};

