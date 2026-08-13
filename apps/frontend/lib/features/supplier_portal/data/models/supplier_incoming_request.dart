import '../../../reservations/data/models/reservation_message.dart';
import '../../../reservations/data/models/reservation_preferred_window.dart';
import '../../../../shared/models/handover_payment_summary.dart';

Map<String, dynamic>? _jsonMap(Object? value) =>
    value is Map ? Map<String, dynamic>.from(value) : null;

DateTime? _jsonDate(Object? value) =>
    value is String ? DateTime.tryParse(value) : null;

List<T> _immutableList<T>(Iterable<T> values) => List<T>.unmodifiable(values);

enum SupplierWorkflowPhase {
  initialDecision,
  scheduling,
  selfPickup,
  delivery,
  recovery,
  completed,
  closed,
  unknown,
}

enum SupplierAttentionState {
  supplierActionRequired,
  waitingForLearner,
  fulfillmentInProgress,
  adminReviewRequired,
  terminal,
  unknown,
}

enum SupplierNextActor {
  supplier,
  learner,
  driver,
  admin,
  system,
  none,
  unknown,
}

enum SupplierSummaryBucket {
  needsSupplierResponse,
  waitingForLearner,
  fulfillmentInProgress,
  adminReview,
  completed,
  closed,
  unknown,
}

enum SupplierReservationAction {
  accept,
  decline,
  sendMessage,
  completeSelfPickup,
  proposeReschedule,
  acceptLearnerReschedule,
  closeReservation,
  markLearnerNoShow,
  reportIncident,
  reportNoDriver,
  markDeliveryPickupExpired,
  reportDriverNoShow,
  submitRecoveryPickupWindow,
  unknown,
}

class SupplierEnumValue<T> {
  const SupplierEnumValue(this.value, this.rawValue);

  final T value;
  final String? rawValue;
}

SupplierEnumValue<SupplierWorkflowPhase> _workflowPhase(Object? value) {
  final raw = value as String?;
  const values = {
    'INITIAL_DECISION': SupplierWorkflowPhase.initialDecision,
    'SCHEDULING': SupplierWorkflowPhase.scheduling,
    'SELF_PICKUP': SupplierWorkflowPhase.selfPickup,
    'DELIVERY': SupplierWorkflowPhase.delivery,
    'RECOVERY': SupplierWorkflowPhase.recovery,
    'COMPLETED': SupplierWorkflowPhase.completed,
    'CLOSED': SupplierWorkflowPhase.closed,
  };
  return SupplierEnumValue(values[raw] ?? SupplierWorkflowPhase.unknown, raw);
}

SupplierEnumValue<SupplierAttentionState> _attentionState(Object? value) {
  final raw = value as String?;
  const values = {
    'SUPPLIER_ACTION_REQUIRED': SupplierAttentionState.supplierActionRequired,
    'WAITING_FOR_LEARNER': SupplierAttentionState.waitingForLearner,
    'FULFILLMENT_IN_PROGRESS': SupplierAttentionState.fulfillmentInProgress,
    'ADMIN_REVIEW_REQUIRED': SupplierAttentionState.adminReviewRequired,
    'TERMINAL': SupplierAttentionState.terminal,
  };
  return SupplierEnumValue(values[raw] ?? SupplierAttentionState.unknown, raw);
}

SupplierEnumValue<SupplierNextActor> _nextActor(Object? value) {
  final raw = value as String?;
  const values = {
    'SUPPLIER': SupplierNextActor.supplier,
    'LEARNER': SupplierNextActor.learner,
    'DRIVER': SupplierNextActor.driver,
    'ADMIN': SupplierNextActor.admin,
    'SYSTEM': SupplierNextActor.system,
    'NONE': SupplierNextActor.none,
  };
  return SupplierEnumValue(values[raw] ?? SupplierNextActor.unknown, raw);
}

SupplierEnumValue<SupplierSummaryBucket> _summaryBucket(Object? value) {
  final raw = value as String?;
  const values = {
    'NEEDS_SUPPLIER_RESPONSE': SupplierSummaryBucket.needsSupplierResponse,
    'WAITING_FOR_LEARNER': SupplierSummaryBucket.waitingForLearner,
    'FULFILLMENT_IN_PROGRESS': SupplierSummaryBucket.fulfillmentInProgress,
    'ADMIN_REVIEW': SupplierSummaryBucket.adminReview,
    'COMPLETED': SupplierSummaryBucket.completed,
    'CLOSED': SupplierSummaryBucket.closed,
  };
  return SupplierEnumValue(values[raw] ?? SupplierSummaryBucket.unknown, raw);
}

class SupplierAvailableAction
    extends SupplierEnumValue<SupplierReservationAction> {
  const SupplierAvailableAction(super.value, super.rawValue);

  factory SupplierAvailableAction.fromJson(Object? value) {
    final raw = value as String?;
    const values = {
      'ACCEPT': SupplierReservationAction.accept,
      'DECLINE': SupplierReservationAction.decline,
      'SEND_MESSAGE': SupplierReservationAction.sendMessage,
      'COMPLETE_SELF_PICKUP': SupplierReservationAction.completeSelfPickup,
      'PROPOSE_RESCHEDULE': SupplierReservationAction.proposeReschedule,
      'ACCEPT_LEARNER_RESCHEDULE':
          SupplierReservationAction.acceptLearnerReschedule,
      'CLOSE_RESERVATION': SupplierReservationAction.closeReservation,
      'MARK_LEARNER_NO_SHOW': SupplierReservationAction.markLearnerNoShow,
      'REPORT_INCIDENT': SupplierReservationAction.reportIncident,
      'REPORT_NO_DRIVER': SupplierReservationAction.reportNoDriver,
      'MARK_DELIVERY_PICKUP_EXPIRED':
          SupplierReservationAction.markDeliveryPickupExpired,
      'REPORT_DRIVER_NO_SHOW': SupplierReservationAction.reportDriverNoShow,
      'SUBMIT_RECOVERY_PICKUP_WINDOW':
          SupplierReservationAction.submitRecoveryPickupWindow,
    };
    return SupplierAvailableAction(
      values[raw] ?? SupplierReservationAction.unknown,
      raw,
    );
  }

  bool get isExecutable => value != SupplierReservationAction.unknown;
}

