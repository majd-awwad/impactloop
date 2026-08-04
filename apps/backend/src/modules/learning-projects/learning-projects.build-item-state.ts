import { ACTIVE_HOLD_STATUSES } from '../reservations/reservations.quantity.js';

import {
  evaluateBuildItemQuantityAllocation,
  type BuildItemQuantityAllocationView,
} from './learning-projects.build-material-allocation.js';
import type {
  LinkedMaterialRecord,
  LinkedReservationRecord,
} from './learning-projects.build-material-linking.js';

export type BuildItemAcquisitionState =
  | 'missing'
  | 'selected'
  | 'reserved'
  | 'needs_attention'
  | 'acquired'
  | 'already_owned';

export type BuildItemAllocationResult =
  | 'sufficient'
  | 'insufficient_quantity'
  | 'incompatible_unit'
  | 'unknown_quantity'
  | 'historical_conflict'
  | 'not_applicable';

const BUILD_ITEM_READY_STATUSES = new Set([
  'ALREADY_OWNED',
  'AVAILABLE',
  'ALTERNATIVE',
]);

const TERMINAL_FAILED_RESERVATION_STATUSES = new Set([
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
]);

const isActiveLinkedReservationStatus = (status: string) =>
  (ACTIVE_HOLD_STATUSES as readonly string[]).includes(
    status as (typeof ACTIVE_HOLD_STATUSES)[number],
  ) || status === 'AWAITING_RESOLUTION';

export const mapAllocationOutcomeToResult = (
  outcome: string | undefined | null,
  allocationWarning?: string | null,
): BuildItemAllocationResult => {
  switch (outcome) {
    case 'allocation_sufficient':
      return 'sufficient';
    case 'allocation_partial':
    case 'insufficient_quantity':
      return 'insufficient_quantity';
    case 'incompatible_unit':
      return 'incompatible_unit';
    case 'unknown_quantity':
      return 'unknown_quantity';
    case 'conflict':
      return 'historical_conflict';
    case 'not_applicable':
      return 'not_applicable';
    default:
      return allocationWarning ? 'historical_conflict' : 'not_applicable';
  }
};

export type ResolvedBuildItemState = {
  acquisitionState: BuildItemAcquisitionState;
  allocationResult: BuildItemAllocationResult | null;
  isReadyForBuild: boolean;
  readinessLabel: string;
  quantityAllocation: BuildItemQuantityAllocationView | undefined;
};

const buildQuantityAllocationInput = (input: {
  status: string;
  componentRole?: string;
  requiredQuantity?: number;
  requiredUnit?: string;
  materialUnit?: string | null;
  availableQuantity?: number | null;
  peerClaimsOnMaterial?: number;
  linkedReservation?: LinkedReservationRecord | null;
  linkedMaterial?: LinkedMaterialRecord | null;
}) => ({
  status: input.status,
  componentRole: input.componentRole ?? 'REQUIRED_MATERIAL',
  requiredQuantity: input.requiredQuantity ?? 0,
  requiredUnit: input.requiredUnit ?? '',
  linkedMaterialId: input.linkedMaterial?.id ?? null,
  materialUnit: input.materialUnit ?? null,
  linkedReservation: input.linkedReservation ?? null,
  availableQuantity: input.availableQuantity,
  peerClaimsOnMaterial: input.peerClaimsOnMaterial,
});

const resolveChecklistReadyLabel = (status: string) => {
  if (status === 'ALREADY_OWNED') {
    return 'Marked as already owned';
  }

  if (status === 'ALTERNATIVE') {
    return 'Alternative accepted';
  }

  return 'Marked as available';
};

const resolveCompletedReadinessLabel = (
  allocation: BuildItemQuantityAllocationView,
) => {
  if (allocation.outcome === 'incompatible_unit') {
    return 'This acquired material is not compatible with the required component unit.';
  }

  if (
    allocation.outcome === 'allocation_partial' ||
    allocation.outcome === 'insufficient_quantity'
  ) {
    return 'Partially acquired — insufficient quantity';
  }

  return allocation.warning ?? 'Acquired quantity is insufficient';
};

