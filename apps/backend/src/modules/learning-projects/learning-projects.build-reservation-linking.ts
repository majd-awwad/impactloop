import type { Prisma, ReservationStatus } from '../../generated/prisma/client.js';

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

export const ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES = [
  'PENDING',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'ACCEPTED',
  'AWAITING_RESOLUTION',
] as const satisfies readonly ReservationStatus[];

const isActiveLinkedReservationStatus = (status: string) =>
  ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES.includes(
    status as (typeof ACTIVE_BUILD_ITEM_LINKED_RESERVATION_STATUSES)[number],
  );

export type BuildItemReservationLinkValidationCode =
  | 'BUILD_ITEM_NOT_FOUND'
  | 'BUILD_ITEM_MATERIAL_MISMATCH'
  | 'ACTIVE_BUILD_ITEM_RESERVATION';

export const validateBuildItemForReservationLink = async (
  tx: Prisma.TransactionClient,
  input: {
    learnerId: string;
    buildItemId: string;
    materialId: string;
    ignoreReservationId?: string;
  },
): Promise<
  | { ok: true; buildItemId: string }
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

  return { ok: true, buildItemId: buildItem.id };
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