enum SupplierIncomingRequestTab {
  all,
  pending,
  needsLearner,
  accepted,
  declined,
  completed,
  cancelled,
}

enum SupplierIncomingRequestStatus {
  pending,
  accepted,
  awaitingConfirmation,
  awaitingSupplierConfirmation,
  declined,
  expired,
  completed,
  cancelled,
  noShow,
  fulfillmentFailed,
  needsResolution,
}

extension SupplierIncomingRequestTabLabels on SupplierIncomingRequestTab {
  String get label {
    switch (this) {
      case SupplierIncomingRequestTab.all:
        return 'All';
      case SupplierIncomingRequestTab.pending:
        return 'Pending';
      case SupplierIncomingRequestTab.needsLearner:
        return 'Needs learner';
      case SupplierIncomingRequestTab.accepted:
        return 'Accepted';
      case SupplierIncomingRequestTab.declined:
        return 'Declined';
      case SupplierIncomingRequestTab.completed:
        return 'Completed';
      case SupplierIncomingRequestTab.cancelled:
        return 'Cancelled';
    }
  }

  String get apiQueryValue {
    switch (this) {
      case SupplierIncomingRequestTab.all:
        return 'all';
      case SupplierIncomingRequestTab.pending:
        return 'pending';
      case SupplierIncomingRequestTab.needsLearner:
        return 'needs_learner';
      case SupplierIncomingRequestTab.accepted:
        return 'accepted';
      case SupplierIncomingRequestTab.declined:
        return 'declined';
      case SupplierIncomingRequestTab.completed:
        return 'completed';
      case SupplierIncomingRequestTab.cancelled:
        return 'cancelled';
    }
  }

  String get emptyMessage {
    switch (this) {
      case SupplierIncomingRequestTab.all:
        return 'No requests yet';
      case SupplierIncomingRequestTab.pending:
        return 'No pending requests';
      case SupplierIncomingRequestTab.needsLearner:
        return 'No requests waiting for learner';
      case SupplierIncomingRequestTab.accepted:
        return 'No accepted pickups yet.';
      case SupplierIncomingRequestTab.declined:
        return 'No declined requests.';
      case SupplierIncomingRequestTab.completed:
        return 'No completed pickups yet.';
      case SupplierIncomingRequestTab.cancelled:
        return 'No cancelled requests.';
    }
  }

  String get emptySubtitle {
    switch (this) {
      case SupplierIncomingRequestTab.all:
        return 'New learner requests will appear here.';
      case SupplierIncomingRequestTab.pending:
        return 'New learner requests will appear here.';
      case SupplierIncomingRequestTab.needsLearner:
        return 'Reservations awaiting learner confirmation appear here.';
      case SupplierIncomingRequestTab.accepted:
        return 'Accepted requests with pickup windows will show here.';
      case SupplierIncomingRequestTab.declined:
        return 'Requests you decline will be listed here.';
      case SupplierIncomingRequestTab.completed:
        return 'Finished pickups will appear here.';
      case SupplierIncomingRequestTab.cancelled:
        return 'Cancelled reservations will appear here.';
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
        return 'Waiting for learner confirmation';
      case SupplierIncomingRequestStatus.awaitingSupplierConfirmation:
        return 'Waiting for supplier response';
      case SupplierIncomingRequestStatus.declined:
        return 'Declined';
      case SupplierIncomingRequestStatus.expired:
        return 'Expired — no response';
      case SupplierIncomingRequestStatus.completed:
        return 'Completed';
      case SupplierIncomingRequestStatus.cancelled:
        return 'Cancelled';
      case SupplierIncomingRequestStatus.noShow:
        return 'Learner no-show';
      case SupplierIncomingRequestStatus.fulfillmentFailed:
        return 'Fulfillment failed';
      case SupplierIncomingRequestStatus.needsResolution:
        return 'Pending admin review';
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
      case 'AWAITING_SUPPLIER_CONFIRMATION':
        return SupplierIncomingRequestStatus.awaitingSupplierConfirmation;
      case 'REJECTED':
        return SupplierIncomingRequestStatus.declined;
      case 'EXPIRED':
        return SupplierIncomingRequestStatus.expired;
      case 'CANCELLED':
        return SupplierIncomingRequestStatus.cancelled;
      case 'COMPLETED':
        return SupplierIncomingRequestStatus.completed;
      case 'NO_SHOW':
        return SupplierIncomingRequestStatus.noShow;
      case 'FULFILLMENT_FAILED':
        return SupplierIncomingRequestStatus.fulfillmentFailed;
      case 'AWAITING_RESOLUTION':
        return SupplierIncomingRequestStatus.needsResolution;
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
      case SupplierIncomingRequestStatus.awaitingSupplierConfirmation:
        return 'AWAITING_SUPPLIER_CONFIRMATION';
      case SupplierIncomingRequestStatus.declined:
        return 'REJECTED';
      case SupplierIncomingRequestStatus.expired:
        return 'EXPIRED';
      case SupplierIncomingRequestStatus.completed:
        return 'COMPLETED';
      case SupplierIncomingRequestStatus.cancelled:
        return 'CANCELLED';
      case SupplierIncomingRequestStatus.noShow:
        return 'NO_SHOW';
      case SupplierIncomingRequestStatus.fulfillmentFailed:
        return 'FULFILLMENT_FAILED';
      case SupplierIncomingRequestStatus.needsResolution:
        return 'AWAITING_RESOLUTION';
    }
  }
}

class SupplierPickupWindow {
  const SupplierPickupWindow({
    required this.start,
    required this.end,
    this.note,
    this.selectedPreferredWindowIndex,
    this.proposedDeliveryWindowStart,
    this.proposedDeliveryWindowEnd,
  });

