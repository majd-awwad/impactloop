import {
  Prisma,
  type MaterialStatus,
  type ReservationStatus,
} from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

export const ACTIVE_HOLD_STATUSES = [
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'ACCEPTED',
] as const satisfies readonly ReservationStatus[];

/** Reservation statuses that reduce public availableQuantity. COMPLETED consumes stock instead. */

const isPrismaCode = (error: unknown, code: string) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: unknown }).code === code;

export const runSerializableTransaction = async <T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
) => {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (attempt < maxAttempts && isPrismaCode(error, 'P2034')) {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to complete transaction.');
};

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

  return toDecimal(aggregate._sum.quantityRequested);
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

export const getMaterialQuantityState = async (
  tx: Prisma.TransactionClient,
  materialId: string,
): Promise<MaterialQuantityState | null> => {
  const material = await tx.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      status: true,
      quantity: true,
    },
  });

  if (!material) {
    return null;
  }

  const materialQuantity = toDecimal(material.quantity);
  const heldQuantity = await sumHeldQuantityForMaterial(tx, materialId);
  const availableQuantity = clampDecimalAtZero(
    materialQuantity.minus(heldQuantity),
  );

  return {
    materialId: material.id,
    status: material.status,
    materialQuantity,
    heldQuantity,
    availableQuantity,
  };
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
