import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Prisma, type Prisma as PrismaNamespace } from '../../generated/prisma/client.js';

import {
  getMaterialQuantityState,
  getMaterialQuantityStates,
  PARTIAL_PICKUP_HOLD_REASON_PREFIX,
} from './reservations.quantity.js';

type MaterialRow = {
  id: string;
  status: 'AVAILABLE' | 'RESERVED' | 'PENDING_RESERVATION' | 'UNAVAILABLE' | 'REUSED';
  quantity: number;
};

type ReservationRow = {
  id: string;
  materialId: string;
  status: string;
  quantityRequested: number;
  pendingRescheduleReason?: string | null;
};

const createQuantityTx = (input: {
  materials: MaterialRow[];
  activeHolds?: ReservationRow[];
  awaitingResolution?: ReservationRow[];
  custodyReservationIds?: string[];
}) => {
  const metrics = {
    materialFindMany: 0,
    reservationGroupBy: 0,
    reservationFindMany: 0,
    deliveryFindMany: 0,
  };

  const activeHolds = input.activeHolds ?? [];
  const awaitingResolution = input.awaitingResolution ?? [];
  const custodyIds = new Set(input.custodyReservationIds ?? []);

  const tx = {
    material: {
      findMany: async (args: { where: { id: { in: string[] } } }) => {
        metrics.materialFindMany += 1;
        const ids = new Set(args.where.id.in);
        return input.materials
          .filter((material) => ids.has(material.id))
          .map((material) => ({
            id: material.id,
            status: material.status,
            quantity: new Prisma.Decimal(material.quantity),
          }));
      },
      findUnique: async (args: { where: { id: string } }) => {
        const material = input.materials.find((row) => row.id === args.where.id);
        if (!material) {
          return null;
        }
        return {
          id: material.id,
          status: material.status,
          quantity: new Prisma.Decimal(material.quantity),
        };
      },
    },
    reservation: {
      groupBy: async (args: {
        by: string[];
        where: { materialId: { in: string[] }; status: { in: string[] } };
      }) => {
        metrics.reservationGroupBy += 1;
        const ids = new Set(args.where.materialId.in);
        const statuses = new Set(args.where.status.in);
        const sums = new Map<string, number>();
        for (const hold of activeHolds) {
          if (!ids.has(hold.materialId) || !statuses.has(hold.status)) {
            continue;
          }
          sums.set(
            hold.materialId,
            (sums.get(hold.materialId) ?? 0) + hold.quantityRequested,
          );
        }
        return [...sums.entries()].map(([materialId, quantityRequested]) => ({
          materialId,
          _sum: { quantityRequested: new Prisma.Decimal(quantityRequested) },
        }));
      },
      aggregate: async (args: {
        where: { materialId: string; status: { in: string[] } };
      }) => {
        const statuses = new Set(args.where.status.in);
        const total = activeHolds
          .filter(
            (hold) =>
              hold.materialId === args.where.materialId &&
              statuses.has(hold.status),
          )
          .reduce((sum, hold) => sum + hold.quantityRequested, 0);
        return { _sum: { quantityRequested: new Prisma.Decimal(total) } };
      },
      findMany: async (args: {
        where: {
          materialId?: string | { in: string[] };
          status?: string;
        };
      }) => {
        metrics.reservationFindMany += 1;
        const materialFilter = args.where.materialId;
        const materialIds =
          typeof materialFilter === 'string'
            ? new Set([materialFilter])
            : new Set(materialFilter?.in ?? []);

        return awaitingResolution
          .filter(
            (reservation) =>
              materialIds.has(reservation.materialId) &&
              reservation.status === (args.where.status ?? 'AWAITING_RESOLUTION'),
          )
          .map((reservation) => ({
            id: reservation.id,
            materialId: reservation.materialId,
            quantityRequested: new Prisma.Decimal(reservation.quantityRequested),
            pendingRescheduleReason: reservation.pendingRescheduleReason ?? null,
          }));
      },
    },
    delivery: {
      findMany: async (args: {
        where: {
          reservationId: { in: string[] };
          status?: { in: string[] };
        };
      }) => {
        metrics.deliveryFindMany += 1;
        return args.where.reservationId.in
          .filter((reservationId) => custodyIds.has(reservationId))
          .map((reservationId) => ({ reservationId }));
      },
    },
  } as unknown as PrismaNamespace.TransactionClient;

  return { tx, metrics };
};