  final DateTime start;
  final DateTime end;
  final String? note;
  final int? selectedPreferredWindowIndex;
  final DateTime? proposedDeliveryWindowStart;
  final DateTime? proposedDeliveryWindowEnd;

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
      if (proposedDeliveryWindowStart != null)
        'proposedDeliveryWindowStart': proposedDeliveryWindowStart!
            .toUtc()
            .toIso8601String(),
      if (proposedDeliveryWindowEnd != null)
        'proposedDeliveryWindowEnd': proposedDeliveryWindowEnd!
            .toUtc()
            .toIso8601String(),
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
        return 'Waiting for driver';
      case 'DRIVER_ASSIGNED':
      case 'ARRIVED_PICKUP':
        return 'Driver assigned';
      case 'PICKED_UP':
        return 'Picked up by driver';
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
      case 'DRIVER_NO_SHOW':
        return 'Driver no-show';
      case 'LEARNER_NO_SHOW':
        return 'Learner no-show';
      case 'AWAITING_RESOLUTION':
        return 'Needs admin review';
      default:
        return 'Delivery requested';
    }
  }
}

class SupplierReservationPagination {
  const SupplierReservationPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;

  factory SupplierReservationPagination.fromJson(Map<String, dynamic> json) =>
      SupplierReservationPagination(
        page: (json['page'] as num?)?.toInt() ?? 0,
        limit: (json['limit'] as num?)?.toInt() ?? 0,
        total: (json['total'] as num?)?.toInt() ?? 0,
        totalPages: (json['totalPages'] as num?)?.toInt() ?? 0,
      );
}

class SupplierReservationSummary {
  const SupplierReservationSummary({
    required this.total,
    required this.needsSupplierResponse,
    required this.waitingForLearner,
    required this.fulfillmentInProgress,
    required this.adminReview,
    required this.completed,
    required this.closed,
  });

  final int total;
  final int needsSupplierResponse;
  final int waitingForLearner;
  final int fulfillmentInProgress;
  final int adminReview;
  final int completed;
  final int closed;

  factory SupplierReservationSummary.fromJson(Map<String, dynamic> json) =>
      SupplierReservationSummary(
        total: (json['total'] as num?)?.toInt() ?? 0,
        needsSupplierResponse:
            (json['needsSupplierResponse'] as num?)?.toInt() ?? 0,
        waitingForLearner: (json['waitingForLearner'] as num?)?.toInt() ?? 0,
        fulfillmentInProgress:
            (json['fulfillmentInProgress'] as num?)?.toInt() ?? 0,
        adminReview: (json['adminReview'] as num?)?.toInt() ?? 0,
        completed: (json['completed'] as num?)?.toInt() ?? 0,
        closed: (json['closed'] as num?)?.toInt() ?? 0,
      );

  bool get isReconciled =>
      needsSupplierResponse +
          waitingForLearner +
          fulfillmentInProgress +
          adminReview +
          completed +
          closed ==
      total;
}

class SupplierReservationListResponse {
  const SupplierReservationListResponse({
    this.items = const [],
    this.pagination,
    this.summary,
    this.usedLegacyReservations = false,
  });

  final List<SupplierIncomingRequest> items;
  final SupplierReservationPagination? pagination;
  final SupplierReservationSummary? summary;
  final bool usedLegacyReservations;

  factory SupplierReservationListResponse.fromData(Map<String, dynamic> data) {
    final itemSource = data['items'] is List
        ? data['items'] as List
        : data['reservations'] is List
        ? data['reservations'] as List
        : const <dynamic>[];
    return SupplierReservationListResponse(
      items: _immutableList(
        itemSource.whereType<Map>().map(
          (item) =>
              SupplierIncomingRequest.fromJson(Map<String, dynamic>.from(item)),
        ),
      ),
      pagination: _jsonMap(
        data['pagination'],
      )?.let(SupplierReservationPagination.fromJson),
      summary: _jsonMap(
        data['summary'],
      )?.let(SupplierReservationSummary.fromJson),
      usedLegacyReservations:
          data['items'] is! List && data['reservations'] is List,
    );
  }
}

extension on Map<String, dynamic> {
  T let<T>(T Function(Map<String, dynamic>) mapper) => mapper(this);
}

class SupplierFulfillmentSummary {
  const SupplierFulfillmentSummary({
    this.fulfillmentMethod,
    this.pickupAllowed,
    this.deliverySelected,
    this.label,
  });

  final String? fulfillmentMethod;
  final bool? pickupAllowed;
  final bool? deliverySelected;
  final String? label;

  factory SupplierFulfillmentSummary.fromJson(Map<String, dynamic> json) =>
      SupplierFulfillmentSummary(
        fulfillmentMethod: json['fulfillmentMethod'] as String?,
        pickupAllowed: json['pickupAllowed'] as bool?,
        deliverySelected: json['deliverySelected'] as bool?,
        label: json['label'] as String?,
      );
}

class SupplierScheduleWindow {
  const SupplierScheduleWindow({this.start, this.end});

  final DateTime? start;
  final DateTime? end;

  factory SupplierScheduleWindow.fromJson(Map<String, dynamic>? json) =>
      SupplierScheduleWindow(
        start: _jsonDate(json?['start']),
        end: _jsonDate(json?['end']),
      );
}

class SupplierPendingReschedule {
  const SupplierPendingReschedule({
    required this.requestedBy,
    this.reason,
    this.note,
    this.proposedPickupWindow,
  });

  final SupplierEnumValue<SupplierNextActor> requestedBy;
  final String? reason;
  final String? note;
  final SupplierScheduleWindow? proposedPickupWindow;

  factory SupplierPendingReschedule.fromJson(Map<String, dynamic> json) =>
      SupplierPendingReschedule(
        requestedBy: _nextActor(json['requestedBy']),
        reason: json['reason'] as String?,
        note: json['note'] as String?,
        proposedPickupWindow: SupplierScheduleWindow(
          start: _jsonDate(json['proposedPickupWindowStart']),
          end: _jsonDate(json['proposedPickupWindowEnd']),
        ),
      );
}

class SupplierRecoveryContext {
  const SupplierRecoveryContext({
    required this.initiatedBy,
    this.reason,
    this.note,
  });

  final SupplierEnumValue<SupplierNextActor> initiatedBy;
  final String? reason;
  final String? note;

  factory SupplierRecoveryContext.fromJson(Map<String, dynamic> json) =>
      SupplierRecoveryContext(
        initiatedBy: _nextActor(json['initiatedBy']),
        reason: json['reason'] as String?,
        note: json['note'] as String?,
      );
}

