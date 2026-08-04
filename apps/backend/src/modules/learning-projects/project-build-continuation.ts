import {
  Prisma,
  type ProjectBuildItemStatus,
} from '../../generated/prisma/client.js';

export const CONTINUE_BUILD_READY_ITEM_STATUSES = [
  'ALREADY_OWNED',
  'AVAILABLE',
  'ALTERNATIVE',
] as const satisfies readonly ProjectBuildItemStatus[];

export const PUBLIC_CONTINUE_PROJECT_WHERE = {
  status: 'PUBLISHED',
  hiddenAt: null,
  archivedAt: null,
  category: {
    isActive: true,
    categoryType: { in: ['PROJECT', 'BOTH'] },
  },
} satisfies Prisma.LearningProjectWhereInput;

export const CONTINUE_PROJECT_BUILD_ORDER_BY = [
  { updatedAt: 'desc' },
  { startedAt: 'desc' },
  { id: 'asc' },
] satisfies Prisma.ProjectBuildOrderByWithRelationInput[];

export const isContinueBuildItemReady = (item: {
  status: string;
  linkedReservation: { status: string; quantityRequested?: { toNumber(): number } | number } | null;
  requiredQuantity?: number;
}): boolean => {
  if (item.linkedReservation?.status === 'COMPLETED') {
    const required = item.requiredQuantity ?? 0;
    const acquired =
      typeof item.linkedReservation.quantityRequested === 'number'
        ? item.linkedReservation.quantityRequested
        : item.linkedReservation.quantityRequested?.toNumber() ?? 0;

    return required <= 0 || acquired >= required;
  }

  return (CONTINUE_BUILD_READY_ITEM_STATUSES as readonly string[]).includes(
    item.status,
  );
};

export const buildContinuableProjectBuildWhere = (
  learnerId: string,
): Prisma.ProjectBuildWhereInput => ({
  learnerId,
  status: 'IN_PROGRESS',
  project: PUBLIC_CONTINUE_PROJECT_WHERE,
  OR: [
    { items: { none: {} } },
    {
      items: {
        some: {
          NOT: {
            OR: [
              { status: { in: [...CONTINUE_BUILD_READY_ITEM_STATUSES] } },
              { linkedReservation: { is: { status: 'COMPLETED' } } },
            ],
          },
        },
      },
    },
  ],
});
