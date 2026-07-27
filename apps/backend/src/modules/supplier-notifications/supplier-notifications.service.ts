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
import {
  classifySupplierNotification,
  type SupplierNotificationClassification,
  type SupplierNotificationTarget,
} from './supplier-notification-classifier.js';
import * as supplierNotificationsRepository from './supplier-notifications.repository.js';
import type { SupplierNotificationsQuery } from './supplier-notifications.validation.js';

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
    | 'RESERVATION_PENDING'
    | 'MATERIAL_MODERATION_UPDATE'
    | 'SUPPLIER_VERIFICATION_UPDATE'
    | 'UNKNOWN';
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

type ResolvedSupplierNotificationTarget = {
  classifierTarget: SupplierNotificationTarget;
  entityType: string | null;
  entityId: string | null;
  title: string | null;
  status: string | null;
  publishedMaterialId: string | null;
  approvedCategoryId: string | null;
  approvedCategoryName: string | null;
};

const effectiveEntity = (row: supplierNotificationsRepository.SupplierNotificationRow) => ({
  type: row.entityType ?? row.relatedEntityType,
  id: row.entityId ?? row.relatedEntityId,
});

const resolveTarget = (
  row: supplierNotificationsRepository.SupplierNotificationRow,
  targets: Awaited<ReturnType<typeof supplierNotificationsRepository.findSupplierNotificationTargets>>,
): ResolvedSupplierNotificationTarget => {
  const entity = effectiveEntity(row);
  if (!entity.type || !entity.id) {
    return {
      classifierTarget: null,
      entityType: entity.type,
      entityId: entity.id,
      title: null,
      status: null,
      publishedMaterialId: null,
      approvedCategoryId: null,
      approvedCategoryName: null,
    };
  }

  if (entity.type === 'RESERVATION') {
    const reservation = targets.reservations.find((item) => item.id === entity.id);
    if (!reservation) return { classifierTarget: null, entityType: entity.type, entityId: entity.id, title: null, status: null, publishedMaterialId: null, approvedCategoryId: null, approvedCategoryName: null };
    const mapped = mapSupplierReservation(reservation, null);
    return {
      classifierTarget: {
        kind: 'RESERVATION',
        status: mapped.status,
        attentionState: mapped.attentionState,
        nextActor: mapped.nextActor,
        availableActions: mapped.availableActions,
      },
      entityType: entity.type,
      entityId: entity.id,
      title: mapped.material.title,
      status: mapped.status,
      publishedMaterialId: null,
      approvedCategoryId: null,
      approvedCategoryName: null,
    };
  }

  if (entity.type === 'CATEGORY_REQUEST') {
    const request = targets.categories.find((item) => item.id === entity.id);
    if (!request) return { classifierTarget: null, entityType: entity.type, entityId: entity.id, title: null, status: null, publishedMaterialId: null, approvedCategoryId: null, approvedCategoryName: null };
    return {
      classifierTarget: { kind: 'CATEGORY_REQUEST', status: request.status, hasDraft: request.listingDraftJson != null, isPublished: request.publishedMaterialId != null },
      entityType: entity.type,
      entityId: entity.id,
      title: request.requestedName,
      status: request.status,
      publishedMaterialId: request.publishedMaterialId,
      approvedCategoryId: request.approvedCategoryId,
      approvedCategoryName: request.approvedCategory?.nameEn ?? null,
    };
  }

  if (entity.type === 'PRICE_RULE_REQUEST') {
    const request = targets.prices.find((item) => item.id === entity.id);
    if (!request) return { classifierTarget: null, entityType: entity.type, entityId: entity.id, title: null, status: null, publishedMaterialId: null, approvedCategoryId: null, approvedCategoryName: null };
    return {
      classifierTarget: { kind: 'PRICE_RULE_REQUEST', status: request.status, hasDraft: request.listingDraftJson != null, isPublished: request.publishedMaterialId != null },
      entityType: entity.type,
      entityId: entity.id,
      title: request.materialName,
      status: request.status,
      publishedMaterialId: request.publishedMaterialId,
      approvedCategoryId: null,
      approvedCategoryName: request.category?.nameEn ?? null,
    };
  }

  if (entity.type === 'MATERIAL') {
    const material = targets.materials.find((item) => item.id === entity.id);
    return material
      ? { classifierTarget: { kind: 'MATERIAL', status: material.status }, entityType: entity.type, entityId: entity.id, title: material.title, status: material.status, publishedMaterialId: null, approvedCategoryId: null, approvedCategoryName: null }
      : { classifierTarget: null, entityType: entity.type, entityId: entity.id, title: null, status: null, publishedMaterialId: null, approvedCategoryId: null, approvedCategoryName: null };
  }

  if (entity.type === 'SUPPLIER_PROFILE') {
    const profile = targets.profiles.find((item) => item.id === entity.id);
    return profile
      ? { classifierTarget: { kind: 'SUPPLIER_PROFILE', verificationStatus: profile.verificationStatus }, entityType: entity.type, entityId: entity.id, title: null, status: profile.verificationStatus, publishedMaterialId: null, approvedCategoryId: null, approvedCategoryName: null }
      : { classifierTarget: null, entityType: entity.type, entityId: entity.id, title: null, status: null, publishedMaterialId: null, approvedCategoryId: null, approvedCategoryName: null };
  }

  return { classifierTarget: null, entityType: entity.type, entityId: entity.id, title: null, status: null, publishedMaterialId: null, approvedCategoryId: null, approvedCategoryName: null };
};

