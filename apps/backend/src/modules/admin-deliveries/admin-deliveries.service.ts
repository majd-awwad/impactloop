import type { DeliveryStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import * as repository from './admin-deliveries.repository.js';
import type { AdminDeliveriesListQuery } from './admin-deliveries.validation.js';
import { notifyDriverDeliveryUnassignedByAdmin } from '../notifications/driver-notification-events.service.js';
import { classifyAdminReportContract } from '../admin-no-show-reports/admin-no-show-reports.classifier.js';
import {
  composeAdminDeliveryContract,
  type DeliveryIncidentContract,
} from './admin-deliveries.classifier.js';

type OwnerWithSupplier = {
  id: string;
  displayName: string;
  email: string;
  supplierProfile: {
    publicName: string | null;
    organizationProfile: { organizationName: string } | null;
  } | null;
};

type LocationSummary = {
  country: string;
  city: string;
  area: string | null;
  addressLine?: string | null;
};

const resolveSupplierDisplayName = (owner: OwnerWithSupplier) =>
  owner.supplierProfile?.organizationProfile?.organizationName?.trim() ||
  owner.supplierProfile?.publicName?.trim() ||
  owner.displayName;

const formatLocationLabel = (location: LocationSummary | null | undefined) => {
  if (!location) return null;
  const parts = [location.area, location.city, location.country]
    .map((part) => part?.trim())
    .filter((part) => part && part.length > 0);
  return parts.length > 0 ? parts.join(', ') : null;
};

const deliveryStatusLabel = (status: DeliveryStatus) =>
  status.replaceAll('_', ' ').toLowerCase();

type TimelineEvent = {
  key: string;
  label: string;
  timestamp: string | null;
  note: string | null;
};

const buildTimelineEvents = (
  delivery: repository.AdminDeliveryDetailRecord,
): TimelineEvent[] => {
  const events: TimelineEvent[] = [
    {
      key: 'requested',
      label: 'Delivery requested',
      timestamp: delivery.requestedAt.toISOString(),
      note: delivery.learnerNote,
    },
    {
      key: 'assigned',
      label: 'Driver accepted',
      timestamp: delivery.assignedAt?.toISOString() ?? null,
      note: null,
    },
    {
      key: 'arrived_pickup',
      label: 'Driver arrived at pickup location',
      timestamp: delivery.arrivedPickupAt?.toISOString() ?? null,
      note: null,
    },
    {
      key: 'picked_up',
      label: 'Driver picked up material',
      timestamp: delivery.pickedUpAt?.toISOString() ?? null,
      note: null,
    },
    {
      key: 'on_the_way',
      label: 'Driver started route / left pickup',
      timestamp: delivery.onTheWayAt?.toISOString() ?? null,
      note: delivery.driverNote,
    },
    {
      key: 'arrived_dropoff',
      label: 'Driver arrived at dropoff',
      timestamp: delivery.arrivedDropoffAt?.toISOString() ?? null,
      note: null,
    },
    {
      key: 'delivered',
      label: 'Driver delivered order',
      timestamp: delivery.deliveredAt?.toISOString() ?? null,
      note: null,
    },
  ];

  if (delivery.cancelledAt) {
    events.push({
      key: 'cancelled',
      label: 'Delivery cancelled',
      timestamp: delivery.cancelledAt.toISOString(),
      note: delivery.failureReason,
    });
  }

  if (delivery.failedAt) {
    events.push({
      key: 'failed',
      label: 'Delivery failed',
      timestamp: delivery.failedAt.toISOString(),
      note: delivery.failureReason,
    });
  }

  for (const history of delivery.statusHistory) {
    events.push({
      key: `history-${history.id}`,
      label: `Status changed to ${deliveryStatusLabel(history.newStatus)}`,
      timestamp: history.createdAt.toISOString(),
      note: history.note,
    });
  }

  return events
    .filter((event) => event.timestamp != null)
    .sort((a, b) => {
      const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
      const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
      return aTime - bTime;
    });
};

type IncidentRecord = {
  id: string;
  status: string;
  reasonCode: string;
  targetRole: string;
  targetUserId: string | null;
  deliveryId: string | null;
  createdAt: Date;
  note?: string | null;
  reviewNote?: string | null;
  reviewedAt?: Date | null;
};

const mapIncidentContract = (
  delivery: {
    id: string;
    status: string;
    deliveryGroupId: string | null;
    assignedDriverProfileId: string | null;
    reservation: {
      status: string;
      fulfillmentMethod: string;
      pendingRescheduleRequestedBy: string | null;
      pendingRescheduleReason: string | null;
    };
  },
  report: IncidentRecord,
): DeliveryIncidentContract & { createdAt: Date; status: string; reasonCode: string } => {
  const contract = classifyAdminReportContract({
    report,
    reservation: delivery.reservation,
    delivery: {
      id: delivery.id,
      status: delivery.status,
      assignedDriverProfileId: delivery.assignedDriverProfileId,
      deliveryGroupId: delivery.deliveryGroupId,
    },
    isGroupedDelivery: delivery.deliveryGroupId != null,
    isGroupRecoverySupported: false,
  });
  return { id: report.id, ...contract, createdAt: report.createdAt, status: report.status, reasonCode: report.reasonCode };
};

const selectPrimaryIncident = <T extends ReturnType<typeof mapIncidentContract>>(
  reports: T[],
): T | null => {
  const ordered = [...reports].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
  );
  return (
    ordered.find((report) => report.operationalState === 'REQUIRES_RESOLUTION') ??
    ordered.find((report) => report.status === 'PENDING_REVIEW') ??
    ordered[0] ??
    null
  );
};