class SupplierScheduleSummary {
  const SupplierScheduleSummary({
    this.activeWindowType,
    this.effectiveWindow,
    this.pendingProposalSource,
    this.pendingReschedule,
    this.recoveryContext,
    this.schedulingConflictReason,
    this.earliestDeliveryStart,
  });

  final String? activeWindowType;
  final SupplierScheduleWindow? effectiveWindow;
  final SupplierEnumValue<SupplierNextActor>? pendingProposalSource;
  final SupplierPendingReschedule? pendingReschedule;
  final SupplierRecoveryContext? recoveryContext;
  final String? schedulingConflictReason;
  final DateTime? earliestDeliveryStart;

  factory SupplierScheduleSummary.fromJson(Map<String, dynamic> json) =>
      SupplierScheduleSummary(
        activeWindowType: json['activeWindowType'] as String?,
        effectiveWindow: SupplierScheduleWindow(
          start: _jsonDate(json['effectiveWindowStart']),
          end: _jsonDate(json['effectiveWindowEnd']),
        ),
        pendingProposalSource: json['pendingProposalSource'] == null
            ? null
            : _nextActor(json['pendingProposalSource']),
        pendingReschedule: _jsonMap(
          json['pendingReschedule'],
        )?.let(SupplierPendingReschedule.fromJson),
        recoveryContext: _jsonMap(
          json['recoveryContext'],
        )?.let(SupplierRecoveryContext.fromJson),
        schedulingConflictReason: json['schedulingConflictReason'] as String?,
        earliestDeliveryStart: _jsonDate(json['earliestDeliveryStart']),
      );
}

class SupplierDriverSummary {
  const SupplierDriverSummary({
    this.id,
    this.userId,
    this.displayName,
    this.profileImageUrl,
  });

  final String? id;
  final String? userId;
  final String? displayName;
  final String? profileImageUrl;

  factory SupplierDriverSummary.fromJson(Map<String, dynamic> json) =>
      SupplierDriverSummary(
        id: json['id'] as String?,
        userId: json['userId'] as String?,
        displayName: json['displayName'] as String?,
        profileImageUrl: json['profileImageUrl'] as String?,
      );
}

class SupplierDeliverySummary {
  const SupplierDeliverySummary({
    this.deliveryId,
    this.status,
    this.driver,
    this.requestedAt,
    this.assignedAt,
    this.pickedUpAt,
    this.deliveredAt,
    this.failedAt,
    this.failureReason,
    this.recoveryRequired,
  });

  final String? deliveryId;
  final String? status;
  final SupplierDriverSummary? driver;
  final DateTime? requestedAt;
  final DateTime? assignedAt;
  final DateTime? pickedUpAt;
  final DateTime? deliveredAt;
  final DateTime? failedAt;
  final String? failureReason;
  final bool? recoveryRequired;

  factory SupplierDeliverySummary.fromJson(Map<String, dynamic> json) =>
      SupplierDeliverySummary(
        deliveryId: json['deliveryId'] as String?,
        status: json['status'] as String?,
        driver: _jsonMap(json['driver'])?.let(SupplierDriverSummary.fromJson),
        requestedAt: _jsonDate(json['requestedAt']),
        assignedAt: _jsonDate(json['assignedAt']),
        pickedUpAt: _jsonDate(json['pickedUpAt']),
        deliveredAt: _jsonDate(json['deliveredAt']),
        failedAt: _jsonDate(json['failedAt']),
        failureReason: json['failureReason'] as String?,
        recoveryRequired: json['recoveryRequired'] as bool?,
      );
}

class SupplierGroupSummary {
  const SupplierGroupSummary({
    this.groupId,
    this.status,
    this.itemCount,
    this.grouped,
    this.driver,
    this.items = const [],
    this.hasMoreItems,
  });

  final String? groupId;
  final String? status;
  final int? itemCount;
  final bool? grouped;
  final SupplierDriverSummary? driver;
  final List<Map<String, dynamic>> items;
  final bool? hasMoreItems;

  factory SupplierGroupSummary.fromJson(Map<String, dynamic> json) =>
      SupplierGroupSummary(
        groupId: json['groupId'] as String?,
        status: json['status'] as String? ?? json['groupStatus'] as String?,
        itemCount: (json['itemCount'] as num?)?.toInt(),
        grouped: json['grouped'] as bool?,
        driver: _jsonMap(json['driver'])?.let(SupplierDriverSummary.fromJson),
        items: _immutableList(
          (json['items'] as List? ?? const <dynamic>[]).whereType<Map>().map(
            Map<String, dynamic>.from,
          ),
        ),
        hasMoreItems: json['hasMoreItems'] as bool?,
      );
}

class SupplierIncidentSummary {
  const SupplierIncidentSummary({
    this.id,
    this.targetUserId,
    this.targetRole,
    this.status,
    this.reasonCode,
    this.note,
    this.createdAt,
    this.reviewedAt,
    this.reviewNote,
    this.workflowType,
    this.operationalState,
    this.strikeImpact,
  });

  final String? id;
  final String? targetUserId;
  final String? targetRole;
  final String? status;
  final String? reasonCode;
  final String? note;
  final DateTime? createdAt;
  final DateTime? reviewedAt;
  final String? reviewNote;
  final String? workflowType;
  final String? operationalState;
  final String? strikeImpact;

  factory SupplierIncidentSummary.fromJson(Map<String, dynamic> json) =>
      SupplierIncidentSummary(
        id: json['id'] as String? ?? json['reportId'] as String?,
        targetUserId: json['targetUserId'] as String?,
        targetRole: json['targetRole'] as String?,
        status: json['status'] as String? ?? json['reportStatus'] as String?,
        reasonCode: json['reasonCode'] as String?,
        note: json['note'] as String? ?? json['context'] as String?,
        createdAt: _jsonDate(json['createdAt']),
        reviewedAt: _jsonDate(json['reviewedAt']),
        reviewNote: json['reviewNote'] as String?,
        workflowType: json['workflowType'] as String?,
        operationalState: json['operationalState'] as String?,
        strikeImpact: json['strikeImpact'] as String?,
      );
}

class SupplierReservationMessageSummary {
  const SupplierReservationMessageSummary({
    this.id,
    this.senderRole,
    this.senderId,
    this.body,
    this.createdAt,
  });

