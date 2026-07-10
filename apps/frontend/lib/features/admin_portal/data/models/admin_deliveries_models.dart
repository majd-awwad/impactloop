class AdminDeliveriesSummary {
  const AdminDeliveriesSummary({
    required this.total,
    required this.pendingUnassigned,
    required this.assignedInProgress,
    required this.delivered,
    required this.failedCancelled,
  });

  final int total;
  final int pendingUnassigned;
  final int assignedInProgress;
  final int delivered;
  final int failedCancelled;

  factory AdminDeliveriesSummary.fromJson(Map<String, dynamic> json) {
    return AdminDeliveriesSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      pendingUnassigned: (json['pendingUnassigned'] as num?)?.toInt() ?? 0,
      assignedInProgress: (json['assignedInProgress'] as num?)?.toInt() ?? 0,
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
    this.pickupArea,
    this.dropoffArea,
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
  final AdminDeliveryPerson? driver;
  final String? pickupArea;
  final String? dropoffArea;

  factory AdminDeliveryListItem.fromJson(Map<String, dynamic> json) {
    final reservation = json['reservation'] as Map<String, dynamic>? ?? const {};
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
          ? AdminDeliveryPerson.fromJson(
              json['driver'] as Map<String, dynamic>,
            )
          : null,
      pickupArea: json['pickupArea'] as String?,
      dropoffArea: json['dropoffArea'] as String?,
    );
  }
}

class AdminDeliveryMaterialSummary {
  const AdminDeliveryMaterialSummary({
    required this.id,
    required this.title,
  });

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
  final AdminDeliveryPickupDetail pickup;
  final AdminDeliveryDropoffDetail dropoff;
  final List<AdminDeliveryTimelineItem> timeline;
  final AdminDeliveryLocationHistory locationHistory;
  final bool canReopenDriverAssignment;

  bool get canShowReopenDriverAssignmentAction =>
      canReopenDriverAssignment && status == 'DRIVER_ASSIGNED' && driver != null;

  factory AdminDeliveryDetail.fromJson(Map<String, dynamic> json) {
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
          ? AdminDeliveryPerson.fromJson(
              json['driver'] as Map<String, dynamic>,
            )
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
