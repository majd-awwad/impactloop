import 'dart:collection';

import '../../../reservations/data/models/reservation_message.dart';
import 'supplier_incoming_request.dart';

enum SupplierPickupScheduleFilter { today, upcoming, completed, all }

enum SupplierPickupScheduleStatus { accepted, completed }

enum SupplierScheduleEntryKind {
  selfPickupAppointment,
  driverPickupAppointment,
  supplierAttention,
  deliveryRecovery,
  completedHandover,
  closedHistory,
  unknown,
}

enum SupplierScheduleFulfillmentKind { selfPickup, delivery, unknown }

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

const _knownReservationStatuses = {
  'PENDING',
  'ACCEPTED',
  'AWAITING_LEARNER_CONFIRMATION',
  'AWAITING_SUPPLIER_CONFIRMATION',
  'REJECTED',
  'EXPIRED',
  'CANCELLED',
  'COMPLETED',
  'NO_SHOW',
  'FULFILLMENT_FAILED',
  'AWAITING_RESOLUTION',
};

const _primaryActionOrder = [
  SupplierReservationAction.completeSelfPickup,
  SupplierReservationAction.acceptLearnerReschedule,
  SupplierReservationAction.submitRecoveryPickupWindow,
  SupplierReservationAction.reportNoDriver,
  SupplierReservationAction.reportDriverNoShow,
  SupplierReservationAction.markDeliveryPickupExpired,
  SupplierReservationAction.markLearnerNoShow,
  SupplierReservationAction.proposeReschedule,
  SupplierReservationAction.reportIncident,
  SupplierReservationAction.closeReservation,
];

class SupplierScheduleEntry {
  const SupplierScheduleEntry({
    required this.reservation,
    required this.members,
    required this.groupId,
    required this.effectiveWindow,
    required this.hasConsistentEffectiveWindow,
    required this.fulfillmentKind,
    required this.entryKind,
    required this.operationalState,
    required this.availableActions,
    required this.primaryAction,
    required this.terminalAt,
  });

  final SupplierIncomingRequest reservation;
  final List<SupplierIncomingRequest> members;
  final String? groupId;
  final SupplierPickupWindow? effectiveWindow;
  final bool hasConsistentEffectiveWindow;
  final SupplierScheduleFulfillmentKind fulfillmentKind;
  final SupplierScheduleEntryKind entryKind;
  final String operationalState;
  final List<SupplierAvailableAction> availableActions;
  final SupplierAvailableAction? primaryAction;
  final DateTime? terminalAt;

  String get reservationId => reservation.id;
  List<String> get sourceReservationIds =>
      members.map((item) => item.id).toList(growable: false);
  bool get isGrouped => groupId != null && members.length > 1;
  int get groupItemCount =>
      reservation.groupSummary?.itemCount ?? members.length;
  bool get hasUnknownStatus =>
      !_knownReservationStatuses.contains(_rawStatus(reservation));
  bool get hasUnknownAction =>
      availableActions.any((action) => !action.isExecutable);
  bool get isActionable =>
      !hasUnknownStatus && primaryAction?.isExecutable == true;
  String? get deliveryId =>
      reservation.deliverySummary?.deliveryId ?? reservation.activeDelivery?.id;
  String? get deliveryStatus =>
      reservation.deliverySummary?.status ?? reservation.activeDelivery?.status;
  SupplierDeliverySummary? get deliveryContext => reservation.deliverySummary;
  SupplierIncidentSummary? get incidentContext => reservation.incidentSummary;

