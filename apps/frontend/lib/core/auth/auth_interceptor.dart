import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor({required String? Function() getAccessToken})
    : _getAccessToken = getAccessToken;

  final String? Function() _getAccessToken;

  static const clientPlatformHeader = 'X-Client-Platform';

  static String get clientPlatform => kIsWeb ? 'web' : 'mobile';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers[clientPlatformHeader] = clientPlatform;

    final accessToken = _getAccessToken();

    if (accessToken != null && accessToken.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $accessToken';
    }

    handler.next(options);
  }
}
