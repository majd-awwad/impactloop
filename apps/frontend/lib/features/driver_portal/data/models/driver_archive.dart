import 'driver_delivery.dart';
import 'driver_deliveries_list_result.dart';

FormatException _contractError(String field) =>
    FormatException('Invalid Driver archive contract field: $field');

DateTime _requiredDate(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value is! String || value.trim().isEmpty) throw _contractError(field);
  final parsed = DateTime.tryParse(value);
  if (parsed == null) throw _contractError(field);
  return parsed.toLocal();
}

DateTime? _optionalDate(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value == null) return null;
  if (value is! String || value.trim().isEmpty) throw _contractError(field);
  final parsed = DateTime.tryParse(value);
  if (parsed == null) throw _contractError(field);
  return parsed.toLocal();
}

double _requiredDouble(Map<String, dynamic> json, String field) {
  final value = json[field];
  if (value is num) return value.toDouble();
  if (value is String) {
    final parsed = double.tryParse(value);
    if (parsed != null) return parsed;
  }
  throw _contractError(field);
}

class DriverDeliveryTimelineEntry {
  const DriverDeliveryTimelineEntry({
    required this.status,
    required this.occurredAt,
  });
  final String status;
  final DateTime occurredAt;

  factory DriverDeliveryTimelineEntry.fromJson(Map<String, dynamic> json) =>
      DriverDeliveryTimelineEntry(
        status: json['newStatus'] as String? ?? '',
        occurredAt: _requiredDate(json, 'occurredAt'),
      );
}

class DriverHistoricalCarriedItem {
  const DriverHistoricalCarriedItem({
    required this.reservationId,
    required this.materialId,
    required this.materialTitle,
    required this.quantity,
    required this.unit,
    this.condition,
    this.recordedAt,
  });

  final String reservationId;
  final String materialId;
  final String materialTitle;
  final double quantity;
  final String unit;
  final String? condition;
  final DateTime? recordedAt;

  factory DriverHistoricalCarriedItem.fromJson(Map<String, dynamic> json) =>
      DriverHistoricalCarriedItem(
        reservationId: json['reservationId'] as String? ?? '',
        materialId: json['materialId'] as String? ?? '',
        materialTitle: json['materialTitle'] as String? ?? '',
        quantity: _requiredDouble(json, 'quantity'),
        unit: json['unit'] as String? ?? '',
        condition: json['condition'] as String?,
        recordedAt: _optionalDate(json, 'recordedAt'),
      );

  String get quantityLabel {
    final value = quantity % 1 == 0
        ? quantity.toInt().toString()
        : quantity.toStringAsFixed(2);
    return unit.trim().isEmpty ? value : '$value $unit';
  }
}

class DriverHistoricalUnpickedItem extends DriverHistoricalCarriedItem {
  const DriverHistoricalUnpickedItem({
    required super.reservationId,
    required super.materialId,
    required super.materialTitle,
    required super.quantity,
    required super.unit,
    required this.unpickedReason,
    required this.recordedAtRequired,
    super.condition,
    super.recordedAt,
    this.driverNote,
  });

  final String unpickedReason;
  final String? driverNote;
  final DateTime recordedAtRequired;

  factory DriverHistoricalUnpickedItem.fromJson(Map<String, dynamic> json) {
    final recordedAt = _requiredDate(json, 'recordedAt');
    return DriverHistoricalUnpickedItem(
      reservationId: json['reservationId'] as String? ?? '',
      materialId: json['materialId'] as String? ?? '',
      materialTitle: json['materialTitle'] as String? ?? '',
      quantity: _requiredDouble(json, 'quantity'),
      unit: json['unit'] as String? ?? '',
      condition: json['condition'] as String?,
      unpickedReason: json['unpickedReason'] as String? ?? '',
      driverNote: json['driverNote'] as String?,
      recordedAt: recordedAt,
      recordedAtRequired: recordedAt,
    );
  }
}

class DriverHistoricalDelivery {
  const DriverHistoricalDelivery({
    required this.id,
    required this.status,
    required this.historicalAt,
    required this.assignmentOutcome,
    required this.supplier,
    required this.pickupLocation,
    required this.dropoffLocation,
    required this.carriedItems,
    required this.unpickedItems,
    required this.partialPickupOccurred,
    required this.itemAuditComplete,
    required this.timeline,
    this.failureReasonCode,
    this.assignedAt,
    this.pickedUpAt,
    this.deliveredAt,
    this.cancelledAt,
    this.failedAt,
    this.incidentReviewStatus,
  });

  final String id;
  final String status;
  final DateTime historicalAt;
  final String assignmentOutcome;
  final DriverDeliveryParty supplier;
  final DriverSafeLocation pickupLocation;
  final DriverSafeLocation dropoffLocation;
  final List<DriverHistoricalCarriedItem> carriedItems;
  final List<DriverHistoricalUnpickedItem> unpickedItems;
  final bool partialPickupOccurred;
  final bool itemAuditComplete;
  final String? failureReasonCode;
  final DateTime? assignedAt;
  final DateTime? pickedUpAt;
  final DateTime? deliveredAt;
  final DateTime? cancelledAt;
  final DateTime? failedAt;
  final String? incidentReviewStatus;
  final List<DriverDeliveryTimelineEntry> timeline;

