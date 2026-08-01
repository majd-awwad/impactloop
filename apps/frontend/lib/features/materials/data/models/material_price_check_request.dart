class MaterialPriceCheckRequest {
  const MaterialPriceCheckRequest({
    required this.isFree,
    required this.categoryId,
    this.materialName,
    this.materialTypeId,
    required this.condition,
    required this.quantity,
    required this.unit,
    this.price,
    this.currency = 'NIS',
  });

  final bool isFree;
  final String categoryId;
  final String? materialName;
  final String? materialTypeId;
  final String condition;
  final double quantity;
  final String unit;
  final double? price;
  final String currency;

  Map<String, dynamic> toJson() {
    return {
      'isFree': isFree,
      'categoryId': categoryId,
      'materialName': materialName,
      if (materialTypeId != null) 'materialTypeId': materialTypeId,
      'condition': condition,
      'quantity': quantity,
      'unit': unit,
      'price': price,
      'currency': currency,
    };
  }
}
