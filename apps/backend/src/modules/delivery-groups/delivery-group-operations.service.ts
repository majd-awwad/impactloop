import type { Prisma } from '../../generated/prisma/client.js';

import {
  buildDeliveryHandoverCodeData,
  createDeliveryId,
} from '../../utils/handover-codes.js';
import { applyReservationCompletionToMaterial } from '../reservations/reservations.quantity.js';

export const DELIVERABLE_GROUP_RESERVATION_STATUSES = [
  'ACCEPTED',
] as const satisfies readonly Prisma.ReservationStatus[];

const groupReservationInclude = {
  material: {
    select: {
      id: true,
      title: true,
      unit: true,
      condition: true,
    },
  },
} satisfies Prisma.ReservationInclude;

export type GroupReservationItem = Prisma.ReservationGetPayload<{
  include: typeof groupReservationInclude;
}> & {
  quantityRequested: Prisma.Decimal;
  materialSubtotal: Prisma.Decimal | null;
};

export const findDeliveryForGroup = async (
  tx: Prisma.TransactionClient,
  deliveryGroupId: string,
) => {
  return tx.delivery.findFirst({
    where: { deliveryGroupId },
  });
};

export const findDeliveryForReservation = async (
  tx: Prisma.TransactionClient,
  reservation: {
    id: string;
    deliveryGroupId: string | null;
  },
) => {
  if (reservation.deliveryGroupId) {
    const groupDelivery = await findDeliveryForGroup(
      tx,
      reservation.deliveryGroupId,
    );
    if (groupDelivery) {
      return groupDelivery;
    }
  }

  return tx.delivery.findFirst({
    where: { reservationId: reservation.id },
    orderBy: { requestedAt: 'desc' },
  });
};

export const getAcceptedGroupReservations = async (
  tx: Prisma.TransactionClient,
  deliveryGroupId: string,
) => {
  return tx.reservation.findMany({
    where: {
      deliveryGroupId,
      status: { in: [...DELIVERABLE_GROUP_RESERVATION_STATUSES] },
      fulfillmentMethod: 'DELIVERY',
    },
    include: groupReservationInclude,
    orderBy: { createdAt: 'asc' },
  });
};

const createDeliveryLocations = async (
  tx: Prisma.TransactionClient,
  input: {
    materialLocation: {
      country: string;
      city: string;
      area: string | null;
      addressLine: string | null;
      latitude: Prisma.Decimal | number | null;
      longitude: Prisma.Decimal | number | null;
      isApproximate: boolean;
    };
    deliveryAddressText: string;
    dropoffCity?: string | null;
    dropoffArea?: string | null;
  },
) => {
  const pickupLocation = await tx.location.create({
    data: {
      country: input.materialLocation.country,
      city: input.materialLocation.city,
      area: input.materialLocation.area,
      addressLine: input.materialLocation.addressLine,
      latitude: input.materialLocation.latitude,
      longitude: input.materialLocation.longitude,
      visibility: 'PRIVATE',
      isApproximate: input.materialLocation.isApproximate,
      locationType: 'DELIVERY_PICKUP',
    },
  });

  const dropoffLocation = await tx.location.create({
    data: {
      country: input.materialLocation.country,
      city: input.dropoffCity?.trim() || input.materialLocation.city,
      area: input.dropoffArea?.trim() || null,
      addressLine: input.deliveryAddressText,
      visibility: 'PRIVATE',
      isApproximate: true,
      locationType: 'DELIVERY_DROPOFF',
    },
  });

  return { pickupLocation, dropoffLocation };
};