  factory DriverHistoricalDelivery.fromJson(Map<String, dynamic> json) {
    final incident = json['incidentSummary'];
    return DriverHistoricalDelivery(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? '',
      historicalAt: _requiredDate(json, 'historicalAt'),
      assignmentOutcome: json['assignmentOutcome'] as String? ?? 'CLOSED',
      supplier: DriverDeliveryParty.fromJson(
        Map<String, dynamic>.from(json['supplier'] as Map? ?? const {}),
      ),
      pickupLocation: DriverSafeLocation.fromJson(
        Map<String, dynamic>.from(json['pickupLocation'] as Map? ?? const {}),
      ),
      dropoffLocation: DriverSafeLocation.fromJson(
        Map<String, dynamic>.from(json['dropoffLocation'] as Map? ?? const {}),
      ),
      carriedItems: (json['carriedItems'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) => DriverHistoricalCarriedItem.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(growable: false),
      unpickedItems: (json['unpickedItems'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) => DriverHistoricalUnpickedItem.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(growable: false),
      partialPickupOccurred: json['partialPickupOccurred'] == true,
      itemAuditComplete: json['itemAuditComplete'] == true,
      failureReasonCode: json['failureReasonCode'] as String?,
      assignedAt: _optionalDate(json, 'assignedAt'),
      pickedUpAt: _optionalDate(json, 'pickedUpAt'),
      deliveredAt: _optionalDate(json, 'deliveredAt'),
      cancelledAt: _optionalDate(json, 'cancelledAt'),
      failedAt: _optionalDate(json, 'failedAt'),
      incidentReviewStatus: incident is Map
          ? incident['reviewStatus'] as String?
          : null,
      timeline: (json['statusTimeline'] as List? ?? const [])
          .whereType<Map>()
          .map(
            (item) => DriverDeliveryTimelineEntry.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .toList(growable: false),
    );
  }
}

class DriverIncident {
  const DriverIncident({
    required this.id,
    required this.type,
    required this.reviewStatus,
    required this.createdAt,
    required this.resolutionOutcome,
    required this.materialTitle,
    this.reasonDetail,
    this.reporterNote,
    this.relatedDeliveryId,
    this.relatedDeliveryIsHistorical = true,
    this.recoveryDeliveryId,
    this.recoveryDeliveryIsHistorical = true,
  });

  final String id;
  final String type;
  final String reviewStatus;
  final DateTime createdAt;
  final String resolutionOutcome;
  final String materialTitle;
  final String? reasonDetail;
  final String? reporterNote;
  final String? relatedDeliveryId;
  final bool relatedDeliveryIsHistorical;
  final String? recoveryDeliveryId;
  final bool recoveryDeliveryIsHistorical;

  factory DriverIncident.fromJson(Map<String, dynamic> json) {
    final reservation = json['reservation'] as Map?;
    final material = reservation?['material'] as Map?;
    final related = json['relatedDelivery'] as Map?;
    final recovery = json['recoveryDelivery'] as Map?;
    return DriverIncident(
      id: json['id'] as String? ?? '',
      type: json['type'] as String? ?? '',
      reviewStatus: json['reviewStatus'] as String? ?? '',
      createdAt: _requiredDate(json, 'createdAt'),
      resolutionOutcome:
          json['resolutionOutcome'] as String? ?? 'NO_RECOVERY_UPDATE',
      materialTitle: material?['title'] as String? ?? '',
      reasonDetail: json['reporterReasonDetail'] as String?,
      reporterNote: json['reporterNote'] as String?,
      relatedDeliveryId: related?['id'] as String?,
      relatedDeliveryIsHistorical: related?['isHistorical'] != false,
      recoveryDeliveryId: recovery?['id'] as String?,
      recoveryDeliveryIsHistorical: recovery?['isHistorical'] != false,
    );
  }
}

class DriverArchivePage<T> {
  const DriverArchivePage({
    required this.items,
    required this.pagination,
    this.loadMoreError,
    this.invalidCursor = false,
  });
  final List<T> items;
  final DriverDeliveriesPagination pagination;
  final Object? loadMoreError;
  final bool invalidCursor;

  DriverArchivePage<T> appendDeduplicated(
    DriverArchivePage<T> next, {
    required String Function(T item) idOf,
  }) {
    final seen = items.map(idOf).toSet();
    return DriverArchivePage<T>(
      items: [...items, ...next.items.where((item) => seen.add(idOf(item)))],
      pagination: next.pagination,
    );
  }

  DriverArchivePage<T> withLoadMoreError(
    Object error, {
    required bool invalidCursor,
  }) => DriverArchivePage<T>(
    items: items,
    pagination: pagination,
    loadMoreError: error,
    invalidCursor: invalidCursor,
  );
}
