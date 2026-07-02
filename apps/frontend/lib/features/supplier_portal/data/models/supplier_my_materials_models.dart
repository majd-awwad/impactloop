class SupplierMyMaterialsCategory {
  const SupplierMyMaterialsCategory({
    required this.id,
    required this.nameEn,
    required this.nameAr,
  });

  final String id;
  final String nameEn;
  final String nameAr;

  factory SupplierMyMaterialsCategory.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const SupplierMyMaterialsCategory(
        id: '',
        nameEn: 'Materials',
        nameAr: 'مواد',
      );
    }

    return SupplierMyMaterialsCategory(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? 'Materials',
      nameAr: json['nameAr'] as String? ?? 'مواد',
    );
  }
}

class SupplierMyMaterialsCategoryOption {
  const SupplierMyMaterialsCategoryOption({
    required this.id,
    required this.nameEn,
    required this.nameAr,
    required this.count,
  });

  final String id;
  final String nameEn;
  final String nameAr;
  final int count;

  factory SupplierMyMaterialsCategoryOption.fromJson(Map<String, dynamic> json) {
    return SupplierMyMaterialsCategoryOption(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      count: json['count'] as int? ?? 0,
    );
  }
}

class SupplierMyMaterialsLocation {
  const SupplierMyMaterialsLocation({
    required this.city,
    this.area,
    this.addressLine,
  });

  final String city;
  final String? area;
  final String? addressLine;

  factory SupplierMyMaterialsLocation.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const SupplierMyMaterialsLocation(city: '');
    }

    return SupplierMyMaterialsLocation(
      city: json['city'] as String? ?? '',
      area: json['area'] as String?,
      addressLine: json['addressLine'] as String?,
    );
  }
}

class SupplierMyMaterialsImage {
  const SupplierMyMaterialsImage({
    required this.imageUrl,
    required this.isCover,
    this.sortOrder = 0,
  });

  final String imageUrl;
  final bool isCover;
  final int sortOrder;

  factory SupplierMyMaterialsImage.fromJson(Map<String, dynamic> json) {
    return SupplierMyMaterialsImage(
      imageUrl: json['imageUrl'] as String? ?? '',
      isCover: json['isCover'] == true,
      sortOrder: json['sortOrder'] as int? ?? 0,
    );
  }
}

class SupplierMaterialReservationSummary {
  const SupplierMaterialReservationSummary({
    required this.id,
    required this.status,
    required this.quantityRequested,
    required this.unit,
    required this.pickupPreference,
    required this.deliveryRequested,
    required this.createdAt,
    required this.canReview,
    required this.canOpen,
    this.message,
    this.learnerDisplayName,
    this.pickupWindowStart,
    this.pickupWindowEnd,
  });

  final String id;
  final String status;
  final double quantityRequested;
  final String unit;
  final String pickupPreference;
  final bool deliveryRequested;
  final DateTime createdAt;
  final bool canReview;
  final bool canOpen;
  final String? message;
  final String? learnerDisplayName;
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;

