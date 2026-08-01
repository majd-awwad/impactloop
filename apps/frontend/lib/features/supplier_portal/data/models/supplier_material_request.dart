double? _numOrNull(Object? value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

double _numOrZero(Object? value) => _numOrNull(value) ?? 0;

DateTime? _dateOrNull(Object? value) {
  if (value == null) return null;
  if (value is DateTime) return value;
  return DateTime.tryParse(value.toString());
}

String _stringOrEmpty(Object? value) => value?.toString() ?? '';

class SupplierMaterialRequestLocation {
  const SupplierMaterialRequestLocation({
    required this.country,
    required this.city,
    this.area,
  });

  final String country;
  final String city;
  final String? area;

  factory SupplierMaterialRequestLocation.fromJson(
    Map<String, dynamic> json,
  ) {
    return SupplierMaterialRequestLocation(
      country: _stringOrEmpty(json['country']),
      city: _stringOrEmpty(json['city']),
      area: json['area'] as String?,
    );
  }

  String get displayLabel {
    final trimmedArea = area?.trim();
    if (trimmedArea != null && trimmedArea.isNotEmpty) {
      return '$city, $trimmedArea';
    }
    return city;
  }
}

class SupplierMaterialRequestProjectContext {
  const SupplierMaterialRequestProjectContext({
    required this.title,
    this.componentName,
  });

  final String title;
  final String? componentName;

  static SupplierMaterialRequestProjectContext? fromJsonOrNull(Object? value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);
    final title = json['title'] as String?;
    if (title == null || title.trim().isEmpty) return null;
    return SupplierMaterialRequestProjectContext(
      title: title,
      componentName: json['componentName'] as String?,
    );
  }
}

class SupplierMaterialRequestOwnMatch {
  const SupplierMaterialRequestOwnMatch({
    required this.id,
    required this.materialId,
    required this.status,
    this.matchReasonCode,
    this.rankingScore,
    this.reservationId,
    required this.createdAt,
    this.materialTitle,
  });

  final String id;
  final String materialId;
  final String status;
  final String? matchReasonCode;
  final double? rankingScore;
  final String? reservationId;
  final DateTime createdAt;
  final String? materialTitle;

  bool get isReserved => reservationId != null;

  static SupplierMaterialRequestOwnMatch fromJson(Map<String, dynamic> json) {
    return SupplierMaterialRequestOwnMatch(
      id: _stringOrEmpty(json['id']),
      materialId: _stringOrEmpty(json['materialId']),
      status: _stringOrEmpty(json['status']),
      matchReasonCode: json['matchReasonCode'] as String?,
      rankingScore: _numOrNull(json['rankingScore']),
      reservationId: json['reservationId'] as String?,
      createdAt: _dateOrNull(json['createdAt']) ?? DateTime.now(),
      materialTitle: json['materialTitle'] as String?,
    );
  }
}

class SupplierMaterialRequest {
  const SupplierMaterialRequest({
    required this.id,
    required this.categoryId,
    this.categoryNameEn,
    this.categoryNameAr,
    required this.requestedItemName,
    this.description,
    required this.quantity,
    required this.unit,
    required this.alternativesAllowed,
    required this.location,
    this.projectContext,
    required this.status,
    this.neededBy,
    required this.expiresAt,
    required this.createdAt,
    required this.suggestionCount,
    required this.respondedByMe,
    this.ownMatches = const [],
  });

  final String id;
  final String categoryId;
  final String? categoryNameEn;
  final String? categoryNameAr;
  final String requestedItemName;
  final String? description;
  final double quantity;
  final String unit;
  final bool alternativesAllowed;
  final SupplierMaterialRequestLocation location;
  final SupplierMaterialRequestProjectContext? projectContext;
  final String status;
  final DateTime? neededBy;
  final DateTime expiresAt;
  final DateTime createdAt;
  final int suggestionCount;
  final bool respondedByMe;
  final List<SupplierMaterialRequestOwnMatch> ownMatches;

  bool get isOpen => status == 'OPEN';

