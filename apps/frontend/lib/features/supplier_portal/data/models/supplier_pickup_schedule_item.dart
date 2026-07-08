import 'supplier_incoming_request.dart';
import '../../../reservations/data/models/reservation_message.dart';

enum SupplierPickupScheduleFilter { today, upcoming, completed, all }

enum SupplierPickupScheduleStatus { accepted, completed }

extension SupplierPickupScheduleFilterLabels on SupplierPickupScheduleFilter {
  String get label {
    switch (this) {
      case SupplierPickupScheduleFilter.today:
        return 'Today';
      case SupplierPickupScheduleFilter.upcoming:
        return 'Upcoming';
      case SupplierPickupScheduleFilter.completed:
        return 'Completed';
      case SupplierPickupScheduleFilter.all:
        return 'All';
    }
  }

  String get emptyMessage {
    switch (this) {
      case SupplierPickupScheduleFilter.today:
        return 'No pickups scheduled for today.';
      case SupplierPickupScheduleFilter.upcoming:
        return 'No upcoming pickups.';
      case SupplierPickupScheduleFilter.completed:
        return 'No completed pickups yet.';
      case SupplierPickupScheduleFilter.all:
        return 'No pickup schedule yet.';
    }
  }

  String get emptySubtitle {
    switch (this) {
      case SupplierPickupScheduleFilter.today:
        return 'Accepted pickups for today will appear here.';
      case SupplierPickupScheduleFilter.upcoming:
        return 'Future accepted pickups will be listed here.';
      case SupplierPickupScheduleFilter.completed:
        return 'Finished handovers will show up here.';
      case SupplierPickupScheduleFilter.all:
        return 'Your pickup timeline will appear here.';
    }
  }
}

extension SupplierPickupScheduleStatusLabels on SupplierPickupScheduleStatus {
  String get label {
    switch (this) {
      case SupplierPickupScheduleStatus.accepted:
        return 'Accepted';
      case SupplierPickupScheduleStatus.completed:
        return 'Completed';
    }
  }
}

class SupplierPickupScheduleItem {
  const SupplierPickupScheduleItem({
    required this.id,
    required this.materialTitle,
    required this.learnerName,
    required this.quantity,
    required this.unit,
    required this.status,
    required this.pickupType,
    this.activeDelivery,
    this.canSupplierComplete = false,
    this.isOverdue = false,
    this.needsFollowUp = false,
    this.pickupWindowStatus,
    this.pickupHandoverPhase,
    this.canSupplierCloseOverduePickup = false,
    this.canSupplierReportAndCloseOverduePickup = false,
    this.canSupplierReschedule = false,
    this.canSendMessage = false,
    this.canReportNoDriverAvailable = false,
    this.canSupplierMarkDeliveryPickupExpired = false,
    this.canSupplierReportDriverNoShow = false,
    this.assignedDriverPickupOverdue = false,
    this.noShowReport,
    this.latestMessage,
    this.materialImageUrl,
    this.pickupWindow,
    this.supplierNote,
    this.learnerMessage,
    this.completedAt,
    this.supplierHandoverCode,
  });

  final String id;
  final String materialTitle;
  final String? materialImageUrl;
  final String learnerName;
  final double quantity;
  final String unit;
  final SupplierPickupScheduleStatus status;
  final String pickupType;
  final SupplierReservationDeliverySummary? activeDelivery;
  final bool canSupplierComplete;
  final bool isOverdue;
  final bool needsFollowUp;
  final String? pickupWindowStatus;
  final String? pickupHandoverPhase;
  final bool canSupplierCloseOverduePickup;
  final bool canSupplierReportAndCloseOverduePickup;
  final bool canSupplierReschedule;
  final bool canSendMessage;
  final bool canReportNoDriverAvailable;
  final bool canSupplierMarkDeliveryPickupExpired;
  final bool canSupplierReportDriverNoShow;
  final bool assignedDriverPickupOverdue;
  final Map<String, dynamic>? noShowReport;
  final ReservationMessage? latestMessage;
  final SupplierPickupWindow? pickupWindow;
  final String? supplierNote;
  final String? learnerMessage;
  final DateTime? completedAt;
  final String? supplierHandoverCode;

  bool get isCompleted => status == SupplierPickupScheduleStatus.completed;
  bool get hasDelivery => activeDelivery != null;
  String get deliveryStatusLabel {
    if (activeDelivery?.status.toUpperCase() == 'WAITING_FOR_DRIVER' &&
        canMarkOrReportNoDriverAvailable) {
      return 'Driver not assigned in time';
    }

    final status = activeDelivery?.status.toUpperCase();
    if ((status == 'DRIVER_ASSIGNED' || status == 'ARRIVED_PICKUP') &&
        (canSupplierReportDriverNoShow || assignedDriverPickupOverdue)) {
      return status == 'ARRIVED_PICKUP'
          ? 'Pickup not completed'
          : 'Driver pickup overdue';
    }

    return activeDelivery?.statusLabel ?? 'Delivery requested';
  }

  bool get canMarkOrReportNoDriverAvailable =>
      canSupplierMarkDeliveryPickupExpired || canReportNoDriverAvailable;

  bool get showNoDriverOverdueWarning {
    if (!hasDelivery || noShowReport != null) {
      return false;
    }

    final status = activeDelivery?.status.toUpperCase();

    if (status == 'WAITING_FOR_DRIVER') {
      return canMarkOrReportNoDriverAvailable;
    }

    if (status == 'DRIVER_ASSIGNED' || status == 'ARRIVED_PICKUP') {
      return canSupplierReportDriverNoShow || assignedDriverPickupOverdue;
    }

    return false;
  }

