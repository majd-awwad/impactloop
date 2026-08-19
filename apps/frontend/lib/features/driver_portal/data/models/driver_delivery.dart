import '../../../../shared/models/handover_payment_summary.dart';

class DriverDeliveryItem {
  const DriverDeliveryItem({
    required this.reservationId,
    required this.materialId,
    required this.title,
    required this.quantity,
    required this.unit,
    this.condition,
    this.materialSubtotal,
  });

  final String reservationId;
  final String materialId;
  final String title;
  final double quantity;
  final String unit;
  final String? condition;
  final double? materialSubtotal;

  factory DriverDeliveryItem.fromJson(Map<String, dynamic> json) {
    return DriverDeliveryItem(
      reservationId: json['reservationId'] as String? ?? '',
      materialId: json['materialId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      quantity: _doubleFromJson(json['quantity']) ?? 0,
      unit: json['unit'] as String? ?? '',
      condition: json['condition'] as String?,
      materialSubtotal: _doubleFromJson(json['materialSubtotal']),
    );
  }

  String get quantityLabel {
    final value = quantity % 1 == 0
        ? quantity.toInt().toString()
        : quantity.toStringAsFixed(2);
    return unit.trim().isEmpty ? value : '$value $unit';
  }
}

class DriverDeliveryMaterial {
  const DriverDeliveryMaterial({
    required this.id,
    required this.title,
    required this.quantityRequested,
    required this.unit,
  });

  final String id;
  final String title;
  final double quantityRequested;
  final String unit;

  factory DriverDeliveryMaterial.fromJson(Map<String, dynamic> json) {
    return DriverDeliveryMaterial(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      quantityRequested: _doubleFromJson(json['quantityRequested']) ?? 0,
      unit: json['unit'] as String? ?? '',
    );
  }

  String get quantityLabel {
    final quantity = quantityRequested % 1 == 0
        ? quantityRequested.toInt().toString()
        : quantityRequested.toStringAsFixed(2);
    return unit.trim().isEmpty ? quantity : '$quantity $unit';
  }
}

class DriverDeliveryParty {
  const DriverDeliveryParty({this.id, required this.displayName, this.phone});

  final String? id;
  final String displayName;
  final String? phone;

  factory DriverDeliveryParty.fromJson(Map<String, dynamic> json) {
    return DriverDeliveryParty(
      id: json['id'] as String?,
      displayName: json['displayName'] as String? ?? '',
      phone: json['phone'] as String?,
    );
  }
}

class DriverSafeLocation {
  const DriverSafeLocation({
    this.id,
    this.country,
    this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.isApproximate,
  });

  final String? id;
  final String? country;
  final String? city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final bool? isApproximate;

  factory DriverSafeLocation.fromJson(Map<String, dynamic> json) {
    return DriverSafeLocation(
      id: json['id'] as String?,
      country: json['country'] as String?,
      city: json['city'] as String?,
      area: json['area'] as String?,
      addressLine: json['addressLine'] as String?,
      latitude: _doubleFromJson(json['latitude']),
      longitude: _doubleFromJson(json['longitude']),
      isApproximate: json['isApproximate'] as bool?,
    );
  }

  String get safeSummary {
    final parts = [city, area]
        .where((item) => item != null && item.trim().isNotEmpty)
        .cast<String>()
        .toList(growable: false);
    return parts.isEmpty ? '' : parts.join(', ');
  }

  String get exactSummary {
    final parts = [addressLine, area, city, country]
        .where((item) => item != null && item.trim().isNotEmpty)
        .cast<String>()
        .toList(growable: false);
    return parts.isEmpty ? safeSummary : parts.join(', ');
  }

  bool get hasExactCoordinates => latitude != null && longitude != null;
}

class DriverPreferredDeliveryWindow {
  const DriverPreferredDeliveryWindow({required this.start, required this.end});

  final DateTime start;
  final DateTime end;