const mapIncidentSummary = (
  report: ReturnType<typeof mapIncidentContract> | null,
) =>
  report
    ? {
        id: report.id,
        status: report.status,
        reasonCode: report.reasonCode,
        workflowType: report.workflowType,
        operationalState: report.operationalState,
        availableActions: report.availableActions,
        createdAt: report.createdAt.toISOString(),
      }
    : null;

const mapDeliveryContract = (
  delivery: repository.AdminDeliveryListRecord | repository.AdminDeliveryDetailRecord,
  canReopenDriverAssignment: boolean,
) => {
  const incidentContracts = delivery.incidentReports.map((report) =>
    mapIncidentContract(delivery, report),
  );
  const primaryIncident = selectPrimaryIncident(incidentContracts);
  const contract = composeAdminDeliveryContract({
    delivery: {
      id: delivery.id,
      status: delivery.status,
      deliveryGroupId: delivery.deliveryGroupId,
      assignedDriverProfileId: delivery.assignedDriverProfileId,
    },
    reservation: {
      id: delivery.reservation.id,
      status: delivery.reservation.status,
      pendingRescheduleRequestedBy: delivery.reservation.pendingRescheduleRequestedBy,
      pendingRescheduleReason: delivery.reservation.pendingRescheduleReason,
    },
    primaryIncident,
    hasExpectedRecoveryIncident:
      !['AWAITING_RESOLUTION', 'DRIVER_NO_SHOW', 'FAILED_PICKUP'].includes(delivery.status) ||
      delivery._count.incidentReports > 0,
    canReopenDriverAssignment,
    assignments: delivery.assignments.map((assignment) => ({
      id: assignment.id,
      status: assignment.status,
      acceptedAt: assignment.acceptedAt,
      releasedAt: assignment.releasedAt,
      driver: assignment.driverProfile
        ? {
            id: assignment.driverProfile.id,
            displayName: assignment.driverProfile.displayName,
            email: assignment.driverProfile.user.email,
          }
        : null,
    })),
  });

  return { contract, primaryIncident, incidentContracts };
};

