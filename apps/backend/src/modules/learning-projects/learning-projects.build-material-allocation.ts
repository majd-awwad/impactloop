import type { Prisma } from '../../generated/prisma/client.js';

import {
  ACTIVE_HOLD_STATUSES,
  getMaterialQuantityState,
  toDecimal,
} from '../reservations/reservations.quantity.js';

import { ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES } from './learning-projects.build-reservation-linking.js';

const TERMINAL_FAILED_RESERVATION_STATUSES = new Set([
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
]);

export type BuildMaterialAllocationOutcome =
  | 'allocation_sufficient'
  | 'allocation_partial'
  | 'insufficient_quantity'
  | 'incompatible_unit'
  | 'unknown_quantity'
  | 'already_allocated'
  | 'conflict'
  | 'stale_material'
  | 'archived_build'
  | 'not_applicable';

export type BuildItemAllocationPeer = {
  id: string;
  linkedMaterialId: string | null;
  linkedReservationId: string | null;
  requiredQuantity: number;
  requiredUnit: string;
  componentRole: string;
  linkedReservation: {
    id: string;
    status: string;
    quantityRequested: Prisma.Decimal;
    materialId: string;
  } | null;
};

export type BuildItemAllocationInput = {
  itemId: string;
  status: string;
  componentRole: string;
  requiredQuantity: number;
  requiredUnit: string;
  linkedMaterialId: string | null;
  materialUnit?: string | null;
  linkedReservation: {
    id: string;
    status: string;
    quantityRequested: Prisma.Decimal;
    materialId: string;
  } | null;
  peerItems: BuildItemAllocationPeer[];
  buildStatus?: string;
};

export type BuildItemQuantityAllocationView = {
  outcome: BuildMaterialAllocationOutcome;
  requiredQuantity: number;
  requiredUnit: string;
  availableQuantity: number | null;
  acquiredQuantity: number | null;
  reservationQuantity: number | null;
  allocatedQuantity: number | null;
  isQuantityReady: boolean;
  warning: string | null;
};

export type InsufficientQuantityLinkDetails = {
  messageEn: string;
  messageAr: string;
  availableQuantity: number;
  requiredQuantity: number;
};

export const buildInsufficientQuantityLinkDetails = (input: {
  availableQuantity: number;
  requiredQuantity: number;
}): InsufficientQuantityLinkDetails => ({
  availableQuantity: input.availableQuantity,
  requiredQuantity: input.requiredQuantity,
  messageEn: `${input.availableQuantity} available, ${input.requiredQuantity} required`,
  messageAr: `المتوفر ${input.availableQuantity}، المطلوب ${input.requiredQuantity}`,
});

/**
 * Canonical material-link capacity check.
 *
 * `availableQuantity` is already net of active reservation holds
 * (`material.quantity - sumHeldQuantity`). Peer selected claims are
 * intent-only allocations from other build items that have linked the
 * material without an active/completed reservation. Active holds must
 * not be added again via peer claims.
 */
export const evaluateMaterialLinkCapacity = (input: {
  availableQuantity: number;
  peerSelectedClaims: number;
  requiredQuantity: number;
}):
  | { ok: true; remainingAfterLink: number }
  | {
      ok: false;
      code: 'insufficient_quantity';
      message: string;
      details: InsufficientQuantityLinkDetails;
    } => {
  const totalNeeded = input.peerSelectedClaims + input.requiredQuantity;

  if (totalNeeded > input.availableQuantity) {
    const details = buildInsufficientQuantityLinkDetails({
      availableQuantity: input.availableQuantity,
      requiredQuantity: input.requiredQuantity,
    });

    return {
      ok: false,
      code: 'insufficient_quantity',
      message: details.messageEn,
      details,
    };
  }

  return {
    ok: true,
    remainingAfterLink: input.availableQuantity - totalNeeded,
  };
};

const decimalToNumber = (value: Prisma.Decimal | null | undefined): number | null => {
  if (value == null) {
    return null;
  }

  return value.toNumber();
};

