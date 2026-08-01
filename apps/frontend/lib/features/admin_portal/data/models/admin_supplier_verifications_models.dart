class AdminSupplierVerificationSummary {
  const AdminSupplierVerificationSummary({
    required this.pending,
    required this.approved,
    required this.rejected,
    required this.changesRequested,
  });

  final int pending;
  final int approved;
  final int rejected;
  final int changesRequested;

  factory AdminSupplierVerificationSummary.fromJson(Map<String, dynamic> json) {
    return AdminSupplierVerificationSummary(
      pending: json['pending'] as int? ?? 0,
      approved: json['approved'] as int? ?? 0,
      rejected: json['rejected'] as int? ?? 0,
      changesRequested: json['changesRequested'] as int? ?? 0,
    );
  }
}

class AdminSupplierVerificationListItem {
  const AdminSupplierVerificationListItem({
    required this.supplierProfileId,
    required this.organizationName,
    required this.supplierType,
    required this.ownerName,
    required this.ownerEmail,
    this.city,
    this.area,
    required this.verificationStatus,
    this.submittedAt,
    this.reviewedAt,
  });

  final String supplierProfileId;
  final String organizationName;
  final String supplierType;
  final String ownerName;
  final String ownerEmail;
  final String? city;
  final String? area;
  final String verificationStatus;
  final DateTime? submittedAt;
  final DateTime? reviewedAt;

  factory AdminSupplierVerificationListItem.fromJson(
    Map<String, dynamic> json,
  ) {
    return AdminSupplierVerificationListItem(
      supplierProfileId: json['supplierProfileId'] as String,
      organizationName: json['organizationName'] as String? ?? '',
      supplierType: json['supplierType'] as String? ?? '',
      ownerName: json['ownerName'] as String? ?? '',
      ownerEmail: json['ownerEmail'] as String? ?? '',
      city: json['city'] as String?,
      area: json['area'] as String?,
      verificationStatus: json['verificationStatus'] as String? ?? 'PENDING',
      submittedAt: json['verificationSubmittedAt'] == null
          ? (json['submittedAt'] == null
                ? null
                : DateTime.parse(json['submittedAt'] as String))
          : DateTime.parse(json['verificationSubmittedAt'] as String),
      reviewedAt: json['verificationReviewedAt'] == null
          ? (json['reviewedAt'] == null
                ? null
                : DateTime.parse(json['reviewedAt'] as String))
          : DateTime.parse(json['verificationReviewedAt'] as String),
    );
  }
}

class AdminSupplierVerificationPagination {
  const AdminSupplierVerificationPagination({
    required this.page,
    required this.limit,
    required this.total,
  });

  final int page;
  final int limit;
  final int total;

  factory AdminSupplierVerificationPagination.fromJson(
    Map<String, dynamic> json,
  ) {
    return AdminSupplierVerificationPagination(
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 20,
      total: json['total'] as int? ?? 0,
    );
  }
}

class AdminSupplierVerificationListResponse {
  const AdminSupplierVerificationListResponse({
    required this.items,
    required this.summary,
    required this.pagination,
  });

  final List<AdminSupplierVerificationListItem> items;
  final AdminSupplierVerificationSummary summary;
  final AdminSupplierVerificationPagination pagination;

  factory AdminSupplierVerificationListResponse.fromJson(
    Map<String, dynamic> json,
  ) {
    final itemsJson = json['items'];
    return AdminSupplierVerificationListResponse(
      items: itemsJson is List
          ? itemsJson
                .whereType<Map<String, dynamic>>()
                .map(AdminSupplierVerificationListItem.fromJson)
                .toList(growable: false)
          : const [],
      summary: AdminSupplierVerificationSummary.fromJson(
        json['summary'] as Map<String, dynamic>? ?? const {},
      ),
      pagination: AdminSupplierVerificationPagination.fromJson(
        json['pagination'] as Map<String, dynamic>? ?? const {},
      ),
    );
  }
}

class AdminSupplierVerificationOwner {
  const AdminSupplierVerificationOwner({
    required this.id,
    required this.displayName,
    required this.email,
    this.phone,
  });

  final String id;
  final String displayName;
  final String email;
  final String? phone;

  factory AdminSupplierVerificationOwner.fromJson(Map<String, dynamic> json) {
    return AdminSupplierVerificationOwner(
      id: json['id'] as String,
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String?,
    );
  }
}

