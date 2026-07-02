import '../../../reservations/data/models/reservation_message.dart';
import '../../../reservations/data/models/reservation_preferred_window.dart';

enum SupplierIncomingRequestTab { pending, accepted, declined, completed }

enum SupplierIncomingRequestStatus {
  pending,
  accepted,
  awaitingConfirmation,
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
      case SupplierIncomingRequestStatus.awaitingConfirmation:
        return 'Awaiting confirmation';
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
      case 'AWAITING_LEARNER_CONFIRMATION':
        return SupplierIncomingRequestStatus.awaitingConfirmation;
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
      case SupplierIncomingRequestStatus.awaitingConfirmation:
        return 'AWAITING_LEARNER_CONFIRMATION';
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
    this.selectedPreferredWindowIndex,
  });

  final DateTime start;
  final DateTime end;
  final String? note;
  final int? selectedPreferredWindowIndex;

  factory SupplierPickupWindow.fromJson(Map<String, dynamic> json) {
    return SupplierPickupWindow(
      start: DateTime.parse(json['pickupWindowStart'] as String),
      end: DateTime.parse(json['pickupWindowEnd'] as String),
      note: json['supplierNote'] as String?,
      selectedPreferredWindowIndex:
          json['selectedPreferredWindowIndex'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'pickupWindowStart': start.toUtc().toIso8601String(),
      'pickupWindowEnd': end.toUtc().toIso8601String(),
      if (note != null && note!.isNotEmpty) 'supplierNote': note,
      if (selectedPreferredWindowIndex != null)
        'selectedPreferredWindowIndex': selectedPreferredWindowIndex,
    };
  }
}

class SupplierReservationDeliverySummary {
  const SupplierReservationDeliverySummary({
    required this.id,
    required this.status,
  });

  final String id;
  final String status;

  factory SupplierReservationDeliverySummary.fromJson(
    Map<String, dynamic> json,
  ) {
    return SupplierReservationDeliverySummary(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
    );
  }

