class AdminReservationsSummary {
  const AdminReservationsSummary({
    required this.total,
    required this.pending,
    required this.acceptedActive,
    required this.completed,
    required this.withDelivery,
  });

  final int total;
  final int pending;
  final int acceptedActive;
  final int completed;
  final int withDelivery;

  factory AdminReservationsSummary.fromJson(Map<String, dynamic> json) {
    return AdminReservationsSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      pending: (json['pending'] as num?)?.toInt() ?? 0,
      acceptedActive: (json['acceptedActive'] as num?)?.toInt() ?? 0,
      completed: (json['completed'] as num?)?.toInt() ?? 0,
      withDelivery: (json['withDelivery'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminReservationPerson {
  const AdminReservationPerson({
    required this.id,
    required this.displayName,
    required this.email,
  });

  final String id;
  final String displayName;
  final String email;

  factory AdminReservationPerson.fromJson(Map<String, dynamic> json) {
    return AdminReservationPerson(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
    );
  }
}

class AdminReservationMaterialSummary {
  const AdminReservationMaterialSummary({
    required this.id,
    required this.title,
    this.imageUrl,
  });

  final String id;
  final String title;
  final String? imageUrl;

  factory AdminReservationMaterialSummary.fromJson(Map<String, dynamic> json) {
    return AdminReservationMaterialSummary(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

class AdminReservationLinkedReport {
  const AdminReservationLinkedReport({
    required this.id,
    required this.status,
    required this.reasonCode,
    required this.targetRole,
    required this.createdAt,
  });

  final String id;
  final String status;
  final String reasonCode;
  final String targetRole;
  final String createdAt;

  factory AdminReservationLinkedReport.fromJson(Map<String, dynamic> json) {
    return AdminReservationLinkedReport(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      reasonCode: json['reasonCode'] as String? ?? '',
      targetRole: json['targetRole'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class AdminReservationDeliverySummary {
  const AdminReservationDeliverySummary({
    required this.id,
    required this.status,
    required this.requestedAt,
    this.assignedAt,
    this.deliveredAt,
    this.driver,
  });

  final String id;
  final String status;
  final String requestedAt;
  final String? assignedAt;
  final String? deliveredAt;
  final AdminReservationPerson? driver;

  factory AdminReservationDeliverySummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const AdminReservationDeliverySummary(
        id: '',
        status: '',
        requestedAt: '',
      );
    }
    return AdminReservationDeliverySummary(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      requestedAt: json['requestedAt'] as String? ?? '',
      assignedAt: json['assignedAt'] as String?,
      deliveredAt: json['deliveredAt'] as String?,
      driver: json['driver'] is Map<String, dynamic>
          ? AdminReservationPerson.fromJson(
              json['driver'] as Map<String, dynamic>,
            )
          : null,
    );
  }
}

class AdminReservationListItem {
  const AdminReservationListItem({
    required this.id,
    required this.status,
    required this.quantityRequested,
    required this.unit,
    required this.createdAt,
    required this.updatedAt,
    required this.material,
    required this.learner,
    required this.supplier,
    required this.hasDelivery,
    this.pickupWindowStart,
    this.pickupWindowEnd,
    this.delivery,
  });

  final String id;
  final String status;
  final num quantityRequested;
  final String unit;
  final String createdAt;
  final String updatedAt;
  final String? pickupWindowStart;
  final String? pickupWindowEnd;
  final AdminReservationMaterialSummary material;
  final AdminReservationPerson learner;
  final AdminReservationPerson supplier;
  final bool hasDelivery;
  final AdminReservationDeliverySummary? delivery;

  factory AdminReservationListItem.fromJson(Map<String, dynamic> json) {
    final deliveryJson = json['delivery'];
    return AdminReservationListItem(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      quantityRequested: json['quantityRequested'] as num? ?? 0,
      unit: json['unit'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
      pickupWindowStart: json['pickupWindowStart'] as String?,
      pickupWindowEnd: json['pickupWindowEnd'] as String?,
      material: AdminReservationMaterialSummary.fromJson(
        json['material'] as Map<String, dynamic>? ?? const {},
      ),
      learner: AdminReservationPerson.fromJson(
        json['learner'] as Map<String, dynamic>? ?? const {},
      ),
      supplier: AdminReservationPerson.fromJson(
        json['supplier'] as Map<String, dynamic>? ?? const {},
      ),
      hasDelivery: json['hasDelivery'] as bool? ?? false,
      delivery: deliveryJson is Map<String, dynamic>
          ? AdminReservationDeliverySummary.fromJson(deliveryJson)
          : null,
    );
  }
}

class AdminReservationDetail {
  const AdminReservationDetail({
    required this.id,
    required this.status,
    required this.quantityRequested,
    required this.unit,
    required this.createdAt,
    required this.updatedAt,
    required this.learner,
    required this.supplier,
    required this.material,
    this.fulfillmentMethod = 'PICKUP',
    this.message,
    this.acceptedAt,
    this.rejectedAt,
    this.cancelledAt,
    this.completedAt,
    this.pickupWindowStart,
    this.pickupWindowEnd,
    this.supplierNote,
    this.rejectionReason,
    this.delivery,
    this.linkedReport,
    this.statusHistory = const [],
  });

  final String id;
  final String status;
  final num quantityRequested;
  final String unit;
  final String? message;
  final String createdAt;
  final String updatedAt;
  final String? acceptedAt;
  final String? rejectedAt;
  final String? cancelledAt;
  final String? completedAt;
  final String? pickupWindowStart;
  final String? pickupWindowEnd;
  final String fulfillmentMethod;
  final String? supplierNote;
  final String? rejectionReason;
  final AdminReservationPerson learner;
  final AdminReservationSupplierDetail supplier;
  final AdminReservationMaterialDetail material;
  final AdminReservationDeliverySummary? delivery;
  final AdminReservationLinkedReport? linkedReport;
  final List<AdminReservationStatusHistoryItem> statusHistory;

  factory AdminReservationDetail.fromJson(Map<String, dynamic> json) {
    final deliveryJson = json['delivery'];
    return AdminReservationDetail(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      quantityRequested: json['quantityRequested'] as num? ?? 0,
      unit: json['unit'] as String? ?? '',
      message: json['message'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
      acceptedAt: json['acceptedAt'] as String?,
      rejectedAt: json['rejectedAt'] as String?,
      cancelledAt: json['cancelledAt'] as String?,
      completedAt: json['completedAt'] as String?,
      pickupWindowStart: json['pickupWindowStart'] as String?,
      pickupWindowEnd: json['pickupWindowEnd'] as String?,
      fulfillmentMethod: json['fulfillmentMethod'] as String? ?? 'PICKUP',
      supplierNote: json['supplierNote'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      learner: AdminReservationPerson.fromJson(
        json['learner'] as Map<String, dynamic>? ?? const {},
      ),
      supplier: AdminReservationSupplierDetail.fromJson(
        json['supplier'] as Map<String, dynamic>? ?? const {},
      ),
      material: AdminReservationMaterialDetail.fromJson(
        json['material'] as Map<String, dynamic>? ?? const {},
      ),
      delivery: deliveryJson is Map<String, dynamic>
          ? AdminReservationDeliverySummary.fromJson(deliveryJson)
          : null,
      linkedReport: json['linkedReport'] is Map<String, dynamic>
          ? AdminReservationLinkedReport.fromJson(
              json['linkedReport'] as Map<String, dynamic>,
            )
          : null,
      statusHistory: (json['statusHistory'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AdminReservationStatusHistoryItem.fromJson)
          .toList(),
    );
  }
}

class AdminReservationSupplierDetail {
  const AdminReservationSupplierDetail({
    required this.id,
    required this.displayName,
    required this.email,
    this.verificationStatus,
  });

  final String id;
  final String displayName;
  final String email;
  final String? verificationStatus;

  factory AdminReservationSupplierDetail.fromJson(Map<String, dynamic> json) {
    return AdminReservationSupplierDetail(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      verificationStatus: json['verificationStatus'] as String?,
    );
  }
}

class AdminReservationMaterialDetail {
  const AdminReservationMaterialDetail({
    required this.id,
    required this.title,
    required this.unit,
    required this.categoryName,
    required this.condition,
    required this.isFree,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    this.price,
    this.currency,
    this.imageUrl,
  });

  final String id;
  final String title;
  final String unit;
  final String categoryName;
  final String condition;
  final bool isFree;
  final num? price;
  final String? currency;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final String? imageUrl;

  factory AdminReservationMaterialDetail.fromJson(Map<String, dynamic> json) {
    return AdminReservationMaterialDetail(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      unit: json['unit'] as String? ?? '',
      categoryName: json['categoryName'] as String? ?? '',
      condition: json['condition'] as String? ?? '',
      isFree: json['isFree'] as bool? ?? true,
      price: json['price'] as num?,
      currency: json['currency'] as String?,
      pickupAllowed: json['pickupAllowed'] as bool? ?? true,
      deliveryAllowed: json['deliveryAllowed'] as bool? ?? false,
      imageUrl: json['imageUrl'] as String?,
    );
  }
}

class AdminReservationStatusHistoryItem {
  const AdminReservationStatusHistoryItem({
    required this.id,
    required this.statusGroup,
    required this.newStatus,
    required this.createdAt,
    this.oldStatus,
    this.note,
  });

  final String id;
  final String statusGroup;
  final String? oldStatus;
  final String newStatus;
  final String? note;
  final String createdAt;

  factory AdminReservationStatusHistoryItem.fromJson(Map<String, dynamic> json) {
    return AdminReservationStatusHistoryItem(
      id: json['id'] as String? ?? '',
      statusGroup: json['statusGroup'] as String? ?? '',
      oldStatus: json['oldStatus'] as String?,
      newStatus: json['newStatus'] as String? ?? '',
      note: json['note'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class AdminReservationsPagination {
  const AdminReservationsPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory AdminReservationsPagination.fromJson(Map<String, dynamic> json) {
    return AdminReservationsPagination(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? 0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

class AdminReservationsListResponse {
  const AdminReservationsListResponse({
    required this.summary,
    required this.items,
    required this.pagination,
    required this.statuses,
  });

  final AdminReservationsSummary summary;
  final List<AdminReservationListItem> items;
  final AdminReservationsPagination pagination;
  final List<String> statuses;

  factory AdminReservationsListResponse.fromJson(Map<String, dynamic> json) {
    final filterOptions =
        json['filterOptions'] as Map<String, dynamic>? ?? const {};
    return AdminReservationsListResponse(
      summary: AdminReservationsSummary.fromJson(
        json['summary'] as Map<String, dynamic>? ?? const {},
      ),
      items: (json['items'] as List<dynamic>? ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AdminReservationListItem.fromJson)
          .toList(),
      pagination: AdminReservationsPagination.fromJson(
        json['pagination'] as Map<String, dynamic>? ?? const {},
      ),
      statuses: (filterOptions['statuses'] as List<dynamic>? ?? const [])
          .map((value) => value.toString())
          .toList(),
    );
  }
}
