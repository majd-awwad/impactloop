import type { Prisma } from '../../generated/prisma/client.js';

import {
  isReservationLinkedToAnotherBuildItem,
  validateReservationQuantityForBuildItem,
} from './learning-projects.build-material-allocation.js';
import { ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES } from './learning-projects.build-reservation.constants.js';

/**
 * Future supplier/project impact can be derived without a dedicated table by joining:
 * `project_build_items.linked_reservation_id` → `reservations` (`status = COMPLETED`)
 * → `materials` (`reused_by_reservation_id` / `reused_at`) → supplier `owner_id` / project `project_id`.
 */
const PUBLIC_PROJECT_WHERE: Prisma.LearningProjectWhereInput = {
  status: 'PUBLISHED',
  category: {
    isActive: true,
    categoryType: {
      in: ['PROJECT', 'BOTH'],
    },
  },
};

export { ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES } from './learning-projects.build-reservation.constants.js';

const isActiveLinkedReservationStatus = (status: string) =>
  ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES.includes(
    status as (typeof ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES)[number],
  );

export type BuildItemReservationLinkValidationCode =
  | 'BUILD_ITEM_NOT_FOUND'
  | 'BUILD_ITEM_MATERIAL_MISMATCH'
  | 'ACTIVE_BUILD_ITEM_RESERVATION'
  | 'INSUFFICIENT_QUANTITY'
  | 'RESERVATION_ALREADY_ALLOCATED'
  | 'INCOMPATIBLE_UNIT';

export const validateBuildItemForReservationLink = async (
  tx: Prisma.TransactionClient,
  input: {
    learnerId: string;
    buildItemId: string;
    materialId: string;
    ignoreReservationId?: string;
    reservationId?: string;
    quantityRequested?: Prisma.Decimal;
    materialUnit?: string;
  },
): Promise<
  | {
      ok: true;
      buildItemId: string;
      requiredQuantity: number;
      requiredUnit: string;
    }
  | { ok: false; code: BuildItemReservationLinkValidationCode }
> => {
  const buildItem = await tx.projectBuildItem.findFirst({
    where: {
      id: input.buildItemId,
      build: {
        learnerId: input.learnerId,
        project: {
          is: PUBLIC_PROJECT_WHERE,
        },
      },
    },
    select: {
      id: true,
      linkedMaterialId: true,
      linkedReservationId: true,
      requiredComponent: {
        select: {
          quantity: true,
          unit: true,
        },
      },
    },
  });

  if (!buildItem) {
    return { ok: false, code: 'BUILD_ITEM_NOT_FOUND' };
  }

  if (
    !buildItem.linkedMaterialId ||
    buildItem.linkedMaterialId !== input.materialId
  ) {
    return { ok: false, code: 'BUILD_ITEM_MATERIAL_MISMATCH' };
  }

  const requiredQuantity = buildItem.requiredComponent.quantity.toNumber();
  const requiredUnit = buildItem.requiredComponent.unit;

  if (input.reservationId) {
    const duplicate = await isReservationLinkedToAnotherBuildItem(tx, {
      reservationId: input.reservationId,
      buildItemId: buildItem.id,
    });

    if (duplicate && buildItem.linkedReservationId !== input.reservationId) {
      return { ok: false, code: 'RESERVATION_ALREADY_ALLOCATED' };
    }
  }

  if (
    buildItem.linkedReservationId &&
    buildItem.linkedReservationId !== input.ignoreReservationId
  ) {
    const linked = await tx.reservation.findUnique({
      where: { id: buildItem.linkedReservationId },
      select: { status: true },
    });

    if (linked && isActiveLinkedReservationStatus(linked.status)) {
      return { ok: false, code: 'ACTIVE_BUILD_ITEM_RESERVATION' };
    }
  }

  if (input.quantityRequested != null && input.materialUnit) {
    const quantityValidation = await validateReservationQuantityForBuildItem(tx, {
      buildItemId: buildItem.id,
      materialId: input.materialId,
      reservationId: input.reservationId ?? input.ignoreReservationId ?? '',
      quantityRequested: input.quantityRequested,
      requiredQuantity,
      requiredUnit,
      materialUnit: input.materialUnit,
    });

    if (!quantityValidation.ok) {
      if (quantityValidation.code === 'already_allocated') {
        return { ok: false, code: 'RESERVATION_ALREADY_ALLOCATED' };
      }

      if (quantityValidation.code === 'incompatible_unit') {
        return { ok: false, code: 'INCOMPATIBLE_UNIT' };
      }

      return { ok: false, code: 'INSUFFICIENT_QUANTITY' };
    }
  } else if (input.quantityRequested != null) {
    const requested = input.quantityRequested.toNumber();
    if (requested < requiredQuantity) {
      return { ok: false, code: 'INSUFFICIENT_QUANTITY' };
    }
  }

  return {
    ok: true,
    buildItemId: buildItem.id,
    requiredQuantity,
    requiredUnit,
  };
};

export const setBuildItemLinkedReservationId = async (
  tx: Prisma.TransactionClient,
  buildItemId: string,
  reservationId: string,
) => {
  await tx.projectBuildItem.update({
    where: { id: buildItemId },
    data: { linkedReservationId: reservationId },
  });
};
