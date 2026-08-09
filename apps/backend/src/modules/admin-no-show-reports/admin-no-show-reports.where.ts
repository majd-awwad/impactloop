import type { DeliveryStatus, Prisma } from '../../generated/prisma/client.js';

import type { AdminNoShowReportsFilterInput } from './admin-no-show-reports.validation.js';

/**
 * Approximate classifier → Prisma mapping (same predicates for list + export):
 *
 * Recovery family ≈ deliveryId present + reservation.fulfillmentMethod=DELIVERY
 * + reasonCode in recovery set (mirrors isRecoveryFamily).
 *
 * workflow ACCOUNTABILITY ≈ NOT recovery family
 * workflow SYSTEM_RECOVERY ≈ recovery family + targetRole=SYSTEM
 * workflow ACCOUNTABILITY_AND_RECOVERY ≈ recovery family + targetRole≠SYSTEM
 *
 * operationalState NOT_REQUIRED ≈ ACCOUNTABILITY workflow
 * operationalState REQUIRES_RESOLUTION ≈ recovery family + reservation
 *   AWAITING_RESOLUTION + delivery status in recovery set
 * operationalState RESOLVED ≈ recovery family AND NOT requires-resolution
 *
 * strikeImpact is not a Prisma filter — derived post-load via classifier.
 */

const RECOVERY_REASON_CODES = [
  'NO_DRIVER_AVAILABLE',
  'NO_RESPONSE_AFTER_PICKUP_WINDOW',
  'DRIVER_DID_NOT_ARRIVE',
  'PICKUP_FAILED',
] as const;

const RECOVERY_DELIVERY_STATUSES = [
  'AWAITING_RESOLUTION',
  'DRIVER_NO_SHOW',
  'FAILED_PICKUP',
] as const satisfies readonly DeliveryStatus[];

const startOfUtcDay = (date: Date) => {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
};

const buildDateRange = (dateFrom?: string, dateTo?: string) => {
  if (!dateFrom && !dateTo) return undefined;

  const createdAt: Prisma.DateTimeFilter = {};
  if (dateFrom) {
    const parsed = new Date(dateFrom);
    if (!Number.isNaN(parsed.getTime())) {
      createdAt.gte = startOfUtcDay(parsed);
    }
  }
  if (dateTo) {
    const parsed = new Date(dateTo);
    if (!Number.isNaN(parsed.getTime())) {
      const end = startOfUtcDay(parsed);
      end.setUTCHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
  }

  return Object.keys(createdAt).length > 0 ? createdAt : undefined;
};

const recoveryFamilyWhere = (): Prisma.NoShowReportWhereInput => ({
  deliveryId: { not: null },
  reservation: { is: { fulfillmentMethod: 'DELIVERY' } },
  reasonCode: { in: [...RECOVERY_REASON_CODES] },
});

const accountabilityWorkflowWhere = (): Prisma.NoShowReportWhereInput => ({
  NOT: recoveryFamilyWhere(),
});

const systemRecoveryWorkflowWhere = (): Prisma.NoShowReportWhereInput => ({
  AND: [recoveryFamilyWhere(), { targetRole: 'SYSTEM' }],
});

const accountabilityAndRecoveryWorkflowWhere = (): Prisma.NoShowReportWhereInput => ({
  AND: [recoveryFamilyWhere(), { targetRole: { not: 'SYSTEM' } }],
});

const requiresResolutionOperationalWhere = (): Prisma.NoShowReportWhereInput => ({
  AND: [
    recoveryFamilyWhere(),
    { reservation: { is: { status: 'AWAITING_RESOLUTION' } } },
    { delivery: { is: { status: { in: [...RECOVERY_DELIVERY_STATUSES] } } } },
  ],
});

const resolvedOperationalWhere = (): Prisma.NoShowReportWhereInput => ({
  AND: [
    recoveryFamilyWhere(),
    {
      NOT: {
        AND: [
          { reservation: { is: { status: 'AWAITING_RESOLUTION' } } },
          {
            delivery: {
              is: { status: { in: [...RECOVERY_DELIVERY_STATUSES] } },
            },
          },
        ],
      },
    },
  ],
});

const buildWorkflowWhere = (
  workflow?: AdminNoShowReportsFilterInput['workflow'],
): Prisma.NoShowReportWhereInput | undefined => {
  switch (workflow) {
    case 'ACCOUNTABILITY':
      return accountabilityWorkflowWhere();
    case 'SYSTEM_RECOVERY':
      return systemRecoveryWorkflowWhere();
    case 'ACCOUNTABILITY_AND_RECOVERY':
      return accountabilityAndRecoveryWorkflowWhere();
    default:
      return undefined;
  }
};

const buildOperationalWhere = (
  operationalState?: AdminNoShowReportsFilterInput['operationalState'],
): Prisma.NoShowReportWhereInput | undefined => {
  switch (operationalState) {
    case 'NOT_REQUIRED':
      return accountabilityWorkflowWhere();
    case 'REQUIRES_RESOLUTION':
      return requiresResolutionOperationalWhere();
    case 'RESOLVED':
      return resolvedOperationalWhere();
    default:
      return undefined;
  }
};

const buildSearchWhere = (
  search?: string,
): Prisma.NoShowReportWhereInput | undefined => {
  const normalized = search?.trim();
  if (!normalized) return undefined;

  return {
    OR: [
      { id: { contains: normalized, mode: 'insensitive' } },
      {
        reservation: {
          material: { title: { contains: normalized, mode: 'insensitive' } },
        },
      },
      {
        reservation: {
          requester: {
            displayName: { contains: normalized, mode: 'insensitive' },
          },
        },
      },
      {
        reservation: {
          owner: { displayName: { contains: normalized, mode: 'insensitive' } },
        },
      },
      {
        target: { displayName: { contains: normalized, mode: 'insensitive' } },
      },
    ],
  };
};

export const buildAdminNoShowReportsWhere = (
  query: AdminNoShowReportsFilterInput,
): Prisma.NoShowReportWhereInput => {
  const and: Prisma.NoShowReportWhereInput[] = [];

  if (query.status) {
    and.push({ status: query.status });
  }

  const searchWhere = buildSearchWhere(query.search);
  if (searchWhere) and.push(searchWhere);

  if (query.targetRole) {
    and.push({ targetRole: query.targetRole });
  }

  const workflowWhere = buildWorkflowWhere(query.workflow);
  if (workflowWhere) and.push(workflowWhere);

  const operationalWhere = buildOperationalWhere(query.operationalState);
  if (operationalWhere) and.push(operationalWhere);

  const createdAt = buildDateRange(query.dateFrom, query.dateTo);
  if (createdAt) and.push({ createdAt });

  return and.length > 0 ? { AND: and } : {};
};
