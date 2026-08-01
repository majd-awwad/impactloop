import {
  Prisma,
  type DeliveryGroupStatus,
  type DeliveryStatus,
  type ReservationStatus,
} from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

export const groupedDeliveryStateConflict = (): never => {
  throw new AppError(
    'Grouped delivery state changed while the operation was in progress.',
    409,
    'GROUPED_DELIVERY_STATE_CONFLICT',
  );
};

/**
 * Loads the complete, unfiltered operational group and validates every member
 * before a grouped failure or recovery mutation starts.
 */
export const loadAndAssertGroupedDeliveryState = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryId: string;
    expectedDeliveryStatuses: readonly DeliveryStatus[];
    expectedGroupStatus: DeliveryGroupStatus;
    expectedReservationStatus: ReservationStatus;
    expectedDriverProfileId: string | null;
    expectedActiveAssignments: number;
    expectedSupplierUserId?: string;
  },
) => {
  const delivery = await tx.delivery.findUnique({
    where: { id: input.deliveryId },
    select: {
      id: true,
      reservationId: true,
      deliveryGroupId: true,
      status: true,
      assignedDriverProfileId: true,
      assignments: {
        where: { status: 'ACTIVE' },
        select: { id: true, driverProfileId: true },
      },
      deliveryGroup: {
        select: {
          id: true,
          status: true,
          assignedDriverProfileId: true,
          supplierProfile: { select: { userId: true } },
          reservations: {
            select: {
              id: true,
              status: true,
              fulfillmentMethod: true,
              ownerId: true,
              materialId: true,
              requesterId: true,
              supplierNote: true,
            },
          },
        },
      },
    },
  });

  const group = delivery?.deliveryGroup;
  const supplierUserId = group?.supplierProfile.userId;
  if (
    !delivery ||
    !delivery.deliveryGroupId ||
    !group ||
    group.id !== delivery.deliveryGroupId ||
    !input.expectedDeliveryStatuses.includes(delivery.status) ||
    group.status !== input.expectedGroupStatus ||
    delivery.assignedDriverProfileId !== input.expectedDriverProfileId ||
    group.assignedDriverProfileId !== input.expectedDriverProfileId ||
    delivery.assignments.length !== input.expectedActiveAssignments ||
    (input.expectedDriverProfileId != null &&
      delivery.assignments.some(
        (assignment) =>
          assignment.driverProfileId !== input.expectedDriverProfileId,
      )) ||
    !supplierUserId ||
    (input.expectedSupplierUserId != null &&
      supplierUserId !== input.expectedSupplierUserId) ||
    group.reservations.length === 0 ||
    !group.reservations.some(
      (reservation) => reservation.id === delivery.reservationId,
    ) ||
    group.reservations.some(
      (reservation) =>
        reservation.fulfillmentMethod !== 'DELIVERY' ||
        reservation.status !== input.expectedReservationStatus ||
        reservation.ownerId !== supplierUserId,
    )
  ) {
    return groupedDeliveryStateConflict();
  }

  return { delivery, group, reservations: group.reservations, supplierUserId };
};