const iconForCategory = (category: SupplierNotificationClassification['category']) =>
  ({
    RESERVATION: 'RESERVATION',
    MATERIAL_REVIEW: 'MATERIAL_REVIEW',
    DELIVERY_RECOVERY: 'DELIVERY_RECOVERY',
    ACCOUNT: 'ACCOUNT',
    SYSTEM: 'SYSTEM',
    UNKNOWN: 'UNKNOWN',
  })[category];

const destinationForAction = (
  actionType: SupplierNotificationClassification['actionType'],
  entityType: string | null,
) => {
  if (
    actionType === 'REVIEW_RESERVATION' ||
    actionType === 'OPEN_RESERVATION' ||
    actionType === 'CHOOSE_PICKUP_WINDOW'
  ) {
    return 'SUPPLIER_RESERVATION_DETAIL';
  }
  if (actionType === 'CONTINUE_LISTING' || actionType === 'EDIT_LISTING') {
    return entityType === 'PRICE_RULE_REQUEST'
      ? 'SUPPLIER_ADD_MATERIAL_PRICE_REQUEST'
      : 'SUPPLIER_ADD_MATERIAL_CATEGORY_REQUEST';
  }
  if (actionType === 'OPEN_MATERIAL') return 'SUPPLIER_MATERIAL_DETAIL';
  if (actionType === 'OPEN_PROFILE') return 'SUPPLIER_PROFILE';
  return null;
};

const canonicalItem = (
  row: supplierNotificationsRepository.SupplierNotificationRow,
  resolved: ResolvedSupplierNotificationTarget,
  classification: SupplierNotificationClassification,
) => ({
  id: row.id,
  rawType: row.notificationType,
  category: classification.category,
  state: classification.state,
  title: row.title.trim() || 'Notification',
  message: row.body,
  createdAt: row.createdAt.toISOString(),
  isRead: row.isRead,
  readAt: row.readAt?.toISOString() ?? null,
  iconKey: iconForCategory(classification.category),
  entity: resolved.entityId
    ? {
        type: resolved.entityType,
        id: resolved.entityId,
        title: resolved.title,
        status: resolved.status,
      }
    : null,
  action: {
    type: classification.actionType,
    destination: destinationForAction(classification.actionType, resolved.entityType),
    target:
      classification.actionType !== 'NONE' && classification.actionType !== 'UNKNOWN' && resolved.entityId
        ? { entityType: resolved.entityType, entityId: resolved.entityId }
        : null,
  },
  waitingOn: classification.waitingOn,
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  priority:
    classification.state === 'NEEDS_ACTION'
      ? 'HIGH'
      : classification.state === 'WAITING'
        ? 'NORMAL'
        : 'LOW',
});

