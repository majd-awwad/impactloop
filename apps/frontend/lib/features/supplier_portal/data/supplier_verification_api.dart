import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';

class UploadedVerificationDocument {
  const UploadedVerificationDocument({
    required this.url,
    required this.name,
    required this.filename,
  });

  final String url;
  final String name;
  final String filename;

  factory UploadedVerificationDocument.fromJson(Map<String, dynamic> json) {
    return UploadedVerificationDocument(
      url: json['url'] as String? ?? '',
      name: json['name'] as String? ?? '',
      filename: json['filename'] as String? ?? '',
    );
  }
}

class SupplierVerificationStatus {
  const SupplierVerificationStatus({
    required this.supplierType,
    required this.verificationStatus,
    this.verificationAdminNote,
    this.verificationSubmittedAt,
    this.verificationReviewedAt,
    this.verificationDocumentName,
    this.verificationDocumentUrl,
    this.organizationName,
    required this.canPublishMaterials,
    required this.canAccessSupplierPortal,
  });

  final String supplierType;
  final String verificationStatus;
  final String? verificationAdminNote;
  final DateTime? verificationSubmittedAt;
  final DateTime? verificationReviewedAt;
  final String? verificationDocumentName;
  final String? verificationDocumentUrl;
  final String? organizationName;
  final bool canPublishMaterials;
  final bool canAccessSupplierPortal;

  factory SupplierVerificationStatus.fromJson(Map<String, dynamic> json) {
    return SupplierVerificationStatus(
      supplierType: json['supplierType'] as String? ?? '',
      verificationStatus: json['verificationStatus'] as String? ?? 'PENDING',
      verificationAdminNote: json['verificationAdminNote'] as String?,
      verificationSubmittedAt: json['verificationSubmittedAt'] == null
          ? null
          : DateTime.tryParse(json['verificationSubmittedAt'] as String),
      verificationReviewedAt: json['verificationReviewedAt'] == null
          ? null
          : DateTime.tryParse(json['verificationReviewedAt'] as String),
      verificationDocumentName: json['verificationDocumentName'] as String?,
      verificationDocumentUrl: json['verificationDocumentUrl'] as String?,
      organizationName: json['organizationName'] as String?,
      canPublishMaterials: json['canPublishMaterials'] as bool? ?? false,
      canAccessSupplierPortal:
          json['canAccessSupplierPortal'] as bool? ?? false,
    );
  }
}

class SupplierVerificationApi {
  const SupplierVerificationApi(this._client);

  final Dio _client;

  Future<SupplierVerificationStatus> fetchStatus() async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/verification/status',
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }
      final data = body['data'] as Map<String, dynamic>? ?? const {};
      return SupplierVerificationStatus.fromJson(data);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<UploadedVerificationDocument> uploadDocument({
    required List<int> bytes,
    required String fileName,
    required String mimeType,
  }) async {
    try {
      final formData = FormData.fromMap({
        'document': MultipartFile.fromBytes(
          bytes,
          filename: fileName,
          contentType: DioMediaType.parse(mimeType),
        ),
      });

      final response = await _client.post<Map<String, dynamic>>(
        '/api/uploads/supplier-verification-document',
        data: formData,
        options: Options(contentType: 'multipart/form-data'),
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Upload failed',
        );
      }
      final document = body['data']?['document'];
      if (document is! Map<String, dynamic>) {
        throw const ApiException(message: 'Invalid upload response');
      }
      return UploadedVerificationDocument.fromJson(document);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  Future<SupplierVerificationStatus> submitVerification(
    Map<String, dynamic> payload,
  ) async {
    return _postStatus('/api/supplier/verification/submit', payload);
  }

  Future<SupplierVerificationStatus> resubmitVerification(
    Map<String, dynamic> payload,
  ) async {
    return _postStatus('/api/supplier/verification/resubmit', payload);
  }

  Future<SupplierVerificationStatus> _postStatus(
    String path,
    Map<String, dynamic> payload,
  ) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        path,
        data: payload,
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Request failed',
        );
      }
      final data = body['data'] as Map<String, dynamic>? ?? const {};
      return SupplierVerificationStatus.fromJson(data);
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}

final supplierVerificationApiProvider = Provider<SupplierVerificationApi>((ref) {
  return SupplierVerificationApi(ref.watch(apiClientProvider));
});

final supplierVerificationStatusProvider =
    FutureProvider.autoDispose<SupplierVerificationStatus>((ref) {
  return ref.watch(supplierVerificationApiProvider).fetchStatus();
});
