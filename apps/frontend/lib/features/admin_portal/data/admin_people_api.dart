import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';

class AdminPeopleSummary {
  const AdminPeopleSummary({
    required this.total,
    required this.suspended,
    required this.learners,
    required this.suppliers,
    required this.drivers,
    required this.moderators,
    required this.admins,
    required this.activeUsers,
    required this.verifiedSuppliers,
    required this.newThisMonth,
  });

  final int total;
  final int suspended;
  final int learners;
  final int suppliers;
  final int drivers;
  final int moderators;
  final int admins;
  final int activeUsers;
  final int verifiedSuppliers;
  final int newThisMonth;

  factory AdminPeopleSummary.fromJson(Map<String, dynamic> json) {
    return AdminPeopleSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      suspended: (json['suspended'] as num?)?.toInt() ?? 0,
      learners: (json['learners'] as num?)?.toInt() ?? 0,
      suppliers: (json['suppliers'] as num?)?.toInt() ?? 0,
      drivers: (json['drivers'] as num?)?.toInt() ?? 0,
      moderators: (json['moderators'] as num?)?.toInt() ?? 0,
      admins: (json['admins'] as num?)?.toInt() ?? 0,
      activeUsers: (json['activeUsers'] as num?)?.toInt() ?? 0,
      verifiedSuppliers: (json['verifiedSuppliers'] as num?)?.toInt() ?? 0,
      newThisMonth: (json['newThisMonth'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminPeoplePagination {
  const AdminPeoplePagination({
    required this.page,
    required this.limit,
    required this.total,
  });

  final int page;
  final int limit;
  final int total;

  int get rangeStart => total == 0 ? 0 : ((page - 1) * limit) + 1;

  int get rangeEnd {
    if (total == 0) return 0;
    final end = page * limit;
    return end > total ? total : end;
  }

  factory AdminPeoplePagination.fromJson(Map<String, dynamic> json) {
    return AdminPeoplePagination(
      page: (json['page'] as num?)?.toInt() ?? 1,
      limit: (json['limit'] as num?)?.toInt() ?? 50,
      total: (json['total'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminPeopleListResult {
  const AdminPeopleListResult({
    required this.items,
    required this.pagination,
    this.summary,
  });

  final List<AdminPeopleListItem> items;
  final AdminPeoplePagination pagination;
  final AdminPeopleSummary? summary;
}

class AdminPeopleListItem {
  const AdminPeopleListItem({
    required this.userId,
    required this.displayName,
    required this.email,
    required this.roles,
    required this.accountStatus,
    required this.createdAt,
    required this.canSuspend,
    required this.canReactivate,
    required this.isProtectedAdmin,
    this.primaryRole,
    this.lastLoginAt,
    this.supplierName,
    this.supplierType,
    this.verificationStatus,
    this.driverStatus,
    this.suspensionReasonPreview,
    this.verifiedStrikeCount = 0,
    this.materialsCount = 0,
    this.reservationsAsRequesterCount = 0,
    this.reservationsAsOwnerCount = 0,
    this.submittedLearningProjectsCount = 0,
    this.projectBuildsCount = 0,
    this.assignedDeliveriesCount = 0,
    this.locationCity,
    this.locationArea,
    this.locationLabel,
  });

  final String userId;
  final String displayName;
  final String email;
  final List<String> roles;
  final String? primaryRole;
  final String accountStatus;
  final String? lastLoginAt;
  final DateTime createdAt;
  final String? supplierName;
  final String? supplierType;
  final String? verificationStatus;
  final String? driverStatus;
  final String? suspensionReasonPreview;
  final int verifiedStrikeCount;
  final int materialsCount;
  final int reservationsAsRequesterCount;
  final int reservationsAsOwnerCount;
  final int submittedLearningProjectsCount;
  final int projectBuildsCount;
  final int assignedDeliveriesCount;
  final String? locationCity;
  final String? locationArea;
  final String? locationLabel;
  final bool canSuspend;
  final bool canReactivate;
  final bool isProtectedAdmin;

  factory AdminPeopleListItem.fromJson(Map<String, dynamic> json) {
    return AdminPeopleListItem(
      userId: json['userId'] as String? ?? '',
      displayName: json['displayName'] as String? ?? '',
      email: json['email'] as String? ?? '',
      roles: (json['roles'] as List<dynamic>? ?? [])
          .map((role) => role.toString())
          .toList(),
      primaryRole: json['primaryRole'] as String?,
      accountStatus: json['accountStatus'] as String? ?? 'ACTIVE',
      lastLoginAt: json['lastLoginAt'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      supplierName: json['supplierName'] as String?,
      supplierType: json['supplierType'] as String?,
      verificationStatus: json['verificationStatus'] as String?,
      driverStatus: json['driverStatus'] as String?,
      suspensionReasonPreview: json['suspensionReasonPreview'] as String?,
      verifiedStrikeCount: (json['verifiedStrikeCount'] as num?)?.toInt() ?? 0,
      materialsCount: (json['materialsCount'] as num?)?.toInt() ?? 0,
      reservationsAsRequesterCount:
          (json['reservationsAsRequesterCount'] as num?)?.toInt() ?? 0,
      reservationsAsOwnerCount:
          (json['reservationsAsOwnerCount'] as num?)?.toInt() ?? 0,
      submittedLearningProjectsCount:
          (json['submittedLearningProjectsCount'] as num?)?.toInt() ?? 0,
      projectBuildsCount: (json['projectBuildsCount'] as num?)?.toInt() ?? 0,
      assignedDeliveriesCount:
          (json['assignedDeliveriesCount'] as num?)?.toInt() ?? 0,
      locationCity: json['locationCity'] as String?,
      locationArea: json['locationArea'] as String?,
      locationLabel: json['locationLabel'] as String?,
      canSuspend: json['canSuspend'] as bool? ?? false,
      canReactivate: json['canReactivate'] as bool? ?? false,
      isProtectedAdmin: json['isProtectedAdmin'] as bool? ?? false,
    );
  }
}

class AdminPeopleApi {
  const AdminPeopleApi(this._client);

  final Dio _client;

  Future<AdminPeopleSummary> fetchSummary() async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/people/summary'),
      AdminPeopleSummary.fromJson,
    );
  }

  Future<AdminPeopleListResult> fetchPeople({
    required String tab,
    String search = '',
    String? status,
    int page = 1,
    int limit = 50,
  }) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/people',
        queryParameters: {
          'tab': tab,
          if (search.isNotEmpty) 'search': search,
          if (status != null && status.isNotEmpty && status != 'ALL')
            'status': status,
          'page': page,
          'limit': limit,
        },
      ),
      (json) {
        final items = json['items'];
        final parsedItems = items is List
            ? items
                  .whereType<Map>()
                  .map(
                    (item) => AdminPeopleListItem.fromJson(
                      Map<String, dynamic>.from(item),
                    ),
                  )
                  .toList()
            : const <AdminPeopleListItem>[];

        final paginationRaw = json['pagination'];
        final pagination = paginationRaw is Map
            ? AdminPeoplePagination.fromJson(
                Map<String, dynamic>.from(paginationRaw),
              )
            : AdminPeoplePagination(
                page: page,
                limit: limit,
                total: parsedItems.length,
              );

        final summaryRaw = json['summary'];
        final summary = summaryRaw is Map
            ? AdminPeopleSummary.fromJson(Map<String, dynamic>.from(summaryRaw))
            : null;

        return AdminPeopleListResult(
          items: parsedItems,
          pagination: pagination,
          summary: summary,
        );
      },
    );
  }

  Future<Map<String, dynamic>> fetchPersonDetail(String userId) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/people/$userId'),
      (json) => json,
    );
  }

  Future<void> suspendPerson({
    required String userId,
    required String reason,
  }) async {
    await _patch('/api/admin/people/$userId/suspend', {'reason': reason});
  }

  Future<void> reactivatePerson({required String userId}) async {
    await _patch('/api/admin/people/$userId/reactivate', {});
  }

  Future<void> _patch(String path, Map<String, dynamic> data) async {
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

final adminPeopleApiProvider = Provider<AdminPeopleApi>((ref) {
  return AdminPeopleApi(ref.watch(apiClientProvider));
});