describe('getMaterialQuantityStates batch parity', () => {
  test('matches single-state helper with zero reservations', async () => {
    const { tx, metrics } = createQuantityTx({
      materials: [{ id: 'm1', status: 'AVAILABLE', quantity: 10 }],
    });

    const batch = await getMaterialQuantityStates(tx, ['m1', 'm1']);
    const single = await getMaterialQuantityState(tx, 'm1');

    assert.equal(batch.size, 1);
    assert.equal(Number(batch.get('m1')!.availableQuantity), 10);
    assert.equal(Number(batch.get('m1')!.heldQuantity), 0);
    assert.equal(Number(single!.availableQuantity), 10);
    assert.equal(metrics.materialFindMany >= 1, true);
    assert.equal(metrics.reservationGroupBy >= 1, true);
  });

  test('accounts for active holds and multiple holds on one material', async () => {
    const { tx } = createQuantityTx({
      materials: [
        { id: 'm1', status: 'AVAILABLE', quantity: 10 },
        { id: 'm2', status: 'AVAILABLE', quantity: 5 },
      ],
      activeHolds: [
        { id: 'r1', materialId: 'm1', status: 'PENDING', quantityRequested: 2 },
        { id: 'r2', materialId: 'm1', status: 'ACCEPTED', quantityRequested: 3 },
        { id: 'r3', materialId: 'm2', status: 'ACCEPTED', quantityRequested: 1 },
      ],
    });

    const batch = await getMaterialQuantityStates(tx, ['m1', 'm2', 'missing']);
    const singleM1 = await getMaterialQuantityState(tx, 'm1');

    assert.equal(batch.has('missing'), false);
    assert.equal(Number(batch.get('m1')!.heldQuantity), 5);
    assert.equal(Number(batch.get('m1')!.availableQuantity), 5);
    assert.equal(Number(batch.get('m2')!.availableQuantity), 4);
    assert.equal(Number(singleM1!.heldQuantity), 5);
    assert.equal(Number(singleM1!.availableQuantity), 5);
  });

  test('includes awaiting-resolution custody and partial-pickup holds', async () => {
    const { tx, metrics } = createQuantityTx({
      materials: [{ id: 'm1', status: 'AVAILABLE', quantity: 8 }],
      activeHolds: [
        { id: 'r-active', materialId: 'm1', status: 'ACCEPTED', quantityRequested: 1 },
      ],
      awaitingResolution: [
        {
          id: 'r-custody',
          materialId: 'm1',
          status: 'AWAITING_RESOLUTION',
          quantityRequested: 2,
        },
        {
          id: 'r-partial',
          materialId: 'm1',
          status: 'AWAITING_RESOLUTION',
          quantityRequested: 3,
          pendingRescheduleReason: `${PARTIAL_PICKUP_HOLD_REASON_PREFIX}note`,
        },
        {
          id: 'r-ignored',
          materialId: 'm1',
          status: 'AWAITING_RESOLUTION',
          quantityRequested: 9,
        },
      ],
      custodyReservationIds: ['r-custody'],
    });

    const batch = await getMaterialQuantityStates(tx, ['m1']);
    const single = await getMaterialQuantityState(tx, 'm1');

    assert.equal(Number(batch.get('m1')!.heldQuantity), 6);
    assert.equal(Number(batch.get('m1')!.availableQuantity), 2);
    assert.equal(Number(single!.heldQuantity), 6);
    assert.equal(metrics.deliveryFindMany >= 1, true);
  });

  test('clamps available quantity at zero when fully held', async () => {
    const { tx } = createQuantityTx({
      materials: [{ id: 'm1', status: 'AVAILABLE', quantity: 4 }],
      activeHolds: [
        { id: 'r1', materialId: 'm1', status: 'ACCEPTED', quantityRequested: 10 },
      ],
    });

    const batch = await getMaterialQuantityStates(tx, ['m1']);
    assert.equal(Number(batch.get('m1')!.availableQuantity), 0);
  });

  test('loads many materials with a constant small query count', async () => {
    const materials = Array.from({ length: 20 }, (_, index) => ({
      id: `m${index + 1}`,
      status: 'AVAILABLE' as const,
      quantity: 10,
    }));
    const { tx, metrics } = createQuantityTx({
      materials,
      activeHolds: materials.map((material, index) => ({
        id: `r${index + 1}`,
        materialId: material.id,
        status: 'ACCEPTED',
        quantityRequested: 1,
      })),
    });

    const batch = await getMaterialQuantityStates(
      tx,
      materials.map((material) => material.id),
    );

    assert.equal(batch.size, 20);
    assert.equal(metrics.materialFindMany, 1);
    assert.equal(metrics.reservationGroupBy, 1);
    assert.equal(metrics.reservationFindMany, 1);
  });
});
