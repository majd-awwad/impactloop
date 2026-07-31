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

class AdminMaterialsSummary {
  const AdminMaterialsSummary({
    required this.total,
    required this.available,
    required this.paid,
    required this.unavailable,
    required this.reported,
  });

  final int total;
  final int available;
  final int paid;
  final int unavailable;
  final int reported;

  factory AdminMaterialsSummary.fromJson(Map<String, dynamic> json) {
    return AdminMaterialsSummary(
      total: (json['total'] as num?)?.toInt() ?? 0,
      available: (json['available'] as num?)?.toInt() ?? 0,
      paid: (json['paid'] as num?)?.toInt() ?? 0,
      unavailable: (json['unavailable'] as num?)?.toInt() ?? 0,
      reported: (json['reported'] as num?)?.toInt() ?? 0,
    );
  }
}

class AdminMaterialListItem {
  const AdminMaterialListItem({
    required this.materialId,
    required this.title,
    required this.shortDescription,
    required this.categoryName,
    required this.supplierName,
    required this.supplierEmail,
    required this.supplierVerificationStatus,
    required this.city,
    required this.quantity,
    required this.unit,
    required this.condition,
    required this.isFree,
    required this.currency,
    required this.status,
    required this.reportCount,
    required this.pendingReportCount,
    required this.createdAt,
    this.imageUrl,
    this.area,
    this.price,
  });

  final String materialId;
  final String title;
  final String shortDescription;
  final String? imageUrl;
  final String categoryName;
  final String supplierName;
  final String supplierEmail;
  final String supplierVerificationStatus;
  final String city;
  final String? area;
  final double quantity;
  final String unit;
  final String condition;
  final bool isFree;
  final double? price;
  final String currency;
  final String status;
  final int reportCount;
  final int pendingReportCount;
  final DateTime createdAt;

  factory AdminMaterialListItem.fromJson(Map<String, dynamic> json) {
    return AdminMaterialListItem(
      materialId: json['materialId'] as String? ?? '',
      title: json['title'] as String? ?? '',
      shortDescription: json['shortDescription'] as String? ?? '',
      imageUrl: json['imageUrl'] as String?,
      categoryName: json['categoryName'] as String? ?? '',
      supplierName: json['supplierName'] as String? ?? '',
      supplierEmail: json['supplierEmail'] as String? ?? '',
      supplierVerificationStatus:
          json['supplierVerificationStatus'] as String? ?? 'NOT_REQUIRED',
      city: json['city'] as String? ?? '',
      area: json['area'] as String?,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0,
      unit: json['unit'] as String? ?? '',
      condition: json['condition'] as String? ?? '',
      isFree: json['isFree'] as bool? ?? true,
      price: (json['price'] as num?)?.toDouble(),
      currency: json['currency'] as String? ?? 'NIS',
      status: json['status'] as String? ?? 'AVAILABLE',
      reportCount: (json['reportCount'] as num?)?.toInt() ?? 0,
      pendingReportCount: (json['pendingReportCount'] as num?)?.toInt() ?? 0,
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
    );
  }
}

class AdminMaterialReportListItem {
  const AdminMaterialReportListItem({
    required this.reportId,
    required this.reason,
    required this.status,
    required this.reporterName,
    required this.reporterEmail,
    required this.materialTitle,
    required this.materialId,
    required this.materialStatus,
    required this.supplierName,
    required this.supplierVerificationStatus,
    required this.createdAt,
    this.note,
    this.reviewedAt,
    this.adminNote,
  });

  final String reportId;
  final String reason;
  final String? note;
  final String status;
  final String reporterName;
  final String reporterEmail;
  final String materialTitle;
  final String materialId;
  final String materialStatus;
  final String supplierName;
  final String supplierVerificationStatus;
  final DateTime createdAt;
  final DateTime? reviewedAt;
  final String? adminNote;

  factory AdminMaterialReportListItem.fromJson(Map<String, dynamic> json) {
    return AdminMaterialReportListItem(
      reportId: json['reportId'] as String? ?? '',
      reason: json['reason'] as String? ?? '',
      note: json['note'] as String?,
      status: json['status'] as String? ?? 'PENDING',
      reporterName: json['reporterName'] as String? ?? '',
      reporterEmail: json['reporterEmail'] as String? ?? '',
      materialTitle: json['materialTitle'] as String? ?? '',
      materialId: json['materialId'] as String? ?? '',
      materialStatus: json['materialStatus'] as String? ?? '',
      supplierName: json['supplierName'] as String? ?? '',
      supplierVerificationStatus:
          json['supplierVerificationStatus'] as String? ?? 'NOT_REQUIRED',
      createdAt:
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0),
      reviewedAt: json['reviewedAt'] == null
          ? null
          : DateTime.tryParse(json['reviewedAt'] as String),
      adminNote: json['adminNote'] as String?,
    );
  }
}

class AdminMaterialsExportPreflight {
  const AdminMaterialsExportPreflight({
    required this.count,
    required this.filters,
    required this.formats,
  });

  final int count;
  final Map<String, dynamic> filters;
  final Map<String, AdminExportFormatEligibility> formats;

