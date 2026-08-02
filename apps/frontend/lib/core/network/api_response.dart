import 'package:dio/dio.dart';

import '../errors/api_exception.dart';

class ApiResponse<T> {
  const ApiResponse({required this.success, required this.message, this.data});

  final bool success;
  final String message;
  final T? data;

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> json) parseData,
  ) {
    final rawData = json['data'];

    return ApiResponse(
      success: json['success'] == true,
      message: json['message'] as String? ?? '',
      data: rawData is Map<String, dynamic> ? parseData(rawData) : null,
    );
  }
}

Map<String, dynamic>? _apiErrorBody(Object? responseBody) {
  if (responseBody is! Map) {
    return null;
  }
  final nested = responseBody['error'];
  return nested is Map ? Map<String, dynamic>.from(nested) : null;
}

ApiException mapDioException(DioException error) {
  if (error.type == DioExceptionType.cancel) {
    return const ApiException(message: 'Request cancelled', code: 'CANCELLED');
  }
  if (error.type == DioExceptionType.connectionTimeout ||
      error.type == DioExceptionType.sendTimeout ||
      error.type == DioExceptionType.receiveTimeout) {
    return const ApiException(message: 'Request timed out', code: 'TIMEOUT');
  }

  if (error.type == DioExceptionType.connectionError) {
    return const ApiException(
      message: 'Could not reach the server',
      code: 'NETWORK_ERROR',
    );
  }

  final responseData = error.response?.data;

  if (responseData is Map) {
    final responseBody = Map<String, dynamic>.from(responseData);
    final errorBody = _apiErrorBody(responseBody);

    return ApiException(
      message: responseBody['message'] as String? ?? 'Request failed',
      code: errorBody?['code'] as String?,
      statusCode: error.response?.statusCode,
      details: errorBody?['details'] is Map
          ? Map<String, dynamic>.from(errorBody!['details'] as Map)
          : null,
      requestId: errorBody?['requestId'] as String?,
    );
  }

  return ApiException(
    message: error.message ?? 'Request failed',
    statusCode: error.response?.statusCode,
  );
}

Future<T> unwrapApiResponse<T>(
  Future<Response<Map<String, dynamic>>> request,
  T Function(Map<String, dynamic> json) parseData,
) async {
  try {
    final response = await request;
    final body = response.data;

    if (body == null) {
      throw const ApiException(message: 'Empty response from server');
    }

    if (body['success'] != true) {
      final errorBody = _apiErrorBody(body);

      throw ApiException(
        message: body['message'] as String? ?? 'Request failed',
        code: errorBody?['code'] as String?,
        statusCode: response.statusCode,
        details: errorBody?['details'] is Map
            ? Map<String, dynamic>.from(errorBody!['details'] as Map)
            : null,
        requestId: errorBody?['requestId'] as String?,
      );
    }

    final rawData = body['data'];

    if (rawData is! Map) {
      throw const ApiException(message: 'Unexpected response data format');
    }

    return parseData(Map<String, dynamic>.from(rawData));
  } on DioException catch (error) {
    throw mapDioException(error);
  }
}

Future<void> unwrapApiVoidResponse(
  Future<Response<Map<String, dynamic>>> request,
) async {
  try {
    final response = await request;
    final body = response.data;

    if (body == null) {
      throw const ApiException(message: 'Empty response from server');
    }

    if (body['success'] != true) {
      final errorBody = _apiErrorBody(body);

      throw ApiException(
        message: body['message'] as String? ?? 'Request failed',
        code: errorBody?['code'] as String?,
        statusCode: response.statusCode,
        details: errorBody?['details'] is Map
            ? Map<String, dynamic>.from(errorBody!['details'] as Map)
            : null,
        requestId: errorBody?['requestId'] as String?,
      );
    }
  } on DioException catch (error) {
    throw mapDioException(error);
  }
}
