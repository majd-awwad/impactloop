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

class LearnerMaterialRequestLocation {
  const LearnerMaterialRequestLocation({
    required this.country,
    required this.city,
    this.area,
  });

  final String country;
  final String city;
  final String? area;

  factory LearnerMaterialRequestLocation.fromJson(Map<String, dynamic> json) {
    return LearnerMaterialRequestLocation(
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

class LearnerMaterialRequestProjectContext {
  const LearnerMaterialRequestProjectContext({
    required this.title,
    this.componentName,
  });

  final String title;
  final String? componentName;

  static LearnerMaterialRequestProjectContext? fromJsonOrNull(Object? value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);
    final title = json['title'] as String?;
    if (title == null || title.trim().isEmpty) return null;
    return LearnerMaterialRequestProjectContext(
      title: title,
      componentName: json['componentName'] as String?,
    );
  }
}

class LearnerMaterialRequestMatchMaterial {
  const LearnerMaterialRequestMatchMaterial({
    required this.id,
    required this.title,
    required this.status,
    required this.quantity,
    required this.unit,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    this.location,
    this.supplierPublicName,
  });

  final String id;
  final String title;
  final String status;
  final double quantity;
  final String unit;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final LearnerMaterialRequestLocation? location;
  final String? supplierPublicName;

  static LearnerMaterialRequestMatchMaterial? fromJsonOrNull(Object? value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);
    return LearnerMaterialRequestMatchMaterial(
      id: _stringOrEmpty(json['id']),
      title: _stringOrEmpty(json['title']),
      status: _stringOrEmpty(json['status']),
      quantity: _numOrZero(json['quantity']),
      unit: _stringOrEmpty(json['unit']),
      pickupAllowed: json['pickupAllowed'] as bool? ?? false,
      deliveryAllowed: json['deliveryAllowed'] as bool? ?? false,
      location: json['location'] is Map
          ? LearnerMaterialRequestLocation.fromJson(
              Map<String, dynamic>.from(json['location'] as Map),
            )
          : null,
      supplierPublicName: json['supplierPublicName'] as String?,
    );
  }
}

class LearnerMaterialRequestMatch {
  const LearnerMaterialRequestMatch({
    required this.id,
    required this.materialRequestId,
    required this.materialId,
    required this.status,
    this.matchReasonCode,
    this.rankingScore,
    this.reservationId,
    required this.createdAt,
    required this.updatedAt,
    this.material,
  });

  final String id;
  final String materialRequestId;
  final String materialId;
  final String status;
  final String? matchReasonCode;
  final double? rankingScore;
  final String? reservationId;
  final DateTime createdAt;
  final DateTime updatedAt;
  final LearnerMaterialRequestMatchMaterial? material;

  bool get isSuggested => status == 'SUGGESTED';
  bool get isDismissed => status == 'DISMISSED';
  bool get isReserved => reservationId != null;

  factory LearnerMaterialRequestMatch.fromJson(Map<String, dynamic> json) {
    return LearnerMaterialRequestMatch(
      id: _stringOrEmpty(json['id']),
      materialRequestId: _stringOrEmpty(json['materialRequestId']),
      materialId: _stringOrEmpty(json['materialId']),
      status: _stringOrEmpty(json['status']),
      matchReasonCode: json['matchReasonCode'] as String?,
      rankingScore: _numOrNull(json['rankingScore']),
      reservationId: json['reservationId'] as String?,
      createdAt: _dateOrNull(json['createdAt']) ?? DateTime.now(),
      updatedAt: _dateOrNull(json['updatedAt']) ?? DateTime.now(),
      material: LearnerMaterialRequestMatchMaterial.fromJsonOrNull(
        json['material'],
      ),
    );
  }
}

class LearnerMaterialRequest {
  const LearnerMaterialRequest({
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
    this.sourceSavedLocationId,
    this.projectId,
    this.projectBuildId,
    this.projectBuildItemId,
    this.projectContext,
    required this.status,
    this.neededBy,
    required this.expiresAt,
    this.fulfilledAt,
    this.cancelledAt,
    required this.createdAt,
    required this.updatedAt,
    required this.suggestionCount,
    this.matches = const [],
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
  final LearnerMaterialRequestLocation location;
  final String? sourceSavedLocationId;
  final String? projectId;
  final String? projectBuildId;
  final String? projectBuildItemId;
  final LearnerMaterialRequestProjectContext? projectContext;
  final String status;
  final DateTime? neededBy;
  final DateTime expiresAt;
  final DateTime? fulfilledAt;
  final DateTime? cancelledAt;
  final DateTime createdAt;
  final DateTime updatedAt;
  final int suggestionCount;
  final List<LearnerMaterialRequestMatch> matches;

  bool get isOpen => status == 'OPEN';
  bool get isFulfilled => status == 'FULFILLED';
  bool get isCancelled => status == 'CANCELLED';
  bool get isExpired => status == 'EXPIRED';

  List<LearnerMaterialRequestMatch> get activeMatches =>
      matches.where((match) => match.isSuggested).toList(growable: false);

  factory LearnerMaterialRequest.fromJson(Map<String, dynamic> json) {
    final rawMatches = json['matches'];
    return LearnerMaterialRequest(
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
          ? LearnerMaterialRequestLocation.fromJson(
              Map<String, dynamic>.from(json['location'] as Map),
            )
          : const LearnerMaterialRequestLocation(country: '', city: ''),
      sourceSavedLocationId: json['sourceSavedLocationId'] as String?,
      projectId: json['projectId'] as String?,
      projectBuildId: json['projectBuildId'] as String?,
      projectBuildItemId: json['projectBuildItemId'] as String?,
      projectContext: LearnerMaterialRequestProjectContext.fromJsonOrNull(
        json['projectContext'],
      ),
      status: _stringOrEmpty(json['status']),
      neededBy: _dateOrNull(json['neededBy']),
      expiresAt: _dateOrNull(json['expiresAt']) ?? DateTime.now(),
      fulfilledAt: _dateOrNull(json['fulfilledAt']),
      cancelledAt: _dateOrNull(json['cancelledAt']),
      createdAt: _dateOrNull(json['createdAt']) ?? DateTime.now(),
      updatedAt: _dateOrNull(json['updatedAt']) ?? DateTime.now(),
      suggestionCount: (json['suggestionCount'] as num?)?.toInt() ?? 0,
      matches: rawMatches is List
          ? rawMatches
                .whereType<Map>()
                .map(
                  (item) => LearnerMaterialRequestMatch.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
    );
  }
}

class LearnerMaterialRequestListResult {
  const LearnerMaterialRequestListResult({
    required this.items,
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
  });

  final List<LearnerMaterialRequest> items;
  final int page;
  final int limit;
  final int total;
  final int totalPages;

  bool get hasMore => page < totalPages;

  factory LearnerMaterialRequestListResult.fromJson(
    Map<String, dynamic> json,
  ) {
    final rawItems = json['items'];
    return LearnerMaterialRequestListResult(
      items: rawItems is List
          ? rawItems
                .whereType<Map>()
                .map(
                  (item) => LearnerMaterialRequest.fromJson(
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
