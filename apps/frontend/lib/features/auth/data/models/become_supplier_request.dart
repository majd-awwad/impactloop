class BecomeSupplierRequest {
  const BecomeSupplierRequest({
    required this.supplierType,
    required this.publicName,
    required this.pickupArea,
    this.description,
    this.workingHours,
    this.pickupNotes,
  });

  final String supplierType;
  final String publicName;
  final String pickupArea;
  final String? description;
  final String? workingHours;
  final String? pickupNotes;

  Map<String, dynamic> toJson() {
    return {
      'supplierType': supplierType,
      'publicName': publicName,
      'pickupArea': pickupArea,
      if (description != null && description!.trim().isNotEmpty)
        'description': description!.trim(),
      if (workingHours != null && workingHours!.trim().isNotEmpty)
        'workingHours': workingHours!.trim(),
      if (pickupNotes != null && pickupNotes!.trim().isNotEmpty)
        'pickupNotes': pickupNotes!.trim(),
    };
  }
}