export const createOperationalDelivery = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    deliveryGroupId?: string | null;
    requesterId: string;
    changedByUserId: string;
    materialLocation: {
      country: string;
      city: string;
      area: string | null;
      addressLine: string | null;
      latitude: Prisma.Decimal | number | null;
      longitude: Prisma.Decimal | number | null;
      isApproximate: boolean;
    };
    deliveryAddressText: string;
    dropoffCity?: string | null;
    dropoffArea?: string | null;
    deliveryNote?: string | null;
    statusHistoryNote: string;
  },
) => {
  const { pickupLocation, dropoffLocation } = await createDeliveryLocations(
    tx,
    {
      materialLocation: input.materialLocation,
      deliveryAddressText: input.deliveryAddressText,
      dropoffCity: input.dropoffCity,
      dropoffArea: input.dropoffArea,
    },
  );

  const deliveryId = createDeliveryId();
  const handoverCodes = await buildDeliveryHandoverCodeData(deliveryId);

  return tx.delivery.create({
    data: {
      id: deliveryId,
      ...handoverCodes.data,
      reservationId: input.reservationId,
      deliveryGroupId: input.deliveryGroupId ?? null,
      pickupLocationId: pickupLocation.id,
      dropoffLocationId: dropoffLocation.id,
      requestedByUserId: input.requesterId,
      status: 'WAITING_FOR_DRIVER',
      learnerNote: input.deliveryNote ?? null,
      statusHistory: {
        create: {
          oldStatus: null,
          newStatus: 'WAITING_FOR_DRIVER',
          changedByUserId: input.changedByUserId,
          note: input.statusHistoryNote,
        },
      },
    },
  });
};

export const ensureDeliveryForAcceptedReservation = async (
  tx: Prisma.TransactionClient,
  input: {
    reservation: {
      id: string;
      requesterId: string;
      deliveryGroupId: string | null;
      deliveryAddressText: string | null;
      dropoffCity: string | null;
      dropoffArea: string | null;
      deliveryNote: string | null;
      material: {
        location: {
          country: string;
          city: string;
          area: string | null;
          addressLine: string | null;
          latitude: Prisma.Decimal | number | null;
          longitude: Prisma.Decimal | number | null;
          isApproximate: boolean;
        };
      };
    };
    changedByUserId: string;
    statusHistoryNote: string;
  },
) => {
  const deliveryAddressText = input.reservation.deliveryAddressText?.trim();
  if (!deliveryAddressText) {
    throw new Error('Delivery address is required to create a delivery.');
  }

  if (input.reservation.deliveryGroupId) {
    const existing = await findDeliveryForGroup(
      tx,
      input.reservation.deliveryGroupId,
    );

    if (existing) {
      if (
        existing.assignedDriverProfileId != null ||
        existing.status !== 'WAITING_FOR_DRIVER'
      ) {
        throw new Error(
          'Combined delivery is no longer available for this group.',
        );
      }

      return existing;
    }

    const group = await tx.deliveryGroup.findUnique({
      where: { id: input.reservation.deliveryGroupId },
      select: {
        id: true,
        status: true,
        assignedDriverProfileId: true,
        dropoffCity: true,
        dropoffArea: true,
        deliveryAddressText: true,
      },
    });

    if (!group) {
      throw new Error('Delivery group not found.');
    }

    if (group.assignedDriverProfileId) {
      throw new Error(
        'Combined delivery is no longer available for this group.',
      );
    }

    return createOperationalDelivery(tx, {
      reservationId: input.reservation.id,
      deliveryGroupId: group.id,
      requesterId: input.reservation.requesterId,
      changedByUserId: input.changedByUserId,
      materialLocation: input.reservation.material.location,
      deliveryAddressText:
        group.deliveryAddressText?.trim() || deliveryAddressText,
      dropoffCity: input.reservation.dropoffCity ?? group.dropoffCity,
      dropoffArea: input.reservation.dropoffArea ?? group.dropoffArea,
      deliveryNote: input.reservation.deliveryNote,
      statusHistoryNote: input.statusHistoryNote,
    });
  }

  const existingSingle = await tx.delivery.findFirst({
    where: { reservationId: input.reservation.id },
  });

  if (existingSingle) {
    return existingSingle;
  }

  return createOperationalDelivery(tx, {
    reservationId: input.reservation.id,
    requesterId: input.reservation.requesterId,
    changedByUserId: input.changedByUserId,
    materialLocation: input.reservation.material.location,
    deliveryAddressText,
    dropoffCity: input.reservation.dropoffCity,
    dropoffArea: input.reservation.dropoffArea,
    deliveryNote: input.reservation.deliveryNote,
    statusHistoryNote: input.statusHistoryNote,
  });
};

