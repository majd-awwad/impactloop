class LearnerReservationMaterial {
  const LearnerReservationMaterial({
    required this.id,
    required this.title,
    required this.materialType,
    required this.status,
    required this.deliveryAllowed,
    this.unit = 'piece',
    this.imageUrl,
    this.city,
    this.area,
  });

  final String id;
  final String title;
  final String materialType;
  final String status;
  final bool deliveryAllowed;
  final String unit;
  final String? imageUrl;
  final String? city;
  final String? area;

  factory LearnerReservationMaterial.fromJson(Map<String, dynamic> json) {
    return LearnerReservationMaterial(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      materialType: json['materialType'] as String? ?? '',
      status: json['status'] as String? ?? '',
      deliveryAllowed: json['deliveryAllowed'] == true,
      unit: json['unit'] as String? ?? 'piece',
      imageUrl: json['imageUrl'] as String?,
      city: json['city'] as String?,
      area: json['area'] as String?,
    );
  }

  String get locationLabel {
    if (city != null && area != null) {
      return '$city, $area';
    }

    return city ?? area ?? 'Location shared later';
  }
}

class LearnerReservationSupplier {
  const LearnerReservationSupplier({
    required this.id,
    required this.displayName,
  });

  final String id;
  final String displayName;

  factory LearnerReservationSupplier.fromJson(Map<String, dynamic> json) {
    return LearnerReservationSupplier(
      id: json['id'] as String? ?? '',
      displayName: json['displayName'] as String? ?? 'Supplier',
    );
  }
}

class LearnerReservation {
  const LearnerReservation({
    required this.id,
    required this.status,
    required this.quantityRequested,
    this.message,
    required this.createdAt,
    required this.updatedAt,
    this.pickupWindowStart,
    this.pickupWindowEnd,
    this.supplierNote,
    this.rejectionReason,
    required this.material,
    required this.supplier,
  });

  final String id;
  final String status;
  final double quantityRequested;
  final String? message;
  final DateTime createdAt;
  final DateTime updatedAt;
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;
  final String? supplierNote;
  final String? rejectionReason;
  final LearnerReservationMaterial material;
  final LearnerReservationSupplier supplier;

  factory LearnerReservation.fromJson(Map<String, dynamic> json) {
    final materialJson = json['material'];
    final supplierJson = json['supplier'];

    return LearnerReservation(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      quantityRequested: (json['quantityRequested'] as num?)?.toDouble() ?? 0,
      message: json['message'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      pickupWindowStart: DateTime.tryParse(
        json['pickupWindowStart'] as String? ?? '',
      ),
      pickupWindowEnd: DateTime.tryParse(
        json['pickupWindowEnd'] as String? ?? '',
      ),
      supplierNote: json['supplierNote'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      material: LearnerReservationMaterial.fromJson(
        materialJson is Map<String, dynamic>
            ? materialJson
            : const <String, dynamic>{},
      ),
      supplier: LearnerReservationSupplier.fromJson(
        supplierJson is Map<String, dynamic>
            ? supplierJson
            : const <String, dynamic>{},
      ),
    );
  }

  bool get isPending => status == 'PENDING';
  bool get isAccepted => status == 'ACCEPTED';
  bool get isRejected => status == 'REJECTED';
  bool get isCompleted => status == 'COMPLETED';
  bool get isCancelled => status == 'CANCELLED';
  bool get isExpired => status == 'EXPIRED';
}
