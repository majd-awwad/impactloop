import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import 'admin_export_download.dart';
import 'admin_reservations_api.dart'
    show
        AdminExportFormatEligibility,
        parseContentDispositionFilename,
        sanitizeAdminExportFilename;

class AdminNoShowReportItem {
  const AdminNoShowReportItem({
    required this.id,
    required this.reservationId,
    required this.deliveryId,
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
    required this.workflowType,
    required this.availableActions,
    required this.strikeImpact,
    required this.operationalState,
    required this.pickupWindowStart,
    required this.pickupWindowEnd,
    required this.reviewedAt,
    required this.reviewNote,
    required this.reviewedBy,
    required this.reviewedByName,
    required this.pendingReschedule,
    this.targetUserId,
    required this.fulfillmentMethod,
    required this.assignedDriverName,
    required this.hasIndividualTarget,
  });

  final String id;
  final String reservationId;
  final String? deliveryId;
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
  final String workflowType;
  final List<String> availableActions;
  final String strikeImpact;
  final String operationalState;
  final DateTime? pickupWindowStart;
  final DateTime? pickupWindowEnd;
  final DateTime? reviewedAt;
  final String? reviewNote;
  final AdminNoShowReportReviewer? reviewedBy;
  final String? reviewedByName;
  final AdminNoShowReportPendingReschedule? pendingReschedule;
  final String? targetUserId;

  /// These optional values are additive contract fields.  The current API
  /// omits them for some older reports, so presentation must fail closed.
  final String? fulfillmentMethod;
  final String? assignedDriverName;
  final bool hasIndividualTarget;

  factory AdminNoShowReportItem.fromJson(Map<String, dynamic> json) {
    final reporter = json['reporter'];
    final target = json['target'];
    final reservation = json['reservation'];
    final material = reservation is Map ? reservation['material'] : null;
    final requester = reservation is Map ? reservation['requester'] : null;
    final owner = reservation is Map ? reservation['owner'] : null;
    final reviewedBy = json['reviewedBy'];
    final pendingReschedule = reservation is Map
        ? reservation['pendingReschedule']
        : null;
    final assignedDriver = reservation is Map
        ? reservation['assignedDriver']
        : json['assignedDriver'];

    return AdminNoShowReportItem(
      id: json['id'] as String? ?? '',
      reservationId: json['reservationId'] as String? ?? '',
      deliveryId: json['deliveryId'] as String?,
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
          ? target['displayName'] as String? ?? 'Target unavailable'
          : json['targetRole'] == 'SYSTEM'
          ? 'System / no driver'
          : 'Target unavailable',
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
      workflowType: json['workflowType'] as String? ?? 'ACCOUNTABILITY',
      availableActions:
          (json['availableActions'] as List?)?.whereType<String>().toList(
            growable: false,
          ) ??
          const [],
      strikeImpact: json['strikeImpact'] as String? ?? 'NONE',
      operationalState: json['operationalState'] as String? ?? 'NOT_REQUIRED',
      pickupWindowStart: DateTime.tryParse(
        json['pickupWindowStart'] as String? ?? '',
      ),
      pickupWindowEnd: DateTime.tryParse(
        json['pickupWindowEnd'] as String? ?? '',
      ),
      reviewedAt: DateTime.tryParse(json['reviewedAt'] as String? ?? ''),
      reviewNote: json['reviewNote'] as String?,
      reviewedBy: reviewedBy is Map
          ? AdminNoShowReportReviewer.fromJson(
              Map<String, dynamic>.from(reviewedBy),
            )
          : null,
      reviewedByName: reviewedBy is Map
          ? reviewedBy['displayName'] as String?
          : null,
      pendingReschedule: pendingReschedule is Map
          ? AdminNoShowReportPendingReschedule.fromJson(
              Map<String, dynamic>.from(pendingReschedule),
            )
          : null,
      targetUserId: target is Map ? target['id'] as String? : null,
      fulfillmentMethod: reservation is Map
          ? reservation['fulfillmentMethod'] as String?
          : null,
      assignedDriverName: assignedDriver is Map
          ? assignedDriver['displayName'] as String?
          : null,
      hasIndividualTarget:
          target is Map && (target['id'] as String?)?.trim().isNotEmpty == true,
    );
  }
}