export const resolveBuildItemState = (input: {
  status: string;
  componentRole?: string;
  requiredQuantity?: number;
  requiredUnit?: string;
  materialUnit?: string | null;
  availableQuantity?: number | null;
  peerClaimsOnMaterial?: number;
  linkedReservation?: LinkedReservationRecord | null;
  linkedMaterial?: LinkedMaterialRecord | null;
  allocationWarning?: string | null;
}): ResolvedBuildItemState => {
  const reservation = input.linkedReservation;
  const reservationStatus = reservation?.status ?? null;

  if (reservationStatus === 'COMPLETED') {
    const quantityAllocation = evaluateBuildItemQuantityAllocation(
      buildQuantityAllocationInput(input),
    );
    const allocationResult = input.allocationWarning
      ? 'historical_conflict'
      : mapAllocationOutcomeToResult(quantityAllocation.outcome);
    const isReadyForBuild =
      allocationResult === 'sufficient' && !input.allocationWarning;

    return {
      acquisitionState: 'acquired',
      allocationResult,
      isReadyForBuild,
      readinessLabel: isReadyForBuild
        ? 'Ready for build — material acquired'
        : resolveCompletedReadinessLabel(quantityAllocation),
      quantityAllocation,
    };
  }

  if (BUILD_ITEM_READY_STATUSES.has(input.status)) {
    return {
      acquisitionState:
        input.status === 'ALREADY_OWNED' ? 'already_owned' : 'missing',
      allocationResult: 'not_applicable',
      isReadyForBuild: true,
      readinessLabel: resolveChecklistReadyLabel(input.status),
      quantityAllocation: undefined,
    };
  }

  if (reservationStatus === 'AWAITING_RESOLUTION') {
    return {
      acquisitionState: 'needs_attention',
      allocationResult: 'not_applicable',
      isReadyForBuild: false,
      readinessLabel: 'Reservation requires resolution',
      quantityAllocation: undefined,
    };
  }

  if (reservation && isActiveLinkedReservationStatus(reservationStatus ?? '')) {
    const quantityAllocation = evaluateBuildItemQuantityAllocation(
      buildQuantityAllocationInput(input),
    );

    return {
      acquisitionState: 'reserved',
      allocationResult: mapAllocationOutcomeToResult(quantityAllocation.outcome),
      isReadyForBuild: false,
      readinessLabel: 'Reservation in progress — not ready yet',
      quantityAllocation,
    };
  }

  if (
    reservation &&
    TERMINAL_FAILED_RESERVATION_STATUSES.has(reservationStatus ?? '')
  ) {
    return {
      acquisitionState: 'needs_attention',
      allocationResult: 'not_applicable',
      isReadyForBuild: false,
      readinessLabel: 'Linked reservation needs attention',
      quantityAllocation: undefined,
    };
  }

  if (input.linkedMaterial) {
    const quantityAllocation = evaluateBuildItemQuantityAllocation(
      buildQuantityAllocationInput(input),
    );
    const allocationResult = mapAllocationOutcomeToResult(
      quantityAllocation.outcome,
      input.allocationWarning,
    );

    if (
      allocationResult === 'insufficient_quantity' ||
      allocationResult === 'incompatible_unit' ||
      allocationResult === 'unknown_quantity'
    ) {
      return {
        acquisitionState: 'selected',
        allocationResult,
        isReadyForBuild: false,
        readinessLabel:
          allocationResult === 'insufficient_quantity'
            ? 'Insufficient quantity'
            : quantityAllocation.warning ??
              'Material quantity cannot be verified',
        quantityAllocation,
      };
    }

    return {
      acquisitionState: 'selected',
      allocationResult,
      isReadyForBuild: false,
      readinessLabel:
        'Material selected — reserve or acquire it before building',
      quantityAllocation,
    };
  }

  if (input.status === 'RESERVED') {
    return {
      acquisitionState: 'missing',
      allocationResult: 'not_applicable',
      isReadyForBuild: false,
      readinessLabel: 'Marked reserved — acquire the material to mark ready',
      quantityAllocation: undefined,
    };
  }

  return {
    acquisitionState: 'missing',
    allocationResult: 'not_applicable',
    isReadyForBuild: false,
    readinessLabel: 'Still missing',
    quantityAllocation: undefined,
  };
};

export const resolveBuildItemReadinessFromState = (input: {
  status: string;
  componentRole?: string;
  requiredQuantity?: number;
  requiredUnit?: string;
  materialUnit?: string | null;
  availableQuantity?: number | null;
  peerClaimsOnMaterial?: number;
  linkedReservation?: LinkedReservationRecord | null;
  linkedMaterial?: LinkedMaterialRecord | null;
  allocationWarning?: string | null;
}) => {
  const resolved = resolveBuildItemState(input);

  return {
    isReadyForBuild: resolved.isReadyForBuild,
    readinessLabel: resolved.readinessLabel,
    acquisitionState: resolved.acquisitionState,
    allocationResult: resolved.allocationResult,
    quantityAllocation: resolved.quantityAllocation,
  };
};

export const resolveBuildItemStepUnlockReadinessFromState = (input: {
  status: string;
  componentRole?: string;
  requiredQuantity?: number;
  requiredUnit?: string;
  materialUnit?: string | null;
  linkedReservation?: LinkedReservationRecord | null;
  linkedMaterial?: LinkedMaterialRecord | null;
  allocationWarning?: string | null;
}) => {
  const resolved = resolveBuildItemState(input);

  if (resolved.acquisitionState === 'acquired') {
    return {
      isReadyForStepUnlock:
        resolved.isReadyForBuild && resolved.allocationResult === 'sufficient',
    };
  }

  if (BUILD_ITEM_READY_STATUSES.has(input.status)) {
    return { isReadyForStepUnlock: true };
  }

  return { isReadyForStepUnlock: false };
};