  static DriverPreferredDeliveryWindow? fromJson(Map<String, dynamic> json) {
    final start = _dateFromJson(json['start'] ?? json['windowStart']);
    final end = _dateFromJson(json['end'] ?? json['windowEnd']);
    if (start == null || end == null) return null;
    return DriverPreferredDeliveryWindow(start: start, end: end);
  }
}

class DriverDeliveryAttempt {
  const DriverDeliveryAttempt({
    required this.attemptNumber,
    required this.attemptedAt,
    required this.failureReason,
    required this.learnerContactAttempted,
    required this.outcome,
    this.note,
    this.retryWindowStart,
    this.retryWindowEnd,
    this.retryDeadline,
  });

  final int attemptNumber;
  final DateTime attemptedAt;
  final String failureReason;
  final bool learnerContactAttempted;
  final String outcome;
  final String? note;
  final DateTime? retryWindowStart;
  final DateTime? retryWindowEnd;
  final DateTime? retryDeadline;

  factory DriverDeliveryAttempt.fromJson(Map<String, dynamic> json) {
    return DriverDeliveryAttempt(
      attemptNumber: (json['attemptNumber'] as num?)?.toInt() ?? 0,
      attemptedAt: _dateFromJson(json['attemptedAt']) ?? DateTime.now(),
      failureReason: json['failureReason'] as String? ?? '',
      learnerContactAttempted: json['learnerContactAttempted'] == true,
      outcome: json['outcome'] as String? ?? '',
      note: json['note'] as String?,
      retryWindowStart: _dateFromJson(json['retryWindowStart']),
      retryWindowEnd: _dateFromJson(json['retryWindowEnd']),
      retryDeadline: _dateFromJson(json['retryDeadline']),
    );
  }
}

class DriverDelivery {
  const DriverDelivery({
    required this.id,
    required this.reservationId,
    required this.status,
    required this.requestedAt,
    this.pickupWindowStart,
    this.pickupWindowEnd,
    required this.material,
    required this.supplier,
    this.learner,
    required this.pickupLocation,
    required this.dropoffLocation,
    this.deliveryGroupId,
    this.groupedDelivery = false,
    this.itemCount = 1,
    this.items = const [],
    this.groupDeliveryFee,
    this.groupCurrency,
    this.assignedAt,
    this.arrivedPickupAt,
    this.pickedUpAt,
    this.onTheWayAt,
    this.arrivedDropoffAt,
    this.deliveredAt,
    this.learnerNote,
    this.driverNote,
    this.supplierPickupWindowStart,
    this.supplierPickupWindowEnd,
    this.confirmedDeliveryWindowStart,
    this.confirmedDeliveryWindowEnd,
    this.canDriverReportPickupFailed = false,
    this.canDriverReportDeliveryFailed = false,
    this.canDriverReportDriverIssue = false,
    this.canShareLocation = false,
    this.pickupCity,
    this.pickupArea,
    this.dropoffCity,
    this.dropoffArea,
    this.distanceKm,
    this.distanceLabel,
    this.handoverPayment,
    this.learnerPreferredDeliveryWindows = const [],
    this.scheduleOccurrence = 0,
    this.deliveryAttempts = const [],
    this.retryDeadline,
    this.returnRequiredAt,
    this.returnReason,
    this.returnedToSupplierAt,
  });

