import { normalizeSearchText } from '../../utils/normalize-search-text.js';
import { decimalToNumber } from '../../utils/decimal.js';

import * as categoriesRepository from '../categories/categories.repository.js';
import * as categoryRequestsRepository from '../category-requests/category-requests.repository.js';
import {
  resolveFinalAllowedMaxUnitPriceNis,
  formatNisPrice,
} from '../price-rule-requests/price-rule-request-pricing.js';
import * as priceRuleRequestsRepository from '../price-rule-requests/price-rule-requests.repository.js';
import { mapSupplierReservation } from '../supplier-reservations/supplier-reservations.service.js';
import * as supplierReservationsRepository from '../supplier-reservations/supplier-reservations.repository.js';

export type SupplierActionNotification = {
  id: string;
  group: 'REVIEW_UPDATE' | 'RESERVATION_ALERT';
  kind:
    | 'CATEGORY_APPROVED'
    | 'CATEGORY_SUGGESTION'
    | 'CATEGORY_REJECTED'
    | 'CATEGORY_PENDING'
    | 'CATEGORY_COMPLETED'
    | 'PRICE_APPROVED'
    | 'PRICE_REJECTED'
    | 'PRICE_PENDING'
    | 'PRICE_COMPLETED'
    | 'RESERVATION_PENDING';
  title: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  actionNeeded: boolean;
  isCompleted: boolean;
  actionLabel: string | null;
  actionType:
    | 'CONTINUE_LISTING'
    | 'EDIT_LISTING'
    | 'EDIT_PRICE'
    | 'REVIEW_REQUEST'
    | null;
  categoryRequestId: string | null;
  priceRuleRequestId: string | null;
  reservationId: string | null;
  publishedMaterialId: string | null;
  approvedCategoryId: string | null;
  approvedCategoryName: string | null;
  maxAllowedUnitPriceNis: number | null;
  unit: string | null;
  supplierRequestedUnitPriceNis: number | null;
};

export type SupplierNotificationsSummary = {
  totalCount: number;
  actionNeededCount: number;
  reviewCount: number;
  reservationCount: number;
  completedCount: number;
};

const formatUnitLabel = (unit: string | null | undefined) => unit?.trim() || 'unit';

const formatConditionLabel = (
  condition: import('../../generated/prisma/client.js').MaterialCondition,
) => {
  switch (condition) {
    case 'NEW':
      return 'New';
    case 'LIKE_NEW':
      return 'Like new';
    case 'GOOD':
      return 'Good';
    case 'USED':
      return 'Used';
    case 'NEEDS_REPAIR':
      return 'Needs repair';
    default:
      return condition;
  }
};

const formatMaxUnitPriceBody = (
  unit: string | null | undefined,
  max: number,
  condition?: import('../../generated/prisma/client.js').MaterialCondition | null,
) => {
  const priceLabel = formatNisPrice(max);
  if (condition != null) {
    return `Maximum allowed price for ${formatConditionLabel(condition)} condition is ${priceLabel} NIS.`;
  }

  return `Maximum allowed price per ${formatUnitLabel(unit)} is ${priceLabel} NIS.`;
};

const extractDraftTitle = (listingDraftJson: unknown): string => {
  if (
    !listingDraftJson ||
    typeof listingDraftJson !== 'object' ||
    Array.isArray(listingDraftJson)
  ) {
    return '';
  }

  const title = (listingDraftJson as Record<string, unknown>).title;
  return typeof title === 'string' ? title.trim() : '';
};

const notificationSortPriority = (notification: SupplierActionNotification): number => {
  if (notification.isCompleted) {
    return 500;
  }

  if (
    notification.actionNeeded &&
    notification.group === 'REVIEW_UPDATE' &&
    notification.status === 'APPROVED'
  ) {
    return 10;
  }

  if (notification.actionNeeded && notification.kind === 'RESERVATION_PENDING') {
    return 20;
  }

  if (notification.actionNeeded && notification.status === 'REJECTED') {
    return 30;
  }

  if (!notification.actionNeeded && notification.status === 'PENDING') {
    return 40;
  }

  return 100;
};

const sortNotifications = (notifications: SupplierActionNotification[]) => {
  notifications.sort((a, b) => {
    const priorityDiff =
      notificationSortPriority(a) - notificationSortPriority(b);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return b.createdAt.localeCompare(a.createdAt);
  });
};