export const normalizeBuildMaterialUnit = (
  value: string | null | undefined,
): string => {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return '';
  }

  if (normalized.endsWith('ies')) {
    return `${normalized.slice(0, -3)}y`;
  }

  if (normalized.endsWith('s') && normalized.length > 3) {
    return normalized.slice(0, -1);
  }

  return normalized;
};

export const unitsAreCompatible = (
  requiredUnit: string,
  listingUnit: string,
): boolean => {
  const left = normalizeBuildMaterialUnit(requiredUnit);
  const right = normalizeBuildMaterialUnit(listingUnit);
  if (!left || !right) {
    return false;
  }

  return left === right;
};

const isActiveLinkedReservationStatus = (status: string) =>
  (ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES as readonly string[]).includes(
    status,
  ) ||
  (ACTIVE_HOLD_STATUSES as readonly string[]).includes(
    status as (typeof ACTIVE_HOLD_STATUSES)[number],
  );

const isTerminalFailedReservationStatus = (status: string) =>
  TERMINAL_FAILED_RESERVATION_STATUSES.has(status);

export const resolveBuildItemMaterialClaim = (input: {
  requiredQuantity: number;
  linkedMaterialId: string | null;
  linkedReservation: {
    status: string;
    quantityRequested: Prisma.Decimal;
  } | null;
}): number => {
  if (!input.linkedMaterialId) {
    return 0;
  }

  if (input.linkedReservation) {
    const status = input.linkedReservation.status;
    if (
      status === 'COMPLETED' ||
      isActiveLinkedReservationStatus(status)
    ) {
      return decimalToNumber(input.linkedReservation.quantityRequested) ?? 0;
    }

    if (isTerminalFailedReservationStatus(status)) {
      return input.requiredQuantity;
    }
  }

  return input.requiredQuantity;
};

export const sumSelectedMaterialClaimsInBuild = (input: {
  materialId: string;
  peerItems: BuildItemAllocationPeer[];
  excludeItemId?: string;
}): number => {
  let total = 0;

  for (const peer of input.peerItems) {
    if (peer.id === input.excludeItemId) {
      continue;
    }

    if (peer.linkedMaterialId !== input.materialId) {
      continue;
    }

  if (
      peer.linkedReservation &&
      (peer.linkedReservation.status === 'COMPLETED' ||
        isActiveLinkedReservationStatus(peer.linkedReservation.status))
    ) {
      continue;
    }

    total += peer.requiredQuantity;
  }

  return total;
};

export const isReservationLinkedToAnotherBuildItem = async (
  tx: Prisma.TransactionClient,
  input: {
    reservationId: string;
    buildItemId: string;
  },
): Promise<boolean> => {
  const count = await tx.projectBuildItem.count({
    where: {
      id: { not: input.buildItemId },
      linkedReservationId: input.reservationId,
    },
  });

  return count > 0;
};