const toLegacySupplierNotification = (
  item: ReturnType<typeof canonicalItem>,
  resolved: ResolvedSupplierNotificationTarget,
): SupplierActionNotification => {
  const isReservation = item.entity?.type === 'RESERVATION';
  const isCategory = item.entity?.type === 'CATEGORY_REQUEST';
  const isPrice = item.entity?.type === 'PRICE_RULE_REQUEST';
  const kind = isReservation
    ? 'RESERVATION_PENDING'
    : isCategory
      ? resolved.publishedMaterialId
        ? 'CATEGORY_COMPLETED'
        : resolved.status === 'APPROVED'
          ? 'CATEGORY_APPROVED'
          : resolved.status === 'REJECTED'
            ? 'CATEGORY_REJECTED'
            : 'CATEGORY_PENDING'
      : isPrice
        ? resolved.publishedMaterialId
          ? 'PRICE_COMPLETED'
          : resolved.status === 'APPROVED'
            ? 'PRICE_APPROVED'
            : resolved.status === 'REJECTED'
              ? 'PRICE_REJECTED'
              : 'PRICE_PENDING'
        : item.rawType === 'MATERIAL_MODERATION_UPDATE'
          ? 'MATERIAL_MODERATION_UPDATE'
          : item.rawType === 'SUPPLIER_VERIFICATION_UPDATE'
            ? 'SUPPLIER_VERIFICATION_UPDATE'
            : 'UNKNOWN';

  return {
    id: item.id,
    group: isReservation ? 'RESERVATION_ALERT' : 'REVIEW_UPDATE',
    kind,
    title: item.title,
    body: item.message,
    status: (resolved.status === 'APPROVED' || resolved.status === 'REJECTED' ? resolved.status : 'PENDING'),
    createdAt: item.createdAt,
    actionNeeded: item.state === 'NEEDS_ACTION',
    isCompleted: item.state === 'RESOLVED',
    actionLabel: item.action.type === 'REVIEW_RESERVATION' ? 'Review request' : item.action.type === 'CONTINUE_LISTING' ? 'Continue listing' : item.action.type === 'EDIT_LISTING' ? 'Edit listing' : null,
    actionType: item.action.type === 'REVIEW_RESERVATION' ? 'REVIEW_REQUEST' : item.action.type === 'EDIT_LISTING' ? 'EDIT_LISTING' : item.action.type === 'CONTINUE_LISTING' ? 'CONTINUE_LISTING' : null,
    categoryRequestId: isCategory ? item.entity?.id ?? null : null,
    priceRuleRequestId: isPrice ? item.entity?.id ?? null : null,
    reservationId: isReservation ? item.entity?.id ?? null : null,
    publishedMaterialId: resolved.publishedMaterialId,
    approvedCategoryId: resolved.approvedCategoryId,
    approvedCategoryName: resolved.approvedCategoryName,
    maxAllowedUnitPriceNis: null,
    unit: null,
    supplierRequestedUnitPriceNis: null,
  };
};

