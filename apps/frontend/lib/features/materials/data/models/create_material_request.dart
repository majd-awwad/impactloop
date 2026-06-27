class CreateMaterialPickupLocationRequest {
  const CreateMaterialPickupLocationRequest({
    required this.country,
    required this.city,
    this.area,
    this.addressLine,
    this.latitude,
    this.longitude,
    this.visibility = 'ORDER_ONLY',
    this.isApproximate = true,
    this.locationType = 'MATERIAL_PICKUP',
  });

  final String country;
  final String city;
  final String? area;
  final String? addressLine;
  final double? latitude;
  final double? longitude;
  final String visibility;
  final bool isApproximate;
  final String locationType;

  Map<String, dynamic> toJson() {
    return {
      'country': country,
      'city': city,
      'area': area,
      'addressLine': addressLine,
      'latitude': latitude,
      'longitude': longitude,
      'visibility': visibility,
      'isApproximate': isApproximate,
      'locationType': locationType,
    };
  }
}

class CreateMaterialRequest {
  const CreateMaterialRequest({
    required this.materialName,
    required this.title,
    required this.description,
    required this.categoryId,
    required this.quantity,
    required this.unit,
    required this.condition,
    required this.isFree,
    this.price,
    this.currency = 'NIS',
    this.pickupAllowed = true,
    this.deliveryAllowed = false,
    this.pickupNotes,
    this.suggestedUses,
    this.imageUrls = const [],
    this.sourceCategoryRequestId,
    this.sourcePriceRuleRequestId,
    this.useDefaultPickupLocation = true,
    this.pickupLocation,
  });

  final String materialName;
  final String title;
  final String description;
  final String categoryId;
  final double quantity;
  final String unit;
  final String condition;
  final bool isFree;
  final double? price;
  final String currency;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final String? pickupNotes;
  final String? suggestedUses;
  final List<String> imageUrls;
  final String? sourceCategoryRequestId;
  final String? sourcePriceRuleRequestId;
  final bool useDefaultPickupLocation;
  final CreateMaterialPickupLocationRequest? pickupLocation;

  Map<String, dynamic> toJson() {
    return {
      'materialName': materialName,
      'title': title,
      'description': description,
      'categoryId': categoryId,
      'quantity': quantity,
      'unit': unit,
      'condition': condition,
      'isFree': isFree,
      'price': price,
      'currency': currency,
      'pickupAllowed': pickupAllowed,
      'deliveryAllowed': deliveryAllowed,
      'pickupNotes': pickupNotes,
      'suggestedUses': suggestedUses,
      'imageUrls': imageUrls,
      'useDefaultPickupLocation': useDefaultPickupLocation,
      if (!useDefaultPickupLocation && pickupLocation != null)
        'pickupLocation': pickupLocation!.toJson(),
      if (sourceCategoryRequestId != null)
        'sourceCategoryRequestId': sourceCategoryRequestId,
      if (sourcePriceRuleRequestId != null)
        'sourcePriceRuleRequestId': sourcePriceRuleRequestId,
    };
  }
}