  final String? id;
  final String? senderRole;
  final String? senderId;
  final String? body;
  final DateTime? createdAt;

  factory SupplierReservationMessageSummary.fromJson(
    Map<String, dynamic> json,
  ) {
    final sender = _jsonMap(json['sender']);
    return SupplierReservationMessageSummary(
      id: json['id'] as String?,
      senderRole: json['senderRole'] as String?,
      senderId: json['senderId'] as String? ?? sender?['id'] as String?,
      body: json['body'] as String?,
      createdAt: _jsonDate(json['createdAt']),
    );
  }
}

class SupplierMessageSummary {
  const SupplierMessageSummary({
    this.latestMessage,
    this.latestSenderRole,
    this.latestTimestamp,
    this.messageCount,
    this.matchesOriginalLearnerNote,
  });

  final SupplierReservationMessageSummary? latestMessage;
  final String? latestSenderRole;
  final DateTime? latestTimestamp;
  final int? messageCount;
  final bool? matchesOriginalLearnerNote;

  factory SupplierMessageSummary.fromJson(Map<String, dynamic> json) =>
      SupplierMessageSummary(
        latestMessage: _jsonMap(
          json['latestMessage'],
        )?.let(SupplierReservationMessageSummary.fromJson),
        latestSenderRole: json['latestSenderRole'] as String?,
        latestTimestamp: _jsonDate(json['latestTimestamp']),
        messageCount: (json['messageCount'] as num?)?.toInt(),
        matchesOriginalLearnerNote: json['matchesOriginalLearnerNote'] as bool?,
      );
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
    this.statusRaw,
    this.completedAt,
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
    this.activeDelivery,
    this.canSupplierComplete = false,
    this.materialImageUrl,
    this.learnerNote,
    this.pickupWindow,
    this.declineReason,
    this.isOverdue = false,
    this.needsFollowUp = false,
    this.pickupWindowStatus,
    this.pickupHandoverPhase,
    this.canSupplierCloseOverduePickup = false,
    this.canSupplierReportAndCloseOverduePickup = false,
    this.canSupplierReschedule = false,
    this.canSupplierAcceptLearnerReschedule = false,
    this.canSupplierProposeDifferentTime = false,
    this.canSupplierCloseAwaitingLearnerRequest = false,
    this.canSupplierReportAwaitingLearnerRequest = false,
    this.canReportNoDriverAvailable = false,
    this.canSupplierMarkDeliveryPickupExpired = false,
    this.canSupplierReportDriverNoShow = false,
    this.assignedDriverPickupOverdue = false,
    this.canSubmitNoDriverPickupWindow = false,
    this.pendingRescheduleReason,
    this.pendingRescheduleNote,
    this.learnerProposedPickupWindow,
    this.canSendMessage = false,
    this.noShowReport,
    this.latestMessage,
    this.supplierHandoverCode,
    this.deliveryGroupId,
    this.groupedDelivery = false,
    this.groupItemCount,
    this.combinedDeliveryLabel,
    this.workflowPhase,
    this.attentionState,
    this.nextActor,
    this.summaryBucket,
    this.availableActions = const [],
    this.fulfillmentContract,
    this.scheduleSummary,
    this.deliverySummary,
    this.incidentSummary,
    this.groupSummary,
    this.messageSummary,
    this.handoverPayment,
  });

  final String id;
  final String materialTitle;
  final String? materialImageUrl;
  final String learnerName;
  final double quantityRequested;
  final String unit;
  final SupplierIncomingRequestStatus status;

  /// Retains the backend value so new states are not coerced downstream.
  final String? statusRaw;
  final DateTime requestedAt;
  final DateTime? completedAt;
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
  final SupplierReservationDeliverySummary? activeDelivery;
  final bool canSupplierComplete;
  final String? learnerNote;
  final SupplierPickupWindow? pickupWindow;
  final String? declineReason;
  final bool isOverdue;
  final bool needsFollowUp;
  final String? pickupWindowStatus;
  final String? pickupHandoverPhase;
  final bool canSupplierCloseOverduePickup;
  final bool canSupplierReportAndCloseOverduePickup;
  final bool canSupplierReschedule;
  final bool canSupplierAcceptLearnerReschedule;
  final bool canSupplierProposeDifferentTime;
  final bool canSupplierCloseAwaitingLearnerRequest;
  final bool canSupplierReportAwaitingLearnerRequest;
  final bool canReportNoDriverAvailable;
  final bool canSupplierMarkDeliveryPickupExpired;
  final bool canSupplierReportDriverNoShow;
  final bool assignedDriverPickupOverdue;
  final bool canSubmitNoDriverPickupWindow;
  final String? pendingRescheduleReason;
  final String? pendingRescheduleNote;
  final SupplierPickupWindow? learnerProposedPickupWindow;
  final bool canSendMessage;
  final Map<String, dynamic>? noShowReport;
  final ReservationMessage? latestMessage;
  final String? supplierHandoverCode;
  final String? deliveryGroupId;
  final bool groupedDelivery;
  final int? groupItemCount;
  final String? combinedDeliveryLabel;
  final SupplierEnumValue<SupplierWorkflowPhase>? workflowPhase;
  final SupplierEnumValue<SupplierAttentionState>? attentionState;
  final SupplierEnumValue<SupplierNextActor>? nextActor;
  final SupplierEnumValue<SupplierSummaryBucket>? summaryBucket;
  final List<SupplierAvailableAction> availableActions;
  final SupplierFulfillmentSummary? fulfillmentContract;
  final SupplierScheduleSummary? scheduleSummary;
  final SupplierDeliverySummary? deliverySummary;
  final SupplierIncidentSummary? incidentSummary;
  final SupplierGroupSummary? groupSummary;
  final SupplierMessageSummary? messageSummary;
  final HandoverPaymentSummary? handoverPayment;

  bool get hasDelivery => isDeliveryFulfillment || activeDelivery != null;

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

  bool get isDeliveryFulfillment =>
      fulfillmentMethod.toUpperCase() == 'DELIVERY';

  String get supplierActionStatusLabel {
    if (status == SupplierIncomingRequestStatus.awaitingSupplierConfirmation &&
        canSubmitNoDriverPickupWindow) {
      return 'New pickup window needed';
    }

    return status.label;
  }

  bool get isReadOnlyFinalState =>
      status == SupplierIncomingRequestStatus.completed ||
      status == SupplierIncomingRequestStatus.cancelled ||
      status == SupplierIncomingRequestStatus.expired ||
      status == SupplierIncomingRequestStatus.needsResolution ||
      noShowReport != null;

  bool get isPickupFulfillment => !isDeliveryFulfillment;

  String get fulfillmentSummary =>
      fulfillmentLabel ??
      (isDeliveryFulfillment ? 'Delivery selected' : 'Pickup selected');

  String get awaitingConfirmationMessage {
    if (schedulingConflictReason != null &&
        schedulingConflictReason!.trim().isNotEmpty) {
      return 'Scheduling conflict — waiting for learner confirmation';
    }

    if (isDeliveryFulfillment) {
      return 'Waiting for learner to confirm delivery window';
    }

    return 'Proposed pickup time — waiting for learner confirmation';
  }

  String get deliveryStatusLabel {
    if (status == SupplierIncomingRequestStatus.awaitingConfirmation) {
      return 'Waiting for learner confirmation';
    }

    if (activeDelivery?.status.toUpperCase() == 'WAITING_FOR_DRIVER' &&
        canMarkOrReportNoDriverAvailable) {
      return 'Driver not assigned in time';
    }

    return activeDelivery?.statusLabel ?? 'Waiting for driver';
  }

  bool get shouldShowSupplierHandoverCode =>
      isDeliveryFulfillment &&
      status == SupplierIncomingRequestStatus.accepted &&
      supplierHandoverCode != null &&
      supplierHandoverCode!.trim().isNotEmpty &&
      activeDelivery != null &&
      activeDelivery!.status.toUpperCase() != 'DELIVERED' &&
      !canMarkOrReportNoDriverAvailable;

  SupplierIncomingRequest copyWith({
    SupplierIncomingRequestStatus? status,
    String? statusRaw,
    DateTime? completedAt,
    SupplierPickupWindow? pickupWindow,
    bool? canSupplierComplete,
    String? declineReason,
    bool? isOverdue,
    bool? needsFollowUp,
    String? pickupWindowStatus,
    String? pickupHandoverPhase,
    bool? canSupplierCloseOverduePickup,
    bool? canSupplierReportAndCloseOverduePickup,
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
      statusRaw: statusRaw ?? this.statusRaw,
      requestedAt: requestedAt,
      completedAt: completedAt ?? this.completedAt,
      activeDelivery: activeDelivery,
      canSupplierComplete: canSupplierComplete ?? this.canSupplierComplete,
      learnerNote: learnerNote,
      pickupWindow: pickupWindow ?? this.pickupWindow,
      declineReason: declineReason ?? this.declineReason,
      isOverdue: isOverdue ?? this.isOverdue,
      needsFollowUp: needsFollowUp ?? this.needsFollowUp,
      pickupWindowStatus: pickupWindowStatus ?? this.pickupWindowStatus,
      pickupHandoverPhase: pickupHandoverPhase ?? this.pickupHandoverPhase,
      canSupplierCloseOverduePickup:
          canSupplierCloseOverduePickup ?? this.canSupplierCloseOverduePickup,
      canSupplierReportAndCloseOverduePickup:
          canSupplierReportAndCloseOverduePickup ??
          this.canSupplierReportAndCloseOverduePickup,
      canSupplierReschedule:
          canSupplierReschedule ?? this.canSupplierReschedule,
      canSendMessage: canSendMessage ?? this.canSendMessage,
      noShowReport: noShowReport ?? this.noShowReport,
      latestMessage: latestMessage ?? this.latestMessage,
      deliveryGroupId: deliveryGroupId,
      groupedDelivery: groupedDelivery,
      groupItemCount: groupItemCount,
      combinedDeliveryLabel: combinedDeliveryLabel,
      supplierHandoverCode: supplierHandoverCode,
      workflowPhase: workflowPhase,
      attentionState: attentionState,
      nextActor: nextActor,
      summaryBucket: summaryBucket,
      availableActions: availableActions,
      fulfillmentContract: fulfillmentContract,
      scheduleSummary: scheduleSummary,
      deliverySummary: deliverySummary,
      incidentSummary: incidentSummary,
      groupSummary: groupSummary,
      messageSummary: messageSummary,
      handoverPayment: handoverPayment,
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

    final fulfillmentMethod = json['fulfillmentMethod'] as String? ?? 'PICKUP';
    final fulfillmentLabel = json['fulfillmentLabel'] as String?;
    final activeDeliveryJson = json['activeDelivery'];
    final activeDelivery = activeDeliveryJson is Map
        ? SupplierReservationDeliverySummary.fromJson(
            Map<String, dynamic>.from(activeDeliveryJson),
          )
        : null;
    final fulfillmentSummaryJson = _jsonMap(json['fulfillmentSummary']);
    final scheduleSummaryJson = _jsonMap(json['scheduleSummary']);
    final deliverySummaryJson = _jsonMap(json['deliverySummary']);
    final incidentSummaryJson = _jsonMap(json['incidentSummary']);
    final groupSummaryJson = _jsonMap(json['groupSummary']);
    final messageSummaryJson = _jsonMap(json['messageSummary']);

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

      final parsedStart = DateTime.tryParse(start);
      final parsedEnd = DateTime.tryParse(end);
      if (parsedStart == null || parsedEnd == null) {
        return null;
      }

      return SupplierPickupWindow(start: parsedStart, end: parsedEnd);
    }

    final statusRaw = json['status'] as String? ?? 'PENDING';
    final status = SupplierIncomingRequestStatusLabels.fromApiValue(statusRaw);
    final canSupplierComplete =
        json['canSupplierComplete'] as bool? ??
        (status == SupplierIncomingRequestStatus.accepted &&
            activeDelivery == null &&
            fulfillmentMethod.toUpperCase() != 'DELIVERY');

    SupplierPickupWindow? pickupWindow;
    final start = json['pickupWindowStart'] as String?;
    final end = json['pickupWindowEnd'] as String?;
    if (start != null && end != null) {
      final parsedStart = DateTime.tryParse(start);
      final parsedEnd = DateTime.tryParse(end);
      if (parsedStart != null && parsedEnd != null) {
        pickupWindow = SupplierPickupWindow(
          start: parsedStart,
          end: parsedEnd,
          note: json['supplierNote'] as String?,
        );
      }
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
      statusRaw: statusRaw,
      requestedAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      completedAt: _jsonDate(json['completedAt']),
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
      activeDelivery: activeDelivery,
      canSupplierComplete: canSupplierComplete,
      learnerNote: json['message'] as String?,
      pickupWindow: pickupWindow,
      declineReason:
          json['rejectionReason'] as String? ??
          json['declineReason'] as String?,
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
      canSupplierAcceptLearnerReschedule:
          json['canSupplierAcceptLearnerReschedule'] == true,
      canSupplierProposeDifferentTime:
          json['canSupplierProposeDifferentTime'] == true,
      canSupplierCloseAwaitingLearnerRequest:
          json['canSupplierCloseAwaitingLearnerRequest'] == true,
      canSupplierReportAwaitingLearnerRequest:
          json['canSupplierReportAwaitingLearnerRequest'] == true,
      canReportNoDriverAvailable: json['canReportNoDriverAvailable'] == true,
      canSupplierMarkDeliveryPickupExpired:
          json['canSupplierMarkDeliveryPickupExpired'] == true,
      canSupplierReportDriverNoShow:
          json['canSupplierReportDriverNoShow'] == true,
      assignedDriverPickupOverdue: json['assignedDriverPickupOverdue'] == true,
      canSubmitNoDriverPickupWindow:
          json['canSubmitNoDriverPickupWindow'] == true,
      pendingRescheduleReason: () {
        final pending = json['pendingReschedule'];
        if (pending is Map) {
          return pending['reason'] as String?;
        }
        return null;
      }(),
      pendingRescheduleNote: () {
        final pending = json['pendingReschedule'];
        if (pending is Map) {
          return pending['note'] as String?;
        }
        return null;
      }(),
      learnerProposedPickupWindow: () {
        final fromTopLevel = parseWindow(
          'learnerProposedPickupWindowStart',
          'learnerProposedPickupWindowEnd',
        );
        if (fromTopLevel != null) {
          return fromTopLevel;
        }

        final pending = json['pendingReschedule'];
        if (pending is! Map) {
          return null;
        }

        final start = pending['proposedPickupWindowStart'] as String?;
        final end = pending['proposedPickupWindowEnd'] as String?;
        if (start == null || end == null) {
          return null;
        }

        return SupplierPickupWindow(
          start: DateTime.parse(start),
          end: DateTime.parse(end),
        );
      }(),
      canSendMessage: json['canSendMessage'] == true,
      noShowReport: json['noShowReport'] is Map
          ? Map<String, dynamic>.from(json['noShowReport'] as Map)
          : null,
      latestMessage: json['latestMessage'] is Map
          ? ReservationMessage.fromJson(
              Map<String, dynamic>.from(json['latestMessage'] as Map),
            )
          : null,
      supplierHandoverCode: json['supplierHandoverCode'] as String?,
      deliveryGroupId: json['deliveryGroupId'] as String?,
      groupedDelivery: json['groupedDelivery'] == true,
      groupItemCount: (json['groupItemCount'] as num?)?.toInt(),
      combinedDeliveryLabel: json['combinedDeliveryLabel'] as String?,
      workflowPhase: json['workflowPhase'] == null
          ? null
          : _workflowPhase(json['workflowPhase']),
      attentionState: json['attentionState'] == null
          ? null
          : _attentionState(json['attentionState']),
      nextActor: json['nextActor'] == null
          ? null
          : _nextActor(json['nextActor']),
      summaryBucket: json['summaryBucket'] == null
          ? null
          : _summaryBucket(json['summaryBucket']),
      availableActions: _immutableList(
        (json['availableActions'] as List? ?? const <dynamic>[]).map(
          SupplierAvailableAction.fromJson,
        ),
      ),
      fulfillmentContract: fulfillmentSummaryJson?.let(
        SupplierFulfillmentSummary.fromJson,
      ),
      scheduleSummary: scheduleSummaryJson?.let(
        SupplierScheduleSummary.fromJson,
      ),
      deliverySummary: deliverySummaryJson?.let(
        SupplierDeliverySummary.fromJson,
      ),
      incidentSummary: incidentSummaryJson?.let(
        SupplierIncidentSummary.fromJson,
      ),
      groupSummary: groupSummaryJson?.let(SupplierGroupSummary.fromJson),
      messageSummary: messageSummaryJson?.let(SupplierMessageSummary.fromJson),
      handoverPayment: _jsonMap(
        json['handoverPayment'],
      )?.let(HandoverPaymentSummary.fromJson),
    );
  }
}

