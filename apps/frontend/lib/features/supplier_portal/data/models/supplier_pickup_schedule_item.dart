import 'dart:collection';

import '../../../reservations/data/models/reservation_message.dart';
import 'supplier_incoming_request.dart';

Map<String, dynamic>? _scheduleMap(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : null;

DateTime? _scheduleDate(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;

List<T> _scheduleList<T>(Iterable<T> values) => List<T>.unmodifiable(values);

/// Absolute UTC boundaries for a selected local calendar day.
///
/// The next boundary is constructed as the next local midnight before it is
/// converted to UTC, so DST and non-24-hour local days remain correct.
class SupplierScheduleDateBoundaries {
  const SupplierScheduleDateBoundaries({
    required this.localDate,
    required this.dayStart,
    required this.dayEnd,
  });

  final DateTime localDate;
  final DateTime dayStart;
  final DateTime dayEnd;

  factory SupplierScheduleDateBoundaries.forLocalDate(DateTime value) {
    final local = value.toLocal();
    final localStart = DateTime(local.year, local.month, local.day);
    final localEnd = DateTime(local.year, local.month, local.day + 1);
    return SupplierScheduleDateBoundaries(
      localDate: localStart,
      dayStart: localStart.toUtc(),
      dayEnd: localEnd.toUtc(),
    );
  }
}

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
    this.groupId,
    this.grouped = false,
    this.groupItemCount,
    this.reservationIds = const [],
    this.scheduleCategory,
    this.needsAttention = false,
    this.availableActions = const [],
    this.canonicalEntry,
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
  final String? groupId;
  final bool grouped;
  final int? groupItemCount;
  final List<String> reservationIds;
  final String? scheduleCategory;
  final bool needsAttention;
  final List<SupplierAvailableAction> availableActions;
  final SupplierScheduleApiEntry? canonicalEntry;

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

enum SupplierScheduleEntryType {
  selfPickup,
  driverPickup,
  groupedDriverPickup,
  supplierAction,
  recovery,
  completedHandover,
  closedHistory,
  unknown,
}

class SupplierScheduleEntryTypeValue {
  const SupplierScheduleEntryTypeValue(this.value, this.rawValue);

  final SupplierScheduleEntryType value;
  final String? rawValue;

  bool get isKnown => value != SupplierScheduleEntryType.unknown;

  factory SupplierScheduleEntryTypeValue.fromJson(Object? value) {
    final raw = value as String?;
    const values = {
      'SELF_PICKUP': SupplierScheduleEntryType.selfPickup,
      'DRIVER_PICKUP': SupplierScheduleEntryType.driverPickup,
      'GROUPED_DRIVER_PICKUP': SupplierScheduleEntryType.groupedDriverPickup,
      'SUPPLIER_ACTION': SupplierScheduleEntryType.supplierAction,
      'RECOVERY': SupplierScheduleEntryType.recovery,
      'COMPLETED_HANDOVER': SupplierScheduleEntryType.completedHandover,
      'CLOSED_HISTORY': SupplierScheduleEntryType.closedHistory,
      'UNKNOWN': SupplierScheduleEntryType.unknown,
    };
    return SupplierScheduleEntryTypeValue(
      values[raw] ?? SupplierScheduleEntryType.unknown,
      raw,
    );
  }
}

enum SupplierScheduleCategory {
  unscheduledAction,
  adminReview,
  overdue,
  inProgress,
  today,
  upcoming,
  completed,
  closed,
  unknown,
}

class SupplierScheduleCategoryValue {
  const SupplierScheduleCategoryValue(this.value, this.rawValue);

  final SupplierScheduleCategory value;
  final String? rawValue;

  bool get isKnown => value != SupplierScheduleCategory.unknown;

  factory SupplierScheduleCategoryValue.fromJson(Object? value) {
    final raw = value as String?;
    const values = {
      'UNSCHEDULED_ACTION': SupplierScheduleCategory.unscheduledAction,
      'ADMIN_REVIEW': SupplierScheduleCategory.adminReview,
      'OVERDUE': SupplierScheduleCategory.overdue,
      'IN_PROGRESS': SupplierScheduleCategory.inProgress,
      'TODAY': SupplierScheduleCategory.today,
      'UPCOMING': SupplierScheduleCategory.upcoming,
      'COMPLETED': SupplierScheduleCategory.completed,
      'CLOSED': SupplierScheduleCategory.closed,
    };
    return SupplierScheduleCategoryValue(
      values[raw] ?? SupplierScheduleCategory.unknown,
      raw,
    );
  }
}

class SupplierScheduleEffectiveWindow {
  const SupplierScheduleEffectiveWindow({
    required this.start,
    required this.end,
    required this.type,
  });

  final DateTime start;
  final DateTime end;
  final String type;

  static SupplierScheduleEffectiveWindow? tryFromJson(
    Map<String, dynamic>? json,
  ) {
    final start = _scheduleDate(json?['start']);
    final end = _scheduleDate(json?['end']);
    if (start == null || end == null || !end.isAfter(start)) return null;
    return SupplierScheduleEffectiveWindow(
      start: start,
      end: end,
      type: json?['type'] as String? ?? 'UNKNOWN',
    );
  }

  SupplierPickupWindow toCompatibilityWindow() =>
      SupplierPickupWindow(start: start, end: end);
}

class SupplierScheduleMaterial {
  const SupplierScheduleMaterial({
    required this.id,
    required this.title,
    this.imageUrl,
  });

  final String id;
  final String title;
  final String? imageUrl;

  factory SupplierScheduleMaterial.fromJson(Map<String, dynamic>? json) =>
      SupplierScheduleMaterial(
        id: json?['id'] as String? ?? '',
        title: json?['title'] as String? ?? '',
        imageUrl: json?['imageUrl'] as String?,
      );
}

class SupplierScheduleLearner {
  const SupplierScheduleLearner({required this.id, required this.displayName});

  final String id;
  final String displayName;

  factory SupplierScheduleLearner.fromJson(Map<String, dynamic>? json) =>
      SupplierScheduleLearner(
        id: json?['id'] as String? ?? '',
        displayName: json?['displayName'] as String? ?? '',
      );
}

class SupplierScheduleQuantity {
  const SupplierScheduleQuantity({required this.value, required this.unit});

  final double value;
  final String unit;

  factory SupplierScheduleQuantity.fromJson(Map<String, dynamic>? json) =>
      SupplierScheduleQuantity(
        value: (json?['value'] as num?)?.toDouble() ?? 0,
        unit: json?['unit'] as String? ?? '',
      );
}

class SupplierScheduleApiEntry {
  const SupplierScheduleApiEntry({
    required this.id,
    required this.type,
    required this.category,
    required this.needsAttention,
    required this.representativeReservationId,
    required this.reservationIds,
    required this.material,
    required this.learner,
    required this.quantity,
    required this.fulfillmentMethod,
    required this.workflowPhase,
    required this.attentionState,
    required this.nextActor,
    required this.reservationStatus,
    required this.availableActions,
    this.group,
    this.effectiveWindow,
    this.delivery,
    this.incident,
    this.historyTimestamp,
    this.historyTimestampSource,
    this.projectionInconsistent = false,
  });

  final String id;
  final SupplierScheduleEntryTypeValue type;
  final SupplierScheduleCategoryValue category;
  final bool needsAttention;
  final String representativeReservationId;
  final List<String> reservationIds;
  final SupplierScheduleGroup? group;
  final SupplierScheduleMaterial material;
  final SupplierScheduleLearner learner;
  final SupplierScheduleQuantity quantity;
  final String fulfillmentMethod;
  final SupplierScheduleEffectiveWindow? effectiveWindow;
  final String workflowPhase;
  final String attentionState;
  final String nextActor;
  final String reservationStatus;
  final List<SupplierAvailableAction> availableActions;
  final SupplierDeliverySummary? delivery;
  final SupplierIncidentSummary? incident;
  final DateTime? historyTimestamp;
  final String? historyTimestampSource;
  final bool projectionInconsistent;

  factory SupplierScheduleApiEntry.fromJson(Map<String, dynamic> json) {
    return SupplierScheduleApiEntry(
      id: json['id'] as String? ?? '',
      type: SupplierScheduleEntryTypeValue.fromJson(json['type']),
      category: SupplierScheduleCategoryValue.fromJson(json['category']),
      needsAttention: json['needsAttention'] == true,
      representativeReservationId:
          json['representativeReservationId'] as String? ?? '',
      reservationIds: _scheduleList(
        (json['reservationIds'] as List? ?? const <dynamic>[])
            .whereType<String>(),
      ),
      group: _scheduleMap(json['group']) is Map<String, dynamic>
          ? SupplierScheduleGroup.fromJson(_scheduleMap(json['group'])!)
          : null,
      material: SupplierScheduleMaterial.fromJson(
        _scheduleMap(json['material']),
      ),
      learner: SupplierScheduleLearner.fromJson(_scheduleMap(json['learner'])),
      quantity: SupplierScheduleQuantity.fromJson(
        _scheduleMap(json['quantity']),
      ),
      fulfillmentMethod: json['fulfillmentMethod'] as String? ?? 'UNKNOWN',
      effectiveWindow: SupplierScheduleEffectiveWindow.tryFromJson(
        _scheduleMap(json['effectiveWindow']),
      ),
      workflowPhase: json['workflowPhase'] as String? ?? 'UNKNOWN',
      attentionState: json['attentionState'] as String? ?? 'UNKNOWN',
      nextActor: json['nextActor'] as String? ?? 'UNKNOWN',
      reservationStatus: json['reservationStatus'] as String? ?? 'UNKNOWN',
      availableActions: _scheduleList(
        (json['availableActions'] as List? ?? const <dynamic>[]).map(
          SupplierAvailableAction.fromJson,
        ),
      ),
      delivery: _scheduleMap(json['delivery']) is Map<String, dynamic>
          ? SupplierDeliverySummary.fromJson(_scheduleMap(json['delivery'])!)
          : null,
      incident: _scheduleMap(json['incident']) is Map<String, dynamic>
          ? SupplierIncidentSummary.fromJson(_scheduleMap(json['incident'])!)
          : null,
      historyTimestamp: _scheduleDate(json['historyTimestamp']),
      historyTimestampSource: json['historyTimestampSource'] as String?,
      projectionInconsistent: json['projectionInconsistent'] == true,
    );
  }

  SupplierPickupScheduleItem? toCompatibilityItem() {
    if (!category.isKnown || !type.isKnown) return null;

    final terminal =
        category.value == SupplierScheduleCategory.completed ||
        category.value == SupplierScheduleCategory.closed;
    final actionValues = availableActions.map((item) => item.value).toSet();
    final deliverySummary = delivery == null
        ? null
        : SupplierReservationDeliverySummary(
            id: delivery!.deliveryId ?? '',
            status: delivery!.status ?? '',
          );
    final effectiveWindow = this.effectiveWindow?.toCompatibilityWindow();
    return SupplierPickupScheduleItem(
      id: representativeReservationId,
      materialTitle: material.title,
      materialImageUrl: material.imageUrl,
      learnerName: learner.displayName,
      quantity: quantity.value,
      unit: quantity.unit,
      status: terminal
          ? SupplierPickupScheduleStatus.completed
          : SupplierPickupScheduleStatus.accepted,
      pickupType: fulfillmentMethod.toUpperCase() == 'DELIVERY'
          ? 'Delivery pickup'
          : 'Self pickup',
      activeDelivery: deliverySummary,
      canSupplierComplete: actionValues.contains(
        SupplierReservationAction.completeSelfPickup,
      ),
      isOverdue: category.value == SupplierScheduleCategory.overdue,
      needsFollowUp: needsAttention,
      canSupplierCloseOverduePickup: actionValues.contains(
        SupplierReservationAction.closeReservation,
      ),
      canSupplierReportAndCloseOverduePickup:
          actionValues.contains(SupplierReservationAction.reportIncident) ||
          actionValues.contains(SupplierReservationAction.markLearnerNoShow),
      canSupplierReschedule:
          actionValues.contains(SupplierReservationAction.proposeReschedule) ||
          actionValues.contains(
            SupplierReservationAction.acceptLearnerReschedule,
          ),
      canReportNoDriverAvailable: actionValues.contains(
        SupplierReservationAction.reportNoDriver,
      ),
      canSupplierMarkDeliveryPickupExpired: actionValues.contains(
        SupplierReservationAction.markDeliveryPickupExpired,
      ),
      canSupplierReportDriverNoShow: actionValues.contains(
        SupplierReservationAction.reportDriverNoShow,
      ),
      pickupWindow: effectiveWindow,
      completedAt: historyTimestamp,
      groupId: group?.groupId,
      grouped: group?.grouped == true,
      groupItemCount: group?.itemCount,
      reservationIds: reservationIds,
      scheduleCategory: category.rawValue,
      availableActions: availableActions,
      canonicalEntry: this,
      entry: null,
    );
  }
}

class SupplierScheduleGroup {
  const SupplierScheduleGroup({
    required this.groupId,
    required this.grouped,
    required this.itemCount,
    required this.status,
    required this.hasMoreItems,
  });

  final String groupId;
  final bool grouped;
  final int itemCount;
  final String status;
  final bool hasMoreItems;

  factory SupplierScheduleGroup.fromJson(Map<String, dynamic> json) =>
      SupplierScheduleGroup(
        groupId: json['groupId'] as String? ?? '',
        grouped: json['grouped'] == true,
        itemCount: (json['itemCount'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'UNKNOWN',
        hasMoreItems: json['hasMoreItems'] == true,
      );
}

class SupplierScheduleApiPagination {
  const SupplierScheduleApiPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory SupplierScheduleApiPagination.fromJson(Map<String, dynamic> json) =>
      SupplierScheduleApiPagination(
        page: (json['page'] as num?)?.toInt() ?? 1,
        limit: (json['limit'] as num?)?.toInt() ?? 20,
        total: (json['total'] as num?)?.toInt() ?? 0,
        totalPages: (json['totalPages'] as num?)?.toInt() ?? 0,
      );
}

class SupplierScheduleApiSummary {
  const SupplierScheduleApiSummary({
    required this.total,
    required this.unscheduledAction,
    required this.adminReview,
    required this.overdue,
    required this.inProgress,
    required this.today,
    required this.upcoming,
    required this.completed,
    required this.closed,
    required this.needsAttention,
  });

  final int total;
  final int unscheduledAction;
  final int adminReview;
  final int overdue;
  final int inProgress;
  final int today;
  final int upcoming;
  final int completed;
  final int closed;
  final int needsAttention;

  factory SupplierScheduleApiSummary.fromJson(Map<String, dynamic> json) =>
      SupplierScheduleApiSummary(
        total: (json['total'] as num?)?.toInt() ?? 0,
        unscheduledAction: (json['unscheduledAction'] as num?)?.toInt() ?? 0,
        adminReview: (json['adminReview'] as num?)?.toInt() ?? 0,
        overdue: (json['overdue'] as num?)?.toInt() ?? 0,
        inProgress: (json['inProgress'] as num?)?.toInt() ?? 0,
        today: (json['today'] as num?)?.toInt() ?? 0,
        upcoming: (json['upcoming'] as num?)?.toInt() ?? 0,
        completed: (json['completed'] as num?)?.toInt() ?? 0,
        closed: (json['closed'] as num?)?.toInt() ?? 0,
        needsAttention: (json['needsAttention'] as num?)?.toInt() ?? 0,
      );

  bool get isReconciled =>
      unscheduledAction +
          adminReview +
          overdue +
          inProgress +
          today +
          upcoming +
          completed +
          closed ==
      total;
}

class SupplierSchedulePage {
  const SupplierSchedulePage({
    required this.items,
    required this.pagination,
    required this.summary,
    this.legacyCompatibilityItems = const [],
  });

  final List<SupplierScheduleApiEntry> items;
  final SupplierScheduleApiPagination pagination;
  final SupplierScheduleApiSummary summary;
  final List<SupplierPickupScheduleItem> legacyCompatibilityItems;

  factory SupplierSchedulePage.fromJson(Map<String, dynamic> json) {
    return SupplierSchedulePage(
      items: _scheduleList(
        (json['items'] as List? ?? const <dynamic>[]).whereType<Map>().map(
          (item) => SupplierScheduleApiEntry.fromJson(
            Map<String, dynamic>.from(item),
          ),
        ),
      ),
      pagination: SupplierScheduleApiPagination.fromJson(
        _scheduleMap(json['pagination']) ?? const {},
      ),
      summary: SupplierScheduleApiSummary.fromJson(
        _scheduleMap(json['summary']) ?? const {},
      ),
    );
  }

  List<SupplierPickupScheduleItem> get compatibilityItems =>
      legacyCompatibilityItems.isNotEmpty
      ? legacyCompatibilityItems
      : items
            .map((entry) => entry.toCompatibilityItem())
            .whereType<SupplierPickupScheduleItem>()
            .toList(growable: false);
}

class SupplierScheduleQuery {
  const SupplierScheduleQuery({
    this.page = 1,
    this.limit = 20,
    this.scope = 'ALL',
    this.category,
    this.needsAttention,
    this.fulfillmentMethod,
    this.search,
    this.rangeStart,
    this.rangeEnd,
    this.dayStart,
    this.dayEnd,
    this.materialId,
    this.selectedDay,
    this.filter = SupplierPickupScheduleFilter.all,
  });

  final int page;
  final int limit;
  final String scope;
  final String? category;
  final bool? needsAttention;
  final String? fulfillmentMethod;
  final String? search;
  final DateTime? rangeStart;
  final DateTime? rangeEnd;
  final DateTime? dayStart;
  final DateTime? dayEnd;
  final String? materialId;
  final DateTime? selectedDay;
  final SupplierPickupScheduleFilter filter;

  factory SupplierScheduleQuery.forFilter(
    SupplierPickupScheduleFilter filter, {
    DateTime? selectedDay,
  }) {
    final boundaries = SupplierScheduleDateBoundaries.forLocalDate(
      selectedDay ?? DateTime.now(),
    );
    switch (filter) {
      case SupplierPickupScheduleFilter.today:
        return SupplierScheduleQuery(
          scope: 'ACTIVE',
          category: 'TODAY',
          dayStart: boundaries.dayStart,
          dayEnd: boundaries.dayEnd,
          selectedDay: boundaries.localDate,
          filter: filter,
        );
      case SupplierPickupScheduleFilter.upcoming:
        return SupplierScheduleQuery(
          scope: 'ACTIVE',
          category: 'UPCOMING',
          dayStart: boundaries.dayStart,
          dayEnd: boundaries.dayEnd,
          selectedDay: boundaries.localDate,
          filter: filter,
        );
      case SupplierPickupScheduleFilter.completed:
        return SupplierScheduleQuery(
          scope: 'HISTORY',
          category: 'COMPLETED',
          selectedDay: boundaries.localDate,
          filter: filter,
        );
      case SupplierPickupScheduleFilter.all:
        return SupplierScheduleQuery(
          scope: 'ALL',
          dayStart: boundaries.dayStart,
          dayEnd: boundaries.dayEnd,
          selectedDay: boundaries.localDate,
          filter: filter,
        );
    }
  }

  SupplierScheduleQuery copyWith({
    int? page,
    int? limit,
    String? scope,
    String? category,
    bool? needsAttention,
    String? fulfillmentMethod,
    String? search,
    DateTime? rangeStart,
    DateTime? rangeEnd,
    DateTime? dayStart,
    DateTime? dayEnd,
    String? materialId,
    DateTime? selectedDay,
    SupplierPickupScheduleFilter? filter,
  }) {
    final filterChanged =
        (scope != null && scope != this.scope) ||
        (category != null && category != this.category) ||
        (needsAttention != null && needsAttention != this.needsAttention) ||
        (fulfillmentMethod != null &&
            fulfillmentMethod != this.fulfillmentMethod) ||
        (search != null && search != this.search) ||
        (rangeStart != null && rangeStart != this.rangeStart) ||
        (rangeEnd != null && rangeEnd != this.rangeEnd) ||
        (dayStart != null && dayStart != this.dayStart) ||
        (dayEnd != null && dayEnd != this.dayEnd) ||
        (materialId != null && materialId != this.materialId) ||
        (selectedDay != null && selectedDay != this.selectedDay) ||
        (filter != null && filter != this.filter);
    return SupplierScheduleQuery(
      page: filterChanged ? 1 : page ?? this.page,
      limit: limit ?? this.limit,
      scope: scope ?? this.scope,
      category: category ?? this.category,
      needsAttention: needsAttention ?? this.needsAttention,
      fulfillmentMethod: fulfillmentMethod ?? this.fulfillmentMethod,
      search: search ?? this.search,
      rangeStart: rangeStart ?? this.rangeStart,
      rangeEnd: rangeEnd ?? this.rangeEnd,
      dayStart: dayStart ?? this.dayStart,
      dayEnd: dayEnd ?? this.dayEnd,
      materialId: materialId ?? this.materialId,
      selectedDay: selectedDay ?? this.selectedDay,
      filter: filter ?? this.filter,
    );
  }

  Map<String, dynamic> toQueryParameters() {
    final parameters = <String, dynamic>{
      'page': page,
      'limit': limit,
      'scope': scope,
    };
    if (category != null) parameters['category'] = category;
    if (needsAttention != null) parameters['needsAttention'] = needsAttention;
    if (fulfillmentMethod != null && fulfillmentMethod!.trim().isNotEmpty) {
      parameters['fulfillmentMethod'] = fulfillmentMethod;
    }
    if (search != null && search!.trim().isNotEmpty) {
      parameters['search'] = search!.trim();
    }
    if (materialId != null && materialId!.trim().isNotEmpty) {
      parameters['materialId'] = materialId;
    }
    if (rangeStart != null && rangeEnd != null) {
      parameters['rangeStart'] = rangeStart!.toUtc().toIso8601String();
      parameters['rangeEnd'] = rangeEnd!.toUtc().toIso8601String();
    }
    if (dayStart != null && dayEnd != null) {
      parameters['dayStart'] = dayStart!.toUtc().toIso8601String();
      parameters['dayEnd'] = dayEnd!.toUtc().toIso8601String();
    }
    return parameters;
  }

  @override
  bool operator ==(Object other) =>
      other is SupplierScheduleQuery &&
      page == other.page &&
      limit == other.limit &&
      scope == other.scope &&
      category == other.category &&
      needsAttention == other.needsAttention &&
      fulfillmentMethod == other.fulfillmentMethod &&
      search == other.search &&
      rangeStart == other.rangeStart &&
      rangeEnd == other.rangeEnd &&
      dayStart == other.dayStart &&
      dayEnd == other.dayEnd &&
      materialId == other.materialId &&
      selectedDay == other.selectedDay &&
      filter == other.filter;

  @override
  int get hashCode => Object.hash(
    page,
    limit,
    scope,
    category,
    needsAttention,
    fulfillmentMethod,
    search,
    rangeStart,
    rangeEnd,
    dayStart,
    dayEnd,
    materialId,
    selectedDay,
    filter,
  );
}
