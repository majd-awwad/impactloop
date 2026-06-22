import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/auth_interceptor.dart';
import 'package:frontend/core/auth/auth_session_refresh.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/core/errors/api_exception.dart';

void main() {
  test('401 refresh success retries original request once', () async {
    final tokenStorage = _MemoryTokenStorage('refresh-token');
    final tokenHolder = AccessTokenHolder()..accessToken = 'expired-access';
    final refreshClient = Dio()..httpClientAdapter = _RefreshAdapter();
    final apiAdapter = _ApiAdapter();
    final apiClient = Dio()..httpClientAdapter = apiAdapter;
    ApiException? sessionExpired;

    apiClient.interceptors.add(
      AuthInterceptor(
        getAccessToken: () => tokenHolder.accessToken,
        refreshSession: AuthSessionRefresher(
          refreshClient: refreshClient,
          tokenStorage: tokenStorage,
          accessTokenHolder: tokenHolder,
        ),
        retryClient: apiClient,
        onSessionExpired: (error) => sessionExpired = error,
      ),
    );

    final response = await apiClient.get<Map<String, dynamic>>(
      '/api/supplier/dashboard',
    );

    expect(response.statusCode, 200);
    expect(response.data?['success'], isTrue);
    expect(apiAdapter.supplierCallCount, 2);
    expect(apiAdapter.retryAuthorization, 'Bearer refreshed-access');
    expect(tokenHolder.accessToken, 'refreshed-access');
    expect(await tokenStorage.readRefreshToken(), 'rotated-refresh');
    expect(sessionExpired, isNull);
  });

  test('refresh failure clears session and rejects as session expired', () async {
    final tokenStorage = _MemoryTokenStorage('refresh-token');
    final tokenHolder = AccessTokenHolder()..accessToken = 'expired-access';
    final refreshClient = Dio()
      ..httpClientAdapter = _RefreshAdapter(shouldFail: true);
    final apiAdapter = _ApiAdapter();
    final apiClient = Dio()..httpClientAdapter = apiAdapter;
    ApiException? sessionExpired;

    apiClient.interceptors.add(
      AuthInterceptor(
        getAccessToken: () => tokenHolder.accessToken,
        refreshSession: AuthSessionRefresher(
          refreshClient: refreshClient,
          tokenStorage: tokenStorage,
          accessTokenHolder: tokenHolder,
        ),
        retryClient: apiClient,
        onSessionExpired: (error) => sessionExpired = error,
      ),
    );

    final error = await _captureDioError(
      apiClient.get<Map<String, dynamic>>('/api/supplier/dashboard'),
    );

    expect(error.response?.statusCode, 401);
    expect((error.response?.data as Map<String, dynamic>)['error'], {
      'code': 'SESSION_EXPIRED',
    });
    expect(apiAdapter.supplierCallCount, 1);
    expect(tokenHolder.accessToken, isNull);
    expect(await tokenStorage.readRefreshToken(), isNull);
    expect(sessionExpired?.code, 'SESSION_EXPIRED');
  });

  test('retry failure after successful refresh does not clear session', () async {
    final tokenStorage = _MemoryTokenStorage('refresh-token');
    final tokenHolder = AccessTokenHolder()..accessToken = 'expired-access';
    final refreshClient = Dio()..httpClientAdapter = _RefreshAdapter();
    final apiAdapter = _ApiAdapter(retryStatusCode: 500);
    final apiClient = Dio()..httpClientAdapter = apiAdapter;
    ApiException? sessionExpired;

    apiClient.interceptors.add(
      AuthInterceptor(
        getAccessToken: () => tokenHolder.accessToken,
        refreshSession: AuthSessionRefresher(
          refreshClient: refreshClient,
          tokenStorage: tokenStorage,
          accessTokenHolder: tokenHolder,
        ),
        retryClient: apiClient,
        onSessionExpired: (error) => sessionExpired = error,
      ),
    );

    final error = await _captureDioError(
      apiClient.get<Map<String, dynamic>>('/api/supplier/dashboard'),
    );

    expect(error.response?.statusCode, 500);
    expect(apiAdapter.supplierCallCount, 2);
    expect(tokenHolder.accessToken, 'refreshed-access');
    expect(await tokenStorage.readRefreshToken(), 'rotated-refresh');
    expect(sessionExpired, isNull);
  });

  test('concurrent 401s share one refresh call', () async {
    final tokenStorage = _MemoryTokenStorage('refresh-token');
    final tokenHolder = AccessTokenHolder()..accessToken = 'expired-access';
    final refreshAdapter = _RefreshAdapter(delay: const Duration(milliseconds: 20));
    final refreshClient = Dio()..httpClientAdapter = refreshAdapter;
    final apiAdapter = _ApiAdapter();
    final apiClient = Dio()..httpClientAdapter = apiAdapter;

    apiClient.interceptors.add(
      AuthInterceptor(
        getAccessToken: () => tokenHolder.accessToken,
        refreshSession: AuthSessionRefresher(
          refreshClient: refreshClient,
          tokenStorage: tokenStorage,
          accessTokenHolder: tokenHolder,
        ),
        retryClient: apiClient,
        onSessionExpired: (_) {},
      ),
    );

    final responses = await Future.wait([
      apiClient.get<Map<String, dynamic>>('/api/supplier/dashboard'),
      apiClient.get<Map<String, dynamic>>('/api/supplier/profile'),
    ]);

    expect(responses.map((response) => response.statusCode), [200, 200]);
    expect(refreshAdapter.refreshCallCount, 1);
    expect(apiAdapter.supplierCallCount, 4);
  });

  test('auth and skip-marked requests do not trigger refresh', () async {
    final tokenStorage = _MemoryTokenStorage('refresh-token');
    final tokenHolder = AccessTokenHolder()..accessToken = 'expired-access';
    final refreshAdapter = _RefreshAdapter();
    final refreshClient = Dio()..httpClientAdapter = refreshAdapter;
    final apiClient = Dio()..httpClientAdapter = _AlwaysUnauthorizedAdapter();

    apiClient.interceptors.add(
      AuthInterceptor(
        getAccessToken: () => tokenHolder.accessToken,
        refreshSession: AuthSessionRefresher(
          refreshClient: refreshClient,
          tokenStorage: tokenStorage,
          accessTokenHolder: tokenHolder,
        ),
        retryClient: apiClient,
        onSessionExpired: (_) {},
      ),
    );

    for (final path in [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/refresh',
      '/api/auth/logout',
    ]) {
      final error = await _captureDioError(
        apiClient.post<Map<String, dynamic>>(path),
      );
      expect(error.response?.statusCode, 401);
    }

    final skippedError = await _captureDioError(
      apiClient.get<Map<String, dynamic>>(
        '/api/supplier/dashboard',
        options: Options(
          extra: const {AuthInterceptor.skipAuthRefreshExtraKey: true},
        ),
      ),
    );

    expect(skippedError.response?.statusCode, 401);
    expect(refreshAdapter.refreshCallCount, 0);
  });
}

