import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';

class AdminNoShowReportItem {
  const AdminNoShowReportItem({
    required this.id,
    required this.reservationId,
    required this.status,
    required this.reasonCode,
    required this.note,
    required this.targetRole,
    required this.createdAt,
    required this.reporterName,
    required this.targetName,
    required this.materialTitle,
  });

  final String id;
  final String reservationId;
  final String status;
  final String reasonCode;
  final String? note;
  final String targetRole;
  final DateTime createdAt;
  final String reporterName;
  final String targetName;
  final String materialTitle;

  factory AdminNoShowReportItem.fromJson(Map<String, dynamic> json) {
    final reporter = json['reporter'];
    final target = json['target'];
    final reservation = json['reservation'];
    final material = reservation is Map ? reservation['material'] : null;

    return AdminNoShowReportItem(
      id: json['id'] as String? ?? '',
      reservationId: json['reservationId'] as String? ?? '',
      status: json['status'] as String? ?? 'PENDING_REVIEW',
      reasonCode: json['reasonCode'] as String? ?? '',
      note: json['note'] as String?,
      targetRole: json['targetRole'] as String? ?? '',
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      reporterName: reporter is Map
          ? reporter['displayName'] as String? ?? 'Supplier'
          : 'Supplier',
      targetName: target is Map
          ? target['displayName'] as String? ?? 'Target user'
          : 'Target user',
      materialTitle: material is Map
          ? material['title'] as String? ?? 'Material'
          : 'Material',
    );
  }
}

class AdminNoShowReportsListResponse {
  const AdminNoShowReportsListResponse({
    required this.items,
    required this.total,
  });

  final List<AdminNoShowReportItem> items;
  final int total;

  factory AdminNoShowReportsListResponse.fromJson(Map<String, dynamic> json) {
    final items = json['items'];
    final pagination = json['pagination'];

    return AdminNoShowReportsListResponse(
      items: items is List
          ? items
                .whereType<Map>()
                .map(
                  (item) => AdminNoShowReportItem.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      total: pagination is Map
          ? (pagination['total'] as num?)?.toInt() ?? 0
          : 0,
    );
  }
}

class AdminVerifyNoShowReportResult {
  const AdminVerifyNoShowReportResult({
    required this.targetVerifiedNoShowCount,
    required this.shouldWarnAdmin,
    this.adminRecommendation,
  });

  final int targetVerifiedNoShowCount;
  final bool shouldWarnAdmin;
  final String? adminRecommendation;

  factory AdminVerifyNoShowReportResult.fromJson(Map<String, dynamic> json) {
    return AdminVerifyNoShowReportResult(
      targetVerifiedNoShowCount:
          (json['targetVerifiedNoShowCount'] as num?)?.toInt() ?? 0,
      shouldWarnAdmin: json['shouldWarnAdmin'] == true,
      adminRecommendation: json['adminRecommendation'] as String?,
    );
  }
}

class AdminNoShowReportsApi {
  const AdminNoShowReportsApi(this._client);

  final Dio _client;

  Future<AdminNoShowReportsListResponse> fetchReports({
    String status = 'PENDING_REVIEW',
    int page = 1,
    int limit = 50,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/no-show-reports',
        queryParameters: {
          'status': status,
          'page': page,
          'limit': limit,
        },
      ),
      AdminNoShowReportsListResponse.fromJson,
    );
  }

  Future<AdminVerifyNoShowReportResult> verifyReport(String id) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>('/api/admin/no-show-reports/$id/verify'),
      AdminVerifyNoShowReportResult.fromJson,
    );
  }

  Future<void> rejectReport(String id) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>('/api/admin/no-show-reports/$id/reject'),
      (_) {},
    );
  }
}

final adminNoShowReportsApiProvider = Provider<AdminNoShowReportsApi>((ref) {
  return AdminNoShowReportsApi(ref.watch(apiClientProvider));
});

final adminNoShowReportsProvider = FutureProvider.autoDispose((ref) {
  return ref.watch(adminNoShowReportsApiProvider).fetchReports();
});