class SupplierReservationDetailIdentity {
  const SupplierReservationDetailIdentity({
    required this.reservationId,
    this.material,
    this.learner,
    this.quantityRequested,
    this.createdAt,
    this.updatedAt,
  });

  final String reservationId;
  final Map<String, dynamic>? material;
  final Map<String, dynamic>? learner;
  final double? quantityRequested;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory SupplierReservationDetailIdentity.fromJson(
    Map<String, dynamic> json,
  ) => SupplierReservationDetailIdentity(
    reservationId: json['reservationId'] as String? ?? '',
    material: _jsonMap(json['material']),
    learner: _jsonMap(json['learner']),
    quantityRequested: (json['quantityRequested'] as num?)?.toDouble(),
    createdAt: _jsonDate(json['createdAt']),
    updatedAt: _jsonDate(json['updatedAt']),
  );
}

class SupplierReservationDetailRequest {
  const SupplierReservationDetailRequest({
    this.originalLearnerNote,
    this.fulfillmentMethod,
    this.learnerPreferredPickupWindows = const [],
    this.learnerPreferredDeliveryWindows = const [],
    this.deliveryAddressText,
    this.safeDropoffAllowed,
    this.deliveryNote,
  });

  final String? originalLearnerNote;
  final String? fulfillmentMethod;
  final List<ReservationPreferredWindow> learnerPreferredPickupWindows;
  final List<ReservationPreferredWindow> learnerPreferredDeliveryWindows;
  final String? deliveryAddressText;
  final bool? safeDropoffAllowed;
  final String? deliveryNote;