export const listCanonicalSupplierNotifications = async (
  userId: string,
  query: SupplierNotificationsQuery,
) => {
  const page = query.page;
  const limit = query.limit;
  const requestedStart = (page - 1) * limit;
  const requestedEnd = requestedStart + limit;
  const ranked: Array<{
    item: ReturnType<typeof canonicalItem>;
    resolved: ResolvedSupplierNotificationTarget;
  }> = [];
  const counts = {
    total: 0,
    unread: 0,
    needsAction: 0,
    waiting: 0,
    updates: 0,
    resolved: 0,
    unknownState: 0,
    reservations: 0,
    materials: 0,
    deliveryRecovery: 0,
    account: 0,
    system: 0,
    unknownCategory: 0,
  };

  const statePriority: Record<SupplierNotificationClassification['state'], number> = {
    NEEDS_ACTION: 1,
    WAITING: 2,
    UPDATE: 3,
    RESOLVED: 4,
    UNKNOWN: 5,
  };
  const compareRank = (
    left: ReturnType<typeof canonicalItem>,
    right: ReturnType<typeof canonicalItem>,
  ) =>
    statePriority[left.state] - statePriority[right.state] ||
    right.createdAt.localeCompare(left.createdAt) ||
    right.id.localeCompare(left.id);

  await supplierNotificationsRepository.forEachSupplierNotificationBatch({
    filter: { userId, ...query },
    batchSize: 100,
    onBatch: async (rows) => {
      const targets = await supplierNotificationsRepository.findSupplierNotificationTargets({
        userId,
        reservationIds: rows.map((row) => effectiveEntity(row)).filter((entity) => entity.type === 'RESERVATION' && entity.id).map((entity) => entity.id as string),
        categoryRequestIds: rows.map((row) => effectiveEntity(row)).filter((entity) => entity.type === 'CATEGORY_REQUEST' && entity.id).map((entity) => entity.id as string),
        priceRuleRequestIds: rows.map((row) => effectiveEntity(row)).filter((entity) => entity.type === 'PRICE_RULE_REQUEST' && entity.id).map((entity) => entity.id as string),
        materialIds: rows.map((row) => effectiveEntity(row)).filter((entity) => entity.type === 'MATERIAL' && entity.id).map((entity) => entity.id as string),
        supplierProfileIds: rows.map((row) => effectiveEntity(row)).filter((entity) => entity.type === 'SUPPLIER_PROFILE' && entity.id).map((entity) => entity.id as string),
      });

      rows.forEach((row) => {
        const resolved = resolveTarget(row, targets);
        const classification = classifySupplierNotification({ rawType: row.notificationType, target: resolved.classifierTarget, resolvedAt: row.resolvedAt });
        const item = canonicalItem(row, resolved, classification);

        if (query.category && classification.category !== query.category) return;
        if (query.state && classification.state !== query.state) return;

        counts.total += 1;
        if (!item.isRead) counts.unread += 1;
        if (classification.state === 'NEEDS_ACTION') counts.needsAction += 1;
        if (classification.state === 'WAITING') counts.waiting += 1;
        if (classification.state === 'UPDATE') counts.updates += 1;
        if (classification.state === 'RESOLVED') counts.resolved += 1;
        if (classification.state === 'UNKNOWN') counts.unknownState += 1;
        if (classification.category === 'RESERVATION') counts.reservations += 1;
        if (classification.category === 'MATERIAL_REVIEW') counts.materials += 1;
        if (classification.category === 'DELIVERY_RECOVERY') counts.deliveryRecovery += 1;
        if (classification.category === 'ACCOUNT') counts.account += 1;
        if (classification.category === 'SYSTEM') counts.system += 1;
        if (classification.category === 'UNKNOWN') counts.unknownCategory += 1;

        ranked.push({ item, resolved });
        ranked.sort((left, right) => compareRank(left.item, right.item));
        if (ranked.length > requestedEnd) ranked.pop();
      });
    },
  });

  const pageRows = ranked.slice(requestedStart, requestedEnd);

  return {
    items: pageRows.map((row) => row.item),
    notifications: pageRows.map((row) => toLegacySupplierNotification(row.item, row.resolved)),
    pagination: { page, limit, total: counts.total, totalPages: Math.ceil(counts.total / limit) || 0 },
    summary: {
      ...counts,
      totalCount: counts.total,
      actionNeededCount: counts.needsAction,
      reviewCount: counts.materials,
      reservationCount: counts.reservations,
      completedCount: counts.resolved,
    },
  };
};
