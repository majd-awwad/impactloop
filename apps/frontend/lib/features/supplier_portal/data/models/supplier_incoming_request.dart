enum SupplierIncomingRequestTab {
  pending,
  accepted,
  declined,
  completed,
}

enum SupplierIncomingRequestStatus {
  pending,
  accepted,
  declined,
  completed,
}

extension SupplierIncomingRequestTabLabels on SupplierIncomingRequestTab {
  String get label {
    switch (this) {
      case SupplierIncomingRequestTab.pending:
        return 'Pending';
      case SupplierIncomingRequestTab.accepted:
        return 'Accepted';
      case SupplierIncomingRequestTab.declined:
        return 'Declined';
      case SupplierIncomingRequestTab.completed:
        return 'Completed';
    }
  }

  String get emptyMessage {
    switch (this) {
      case SupplierIncomingRequestTab.pending:
        return 'No pending requests';
      case SupplierIncomingRequestTab.accepted:
        return 'No accepted pickups yet.';
      case SupplierIncomingRequestTab.declined:
        return 'No declined requests.';
      case SupplierIncomingRequestTab.completed:
        return 'No completed pickups yet.';
    }
  }

  String get emptySubtitle {
    switch (this) {
      case SupplierIncomingRequestTab.pending:
        return 'New learner requests will appear here.';
      case SupplierIncomingRequestTab.accepted:
        return 'Accepted requests with pickup windows will show here.';
      case SupplierIncomingRequestTab.declined:
        return 'Requests you decline will be listed here.';
      case SupplierIncomingRequestTab.completed:
        return 'Finished pickups will appear here.';
    }
  }

  SupplierIncomingRequestStatus get status {
    switch (this) {
      case SupplierIncomingRequestTab.pending:
        return SupplierIncomingRequestStatus.pending;
      case SupplierIncomingRequestTab.accepted:
        return SupplierIncomingRequestStatus.accepted;
      case SupplierIncomingRequestTab.declined:
        return SupplierIncomingRequestStatus.declined;
      case SupplierIncomingRequestTab.completed:
        return SupplierIncomingRequestStatus.completed;
    }
  }
}

extension SupplierIncomingRequestStatusLabels on SupplierIncomingRequestStatus {
  String get label {
    switch (this) {
      case SupplierIncomingRequestStatus.pending:
        return 'Pending';
      case SupplierIncomingRequestStatus.accepted:
        return 'Accepted';
      case SupplierIncomingRequestStatus.declined:
        return 'Declined';
      case SupplierIncomingRequestStatus.completed:
        return 'Completed';
    }
  }

  /// Maps backend `ReservationStatus` values when API is wired.
  static SupplierIncomingRequestStatus fromApiValue(String value) {
    switch (value.toUpperCase()) {
      case 'PENDING':
        return SupplierIncomingRequestStatus.pending;
      case 'ACCEPTED':
        return SupplierIncomingRequestStatus.accepted;
      case 'REJECTED':
      case 'CANCELLED':
      case 'EXPIRED':
        return SupplierIncomingRequestStatus.declined;
      case 'COMPLETED':
        return SupplierIncomingRequestStatus.completed;
      default:
        return SupplierIncomingRequestStatus.pending;
    }
  }

  String get apiValue {
    switch (this) {
      case SupplierIncomingRequestStatus.pending:
        return 'PENDING';
      case SupplierIncomingRequestStatus.accepted:
        return 'ACCEPTED';
      case SupplierIncomingRequestStatus.declined:
        return 'REJECTED';
      case SupplierIncomingRequestStatus.completed:
        return 'COMPLETED';
    }
  }
}

class SupplierPickupWindow {
  const SupplierPickupWindow({
    required this.start,
    required this.end,
    this.note,
  });

  final DateTime start;
  final DateTime end;
  final String? note;

