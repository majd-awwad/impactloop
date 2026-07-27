enum DeliveryScope { single, grouped, unknown }

enum LifecyclePhase {
  waitingAssignment,
  prePickup,
  inTransit,
  completed,
  recoveryRequired,
  recoveryInProgress,
  terminalFailure,
  cancelled,
  unknown,
}

enum AdminAttentionState { none, actionRequired, waitingExternalParty, unknown }

enum AssignmentState { unassigned, active, released, historical, unknown }

enum DeliveryKpiBucket {
  waitingForDriver,
  activeInProgress,
  needsAdminReview,
  delivered,
  failedCancelled,
  unknown,
}

enum IncidentContext {
  none,
  accountability,
  systemRecovery,
  accountabilityAndRecovery,
  unknown,
}

enum DeliveryMutation { reopenDriverAssignment, unknown }

enum DeliveryLink { openIncident, openReservation, openGroup, unknown }

T _enumValue<T>(String? raw, Map<String, T> values, T unknown) =>
    values[raw] ?? unknown;

DeliveryScope _scope(String? raw) => _enumValue(raw, const {
  'SINGLE': DeliveryScope.single,
  'GROUPED': DeliveryScope.grouped,
}, DeliveryScope.unknown);
LifecyclePhase _lifecycle(String? raw) => _enumValue(raw, const {
  'WAITING_ASSIGNMENT': LifecyclePhase.waitingAssignment,
  'PRE_PICKUP': LifecyclePhase.prePickup,
  'IN_TRANSIT': LifecyclePhase.inTransit,
  'COMPLETED': LifecyclePhase.completed,
  'RECOVERY_REQUIRED': LifecyclePhase.recoveryRequired,
  'RECOVERY_IN_PROGRESS': LifecyclePhase.recoveryInProgress,
  'TERMINAL_FAILURE': LifecyclePhase.terminalFailure,
  'CANCELLED': LifecyclePhase.cancelled,
}, LifecyclePhase.unknown);
AdminAttentionState _attention(String? raw) => _enumValue(raw, const {
  'NONE': AdminAttentionState.none,
  'ACTION_REQUIRED': AdminAttentionState.actionRequired,
  'WAITING_EXTERNAL_PARTY': AdminAttentionState.waitingExternalParty,
}, AdminAttentionState.unknown);
AssignmentState _assignmentState(String? raw) => _enumValue(raw, const {
  'UNASSIGNED': AssignmentState.unassigned,
  'ACTIVE': AssignmentState.active,
  'RELEASED': AssignmentState.released,
  'HISTORICAL': AssignmentState.historical,
}, AssignmentState.unknown);
DeliveryKpiBucket _kpi(String? raw) => _enumValue(raw, const {
  'WAITING_FOR_DRIVER': DeliveryKpiBucket.waitingForDriver,
  'ACTIVE_IN_PROGRESS': DeliveryKpiBucket.activeInProgress,
  'NEEDS_ADMIN_REVIEW': DeliveryKpiBucket.needsAdminReview,
  'DELIVERED': DeliveryKpiBucket.delivered,
  'FAILED_CANCELLED': DeliveryKpiBucket.failedCancelled,
}, DeliveryKpiBucket.unknown);
DeliveryMutation _mutation(String raw) => _enumValue(raw, const {
  'REOPEN_DRIVER_ASSIGNMENT': DeliveryMutation.reopenDriverAssignment,
}, DeliveryMutation.unknown);
DeliveryLink _link(String raw) => _enumValue(raw, const {
  'OPEN_INCIDENT': DeliveryLink.openIncident,
  'OPEN_RESERVATION': DeliveryLink.openReservation,
  'OPEN_GROUP': DeliveryLink.openGroup,
}, DeliveryLink.unknown);

List<String> _strings(Object? value) => (value as List<dynamic>? ?? const [])
    .map((item) => item.toString())
    .toList(growable: false);