const mapListItem = (delivery: repository.AdminDeliveryListRecord) => {
  const canReopen =
    delivery.status === 'DRIVER_ASSIGNED' &&
    delivery.assignedDriverProfileId != null &&
    delivery.deliveryGroupId == null &&
    delivery.assignments.some(
      (assignment) =>
        assignment.status === 'ACTIVE' &&
        assignment.driverProfile.id === delivery.assignedDriverProfileId,
    );
  const { contract, primaryIncident } = mapDeliveryContract(delivery, canReopen);
  return {
  id: delivery.id,
  status: delivery.status,
  requestedAt: delivery.requestedAt.toISOString(),
  assignedAt: delivery.assignedAt?.toISOString() ?? null,
  pickedUpAt: delivery.pickedUpAt?.toISOString() ?? null,
  deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
  reservation: {
    id: delivery.reservation.id,
    materialTitle: delivery.reservation.material.title,
  },
  material: {
    id: delivery.reservation.material.id,
    title: delivery.reservation.material.title,
  },
  learner: {
    id: delivery.reservation.requester.id,
    displayName: delivery.reservation.requester.displayName,
    email: delivery.reservation.requester.email,
  },
  supplier: {
    id: delivery.reservation.owner.id,
    displayName: resolveSupplierDisplayName(delivery.reservation.owner),
    email: delivery.reservation.owner.email,
  },
  driver: delivery.assignedDriverProfile
    ? {
        id: delivery.assignedDriverProfile.id,
        displayName: delivery.assignedDriverProfile.displayName,
        email: delivery.assignedDriverProfile.user.email,
      }
    : null,
  pickupArea: formatLocationLabel(delivery.pickupLocation),
  dropoffArea: formatLocationLabel(delivery.dropoffLocation),
  ...contract,
  primaryIncidentSummary: mapIncidentSummary(primaryIncident),
  incidentCount: delivery._count.incidentReports,
  hasAdditionalIncidents: delivery._count.incidentReports > 1,
  group: delivery.deliveryGroup
    ? {
        id: delivery.deliveryGroup.id,
        status: delivery.deliveryGroup.status,
        reservationCount: delivery.deliveryGroup._count.reservations,
        reservations: delivery.deliveryGroup.reservations,
        hasMoreReservations: delivery.deliveryGroup._count.reservations > delivery.deliveryGroup.reservations.length,
      }
    : null,
  };
};

const decimalToNumber = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value != null && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const mapLocationDetail = (
  location: repository.AdminDeliveryDetailRecord['pickupLocation'],
) => ({
  label: formatLocationLabel(location),
  country: location.country,
  city: location.city,
  area: location.area,
  addressLine: location.addressLine,
  latitude: decimalToNumber(location.latitude),
  longitude: decimalToNumber(location.longitude),
  isApproximate: location.isApproximate,
});

const canReopenDriverAssignment = (
  delivery: repository.AdminDeliveryDetailRecord,
) =>
  delivery.status === 'DRIVER_ASSIGNED' &&
  delivery.assignedDriverProfile != null &&
  !repository.hasPickupStarted(delivery) &&
  (!delivery.deliveryGroup ||
    (delivery.deliveryGroup.status === 'ASSIGNED' &&
      delivery.deliveryGroup.assignedDriverProfileId ===
        delivery.assignedDriverProfileId &&
      !delivery.deliveryGroup.reservations.some(
        (reservation) =>
          reservation.fulfillmentMethod === 'DELIVERY' &&
          reservation.status !== 'ACCEPTED',
      )));

