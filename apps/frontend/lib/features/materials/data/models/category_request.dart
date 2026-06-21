class CategoryRequestListItem {
  const CategoryRequestListItem({
    required this.id,
    required this.requestedName,
    required this.status,
    this.approvedCategoryId,
    this.approvedCategoryName,
    required this.title,
    required this.materialName,
    required this.createdAt,
    required this.canContinue,
  });

  final String id;
  final String requestedName;
  final String status;
  final String? approvedCategoryId;
  final String? approvedCategoryName;
  final String title;
  final String materialName;
  final String createdAt;
  final bool canContinue;

  factory CategoryRequestListItem.fromJson(Map<String, dynamic> json) {
    return CategoryRequestListItem(
      id: json['id'] as String? ?? '',
      requestedName: json['requestedName'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      approvedCategoryId: json['approvedCategoryId'] as String?,
      approvedCategoryName: json['approvedCategoryName'] as String?,
      title: json['title'] as String? ?? '',
      materialName: json['materialName'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? '',
      canContinue: json['canContinue'] as bool? ?? false,
    );
  }
}

class CategoryRequestDraftResponse {
  const CategoryRequestDraftResponse({
    required this.id,
    required this.status,
    required this.requestedName,
    required this.canContinue,
    required this.isSuggestion,
    this.approvedCategoryId,
    this.approvedCategory,
    this.listingDraftJson,
  });

  final String id;
  final String status;
  final String requestedName;
  final bool canContinue;
  final bool isSuggestion;
  final String? approvedCategoryId;
  final CategoryRequestApprovedCategory? approvedCategory;
  final Map<String, dynamic>? listingDraftJson;

  factory CategoryRequestDraftResponse.fromJson(Map<String, dynamic> json) {
    return CategoryRequestDraftResponse(
      id: json['id'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      requestedName: json['requestedName'] as String? ?? '',
      canContinue: json['canContinue'] as bool? ?? false,
      isSuggestion: json['isSuggestion'] as bool? ?? false,
      approvedCategoryId: json['approvedCategoryId'] as String?,
      approvedCategory: json['approvedCategory'] is Map<String, dynamic>
          ? CategoryRequestApprovedCategory.fromJson(
              Map<String, dynamic>.from(json['approvedCategory'] as Map),
            )
          : null,
      listingDraftJson: json['listingDraftJson'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['listingDraftJson'] as Map)
          : json['listingDraftJson'] is Map
          ? Map<String, dynamic>.from(json['listingDraftJson'] as Map)
          : null,
    );
  }
}

class CategoryRequestApprovedCategory {
  const CategoryRequestApprovedCategory({
    required this.id,
    required this.nameEn,
    this.nameAr,
  });

  final String id;
  final String nameEn;
  final String? nameAr;

  factory CategoryRequestApprovedCategory.fromJson(Map<String, dynamic> json) {
    return CategoryRequestApprovedCategory(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String?,
    );
  }
}

class CreateCategoryRequestPayload {
  const CreateCategoryRequestPayload({
    required this.requestedName,
    required this.listingDraftJson,
  });

  final String requestedName;
  final Map<String, dynamic> listingDraftJson;

  Map<String, dynamic> toJson() {
    return {
      'requestedName': requestedName,
      'listingDraftJson': listingDraftJson,
    };
  }
}

class CreateCategoryRequestResult {
  const CreateCategoryRequestResult({
    required this.id,
    required this.requestedName,
    required this.status,
    required this.message,
  });

  final String id;
  final String requestedName;
  final String status;
  final String message;

  factory CreateCategoryRequestResult.fromJson(Map<String, dynamic> json) {
    return CreateCategoryRequestResult(
      id: json['id'] as String? ?? '',
      requestedName: json['requestedName'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      message: json['message'] as String? ?? '',
    );
  }
}
