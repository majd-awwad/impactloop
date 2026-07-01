class CreatedReservationMaterial {
  const CreatedReservationMaterial({
    required this.id,
    required this.title,
    required this.status,
    required this.quantity,
    required this.unit,
  });

  final String id;
  final String title;
  final String status;
  final double quantity;
  final String unit;

  factory CreatedReservationMaterial.fromJson(Map<String, dynamic> json) {
    return CreatedReservationMaterial(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      status: json['status'] as String? ?? '',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? '',
    );
  }
}

class CreatedReservation {
  const CreatedReservation({
    required this.id,
    required this.status,
    required this.material,
    required this.quantityRequested,
    this.message,
    required this.createdAt,
  });

  final String id;
  final String status;
  final CreatedReservationMaterial material;
  final double quantityRequested;
  final String? message;
  final DateTime createdAt;

  factory CreatedReservation.fromJson(Map<String, dynamic> json) {
    final materialJson = json['material'];

    return CreatedReservation(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      material: CreatedReservationMaterial.fromJson(
        materialJson is Map<String, dynamic>
            ? materialJson
            : const <String, dynamic>{},
      ),
      quantityRequested: (json['quantityRequested'] as num?)?.toDouble() ?? 0,
      message: json['message'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}