  factory SupplierMaterialRequest.fromJson(Map<String, dynamic> json) {
    final rawOwnMatches = json['ownMatches'];
    return SupplierMaterialRequest(
      id: _stringOrEmpty(json['id']),
      categoryId: _stringOrEmpty(json['categoryId']),
      categoryNameEn: json['categoryNameEn'] as String?,
      categoryNameAr: json['categoryNameAr'] as String?,
      requestedItemName: _stringOrEmpty(json['requestedItemName']),
      description: json['description'] as String?,
      quantity: _numOrZero(json['quantity']),
      unit: _stringOrEmpty(json['unit']),
      alternativesAllowed: json['alternativesAllowed'] as bool? ?? true,
      location: json['location'] is Map
          ? SupplierMaterialRequestLocation.fromJson(
              Map<String, dynamic>.from(json['location'] as Map),
            )
          : const SupplierMaterialRequestLocation(country: '', city: ''),
      projectContext: SupplierMaterialRequestProjectContext.fromJsonOrNull(
        json['projectContext'],
      ),
      status: _stringOrEmpty(json['status']),
      neededBy: _dateOrNull(json['neededBy']),
      expiresAt: _dateOrNull(json['expiresAt']) ?? DateTime.now(),
      createdAt: _dateOrNull(json['createdAt']) ?? DateTime.now(),
      suggestionCount: (json['suggestionCount'] as num?)?.toInt() ?? 0,
      respondedByMe: json['respondedByMe'] as bool? ?? false,
      ownMatches: rawOwnMatches is List
          ? rawOwnMatches
                .whereType<Map>()
                .map(
                  (item) => SupplierMaterialRequestOwnMatch.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
    );
  }
}

class SupplierMaterialRequestListResult {
  const SupplierMaterialRequestListResult({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<SupplierMaterialRequest> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasMore => page < totalPages;

  factory SupplierMaterialRequestListResult.fromJson(
    Map<String, dynamic> json,
  ) {
    final rawItems = json['items'];
    return SupplierMaterialRequestListResult(
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (item) => SupplierMaterialRequest.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 10,
      total: (json['total'] as num?)?.toInt() ?? 0,
      totalPages: (json['totalPages'] as num?)?.toInt() ?? 1,
    );
  }
}

class SupplierMaterialRequestCandidate {
  const SupplierMaterialRequestCandidate({
    required this.materialId,
    required this.title,
    required this.unit,
    required this.condition,
    required this.isFree,
    required this.price,
    required this.availableQuantity,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    this.matchReasonCode,
    required this.rankingScore,
    required this.isWeakMatch,
  });

  final String materialId;
  final String title;
  final String unit;
  final String condition;
  final bool isFree;
  final double price;
  final double availableQuantity;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final String? matchReasonCode;
  final double rankingScore;
  final bool isWeakMatch;

  factory SupplierMaterialRequestCandidate.fromJson(
    Map<String, dynamic> json,
  ) {
    return SupplierMaterialRequestCandidate(
      materialId: _stringOrEmpty(json['materialId']),
      title: _stringOrEmpty(json['title']),
      unit: _stringOrEmpty(json['unit']),
      condition: _stringOrEmpty(json['condition']),
      isFree: json['isFree'] as bool? ?? false,
      price: _numOrZero(json['price']),
      availableQuantity: _numOrZero(json['availableQuantity']),
      pickupAllowed: json['pickupAllowed'] as bool? ?? false,
      deliveryAllowed: json['deliveryAllowed'] as bool? ?? false,
      matchReasonCode: json['matchReasonCode'] as String?,
      rankingScore: _numOrZero(json['rankingScore']),
      isWeakMatch: json['isWeakMatch'] as bool? ?? false,
    );
  }
}

class SupplierMaterialRequestCandidatesResult {
  const SupplierMaterialRequestCandidatesResult({
    required this.requestId,
    required this.items,
  });

  final String requestId;
  final List<SupplierMaterialRequestCandidate> items;

  factory SupplierMaterialRequestCandidatesResult.fromJson(
    Map<String, dynamic> json,
  ) {
    final rawItems = json['items'];
    return SupplierMaterialRequestCandidatesResult(
      requestId: _stringOrEmpty(json['requestId']),
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (item) => SupplierMaterialRequestCandidate.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
    );
  }
}