  factory SupplierReservationDetailRequest.fromJson(Map<String, dynamic> json) {
    List<ReservationPreferredWindow> windows(String key) => _immutableList(
      (json[key] as List? ?? const <dynamic>[]).whereType<Map>().map(
        (item) => ReservationPreferredWindow.fromJson(
          Map<String, dynamic>.from(item),
        ),
      ),
    );
    return SupplierReservationDetailRequest(
      originalLearnerNote: json['originalLearnerNote'] as String?,
      fulfillmentMethod: json['fulfillmentMethod'] as String?,
      learnerPreferredPickupWindows: windows('learnerPreferredPickupWindows'),
      learnerPreferredDeliveryWindows: windows(
        'learnerPreferredDeliveryWindows',
      ),
      deliveryAddressText: json['deliveryAddressText'] as String?,
      safeDropoffAllowed: json['safeDropoffAllowed'] as bool?,
      deliveryNote: json['deliveryNote'] as String?,
    );
  }
}

class SupplierReservationHistoryEntry {
  const SupplierReservationHistoryEntry({
    this.id,
    this.statusGroup,
    this.oldStatus,
    this.newStatus,
    this.eventCode,
    this.reasonText,
    this.note,
    this.createdAt,
    this.actor,
  });

  final String? id;
  final String? statusGroup;
  final String? oldStatus;
  final String? newStatus;
  final String? eventCode;
  final String? reasonText;
  final String? note;
  final DateTime? createdAt;
  final Map<String, dynamic>? actor;