class AdminSupplierVerificationLocation {
  const AdminSupplierVerificationLocation({
    this.city,
    this.area,
    this.addressLine,
    this.country,
  });

  final String? city;
  final String? area;
  final String? addressLine;
  final String? country;

  factory AdminSupplierVerificationLocation.fromJson(
    Map<String, dynamic>? json,
  ) {
    if (json == null) {
      return const AdminSupplierVerificationLocation();
    }

    return AdminSupplierVerificationLocation(
      city: json['city'] as String?,
      area: json['area'] as String?,
      addressLine: json['addressLine'] as String?,
      country: json['country'] as String?,
    );
  }
}

class AdminSupplierVerificationDetail {
  const AdminSupplierVerificationDetail({
    required this.supplierProfileId,
    required this.organizationName,
    required this.supplierType,
    required this.owner,
    required this.location,
    this.description,
    this.verificationDocumentUrl,
    this.verificationDocumentName,
    required this.verificationStatus,
    this.adminNote,
    this.reviewedByName,
    this.reviewedByEmail,
    this.submittedAt,
    this.reviewedAt,
  });

  final String supplierProfileId;
  final String organizationName;
  final String supplierType;
  final AdminSupplierVerificationOwner owner;
  final AdminSupplierVerificationLocation location;
  final String? description;
  final String? verificationDocumentUrl;
  final String? verificationDocumentName;
  final String verificationStatus;
  final String? adminNote;
  final String? reviewedByName;
  final String? reviewedByEmail;
  final DateTime? submittedAt;
  final DateTime? reviewedAt;

  factory AdminSupplierVerificationDetail.fromJson(Map<String, dynamic> json) {
    final organization = json['organization'] as Map<String, dynamic>?;
    final supplier = json['supplier'] as Map<String, dynamic>?;
    final reviewedBy = json['reviewedBy'] as Map<String, dynamic>?;

    return AdminSupplierVerificationDetail(
      supplierProfileId: json['supplierProfileId'] as String,
      organizationName:
          organization?['organizationName'] as String? ??
          json['organizationName'] as String? ??
          '',
      supplierType:
          supplier?['supplierType'] as String? ??
          organization?['organizationType'] as String? ??
          '',
      owner: AdminSupplierVerificationOwner.fromJson(
        json['owner'] as Map<String, dynamic>? ?? const {},
      ),
      location: AdminSupplierVerificationLocation.fromJson(
        json['location'] as Map<String, dynamic>? ??
            organization?['businessLocation'] as Map<String, dynamic>?,
      ),
      description: supplier?['description'] as String?,
      verificationDocumentUrl:
          json['verificationDocumentUrl'] as String? ??
          organization?['verificationDocumentUrl'] as String?,
      verificationDocumentName:
          json['verificationDocumentName'] as String? ??
          organization?['verificationDocumentName'] as String?,
      verificationStatus: json['verificationStatus'] as String? ?? 'PENDING',
      adminNote: json['adminNote'] as String?,
      reviewedByName: reviewedBy?['displayName'] as String?,
      reviewedByEmail: reviewedBy?['email'] as String?,
      submittedAt: json['submittedAt'] == null
          ? null
          : DateTime.parse(json['submittedAt'] as String),
      reviewedAt: json['reviewedAt'] == null
          ? null
          : DateTime.parse(json['reviewedAt'] as String),
    );
  }
}

class AdminSupplierVerificationFilters {
  const AdminSupplierVerificationFilters({
    this.search = '',
    this.status = 'ALL',
    this.supplierType = 'ALL',
    this.city = '',
    this.page = 1,
    this.limit = 20,
  });

  final String search;
  final String status;
  final String supplierType;
  final String city;
  final int page;
  final int limit;

  AdminSupplierVerificationFilters copyWith({
    String? search,
    String? status,
    String? supplierType,
    String? city,
    int? page,
    int? limit,
  }) {
    return AdminSupplierVerificationFilters(
      search: search ?? this.search,
      status: status ?? this.status,
      supplierType: supplierType ?? this.supplierType,
      city: city ?? this.city,
      page: page ?? this.page,
      limit: limit ?? this.limit,
    );
  }

  Map<String, dynamic> toQueryParameters() {
    return {
      if (search.trim().isNotEmpty) 'search': search.trim(),
      if (status != 'ALL') 'status': status,
      if (supplierType != 'ALL') 'supplierType': supplierType,
      if (city.trim().isNotEmpty) 'city': city.trim(),
      'page': page,
      'limit': limit,
    };
  }
}
