import { AppError } from '../../utils/app-error.js';

import * as repository from './admin-reservations.repository.js';
import {
  ADMIN_FILTERABLE_RESERVATION_STATUSES,
} from './admin-reservations.status.js';
import type { AdminReservationsListQuery } from './admin-reservations.validation.js';

type OwnerWithSupplier = {
  id: string;
  displayName: string;
  email: string;
  supplierProfile: {
    publicName: string | null;
    organizationProfile: { organizationName: string } | null;
  } | null;
};

const pickMaterialImageUrl = (
  images: { imageUrl: string; isCover: boolean; sortOrder: number }[],
): string | null => {
  if (!images.length) return null;
  const cover = images.find((image) => image.isCover);
  return cover?.imageUrl ?? images[0]?.imageUrl ?? null;
};

const resolveSupplierDisplayName = (owner: OwnerWithSupplier) =>
  owner.supplierProfile?.organizationProfile?.organizationName?.trim() ||
  owner.supplierProfile?.publicName?.trim() ||
  owner.displayName;

const mapDeliverySummary = (
  delivery: repository.AdminReservationListRecord['deliveries'][number] | null,
) =>
  delivery
    ? {
        id: delivery.id,
        status: delivery.status,
        requestedAt: delivery.requestedAt.toISOString(),
        assignedAt: delivery.assignedAt?.toISOString() ?? null,
        deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
      }
    : null;

const mapListItem = (reservation: repository.AdminReservationListRecord) => ({
  id: reservation.id,
  status: reservation.status,
  quantityRequested: Number(reservation.quantityRequested),
  unit: reservation.material.unit,
  createdAt: reservation.createdAt.toISOString(),
  updatedAt: reservation.updatedAt.toISOString(),
  pickupWindowStart: reservation.pickupWindowStart?.toISOString() ?? null,
  pickupWindowEnd: reservation.pickupWindowEnd?.toISOString() ?? null,
  material: {
    id: reservation.material.id,
    title: reservation.material.title,
    imageUrl: pickMaterialImageUrl(reservation.material.images),
  },
  learner: {
    id: reservation.requester.id,
    displayName: reservation.requester.displayName,
    email: reservation.requester.email,
  },
  supplier: {
    id: reservation.owner.id,
    displayName: resolveSupplierDisplayName(reservation.owner),
    email: reservation.owner.email,
  },
  hasDelivery: reservation._count.deliveries > 0,
  delivery: mapDeliverySummary(reservation.deliveries[0] ?? null),
});

const mapDetailDelivery = (
  delivery: repository.AdminReservationDetailRecord['deliveries'][number] | null,
) => {
  if (!delivery) return null;

  return {
    id: delivery.id,
    status: delivery.status,
    requestedAt: delivery.requestedAt.toISOString(),
    assignedAt: delivery.assignedAt?.toISOString() ?? null,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    driver: delivery.assignedDriverProfile
      ? {
          id: delivery.assignedDriverProfile.id,
          displayName: delivery.assignedDriverProfile.displayName,
          email: delivery.assignedDriverProfile.user.email,
        }
      : null,
  };
};

const mapLinkedReport = (
  reports: repository.AdminReservationDetailRecord['noShowReports'],
) => {
  if (!reports.length) return null;

  const pending = reports.find((report) => report.status === 'PENDING_REVIEW');
  const report = pending ?? reports[0];

  return {
    id: report.id,
    status: report.status,
    reasonCode: report.reasonCode,
    targetRole: report.targetRole,
    createdAt: report.createdAt.toISOString(),
  };
};

const mapDetail = (reservation: repository.AdminReservationDetailRecord) => ({
  id: reservation.id,
  status: reservation.status,
  quantityRequested: Number(reservation.quantityRequested),
  unit: reservation.material.unit,
  message: reservation.message,
  createdAt: reservation.createdAt.toISOString(),
  updatedAt: reservation.updatedAt.toISOString(),
  acceptedAt: reservation.acceptedAt?.toISOString() ?? null,
  rejectedAt: reservation.rejectedAt?.toISOString() ?? null,
  cancelledAt: reservation.cancelledAt?.toISOString() ?? null,
  completedAt: reservation.completedAt?.toISOString() ?? null,
  pickupWindowStart: reservation.pickupWindowStart?.toISOString() ?? null,
  pickupWindowEnd: reservation.pickupWindowEnd?.toISOString() ?? null,
  fulfillmentMethod: reservation.fulfillmentMethod,
  supplierNote: reservation.supplierNote,
  rejectionReason: reservation.rejectionReason,
  learner: {
    id: reservation.requester.id,
    displayName: reservation.requester.displayName,
    email: reservation.requester.email,
    phone: reservation.requester.phone,
  },
  supplier: {
    id: reservation.owner.id,
    displayName: resolveSupplierDisplayName(reservation.owner),
    email: reservation.owner.email,
    verificationStatus:
      reservation.owner.supplierProfile?.verificationStatus ?? null,
  },
  material: {
    id: reservation.material.id,
    title: reservation.material.title,
    unit: reservation.material.unit,
    categoryName: reservation.material.category.nameEn,
    condition: reservation.material.condition,
    isFree: reservation.material.isFree,
    price:
      reservation.material.price == null
        ? null
        : Number(reservation.material.price),
    currency: reservation.material.currency,
    pickupAllowed: reservation.material.pickupAllowed,
    deliveryAllowed: reservation.material.deliveryAllowed,
    imageUrl: pickMaterialImageUrl(reservation.material.images),
  },
  delivery: mapDetailDelivery(reservation.deliveries[0] ?? null),
  linkedReport: mapLinkedReport(reservation.noShowReports),
  statusHistory: reservation.statusHistory.map((entry) => ({
    id: entry.id,
    statusGroup: entry.statusGroup,
    oldStatus: entry.oldStatus,
    newStatus: entry.newStatus,
    note: entry.note,
    createdAt: entry.createdAt.toISOString(),
  })),
});

export const listAdminReservations = async (query: AdminReservationsListQuery) => {
  const [summary, result] = await Promise.all([
    repository.countAdminReservationsSummary(),
    repository.listAdminReservations(query),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / query.limit));

  return {
    summary,
    items: result.items.map(mapListItem),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages,
    },
    filterOptions: {
      statuses: ADMIN_FILTERABLE_RESERVATION_STATUSES,
    },
  };
};

export const getAdminReservationById = async (id: string) => {
  const reservation = await repository.findAdminReservationById(id);
  if (!reservation) {
    throw new AppError('Reservation not found.', 404, 'NOT_FOUND');
  }

  return mapDetail(reservation);
};