export const evaluateBuildItemQuantityAllocation = (input: {
  status: string;
  componentRole: string;
  requiredQuantity: number;
  requiredUnit: string;
  linkedMaterialId: string | null;
  materialUnit?: string | null;
  linkedReservation?: {
    status: string;
    quantityRequested: Prisma.Decimal;
  } | null;
  availableQuantity?: number | null;
  peerClaimsOnMaterial?: number;
  buildStatus?: string;
}): BuildItemQuantityAllocationView => {
  const base = {
    requiredQuantity: input.requiredQuantity,
    requiredUnit: input.requiredUnit,
    availableQuantity: input.availableQuantity ?? null,
    acquiredQuantity: null as number | null,
    reservationQuantity: null as number | null,
    allocatedQuantity: null as number | null,
    warning: null as string | null,
  };

  if (input.buildStatus === 'ARCHIVED') {
    return {
      ...base,
      outcome: 'archived_build',
      isQuantityReady: false,
      warning: 'This build is archived.',
    };
  }

  if (input.componentRole === 'TOOL') {
    return {
      ...base,
      outcome: 'not_applicable',
      isQuantityReady: input.status === 'ALREADY_OWNED',
      warning: null,
    };
  }

  if (input.status === 'ALREADY_OWNED') {
    return {
      ...base,
      outcome: 'not_applicable',
      isQuantityReady: true,
      warning: null,
    };
  }

  if (
    input.status === 'AVAILABLE' ||
    input.status === 'ALTERNATIVE'
  ) {
    return {
      ...base,
      outcome: 'not_applicable',
      isQuantityReady: true,
      warning: null,
    };
  }

  if (input.requiredQuantity <= 0) {
    return {
      ...base,
      outcome: 'unknown_quantity',
      isQuantityReady: false,
      warning: 'Required quantity is invalid.',
    };
  }

  const reservationQuantity = input.linkedReservation
    ? decimalToNumber(input.linkedReservation.quantityRequested)
    : null;

  if (input.linkedReservation?.status === 'COMPLETED') {
    const acquired = reservationQuantity ?? 0;
    const isReady = acquired >= input.requiredQuantity;

    if (
      input.linkedMaterialId &&
      input.materialUnit?.trim() &&
      !unitsAreCompatible(input.requiredUnit, input.materialUnit)
    ) {
      return {
        ...base,
        availableQuantity: null,
        outcome: 'incompatible_unit',
        acquiredQuantity: acquired,
        reservationQuantity: acquired,
        allocatedQuantity: acquired,
        isQuantityReady: false,
        warning:
          'Linked material unit is not compatible with the required component unit.',
      };
    }

    return {
      ...base,
      availableQuantity: null,
      outcome: isReady ? 'allocation_sufficient' : 'allocation_partial',
      acquiredQuantity: acquired,
      reservationQuantity: acquired,
      allocatedQuantity: acquired,
      isQuantityReady: isReady,
      warning: isReady
        ? null
        : `Acquired quantity (${acquired}) is less than required (${input.requiredQuantity}).`,
    };
  }

  if (
    input.linkedReservation &&
    isActiveLinkedReservationStatus(input.linkedReservation.status)
  ) {
    const held = reservationQuantity ?? 0;
    const isReady = held >= input.requiredQuantity;

    if (
      input.linkedMaterialId &&
      input.materialUnit?.trim() &&
      !unitsAreCompatible(input.requiredUnit, input.materialUnit)
    ) {
      return {
        ...base,
        outcome: 'incompatible_unit',
        isQuantityReady: false,
        warning:
          'Linked material unit is not compatible with the required component unit.',
      };
    }

    return {
      ...base,
      outcome: isReady ? 'allocation_sufficient' : 'allocation_partial',
      reservationQuantity: held,
      allocatedQuantity: held,
      isQuantityReady: false,
      warning: isReady
        ? null
        : `Reserved quantity (${held}) is less than required (${input.requiredQuantity}).`,
    };
  }

  if (!input.linkedMaterialId) {
    return {
      ...base,
      outcome: 'not_applicable',
      isQuantityReady: false,
      warning: null,
    };
  }

  if (!input.materialUnit?.trim()) {
    return {
      ...base,
      outcome: 'unknown_quantity',
      isQuantityReady: false,
      warning: 'Material unit is unknown — quantity cannot be verified.',
    };
  }

  if (!unitsAreCompatible(input.requiredUnit, input.materialUnit)) {
    return {
      ...base,
      outcome: 'incompatible_unit',
      isQuantityReady: false,
      warning: 'Linked material unit is not compatible with the required component unit.',
    };
  }

  const available = input.availableQuantity;
  if (available == null) {
    return {
      ...base,
      outcome: 'unknown_quantity',
      isQuantityReady: false,
      warning: 'Available material quantity is unknown.',
    };
  }

  const peerClaims = input.peerClaimsOnMaterial ?? 0;
  const totalNeeded = peerClaims + input.requiredQuantity;

  if (available < input.requiredQuantity) {
    return {
      ...base,
      outcome: 'insufficient_quantity',
      availableQuantity: available,
      allocatedQuantity: Math.min(available, input.requiredQuantity),
      isQuantityReady: false,
      warning: `${available} available, ${input.requiredQuantity} required`,
    };
  }

  return {
    ...base,
    outcome: 'allocation_sufficient',
    availableQuantity: available,
    allocatedQuantity: input.requiredQuantity,
    isQuantityReady: false,
    warning: null,
  };
};

