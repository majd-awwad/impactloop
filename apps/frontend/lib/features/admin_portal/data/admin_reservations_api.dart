import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import 'admin_export_download.dart';
import 'models/admin_reservations_models.dart';

class AdminExportFormatEligibility {
  const AdminExportFormatEligibility({
    required this.maxAllowed,
    required this.exceedsLimit,
    required this.allowed,
  });

  final int maxAllowed;
  final bool exceedsLimit;
  final bool allowed;

  factory AdminExportFormatEligibility.fromJson(Map<String, dynamic> json) {
    return AdminExportFormatEligibility(
      maxAllowed: (json['maxAllowed'] as num?)?.toInt() ?? 0,
      exceedsLimit: json['exceedsLimit'] == true,
      allowed: json['allowed'] == true,
    );
  }
}

class AdminReservationsExportPreflight {
  const AdminReservationsExportPreflight({
    required this.count,
    required this.filters,
    required this.formats,
  });

  final int count;
  final Map<String, dynamic> filters;
  final Map<String, AdminExportFormatEligibility> formats;

  factory AdminReservationsExportPreflight.fromJson(Map<String, dynamic> json) {
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

    return AdminReservationsExportPreflight(
      count: (json['count'] as num?)?.toInt() ?? 0,
      filters: json['filters'] is Map<String, dynamic>
          ? Map<String, dynamic>.from(json['filters'] as Map<String, dynamic>)
          : const <String, dynamic>{},
      formats: formats,
    );
  }

  AdminExportFormatEligibility? eligibilityFor(String format) => formats[format];
}

class AdminReservationsApi {
  const AdminReservationsApi(this._client);

  final Dio _client;

  Map<String, dynamic> _exportQueryParameters({
    String? search,
    String? status,
    String? hasDelivery,
    String? dateFrom,
    String? dateTo,
    String? format,
  }) {
    return {
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty && status != 'ALL')
        'status': status,
      if (hasDelivery != null && hasDelivery.isNotEmpty && hasDelivery != 'ALL')
        'hasDelivery': hasDelivery,
      if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
      if (format != null && format.isNotEmpty) 'format': format,
    };
  }

  Future<AdminReservationsListResponse> fetchReservations({
    required int page,
    required int limit,
    String? search,
    String? status,
    String? hasDelivery,
    String? dateFrom,
    String? dateTo,
  }) {
    final queryParameters = <String, dynamic>{
      'page': page,
      'limit': limit,
      if (search != null && search.isNotEmpty) 'search': search,
      if (status != null && status.isNotEmpty && status != 'ALL')
        'status': status,
      if (hasDelivery != null && hasDelivery.isNotEmpty && hasDelivery != 'ALL')
        'hasDelivery': hasDelivery,
      if (dateFrom != null && dateFrom.isNotEmpty) 'dateFrom': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'dateTo': dateTo,
    };

    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/reservations',
        queryParameters: queryParameters,
      ),
      AdminReservationsListResponse.fromJson,
    );
  }

  Future<AdminReservationDetail> fetchReservationDetail(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>('/api/admin/reservations/$id'),
      AdminReservationDetail.fromJson,
    );
  }

  Future<AdminReservationsExportPreflight> preflightExport({
    String? search,
    String? status,
    String? hasDelivery,
    String? dateFrom,
    String? dateTo,
  }) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/admin/reservations/export/preflight',
        queryParameters: _exportQueryParameters(
          search: search,
          status: status,
          hasDelivery: hasDelivery,
          dateFrom: dateFrom,
          dateTo: dateTo,
        ),
      ),
      AdminReservationsExportPreflight.fromJson,
    );
  }

  Future<void> downloadExport({
    String format = 'xlsx',
    String? search,
    String? status,
    String? hasDelivery,
    String? dateFrom,
    String? dateTo,
  }) async {
    final response = await _client.get<List<int>>(
      '/api/admin/reservations/export',
      queryParameters: _exportQueryParameters(
        search: search,
        status: status,
        hasDelivery: hasDelivery,
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
      'pdf' => 'application/pdf',
      _ => 'text/csv; charset=utf-8',
    };
    final fallbackExtension = switch (format) {
      'xlsx' => 'xlsx',
      'pdf' => 'pdf',
      _ => 'csv',
    };
    final filename = sanitizeAdminExportFilename(
          parseContentDispositionFilename(
            response.headers.value('content-disposition'),
          ),
        ) ??
        'impactloop-reservations.$fallbackExtension';

    downloadAdminExportBytes(
      bytes: bytes,
      filename: filename,
      mimeType: mimeType,
    );
  }
}

String? parseContentDispositionFilename(String? header) {
  if (header == null || header.isEmpty) {
    return null;
  }

  final star = RegExp(
    r"""filename\*\s*=\s*UTF-8''([^;]+)""",
    caseSensitive: false,
  ).firstMatch(header);
  if (star != null) {
    final encoded = star.group(1)?.trim();
    if (encoded != null && encoded.isNotEmpty) {
      try {
        return Uri.decodeComponent(encoded);
      } catch (_) {
        return encoded;
      }
    }
  }

  final quoted = RegExp(
    r'''filename\s*=\s*"([^"]+)"''',
    caseSensitive: false,
  ).firstMatch(header);
  if (quoted != null) {
    return quoted.group(1);
  }

  final plain = RegExp(
    r'''filename\s*=\s*([^;]+)''',
    caseSensitive: false,
  ).firstMatch(header);
  return plain?.group(1)?.trim();
}

String? sanitizeAdminExportFilename(String? filename) {
  if (filename == null) return null;
  final cleaned = filename
      .replaceAll(RegExp(r'[<>:"/\\|?*\x00-\x1F]'), '_')
      .trim();
  if (cleaned.isEmpty || cleaned == '.' || cleaned == '..') {
    return null;
  }
  return cleaned;
}

final adminReservationsApiProvider = Provider<AdminReservationsApi>((ref) {
  return AdminReservationsApi(ref.watch(apiClientProvider));
});
