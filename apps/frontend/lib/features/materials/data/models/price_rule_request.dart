class PriceRuleRequestResult {
  const PriceRuleRequestResult({
    required this.id,
    required this.status,
    this.activePriceRule,
    this.aiStatus,
    this.aiProvider,
    this.message,
  });

  final String id;
  final String status;
  final Map<String, dynamic>? activePriceRule;
  final String? aiStatus;
  final String? aiProvider;
  final String? message;

  factory PriceRuleRequestResult.fromJson(Map<String, dynamic> json) {
    final activeRule = json['activePriceRule'];

    return PriceRuleRequestResult(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      activePriceRule: activeRule is Map<String, dynamic> ? activeRule : null,
      aiStatus: json['aiStatus'] as String?,
      aiProvider: json['aiProvider'] as String?,
      message: json['message'] as String?,
    );
  }
}

class CreatePriceRuleRequest {
  const CreatePriceRuleRequest({
    this.materialTypeId,
    this.materialName,
    this.categoryId,
    this.condition,
    this.quantity,
    this.unit,
    this.supplierPriceNis,
  });

  final String? materialTypeId;
  final String? materialName;
  final String? categoryId;
  final String? condition;
  final double? quantity;
  final String? unit;
  final double? supplierPriceNis;

  Map<String, dynamic> toJson() {
    return {
      if (materialTypeId != null) 'materialTypeId': materialTypeId,
      if (materialName != null) 'materialName': materialName,
      if (categoryId != null) 'categoryId': categoryId,
      if (condition != null) 'condition': condition,
      if (quantity != null) 'quantity': quantity,
      if (unit != null) 'unit': unit,
      if (supplierPriceNis != null) 'supplierPriceNis': supplierPriceNis,
    };
  }
}