export const validateMaterialLinkAllocationInBuild = async (
  tx: Prisma.TransactionClient,
  input: {
    buildId: string;
    buildItemId: string;
    materialId: string;
    requiredQuantity: number;
    requiredUnit: string;
    componentRole: string;
    buildStatus: string;
    peerItems: BuildItemAllocationPeer[];
  },
): Promise<
  | { ok: true; allocation: BuildItemQuantityAllocationView }
  | {
      ok: false;
      code: BuildMaterialAllocationOutcome;
      message: string;
      details?: InsufficientQuantityLinkDetails;
    }
> => {
  if (input.buildStatus === 'ARCHIVED') {
    return {
      ok: false,
      code: 'archived_build',
      message: 'Cannot allocate materials on an archived build.',
    };
  }

  if (input.componentRole === 'TOOL') {
    return {
      ok: true,
      allocation: evaluateBuildItemQuantityAllocation({
        status: 'MISSING',
        componentRole: 'TOOL',
        requiredQuantity: input.requiredQuantity,
        requiredUnit: input.requiredUnit,
        linkedMaterialId: input.materialId,
        buildStatus: input.buildStatus,
      }),
    };
  }

  const material = await tx.material.findUnique({
    where: { id: input.materialId },
    select: {
      id: true,
      unit: true,
      status: true,
      quantity: true,
    },
  });

  if (!material || material.status !== 'AVAILABLE') {
    return {
      ok: false,
      code: 'stale_material',
      message: 'Material is not available for linking.',
    };
  }

  if (!unitsAreCompatible(input.requiredUnit, material.unit)) {
    return {
      ok: false,
      code: 'incompatible_unit',
      message: 'Material unit is not compatible with the required component unit.',
    };
  }

  const quantityState = await getMaterialQuantityState(tx, input.materialId);
  if (!quantityState) {
    return {
      ok: false,
      code: 'stale_material',
      message: 'Material is not available for linking.',
    };
  }

  const peerClaims = sumSelectedMaterialClaimsInBuild({
    materialId: input.materialId,
    peerItems: input.peerItems,
    excludeItemId: input.buildItemId,
  });

  const available = decimalToNumber(quantityState.availableQuantity) ?? 0;
  const capacity = evaluateMaterialLinkCapacity({
    availableQuantity: available,
    peerSelectedClaims: peerClaims,
    requiredQuantity: input.requiredQuantity,
  });

  if (!capacity.ok) {
    return {
      ok: false,
      code: capacity.code,
      message: capacity.message,
      details: capacity.details,
    };
  }

  const allocation = evaluateBuildItemQuantityAllocation({
    status: 'MISSING',
    componentRole: input.componentRole,
    requiredQuantity: input.requiredQuantity,
    requiredUnit: input.requiredUnit,
    linkedMaterialId: input.materialId,
    materialUnit: material.unit,
    availableQuantity: available,
    peerClaimsOnMaterial: peerClaims,
    buildStatus: input.buildStatus,
  });

  return { ok: true, allocation };
};

export const validateReservationQuantityForBuildItem = async (
  tx: Prisma.TransactionClient,
  input: {
    buildItemId: string;
    materialId: string;
    reservationId?: string;
    quantityRequested: Prisma.Decimal;
    requiredQuantity: number;
    requiredUnit: string;
    materialUnit: string;
  },
): Promise<
  | { ok: true }
  | { ok: false; code: BuildMaterialAllocationOutcome; message: string }
> => {
  if (
    input.reservationId &&
    (await isReservationLinkedToAnotherBuildItem(tx, {
      reservationId: input.reservationId,
      buildItemId: input.buildItemId,
    }))
  ) {
    return {
      ok: false,
      code: 'already_allocated',
      message: 'This reservation is already linked to another build item.',
    };
  }

  if (!unitsAreCompatible(input.requiredUnit, input.materialUnit)) {
    return {
      ok: false,
      code: 'incompatible_unit',
      message: 'Reservation material unit is not compatible with the required component unit.',
    };
  }

  const requested = decimalToNumber(input.quantityRequested) ?? 0;
  if (requested < input.requiredQuantity) {
    return {
      ok: false,
      code: 'insufficient_quantity',
      message: `Reserved quantity (${requested}) is less than required (${input.requiredQuantity}).`,
    };
  }

  const quantityState = await getMaterialQuantityState(tx, input.materialId);
  if (!quantityState) {
    return {
      ok: false,
      code: 'stale_material',
      message: 'Material is not available.',
    };
  }

  if (toDecimal(input.quantityRequested).gt(quantityState.materialQuantity)) {
    return {
      ok: false,
      code: 'insufficient_quantity',
      message: 'Requested quantity exceeds material listing quantity.',
    };
  }

  return { ok: true };
};