const suggestedCategoryPrefix = 'Suggested category:';

const resolveCategoryRejectionBody = async (
  body: string,
): Promise<string> => {
  const trimmed = body.trim();
  if (!trimmed.startsWith(suggestedCategoryPrefix)) {
    return body;
  }

  const firstLine = trimmed.split('\n')[0] ?? '';
  const raw = firstLine.replace(suggestedCategoryPrefix, '').trim();
  if (!raw) {
    return `${suggestedCategoryPrefix} Unknown category\n${trimmed}`;
  }

  // If it already looks like a name (not a cuid), keep it.
  const looksLikeCuid = raw.startsWith('c') && raw.length >= 18;
  if (!looksLikeCuid) {
    return trimmed;
  }

  const category = await categoriesRepository.findCategoryById(raw);
  const readableName = category?.nameEn?.trim() || 'Unknown category';
  return trimmed.replace(firstLine, `${suggestedCategoryPrefix} ${readableName}`);
};

const mapCategoryRequestNotification = (
  request: Awaited<
    ReturnType<typeof categoryRequestsRepository.listCategoryRequestsWithDrafts>
  >[number],
): SupplierActionNotification => {
  const approvedCategoryName = request.approvedCategory?.nameEn ?? null;
  const approvedCategoryId = request.approvedCategoryId ?? null;
  const hasDraft = request.listingDraftJson != null;
  const isCompleted = request.publishedMaterialId != null;
  const draftTitle = extractDraftTitle(request.listingDraftJson);

  if (isCompleted) {
    return {
      id: `category:${request.id}`,
      group: 'REVIEW_UPDATE',
      kind: 'CATEGORY_COMPLETED',
      title: 'Listing completed',
      body: `${draftTitle || request.requestedName} was published from this category review.`,
      status: 'APPROVED',
      createdAt: (request.publishedAt ?? request.createdAt).toISOString(),
      actionNeeded: false,
      isCompleted: true,
      actionLabel: null,
      actionType: null,
      categoryRequestId: request.id,
      priceRuleRequestId: null,
      reservationId: null,
      publishedMaterialId: request.publishedMaterialId,
      approvedCategoryId,
      approvedCategoryName,
      maxAllowedUnitPriceNis: null,
      unit: null,
      supplierRequestedUnitPriceNis: null,
    };
  }

  const isSuggestion =
    request.status === 'APPROVED' &&
    approvedCategoryName != null &&
    normalizeSearchText(approvedCategoryName) !== request.normalizedRequestedName;

  if (request.status === 'APPROVED') {
    return {
      id: `category:${request.id}`,
      group: 'REVIEW_UPDATE',
      kind: isSuggestion ? 'CATEGORY_SUGGESTION' : 'CATEGORY_APPROVED',
      title: isSuggestion ? 'Category suggestion' : 'Category approved',
      body: isSuggestion
        ? `Use ${approvedCategoryName} for this listing.`
        : `${request.requestedName} was approved. Continue your listing.`,
      status: 'APPROVED',
      createdAt: request.updatedAt.toISOString(),
      actionNeeded: hasDraft && approvedCategoryId != null,
      isCompleted: false,
      actionLabel: hasDraft ? 'Continue listing' : null,
      actionType: hasDraft ? 'CONTINUE_LISTING' : null,
      categoryRequestId: request.id,
      priceRuleRequestId: null,
      reservationId: null,
      publishedMaterialId: null,
      approvedCategoryId,
      approvedCategoryName,
      maxAllowedUnitPriceNis: null,
      unit: null,
      supplierRequestedUnitPriceNis: null,
    };
  }

  if (request.status === 'REJECTED') {
    return {
      id: `category:${request.id}`,
      group: 'REVIEW_UPDATE',
      kind: 'CATEGORY_REJECTED',
      title: 'Category rejected',
      body:
        request.moderatorNote?.trim() ||
        'Your category request was rejected. Suggested category: Unknown category\nReason: Not provided.',
      status: 'REJECTED',
      createdAt: request.updatedAt.toISOString(),
      actionNeeded: hasDraft,
      isCompleted: false,
      actionLabel: hasDraft ? 'Edit listing' : null,
      actionType: hasDraft ? 'EDIT_LISTING' : null,
      categoryRequestId: request.id,
      priceRuleRequestId: null,
      reservationId: null,
      publishedMaterialId: null,
      approvedCategoryId,
      approvedCategoryName,
      maxAllowedUnitPriceNis: null,
      unit: null,
      supplierRequestedUnitPriceNis: null,
    };
  }

  return {
    id: `category:${request.id}`,
    group: 'REVIEW_UPDATE',
    kind: 'CATEGORY_PENDING',
    title: 'Category request pending',
    body: `${request.requestedName} is waiting for admin review.`,
    status: 'PENDING',
    createdAt: request.createdAt.toISOString(),
    actionNeeded: false,
    isCompleted: false,
    actionLabel: null,
    actionType: null,
    categoryRequestId: request.id,
    priceRuleRequestId: null,
    reservationId: null,
    publishedMaterialId: null,
    approvedCategoryId,
    approvedCategoryName,
    maxAllowedUnitPriceNis: null,
    unit: null,
    supplierRequestedUnitPriceNis: null,
  };
};