export const mapDriverDeliveryItem = (reservation: GroupReservationItem) => ({
  reservationId: reservation.id,
  materialId: reservation.material.id,
  title: reservation.material.title,
  quantity: Number(reservation.quantityRequested),
  unit: reservation.material.unit,
  condition: reservation.material.condition,
  materialSubtotal:
    reservation.materialSubtotal != null
      ? Number(reservation.materialSubtotal)
      : null,
});

export const loadDriverDeliveryItems = async (
  tx: Prisma.TransactionClient,
  delivery: {
    id: string;
    reservationId: string;
    deliveryGroupId: string | null;
  },
) => {
  if (delivery.deliveryGroupId) {
    const groupReservations = await tx.reservation.findMany({
      where: {
        deliveryGroupId: delivery.deliveryGroupId,
        status: { in: [...DELIVERABLE_GROUP_RESERVATION_STATUSES] },
        fulfillmentMethod: 'DELIVERY',
      },
      include: {
        material: {
          select: {
            id: true,
            title: true,
            unit: true,
            condition: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return groupReservations.map(mapDriverDeliveryItem);
  }

  const primary = await tx.reservation.findUniqueOrThrow({
    where: { id: delivery.reservationId },
    include: {
      material: {
        select: {
          id: true,
          title: true,
          unit: true,
          condition: true,
        },
      },
    },
  });

  return [mapDriverDeliveryItem(primary)];
};

export const completeReservationsForDeliveredDelivery = async (
  tx: Prisma.TransactionClient,
  input: {
    delivery: {
      id: string;
      reservationId: string;
      deliveryGroupId: string | null;
      reservation: {
        status: Prisma.ReservationStatus;
        materialId: string;
        quantityRequested: Prisma.Decimal;
      };
    };
    driverUserId: string;
    completedAt: Date;
  },
) => {
  const reservations =
    input.delivery.deliveryGroupId != null
      ? await tx.reservation.findMany({
          where: {
            deliveryGroupId: input.delivery.deliveryGroupId,
            status: 'ACCEPTED',
            fulfillmentMethod: 'DELIVERY',
          },
        })
      : [
          await tx.reservation.findUniqueOrThrow({
            where: { id: input.delivery.reservationId },
          }),
        ];

  for (const reservation of reservations) {
    const oldStatus = reservation.status;

    await tx.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'COMPLETED',
        completedAt: input.completedAt,
      },
    });

    await applyReservationCompletionToMaterial(tx, {
      materialId: reservation.materialId,
      reservationId: reservation.id,
      quantityRequested: reservation.quantityRequested,
      completedAt: input.completedAt,
    });

    await tx.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
        oldStatus,
        newStatus: 'COMPLETED',
        changedBy: input.driverUserId,
        note: input.delivery.deliveryGroupId
          ? 'Grouped delivery completed by driver'
          : 'Delivery completed by driver',
      },
    });
  }

  if (input.delivery.deliveryGroupId) {
    await tx.deliveryGroup.update({
      where: { id: input.delivery.deliveryGroupId },
      data: { status: 'COMPLETED' },
    });
  }
};

export const syncDeliveryGroupOnDriverAssign = async (
  tx: Prisma.TransactionClient,
  input: {
    deliveryGroupId: string | null;
    driverProfileId: string;
  },
) => {
  if (!input.deliveryGroupId) {
    return;
  }

  await tx.deliveryGroup.updateMany({
    where: {
      id: input.deliveryGroupId,
      assignedDriverProfileId: null,
    },
    data: {
      status: 'ASSIGNED',
      assignedDriverProfileId: input.driverProfileId,
    },
  });
};