  factory AdminMaterialsExportPreflight.fromJson(Map<String, dynamic> json) {
    final rawFormats = json['formats'];
    final formats = <String, AdminExportFormatEligibility>{};
    if (rawFormats is Map<String, dynamic>) {
      for (final entry in rawFormats.entries) {
        final value = entry.value;
        if (value is Map<String, dynamic>) {
          formats[entry.key] = AdminExportFormatEligibility.fromJson(value);
        }
      }
    }

    return AdminMaterialsExportPreflight(
      count: (json['count'] as num?)?.toInt() ?? 0,
      filters: json['filters'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['filters'] as Map<String, dynamic>)
          : const <String, dynamic>{},
      formats: formats,
    );
  }

  AdminExportFormatEligibility? eligibilityFor(String format) => formats[format];
}

class AdminMaterialsApi {
  const AdminMaterialsApi(this._client);

  final Dio _client;

  Map<String, dynamic> _exportQueryParameters({
    String? search,
    String? status,
    String? reportStatus,
    bool? isFree,
    String? format,
  }) {
    return {
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty && status != 'ALL')
        'status': status,
      if (reportStatus != null &&
          reportStatus.isNotEmpty &&
          reportStatus != 'ALL')
        'reportStatus': reportStatus,
      'isFree': ?isFree,
      'format': ?format,
    };
  }

  Future<AdminMaterialsSummary> fetchSummary() async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/materials/summary'),
      AdminMaterialsSummary.fromJson,
    );
  }

  Future<AdminMaterialsExportPreflight> preflightExport({
    String? search,
    String? status,
    String? reportStatus,
    bool? isFree,
  }) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/materials/export/preflight',
        queryParameters: _exportQueryParameters(
          search: search,
          status: status,
          reportStatus: reportStatus,
          isFree: isFree,
        ),
      ),
      AdminMaterialsExportPreflight.fromJson,
    );
  }

  Future<void> downloadExport({
    String format = 'xlsx',
    String? search,
    String? status,
    String? reportStatus,
    bool? isFree,
  }) async {
    final response = await _client.get<List<int>>(
      '/api/admin/materials/export',
      queryParameters: _exportQueryParameters(
        search: search,
        status: status,
        reportStatus: reportStatus,
        isFree: isFree,
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
        'impactloop-materials.$fallbackExtension';

    downloadAdminExportBytes(
      bytes: bytes,
      filename: filename,
      mimeType: mimeType,
    );
  }

  Future<List<AdminMaterialListItem>> fetchMaterials({
    String? search,
    String? status,
    String? reportStatus,
    bool? isFree,
    int page = 1,
    int limit = 50,
  }) async {
    final normalizedSearch = search?.trim();
    final queryParameters = <String, dynamic>{'page': page, 'limit': limit};
    if (normalizedSearch != null && normalizedSearch.isNotEmpty) {
      queryParameters['search'] = normalizedSearch;
    }
    if (status != null && status != 'ALL') {
      queryParameters['status'] = status;
    }
    if (reportStatus != null && reportStatus != 'ALL') {
      queryParameters['reportStatus'] = reportStatus;
    }
    if (isFree != null) {
      queryParameters['isFree'] = isFree;
    }

    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/materials',
        queryParameters: queryParameters,
      ),
      (json) {
        final items = json['items'];
        if (items is! List) return const <AdminMaterialListItem>[];
        return items
            .whereType<Map>()
            .map(
              (item) => AdminMaterialListItem.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList();
      },
    );
  }

  Future<Map<String, dynamic>> fetchMaterialDetail(String id) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/materials/$id'),
      (json) => Map<String, dynamic>.from(json),
    );
  }

  Future<List<AdminMaterialReportListItem>> fetchReports({
    String? status,
    String? search,
    int page = 1,
    int limit = 50,
  }) async {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/material-reports',
        queryParameters: {
          'page': page,
          'limit': limit,
          if (status != null && status != 'ALL') 'status': status,
          if (search != null && search.trim().isNotEmpty)
            'search': search.trim(),
        },
      ),
      (json) {
        final items = json['items'];
        if (items is! List) return const <AdminMaterialReportListItem>[];
        return items
            .whereType<Map>()
            .map(
              (item) => AdminMaterialReportListItem.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList();
      },
    );
  }

  Future<void> hideMaterial({required String id, required String reason}) {
    return _patch('/api/admin/materials/$id/hide', {'reason': reason.trim()});
  }

  Future<void> markUnavailable({required String id, String? reason}) {
    return _patch('/api/admin/materials/$id/mark-unavailable', {
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
    });
  }

  Future<void> restoreMaterial(String id) {
    return _patch('/api/admin/materials/$id/restore', {});
  }

  Future<void> resolveReport({required String id, String? adminNote}) {
    return _patch('/api/admin/material-reports/$id/resolve', {
      if (adminNote != null && adminNote.trim().isNotEmpty)
        'adminNote': adminNote.trim(),
    });
  }

  Future<void> rejectReport({required String id, required String adminNote}) {
    return _patch('/api/admin/material-reports/$id/reject', {
      'adminNote': adminNote.trim(),
    });
  }

  Future<void> hideMaterialFromReport({
    required String id,
    required String adminNote,
  }) {
    return _patch('/api/admin/material-reports/$id/hide-material', {
      'adminNote': adminNote.trim(),
    });
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

final adminMaterialsApiProvider = Provider<AdminMaterialsApi>((ref) {
  return AdminMaterialsApi(ref.watch(apiClientProvider));
});