export const loadBuildAllocationPeers = async (
  tx: Prisma.TransactionClient,
  buildId: string,
): Promise<BuildItemAllocationPeer[]> => {
  const items = await tx.projectBuildItem.findMany({
    where: { buildId },
    select: {
      id: true,
      linkedMaterialId: true,
      linkedReservationId: true,
      requiredComponent: {
        select: {
          quantity: true,
          unit: true,
          componentRole: true,
        },
      },
      linkedReservation: {
        select: {
          id: true,
          status: true,
          quantityRequested: true,
          materialId: true,
        },
      },
    },
  });

  return items.map((item) => ({
    id: item.id,
    linkedMaterialId: item.linkedMaterialId,
    linkedReservationId: item.linkedReservationId,
    requiredQuantity: decimalToNumber(item.requiredComponent.quantity) ?? 0,
    requiredUnit: item.requiredComponent.unit,
    componentRole: item.requiredComponent.componentRole,
    linkedReservation: item.linkedReservation,
  }));
};

export const detectHistoricalAllocationConflict = (input: {
  itemId: string;
  materialId: string;
  requiredQuantity: number;
  linkedReservation: {
    id: string;
    status: string;
    quantityRequested: Prisma.Decimal;
  } | null;
  peerItems: BuildItemAllocationPeer[];
}): string | null => {
  if (!input.materialId) {
    return null;
  }

  if (input.linkedReservation) {
    const duplicateReservation = input.peerItems.find(
      (peer) =>
        peer.id !== input.itemId &&
        peer.linkedReservationId === input.linkedReservation?.id,
    );

    if (duplicateReservation) {
      return 'This reservation is linked to multiple build items.';
    }
  }

  const peersOnMaterial = input.peerItems.filter(
    (peer) =>
      peer.id !== input.itemId && peer.linkedMaterialId === input.materialId,
  );

  if (peersOnMaterial.length === 0) {
    return null;
  }

  let selectedClaims = 0;
  let activeHeld = 0;
  let completedAcquired = 0;

  for (const peer of peersOnMaterial) {
    if (
      peer.linkedReservation?.status === 'COMPLETED' ||
      isActiveLinkedReservationStatus(peer.linkedReservation?.status ?? '')
    ) {
      activeHeld += decimalToNumber(peer.linkedReservation?.quantityRequested) ?? 0;
      if (peer.linkedReservation?.status === 'COMPLETED') {
        completedAcquired +=
          decimalToNumber(peer.linkedReservation.quantityRequested) ?? 0;
      }
      continue;
    }

    selectedClaims += peer.requiredQuantity;
  }

  const selfClaim = resolveBuildItemMaterialClaim({
    requiredQuantity: input.requiredQuantity,
    linkedMaterialId: input.materialId,
    linkedReservation: input.linkedReservation,
  });

  if (
    input.linkedReservation?.status === 'COMPLETED' &&
    (decimalToNumber(input.linkedReservation.quantityRequested) ?? 0) <
      input.requiredQuantity
  ) {
    return `Acquired quantity is less than required (${input.requiredQuantity}).`;
  }

  if (
    !input.linkedReservation ||
    isTerminalFailedReservationStatus(input.linkedReservation.status)
  ) {
    if (selectedClaims + selfClaim > 0 && peersOnMaterial.length > 0) {
      // bounded warning only when multiple selected intents exist
      const totalSelected =
        selectedClaims +
        (input.linkedReservation &&
        !isTerminalFailedReservationStatus(input.linkedReservation.status)
          ? 0
          : input.requiredQuantity);
      if (totalSelected > 0 && peersOnMaterial.some((p) => !p.linkedReservation)) {
        // keep conservative: warn when sharing selected material across items
      }
    }
  }

  return null;
};

