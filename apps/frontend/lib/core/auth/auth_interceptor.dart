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
    void Function(String message)? log,
  })  : _getAccessToken = getAccessToken,
        _refreshSession = refreshSession,
        _retryClient = retryClient,
        _onSessionExpired = onSessionExpired,
        _log = log ?? debugPrint;

  final String? Function() _getAccessToken;
  final AuthSessionRefresher _refreshSession;
  final Dio _retryClient;
  final void Function(ApiException error) _onSessionExpired;
  final void Function(String message) _log;

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
    } on ApiException catch (error, stackTrace) {
      final reason = _refreshFailureReason(error);
      _logRefreshFallback(reason, error, stackTrace);

      if (_isSessionExpiredRefreshFailure(error)) {
        await _expireSessionSafely();
        handler.reject(_sessionExpiredDioException(requestOptions));
      } else {
        handler.reject(_fallbackDioException(requestOptions, reason));
      }
      return;
    } catch (error, stackTrace) {
      _logRefreshFallback('refresh_unavailable', error, stackTrace);
      handler.reject(
        _fallbackDioException(requestOptions, 'refresh_unavailable'),
      );
      return;
    }

    try {
      final retryResponse = await _retryClient.fetch<dynamic>(
        _retryOptions(requestOptions, accessToken),
      );

      handler.resolve(retryResponse);
    } on DioException catch (retryError) {
      if (retryError.type == DioExceptionType.connectionError ||
          retryError.type == DioExceptionType.connectionTimeout ||
          retryError.type == DioExceptionType.sendTimeout ||
          retryError.type == DioExceptionType.receiveTimeout) {
        _logRefreshFallback(
          'retry_unreachable',
          retryError,
          StackTrace.current,
        );
      }
      handler.reject(retryError);
    } catch (retryError, stackTrace) {
      _logRefreshFallback('retry_failed', retryError, stackTrace);
      handler.reject(
        DioException(
          requestOptions: requestOptions,
          error: retryError,
          message: retryError.toString(),
        ),
      );
    }
  }

  bool _isSessionExpiredRefreshFailure(ApiException error) {
    return error.statusCode == 401 ||
        error.statusCode == 403 ||
        error.code == 'UNAUTHENTICATED' ||
        error.code == 'FORBIDDEN';
  }

  String _refreshFailureReason(ApiException error) {
    if (_isSessionExpiredRefreshFailure(error)) {
      return 'refresh_rejected';
    }

    if (error.code == 'NETWORK_ERROR' || error.code == 'TIMEOUT') {
      return 'refresh_unreachable';
    }

    if (error.statusCode != null && error.statusCode! >= 500) {
      return 'refresh_server_error';
    }

    return 'refresh_unavailable';
  }

  Future<void> _expireSessionSafely() async {
    try {
      await _refreshSession.clearSession();
    } catch (error, stackTrace) {
      _logRefreshFallback('session_clear_failed', error, stackTrace);
    }

    try {
      _onSessionExpired(
        const ApiException(
          message: 'Your session has expired. Please sign in again.',
          code: 'SESSION_EXPIRED',
          statusCode: 401,
        ),
      );
    } catch (error, stackTrace) {
      _logRefreshFallback('session_expiry_transition_failed', error, stackTrace);
    }
  }

  void _logRefreshFallback(
    String reason,
    Object error,
    StackTrace stackTrace,
  ) {
    try {
      final status = error is ApiException ? error.statusCode : null;
      _log(
        '[auth] refresh fallback reason=$reason '
        'errorType=${error.runtimeType} status=${status ?? 'none'}',
      );
      if (kDebugMode && stackTrace != StackTrace.empty) {
        _log(stackTrace.toString());
      }
    } catch (_) {
      // Diagnostics must never change the request outcome.
    }
  }

  DioException _fallbackDioException(
    RequestOptions requestOptions,
    String reason,
  ) {
    final isNetworkFailure = reason == 'refresh_unreachable';
    final statusCode = isNetworkFailure ? 503 : 500;
    final code = isNetworkFailure ? 'NETWORK_ERROR' : 'AUTH_REFRESH_UNAVAILABLE';

    return DioException(
      requestOptions: requestOptions,
      response: Response<Map<String, dynamic>>(
        requestOptions: requestOptions,
        statusCode: statusCode,
        data: {
          'success': false,
          'message': isNetworkFailure
              ? 'Could not reach the server'
              : 'Authentication service is temporarily unavailable',
          'error': {'code': code},
        },
      ),
      type: DioExceptionType.badResponse,
      message: isNetworkFailure
          ? 'Could not reach the server'
          : 'Authentication service is temporarily unavailable',
    );
  }

  /*
   * Keep the request's method, URL, body, query, headers, and cancellation
   * settings intact. Only the authorization value and one-shot markers change.
   */
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

}
