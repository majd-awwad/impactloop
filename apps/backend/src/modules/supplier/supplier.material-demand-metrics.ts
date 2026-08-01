import type { ReservationStatus } from '../../generated/prisma/client.js';

export const MATERIAL_DEMAND_PENDING_STATUSES = [
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
] as const satisfies readonly ReservationStatus[];

export const MATERIAL_DEMAND_ACCEPTED_STATUSES = [
  'ACCEPTED',
  'AWAITING_RESOLUTION',
] as const satisfies readonly ReservationStatus[];

export const MATERIAL_DEMAND_ACTIVE_STATUSES = [
  ...MATERIAL_DEMAND_PENDING_STATUSES,
  ...MATERIAL_DEMAND_ACCEPTED_STATUSES,
] as const satisfies readonly ReservationStatus[];

export const MATERIAL_DEMAND_COMPLETED_STATUSES = [
  'COMPLETED',
] as const satisfies readonly ReservationStatus[];

export const MATERIAL_DEMAND_NEGATIVE_TERMINAL_STATUSES = [
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
] as const satisfies readonly ReservationStatus[];

export const MATERIAL_DEMAND_TRACKED_STATUSES = [
  ...MATERIAL_DEMAND_ACTIVE_STATUSES,
  ...MATERIAL_DEMAND_COMPLETED_STATUSES,
  ...MATERIAL_DEMAND_NEGATIVE_TERMINAL_STATUSES,
] as const satisfies readonly ReservationStatus[];

export const DEMAND_SCORE_WEIGHTS = {
  view: 1,
  like: 5,
  pendingReservation: 20,
  acceptedReservation: 30,
  completedReservation: 40,
} as const;

export type MaterialReservationStatusCounts = {
  pendingReservationsCount: number;
  reservedReservationsCount: number;
  completedReservationsCount: number;
};

export type MaterialDemandMetricsInput = MaterialReservationStatusCounts & {
  viewsCount: number;
  likesCount: number;
  reusedCount: number;
};

export type MaterialDemandMetrics = MaterialDemandMetricsInput & {
  activeRequestsCount: number;
  activeDemandScore: number;
  demandScore: number;
  demandScorePercent: number;
  reservationsCount: number;
};

const isPendingDemandStatus = (status: string) =>
  MATERIAL_DEMAND_PENDING_STATUSES.includes(
    status as (typeof MATERIAL_DEMAND_PENDING_STATUSES)[number],
  );

const isAcceptedDemandStatus = (status: string) =>
  MATERIAL_DEMAND_ACCEPTED_STATUSES.includes(
    status as (typeof MATERIAL_DEMAND_ACCEPTED_STATUSES)[number],
  );

export const emptyMaterialReservationStatusCounts =
  (): MaterialReservationStatusCounts => ({
    pendingReservationsCount: 0,
    reservedReservationsCount: 0,
    completedReservationsCount: 0,
  });

export const foldMaterialReservationStatusCounts = (
  groups: Array<{ status: string; count: number }>,
): MaterialReservationStatusCounts => {
  const counts = emptyMaterialReservationStatusCounts();

  for (const group of groups) {
    if (isPendingDemandStatus(group.status)) {
      counts.pendingReservationsCount += group.count;
    } else if (isAcceptedDemandStatus(group.status)) {
      counts.reservedReservationsCount += group.count;
    } else if (group.status === 'COMPLETED') {
      counts.completedReservationsCount += group.count;
    }
  }

  return counts;
};

export const computeMaterialDemandMetrics = (
  input: MaterialDemandMetricsInput,
): MaterialDemandMetrics => {
  const activeRequestsCount =
    input.pendingReservationsCount + input.reservedReservationsCount;

  const activeDemandScore =
    input.pendingReservationsCount * DEMAND_SCORE_WEIGHTS.pendingReservation +
    input.reservedReservationsCount * DEMAND_SCORE_WEIGHTS.acceptedReservation;

  const completedScoreSource =
    input.completedReservationsCount > 0
      ? input.completedReservationsCount
      : input.reusedCount;

  const demandScore =
    input.viewsCount * DEMAND_SCORE_WEIGHTS.view +
    input.likesCount * DEMAND_SCORE_WEIGHTS.like +
    input.pendingReservationsCount * DEMAND_SCORE_WEIGHTS.pendingReservation +
    input.reservedReservationsCount * DEMAND_SCORE_WEIGHTS.acceptedReservation +
    completedScoreSource * DEMAND_SCORE_WEIGHTS.completedReservation;

  const demandScorePercent = Math.min(100, demandScore);

  return {
    ...input,
    activeRequestsCount,
    activeDemandScore,
    demandScore,
    demandScorePercent,
    reservationsCount: activeRequestsCount,
  };
};
