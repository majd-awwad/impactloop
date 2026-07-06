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
    required this.learnerName,
    required this.supplierName,
    required this.reservationStatus,
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
  final String learnerName;
  final String supplierName;
  final String reservationStatus;

  factory AdminNoShowReportItem.fromJson(Map<String, dynamic> json) {
    final reporter = json['reporter'];
    final target = json['target'];
    final reservation = json['reservation'];
    final material = reservation is Map ? reservation['material'] : null;
    final requester = reservation is Map ? reservation['requester'] : null;
    final owner = reservation is Map ? reservation['owner'] : null;

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
          : json['targetRole'] == 'SYSTEM'
              ? 'System / no driver'
              : 'Target user',
      materialTitle: material is Map
          ? material['title'] as String? ?? 'Material'
          : 'Material',
      learnerName: requester is Map
          ? requester['displayName'] as String? ?? 'Learner'
          : 'Learner',
      supplierName: owner is Map
          ? owner['displayName'] as String? ?? 'Supplier'
          : 'Supplier',
      reservationStatus: reservation is Map
          ? reservation['status'] as String? ?? 'PENDING'
          : 'PENDING',
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
    this.targetSuspended = false,
  });

  final int targetVerifiedNoShowCount;
  final bool shouldWarnAdmin;
  final String? adminRecommendation;
  final bool targetSuspended;

  factory AdminVerifyNoShowReportResult.fromJson(Map<String, dynamic> json) {
    return AdminVerifyNoShowReportResult(
      targetVerifiedNoShowCount:
          (json['targetVerifiedNoShowCount'] as num?)?.toInt() ?? 0,
      shouldWarnAdmin: json['shouldWarnAdmin'] == true,
      adminRecommendation: json['adminRecommendation'] as String?,
      targetSuspended: json['targetSuspended'] == true,
    );
  }
}

class AdminNoShowReportDetail extends AdminNoShowReportItem {
  const AdminNoShowReportDetail({
    required super.id,
    required super.reservationId,
    required super.status,
    required super.reasonCode,
    required super.note,
    required super.targetRole,
    required super.createdAt,
    required super.reporterName,
    required super.targetName,
    required super.materialTitle,
    required super.learnerName,
    required super.supplierName,
    required super.reservationStatus,
    this.messages = const [],
    this.activityHistory = const [],
    this.targetVerifiedNoShowCount,
  });

  final List<AdminNoShowReportMessage> messages;
  final List<AdminNoShowReportActivityEntry> activityHistory;
  final int? targetVerifiedNoShowCount;

  factory AdminNoShowReportDetail.fromJson(Map<String, dynamic> json) {
    final base = AdminNoShowReportItem.fromJson(json);
    final messages = json['messages'];
    final history = json['activityHistory'];

    return AdminNoShowReportDetail(
      id: base.id,
      reservationId: base.reservationId,
      status: base.status,
      reasonCode: base.reasonCode,
      note: base.note,
      targetRole: base.targetRole,
      createdAt: base.createdAt,
      reporterName: base.reporterName,
      targetName: base.targetName,
      materialTitle: base.materialTitle,
      learnerName: base.learnerName,
      supplierName: base.supplierName,
      reservationStatus: base.reservationStatus,
      messages: messages is List
          ? messages
                .whereType<Map>()
                .map(
                  (item) => AdminNoShowReportMessage.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      activityHistory: history is List
          ? history
                .whereType<Map>()
                .map(
                  (item) => AdminNoShowReportActivityEntry.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      targetVerifiedNoShowCount:
          (json['targetVerifiedNoShowCount'] as num?)?.toInt() ??
          (json['targetVerifiedStrikeCount'] as num?)?.toInt(),
    );
  }
}

class AdminNoShowReportMessage {
  const AdminNoShowReportMessage({
    required this.body,
    required this.senderName,
    required this.createdAt,
  });

  final String body;
  final String senderName;
  final DateTime createdAt;

  factory AdminNoShowReportMessage.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'];
    return AdminNoShowReportMessage(
      body: json['body'] as String? ?? '',
      senderName: sender is Map
          ? sender['displayName'] as String? ?? 'User'
          : 'User',
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class AdminNoShowReportActivityEntry {
  const AdminNoShowReportActivityEntry({
    required this.oldStatus,
    required this.newStatus,
    required this.note,
    required this.createdAt,
    required this.changedByName,
  });

  final String? oldStatus;
  final String newStatus;
  final String? note;
  final DateTime createdAt;
  final String? changedByName;

  factory AdminNoShowReportActivityEntry.fromJson(Map<String, dynamic> json) {
    final changedBy = json['changedBy'];
    return AdminNoShowReportActivityEntry(
      oldStatus: json['oldStatus'] as String?,
      newStatus: json['newStatus'] as String? ?? '',
      note: json['note'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      changedByName: changedBy is Map
          ? changedBy['displayName'] as String?
          : null,
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
      _client.patch<Map<String, dynamic>>(
        '/api/admin/no-show-reports/$id/verify',
        data: const <String, dynamic>{},
      ),
      AdminVerifyNoShowReportResult.fromJson,
    );
  }

  Future<AdminNoShowReportDetail> fetchReportDetail(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/no-show-reports/$id'),
      AdminNoShowReportDetail.fromJson,
    );
  }

  Future<void> rejectReport(String id) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/admin/no-show-reports/$id/reject',
        data: const <String, dynamic>{},
      ),
      (_) {},
    );
  }

  Future<void> resolveReport(String id, {String? reviewNote}) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '/api/admin/no-show-reports/$id/resolve',
        data: {
          if (reviewNote != null && reviewNote.trim().isNotEmpty)
            'reviewNote': reviewNote.trim(),
        },
      ),
      (_) {},
    );
  }

  Future<void> requestSupplierReschedule(String id, {String? adminNote}) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/admin/no-show-reports/$id/request-supplier-reschedule',
        data: {
          if (adminNote != null && adminNote.trim().isNotEmpty)
            'adminNote': adminNote.trim(),
        },
      ),
      (_) {},
    );
  }

  Future<void> cancelAndReleaseHold(String id, {String? adminNote}) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/admin/no-show-reports/$id/cancel-release-hold',
        data: {
          if (adminNote != null && adminNote.trim().isNotEmpty)
            'adminNote': adminNote.trim(),
        },
      ),
      (_) {},
    );
  }
}

final adminNoShowReportsApiProvider = Provider<AdminNoShowReportsApi>((ref) {
  return AdminNoShowReportsApi(ref.watch(apiClientProvider));
});