  static SupplierScheduleEntry? fromReservations(
    List<SupplierIncomingRequest> sourceReservations,
  ) {
    if (sourceReservations.isEmpty) return null;

    final members = List<SupplierIncomingRequest>.unmodifiable(
      sourceReservations,
    );
    final reservation = members.first;
    final windows = members.map(_canonicalEffectiveWindow).toList();
    final firstWindow = windows.first;
    final windowsMatch = windows.every(
      (window) => _sameWindow(firstWindow, window),
    );
    final effectiveWindow = windowsMatch ? firstWindow : null;
    final actions = _commonAvailableActions(members);
    final primaryAction = _primaryAction(actions);
    final rawStatus = _rawStatus(reservation);
    final unknownStatus = !_knownReservationStatuses.contains(rawStatus);
    final delivery = reservation.fulfillmentMethod.toUpperCase() == 'DELIVERY';
    final fulfillmentKind = delivery
        ? SupplierScheduleFulfillmentKind.delivery
        : reservation.fulfillmentMethod.toUpperCase() == 'PICKUP'
        ? SupplierScheduleFulfillmentKind.selfPickup
        : SupplierScheduleFulfillmentKind.unknown;
    final attention =
        reservation.attentionState?.value ==
            SupplierAttentionState.supplierActionRequired &&
        primaryAction != null;
    final recovery =
        reservation.scheduleSummary?.recoveryContext != null ||
        rawStatus == 'AWAITING_RESOLUTION' ||
        rawStatus == 'FULFILLMENT_FAILED' ||
        const {
          'FAILED_PICKUP',
          'FAILED_DELIVERY',
          'DRIVER_NO_SHOW',
          'LEARNER_NO_SHOW',
          'AWAITING_RESOLUTION',
        }.contains(reservation.deliverySummary?.status?.toUpperCase());
    final terminal = const {
      'COMPLETED',
      'REJECTED',
      'EXPIRED',
      'CANCELLED',
      'NO_SHOW',
      'FULFILLMENT_FAILED',
    }.contains(rawStatus);

    SupplierScheduleEntryKind? kind;
    if (unknownStatus || !windowsMatch) {
      kind = SupplierScheduleEntryKind.unknown;
    } else if (recovery) {
      kind = SupplierScheduleEntryKind.deliveryRecovery;
    } else if (rawStatus == 'COMPLETED') {
      kind = SupplierScheduleEntryKind.completedHandover;
    } else if (terminal) {
      kind = SupplierScheduleEntryKind.closedHistory;
    } else if (attention) {
      kind = SupplierScheduleEntryKind.supplierAttention;
    } else if (effectiveWindow != null && rawStatus == 'ACCEPTED') {
      kind = delivery
          ? SupplierScheduleEntryKind.driverPickupAppointment
          : SupplierScheduleEntryKind.selfPickupAppointment;
    }

    // A pending proposal or a confirmed reservation without the canonical
    // effective window is not a schedule entry. Supplier-action entries are
    // retained only when the backend supplied an executable action.
    if (kind == null) return null;

    final terminalAt = rawStatus == 'COMPLETED'
        ? (delivery
              ? reservation.deliverySummary?.pickedUpAt
              : reservation.completedAt)
        : reservation.incidentSummary?.reviewedAt ??
              reservation.incidentSummary?.createdAt;

    return SupplierScheduleEntry(
      reservation: reservation,
      members: members,
      groupId: reservation.groupSummary?.grouped == true
          ? reservation.groupSummary?.groupId
          : null,
      effectiveWindow: effectiveWindow,
      hasConsistentEffectiveWindow: windowsMatch,
      fulfillmentKind: fulfillmentKind,
      entryKind: kind,
      operationalState: rawStatus,
      availableActions: actions,
      primaryAction: primaryAction,
      terminalAt: terminalAt,
    );
  }

