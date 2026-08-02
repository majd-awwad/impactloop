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
import 'models/admin_deliveries_models.dart';

class AdminDeliveriesExportPreflight {
  const AdminDeliveriesExportPreflight({
    required this.count,
    required this.filters,
    required this.formats,
  });

  final int count;
  final Map<String, dynamic> filters;
  final Map<String, AdminExportFormatEligibility> formats;

  factory AdminDeliveriesExportPreflight.fromJson(Map<String, dynamic> json) {
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

    return AdminDeliveriesExportPreflight(
      count: (json['count'] as num?)?.toInt() ?? 0,
      filters: json['filters'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['filters'] as Map<String, dynamic>)
          : const <String, dynamic>{},
      formats: formats,
    );
  }

  AdminExportFormatEligibility? eligibilityFor(String format) => formats[format];
}

class AdminDeliveriesApi {
  const AdminDeliveriesApi(this._client);

  final Dio _client;

  Map<String, dynamic> _listQueryParameters({
    required int page,
    required int limit,
    String? search,
    String? status,
    String? assignment,
    String? scope,
    String? incidentState,
    String? dateFrom,
    String? dateTo,
  }) {
    return <String, dynamic>{
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty && status != 'ALL')
        'status': status,
      if (assignment != null && assignment.isNotEmpty && assignment != 'ALL')
        'assignment': assignment,
      if (scope != null && scope.isNotEmpty && scope != 'ALL') 'scope': scope,
      if (incidentState != null &&
          incidentState.isNotEmpty &&
          incidentState != 'ALL')
        'incidentState': incidentState,
      if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
    };
  }

  Map<String, dynamic> _exportQueryParameters({
    String? search,
    String? status,
    String? assignment,
    String? scope,
    String? incidentState,
    String? dateFrom,
    String? dateTo,
    String? format,
  }) {
    return <String, dynamic>{
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty && status != 'ALL')
        'status': status,
      if (assignment != null && assignment.isNotEmpty && assignment != 'ALL')
        'assignment': assignment,
      if (scope != null && scope.isNotEmpty && scope != 'ALL') 'scope': scope,
      if (incidentState != null &&
          incidentState.isNotEmpty &&
          incidentState != 'ALL')
        'incidentState': incidentState,
      if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
      if (format != null) 'format': format,
    };
  }

  Future<AdminDeliveriesListResponse> fetchDeliveries({
    required int page,
    required int limit,
    String? search,
    String? status,
    String? assignment,
    String? scope,
    String? incidentState,
    String? dateFrom,
    String? dateTo,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/deliveries',
        queryParameters: _listQueryParameters(
          page: page,
          limit: limit,
          search: search,
          status: status,
          assignment: assignment,
          scope: scope,
          incidentState: incidentState,
          dateFrom: dateFrom,
          dateTo: dateTo,
        ),
      ),
      AdminDeliveriesListResponse.fromJson,
    );
  }

  Future<AdminDeliveriesExportPreflight> preflightExport({
    String? search,
    String? status,
    String? assignment,
    String? scope,
    String? incidentState,
    String? dateFrom,
    String? dateTo,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/deliveries/export/preflight',
        queryParameters: _exportQueryParameters(
          search: search,
          status: status,
          assignment: assignment,
          scope: scope,
          incidentState: incidentState,
          dateFrom: dateFrom,
          dateTo: dateTo,
        ),
      ),
      AdminDeliveriesExportPreflight.fromJson,
    );
  }

  Future<void> downloadExport({
    String format = 'xlsx',
    String? search,
    String? status,
    String? assignment,
    String? scope,
    String? incidentState,
    String? dateFrom,
    String? dateTo,
  }) async {
    final response = await _client.get<List<int>>(
      '/api/admin/deliveries/export',
      queryParameters: _exportQueryParameters(
        search: search,
        status: status,
        assignment: assignment,
        scope: scope,
        incidentState: incidentState,
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
        'impactloop-deliveries.$fallbackExtension';

    downloadAdminExportBytes(
      bytes: bytes,
      filename: filename,
      mimeType: mimeType,
    );
  }

  Future<AdminDeliveryDetail> fetchDeliveryDetail(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/deliveries/$id'),
      AdminDeliveryDetail.fromJson,
    );
  }

  Future<AdminDeliveryDetail> reopenDriverAssignment(String id) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '/api/admin/deliveries/$id/reopen-driver-assignment',
      ),
      AdminDeliveryDetail.fromJson,
    );
  }
}

final adminDeliveriesApiProvider = Provider<AdminDeliveriesApi>((ref) {
  return AdminDeliveriesApi(ref.watch(apiClientProvider));
});
