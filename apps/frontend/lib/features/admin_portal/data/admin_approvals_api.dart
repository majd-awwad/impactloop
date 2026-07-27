import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';

String _normalizeCategoryDisplayName(String value) =>
    value.trim().replaceAll(RegExp(r'\s+'), ' ');

class AdminTaxonomyOption {
  const AdminTaxonomyOption({
    required this.id,
    required this.canonicalKey,
    required this.conceptType,
    required this.status,
    required this.labelEn,
    required this.labelAr,
  });

  final String id;
  final String canonicalKey;
  final String conceptType;
  final String status;
  final String labelEn;
  final String labelAr;

  bool get isActiveMaterialFamily =>
      conceptType == 'MATERIAL_FAMILY' && status == 'ACTIVE';

  factory AdminTaxonomyOption.fromJson(Map<String, dynamic> json) {
    return AdminTaxonomyOption(
      id: json['id'] as String? ?? '',
      canonicalKey: json['canonicalKey'] as String? ?? '',
      conceptType: json['conceptType'] as String? ?? '',
      status: json['status'] as String? ?? '',
      labelEn: json['labelEn'] as String? ?? '',
      labelAr: json['labelAr'] as String? ?? '',
    );
  }
}

class AdminApprovalCategoryOption {
  const AdminApprovalCategoryOption({
    required this.id,
    required this.nameEn,
    required this.nameAr,
    required this.categoryType,
    required this.status,
    required this.materialCount,
    this.materialFamily,
    this.matchType,
  });

  final String id;
  final String nameEn;
  final String nameAr;
  final String categoryType;
  final String status;
  final int materialCount;
  final AdminTaxonomyOption? materialFamily;
  final String? matchType;

  bool get isExactNameSuggestion => matchType == 'EXACT_NAME';

  bool get canResolveMaterialRequest =>
      status == 'ACTIVE' &&
      (categoryType == 'MATERIAL' || categoryType == 'BOTH') &&
      materialFamily?.isActiveMaterialFamily == true;

  factory AdminApprovalCategoryOption.fromJson(Map<String, dynamic> json) {
    final family = json['materialFamily'];
    return AdminApprovalCategoryOption(
      id: json['id'] as String? ?? '',
      nameEn: json['nameEn'] as String? ?? '',
      nameAr: json['nameAr'] as String? ?? '',
      categoryType: json['categoryType'] as String? ?? '',
      status: json['status'] as String? ?? '',
      materialCount: (json['materialCount'] as num?)?.toInt() ?? 0,
      matchType: json['matchType'] as String?,
      materialFamily: family is Map
          ? AdminTaxonomyOption.fromJson({
              ...Map<String, dynamic>.from(family),
              'conceptType': 'MATERIAL_FAMILY',
              'status': 'ACTIVE',
            })
          : null,
    );
  }
}

class AdminApprovalsSummary {
  const AdminApprovalsSummary({
    required this.pendingTotal,
    required this.approvedTotal,
    required this.rejectedTotal,
    required this.categoryPending,
    required this.pricePending,
  });

  final int pendingTotal;
  final int approvedTotal;
  final int rejectedTotal;
  final int categoryPending;
  final int pricePending;