  factory SupplierPickupWindow.fromJson(Map<String, dynamic> json) {
    return SupplierPickupWindow(
      start: DateTime.parse(json['pickupWindowStart'] as String),
      end: DateTime.parse(json['pickupWindowEnd'] as String),
      note: json['supplierNote'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'pickupWindowStart': start.toUtc().toIso8601String(),
      'pickupWindowEnd': end.toUtc().toIso8601String(),
      if (note != null && note!.isNotEmpty) 'supplierNote': note,
    };
  }
}

class SupplierIncomingRequest {
  const SupplierIncomingRequest({
    required this.id,
    required this.materialTitle,
    required this.learnerName,
    required this.quantityRequested,
    required this.unit,
    required this.status,
    required this.requestedAt,
    this.materialImageUrl,
    this.learnerNote,
    this.pickupPreference,
    this.pickupWindow,
    this.declineReason,
  });

  final String id;
  final String materialTitle;
  final String? materialImageUrl;
  final String learnerName;
  final double quantityRequested;
  final String unit;
  final SupplierIncomingRequestStatus status;
  final DateTime requestedAt;
  final String? learnerNote;
  final String? pickupPreference;
  final SupplierPickupWindow? pickupWindow;
  final String? declineReason;

  SupplierIncomingRequest copyWith({
    SupplierIncomingRequestStatus? status,
    SupplierPickupWindow? pickupWindow,
    String? declineReason,
  }) {
    return SupplierIncomingRequest(
      id: id,
      materialTitle: materialTitle,
      materialImageUrl: materialImageUrl,
      learnerName: learnerName,
      quantityRequested: quantityRequested,
      unit: unit,
      status: status ?? this.status,
      requestedAt: requestedAt,
      learnerNote: learnerNote,
      pickupPreference: pickupPreference,
      pickupWindow: pickupWindow ?? this.pickupWindow,
      declineReason: declineReason ?? this.declineReason,
    );
  }

  factory SupplierIncomingRequest.fromJson(Map<String, dynamic> json) {
    final material = json['material'] as Map<String, dynamic>?;
    final learner = json['learner'] as Map<String, dynamic>?;
    final requester = json['requester'] as Map<String, dynamic>?;
    final images = material?['images'] as List?;
    String? imageUrl = material?['imageUrl'] as String?;
    if ((imageUrl == null || imageUrl.isEmpty) &&
        images != null &&
        images.isNotEmpty) {
      final first = images.first;
      if (first is Map) {
        imageUrl = first['url'] as String?;
      }
    }

    final pickupType = json['pickupType'] as String?;
    final deliveryRequested = json['deliveryRequested'] as bool? ?? false;
    String? preference = json['pickupPreference'] as String?;
    if (preference == null || preference.isEmpty) {
      if (deliveryRequested) {
        preference = 'Delivery requested';
      } else if (pickupType == 'SELF_PICKUP') {
        preference = 'Self pickup';
      }
    }

    SupplierPickupWindow? pickupWindow;
    final start = json['pickupWindowStart'] as String?;
    final end = json['pickupWindowEnd'] as String?;
    if (start != null && end != null) {
      pickupWindow = SupplierPickupWindow(
        start: DateTime.parse(start),
        end: DateTime.parse(end),
        note: json['supplierNote'] as String?,
      );
    }

    return SupplierIncomingRequest(
      id: json['id'] as String? ?? '',
      materialTitle: material?['title'] as String? ??
          json['materialTitle'] as String? ??
          '',
      materialImageUrl: imageUrl,
      learnerName: learner?['displayName'] as String? ??
          requester?['displayName'] as String? ??
          json['learnerName'] as String? ??
          '',
      quantityRequested:
          (json['quantityRequested'] as num?)?.toDouble() ?? 0,
      unit: material?['unit'] as String? ?? json['unit'] as String? ?? 'piece',
      status: SupplierIncomingRequestStatusLabels.fromApiValue(
        json['status'] as String? ?? 'PENDING',
      ),
      requestedAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      learnerNote: json['message'] as String?,
      pickupPreference: preference,
      pickupWindow: pickupWindow,
      declineReason: json['rejectionReason'] as String? ??
          json['declineReason'] as String?,
    );
  }
}