  factory SupplierMaterialReservationSummary.fromJson(Map<String, dynamic> json) {
    final learner = json['learner'];
    return SupplierMaterialReservationSummary(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      quantityRequested: (json['quantityRequested'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? '',
      pickupPreference: json['pickupPreference'] as String? ?? '',
      deliveryRequested: json['deliveryRequested'] == true,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      canReview: json['canReview'] == true,
      canOpen: json['canOpen'] != false,
      message: json['message'] as String?,
      learnerDisplayName: learner is Map
          ? learner['displayName'] as String?
          : null,
      pickupWindowStart: DateTime.tryParse(
        json['pickupWindowStart'] as String? ?? '',
      ),
      pickupWindowEnd: DateTime.tryParse(
        json['pickupWindowEnd'] as String? ?? '',
      ),
    );
  }
}

class SupplierMyMaterial {
  const SupplierMyMaterial({
    required this.id,
    required this.title,
    required this.description,
    required this.category,
    this.materialType,
    required this.status,
    required this.condition,
    required this.quantity,
    this.heldQuantity,
    this.availableQuantity,
    required this.unit,
    required this.isFree,
    this.price,
    required this.currency,
    required this.location,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    this.pickupNotes,
    this.suggestedUses,
    required this.images,
    required this.viewsCount,
    required this.likesCount,
    this.pendingReservationsCount = 0,
    this.reservedReservationsCount = 0,
    this.reservationsCount = 0,
    this.demandScore = 0,
    this.canMarkUnavailable = false,
    this.canRestoreAvailable = false,
    this.statusActionBlockedReason,
    this.reservations = const [],
    required this.createdAt,
    required this.updatedAt,
    required this.canDelete,
    this.deleteBlockedReason,
    required this.canEdit,
    this.editBlockedReason,
  });

  final String id;
  final String title;
  final String description;
  final SupplierMyMaterialsCategory category;
  final String? materialType;
  final String status;
  final String condition;
  final double quantity;
  final double? heldQuantity;
  final double? availableQuantity;
  final String unit;
  final bool isFree;
  final double? price;
  final String currency;
  final SupplierMyMaterialsLocation location;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final String? pickupNotes;
  final String? suggestedUses;
  final List<SupplierMyMaterialsImage> images;
  final int viewsCount;
  final int likesCount;
  final int pendingReservationsCount;
  final int reservedReservationsCount;
  final int reservationsCount;
  final int demandScore;
  final bool canMarkUnavailable;
  final bool canRestoreAvailable;
  final String? statusActionBlockedReason;
  final List<SupplierMaterialReservationSummary> reservations;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool canDelete;
  final String? deleteBlockedReason;
  final bool canEdit;
  final String? editBlockedReason;

  String? get coverImageUrl {
    for (final image in images) {
      if (image.isCover && image.imageUrl.isNotEmpty) {
        return image.imageUrl;
      }
    }

    return images.isNotEmpty ? images.first.imageUrl : null;
  }

  factory SupplierMyMaterial.fromJson(Map<String, dynamic> json) {
    final imagesJson = json['images'];

    return SupplierMyMaterial(
      id: json['id'] as String? ?? '',
      title: json['title'] as String? ?? '',
      description: json['description'] as String? ?? '',
      category: SupplierMyMaterialsCategory.fromJson(
        json['category'] as Map<String, dynamic>?,
      ),
      materialType: json['materialType'] as String?,
      status: json['status'] as String? ?? 'AVAILABLE',
      condition: json['condition'] as String? ?? 'GOOD',
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      heldQuantity: (json['heldQuantity'] as num?)?.toDouble(),
      availableQuantity: (json['availableQuantity'] as num?)?.toDouble(),
      unit: json['unit'] as String? ?? '',
      isFree: json['isFree'] == true,
      price: (json['price'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? 'NIS',
      location: SupplierMyMaterialsLocation.fromJson(
        json['location'] as Map<String, dynamic>?,
      ),
      pickupAllowed: json['pickupAllowed'] != false,
      deliveryAllowed: json['deliveryAllowed'] == true,
      pickupNotes: json['pickupNotes'] as String?,
      suggestedUses: json['suggestedUses'] as String?,
      images: imagesJson is List
          ? imagesJson
              .whereType<Map>()
              .map(
                (item) => SupplierMyMaterialsImage.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
          : const [],
      viewsCount: (json['viewsCount'] as num?)?.toInt() ?? 0,
      likesCount: (json['likesCount'] as num?)?.toInt() ?? 0,
      pendingReservationsCount:
          (json['pendingReservationsCount'] as num?)?.toInt() ?? 0,
      reservedReservationsCount:
          (json['reservedReservationsCount'] as num?)?.toInt() ?? 0,
      reservationsCount: (json['reservationsCount'] as num?)?.toInt() ?? 0,
      demandScore: (json['demandScore'] as num?)?.toInt() ?? 0,
      canMarkUnavailable: json['canMarkUnavailable'] == true,
      canRestoreAvailable: json['canRestoreAvailable'] == true,
      statusActionBlockedReason: json['statusActionBlockedReason'] as String?,
      reservations: _parseReservations(json['reservations']),
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      updatedAt:
          DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      canDelete: json['canDelete'] == true,
      deleteBlockedReason: json['deleteBlockedReason'] as String?,
      canEdit: json['canEdit'] == true,
      editBlockedReason: json['editBlockedReason'] as String?,
    );
  }

  static List<SupplierMaterialReservationSummary> _parseReservations(
    Object? json,
  ) {
    if (json is! List) {
      return const [];
    }

    return json
        .whereType<Map>()
        .map(
          (item) => SupplierMaterialReservationSummary.fromJson(
            Map<String, dynamic>.from(item),
          ),
        )
        .toList(growable: false);
  }
}

class UpdateSupplierMyMaterialRequest {
  const UpdateSupplierMyMaterialRequest({
    required this.title,
    required this.description,
    required this.quantity,
    required this.unit,
    required this.condition,
    required this.pickupAllowed,
    required this.deliveryAllowed,
    this.pickupNotes,
    this.suggestedUses,
  });

  final String title;
  final String description;
  final double quantity;
  final String unit;
  final String condition;
  final bool pickupAllowed;
  final bool deliveryAllowed;
  final String? pickupNotes;
  final String? suggestedUses;

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'description': description,
      'quantity': quantity,
      'unit': unit,
      'condition': condition,
      'pickupAllowed': pickupAllowed,
      'deliveryAllowed': deliveryAllowed,
      'pickupNotes':
          pickupNotes == null || pickupNotes!.trim().isEmpty
              ? null
              : pickupNotes!.trim(),
      'suggestedUses':
          suggestedUses == null || suggestedUses!.trim().isEmpty
              ? null
              : suggestedUses!.trim(),
    };
  }
}

class SupplierMyMaterialsSummary {
  const SupplierMyMaterialsSummary({
    required this.total,
    required this.available,
    required this.pendingReservation,
    required this.reserved,
    required this.reused,
    required this.unavailable,
    required this.free,
    required this.paid,
  });

  final int total;
  final int available;
  final int pendingReservation;
  final int reserved;
  final int reused;
  final int unavailable;
  final int free;
  final int paid;

  int get pendingOrReserved => pendingReservation + reserved;

  factory SupplierMyMaterialsSummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const SupplierMyMaterialsSummary(
        total: 0,
        available: 0,
        pendingReservation: 0,
        reserved: 0,
        reused: 0,
        unavailable: 0,
        free: 0,
        paid: 0,
      );
    }

    return SupplierMyMaterialsSummary(
      total: json['total'] as int? ?? 0,
      available: json['available'] as int? ?? 0,
      pendingReservation: json['pendingReservation'] as int? ?? 0,
      reserved: json['reserved'] as int? ?? 0,
      reused: json['reused'] as int? ?? 0,
      unavailable: json['unavailable'] as int? ?? 0,
      free: json['free'] as int? ?? 0,
      paid: json['paid'] as int? ?? 0,
    );
  }
}

class SupplierMyMaterialsPagination {
  const SupplierMyMaterialsPagination({
    required this.page,
    required this.limit,
    required this.totalItems,
    required this.totalPages,
  });