class AdminNoShowReportsListResponse {
  const AdminNoShowReportsListResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  final List<AdminNoShowReportItem> items;
  final int total;
  final int page;
  final int limit;
  final int? totalPages;

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
      page: pagination is Map ? (pagination['page'] as num?)?.toInt() ?? 1 : 1,
      limit: pagination is Map
          ? (pagination['limit'] as num?)?.toInt() ?? 50
          : 50,
      totalPages: pagination is Map
          ? (pagination['totalPages'] as num?)?.toInt() ??
                (pagination['pages'] as num?)?.toInt()
          : null,
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
    required super.deliveryId,
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
    required super.workflowType,
    required super.availableActions,
    required super.strikeImpact,
    required super.operationalState,
    required super.pickupWindowStart,
    required super.pickupWindowEnd,
    required super.reviewedAt,
    required super.reviewNote,
    required super.reviewedBy,
    required super.reviewedByName,
    required super.pendingReschedule,
    required super.fulfillmentMethod,
    required super.assignedDriverName,
    required super.hasIndividualTarget,
    this.messages = const [],
    this.activityHistory = const [],
    this.deliveryTimeline = const [],
    this.quantityStatus,
    this.targetVerifiedNoShowCount,
  });

  final List<AdminNoShowReportMessage> messages;
  final List<AdminNoShowReportActivityEntry> activityHistory;
  final List<AdminNoShowReportActivityEntry> deliveryTimeline;
  final AdminNoShowReportQuantityStatus? quantityStatus;
  final int? targetVerifiedNoShowCount;

  factory AdminNoShowReportDetail.fromJson(Map<String, dynamic> json) {
    final base = AdminNoShowReportItem.fromJson(json);
    final messages = json['messages'];
    final history = json['activityHistory'];
    final deliveryTimeline = json['deliveryTimeline'];
    final quantityStatus = json['quantityStatus'];

    return AdminNoShowReportDetail(
      id: base.id,
      reservationId: base.reservationId,
      deliveryId: base.deliveryId,
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
      workflowType: base.workflowType,
      availableActions: base.availableActions,
      strikeImpact: base.strikeImpact,
      operationalState: base.operationalState,
      pickupWindowStart: base.pickupWindowStart,
      pickupWindowEnd: base.pickupWindowEnd,
      reviewedAt: base.reviewedAt,
      reviewNote: base.reviewNote,
      reviewedBy: base.reviewedBy,
      reviewedByName: base.reviewedByName,
      pendingReschedule: base.pendingReschedule,
      fulfillmentMethod: base.fulfillmentMethod,
      assignedDriverName: base.assignedDriverName,
      hasIndividualTarget: base.hasIndividualTarget,
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
      deliveryTimeline: deliveryTimeline is List
          ? deliveryTimeline
                .whereType<Map>()
                .map(
                  (item) => AdminNoShowReportActivityEntry.fromJson(
                    Map<String, dynamic>.from(item),
                  ),
                )
                .toList(growable: false)
          : const [],
      quantityStatus: quantityStatus is Map
          ? AdminNoShowReportQuantityStatus.fromJson(
              Map<String, dynamic>.from(quantityStatus),
            )
          : null,
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

class AdminNoShowReportReviewer {
  const AdminNoShowReportReviewer({
    required this.id,
    required this.displayName,
  });

  final String id;
  final String displayName;

  factory AdminNoShowReportReviewer.fromJson(Map<String, dynamic> json) =>
      AdminNoShowReportReviewer(
        id: json['id'] as String? ?? '',
        displayName: json['displayName'] as String? ?? '',
      );
}

class AdminNoShowReportPendingReschedule {
  const AdminNoShowReportPendingReschedule({
    required this.requestedBy,
    required this.reason,
    required this.note,
    required this.proposedPickupWindowStart,
    required this.proposedPickupWindowEnd,
  });

  final String? requestedBy;
  final String? reason;
  final String? note;
  final DateTime? proposedPickupWindowStart;
  final DateTime? proposedPickupWindowEnd;

  factory AdminNoShowReportPendingReschedule.fromJson(
    Map<String, dynamic> json,
  ) => AdminNoShowReportPendingReschedule(
    requestedBy: json['requestedBy'] as String?,
    reason: json['reason'] as String?,
    note: json['note'] as String?,
    proposedPickupWindowStart: DateTime.tryParse(
      json['proposedPickupWindowStart'] as String? ?? '',
    ),
    proposedPickupWindowEnd: DateTime.tryParse(
      json['proposedPickupWindowEnd'] as String? ?? '',
    ),
  );
}

class AdminNoShowReportQuantityStatus {
  const AdminNoShowReportQuantityStatus({
    required this.materialQuantity,
    required this.heldQuantity,
    required this.availableQuantity,
  });

  final double materialQuantity;
  final double heldQuantity;
  final double availableQuantity;

  factory AdminNoShowReportQuantityStatus.fromJson(Map<String, dynamic> json) =>
      AdminNoShowReportQuantityStatus(
        materialQuantity: (json['materialQuantity'] as num?)?.toDouble() ?? 0,
        heldQuantity: (json['heldQuantity'] as num?)?.toDouble() ?? 0,
        availableQuantity: (json['availableQuantity'] as num?)?.toDouble() ?? 0,
      );
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
    required this.id,
    required this.statusGroup,
    required this.oldStatus,
    required this.newStatus,
    required this.note,
    required this.createdAt,
    required this.changedByName,
    required this.changedById,
  });

  final String id;
  final String? statusGroup;
  final String? oldStatus;
  final String newStatus;
  final String? note;
  final DateTime createdAt;
  final String? changedByName;
  final String? changedById;

  factory AdminNoShowReportActivityEntry.fromJson(Map<String, dynamic> json) {
    final changedBy = json['changedBy'];
    return AdminNoShowReportActivityEntry(
      id: json['id'] as String? ?? '',
      statusGroup: json['statusGroup'] as String?,
      oldStatus: json['oldStatus'] as String?,
      newStatus: json['newStatus'] as String? ?? '',
      note: json['note'] as String?,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      changedByName: changedBy is Map
          ? changedBy['displayName'] as String?
          : null,
      changedById: changedBy is Map ? changedBy['id'] as String? : null,
    );
  }
}