  String get statusLabel {
    switch (status.toUpperCase()) {
      case 'WAITING_FOR_DRIVER':
        return 'Delivery requested';
      case 'DRIVER_ASSIGNED':
      case 'ARRIVED_PICKUP':
      case 'PICKED_UP':
        return 'Driver assigned';
      case 'ON_THE_WAY':
      case 'ARRIVED_DROPOFF':
        return 'On the way';
      case 'DELIVERED':
        return 'Delivered';
      case 'CANCELLED':
        return 'Delivery cancelled';
      case 'FAILED_PICKUP':
      case 'FAILED_DELIVERY':
        return 'Delivery failed';
      default:
        return 'Delivery requested';
    }
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
    this.fulfillmentMethod = 'PICKUP',
    this.fulfillmentLabel,
    this.learnerPreferredPickupWindows = const [],
    this.learnerPreferredDeliveryWindows = const [],
    this.deliveryAddressText,
    this.safeDropoffAllowed = false,
    this.reservationDeliveryNote,
    this.supplierProposedPickupWindow,
    this.supplierPickupWindow,
    this.confirmedDeliveryWindow,
    this.schedulingConflictReason,
    this.deliveryRequested = false,
    this.activeDelivery,
    this.canSupplierComplete = false,
    this.materialImageUrl,
    this.learnerNote,
    this.pickupPreference,
    this.pickupWindow,
    this.declineReason,
    this.isOverdue = false,
    this.needsFollowUp = false,
    this.pickupWindowStatus,
    this.canSupplierCancelOverdue = false,
    this.canSupplierReportNoShow = false,
    this.canSupplierReschedule = false,
    this.canSendMessage = false,
    this.noShowReport,
    this.latestMessage,
  });

  final String id;
  final String materialTitle;
  final String? materialImageUrl;
  final String learnerName;
  final double quantityRequested;
  final String unit;
  final SupplierIncomingRequestStatus status;
  final DateTime requestedAt;
  final String fulfillmentMethod;
  final String? fulfillmentLabel;
  final List<ReservationPreferredWindow> learnerPreferredPickupWindows;
  final List<ReservationPreferredWindow> learnerPreferredDeliveryWindows;
  final String? deliveryAddressText;
  final bool safeDropoffAllowed;
  final String? reservationDeliveryNote;
  final SupplierPickupWindow? supplierProposedPickupWindow;
  final SupplierPickupWindow? supplierPickupWindow;
  final SupplierPickupWindow? confirmedDeliveryWindow;
  final String? schedulingConflictReason;
  final bool deliveryRequested;
  final SupplierReservationDeliverySummary? activeDelivery;
  final bool canSupplierComplete;
  final String? learnerNote;
  final String? pickupPreference;
  final SupplierPickupWindow? pickupWindow;
  final String? declineReason;
  final bool isOverdue;
  final bool needsFollowUp;
  final String? pickupWindowStatus;
  final bool canSupplierCancelOverdue;
  final bool canSupplierReportNoShow;
  final bool canSupplierReschedule;
  final bool canSendMessage;
  final Map<String, dynamic>? noShowReport;
  final ReservationMessage? latestMessage;

  bool get hasDelivery => deliveryRequested || activeDelivery != null;

  bool get isDeliveryFulfillment => fulfillmentMethod.toUpperCase() == 'DELIVERY';

  bool get isPickupFulfillment => !isDeliveryFulfillment;

  String get fulfillmentSummary =>
      fulfillmentLabel ??
      (isDeliveryFulfillment ? 'Delivery selected' : 'Pickup selected');

  String get awaitingConfirmationMessage {
    if (schedulingConflictReason != null &&
        schedulingConflictReason!.trim().isNotEmpty) {
      return 'Scheduling conflict — waiting for learner confirmation';
    }

    return 'Waiting for learner to confirm proposed time';
  }

  String get deliveryStatusLabel =>
      activeDelivery?.statusLabel ?? 'Delivery requested';

  SupplierIncomingRequest copyWith({
    SupplierIncomingRequestStatus? status,
    SupplierPickupWindow? pickupWindow,
    bool? canSupplierComplete,
    String? declineReason,
    bool? isOverdue,
    bool? needsFollowUp,
    String? pickupWindowStatus,
    bool? canSupplierCancelOverdue,
    bool? canSupplierReportNoShow,
    bool? canSupplierReschedule,
    bool? canSendMessage,
    Map<String, dynamic>? noShowReport,
    ReservationMessage? latestMessage,
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
      deliveryRequested: deliveryRequested,
      activeDelivery: activeDelivery,
      canSupplierComplete: canSupplierComplete ?? this.canSupplierComplete,
      learnerNote: learnerNote,
      pickupPreference: pickupPreference,
      pickupWindow: pickupWindow ?? this.pickupWindow,
      declineReason: declineReason ?? this.declineReason,
      isOverdue: isOverdue ?? this.isOverdue,
      needsFollowUp: needsFollowUp ?? this.needsFollowUp,
      pickupWindowStatus: pickupWindowStatus ?? this.pickupWindowStatus,
      canSupplierCancelOverdue:
          canSupplierCancelOverdue ?? this.canSupplierCancelOverdue,
      canSupplierReportNoShow:
          canSupplierReportNoShow ?? this.canSupplierReportNoShow,
      canSupplierReschedule:
          canSupplierReschedule ?? this.canSupplierReschedule,
      canSendMessage: canSendMessage ?? this.canSendMessage,
      noShowReport: noShowReport ?? this.noShowReport,
      latestMessage: latestMessage ?? this.latestMessage,
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
    final fulfillmentMethod =
        json['fulfillmentMethod'] as String? ?? 'PICKUP';
    final fulfillmentLabel = json['fulfillmentLabel'] as String?;
    final deliveryRequested = json['deliveryRequested'] as bool? ?? false;
    final activeDeliveryJson = json['activeDelivery'];
    final activeDelivery = activeDeliveryJson is Map
        ? SupplierReservationDeliverySummary.fromJson(
            Map<String, dynamic>.from(activeDeliveryJson),
          )
        : null;
    String? preference = json['pickupPreference'] as String?;
    if (preference == null || preference.isEmpty) {
      preference = fulfillmentLabel;
    }
    if (preference == null || preference.isEmpty) {
      if (deliveryRequested) {
        preference = 'Delivery requested';
      } else if (pickupType == 'SELF_PICKUP') {
        preference = 'Self pickup';
      }
    }

    List<ReservationPreferredWindow> parsePreferredWindows(String key) {
      final raw = json[key];
      if (raw is! List) {
        return const [];
      }

      return raw
          .whereType<Map>()
          .map(
            (item) => ReservationPreferredWindow.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(growable: false);
    }

    SupplierPickupWindow? parseWindow(String startKey, String endKey) {
      final start = json[startKey] as String?;
      final end = json[endKey] as String?;
      if (start == null || end == null) {
        return null;
      }

      return SupplierPickupWindow(
        start: DateTime.parse(start),
        end: DateTime.parse(end),
      );
    }

    final status = SupplierIncomingRequestStatusLabels.fromApiValue(
      json['status'] as String? ?? 'PENDING',
    );
    final canSupplierComplete =
        json['canSupplierComplete'] as bool? ??
        (status == SupplierIncomingRequestStatus.accepted &&
            !deliveryRequested &&
            activeDelivery == null);

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
      materialTitle:
          material?['title'] as String? ??
          json['materialTitle'] as String? ??
          '',
      materialImageUrl: imageUrl,
      learnerName:
          learner?['displayName'] as String? ??
          requester?['displayName'] as String? ??
          json['learnerName'] as String? ??
          '',
      quantityRequested: (json['quantityRequested'] as num?)?.toDouble() ?? 0,
      unit: material?['unit'] as String? ?? json['unit'] as String? ?? 'piece',
      status: status,
      requestedAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      fulfillmentMethod: fulfillmentMethod,
      fulfillmentLabel: fulfillmentLabel,
      learnerPreferredPickupWindows: parsePreferredWindows(
        'learnerPreferredPickupWindows',
      ),
      learnerPreferredDeliveryWindows: parsePreferredWindows(
        'learnerPreferredDeliveryWindows',
      ),
      deliveryAddressText: json['deliveryAddressText'] as String?,
      safeDropoffAllowed: json['safeDropoffAllowed'] as bool? ?? false,
      reservationDeliveryNote: json['deliveryNote'] as String?,
      supplierProposedPickupWindow: parseWindow(
        'supplierProposedPickupWindowStart',
        'supplierProposedPickupWindowEnd',
      ),
      supplierPickupWindow: parseWindow(
        'supplierPickupWindowStart',
        'supplierPickupWindowEnd',
      ),
      confirmedDeliveryWindow: parseWindow(
        'confirmedDeliveryWindowStart',
        'confirmedDeliveryWindowEnd',
      ),
      schedulingConflictReason: json['schedulingConflictReason'] as String?,
      deliveryRequested: deliveryRequested,
      activeDelivery: activeDelivery,
      canSupplierComplete: canSupplierComplete,
      learnerNote: json['message'] as String?,
      pickupPreference: preference,
      pickupWindow: pickupWindow,
      declineReason:
          json['rejectionReason'] as String? ??
          json['declineReason'] as String?,
      isOverdue: json['isOverdue'] == true,
      needsFollowUp: json['needsFollowUp'] == true,
      pickupWindowStatus: json['pickupWindowStatus'] as String?,
      canSupplierCancelOverdue: json['canSupplierCancelOverdue'] == true,
      canSupplierReportNoShow: json['canSupplierReportNoShow'] == true,
      canSupplierReschedule: json['canSupplierReschedule'] == true,
      canSendMessage: json['canSendMessage'] == true,
      noShowReport: json['noShowReport'] is Map
          ? Map<String, dynamic>.from(json['noShowReport'] as Map)
          : null,
      latestMessage: json['latestMessage'] is Map
          ? ReservationMessage.fromJson(
              Map<String, dynamic>.from(json['latestMessage'] as Map),
            )
          : null,
    );
  }
}