Future<DioException> _captureDioError(Future<Object?> request) async {
  try {
    await request;
  } on DioException catch (error) {
    return error;
  }

  fail('Expected DioException');
}

class _MemoryTokenStorage implements TokenStorage {
  _MemoryTokenStorage(this._refreshToken);

  String? _refreshToken;

  @override
  Future<void> clearRefreshToken() async {
    _refreshToken = null;
  }

  @override
  Future<String?> readRefreshToken() async => _refreshToken;

  @override
  Future<void> saveRefreshToken(String refreshToken) async {
    _refreshToken = refreshToken;
  }
}

class _ApiAdapter implements HttpClientAdapter {
  _ApiAdapter({this.retryStatusCode = 200});

  final int retryStatusCode;
  int supplierCallCount = 0;
  String? retryAuthorization;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    supplierCallCount += 1;

    if (options.extra[AuthInterceptor.retriedAfterRefreshExtraKey] != true) {
      return _jsonResponse(
        401,
        {'success': false, 'message': 'Unauthorized'},
      );
    }

    retryAuthorization = options.headers['Authorization'] as String?;
    return _jsonResponse(
      retryStatusCode,
      {
        'success': retryStatusCode < 400,
        'data': {'ok': true},
      },
    );
  }
}

class _RefreshAdapter implements HttpClientAdapter {
  _RefreshAdapter({this.shouldFail = false, this.delay});

  final bool shouldFail;
  final Duration? delay;
  int refreshCallCount = 0;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    refreshCallCount += 1;
    if (delay != null) {
      await Future<void>.delayed(delay!);
    }

    if (shouldFail) {
      return _jsonResponse(
        401,
        {'success': false, 'message': 'Refresh failed'},
      );
    }

    return _jsonResponse(
      200,
      {
        'success': true,
        'data': {
          'accessToken': 'refreshed-access',
          'refreshToken': 'rotated-refresh',
        },
      },
    );
  }
}

class _AlwaysUnauthorizedAdapter implements HttpClientAdapter {
  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    return _jsonResponse(
      401,
      {'success': false, 'message': 'Unauthorized'},
    );
  }
}

ResponseBody _jsonResponse(int statusCode, Map<String, dynamic> body) {
  return ResponseBody.fromString(
    jsonEncode(body),
    statusCode,
    headers: {
      Headers.contentTypeHeader: [Headers.jsonContentType],
    },
  );
}