  final String id;
  final String reservationId;
  final String status;
  final DateTime requestedAt;
  final String? deliveryGroupId;
  final bool groupedDelivery;
  final int itemCount;
  final List<DriverDeliveryItem> items;
  final double? groupDeliveryFee;
  final String? groupCurrency;
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;
  final DriverDeliveryMaterial material;
  final DriverDeliveryParty supplier;
  final DriverDeliveryParty? learner;
  final DriverSafeLocation pickupLocation;
  final DriverSafeLocation dropoffLocation;
  final DateTime? assignedAt;
  final DateTime? arrivedPickupAt;
  final DateTime? pickedUpAt;
  final DateTime? onTheWayAt;
  final DateTime? arrivedDropoffAt;
  final DateTime? deliveredAt;
  final String? learnerNote;
  final String? driverNote;
  final DateTime? supplierPickupWindowStart;
  final DateTime? supplierPickupWindowEnd;
  final DateTime? confirmedDeliveryWindowStart;
  final DateTime? confirmedDeliveryWindowEnd;
  final bool canDriverReportPickupFailed;
  final bool canDriverReportDeliveryFailed;
  final bool canDriverReportDriverIssue;
  final bool canShareLocation;
  final String? pickupCity;
  final String? pickupArea;
  final String? dropoffCity;
  final String? dropoffArea;
  final double? distanceKm;
  final String? distanceLabel;
  final HandoverPaymentSummary? handoverPayment;
  final List<DriverPreferredDeliveryWindow> learnerPreferredDeliveryWindows;
  final int scheduleOccurrence;
  final List<DriverDeliveryAttempt> deliveryAttempts;
  final DateTime? retryDeadline;
  final DateTime? returnRequiredAt;
  final String? returnReason;
  final DateTime? returnedToSupplierAt;

