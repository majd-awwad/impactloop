import {
  Prisma,
  type MaterialStatus,
  type ReservationStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

export const ACTIVE_HOLD_STATUSES = [
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'ACCEPTED',
] as const satisfies readonly ReservationStatus[];

export const isActiveReservationBehaviorStatus = (
  status: ReservationStatus,
): boolean => (ACTIVE_HOLD_STATUSES as readonly ReservationStatus[]).includes(status);

/** Delivery states where material may still be with the driver after admin review is needed. */
export const MATERIAL_IN_CUSTODY_DELIVERY_STATUSES = [
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
  'LEARNER_NO_SHOW',
  'FAILED_DELIVERY',
] as const;

export const PARTIAL_PICKUP_HOLD_REASON_PREFIX = 'DRIVER_PARTIAL_PICKUP_';

/** Reservation statuses that reduce public availableQuantity. COMPLETED consumes stock instead. */

export { runSerializableTransaction } from '../../utils/transaction-retry.js';

export const toDecimal = (
  value: Prisma.Decimal | number | null | undefined,
): Prisma.Decimal => {
  if (value == null) {
    return new Prisma.Decimal(0);
  }

  if (typeof value === 'number') {
    return new Prisma.Decimal(value);
  }

  return value;
};

export const decimalToNumber = (value: Prisma.Decimal): number => value.toNumber();

export const isPositiveDecimal = (value: Prisma.Decimal) => value.gt(0);

export const isZeroOrNegativeDecimal = (value: Prisma.Decimal) =>
  value.lte(0);

export const clampDecimalAtZero = (value: Prisma.Decimal) =>
  value.lt(0) ? new Prisma.Decimal(0) : value;

export const loadReservationIdsWithAnyDelivery = async (
  tx: Prisma.TransactionClient,
  reservationIds: string[],
): Promise<Set<string>> => {
  if (reservationIds.length === 0) {
    return new Set();
  }

  const deliveries = await tx.delivery.findMany({
    where: {
      reservationId: { in: reservationIds },
    },
    select: {
      reservationId: true,
    },
  });

  return new Set(deliveries.map((delivery) => delivery.reservationId));
};

export const loadReservationIdsWithCustodyDeliveries = async (
  tx: Prisma.TransactionClient,
  reservationIds: string[],
): Promise<Set<string>> => {
  if (reservationIds.length === 0) {
    return new Set();
  }

  const deliveries = await tx.delivery.findMany({
    where: {
      reservationId: { in: reservationIds },
      status: { in: [...MATERIAL_IN_CUSTODY_DELIVERY_STATUSES] },
    },
    select: {
      reservationId: true,
    },
  });

  return new Set(deliveries.map((delivery) => delivery.reservationId));
};

export const sumHeldQuantityForMaterial = async (
  tx: Prisma.TransactionClient,
  materialId: string,
  statuses: readonly ReservationStatus[] = ACTIVE_HOLD_STATUSES,
) => {
  const aggregate = await tx.reservation.aggregate({
    where: {
      materialId,
      status: { in: [...statuses] },
    },
    _sum: {
      quantityRequested: true,
    },
  });

  let held = toDecimal(aggregate._sum.quantityRequested);

  const usesDefaultHoldStatuses =
    statuses.length === ACTIVE_HOLD_STATUSES.length &&
    ACTIVE_HOLD_STATUSES.every((status) => statuses.includes(status));

  if (usesDefaultHoldStatuses) {
    const awaitingResolutionReservations = await tx.reservation.findMany({
      where: {
        materialId,
        status: 'AWAITING_RESOLUTION',
      },
      select: {
        id: true,
        quantityRequested: true,
        pendingRescheduleReason: true,
      },
    });

    const awaitingIds = awaitingResolutionReservations.map(
      (reservation) => reservation.id,
    );
    const reservationIdsWithCustodyDeliveries =
      await loadReservationIdsWithCustodyDeliveries(tx, awaitingIds);

    for (const reservation of awaitingResolutionReservations) {
      // Custody deliveries keep material held while the driver still carries it.
      // A reservation explicitly detached before handover also keeps its hold
      // until supplier/admin recovery moves it into the next lifecycle state.
      if (
        reservationIdsWithCustodyDeliveries.has(reservation.id) ||
        reservation.pendingRescheduleReason?.startsWith(
          PARTIAL_PICKUP_HOLD_REASON_PREFIX,
        )
      ) {
        held = held.plus(toDecimal(reservation.quantityRequested));
      }
    }
  }

  return held;
};

export const sumHeldQuantityByStatus = async (
  tx: Prisma.TransactionClient,
  materialId: string,
  status: ReservationStatus,
) => {
  const aggregate = await tx.reservation.aggregate({
    where: {
      materialId,
      status,
    },
    _sum: {
      quantityRequested: true,
    },
  });

  return toDecimal(aggregate._sum.quantityRequested);
};

export type MaterialQuantityState = {
  materialId: string;
  status: MaterialStatus;
  materialQuantity: Prisma.Decimal;
  heldQuantity: Prisma.Decimal;
  availableQuantity: Prisma.Decimal;
};

const buildMaterialQuantityState = (input: {
  materialId: string;
  status: MaterialStatus;
  materialQuantity: Prisma.Decimal | number;
  heldQuantity: Prisma.Decimal | number;
}): MaterialQuantityState => {
  const materialQuantity = toDecimal(input.materialQuantity);
  const heldQuantity = toDecimal(input.heldQuantity);
  const availableQuantity = clampDecimalAtZero(
    materialQuantity.minus(heldQuantity),
  );

  return {
    materialId: input.materialId,
    status: input.status,
    materialQuantity,
    heldQuantity,
    availableQuantity,
  };
};

const sumActiveHoldQuantitiesByMaterialIds = async (
  tx: Prisma.TransactionClient,
  materialIds: string[],
  statuses: readonly ReservationStatus[] = ACTIVE_HOLD_STATUSES,
) => {
  if (materialIds.length === 0) {
    return new Map<string, Prisma.Decimal>();
  }

  const groups = await tx.reservation.groupBy({
    by: ['materialId'],
    where: {
      materialId: { in: materialIds },
      status: { in: [...statuses] },
    },
    _sum: {
      quantityRequested: true,
    },
  });

  return new Map(
    groups.map((group) => [
      group.materialId,
      toDecimal(group._sum.quantityRequested),
    ]),
  );
};

const sumAwaitingResolutionHoldExtrasByMaterialIds = async (
  tx: Prisma.TransactionClient,
  materialIds: string[],
) => {
  const extras = new Map<string, Prisma.Decimal>();
  if (materialIds.length === 0) {
    return extras;
  }

  const awaitingResolutionReservations = await tx.reservation.findMany({
    where: {
      materialId: { in: materialIds },
      status: 'AWAITING_RESOLUTION',
    },
    select: {
      id: true,
      materialId: true,
      quantityRequested: true,
      pendingRescheduleReason: true,
    },
  });

  if (awaitingResolutionReservations.length === 0) {
    return extras;
  }

  const reservationIdsWithCustodyDeliveries =
    await loadReservationIdsWithCustodyDeliveries(
      tx,
      awaitingResolutionReservations.map((reservation) => reservation.id),
    );

  for (const reservation of awaitingResolutionReservations) {
    if (
      reservationIdsWithCustodyDeliveries.has(reservation.id) ||
      reservation.pendingRescheduleReason?.startsWith(
        PARTIAL_PICKUP_HOLD_REASON_PREFIX,
      )
    ) {
      const prior = extras.get(reservation.materialId) ?? new Prisma.Decimal(0);
      extras.set(
        reservation.materialId,
        prior.plus(toDecimal(reservation.quantityRequested)),
      );
    }
  }

  return extras;
};

/**
 * Batch quantity-state loader used by learning-project coverage.
 * Semantically equivalent to calling getMaterialQuantityState per id.
 */
export const getMaterialQuantityStates = async (
  tx: Prisma.TransactionClient,
  materialIds: string[],
): Promise<Map<string, MaterialQuantityState>> => {
  const uniqueMaterialIds = [...new Set(materialIds.filter(Boolean))];
  const results = new Map<string, MaterialQuantityState>();

  if (uniqueMaterialIds.length === 0) {
    return results;
  }

  const materials = await tx.material.findMany({
    where: {
      id: { in: uniqueMaterialIds },
    },
    select: {
      id: true,
      status: true,
      quantity: true,
    },
  });

  const activeHeldByMaterialId = await sumActiveHoldQuantitiesByMaterialIds(
    tx,
    uniqueMaterialIds,
  );
  const awaitingExtrasByMaterialId =
    await sumAwaitingResolutionHoldExtrasByMaterialIds(tx, uniqueMaterialIds);

  for (const material of materials) {
    const heldQuantity = (
      activeHeldByMaterialId.get(material.id) ?? new Prisma.Decimal(0)
    ).plus(awaitingExtrasByMaterialId.get(material.id) ?? new Prisma.Decimal(0));

    results.set(
      material.id,
      buildMaterialQuantityState({
        materialId: material.id,
        status: material.status,
        materialQuantity: material.quantity,
        heldQuantity,
      }),
    );
  }

  return results;
};

export const getMaterialQuantityState = async (
  tx: Prisma.TransactionClient,
  materialId: string,
): Promise<MaterialQuantityState | null> => {
  const states = await getMaterialQuantityStates(tx, [materialId]);
  return states.get(materialId) ?? null;
};

export const resolveMaterialStatusFromHolds = async (
  tx: Prisma.TransactionClient,
  state: MaterialQuantityState,
): Promise<MaterialStatus> => {
  if (state.materialQuantity.lte(0)) {
    return 'REUSED';
  }

  if (state.availableQuantity.gt(0)) {
    return 'AVAILABLE';
  }

  const acceptedHeld = await sumHeldQuantityByStatus(tx, state.materialId, 'ACCEPTED');

  if (acceptedHeld.gt(0)) {
    return 'RESERVED';
  }

  return 'PENDING_RESERVATION';
};

export const recomputeAndUpdateMaterialStatus = async (
  tx: Prisma.TransactionClient,
  materialId: string,
) => {
  const state = await getMaterialQuantityState(tx, materialId);

  if (!state) {
    return null;
  }

  if (state.status === 'UNAVAILABLE') {
    return state;
  }

  const nextStatus = await resolveMaterialStatusFromHolds(tx, state);

  if (nextStatus === 'REUSED') {
    await tx.material.update({
      where: { id: materialId },
      data: {
        quantity: new Prisma.Decimal(0),
        status: 'REUSED',
      },
    });
  } else {
    await tx.material.update({
      where: { id: materialId },
      data: {
        status: nextStatus,
        reusedAt: null,
        reusedByReservationId: null,
      },
    });
  }

  return getMaterialQuantityState(tx, materialId);
};

export const applyReservationCompletionToMaterial = async (
  tx: Prisma.TransactionClient,
  input: {
    materialId: string;
    reservationId: string;
    quantityRequested: Prisma.Decimal | number;
    completedAt: Date;
  },
) => {
  const material = await tx.material.findUnique({
    where: { id: input.materialId },
    select: {
      id: true,
      quantity: true,
      status: true,
    },
  });

  if (!material) {
    return null;
  }

  const remainingQuantity = clampDecimalAtZero(
    toDecimal(material.quantity).minus(toDecimal(input.quantityRequested)),
  );

  if (remainingQuantity.lte(0)) {
    await tx.material.update({
      where: { id: input.materialId },
      data: {
        quantity: new Prisma.Decimal(0),
        status: 'REUSED',
        reusedAt: input.completedAt,
        reusedByReservationId: input.reservationId,
      },
    });

    return remainingQuantity;
  }

  await tx.material.update({
    where: { id: input.materialId },
    data: {
      quantity: remainingQuantity,
    },
  });

  await recomputeAndUpdateMaterialStatus(tx, input.materialId);

  return remainingQuantity;
};

export const getHeldQuantitiesByMaterialIds = async (
  materialIds: string[],
  client: typeof prisma | Prisma.TransactionClient = prisma,
) => {
  if (materialIds.length === 0) {
    return new Map<string, Prisma.Decimal>();
  }

  const groups = await client.reservation.groupBy({
    by: ['materialId'],
    where: {
      materialId: { in: materialIds },
      status: { in: [...ACTIVE_HOLD_STATUSES] },
    },
    _sum: {
      quantityRequested: true,
    },
  });

  return new Map(
    groups.map((group) => [
      group.materialId,
      toDecimal(group._sum.quantityRequested),
    ]),
  );
};

export const computeAvailableQuantity = (
  materialQuantity: Prisma.Decimal | number,
  heldQuantity: Prisma.Decimal | number,
) => {
  const available = toDecimal(materialQuantity).minus(toDecimal(heldQuantity));
  return available.lt(0) ? new Prisma.Decimal(0) : available;
};