export const mapPriceRuleRequestNotification = (
  request: Awaited<
    ReturnType<typeof priceRuleRequestsRepository.listPriceRuleRequestsForSupplier>
  >[number],
): SupplierActionNotification => {
  const unit = request.unit ?? request.materialType?.defaultUnit ?? null;
  const maxAllowedUnitPriceNis = resolveFinalAllowedMaxUnitPriceNis(
    request,
    request.condition,
  );
  const supplierRequestedUnitPriceNis = decimalToNumber(request.supplierPriceNis);
  const materialLabel =
    request.materialName ??
    request.materialType?.nameEn ??
    extractDraftTitle(request.listingDraftJson) ??
    'your material';
  const hasDraft = request.listingDraftJson != null;
  const isCompleted = request.publishedMaterialId != null;
  const draftTitle = extractDraftTitle(request.listingDraftJson);

  if (isCompleted) {
    return {
      id: `price:${request.id}`,
      group: 'REVIEW_UPDATE',
      kind: 'PRICE_COMPLETED',
      title: 'Listing completed',
      body: `${draftTitle || materialLabel} was published from this price review.`,
      status: 'APPROVED',
      createdAt: (request.publishedAt ?? request.createdAt).toISOString(),
      actionNeeded: false,
      isCompleted: true,
      actionLabel: null,
      actionType: null,
      categoryRequestId: null,
      priceRuleRequestId: request.id,
      reservationId: null,
      publishedMaterialId: request.publishedMaterialId,
      approvedCategoryId: request.categoryId,
      approvedCategoryName: request.category?.nameEn ?? null,
      maxAllowedUnitPriceNis,
      unit,
      supplierRequestedUnitPriceNis,
    };
  }

  if (request.status === 'APPROVED') {
    const maxBody =
      maxAllowedUnitPriceNis != null
        ? `${formatMaxUnitPriceBody(unit, maxAllowedUnitPriceNis, request.condition)} Continue your listing and set the unit price at or below this amount.`
        : 'Continue your listing with the approved price limit.';

    return {
      id: `price:${request.id}`,
      group: 'REVIEW_UPDATE',
      kind: 'PRICE_APPROVED',
      title: 'Price limit approved',
      body: maxBody,
      status: 'APPROVED',
      createdAt: request.updatedAt.toISOString(),
      actionNeeded: hasDraft,
      isCompleted: false,
      actionLabel: hasDraft ? 'Continue listing' : null,
      actionType: hasDraft ? 'CONTINUE_LISTING' : null,
      categoryRequestId: null,
      priceRuleRequestId: request.id,
      reservationId: null,
      publishedMaterialId: null,
      approvedCategoryId: request.categoryId,
      approvedCategoryName: request.category?.nameEn ?? null,
      maxAllowedUnitPriceNis,
      unit,
      supplierRequestedUnitPriceNis,
    };
  }

  if (request.status === 'REJECTED') {
    const maxBody =
      maxAllowedUnitPriceNis != null
        ? `Your requested unit price is above the allowed limit. ${formatMaxUnitPriceBody(unit, maxAllowedUnitPriceNis, request.condition)}`
        : request.moderatorNote?.trim() ||
          'Your requested unit price needs adjustment before you can publish.';

    return {
      id: `price:${request.id}`,
      group: 'REVIEW_UPDATE',
      kind: 'PRICE_REJECTED',
      title: 'Price needs adjustment',
      body: maxBody,
      status: 'REJECTED',
      createdAt: request.updatedAt.toISOString(),
      actionNeeded: hasDraft,
      isCompleted: false,
      actionLabel: hasDraft ? 'Edit price' : null,
      actionType: hasDraft ? 'EDIT_PRICE' : null,
      categoryRequestId: null,
      priceRuleRequestId: request.id,
      reservationId: null,
      publishedMaterialId: null,
      approvedCategoryId: request.categoryId,
      approvedCategoryName: request.category?.nameEn ?? null,
      maxAllowedUnitPriceNis,
      unit,
      supplierRequestedUnitPriceNis,
    };
  }

  return {
    id: `price:${request.id}`,
    group: 'REVIEW_UPDATE',
    kind: 'PRICE_PENDING',
    title: 'Price review pending',
    body: `${materialLabel} is waiting for admin price review.`,
    status: 'PENDING',
    createdAt: request.createdAt.toISOString(),
    actionNeeded: false,
    isCompleted: false,
    actionLabel: null,
    actionType: null,
    categoryRequestId: null,
    priceRuleRequestId: request.id,
    reservationId: null,
    publishedMaterialId: null,
    approvedCategoryId: request.categoryId,
    approvedCategoryName: request.category?.nameEn ?? null,
    maxAllowedUnitPriceNis: null,
    unit,
    supplierRequestedUnitPriceNis,
  };
};