  SupplierPickupScheduleItem? toCompatibilityItem() {
    if (entryKind == SupplierScheduleEntryKind.unknown ||
        (effectiveWindow == null && terminalAt == null)) {
      return null;
    }

    final completed =
        entryKind == SupplierScheduleEntryKind.completedHandover ||
        entryKind == SupplierScheduleEntryKind.closedHistory;
    final delivery = deliveryContext == null
        ? reservation.activeDelivery
        : SupplierReservationDeliverySummary(
            id: deliveryContext!.deliveryId ?? '',
            status: deliveryContext!.status ?? '',
          );
    final actionSet = availableActions.map((action) => action.value).toSet();
    return SupplierPickupScheduleItem(
      id: reservation.id,
      materialTitle: reservation.materialTitle,
      materialImageUrl: reservation.materialImageUrl,
      learnerName: reservation.learnerName,
      quantity: reservation.quantityRequested,
      unit: reservation.unit,
      status: completed
          ? SupplierPickupScheduleStatus.completed
          : SupplierPickupScheduleStatus.accepted,
      pickupType: fulfillmentKind == SupplierScheduleFulfillmentKind.delivery
          ? 'Delivery requested'
          : 'Self pickup',
      activeDelivery: delivery,
      canSupplierComplete: actionSet.contains(
        SupplierReservationAction.completeSelfPickup,
      ),
      isOverdue: reservation.isOverdue,
      needsFollowUp: reservation.needsFollowUp,
      pickupWindowStatus: reservation.pickupWindowStatus,
      pickupHandoverPhase: reservation.pickupHandoverPhase,
      canSupplierCloseOverduePickup: actionSet.contains(
        SupplierReservationAction.closeReservation,
      ),
      canSupplierReportAndCloseOverduePickup:
          actionSet.contains(SupplierReservationAction.markLearnerNoShow) ||
          actionSet.contains(SupplierReservationAction.reportIncident),
      canSupplierReschedule:
          actionSet.contains(SupplierReservationAction.proposeReschedule) ||
          actionSet.contains(SupplierReservationAction.acceptLearnerReschedule),
      canSendMessage: reservation.canSendMessage,
      canReportNoDriverAvailable: actionSet.contains(
        SupplierReservationAction.reportNoDriver,
      ),
      canSupplierMarkDeliveryPickupExpired: actionSet.contains(
        SupplierReservationAction.markDeliveryPickupExpired,
      ),
      canSupplierReportDriverNoShow: actionSet.contains(
        SupplierReservationAction.reportDriverNoShow,
      ),
      assignedDriverPickupOverdue: reservation.assignedDriverPickupOverdue,
      noShowReport: reservation.noShowReport,
      latestMessage: reservation.latestMessage,
      pickupWindow: effectiveWindow,
      supplierNote: reservation.supplierPickupWindow?.note,
      learnerMessage: reservation.learnerNote,
      completedAt: terminalAt,
      supplierHandoverCode: reservation.supplierHandoverCode,
      entry: this,
    );
  }

  static String _rawStatus(SupplierIncomingRequest request) =>
      (request.statusRaw ?? request.status.apiValue).toUpperCase();

  static SupplierPickupWindow? _canonicalEffectiveWindow(
    SupplierIncomingRequest request,
  ) {
    final isDelivery = request.fulfillmentMethod.toUpperCase() == 'DELIVERY';
    final expectedType = isDelivery
        ? 'SUPPLIER_DELIVERY_PICKUP'
        : 'CONFIRMED_PICKUP';
    final summary = request.scheduleSummary;
    final window = summary?.effectiveWindow;
    if (summary?.activeWindowType != expectedType ||
        window?.start == null ||
        window?.end == null ||
        !window!.end!.isAfter(window.start!)) {
      return null;
    }
    return SupplierPickupWindow(start: window.start!, end: window.end!);
  }

  static bool _sameWindow(
    SupplierPickupWindow? first,
    SupplierPickupWindow? second,
  ) =>
      first?.start.millisecondsSinceEpoch ==
          second?.start.millisecondsSinceEpoch &&
      first?.end.millisecondsSinceEpoch == second?.end.millisecondsSinceEpoch;

  static List<SupplierAvailableAction> _commonAvailableActions(
    List<SupplierIncomingRequest> members,
  ) {
    final first = members.first.availableActions;
    return List<SupplierAvailableAction>.unmodifiable(
      first.where(
        (candidate) => members.every(
          (member) => member.availableActions.any(
            (action) => action.rawValue == candidate.rawValue,
          ),
        ),
      ),
    );
  }

