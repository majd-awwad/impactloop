export type DeliveryExportRecord = {
  deliveryId: string;
  deliveryStatus: string;
  scope: string;
  lifecyclePhase: string;
  adminAttentionState: string;
  assignmentState: string;
  incidentCount: number;
  primaryIncidentStatus: string | null;
  primaryIncidentReason: string | null;
  requestedAt: Date;
  assignedAt: Date | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  reservationId: string;
  materialId: string;
  materialTitle: string;
  learnerName: string;
  learnerEmail: string;
  supplierName: string;
  supplierEmail: string;
  driverName: string | null;
  driverEmail: string | null;
  pickupArea: string;
  dropoffArea: string;
  groupId: string | null;
  groupStatus: string | null;
};

/**
 * Explicit safe mapper — never pass Prisma records to writers.
 * Omits secrets, phones, addresses, coordinates, code hashes,
 * incident notes, and unrelated profile fields.
 */
export const DELIVERY_EXPORT_HEADERS = [
  'Delivery ID',
  'Delivery status',
  'Scope',
  'Lifecycle phase',
  'Admin attention',
  'Assignment state',
  'Incident count',
  'Primary incident status',
  'Primary incident reason',
  'Requested At',
  'Assigned At',
  'Picked Up At',
  'Delivered At',
  'Reservation ID',
  'Material ID',
  'Material title',
  'Learner name',
  'Learner email',
  'Supplier name',
  'Supplier email',
  'Driver name',
  'Driver email',
  'Pickup area',
  'Drop-off area',
  'Group ID',
  'Group status',
] as const;

/** 1-based Excel date column indexes. */
export const DELIVERY_EXPORT_REQUESTED_AT_COLUMN = 10;
export const DELIVERY_EXPORT_ASSIGNED_AT_COLUMN = 11;
export const DELIVERY_EXPORT_PICKED_UP_AT_COLUMN = 12;
export const DELIVERY_EXPORT_DELIVERED_AT_COLUMN = 13;
export const DELIVERY_EXPORT_MATERIAL_TITLE_COLUMN = 16;

export const deliveryExportRecordToDetailedCells = (
  record: DeliveryExportRecord,
): unknown[] => [
  record.deliveryId,
  record.deliveryStatus,
  record.scope,
  record.lifecyclePhase,
  record.adminAttentionState,
  record.assignmentState,
  record.incidentCount,
  record.primaryIncidentStatus,
  record.primaryIncidentReason,
  record.requestedAt,
  record.assignedAt,
  record.pickedUpAt,
  record.deliveredAt,
  record.reservationId,
  record.materialId,
  record.materialTitle,
  record.learnerName,
  record.learnerEmail,
  record.supplierName,
  record.supplierEmail,
  record.driverName,
  record.driverEmail,
  record.pickupArea,
  record.dropoffArea,
  record.groupId,
  record.groupStatus,
];

export const deliveryExportRecordToCsvCells = (
  record: DeliveryExportRecord,
): unknown[] => {
  const cells = deliveryExportRecordToDetailedCells(record);
  cells[9] = record.requestedAt.toISOString();
  cells[10] = record.assignedAt?.toISOString() ?? null;
  cells[11] = record.pickedUpAt?.toISOString() ?? null;
  cells[12] = record.deliveredAt?.toISOString() ?? null;
  return cells;
};
