import type { AdminReservationListRecord } from './admin-reservations.repository.js';

export type ReservationExportRecord = {
  reservationId: string;
  status: string;
  quantity: number;
  unit: string;
  createdAt: Date;
  materialId: string;
  materialTitle: string;
  learnerId: string;
  learnerName: string;
  learnerEmail: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  hasDelivery: boolean;
  deliveryId: string | null;
  deliveryStatus: string | null;
};

const resolveSupplierDisplayName = (
  owner: AdminReservationListRecord['owner'],
): string =>
  owner.supplierProfile?.organizationProfile?.organizationName?.trim() ||
  owner.supplierProfile?.publicName?.trim() ||
  owner.displayName;

/**
 * Explicit safe mapper — never pass Prisma records to writers.
 * Omits secrets, codes, hashes, addresses, coordinates, and auth fields.
 */
export const toReservationExportRecord = (
  reservation: AdminReservationListRecord,
): ReservationExportRecord => {
  const delivery = reservation.deliveries[0] ?? null;
  return {
    reservationId: reservation.id,
    status: reservation.status,
    quantity: Number(reservation.quantityRequested),
    unit: reservation.material.unit,
    createdAt: reservation.createdAt,
    materialId: reservation.material.id,
    materialTitle: reservation.material.title,
    learnerId: reservation.requester.id,
    learnerName: reservation.requester.displayName,
    learnerEmail: reservation.requester.email,
    supplierId: reservation.owner.id,
    supplierName: resolveSupplierDisplayName(reservation.owner),
    supplierEmail: reservation.owner.email,
    hasDelivery: reservation._count.deliveries > 0,
    deliveryId: delivery?.id ?? null,
    deliveryStatus: delivery?.status ?? null,
  };
};

export const RESERVATION_EXPORT_HEADERS = [
  'Reservation ID',
  'Status',
  'Quantity',
  'Unit',
  'Created At',
  'Material ID',
  'Material Title',
  'Learner ID',
  'Learner Name',
  'Learner Email',
  'Supplier ID',
  'Supplier Name',
  'Supplier Email',
  'Has Delivery',
  'Delivery ID',
  'Delivery Status',
] as const;

/** Created At is column index 5 (1-based) for Excel date typing. */
export const RESERVATION_EXPORT_CREATED_AT_COLUMN = 5;

export const reservationExportRecordToDetailedCells = (
  record: ReservationExportRecord,
): unknown[] => [
  record.reservationId,
  record.status,
  record.quantity,
  record.unit,
  record.createdAt,
  record.materialId,
  record.materialTitle,
  record.learnerId,
  record.learnerName,
  record.learnerEmail,
  record.supplierId,
  record.supplierName,
  record.supplierEmail,
  record.hasDelivery ? 'Yes' : 'No',
  record.deliveryId ?? '',
  record.deliveryStatus ?? '',
];

export const reservationExportRecordToCsvCells = (
  record: ReservationExportRecord,
): unknown[] => {
  const cells = reservationExportRecordToDetailedCells(record);
  // CSV uses ISO string for Created At (index 4)
  cells[4] = record.createdAt.toISOString();
  return cells;
};
