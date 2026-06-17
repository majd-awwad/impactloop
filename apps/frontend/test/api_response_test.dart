import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/core/network/api_response.dart';

void main() {
  test('unwrapApiVoidResponse accepts success responses with null data', () async {
    final response = Response<Map<String, dynamic>>(
      requestOptions: RequestOptions(path: '/api/auth/logout'),
      statusCode: 200,
      data: const {
        'success': true,
        'message': 'Logout successful',
        'data': null,
      },
    );

    await expectLater(
      unwrapApiVoidResponse(Future.value(response)),
      completes,
    );
  });

  test('unwrapApiVoidResponse preserves structured API errors', () async {
    final response = Response<Map<String, dynamic>>(
      requestOptions: RequestOptions(path: '/api/auth/logout'),
      statusCode: 401,
      data: const {
        'success': false,
        'message': 'Refresh token is required',
        'error': {
          'code': 'UNAUTHENTICATED',
        },
      },
    );

    await expectLater(
      unwrapApiVoidResponse(Future.value(response)),
      throwsA(
        isA<Exception>().having(
          (error) => error.toString(),
          'message',
          contains('Refresh token is required'),
        ),
      ),
    );
  });
}