  factory DriverDelivery.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    final items = itemsJson is List
        ? itemsJson
              .whereType<Map>()
              .map(
                (item) => DriverDeliveryItem.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
        : const <DriverDeliveryItem>[];
    final preferredWindows =
        (json['learnerPreferredDeliveryWindows'] as List? ?? const [])
            .whereType<Map>()
            .map(
              (item) => DriverPreferredDeliveryWindow.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .whereType<DriverPreferredDeliveryWindow>()
            .toList(growable: false);
    final attempts = (json['deliveryAttempts'] as List? ?? const [])
        .whereType<Map>()
        .map(
          (item) =>
              DriverDeliveryAttempt.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList(growable: false);

    return DriverDelivery(
      id: json['id'] as String? ?? '',
      reservationId: json['reservationId'] as String? ?? '',
      deliveryGroupId: json['deliveryGroupId'] as String?,
      groupedDelivery: json['groupedDelivery'] == true,
      itemCount: (json['itemCount'] as num?)?.toInt() ?? items.length,
      items: items,
      groupDeliveryFee: _doubleFromJson(json['groupDeliveryFee']),
      groupCurrency: json['groupCurrency'] as String?,
      status: json['status'] as String? ?? 'WAITING_FOR_DRIVER',
      requestedAt: _dateFromJson(json['requestedAt']) ?? DateTime.now(),
      pickupWindowStart: _dateFromJson(json['pickupWindowStart']),
      pickupWindowEnd: _dateFromJson(json['pickupWindowEnd']),
      material: DriverDeliveryMaterial.fromJson(
        Map<String, dynamic>.from(json['material'] as Map? ?? const {}),
      ),
      supplier: DriverDeliveryParty.fromJson(
        Map<String, dynamic>.from(json['supplier'] as Map? ?? const {}),
      ),
      learner: json['learner'] is Map
          ? DriverDeliveryParty.fromJson(
              Map<String, dynamic>.from(json['learner'] as Map),
            )
          : null,
      pickupLocation: DriverSafeLocation.fromJson(
        Map<String, dynamic>.from(json['pickupLocation'] as Map? ?? const {}),
      ),
      dropoffLocation: DriverSafeLocation.fromJson(
        Map<String, dynamic>.from(json['dropoffLocation'] as Map? ?? const {}),
      ),
      assignedAt: _dateFromJson(json['assignedAt']),
      arrivedPickupAt: _dateFromJson(json['arrivedPickupAt']),
      pickedUpAt: _dateFromJson(json['pickedUpAt']),
      onTheWayAt: _dateFromJson(json['onTheWayAt']),
      arrivedDropoffAt: _dateFromJson(json['arrivedDropoffAt']),
      deliveredAt: _dateFromJson(json['deliveredAt']),
      learnerNote: json['learnerNote'] as String?,
      driverNote: json['driverNote'] as String?,
      supplierPickupWindowStart: _dateFromJson(
        json['supplierPickupWindowStart'],
      ),
      supplierPickupWindowEnd: _dateFromJson(json['supplierPickupWindowEnd']),
      confirmedDeliveryWindowStart: _dateFromJson(
        json['confirmedDeliveryWindowStart'],
      ),
      confirmedDeliveryWindowEnd: _dateFromJson(
        json['confirmedDeliveryWindowEnd'],
      ),
      canDriverReportPickupFailed: json['canDriverReportPickupFailed'] == true,
      canDriverReportDeliveryFailed:
          json['canDriverReportDeliveryFailed'] == true,
      canDriverReportDriverIssue: json['canDriverReportDriverIssue'] == true,
      canShareLocation: json.containsKey('canShareLocation')
          ? json['canShareLocation'] == true
          : isDriverAutoPingEligibleStatus(json['status'] as String? ?? ''),
      pickupCity: json['pickupCity'] as String?,
      pickupArea: json['pickupArea'] as String?,
      dropoffCity: json['dropoffCity'] as String?,
      dropoffArea: json['dropoffArea'] as String?,
      distanceKm: _doubleFromJson(json['distanceKm']),
      distanceLabel: json['distanceLabel'] as String?,
      handoverPayment: json['handoverPayment'] is Map
          ? HandoverPaymentSummary.fromJson(
              Map<String, dynamic>.from(json['handoverPayment'] as Map),
            )
          : null,
      learnerPreferredDeliveryWindows: preferredWindows,
      scheduleOccurrence: (json['scheduleOccurrence'] as num?)?.toInt() ?? 0,
      deliveryAttempts: attempts,
      retryDeadline: _dateFromJson(json['retryDeadline']),
      returnRequiredAt: _dateFromJson(json['returnRequiredAt']),
      returnReason: json['returnReason'] as String?,
      returnedToSupplierAt: _dateFromJson(json['returnedToSupplierAt']),
    );
  }

  bool get isAssigned => learner != null;

  bool get hasOperationalDeliveryWindow =>
      confirmedDeliveryWindowStart != null &&
      confirmedDeliveryWindowEnd != null;

  bool get needsDriverDeliveryWindow =>
      status == 'REDELIVERY_PENDING' ||
      (status == 'PICKED_UP' && !hasOperationalDeliveryWindow);

  String? get nextStatus {
    switch (status) {
      case 'DRIVER_ASSIGNED':
        return 'ARRIVED_PICKUP';
      case 'ARRIVED_PICKUP':
        return 'PICKED_UP';
      case 'PICKED_UP':
        return confirmedDeliveryWindowStart != null &&
                confirmedDeliveryWindowEnd != null
            ? 'ON_THE_WAY'
            : null;
      case 'REDELIVERY_SCHEDULED':
        return 'ON_THE_WAY';
      case 'ON_THE_WAY':
        return 'ARRIVED_DROPOFF';
      case 'ARRIVED_DROPOFF':
        return 'DELIVERED';
      default:
        return null;
    }
  }

  bool get isAutoPingEligible => isDriverAutoPingEligibleStatus(status);

  bool get hasGroupedItems => groupedDelivery && items.isNotEmpty;

  List<String> get groupedItemLines => items
      .map((item) => '${item.title} × ${item.quantityLabel}')
      .toList(growable: false);
}

const driverAutoPingEligibleStatuses = {
  'PICKED_UP',
  'REDELIVERY_PENDING',
  'REDELIVERY_SCHEDULED',
  'RETURN_TO_SUPPLIER_REQUIRED',
  'ON_THE_WAY',
  'ARRIVED_DROPOFF',
};

bool isDriverAutoPingEligibleStatus(String status) {
  return driverAutoPingEligibleStatuses.contains(status);
}

DateTime? _dateFromJson(Object? value) {
  if (value is! String || value.trim().isEmpty) {
    return null;
  }

  return DateTime.tryParse(value)?.toLocal();
}

double? _doubleFromJson(Object? value) {
  if (value is num) {
    return value.toDouble();
  }

  if (value is String) {
    return double.tryParse(value);
  }

  return null;
}