class AdminNoShowReportsExportPreflight {
  const AdminNoShowReportsExportPreflight({
    required this.count,
    required this.filters,
    required this.formats,
  });

  final int count;
  final Map<String, dynamic> filters;
  final Map<String, AdminExportFormatEligibility> formats;

  factory AdminNoShowReportsExportPreflight.fromJson(
    Map<String, dynamic> json,
  ) {
    final rawFormats = json['formats'];
    final formats = <String, AdminExportFormatEligibility>{};
    if (rawFormats is Map) {
      for (final entry in rawFormats.entries) {
        final value = entry.value;
        if (value is Map) {
          formats[entry.key as String] = AdminExportFormatEligibility.fromJson(
            Map<String, dynamic>.from(value),
          );
        }
      }
    }

    return AdminNoShowReportsExportPreflight(
      count: (json['count'] as num?)?.toInt() ?? 0,
      filters: json['filters'] is Map
          ? Map<String, dynamic>.from(json['filters'] as Map)
          : const <String, dynamic>{},
      formats: formats,
    );
  }

  AdminExportFormatEligibility? eligibilityFor(String format) =>
      formats[format];
}

class AdminNoShowReportsApi {
  const AdminNoShowReportsApi(this._client);

  final Dio _client;

  Map<String, dynamic> _exportQueryParameters({
    String? status,
    String? search,
    String? workflow,
    String? targetRole,
    String? operationalState,
    String? dateFrom,
    String? dateTo,
    String? format,
  }) {
    return {
      if (status != null && status.trim().isNotEmpty && status != 'ALL')
        'status': status,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (workflow != null && workflow.trim().isNotEmpty && workflow != 'ALL')
        'workflow': workflow,
      if (targetRole != null &&
          targetRole.trim().isNotEmpty &&
          targetRole != 'ALL')
        'targetRole': targetRole,
      if (operationalState != null &&
          operationalState.trim().isNotEmpty &&
          operationalState != 'ALL')
        'operationalState': operationalState,
      if (dateFrom != null && dateFrom.trim().isNotEmpty) 'dateFrom': dateFrom,
      if (dateTo != null && dateTo.trim().isNotEmpty) 'dateTo': dateTo,
      if (format != null && format.trim().isNotEmpty) 'format': format,
    };
  }