const mapDetail = (delivery: repository.AdminDeliveryDetailRecord) => {
  const canReopen = canReopenDriverAssignment(delivery);
  const { contract, primaryIncident, incidentContracts } = mapDeliveryContract(
    delivery,
    canReopen,
  );
  const locationPings = delivery.locationPings.map((ping) => ({
    id: ping.id,
    capturedAt: ping.capturedAt.toISOString(),
    latitude: decimalToNumber(ping.latitude),
    longitude: decimalToNumber(ping.longitude),
    accuracyMeters: decimalToNumber(ping.accuracyMeters),
  }));

  return {
    id: delivery.id,
    status: delivery.status,
    requestedAt: delivery.requestedAt.toISOString(),
    assignedAt: delivery.assignedAt?.toISOString() ?? null,
    arrivedPickupAt: delivery.arrivedPickupAt?.toISOString() ?? null,
    pickedUpAt: delivery.pickedUpAt?.toISOString() ?? null,
    onTheWayAt: delivery.onTheWayAt?.toISOString() ?? null,
    arrivedDropoffAt: delivery.arrivedDropoffAt?.toISOString() ?? null,
    deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    cancelledAt: delivery.cancelledAt?.toISOString() ?? null,
    failedAt: delivery.failedAt?.toISOString() ?? null,
    learnerNote: delivery.learnerNote,
    driverNote: delivery.driverNote,
    failureReason: delivery.failureReason,
    canReopenDriverAssignment: canReopen,
    ...contract,
    reservation: {
      id: delivery.reservation.id,
      status: delivery.reservation.status,
      quantityRequested: Number(delivery.reservation.quantityRequested),
      unit: delivery.reservation.material.unit,
      pickupWindowStart:
        delivery.reservation.pickupWindowStart?.toISOString() ?? null,
      pickupWindowEnd:
        delivery.reservation.pickupWindowEnd?.toISOString() ?? null,
      supplierNote: delivery.reservation.supplierNote,
    },
    material: {
      id: delivery.reservation.material.id,
      title: delivery.reservation.material.title,
    },
    learner: {
      id: delivery.reservation.requester.id,
      displayName: delivery.reservation.requester.displayName,
      email: delivery.reservation.requester.email,
      phone: delivery.reservation.requester.phone,
    },
    supplier: {
      id: delivery.reservation.owner.id,
      displayName: resolveSupplierDisplayName(delivery.reservation.owner),
      email: delivery.reservation.owner.email,
    },
    driver: delivery.assignedDriverProfile
      ? {
          id: delivery.assignedDriverProfile.id,
          displayName: delivery.assignedDriverProfile.displayName,
          email: delivery.assignedDriverProfile.user.email,
          phone: delivery.assignedDriverProfile.phone,
          acceptedAt:
            delivery.assignments.find(
              (assignment) =>
                assignment.status === 'ACTIVE' &&
                assignment.driverProfile.id === delivery.assignedDriverProfile?.id,
            )?.acceptedAt?.toISOString() ?? null,
        }
      : null,
    pickup: {
      supplierName: resolveSupplierDisplayName(delivery.reservation.owner),
      location: mapLocationDetail(delivery.pickupLocation),
      pickupWindowStart:
        delivery.reservation.pickupWindowStart?.toISOString() ?? null,
      pickupWindowEnd:
        delivery.reservation.pickupWindowEnd?.toISOString() ?? null,
      supplierNote: delivery.reservation.supplierNote,
      arrivedAt: delivery.arrivedPickupAt?.toISOString() ?? null,
      pickedUpAt: delivery.pickedUpAt?.toISOString() ?? null,
    },
    dropoff: {
      learnerName: delivery.reservation.requester.displayName,
      location: mapLocationDetail(delivery.dropoffLocation),
      deliveryNotes: delivery.learnerNote,
      arrivedAt: delivery.arrivedDropoffAt?.toISOString() ?? null,
      deliveredAt: delivery.deliveredAt?.toISOString() ?? null,
    },
    timeline: buildTimelineEvents(delivery),
    locationHistory: {
      count: locationPings.length,
      items: locationPings,
    },
    currentDriver: contract.assignmentState === 'ACTIVE' && delivery.assignedDriverProfile
      ? {
          id: delivery.assignedDriverProfile.id,
          displayName: delivery.assignedDriverProfile.displayName,
          email: delivery.assignedDriverProfile.user.email,
        }
      : null,
    lastAssignedDriver: delivery.assignments[0]?.driverProfile
      ? {
          id: delivery.assignments[0].driverProfile.id,
          displayName: delivery.assignments[0].driverProfile.displayName,
          email: delivery.assignments[0].driverProfile.user.email,
        }
      : null,
    currentAssignment: contract.assignmentState === 'ACTIVE'
      ? delivery.assignments.find((assignment) => assignment.status === 'ACTIVE')
      : null,
    lastAssignment: delivery.assignments[0] ?? null,
    assignmentHistory: delivery.assignments,
    primaryIncident: mapIncidentSummary(primaryIncident),
    incidentCount: delivery._count.incidentReports,
    linkedIncidents: incidentContracts.map(mapIncidentSummary),
    hasMoreLinkedIncidents: delivery._count.incidentReports > incidentContracts.length,
    group: delivery.deliveryGroup
      ? {
          id: delivery.deliveryGroup.id,
          status: delivery.deliveryGroup.status,
          reservationCount: delivery.deliveryGroup._count.reservations,
          reservations: delivery.deliveryGroup.reservations,
          hasMoreReservations:
            delivery.deliveryGroup._count.reservations >
            delivery.deliveryGroup.reservations.length,
        }
      : null,
  };
};