class AdminDeliveriesSummary {
  const AdminDeliveriesSummary({
    required this.total,
    required this.waitingForDriver,
    required this.activeInProgress,
    required this.needsAdminReview,
    required this.delivered,
    required this.failedCancelled,
  });

  final int total;
  final int waitingForDriver;
  final int activeInProgress;
  final int needsAdminReview;
  final int delivered;
  final int failedCancelled;

  // Temporary aliases keep existing presentation code compatible.
  int get pendingUnassigned => waitingForDriver;
  int get assignedInProgress => activeInProgress;

  factory AdminDeliveriesSummary.fromJson(Map<String, dynamic> json) {
    return AdminDeliveriesSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      waitingForDriver:
          (json['waitingForDriver'] as num?)?.toInt() ??
          (json['pendingUnassigned'] as num?)?.toInt() ??
          0,
      activeInProgress:
          (json['activeInProgress'] as num?)?.toInt() ??
          (json['assignedInProgress'] as num?)?.toInt() ??
          0,
      needsAdminReview: (json['needsAdminReview'] as num?)?.toInt() ?? 0,
      delivered: (json['delivered'] as num?)?.toInt() ?? 0,
      failedCancelled: (json['failedCancelled'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminDeliveryPerson {
  const AdminDeliveryPerson({
    required this.id,
    required this.displayName,
    required this.email,
    this.phone,
    this.acceptedAt,
  });

  final String id;
  final String displayName;
  final String email;
  final String? phone;
  final String? acceptedAt;

  factory AdminDeliveryPerson.fromJson(Map<String, dynamic> json) {
    return AdminDeliveryPerson(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
      acceptedAt: json['acceptedAt'] as String?,
    );
  }
}

class AdminDeliveryIncidentSummary {
  const AdminDeliveryIncidentSummary({
    required this.id,
    required this.status,
    required this.reasonCode,
    required this.workflowType,
    required this.operationalState,
    required this.availableActions,
    this.createdAt,
  });
  final String id;
  final String status;
  final String reasonCode;
  final String workflowType;
  final String operationalState;
  final List<String> availableActions;
  final String? createdAt;
  factory AdminDeliveryIncidentSummary.fromJson(Map<String, dynamic> json) =>
      AdminDeliveryIncidentSummary(
        id: json['id'] as String? ?? '',
        status: json['status'] as String? ?? '',
        reasonCode: json['reasonCode'] as String? ?? '',
        workflowType: json['workflowType'] as String? ?? '',
        operationalState: json['operationalState'] as String? ?? '',
        availableActions: _strings(json['availableActions']),
        createdAt: json['createdAt'] as String?,
      );
}

class AdminDeliveryAssignment {
  const AdminDeliveryAssignment({
    required this.id,
    required this.status,
    this.driver,
    this.acceptedAt,
    this.releasedAt,
    this.releaseReason,
  });
  final String id;
  final String status;
  final AdminDeliveryPerson? driver;
  final String? acceptedAt;
  final String? releasedAt;
  final String? releaseReason;
  factory AdminDeliveryAssignment.fromJson(Map<String, dynamic> json) =>
      AdminDeliveryAssignment(
        id: json['id'] as String? ?? '',
        status: json['status'] as String? ?? '',
        driver: json['driver'] is Map<String, dynamic>
            ? AdminDeliveryPerson.fromJson(
                json['driver'] as Map<String, dynamic>,
              )
            : null,
        acceptedAt: json['acceptedAt'] as String?,
        releasedAt: json['releasedAt'] as String?,
        releaseReason: json['releaseReason'] as String?,
      );
}

class AdminDeliveryGroupSummary {
  const AdminDeliveryGroupSummary({
    required this.id,
    required this.status,
    required this.reservationCount,
    required this.reservations,
    required this.hasMoreReservations,
    this.items = const [],
    this.itemCount = 0,
    this.hasMoreItems = false,
  });
  final String id;
  final String status;
  final int reservationCount;
  final List<AdminDeliveryReservationPreview> reservations;
  final bool hasMoreReservations;
  final List<AdminDeliveryGroupItem> items;
  final int itemCount;
  final bool hasMoreItems;
  factory AdminDeliveryGroupSummary.fromJson(Map<String, dynamic> json) =>
      AdminDeliveryGroupSummary(
        id: json['id'] as String? ?? '',
        status: json['status'] as String? ?? '',
        reservationCount: (json['reservationCount'] as num?)?.toInt() ?? 0,
        reservations: (json['reservations'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(AdminDeliveryReservationPreview.fromJson)
            .toList(growable: false),
        hasMoreReservations: json['hasMoreReservations'] as bool? ?? false,
        items: (json['items'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(AdminDeliveryGroupItem.fromJson)
            .toList(growable: false),
        itemCount:
            (json['itemCount'] as num?)?.toInt() ??
            (json['reservationCount'] as num?)?.toInt() ??
            0,
        hasMoreItems:
            json['hasMoreItems'] as bool? ??
            json['hasMoreReservations'] as bool? ??
            false,
      );
}

class AdminDeliveryGroupItem {
  const AdminDeliveryGroupItem({
    required this.reservationId,
    required this.status,
    this.materialTitle,
    this.quantity,
    this.unit,
    this.learnerName,
  });

  final String reservationId;
  final String status;
  final String? materialTitle;
  final num? quantity;
  final String? unit;
  final String? learnerName;

  factory AdminDeliveryGroupItem.fromJson(Map<String, dynamic> json) =>
      AdminDeliveryGroupItem(
        reservationId:
            json['reservationId'] as String? ?? json['id'] as String? ?? '',
        status: json['status'] as String? ?? '',
        materialTitle:
            json['materialTitle'] as String? ??
            (json['material'] as Map<String, dynamic>?)?['title'] as String?,
        quantity: json['quantity'] as num? ?? json['quantityRequested'] as num?,
        unit: json['unit'] as String?,
        learnerName:
            json['learnerName'] as String? ??
            (json['learner'] as Map<String, dynamic>?)?['displayName']
                as String?,
      );
}

class AdminDeliveryReservationPreview {
  const AdminDeliveryReservationPreview({
    required this.id,
    required this.status,
  });
  final String id;
  final String status;
  factory AdminDeliveryReservationPreview.fromJson(Map<String, dynamic> json) =>
      AdminDeliveryReservationPreview(
        id: json['id'] as String? ?? '',
        status: json['status'] as String? ?? '',
      );
}

class AdminDeliveryListItem {
  const AdminDeliveryListItem({
    required this.id,
    required this.status,
    required this.requestedAt,
    required this.material,
    required this.learner,
    required this.supplier,
    required this.reservationId,
    this.assignedAt,
    this.pickedUpAt,
    this.deliveredAt,
    this.driver,
    this.currentDriver,
    this.lastAssignedDriver,
    this.pickupArea,
    this.dropoffArea,
    this.itemCount = 1,
    this.hasMoreItems = false,
    required this.scope,
    required this.lifecyclePhase,
    required this.adminAttentionState,
    required this.assignmentState,
    required this.kpiBucket,
    required this.availableMutations,
    required this.availableLinks,
    required this.availableMutationRawValues,
    required this.availableLinkRawValues,
    this.primaryIncidentSummary,
    this.incidentCount = 0,
    this.hasAdditionalIncidents = false,
    this.group,
  });

  final String id;
  final String status;
  final String requestedAt;
  final String? assignedAt;
  final String? pickedUpAt;
  final String? deliveredAt;
  final String reservationId;
  final AdminDeliveryMaterialSummary material;
  final AdminDeliveryPerson learner;
  final AdminDeliveryPerson supplier;

  /// Legacy compatibility field. Never use this to present current assignment.
  final AdminDeliveryPerson? driver;
  final AdminDeliveryPerson? currentDriver;
  final AdminDeliveryPerson? lastAssignedDriver;
  final String? pickupArea;
  final String? dropoffArea;
  final int itemCount;
  final bool hasMoreItems;
  final DeliveryScope scope;
  final LifecyclePhase lifecyclePhase;
  final AdminAttentionState adminAttentionState;
  final AssignmentState assignmentState;
  final DeliveryKpiBucket kpiBucket;
  final List<DeliveryMutation> availableMutations;
  final List<DeliveryLink> availableLinks;
  final List<String> availableMutationRawValues;
  final List<String> availableLinkRawValues;
  final AdminDeliveryIncidentSummary? primaryIncidentSummary;
  final int incidentCount;
  final bool hasAdditionalIncidents;
  final AdminDeliveryGroupSummary? group;

  factory AdminDeliveryListItem.fromJson(Map<String, dynamic> json) {
    final reservation =
        json['reservation'] as Map<String, dynamic>? ?? const {};
    final mutationValues = _strings(json['availableMutations']);
    final linkValues = _strings(json['availableLinks']);
    return AdminDeliveryListItem(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      requestedAt: json['requestedAt'] as String? ?? '',
      assignedAt: json['assignedAt'] as String?,
      pickedUpAt: json['pickedUpAt'] as String?,
      deliveredAt: json['deliveredAt'] as String?,
      reservationId: reservation['id'] as String? ?? '',
      material: AdminDeliveryMaterialSummary.fromJson(
        json['material'] as Map<String, dynamic>? ?? const {},
      ),
      learner: AdminDeliveryPerson.fromJson(
        json['learner'] as Map<String, dynamic>? ?? const {},
      ),
      supplier: AdminDeliveryPerson.fromJson(
        json['supplier'] as Map<String, dynamic>? ?? const {},
      ),
      driver: json['driver'] is Map<String, dynamic>
          ? AdminDeliveryPerson.fromJson(json['driver'] as Map<String, dynamic>)
          : null,
      currentDriver: json['currentDriver'] is Map<String, dynamic>
          ? AdminDeliveryPerson.fromJson(
              json['currentDriver'] as Map<String, dynamic>,
            )
          : null,
      lastAssignedDriver: json['lastAssignedDriver'] is Map<String, dynamic>
          ? AdminDeliveryPerson.fromJson(
              json['lastAssignedDriver'] as Map<String, dynamic>,
            )
          : null,
      pickupArea: json['pickupArea'] as String?,
      dropoffArea: json['dropoffArea'] as String?,
      itemCount: (json['itemCount'] as num?)?.toInt() ?? 1,
      hasMoreItems: json['hasMoreItems'] as bool? ?? false,
      scope: _scope(json['scope'] as String?),
      lifecyclePhase: _lifecycle(json['lifecyclePhase'] as String?),
      adminAttentionState: _attention(json['adminAttentionState'] as String?),
      assignmentState: _assignmentState(json['assignmentState'] as String?),
      kpiBucket: _kpi(json['kpiBucket'] as String?),
      availableMutations: mutationValues.map(_mutation).toList(growable: false),
      availableLinks: linkValues.map(_link).toList(growable: false),
      availableMutationRawValues: mutationValues,
      availableLinkRawValues: linkValues,
      primaryIncidentSummary:
          json['primaryIncidentSummary'] is Map<String, dynamic>
          ? AdminDeliveryIncidentSummary.fromJson(
              json['primaryIncidentSummary'] as Map<String, dynamic>,
            )
          : null,
      incidentCount: (json['incidentCount'] as num?)?.toInt() ?? 0,
      hasAdditionalIncidents: json['hasAdditionalIncidents'] as bool? ?? false,
      group: json['group'] is Map<String, dynamic>
          ? AdminDeliveryGroupSummary.fromJson(
              json['group'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class AdminDeliveryMaterialSummary {
  const AdminDeliveryMaterialSummary({required this.id, required this.title});

  final String id;
  final String title;

  factory AdminDeliveryMaterialSummary.fromJson(Map<String, dynamic> json) {
    return AdminDeliveryMaterialSummary(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
    );
  }
}

class AdminDeliveryTimelineItem {
  const AdminDeliveryTimelineItem({
    required this.key,
    required this.label,
    required this.timestamp,
    this.note,
  });

  final String key;
  final String label;
  final String? timestamp;
  final String? note;

  factory AdminDeliveryTimelineItem.fromJson(Map<String, dynamic> json) {
    return AdminDeliveryTimelineItem(
      key: json['key'] as String? ?? '',
      label: json['label'] as String? ?? '',
      timestamp: json['timestamp'] as String?,
      note: json['note'] as String?,
    );
  }
}

class AdminDeliveryLocationPing {
  const AdminDeliveryLocationPing({
    required this.id,
    required this.capturedAt,
    this.latitude,
    this.longitude,
    this.accuracyMeters,
  });

  final String id;
  final String capturedAt;
  final num? latitude;
  final num? longitude;
  final num? accuracyMeters;

  factory AdminDeliveryLocationPing.fromJson(Map<String, dynamic> json) {
    return AdminDeliveryLocationPing(
      id: json['id'] as String? ?? '',
      capturedAt: json['capturedAt'] as String? ?? '',
      latitude: json['latitude'] as num?,
      longitude: json['longitude'] as num?,
      accuracyMeters: json['accuracyMeters'] as num?,
    );
  }
}

class AdminDeliveryLocationHistory {
  const AdminDeliveryLocationHistory({
    required this.count,
    required this.items,
  });

  final int count;
  final List<AdminDeliveryLocationPing> items;

  factory AdminDeliveryLocationHistory.fromJson(Map<String, dynamic> json) {
    return AdminDeliveryLocationHistory(
      count: (json['count'] as num?)?.toInt() ?? 0,
      items: (json['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AdminDeliveryLocationPing.fromJson)
          .toList(),
    );
  }
}

class AdminDeliveryTracking {
  const AdminDeliveryTracking({
    this.availability,
    this.locationPings = const [],
    this.isLiveTracking,
    this.isBackgroundTracking,
    this.eta,
  });

  final String? availability;
  final List<AdminDeliveryLocationPing> locationPings;
  final bool? isLiveTracking;
  final bool? isBackgroundTracking;
  final String? eta;

  factory AdminDeliveryTracking.fromJson(Map<String, dynamic> json) =>
      AdminDeliveryTracking(
        availability: json['availability'] as String?,
        locationPings: (json['locationPings'] as List<dynamic>? ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(AdminDeliveryLocationPing.fromJson)
            .toList(growable: false),
        isLiveTracking: json['isLiveTracking'] as bool?,
        isBackgroundTracking: json['isBackgroundTracking'] as bool?,
        eta: json['eta'] as String?,
      );
}

class AdminDeliveryLocationDetail {
  const AdminDeliveryLocationDetail({
    this.label,
    this.country,
    this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.isApproximate,
  });

  final String? label;
  final String? country;
  final String? city;
  final String? area;
  final String? addressLine;
  final num? latitude;
  final num? longitude;
  final bool? isApproximate;

  factory AdminDeliveryLocationDetail.fromJson(Map<String, dynamic> json) {
    return AdminDeliveryLocationDetail(
      label: json['label'] as String?,
      country: json['country'] as String?,
      city: json['city'] as String?,
      area: json['area'] as String?,
      addressLine: json['addressLine'] as String?,
      latitude: json['latitude'] as num?,
      longitude: json['longitude'] as num?,
      isApproximate: json['isApproximate'] as bool?,
    );
  }
}

class AdminDeliveryDetail {
  const AdminDeliveryDetail({
    required this.id,
    required this.status,
    required this.requestedAt,
    required this.reservation,
    required this.material,
    required this.learner,
    required this.supplier,
    required this.pickup,
    required this.dropoff,
    required this.timeline,
    required this.locationHistory,
    required this.canReopenDriverAssignment,
    this.assignedAt,
    this.arrivedPickupAt,
    this.pickedUpAt,
    this.onTheWayAt,
    this.arrivedDropoffAt,
    this.deliveredAt,
    this.cancelledAt,
    this.failedAt,
    this.learnerNote,
    this.driverNote,
    this.failureReason,
    this.driver,
    required this.scope,
    required this.lifecyclePhase,
    required this.adminAttentionState,
    required this.assignmentState,
    required this.kpiBucket,
    required this.availableMutations,
    required this.availableLinks,
    required this.availableMutationRawValues,
    required this.availableLinkRawValues,
    required this.assignmentHistory,
    this.currentDriver,
    this.lastAssignedDriver,
    this.currentAssignment,
    this.lastAssignment,
    this.primaryIncident,
    this.linkedIncidents = const [],
    this.incidentCount = 0,
    this.hasMoreLinkedIncidents = false,
    this.group,
    this.tracking,
  });

  final String id;
  final String status;
  final String requestedAt;
  final String? assignedAt;
  final String? arrivedPickupAt;
  final String? pickedUpAt;
  final String? onTheWayAt;
  final String? arrivedDropoffAt;
  final String? deliveredAt;
  final String? cancelledAt;
  final String? failedAt;
  final String? learnerNote;
  final String? driverNote;
  final String? failureReason;
  final AdminDeliveryReservationSummary reservation;
  final AdminDeliveryMaterialSummary material;
  final AdminDeliveryPerson learner;
  final AdminDeliveryPerson supplier;
  final AdminDeliveryPerson? driver;
  final DeliveryScope scope;
  final LifecyclePhase lifecyclePhase;
  final AdminAttentionState adminAttentionState;
  final AssignmentState assignmentState;
  final DeliveryKpiBucket kpiBucket;
  final List<DeliveryMutation> availableMutations;
  final List<DeliveryLink> availableLinks;
  final List<String> availableMutationRawValues;
  final List<String> availableLinkRawValues;
  final AdminDeliveryPerson? currentDriver;
  final AdminDeliveryPerson? lastAssignedDriver;
  final AdminDeliveryAssignment? currentAssignment;
  final AdminDeliveryAssignment? lastAssignment;
  final List<AdminDeliveryAssignment> assignmentHistory;
  final AdminDeliveryIncidentSummary? primaryIncident;
  final List<AdminDeliveryIncidentSummary> linkedIncidents;
  final int incidentCount;
  final bool hasMoreLinkedIncidents;
  final AdminDeliveryGroupSummary? group;
  final AdminDeliveryTracking? tracking;
  final AdminDeliveryPickupDetail pickup;
  final AdminDeliveryDropoffDetail dropoff;
  final List<AdminDeliveryTimelineItem> timeline;
  final AdminDeliveryLocationHistory locationHistory;
  final bool canReopenDriverAssignment;

  bool get canShowReopenDriverAssignmentAction =>
      canReopenDriverAssignment &&
      status == 'DRIVER_ASSIGNED' &&
      driver != null;

  factory AdminDeliveryDetail.fromJson(Map<String, dynamic> json) {
    final mutationValues = _strings(json['availableMutations']);
    final linkValues = _strings(json['availableLinks']);
    return AdminDeliveryDetail(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      requestedAt: json['requestedAt'] as String? ?? '',
      assignedAt: json['assignedAt'] as String?,
      arrivedPickupAt: json['arrivedPickupAt'] as String?,
      pickedUpAt: json['pickedUpAt'] as String?,
      onTheWayAt: json['onTheWayAt'] as String?,
      arrivedDropoffAt: json['arrivedDropoffAt'] as String?,
      deliveredAt: json['deliveredAt'] as String?,
      cancelledAt: json['cancelledAt'] as String?,
      failedAt: json['failedAt'] as String?,
      learnerNote: json['learnerNote'] as String?,
      driverNote: json['driverNote'] as String?,
      failureReason: json['failureReason'] as String?,
      reservation: AdminDeliveryReservationSummary.fromJson(
        json['reservation'] as Map<String, dynamic>? ?? const {},
      ),
      material: AdminDeliveryMaterialSummary.fromJson(
        json['material'] as Map<String, dynamic>? ?? const {},
      ),
      learner: AdminDeliveryPerson.fromJson(
        json['learner'] as Map<String, dynamic>? ?? const {},
      ),
      supplier: AdminDeliveryPerson.fromJson(
        json['supplier'] as Map<String, dynamic>? ?? const {},
      ),
      driver: json['driver'] is Map<String, dynamic>
          ? AdminDeliveryPerson.fromJson(json['driver'] as Map<String, dynamic>)
          : null,
      pickup: AdminDeliveryPickupDetail.fromJson(
        json['pickup'] as Map<String, dynamic>? ?? const {},
      ),
      dropoff: AdminDeliveryDropoffDetail.fromJson(
        json['dropoff'] as Map<String, dynamic>? ?? const {},
      ),
      timeline: (json['timeline'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AdminDeliveryTimelineItem.fromJson)
          .toList(),
      locationHistory: AdminDeliveryLocationHistory.fromJson(
        json['locationHistory'] as Map<String, dynamic>? ?? const {},
      ),
      canReopenDriverAssignment:
          json['canReopenDriverAssignment'] as bool? ?? false,
      scope: _scope(json['scope'] as String?),
      lifecyclePhase: _lifecycle(json['lifecyclePhase'] as String?),
      adminAttentionState: _attention(json['adminAttentionState'] as String?),
      assignmentState: _assignmentState(json['assignmentState'] as String?),
      kpiBucket: _kpi(json['kpiBucket'] as String?),
      availableMutations: mutationValues.map(_mutation).toList(growable: false),
      availableLinks: linkValues.map(_link).toList(growable: false),
      availableMutationRawValues: mutationValues,
      availableLinkRawValues: linkValues,
      currentDriver: json['currentDriver'] is Map<String, dynamic>
          ? AdminDeliveryPerson.fromJson(
              json['currentDriver'] as Map<String, dynamic>,
            )
          : null,
      lastAssignedDriver: json['lastAssignedDriver'] is Map<String, dynamic>
          ? AdminDeliveryPerson.fromJson(
              json['lastAssignedDriver'] as Map<String, dynamic>,
            )
          : null,
      currentAssignment: json['currentAssignment'] is Map<String, dynamic>
          ? AdminDeliveryAssignment.fromJson(
              json['currentAssignment'] as Map<String, dynamic>,
            )
          : null,
      lastAssignment: json['lastAssignment'] is Map<String, dynamic>
          ? AdminDeliveryAssignment.fromJson(
              json['lastAssignment'] as Map<String, dynamic>,
            )
          : null,
      assignmentHistory:
          (json['assignmentHistory'] as List<dynamic>? ?? const [])
              .whereType<Map<String, dynamic>>()
              .map(AdminDeliveryAssignment.fromJson)
              .toList(growable: false),
      primaryIncident: json['primaryIncident'] is Map<String, dynamic>
          ? AdminDeliveryIncidentSummary.fromJson(
              json['primaryIncident'] as Map<String, dynamic>,
            )
          : null,
      linkedIncidents: (json['linkedIncidents'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AdminDeliveryIncidentSummary.fromJson)
          .toList(growable: false),
      incidentCount: (json['incidentCount'] as num?)?.toInt() ?? 0,
      hasMoreLinkedIncidents: json['hasMoreLinkedIncidents'] as bool? ?? false,
      group: json['group'] is Map<String, dynamic>
          ? AdminDeliveryGroupSummary.fromJson(
              json['group'] as Map<String, dynamic>,
            )
          : null,
      tracking: json['tracking'] is Map<String, dynamic>
          ? AdminDeliveryTracking.fromJson(
              json['tracking'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class AdminDeliveryReservationSummary {
  const AdminDeliveryReservationSummary({
    required this.id,
    required this.status,
    required this.quantityRequested,
    required this.unit,
    this.pickupWindowStart,
    this.pickupWindowEnd,
    this.supplierNote,
  });

  final String id;
  final String status;
  final num quantityRequested;
  final String unit;
  final String? pickupWindowStart;
  final String? pickupWindowEnd;
  final String? supplierNote;

  factory AdminDeliveryReservationSummary.fromJson(Map<String, dynamic> json) {
    return AdminDeliveryReservationSummary(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      quantityRequested: json['quantityRequested'] as num? ?? 0,
      unit: json['unit'] as String? ?? '',
      pickupWindowStart: json['pickupWindowStart'] as String?,
      pickupWindowEnd: json['pickupWindowEnd'] as String?,
      supplierNote: json['supplierNote'] as String?,
    );
  }
}

class AdminDeliveryPickupDetail {
  const AdminDeliveryPickupDetail({
    required this.location,
    this.supplierName,
    this.pickupWindowStart,
    this.pickupWindowEnd,
    this.supplierNote,
    this.arrivedAt,
    this.pickedUpAt,
  });

  final String? supplierName;
  final AdminDeliveryLocationDetail location;
  final String? pickupWindowStart;
  final String? pickupWindowEnd;
  final String? supplierNote;
  final String? arrivedAt;
  final String? pickedUpAt;

  factory AdminDeliveryPickupDetail.fromJson(Map<String, dynamic> json) {
    return AdminDeliveryPickupDetail(
      supplierName: json['supplierName'] as String?,
      location: AdminDeliveryLocationDetail.fromJson(
        json['location'] as Map<String, dynamic>? ?? const {},
      ),
      pickupWindowStart: json['pickupWindowStart'] as String?,
      pickupWindowEnd: json['pickupWindowEnd'] as String?,
      supplierNote: json['supplierNote'] as String?,
      arrivedAt: json['arrivedAt'] as String?,
      pickedUpAt: json['pickedUpAt'] as String?,
    );
  }
}

class AdminDeliveryDropoffDetail {
  const AdminDeliveryDropoffDetail({
    required this.location,
    this.learnerName,
    this.deliveryNotes,
    this.arrivedAt,
    this.deliveredAt,
  });

  final String? learnerName;
  final AdminDeliveryLocationDetail location;
  final String? deliveryNotes;
  final String? arrivedAt;
  final String? deliveredAt;

  factory AdminDeliveryDropoffDetail.fromJson(Map<String, dynamic> json) {
    return AdminDeliveryDropoffDetail(
      learnerName: json['learnerName'] as String?,
      location: AdminDeliveryLocationDetail.fromJson(
        json['location'] as Map<String, dynamic>? ?? const {},
      ),
      deliveryNotes: json['deliveryNotes'] as String?,
      arrivedAt: json['arrivedAt'] as String?,
      deliveredAt: json['deliveredAt'] as String?,
    );
  }
}

class AdminDeliveriesPagination {
  const AdminDeliveriesPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory AdminDeliveriesPagination.fromJson(Map<String, dynamic> json) {
    return AdminDeliveriesPagination(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? 0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

class AdminDeliveriesListResponse {
  const AdminDeliveriesListResponse({
    required this.summary,
    required this.items,
    required this.pagination,
    required this.statuses,
  });

  final AdminDeliveriesSummary summary;
  final List<AdminDeliveryListItem> items;
  final AdminDeliveriesPagination pagination;
  final List<String> statuses;

  factory AdminDeliveriesListResponse.fromJson(Map<String, dynamic> json) {
    final filterOptions =
        json['filterOptions'] as Map<String, dynamic>? ?? const {};
    return AdminDeliveriesListResponse(
      summary: AdminDeliveriesSummary.fromJson(
        json['summary'] as Map<String, dynamic>? ?? const {},
      ),
      items: (json['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AdminDeliveryListItem.fromJson)
          .toList(),
      pagination: AdminDeliveriesPagination.fromJson(
        json['pagination'] as Map<String, dynamic>? ?? const {},
      ),
      statuses: (filterOptions['statuses'] as List<dynamic>? ?? const [])
          .map((value) => value.toString())
          .toList(),
    );
  }
}