  static SupplierAvailableAction? _primaryAction(
    List<SupplierAvailableAction> actions,
  ) {
    for (final action in _primaryActionOrder) {
      final match = actions.where((item) => item.value == action);
      if (match.isNotEmpty) return match.first;
    }
    return null;
  }
}

/// Temporary adapter consumed by the existing schedule widgets.
/// It contains no JSON parsing; all values originate from [entry].
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
    this.entry,
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
  final SupplierScheduleEntry? entry;

  bool get isCompleted => status == SupplierPickupScheduleStatus.completed;
  bool get hasDelivery => activeDelivery != null;
  String get deliveryStatusLabel =>
      activeDelivery?.statusLabel ?? 'Delivery requested';
  bool get canMarkOrReportNoDriverAvailable =>
      canSupplierMarkDeliveryPickupExpired || canReportNoDriverAvailable;
  bool get showNoDriverOverdueWarning =>
      hasDelivery && canMarkOrReportNoDriverAvailable;
  bool get showAssignedDriverPickupOverdueWarning =>
      showNoDriverOverdueWarning &&
      (activeDelivery?.status.toUpperCase() == 'DRIVER_ASSIGNED' ||
          activeDelivery?.status.toUpperCase() == 'ARRIVED_PICKUP');
  bool get showDeliveryPickupExpiredHint => showNoDriverOverdueWarning;
  bool get shouldShowSupplierHandoverCode =>
      hasDelivery &&
      !isCompleted &&
      supplierHandoverCode?.trim().isNotEmpty == true;
  DateTime? get scheduleDate =>
      isCompleted ? completedAt ?? pickupWindow?.start : pickupWindow?.start;
  String get quantityLabel {
    final value = quantity == quantity.roundToDouble()
        ? quantity.toInt()
        : quantity;
    return '$value $unit';
  }
}

class SupplierScheduleQueryResult extends ListBase<SupplierPickupScheduleItem> {
  SupplierScheduleQueryResult({
    required this.entries,
    required this.pagination,
    required this.summary,
  }) : _items = List.unmodifiable(
         entries
             .map((entry) => entry.toCompatibilityItem())
             .whereType<SupplierPickupScheduleItem>(),
       );

  SupplierScheduleQueryResult.fromLegacyItems(
    List<SupplierPickupScheduleItem> items,
  ) : entries = const [],
      pagination = null,
      summary = null,
      _items = List.unmodifiable(items);

  final List<SupplierScheduleEntry> entries;
  final SupplierReservationPagination? pagination;
  final SupplierReservationSummary? summary;
  final List<SupplierPickupScheduleItem> _items;

  @override
  int get length => _items.length;

  @override
  set length(int value) {
    throw UnsupportedError('Schedule query results are immutable');
  }

  @override
  SupplierPickupScheduleItem operator [](int index) => _items[index];

  @override
  void operator []=(int index, SupplierPickupScheduleItem value) {
    throw UnsupportedError('Schedule query results are immutable');
  }
}

SupplierScheduleQueryResult projectSupplierReservations(
  SupplierReservationListResponse response,
) {
  final byKey = <String, List<SupplierIncomingRequest>>{};
  for (final reservation in response.items) {
    final group = reservation.groupSummary;
    final key = group?.grouped == true && group?.groupId?.isNotEmpty == true
        ? 'group:${group!.groupId}'
        : 'reservation:${reservation.id}';
    byKey.putIfAbsent(key, () => []).add(reservation);
  }

  final entries = byKey.values
      .map(SupplierScheduleEntry.fromReservations)
      .whereType<SupplierScheduleEntry>()
      .toList(growable: false);
  return SupplierScheduleQueryResult(
    entries: List.unmodifiable(entries),
    pagination: response.pagination,
    summary: response.summary,
  );
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
