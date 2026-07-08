import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  findBestOverlappingWindow,
  type TimeWindow,
} from '../delivery-pricing/delivery-window-overlap.js';
import { normalizeDropoffKey } from '../delivery-pricing/delivery-zone-cities.js';

const TERMINAL_RESERVATION_STATUSES = [
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
] as const;

const BLOCKING_DELIVERY_STATUSES = [
  'DRIVER_ASSIGNED',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
  'DELIVERED',
  'FAILED_PICKUP',
  'FAILED_DELIVERY',
  'DRIVER_NO_SHOW',
  'LEARNER_NO_SHOW',
  'AWAITING_RESOLUTION',
] as const;

export type DeliveryGroupCandidate = {
  id: string;
  existingReservationsCount: number;
  deliveryFeeAlreadyApplied: true;
  sharedWindowStart: string;
  sharedWindowEnd: string;
  deliveryFee: number;
  currency: string;
  deliveryZone: string;
};

const parsePreferredWindows = (
  windows: { start: string; end: string }[],
): TimeWindow[] =>
  windows.map((window) => ({
    start: new Date(window.start),
    end: new Date(window.end),
  }));

const groupHasBlockingDelivery = async (
  tx: Prisma.TransactionClient,
  groupId: string,
): Promise<boolean> => {
  const count = await tx.delivery.count({
    where: {
      reservation: {
        deliveryGroupId: groupId,
      },
      status: { in: [...BLOCKING_DELIVERY_STATUSES] },
    },
  });

  return count > 0;
};

export const findCompatibleDeliveryGroupCandidate = async (input: {
  learnerId: string;
  supplierProfileId: string;
  dropoffCity: string;
  dropoffArea?: string | null;
  preferredDeliveryWindows: { start: string; end: string }[];
  deliveryZone: string;
  tx?: Prisma.TransactionClient;
}): Promise<DeliveryGroupCandidate | null> => {
  const client = input.tx ?? prisma;
  const dropoffKey = normalizeDropoffKey(input.dropoffCity, input.dropoffArea);
  const candidateWindows = parsePreferredWindows(input.preferredDeliveryWindows);

  if (candidateWindows.length === 0) {
    return null;
  }

  const openGroups = await client.deliveryGroup.findMany({
    where: {
      learnerId: input.learnerId,
      supplierProfileId: input.supplierProfileId,
      status: 'OPEN',
      assignedDriverProfileId: null,
      deliveryZone: input.deliveryZone as Prisma.EnumDeliveryZoneFilter['equals'],
      reservations: {
        some: {
          status: { notIn: [...TERMINAL_RESERVATION_STATUSES] },
          fulfillmentMethod: 'DELIVERY',
        },
        none: {
          status: { in: [...TERMINAL_RESERVATION_STATUSES] },
        },
      },
    },
    include: {
      reservations: {
        where: {
          status: { notIn: [...TERMINAL_RESERVATION_STATUSES] },
          fulfillmentMethod: 'DELIVERY',
        },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  for (const group of openGroups) {
    const groupDropoffKey = normalizeDropoffKey(group.dropoffCity, group.dropoffArea);
    if (groupDropoffKey !== dropoffKey) {
      continue;
    }

    if (input.tx) {
      if (await groupHasBlockingDelivery(input.tx, group.id)) {
        continue;
      }
    } else if (await groupHasBlockingDelivery(client, group.id)) {
      continue;
    }

    const groupWindow: TimeWindow = {
      start: group.windowStart,
      end: group.windowEnd,
    };

    const overlap = findBestOverlappingWindow(candidateWindows, groupWindow);
    if (!overlap) {
      continue;
    }

    return {
      id: group.id,
      existingReservationsCount: group.reservations.length,
      deliveryFeeAlreadyApplied: true,
      sharedWindowStart: overlap.start.toISOString(),
      sharedWindowEnd: overlap.end.toISOString(),
      deliveryFee: Number(group.deliveryFee),
      currency: group.currency,
      deliveryZone: group.deliveryZone,
    };
  }

  return null;
};

export const validateDeliveryGroupForCombine = async (
  tx: Prisma.TransactionClient,
  input: {
    groupId: string;
    learnerId: string;
    supplierProfileId: string;
    dropoffCity: string;
    dropoffArea?: string | null;
    preferredDeliveryWindows: { start: string; end: string }[];
    deliveryZone: string;
  },
): Promise<
  | { ok: true; sharedWindow: TimeWindow; group: { id: string; deliveryFee: Prisma.Decimal } }
  | { ok: false; code: 'GROUP_NOT_AVAILABLE' | 'GROUP_NOT_FOUND' }
> => {
  const group = await tx.deliveryGroup.findFirst({
    where: {
      id: input.groupId,
      learnerId: input.learnerId,
      supplierProfileId: input.supplierProfileId,
      status: 'OPEN',
      assignedDriverProfileId: null,
      deliveryZone: input.deliveryZone as Prisma.EnumDeliveryZoneFilter['equals'],
    },
  });

  if (!group) {
    return { ok: false, code: 'GROUP_NOT_FOUND' };
  }

  const dropoffKey = normalizeDropoffKey(input.dropoffCity, input.dropoffArea);
  const groupDropoffKey = normalizeDropoffKey(group.dropoffCity, group.dropoffArea);
  if (dropoffKey !== groupDropoffKey) {
    return { ok: false, code: 'GROUP_NOT_AVAILABLE' };
  }

  if (await groupHasBlockingDelivery(tx, group.id)) {
    return { ok: false, code: 'GROUP_NOT_AVAILABLE' };
  }

  const candidateWindows = parsePreferredWindows(input.preferredDeliveryWindows);
  const overlap = findBestOverlappingWindow(candidateWindows, {
    start: group.windowStart,
    end: group.windowEnd,
  });

  if (!overlap) {
    return { ok: false, code: 'GROUP_NOT_AVAILABLE' };
  }

  return {
    ok: true,
    sharedWindow: overlap,
    group: { id: group.id, deliveryFee: group.deliveryFee },
  };
};

export const computeInitialGroupWindow = (
  preferredDeliveryWindows: { start: string; end: string }[],
): TimeWindow | null => {
  const windows = parsePreferredWindows(preferredDeliveryWindows);
  if (windows.length === 0) {
    return null;
  }

  const first = windows[0]!;
  let start = first.start;
  let end = first.end;

  for (const window of windows.slice(1)) {
    const overlap = findBestOverlappingWindow([window], { start, end });
    if (overlap) {
      start = overlap.start;
      end = overlap.end;
    }
  }

  return { start, end };
};
