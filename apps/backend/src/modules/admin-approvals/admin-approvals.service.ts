import type { Prisma } from '../../generated/prisma/index.js';

import { AppError } from '../../utils/app-error.js';
import { prisma } from '../../database/prisma.js';
import { decimalToNumber } from '../../utils/decimal.js';

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
};

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

const findSimilarCategoryNames = async (requestedName: string): Promise<string[]> => {
  const normalized = requestedName.trim();
  if (!normalized) {
    return [];
  }

  const firstToken = normalized.split(/\s+/).find((part) => part.length >= 3) ?? normalized;
  const categories = await prisma.category.findMany({
    where: {
      isActive: true,
      categoryType: 'MATERIAL',
      nameEn: {
        contains: firstToken,
        mode: 'insensitive',
      },
    },
    select: { nameEn: true },
    take: 8,
    orderBy: { nameEn: 'asc' },
  });

  const requestedLower = normalized.toLowerCase();
  return categories
    .map((category) => category.nameEn)
    .filter((name) => name.toLowerCase() !== requestedLower)
    .slice(0, 3);
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

  const mapped: CategoryRequestListItemDto[] = await Promise.all(
    items.map(async (item) => {
      const context = mapCategoryRequestContext(item.listingDraftJson);
      const similarCategories = await findSimilarCategoryNames(item.requestedName);

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
        similarCategories,
      };
    }),
  );

  return {
    items: mapped,
    pagination: buildPagination(query, total),
  };
};

export const approveCategoryRequest = async (
  adminId: string,
  id: string,
  input: ApproveCategoryRequestInput,
) => {
  const existing = await repository.findCategoryRequestByIdForAdmin(id);
  if (!existing) {
    throw new AppError('Category request not found', 404, 'NOT_FOUND');
  }

  if (existing.status !== 'PENDING') {
    throw new AppError('Only pending requests can be approved', 409, 'CONFLICT');
  }

  const finalName = input.finalName.trim();
  const adminNote = input.adminNote?.trim() || null;

  const { createdCategory, updatedRequest } = await repository.approveCategoryRequest({
    requestId: existing.id,
    category: {
      nameEn: finalName,
      nameAr: finalName,
      parentId: input.parentCategoryId?.trim() || null,
    },
    adminNote,
  });

  await prisma.notification.create({
    data: {
      userId: existing.requestedByUserId,
      notificationType: 'CATEGORY_REQUEST_UPDATE',
      title: 'Category request approved',
      body: `Your category request "${existing.requestedName}" was approved.`,
      relatedEntityType: 'CATEGORY_REQUEST',
      relatedEntityId: existing.id,
    },
  });

  await logAdminActivity({
    actorUserId: adminId,
    action: ADMIN_ACTIVITY_ACTIONS.CATEGORY_REQUEST_APPROVED,
    targetType: ADMIN_ACTIVITY_TARGET_TYPES.CATEGORY_REQUEST,
    targetId: existing.id,
    targetLabel: finalName,
    metadata: {
      requestedName: existing.requestedName,
      finalName,
      parentCategoryId: input.parentCategoryId?.trim() || null,
      adminNote,
      approvedCategoryId: createdCategory.id,
      supplierEmail: existing.requestedBy.email,
    },
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
    createdCategory: {
      id: createdCategory.id,
      nameEn: createdCategory.nameEn,
      nameAr: createdCategory.nameAr,
      parentId: createdCategory.parentId,
    },
  };
};

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

  await prisma.notification.create({
    data: {
      userId: existing.requestedByUserId,
      notificationType: 'CATEGORY_REQUEST_UPDATE',
      title: 'Category request rejected',
      body: readableBody,
      relatedEntityType: 'CATEGORY_REQUEST',
      relatedEntityId: existing.id,
    },
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
  adminNote: string | null;
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

  const mapped: PriceRequestListItemDto[] = items.map((item) => ({
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
    condition: item.condition ?? null,
    quantity: decimalToNumber(item.quantity),
    supplierPriceNis: decimalToNumber(item.supplierPriceNis),
    aiSuggestedMaxUnitPriceNis: decimalToNumber(item.aiSuggestedMaxUnitPriceNis),
    aiSuggestedMaxTotalPriceNis: decimalToNumber(item.aiSuggestedMaxTotalPriceNis),
    adminNote: item.moderatorNote,
  }));

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

  await prisma.notification.create({
    data: {
      userId: requesterId,
      notificationType: 'PRICE_REQUEST_UPDATE',
      title: 'Price request approved',
      body: 'Your requested price was approved.',
      relatedEntityType: 'PRICE_RULE_REQUEST',
      relatedEntityId: existing.id,
    },
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

  await prisma.notification.create({
    data: {
      userId: requesterId,
      notificationType: 'PRICE_REQUEST_UPDATE',
      title: 'Price request rejected',
      body: `Your requested price was rejected. Maximum allowed price: ${maxAllowed} NIS. Reason: ${note}`,
      relatedEntityType: 'PRICE_RULE_REQUEST',
      relatedEntityId: existing.id,
    },
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