export const mapBuildItemQuantityAllocationDto = (
  allocation: BuildItemQuantityAllocationView | undefined,
) => {
  if (!allocation || allocation.outcome === 'not_applicable') {
    return null;
  }

  return {
    outcome: allocation.outcome,
    requiredQuantity: allocation.requiredQuantity,
    requiredUnit: allocation.requiredUnit,
    availableQuantity: allocation.availableQuantity,
    acquiredQuantity: allocation.acquiredQuantity,
    reservationQuantity: allocation.reservationQuantity,
    allocatedQuantity: allocation.allocatedQuantity,
    isQuantityReady: allocation.isQuantityReady,
    warning: allocation.warning,
  };
};

export const buildAllocationPeersFromBuildItems = (
  items: Array<{
    id: string;
    linkedMaterialId: string | null;
    linkedReservationId: string | null;
    requiredComponent: {
      quantity: Prisma.Decimal;
      unit: string;
      componentRole: string;
    };
    linkedReservation: {
      id: string;
      status: string;
      quantityRequested: Prisma.Decimal;
      materialId: string;
    } | null;
  }>,
): BuildItemAllocationPeer[] =>
  items.map((item) => ({
    id: item.id,
    linkedMaterialId: item.linkedMaterialId,
    linkedReservationId: item.linkedReservationId,
    requiredQuantity: item.requiredComponent.quantity.toNumber(),
    requiredUnit: item.requiredComponent.unit,
    componentRole: item.requiredComponent.componentRole,
    linkedReservation: item.linkedReservation,
  }));

export const resolveBuildItemAllocationContext = async (
  client: Parameters<typeof getMaterialQuantityState>[0],
  input: {
    buildStatus: string;
    items: Array<{
      id: string;
      status: string;
      linkedMaterialId: string | null;
      linkedReservationId: string | null;
      requiredComponent: {
        quantity: Prisma.Decimal;
        unit: string;
        componentRole: string;
      };
      linkedMaterial: { id: string; unit: string } | null;
      linkedReservation: {
        id: string;
        status: string;
        quantityRequested: Prisma.Decimal;
        materialId: string;
      } | null;
    }>;
  },
) => {
  const peers = buildAllocationPeersFromBuildItems(input.items);
  const materialIds = [
    ...new Set(
      input.items
        .map((item) => item.linkedMaterialId)
        .filter((id): id is string => id != null),
    ),
  ];

  const availableByMaterialId = new Map<string, number>();
  for (const materialId of materialIds) {
    const state = await getMaterialQuantityState(client, materialId);
    if (state) {
      availableByMaterialId.set(
        materialId,
        decimalToNumber(state.availableQuantity) ?? 0,
      );
    }
  }

  return input.items.map((item) => {
    const materialId = item.linkedMaterialId;
    const peerClaimsOnMaterial =
      materialId != null
        ? sumSelectedMaterialClaimsInBuild({
            materialId,
            peerItems: peers,
            excludeItemId: item.id,
          })
        : 0;

    const allocationWarning =
      materialId != null
        ? detectHistoricalAllocationConflict({
            itemId: item.id,
            materialId,
            requiredQuantity: item.requiredComponent.quantity.toNumber(),
            linkedReservation: item.linkedReservation,
            peerItems: peers,
          })
        : null;

    const availableQuantity =
      item.linkedReservation?.status === 'COMPLETED'
        ? null
        : materialId != null
          ? (availableByMaterialId.get(materialId) ?? null)
          : null;

    return {
      itemId: item.id,
      requiredQuantity: item.requiredComponent.quantity.toNumber(),
      requiredUnit: item.requiredComponent.unit,
      componentRole: item.requiredComponent.componentRole,
      materialUnit: item.linkedMaterial?.unit ?? null,
      availableQuantity,
      peerClaimsOnMaterial,
      allocationWarning,
    };
  });
};