  final int page;
  final int limit;
  final int totalItems;
  final int totalPages;

  factory SupplierMyMaterialsPagination.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return const SupplierMyMaterialsPagination(
        page: 1,
        limit: 9,
        totalItems: 0,
        totalPages: 0,
      );
    }

    return SupplierMyMaterialsPagination(
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 9,
      totalItems: json['totalItems'] as int? ?? 0,
      totalPages: json['totalPages'] as int? ?? 0,
    );
  }
}

class SupplierMyMaterialsListResult {
  const SupplierMyMaterialsListResult({
    required this.items,
    required this.pagination,
    required this.summary,
    required this.categories,
  });

  final List<SupplierMyMaterial> items;
  final SupplierMyMaterialsPagination pagination;
  final SupplierMyMaterialsSummary summary;
  final List<SupplierMyMaterialsCategoryOption> categories;

  factory SupplierMyMaterialsListResult.fromJson(Map<String, dynamic> json) {
    final itemsJson = json['items'];
    final facetsJson = json['categoryFacets'] ?? json['categories'];

    return SupplierMyMaterialsListResult(
      items: itemsJson is List
          ? itemsJson
              .whereType<Map>()
              .map(
                (item) => SupplierMyMaterial.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
          : const [],
      pagination: SupplierMyMaterialsPagination.fromJson(
        json['pagination'] as Map<String, dynamic>?,
      ),
      summary: SupplierMyMaterialsSummary.fromJson(
        json['summary'] as Map<String, dynamic>?,
      ),
      categories: facetsJson is List
          ? facetsJson
              .whereType<Map>()
              .map(
                (item) => SupplierMyMaterialsCategoryOption.fromJson(
                  Map<String, dynamic>.from(item),
                ),
              )
              .toList(growable: false)
          : const [],
    );
  }
}

class SupplierMyMaterialsQuery {
  const SupplierMyMaterialsQuery({
    this.page = 1,
    this.limit = 9,
    this.search = '',
    this.status,
    this.isFree,
    this.categoryId,
  });

  final int page;
  final int limit;
  final String search;
  final String? status;
  final bool? isFree;
  final String? categoryId;

  bool get hasActiveFilters =>
      search.trim().isNotEmpty ||
      status != null ||
      isFree != null ||
      categoryId != null;

  SupplierMyMaterialsQuery copyWith({
    int? page,
    int? limit,
    String? search,
    String? status,
    bool? isFree,
    String? categoryId,
    bool clearStatus = false,
    bool clearIsFree = false,
    bool clearCategoryId = false,
    bool clearSearch = false,
  }) {
    return SupplierMyMaterialsQuery(
      page: page ?? this.page,
      limit: limit ?? this.limit,
      search: clearSearch ? '' : search ?? this.search,
      status: clearStatus ? null : status ?? this.status,
      isFree: clearIsFree ? null : isFree ?? this.isFree,
      categoryId: clearCategoryId ? null : categoryId ?? this.categoryId,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is SupplierMyMaterialsQuery &&
        other.page == page &&
        other.limit == limit &&
        other.search == search &&
        other.status == status &&
        other.isFree == isFree &&
        other.categoryId == categoryId;
  }

  @override
  int get hashCode => Object.hash(page, limit, search, status, isFree, categoryId);
}