const mapReservationNotification = (
  reservation: ReturnType<typeof mapSupplierReservation>,
): SupplierActionNotification => ({
  id: `reservation:${reservation.id}`,
  group: 'RESERVATION_ALERT',
  kind: 'RESERVATION_PENDING',
  title: 'New reservation request',
  body: `${reservation.learner.displayName} requested ${reservation.material.title}.`,
  status: 'PENDING',
  createdAt: reservation.createdAt,
  actionNeeded: true,
  isCompleted: false,
  actionLabel: 'Review request',
  actionType: 'REVIEW_REQUEST',
  categoryRequestId: null,
  priceRuleRequestId: null,
  reservationId: reservation.id,
  publishedMaterialId: null,
  approvedCategoryId: null,
  approvedCategoryName: null,
  maxAllowedUnitPriceNis: null,
  unit: null,
  supplierRequestedUnitPriceNis: null,
});

const buildSummary = (
  notifications: SupplierActionNotification[],
): SupplierNotificationsSummary => ({
  totalCount: notifications.length,
  actionNeededCount: notifications.filter((item) => item.actionNeeded).length,
  reviewCount: notifications.filter(
    (item) => item.group === 'REVIEW_UPDATE' && !item.isCompleted,
  ).length,
  reservationCount: notifications.filter(
    (item) => item.group === 'RESERVATION_ALERT',
  ).length,
  completedCount: notifications.filter((item) => item.isCompleted).length,
});

export const listSupplierActionNotifications = async (userId: string) => {
  const [categoryRequests, priceRuleRequests, pendingReservations] =
    await Promise.all([
      categoryRequestsRepository.listCategoryRequestsWithDrafts(userId),
      priceRuleRequestsRepository.listPriceRuleRequestsForSupplier(userId),
      supplierReservationsRepository.findSupplierReservations(userId, 'PENDING'),
    ]);

  const notifications: SupplierActionNotification[] = [
    ...categoryRequests.map(mapCategoryRequestNotification),
    ...priceRuleRequests.map(mapPriceRuleRequestNotification),
    ...pendingReservations
      .map(mapSupplierReservation)
      .map(mapReservationNotification),
  ];

  // Ensure rejected category notifications never show raw IDs.
  await Promise.all(
    notifications.map(async (notification) => {
      if (notification.kind !== 'CATEGORY_REJECTED') return;
      notification.body = await resolveCategoryRejectionBody(notification.body);
    }),
  );

  sortNotifications(notifications);

  return {
    notifications,
    summary: buildSummary(notifications),
  };
};
