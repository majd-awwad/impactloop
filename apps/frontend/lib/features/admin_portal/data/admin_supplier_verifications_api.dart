import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import 'models/admin_supplier_verifications_models.dart';

class AdminSupplierVerificationsApi {
  const AdminSupplierVerificationsApi(this._client);

  final Dio _client;

  Future<AdminSupplierVerificationListResponse> fetchVerifications(
    AdminSupplierVerificationFilters filters,
  ) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/admin/supplier-verifications',
        queryParameters: filters.toQueryParameters(),
      );
      final body = response.data;

      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }

      final data = body['data'];
      if (data is! Map<String, dynamic>) {
        return const AdminSupplierVerificationListResponse(
          items: [],
          summary: AdminSupplierVerificationSummary(
            pending: 0,
            approved: 0,
            rejected: 0,
            changesRequested: 0,
          ),
          pagination: AdminSupplierVerificationPagination(
            page: 1,
            limit: 20,
            total: 0,
          ),
        );
      }

      return AdminSupplierVerificationListResponse.fromJson(data);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<AdminSupplierVerificationDetail> fetchVerificationDetail(
    String id,
  ) async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/admin/supplier-verifications/$id',
      );
      final body = response.data;

      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }

      final data = body['data'];
      if (data is! Map<String, dynamic>) {
        throw const ApiException(
          message: 'Invalid verification detail response',
        );
      }

      return AdminSupplierVerificationDetail.fromJson(data);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<AdminSupplierVerificationDetail> approveVerification({
    required String id,
    String? adminNote,
  }) {
    return _patchAction(
      '/api/admin/supplier-verifications/$id/approve',
      body: adminNote == null || adminNote.trim().isEmpty
          ? null
          : {'adminNote': adminNote.trim()},
    );
  }

  Future<AdminSupplierVerificationDetail> rejectVerification({
    required String id,
    required String adminNote,
  }) {
    return _patchAction(
      '/api/admin/supplier-verifications/$id/reject',
      body: {'adminNote': adminNote.trim()},
      requireBody: true,
    );
  }

  Future<AdminSupplierVerificationDetail> requestChanges({
    required String id,
    required String adminNote,
  }) {
    return _patchAction(
      '/api/admin/supplier-verifications/$id/request-changes',
      body: {'adminNote': adminNote.trim()},
      requireBody: true,
    );
  }

  Future<AdminVerificationDocumentBytes> downloadVerificationDocument(
    String id,
  ) async {
    try {
      final response = await _client.get<List<int>>(
        '/api/admin/supplier-verifications/$id/document',
        options: Options(
          responseType: ResponseType.bytes,
          headers: const {'Accept': '*/*'},
        ),
      );

      final bytes = response.data;
      if (bytes == null || bytes.isEmpty) {
        throw const ApiException(
          message: 'Verification document download returned no data',
        );
      }

      final contentType =
          response.headers.value('content-type')?.split(';').first.trim() ??
          'application/octet-stream';
      final disposition = response.headers.value('content-disposition');
      final filename = _filenameFromContentDisposition(disposition) ??
          'verification-document';

      return AdminVerificationDocumentBytes(
        bytes: bytes,
        mimeType: contentType,
        filename: filename,
      );
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<AdminSupplierVerificationDetail> _patchAction(
    String path, {
    Map<String, dynamic>? body,
    bool requireBody = false,
  }) async {
    try {
      if (requireBody && (body == null || body.isEmpty)) {
        throw const ApiException(
          message: 'A reason is required for this action.',
          code: 'VALIDATION_ERROR',
        );
      }

      final response = await _client.patch<Map<String, dynamic>>(
        path,
        data: requireBody ? body : (body ?? const <String, dynamic>{}),
      );
      final responseBody = response.data;

      if (responseBody == null || responseBody['success'] != true) {
        throw ApiException(
          message: responseBody?['message'] as String? ?? 'Request failed',
        );
      }

      final data = responseBody['data'];
      if (data is! Map<String, dynamic>) {
        throw const ApiException(
          message: 'Invalid verification action response',
        );
      }

      return AdminSupplierVerificationDetail.fromJson(data);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}

String? _filenameFromContentDisposition(String? header) {
  if (header == null || header.trim().isEmpty) {
    return null;
  }

  final utf8Match = RegExp(
    r"filename\*\s*=\s*UTF-8''([^;]+)",
    caseSensitive: false,
  ).firstMatch(header);
  if (utf8Match != null) {
    return Uri.decodeComponent(utf8Match.group(1)!.trim());
  }

  final plainMatch = RegExp(
    r'filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;]+)',
    caseSensitive: false,
  ).firstMatch(header);
  if (plainMatch == null) {
    return null;
  }

  return (plainMatch.group(1) ?? plainMatch.group(2))?.trim();
}

class AdminVerificationDocumentBytes {
  const AdminVerificationDocumentBytes({
    required this.bytes,
    required this.mimeType,
    required this.filename,
  });

  final List<int> bytes;
  final String mimeType;
  final String filename;
}

final adminSupplierVerificationsApiProvider =
    Provider<AdminSupplierVerificationsApi>((ref) {
      return AdminSupplierVerificationsApi(ref.watch(apiClientProvider));
    });

class AdminSupplierVerificationFiltersNotifier
    extends Notifier<AdminSupplierVerificationFilters> {
  @override
  AdminSupplierVerificationFilters build() {
    return const AdminSupplierVerificationFilters();
  }

  void updateFilters(AdminSupplierVerificationFilters filters) {
    state = filters;
  }
}

final adminSupplierVerificationFiltersProvider =
    NotifierProvider<
      AdminSupplierVerificationFiltersNotifier,
      AdminSupplierVerificationFilters
    >(AdminSupplierVerificationFiltersNotifier.new);

final adminSupplierVerificationsProvider =
    FutureProvider.autoDispose<AdminSupplierVerificationListResponse>((ref) {
      final filters = ref.watch(adminSupplierVerificationFiltersProvider);
      return ref
          .watch(adminSupplierVerificationsApiProvider)
          .fetchVerifications(filters);
    });
