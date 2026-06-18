import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/category_request.dart';

class CategoryRequestsApi {
  const CategoryRequestsApi(this._client);

  final Dio _client;

  Future<CreateCategoryRequestResult> createRequest(
    CreateCategoryRequestPayload payload,
  ) async {
    try {
      if (kDebugMode) {
        debugPrint(
          '[category-request request] POST /api/supplier/category-requests body=${payload.toJson()}',
        );
      }
      final response = await _client.post<Map<String, dynamic>>(
        '/api/supplier/category-requests',
        data: payload.toJson(),
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw ApiException(
          message: body?['message'] as String? ?? 'Unexpected category request response',
          statusCode: response.statusCode,
        );
      }
      final data = body['data'];
      final parsed = data is Map<String, dynamic>
          ? CreateCategoryRequestResult.fromJson(data)
          : const CreateCategoryRequestResult(
              id: '',
              requestedName: '',
              status: 'PENDING',
              message: '',
            );
      return CreateCategoryRequestResult(
        id: parsed.id,
        requestedName: parsed.requestedName,
        status: parsed.status,
        message: body['message'] as String? ?? parsed.message,
      );
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      _logCategoryRequestFailure(
        statusCode: error.response?.statusCode,
        body: error.response?.data,
        message: error.message,
      );
      throw mapDioException(error);
    } catch (error, stackTrace) {
      _logCategoryRequestFailure(message: error.toString());
      if (kDebugMode) {
        debugPrint('[category-request parse failed] $error\n$stackTrace');
      }
      rethrow;
    }
  }

  Future<List<CategoryRequestListItem>> listRequests() async {
    try {
      final response = await _client.get<Map<String, dynamic>>(
        '/api/supplier/category-requests',
      );
      final body = response.data;
      if (body == null || body['success'] != true) {
        throw const FormatException('Unexpected category requests response');
      }
      final rawData = body['data'];
      if (rawData is List) {
        return rawData
            .whereType<Map>()
            .map(
              (item) => CategoryRequestListItem.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList();
      }
      if (rawData is Map<String, dynamic> && rawData['items'] is List) {
        return (rawData['items'] as List)
            .whereType<Map>()
            .map(
              (item) => CategoryRequestListItem.fromJson(
                Map<String, dynamic>.from(item),
              ),
            )
            .toList();
      }
      return const [];
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }

  void _logCategoryRequestFailure({
    int? statusCode,
    Object? body,
    String? message,
  }) {
    if (!kDebugMode) {
      return;
    }

    debugPrint(
      '[category-request failed] status=$statusCode message=$message body=$body',
    );
  }

  Future<CategoryRequestDraftResponse> fetchDraft(String id) {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '/api/supplier/category-requests/$id/draft',
      ),
      CategoryRequestDraftResponse.fromJson,
    );
  }
}
