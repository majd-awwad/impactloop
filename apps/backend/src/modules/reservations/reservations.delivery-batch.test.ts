import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import type { Prisma } from '../../generated/prisma/client.js';

import { expireStaleMissedPickupsInTransaction } from './reservations.missed-pickup-expiry.repository.js';
import {
  loadReservationIdsWithAnyDelivery,
  loadReservationIdsWithCustodyDeliveries,
  sumHeldQuantityForMaterial,
} from './reservations.quantity.js';

type DeliveryQueryMetrics = {
  findManyCalls: number;
  countCalls: number;
};

const createMockTransaction = (input: {
  awaitingResolutionReservations?: Array<{
    id: string;
    quantityRequested: number;
  }>;
  deliveriesByReservationId?: Map<string, Array<{ status: string }>>;
  heldAggregate?: number | null;
}) => {
  const metrics: DeliveryQueryMetrics = {
    findManyCalls: 0,
    countCalls: 0,
  };

  const tx = {
    reservation: {
      aggregate: async () => ({
        _sum: {
          quantityRequested: input.heldAggregate ?? 0,
        },
      }),
      findMany: async () => input.awaitingResolutionReservations ?? [],
      updateMany: async () => ({ count: 0 }),
    },
    delivery: {
      findMany: async (args: {
        where: {
          reservationId?: { in?: string[] };
          status?: { in?: string[] };
        };
      }) => {
        metrics.findManyCalls += 1;

        const reservationIds = args.where.reservationId?.in ?? [];
        const allowedStatuses = args.where.status?.in;

        return reservationIds.flatMap((reservationId) => {
          const deliveries = input.deliveriesByReservationId?.get(reservationId) ?? [];

          return deliveries
            .filter(
              (delivery) =>
                !allowedStatuses || allowedStatuses.includes(delivery.status),
            )
            .map(() => ({ reservationId }));
        });
      },
      count: async () => {
        metrics.countCalls += 1;
        return 0;
      },
    },
    reservationStatusHistory: {
      create: async () => ({}),
    },
  } as unknown as Prisma.TransactionClient;

  return { tx, metrics };
};

describe('reservation delivery batch lookups', () => {
  test('loadReservationIdsWithAnyDelivery uses one findMany for many reservation ids', async () => {
    const { tx, metrics } = createMockTransaction({
      deliveriesByReservationId: new Map([
        ['reservation-1', [{ status: 'WAITING_FOR_DRIVER' }]],
        ['reservation-3', [{ status: 'DELIVERED' }]],
      ]),
    });

    const reservationIds = Array.from({ length: 10 }, (_, index) => `reservation-${index + 1}`);
    const reservationIdsWithDeliveries = await loadReservationIdsWithAnyDelivery(
      tx,
      reservationIds,
    );

    assert.equal(metrics.findManyCalls, 1);
    assert.equal(metrics.countCalls, 0);
    assert.deepEqual(
      [...reservationIdsWithDeliveries].sort(),
      ['reservation-1', 'reservation-3'],
    );
  });

  test('loadReservationIdsWithCustodyDeliveries filters custody statuses in one query', async () => {
    const { tx, metrics } = createMockTransaction({
      deliveriesByReservationId: new Map([
        ['reservation-1', [{ status: 'WAITING_FOR_DRIVER' }]],
        ['reservation-2', [{ status: 'PICKED_UP' }]],
      ]),
    });

    const reservationIdsWithCustody = await loadReservationIdsWithCustodyDeliveries(tx, [
      'reservation-1',
      'reservation-2',
    ]);

    assert.equal(metrics.findManyCalls, 1);
    assert.equal(metrics.countCalls, 0);
    assert.deepEqual([...reservationIdsWithCustody], ['reservation-2']);
  });

  test('sumHeldQuantityForMaterial does not scale delivery lookups with candidate count', async () => {
    const awaitingResolutionReservations = Array.from({ length: 10 }, (_, index) => ({
      id: `awaiting-${index + 1}`,
      quantityRequested: 1,
    }));

    const { tx, metrics } = createMockTransaction({
      awaitingResolutionReservations,
      deliveriesByReservationId: new Map([
        ['awaiting-2', [{ status: 'PICKED_UP' }]],
        ['awaiting-7', [{ status: 'ON_THE_WAY' }]],
      ]),
      heldAggregate: 4,
    });

    const held = await sumHeldQuantityForMaterial(tx, 'material-1');

    assert.equal(Number(held), 6);
    assert.equal(metrics.findManyCalls, 1);
    assert.equal(metrics.countCalls, 0);
  });

  test('expireStaleMissedPickupsInTransaction uses one delivery lookup for many candidates', async () => {
    const now = new Date('2026-07-12T12:00:00.000Z');
    const pickupWindowEnd = new Date(
      now.getTime() - (31 * 60 + 5) * 60 * 1000,
    );

    const reservations = Array.from({ length: 10 }, (_, index) => ({
      id: `missed-${index + 1}`,
      status: 'ACCEPTED' as const,
      materialId: `material-${index + 1}`,
      fulfillmentMethod: 'PICKUP',
      pickupWindowEnd,
    }));

    const { tx, metrics } = createMockTransaction({
      deliveriesByReservationId: new Map([['missed-3', [{ status: 'WAITING_FOR_DRIVER' }]]]),
    });

    const expiredIds = await expireStaleMissedPickupsInTransaction(
      tx,
      reservations,
      'learner-1',
      now,
    );

    assert.equal(metrics.findManyCalls, 1);
    assert.equal(metrics.countCalls, 0);
    assert.equal(expiredIds.length, 0);
  });
});
