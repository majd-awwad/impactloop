import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_response.dart';
import 'models/material_price_check_request.dart';
import 'models/material_price_check_result.dart';

class MaterialPriceCheckApi {
  const MaterialPriceCheckApi(this._client);

  final Dio _client;

  Future<MaterialPriceCheckResult> checkPrice(
    MaterialPriceCheckRequest request,
  ) async {
    try {
      final response = await _client.post<Map<String, dynamic>>(
        '/api/materials/price-check',
        data: request.toJson(),
      );
      final body = response.data;

      if (body == null) {
        throw const ApiException(message: 'Empty response from server');
      }

      if (body['success'] != true) {
        final errorBody = body['error'];
        throw ApiException(
          message: body['message'] as String? ?? 'Request failed',
          code: errorBody is Map<String, dynamic>
              ? errorBody['code'] as String?
              : null,
          statusCode: response.statusCode,
          details:
              errorBody is Map<String, dynamic> &&
                  errorBody['details'] is Map<String, dynamic>
              ? Map<String, dynamic>.from(errorBody['details'] as Map)
              : null,
        );
      }

      final rawData = body['data'];
      if (rawData is! Map) {
        throw const ApiException(message: 'Unexpected response data format');
      }

      return MaterialPriceCheckResult.fromJson(
        Map<String, dynamic>.from(rawData),
      );
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      _logPriceCheckFailure(
        statusCode: error.response?.statusCode,
        body: error.response?.data,
        message: error.message,
      );
      throw mapDioException(error);
    } catch (error, stackTrace) {
      _logPriceCheckFailure(message: error.toString());
      if (kDebugMode) {
        debugPrint('[price-check parse failed] $error\n$stackTrace');
      }
      rethrow;
    }
  }

  void _logPriceCheckFailure({int? statusCode, Object? body, String? message}) {
    if (!kDebugMode) {
      return;
    }

    debugPrint(
      '[price-check failed] status=$statusCode message=$message body=$body',
    );
  }
}