export const listAdminDeliveries = async (query: AdminDeliveriesListQuery) => {
  const [summary, result] = await Promise.all([
    repository.countAdminDeliveriesSummary(),
    repository.listAdminDeliveries(query),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / query.limit));

  return {
    summary,
    items: result.items.map(mapListItem),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages,
    },
    filterOptions: {
      statuses: [
        'WAITING_FOR_DRIVER',
        'DRIVER_ASSIGNED',
        'ARRIVED_PICKUP',
        'PICKED_UP',
        'ON_THE_WAY',
        'ARRIVED_DROPOFF',
        'DELIVERED',
        'CANCELLED',
        'FAILED_PICKUP',
        'FAILED_DELIVERY',
        'DRIVER_NO_SHOW',
        'LEARNER_NO_SHOW',
        'AWAITING_RESOLUTION',
      ],
      assignmentStates: ['UNASSIGNED', 'ACTIVE', 'RELEASED', 'HISTORICAL'],
      scopes: ['SINGLE', 'GROUPED'],
      incidentStates: ['PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'RESOLVED_NO_STRIKE'],
    },
  };
};

export const getAdminDeliveryById = async (id: string) => {
  const delivery = await repository.findAdminDeliveryById(id);
  if (!delivery) {
    throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
  }

  return mapDetail(delivery);
};

export const reopenAdminDeliveryDriverAssignment = async (
  deliveryId: string,
  adminUserId: string,
) => {
  const result = await repository.reopenDriverAssignmentForAdmin({
    deliveryId,
    adminUserId,
  });

  switch (result.outcome) {
    case 'REOPENED': {
      await notifyDriverDeliveryUnassignedByAdmin({
        deliveryId: result.deliveryId,
        driverUserId: result.removedDriverUserId,
        materialTitle: result.materialTitle,
      });
      const delivery = await repository.findAdminDeliveryById(result.deliveryId);
      if (!delivery) {
        throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
      }
      return mapDetail(delivery);
    }
    case 'NOT_FOUND':
      throw new AppError('Delivery not found.', 404, 'NOT_FOUND');
    case 'ALREADY_WAITING':
      throw new AppError(
        'Delivery is already waiting for a driver.',
        409,
        'CONFLICT',
      );
    case 'NOT_ASSIGNED':
      throw new AppError(
        'Delivery is not currently assigned to a driver.',
        409,
        'CONFLICT',
      );
    case 'PICKUP_STARTED':
      throw new AppError(
        'Pickup has already started; this delivery cannot be reopened to drivers.',
        409,
        'CONFLICT',
      );
    case 'TERMINAL_OR_FAILED':
      throw new AppError(
        'Terminal, failed, or admin-review deliveries cannot be reopened to drivers.',
        409,
        'CONFLICT',
      );
    case 'GROUP_INCOMPATIBLE':
      throw new AppError(
        'Grouped delivery state is not eligible to reopen to drivers.',
        409,
        'CONFLICT',
      );
    case 'ACTIVE_ASSIGNMENT_MISSING':
      throw new AppError(
        'The current driver assignment is no longer active.',
        409,
        'CONFLICT',
      );
    case 'CONCURRENT_UPDATE':
      throw new AppError(
        'Delivery assignment changed. Refresh and try again.',
        409,
        'CONFLICT',
      );
  }
};
