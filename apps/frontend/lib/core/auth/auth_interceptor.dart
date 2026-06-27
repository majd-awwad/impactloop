import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../errors/api_exception.dart';
import 'auth_session_refresh.dart';

class AuthInterceptor extends Interceptor {
  AuthInterceptor({
    required String? Function() getAccessToken,
    required AuthSessionRefresher refreshSession,
    required Dio retryClient,
    required void Function(ApiException error) onSessionExpired,
  })  : _getAccessToken = getAccessToken,
        _refreshSession = refreshSession,
        _retryClient = retryClient,
        _onSessionExpired = onSessionExpired;

  final String? Function() _getAccessToken;
  final AuthSessionRefresher _refreshSession;
  final Dio _retryClient;
  final void Function(ApiException error) _onSessionExpired;

  static const clientPlatformHeader = 'X-Client-Platform';
  static const skipAuthRefreshExtraKey = 'skipAuthRefresh';
  static const retriedAfterRefreshExtraKey = 'retriedAfterRefresh';

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

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final requestOptions = err.requestOptions;

    if (!_shouldRefresh(err)) {
      handler.next(err);
      return;
    }

    final String accessToken;
    try {
      accessToken = await _refreshSession.refreshAccessToken();
    } catch (_) {
      final sessionExpiredError = const ApiException(
        message: 'Your session has expired. Please sign in again.',
        code: 'SESSION_EXPIRED',
        statusCode: 401,
      );
      await _refreshSession.clearSession();
      _onSessionExpired(sessionExpiredError);
      handler.reject(_sessionExpiredDioException(requestOptions));
      return;
    }

    try {
      final retryResponse = await _retryClient.fetch<dynamic>(
        _retryOptions(requestOptions, accessToken),
      );

      handler.resolve(retryResponse);
    } on DioException catch (retryError) {
      handler.reject(retryError);
    } catch (retryError) {
      handler.reject(
        DioException(
          requestOptions: requestOptions,
          error: retryError,
          message: retryError.toString(),
        ),
      );
    }
  }

  bool _shouldRefresh(DioException error) {
    if (error.response?.statusCode != 401) {
      return false;
    }

    final options = error.requestOptions;
    if (options.extra[skipAuthRefreshExtraKey] == true ||
        options.extra[retriedAfterRefreshExtraKey] == true) {
      return false;
    }

    final path = Uri.tryParse(options.path)?.path ?? options.path;
    return !_authPathSkipsRefresh(path);
  }

  bool _authPathSkipsRefresh(String path) {
    return path == '/api/auth/login' ||
        path == '/api/auth/register' ||
        path == '/api/auth/refresh' ||
        path == '/api/auth/logout';
  }

  RequestOptions _retryOptions(RequestOptions options, String accessToken) {
    return options.copyWith(
      headers: {
        ...options.headers,
        'Authorization': 'Bearer $accessToken',
      },
      extra: {
        ...options.extra,
        skipAuthRefreshExtraKey: true,
        retriedAfterRefreshExtraKey: true,
      },
    );
  }

  DioException _sessionExpiredDioException(RequestOptions requestOptions) {
    return DioException(
      requestOptions: requestOptions,
      response: Response<Map<String, dynamic>>(
        requestOptions: requestOptions,
        statusCode: 401,
        data: const {
          'success': false,
          'message': 'Your session has expired. Please sign in again.',
          'error': {'code': 'SESSION_EXPIRED'},
        },
      ),
      type: DioExceptionType.badResponse,
      message: 'Your session has expired. Please sign in again.',
    );
  }
}
