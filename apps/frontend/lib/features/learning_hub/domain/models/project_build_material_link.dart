class LinkedMaterialSummary {
  const LinkedMaterialSummary({
    required this.id,
    required this.title,
    required this.categoryNameEn,
    required this.condition,
    required this.status,
    required this.isPubliclyAvailable,
    required this.isFree,
    required this.currency,
    required this.supplierName,
    required this.city,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    this.imageUrl,
    this.availabilityWarning,
    this.price,
    this.supplierType,
    this.supplierVerified = false,
    this.area,
  });

  final String id;
  final String title;
  final String? imageUrl;
  final String categoryNameEn;
  final String condition;
  final String status;
  final bool isPubliclyAvailable;
  final String? availabilityWarning;
  final bool isFree;
  final double? price;
  final String currency;
  final String supplierName;
  final String? supplierType;
  final bool supplierVerified;
  final String city;
  final String? area;
  final bool pickupAllowed;
  final bool deliveryAllowed;

  String get locationLabel {
    final areaPart = area?.trim();
    if (areaPart != null && areaPart.isNotEmpty) {
      return '$city · $areaPart';
    }

    return city;
  }

  String get priceLabel {
    if (isFree) {
      return 'Free';
    }

    if (price == null) {
      return 'Paid';
    }

    return '$currency ${price!.toStringAsFixed(price! % 1 == 0 ? 0 : 2)}';
  }
}

class LinkedReservationSummary {
  const LinkedReservationSummary({
    required this.id,
    required this.status,
    required this.materialId,
    required this.needsAction,
    required this.statusLabel,
  });

  final String id;
  final String status;
  final String materialId;
  final bool needsAction;
  final String statusLabel;
}

class BuildMaterialCandidate {
  const BuildMaterialCandidate({
    required this.id,
    required this.title,
    required this.categoryNameEn,
    required this.condition,
    required this.status,
    required this.isFree,
    required this.currency,
    required this.supplierName,
    required this.city,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    required this.matchHints,
    this.imageUrl,
    this.price,
    this.area,
  });

  final String id;
  final String title;
  final String? imageUrl;
  final String categoryNameEn;
  final String condition;
  final String status;
  final bool isFree;
  final double? price;
  final String currency;
  final String supplierName;
  final String city;
  final String? area;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final List<String> matchHints;

  String get locationLabel {
    final areaPart = area?.trim();
    if (areaPart != null && areaPart.isNotEmpty) {
      return '$city · $areaPart';
    }

    return city;
  }

  String get priceLabel {
    if (isFree) {
      return 'Free';
    }

    if (price == null) {
      return 'Paid';
    }

    return '$currency ${price!.toStringAsFixed(price! % 1 == 0 ? 0 : 2)}';
  }
}

class BuildMaterialCandidatesResult {
  const BuildMaterialCandidatesResult({
    required this.itemId,
    required this.componentId,
    required this.searchTerm,
    required this.items,
  });

  final String itemId;
  final String componentId;
  final String searchTerm;
  final List<BuildMaterialCandidate> items;
}