  factory AdminApprovalsSummary.fromJson(Map<String, dynamic> json) {
    return AdminApprovalsSummary(
      pendingTotal: (json['pendingTotal'] as num?)?.toInt() ?? 0,
      approvedTotal: (json['approvedTotal'] as num?)?.toInt() ?? 0,
      rejectedTotal: (json['rejectedTotal'] as num?)?.toInt() ?? 0,
      categoryPending: (json['categoryPending'] as num?)?.toInt() ?? 0,
      pricePending: (json['pricePending'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminApprovalsPagination {
  const AdminApprovalsPagination({
    required this.page,
    required this.limit,
    required this.total,
  });

  final int page;
  final int limit;
  final int total;

  factory AdminApprovalsPagination.fromJson(Map<String, dynamic> json) {
    return AdminApprovalsPagination(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 20,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminCategoryRequestListItem {
  const AdminCategoryRequestListItem({
    required this.id,
    required this.requestedName,
    required this.status,
    required this.createdAt,
    this.supplierName,
    this.supplierEmail,
    this.supplierOrganization,
    this.adminNote,
    this.approvedCategoryId,
    this.materialTitle,
    this.materialDescription,
    this.quantity,
    this.unit,
    this.condition,
    this.sourceType,
    this.locationLabel,
    this.categoryRequestReason,
    this.similarCategories = const [],
    this.suggestedCategory,
  });

  final String id;
  final String requestedName;
  final String status;
  final DateTime createdAt;
  final String? supplierName;
  final String? supplierEmail;
  final String? supplierOrganization;
  final String? adminNote;
  final String? approvedCategoryId;
  final String? materialTitle;
  final String? materialDescription;
  final double? quantity;
  final String? unit;
  final String? condition;
  final String? sourceType;
  final String? locationLabel;
  final String? categoryRequestReason;
  final List<String> similarCategories;
  final AdminApprovalCategoryOption? suggestedCategory;

  factory AdminCategoryRequestListItem.fromJson(Map<String, dynamic> json) {
    double? numToDouble(Object? value) =>
        (value is num) ? value.toDouble() : null;

    return AdminCategoryRequestListItem(
      id: json['id'] as String,
      requestedName: json['requestedName'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING',
      createdAt: DateTime.parse(json['createdAt'] as String),
      supplierName: json['supplierName'] as String?,
      supplierEmail: json['supplierEmail'] as String?,
      supplierOrganization: json['supplierOrganization'] as String?,
      adminNote: json['adminNote'] as String?,
      approvedCategoryId: json['approvedCategoryId'] as String?,
      materialTitle: json['materialTitle'] as String?,
      materialDescription: json['materialDescription'] as String?,
      quantity: numToDouble(json['quantity']),
      unit: json['unit'] as String?,
      condition: json['condition'] as String?,
      sourceType: json['sourceType'] as String?,
      locationLabel: json['locationLabel'] as String?,
      categoryRequestReason: json['categoryRequestReason'] as String?,
      similarCategories: json['similarCategories'] is List
          ? (json['similarCategories'] as List).whereType<String>().toList(
              growable: false,
            )
          : const [],
      suggestedCategory: json['suggestedCategory'] is Map
          ? AdminApprovalCategoryOption.fromJson(
              Map<String, dynamic>.from(json['suggestedCategory'] as Map),
            )
          : null,
    );
  }
}

class AdminPriceRequestListItem {
  const AdminPriceRequestListItem({
    required this.id,
    required this.status,
    required this.createdAt,
    this.materialTitle,
    this.supplierName,
    this.supplierEmail,
    this.supplierOrganization,
    this.categoryName,
    this.unit,
    this.condition,
    this.quantity,
    this.supplierPriceNis,
    this.aiSuggestedMaxUnitPriceNis,
    this.aiSuggestedMaxTotalPriceNis,
    this.conditionMultiplier,
    this.adjustedMaxUnitPriceNis,
    this.adminNote,
  });

  final String id;
  final String status;
  final DateTime createdAt;
  final String? materialTitle;
  final String? supplierName;
  final String? supplierEmail;
  final String? supplierOrganization;
  final String? categoryName;
  final String? unit;
  final String? condition;
  final double? quantity;
  final double? supplierPriceNis;
  final double? aiSuggestedMaxUnitPriceNis;
  final double? aiSuggestedMaxTotalPriceNis;
  final double? conditionMultiplier;
  final double? adjustedMaxUnitPriceNis;
  final String? adminNote;

  factory AdminPriceRequestListItem.fromJson(Map<String, dynamic> json) {
    double? numToDouble(Object? value) =>
        (value is num) ? value.toDouble() : null;

    return AdminPriceRequestListItem(
      id: json['id'] as String,
      status: json['status'] as String? ?? 'PENDING',
      createdAt: DateTime.parse(json['createdAt'] as String),
      materialTitle: json['materialTitle'] as String?,
      supplierName: json['supplierName'] as String?,
      supplierEmail: json['supplierEmail'] as String?,
      supplierOrganization: json['supplierOrganization'] as String?,
      categoryName: json['categoryName'] as String?,
      unit: json['unit'] as String?,
      condition: json['condition'] as String?,
      quantity: numToDouble(json['quantity']),
      supplierPriceNis: numToDouble(json['supplierPriceNis']),
      aiSuggestedMaxUnitPriceNis: numToDouble(
        json['aiSuggestedMaxUnitPriceNis'],
      ),
      aiSuggestedMaxTotalPriceNis: numToDouble(
        json['aiSuggestedMaxTotalPriceNis'],
      ),
      conditionMultiplier: numToDouble(json['conditionMultiplier']),
      adjustedMaxUnitPriceNis: numToDouble(json['adjustedMaxUnitPriceNis']),
      adminNote: json['adminNote'] as String?,
    );
  }
}

class AdminApprovalsListResponse<T> {
  const AdminApprovalsListResponse({
    required this.items,
    required this.pagination,
  });

  final List<T> items;
  final AdminApprovalsPagination pagination;
}

class AdminApprovalsApi {
  const AdminApprovalsApi(this._client);

  final Dio _client;

  Future<List<AdminTaxonomyOption>> fetchMaterialFamilyOptions() async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/admin/approvals/material-family-options',
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }
      final data = body['data'];
      final items = data is Map<String, dynamic> ? data['items'] : null;
      if (items is! List) return const [];
      return items
          .whereType<Map>()
          .map(
            (item) =>
                AdminTaxonomyOption.fromJson(Map<String, dynamic>.from(item)),
          )
          .where((item) => item.isActiveMaterialFamily)
          .toList(growable: false);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<List<AdminApprovalCategoryOption>>
  fetchMaterialCategoryOptions() async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/admin/approvals/material-category-options',
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }
      final data = body['data'];
      final items = data is Map<String, dynamic> ? data['items'] : null;
      if (items is! List) return const [];
      return items
          .whereType<Map>()
          .map(
            (item) => AdminApprovalCategoryOption.fromJson(
              Map<String, dynamic>.from(item),
            ),
          )
          .where((item) => item.canResolveMaterialRequest)
          .toList(growable: false);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<AdminApprovalsSummary> fetchSummary() async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/admin/approvals/summary',
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }
      final data = body['data'];
      if (data is! Map<String, dynamic>) {
        return const AdminApprovalsSummary(
          pendingTotal: 0,
          approvedTotal: 0,
          rejectedTotal: 0,
          categoryPending: 0,
          pricePending: 0,
        );
      }
      return AdminApprovalsSummary.fromJson(data);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<AdminApprovalsListResponse<AdminCategoryRequestListItem>>
  fetchCategoryRequests({
    required String status,
    required String search,
    required int page,
    required int limit,
  }) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/admin/approvals/category-requests',
        queryParameters: {
          if (status != 'ALL') 'status': status,
          if (search.trim().isNotEmpty) 'search': search.trim(),
          'page': page,
          'limit': limit,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }
      final data = body['data'] as Map<String, dynamic>? ?? const {};
      final itemsJson = data['items'];
      return AdminApprovalsListResponse(
        items: itemsJson is List
            ? itemsJson
                  .whereType<Map>()
                  .map(
                    (e) => AdminCategoryRequestListItem.fromJson(
                      Map<String, dynamic>.from(e),
                    ),
                  )
                  .toList(growable: false)
            : const [],
        pagination: AdminApprovalsPagination.fromJson(
          data['pagination'] as Map<String, dynamic>? ?? const {},
        ),
      );
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<AdminApprovalsListResponse<AdminPriceRequestListItem>>
  fetchPriceRequests({
    required String status,
    required String search,
    required int page,
    required int limit,
  }) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/admin/approvals/price-requests',
        queryParameters: {
          if (status != 'ALL') 'status': status,
          if (search.trim().isNotEmpty) 'search': search.trim(),
          'page': page,
          'limit': limit,
        },
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }
      final data = body['data'] as Map<String, dynamic>? ?? const {};
      final itemsJson = data['items'];
      return AdminApprovalsListResponse(
        items: itemsJson is List
            ? itemsJson
                  .whereType<Map>()
                  .map(
                    (e) => AdminPriceRequestListItem.fromJson(
                      Map<String, dynamic>.from(e),
                    ),
                  )
                  .toList(growable: false)
            : const [],
        pagination: AdminApprovalsPagination.fromJson(
          data['pagination'] as Map<String, dynamic>? ?? const {},
        ),
      );
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<void> approveCategoryRequestWithExisting({
    required String id,
    required String existingCategoryId,
  }) async {
    await _patch(
      '/api/admin/approvals/category-requests/$id/approve',
      data: {
        'resolution': 'USE_EXISTING_CATEGORY',
        'existingCategoryId': existingCategoryId.trim(),
      },
    );
  }

  Future<void> createAndApproveCategoryRequest({
    required String id,
    required String nameEn,
    required String nameAr,
    required String materialFamilyConceptId,
    String? adminJustification,
    bool sharedNameAcknowledged = false,
  }) async {
    await _patch(
      '/api/admin/approvals/category-requests/$id/approve',
      data: {
        'resolution': 'CREATE_NEW_CATEGORY',
        'nameEn': _normalizeCategoryDisplayName(nameEn),
        'nameAr': _normalizeCategoryDisplayName(nameAr),
        'materialFamilyConceptId': materialFamilyConceptId.trim(),
        if (adminJustification != null && adminJustification.trim().isNotEmpty)
          'adminJustification': adminJustification.trim(),
        if (sharedNameAcknowledged) 'sharedNameAcknowledged': true,
      },
    );
  }

  Future<void> rejectCategoryRequest({
    required String id,
    required String adminNote,
    String? suggestedCategoryId,
  }) async {
    await _patch(
      '/api/admin/approvals/category-requests/$id/reject',
      data: {
        'adminNote': adminNote.trim(),
        if (suggestedCategoryId != null &&
            suggestedCategoryId.trim().isNotEmpty)
          'suggestedCategoryId': suggestedCategoryId.trim(),
      },
    );
  }

  Future<void> approvePriceRequest({
    required String id,
    String? adminNote,
  }) async {
    await _patch(
      '/api/admin/approvals/price-requests/$id/approve',
      data: {
        if (adminNote != null && adminNote.trim().isNotEmpty)
          'adminNote': adminNote.trim(),
      },
    );
  }

  Future<void> rejectPriceRequest({
    required String id,
    required String adminNote,
    required double maxAllowedPrice,
  }) async {
    await _patch(
      '/api/admin/approvals/price-requests/$id/reject',
      data: {'adminNote': adminNote.trim(), 'maxAllowedPrice': maxAllowedPrice},
    );
  }

  Future<void> _patch(String path, {required Map<String, dynamic> data}) async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(
        path,
        data: data,
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}

final adminApprovalsApiProvider = Provider<AdminApprovalsApi>((ref) {
  return AdminApprovalsApi(ref.watch(apiClientProvider));
});