  bool get showAssignedDriverPickupOverdueWarning {
    if (!showNoDriverOverdueWarning) {
      return false;
    }

    final status = activeDelivery?.status.toUpperCase();
    return status == 'DRIVER_ASSIGNED' || status == 'ARRIVED_PICKUP';
  }

  /// @deprecated Use [showNoDriverOverdueWarning]
  bool get showDeliveryPickupExpiredHint => showNoDriverOverdueWarning;

  bool get shouldShowSupplierHandoverCode =>
      hasDelivery &&
      !isCompleted &&
      supplierHandoverCode != null &&
      supplierHandoverCode!.trim().isNotEmpty &&
      activeDelivery?.status.toUpperCase() != 'DELIVERED' &&
      !canMarkOrReportNoDriverAvailable;

  DateTime? get scheduleDate {
    if (isCompleted) {
      return completedAt ?? pickupWindow?.start;
    }
    return pickupWindow?.start;
  }

  String get quantityLabel {
    final value = quantity == quantity.roundToDouble()
        ? quantity.toInt()
        : quantity;
    return '$value $unit';
  }

  factory SupplierPickupScheduleItem.fromReservationJson(
    Map<String, dynamic> json,
  ) {
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
        imageUrl = first['url'] as String? ?? first['imageUrl'] as String?;
      }
    }

    final fulfillmentMethod =
        json['fulfillmentMethod'] as String? ?? 'PICKUP';
    final fulfillmentLabel = json['fulfillmentLabel'] as String?;
    final activeDeliveryJson = json['activeDelivery'];
    final activeDelivery = activeDeliveryJson is Map
        ? SupplierReservationDeliverySummary.fromJson(
            Map<String, dynamic>.from(activeDeliveryJson),
          )
        : null;
    final pickupTypeLabel = fulfillmentLabel ??
        (fulfillmentMethod.toUpperCase() == 'DELIVERY'
            ? 'Delivery selected'
            : activeDelivery != null
                ? 'Delivery requested'
                : 'Pickup selected');

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

    final statusRaw = (json['status'] as String? ?? 'ACCEPTED').toUpperCase();
    final scheduleStatus = statusRaw == 'COMPLETED'
        ? SupplierPickupScheduleStatus.completed
        : SupplierPickupScheduleStatus.accepted;
    final canSupplierComplete =
        json['canSupplierComplete'] as bool? ??
        (scheduleStatus == SupplierPickupScheduleStatus.accepted &&
            activeDelivery == null &&
            fulfillmentMethod.toUpperCase() != 'DELIVERY');

    DateTime? completedAt;
    final completedAtRaw = json['completedAt'] as String?;
    if (completedAtRaw != null && completedAtRaw.isNotEmpty) {
      completedAt = DateTime.tryParse(completedAtRaw);
    }

    return SupplierPickupScheduleItem(
      id: json['id'] as String? ?? '',
      materialTitle:
          material?['title'] as String? ??
          json['materialTitle'] as String? ??
          '',
      materialImageUrl: imageUrl,
      learnerName:
          learner?['displayName'] as String? ??
          requester?['displayName'] as String? ??
          '',
      quantity: (json['quantityRequested'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? material?['unit'] as String? ?? 'piece',
      status: scheduleStatus,
      pickupType: pickupTypeLabel,
      activeDelivery: activeDelivery,
      canSupplierComplete: canSupplierComplete,
      isOverdue: json['isOverdue'] == true,
      needsFollowUp: json['needsFollowUp'] == true,
      pickupWindowStatus: json['pickupWindowStatus'] as String?,
      pickupHandoverPhase: json['pickupHandoverPhase'] as String?,
      canSupplierCloseOverduePickup:
          json['canSupplierCloseOverduePickup'] == true ||
          json['canSupplierCancelOverdue'] == true,
      canSupplierReportAndCloseOverduePickup:
          json['canSupplierReportAndCloseOverduePickup'] == true ||
          (json['canSupplierReportNoShow'] == true &&
              json['noShowReport'] == null),
      canSupplierReschedule: json['canSupplierReschedule'] == true,
      canSendMessage: json['canSendMessage'] == true,
      canReportNoDriverAvailable: json['canReportNoDriverAvailable'] == true,
      canSupplierMarkDeliveryPickupExpired:
          json['canSupplierMarkDeliveryPickupExpired'] == true,
      canSupplierReportDriverNoShow:
          json['canSupplierReportDriverNoShow'] == true,
      assignedDriverPickupOverdue:
          json['assignedDriverPickupOverdue'] == true,
      noShowReport: json['noShowReport'] is Map
          ? Map<String, dynamic>.from(json['noShowReport'] as Map)
          : null,
      latestMessage: json['latestMessage'] is Map
          ? ReservationMessage.fromJson(
              Map<String, dynamic>.from(json['latestMessage'] as Map),
            )
          : null,
      pickupWindow: pickupWindow,
      supplierNote: json['supplierNote'] as String?,
      learnerMessage: json['message'] as String?,
      completedAt: completedAt,
      supplierHandoverCode: json['supplierHandoverCode'] as String?,
    );
  }
}

enum PickupScheduleGroupKind { today, tomorrow, date, completed }

class PickupScheduleDateGroup {
  const PickupScheduleDateGroup({
    required this.kind,
    required this.label,
    required this.items,
    this.date,
  });

  final PickupScheduleGroupKind kind;
  final String label;
  final List<SupplierPickupScheduleItem> items;
  final DateTime? date;
}
