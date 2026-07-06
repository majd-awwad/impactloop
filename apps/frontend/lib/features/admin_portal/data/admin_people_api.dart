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
  });

  final int total;
  final int suspended;
  final int learners;
  final int suppliers;
  final int drivers;
  final int moderators;
  final int admins;

  factory AdminPeopleSummary.fromJson(Map<String, dynamic> json) {
    return AdminPeopleSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      suspended: (json['suspended'] as num?)?.toInt() ?? 0,
      learners: (json['learners'] as num?)?.toInt() ?? 0,
      suppliers: (json['suppliers'] as num?)?.toInt() ?? 0,
      drivers: (json['drivers'] as num?)?.toInt() ?? 0,
      moderators: (json['moderators'] as num?)?.toInt() ?? 0,
      admins: (json['admins'] as num?)?.toInt() ?? 0,
    );
  }
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
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      supplierName: json['supplierName'] as String?,
      supplierType: json['supplierType'] as String?,
      verificationStatus: json['verificationStatus'] as String?,
      driverStatus: json['driverStatus'] as String?,
      suspensionReasonPreview: json['suspensionReasonPreview'] as String?,
      verifiedStrikeCount: (json['verifiedStrikeCount'] as num?)?.toInt() ?? 0,
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

  Future<List<AdminPeopleListItem>> fetchPeople({
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
          if (status != null && status.isNotEmpty && status != 'ALL') 'status': status,
          'page': page,
          'limit': limit,
        },
      ),
      (json) {
        final items = json['items'];
        if (items is! List) return const <AdminPeopleListItem>[];
        return items
            .whereType<Map>()
            .map((item) => AdminPeopleListItem.fromJson(
                  Map<String, dynamic>.from(item),
                ))
            .toList();
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
    await _patch(
      '/api/admin/people/$userId/suspend',
      {'reason': reason},
    );
  }

  Future<void> reactivatePerson({required String userId}) async {
    await _patch('/api/admin/people/$userId/reactivate', {});
  }

  Future<void> _patch(String path, Map<String, dynamic> data) async {
    try {
      final response = await _client.patch<Map<String, dynamic>>(path, data: data);
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(message: body?['message'] as String? ?? 'Request failed');
      }
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}

final adminPeopleApiProvider = Provider<AdminPeopleApi>((ref) {
  return AdminPeopleApi(ref.watch(apiClientProvider));
});