  factory SupplierReservationHistoryEntry.fromJson(Map<String, dynamic> json) =>
      SupplierReservationHistoryEntry(
        id: json['id'] as String?,
        statusGroup: json['statusGroup'] as String?,
        oldStatus: json['oldStatus'] as String?,
        newStatus: json['newStatus'] as String?,
        eventCode: json['eventCode'] as String?,
        reasonText: json['reasonText'] as String?,
        note: json['note'] as String?,
        createdAt: _jsonDate(json['createdAt']),
        actor: _jsonMap(json['actor']),
      );
}

class SupplierReservationDetailSchedule {
  const SupplierReservationDetailSchedule({
    required this.summary,
    this.supplierProposal,
    this.learnerProposal,
    this.confirmedPickupWindow,
    this.supplierDeliveryPickupWindow,
    this.confirmedDeliveryWindow,
  });

  final SupplierScheduleSummary summary;
  final SupplierScheduleWindow? supplierProposal;
  final SupplierScheduleWindow? learnerProposal;
  final SupplierScheduleWindow? confirmedPickupWindow;
  final SupplierScheduleWindow? supplierDeliveryPickupWindow;
  final SupplierScheduleWindow? confirmedDeliveryWindow;

  factory SupplierReservationDetailSchedule.fromJson(
    Map<String, dynamic> json,
  ) => SupplierReservationDetailSchedule(
    summary: SupplierScheduleSummary.fromJson(json),
    supplierProposal: _jsonMap(
      json['supplierProposal'],
    )?.let(SupplierScheduleWindow.fromJson),
    learnerProposal: _jsonMap(
      json['learnerProposal'],
    )?.let(SupplierScheduleWindow.fromJson),
    confirmedPickupWindow: _jsonMap(
      json['confirmedPickupWindow'],
    )?.let(SupplierScheduleWindow.fromJson),
    supplierDeliveryPickupWindow: _jsonMap(
      json['supplierDeliveryPickupWindow'],
    )?.let(SupplierScheduleWindow.fromJson),
    confirmedDeliveryWindow: _jsonMap(
      json['confirmedDeliveryWindow'],
    )?.let(SupplierScheduleWindow.fromJson),
  );
}

class SupplierReservationDetail {
  const SupplierReservationDetail({
    required this.reservation,
    this.identity,
    this.request,
    this.schedule,
    this.messages = const [],
    this.messageCount,
    this.messagesTruncated,
    this.delivery,
    this.group,
    this.incident,
    this.history = const [],
  });

  final SupplierIncomingRequest reservation;
  final SupplierReservationDetailIdentity? identity;
  final SupplierReservationDetailRequest? request;
  final SupplierReservationDetailSchedule? schedule;
  final List<SupplierReservationMessageSummary> messages;
  final int? messageCount;
  final bool? messagesTruncated;
  final SupplierDeliverySummary? delivery;
  final SupplierGroupSummary? group;
  final SupplierIncidentSummary? incident;
  final List<SupplierReservationHistoryEntry> history;

  factory SupplierReservationDetail.fromJson(Map<String, dynamic> json) {
    final messages = _jsonMap(json['messages']);
    return SupplierReservationDetail(
      reservation: SupplierIncomingRequest.fromJson(json),
      identity: _jsonMap(
        json['identity'],
      )?.let(SupplierReservationDetailIdentity.fromJson),
      request: _jsonMap(
        json['request'],
      )?.let(SupplierReservationDetailRequest.fromJson),
      schedule: _jsonMap(
        json['schedule'],
      )?.let(SupplierReservationDetailSchedule.fromJson),
      messages: _immutableList(
        (messages?['items'] as List? ?? const <dynamic>[]).whereType<Map>().map(
          (item) => SupplierReservationMessageSummary.fromJson(
            Map<String, dynamic>.from(item),
          ),
        ),
      ),
      messageCount: (messages?['count'] as num?)?.toInt(),
      messagesTruncated: messages?['truncated'] as bool?,
      delivery: _jsonMap(
        json['delivery'],
      )?.let(SupplierDeliverySummary.fromJson),
      group: _jsonMap(json['group'])?.let(SupplierGroupSummary.fromJson),
      incident: _jsonMap(
        json['incident'],
      )?.let(SupplierIncidentSummary.fromJson),
      history: _immutableList(
        (json['history'] as List? ?? const <dynamic>[]).whereType<Map>().map(
          (item) => SupplierReservationHistoryEntry.fromJson(
            Map<String, dynamic>.from(item),
          ),
        ),
      ),
    );
  }
}