  Future<AdminNoShowReportsListResponse> fetchReports({
    String? status,
    int page = 1,
    int limit = 50,
    String? search,
    String? workflow,
    String? targetRole,
    String? operationalState,
    String? dateFrom,
    String? dateTo,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/no-show-reports',
        queryParameters: {
          if (status != null && status.trim().isNotEmpty) 'status': status,
          'page': page,
          'limit': limit,
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
          if (workflow != null && workflow.trim().isNotEmpty)
            'workflow': workflow,
          if (targetRole != null && targetRole.trim().isNotEmpty)
            'targetRole': targetRole,
          if (operationalState != null && operationalState.trim().isNotEmpty)
            'operationalState': operationalState,
          if (dateFrom != null && dateFrom.trim().isNotEmpty)
            'dateFrom': dateFrom,
          if (dateTo != null && dateTo.trim().isNotEmpty) 'dateTo': dateTo,
        },
      ),
      AdminNoShowReportsListResponse.fromJson,
    );
  }

  Future<AdminNoShowReportsExportPreflight> preflightExport({
    String? status,
    String? search,
    String? workflow,
    String? targetRole,
    String? operationalState,
    String? dateFrom,
    String? dateTo,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/no-show-reports/export/preflight',
        queryParameters: _exportQueryParameters(
          status: status,
          search: search,
          workflow: workflow,
          targetRole: targetRole,
          operationalState: operationalState,
          dateFrom: dateFrom,
          dateTo: dateTo,
        ),
      ),
      AdminNoShowReportsExportPreflight.fromJson,
    );
  }

  Future<void> downloadExport({
    String format = 'xlsx',
    String? status,
    String? search,
    String? workflow,
    String? targetRole,
    String? operationalState,
    String? dateFrom,
    String? dateTo,
  }) async {
    final response = await _client.get<List<int>>(
      '/api/admin/no-show-reports/export',
      queryParameters: _exportQueryParameters(
        status: status,
        search: search,
        workflow: workflow,
        targetRole: targetRole,
        operationalState: operationalState,
        dateFrom: dateFrom,
        dateTo: dateTo,
        format: format,
      ),
      options: Options(responseType: ResponseType.bytes),
    );

    final bytes = response.data;
    if (bytes == null || bytes.isEmpty) {
      throw const ApiException(
        message: 'Export file was empty.',
        code: 'EXPORT_EMPTY',
      );
    }

    final mimeType = switch (format) {
      'xlsx' =>
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      _ => 'text/csv; charset=utf-8',
    };
    final fallbackExtension = format == 'xlsx' ? 'xlsx' : 'csv';
    final filename =
        sanitizeAdminExportFilename(
          parseContentDispositionFilename(
            response.headers.value('content-disposition'),
          ),
        ) ??
        'impactloop-incident-reports.$fallbackExtension';

    downloadAdminExportBytes(
      bytes: bytes,
      filename: filename,
      mimeType: mimeType,
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
