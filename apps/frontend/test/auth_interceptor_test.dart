import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/auth_interceptor.dart';
import 'package:frontend/core/auth/auth_session_refresh.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/home/data/learner_home_api.dart';
import 'package:frontend/features/home/application/learner_home_provider.dart';
import 'package:frontend/features/home/domain/learner_home_models.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/application/auth_providers.dart';
import 'package:frontend/features/auth/data/auth_repository.dart';
import 'package:frontend/features/auth/data/auth_api.dart';
import 'package:frontend/features/auth/data/models/user.dart';

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
      queryParameters: const {'page': 2},
      options: Options(headers: const {'X-Request-Shape': 'preserve'}),
    );

    expect(response.statusCode, 200);
    expect(response.data?['success'], isTrue);
    expect(apiAdapter.supplierCallCount, 2);
    expect(apiAdapter.retryAuthorization, 'Bearer refreshed-access');
    expect(apiAdapter.retryQueryParameters, {'page': 2});
    expect(apiAdapter.retryRequestHeader, 'preserve');
    expect(tokenHolder.accessToken, 'refreshed-access');
    expect(await tokenStorage.readRefreshToken(), 'rotated-refresh');
    expect(sessionExpired, isNull);
  });

  test(
    'refresh failure clears session and rejects as session expired',
    () async {
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
      expect(
        classifyLearnerHomeError(sessionExpired!).kind,
        LearnerHomeErrorKind.sessionExpired,
      );
    },
  );

  test(
    'retry failure after successful refresh does not clear session',
    () async {
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
    },
  );

  test(
    'refresh unreachable does not clear session or re-enter refresh',
    () async {
      final tokenStorage = _MemoryTokenStorage('refresh-token');
      final tokenHolder = AccessTokenHolder()..accessToken = 'expired-access';
      final refreshClient = Dio()
        ..httpClientAdapter = _RefreshAdapter(networkFailure: true);
      final apiAdapter = _ApiAdapter();
      final apiClient = Dio()..httpClientAdapter = apiAdapter;
      ApiException? sessionExpired;
      final logs = <String>[];

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
          log: logs.add,
        ),
      );

      final error = await _captureDioError(
        apiClient.get<Map<String, dynamic>>('/api/supplier/dashboard'),
      );

      expect(error.response?.statusCode, 503);
      expect(error.response?.data, {
        'success': false,
        'message': 'Could not reach the server',
        'error': {'code': 'NETWORK_ERROR'},
      });
      expect(apiAdapter.supplierCallCount, 1);
      expect(tokenHolder.accessToken, 'expired-access');
      expect(await tokenStorage.readRefreshToken(), 'refresh-token');
      expect(sessionExpired, isNull);
      expect(
        logs.any((message) => message.contains('reason=refresh_unreachable')),
        isTrue,
      );
      expect(logs.join('\n'), isNot(contains('refresh-token')));
    },
  );

  test('concurrent 401s share one refresh call', () async {
    final tokenStorage = _MemoryTokenStorage('refresh-token');
    final tokenHolder = AccessTokenHolder()..accessToken = 'expired-access';
    final refreshAdapter = _RefreshAdapter(
      delay: const Duration(milliseconds: 20),
    );
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

  test('Learner Home maps unauthorized responses to session-expired', () async {
    final api = LearnerHomeApi(
      Dio()..httpClientAdapter = _LearnerHomeAdapter(statusCode: 401),
    );

    final failure = await _captureLearnerHomeFailure(api.fetchHomeFeed());

    expect(failure.kind, LearnerHomeErrorKind.sessionExpired);
    expect(failure.title, 'Session expired');
    expect(failure.title, isNot(contains('recommendations')));
  });

  test('Learner Home distinguishes network, server, and parsing failures', () {
    expect(
      classifyLearnerHomeError(
        const ApiException(code: 'NETWORK_ERROR', message: 'unreachable'),
      ).kind,
      LearnerHomeErrorKind.networkUnavailable,
    );
    expect(
      classifyLearnerHomeError(
        const ApiException(statusCode: 500, message: 'server error'),
      ).kind,
      LearnerHomeErrorKind.server,
    );
    expect(
      classifyLearnerHomeError(const FormatException('bad shape')).kind,
      LearnerHomeErrorKind.parsing,
    );
  });

  test(
    'Learner Home reaches loaded state when a network retry succeeds',
    () async {
      final adapter = _LearnerHomeAdapter(networkFailure: true);
      final api = LearnerHomeApi(Dio()..httpClientAdapter = adapter);

      await expectLater(
        api.fetchHomeFeed(),
        throwsA(isA<LearnerHomeFailure>()),
      );

      adapter.networkFailure = false;
      final feed = await api.fetchHomeFeed();

      expect(feed.sections, isEmpty);
      expect(adapter.homeCallCount, 2);
    },
  );

  test(
    'stale session error is cleared and learner home reloads after login',
    () async {
      final homeApi = _ReloadableLearnerHomeApi(failFirst: true);
      final repository = _LoginAuthRepository();
      final container = ProviderContainer(
        overrides: [
          authRepositoryProvider.overrideWithValue(repository),
          learnerHomeApiProvider.overrideWithValue(homeApi),
        ],
      );
      addTearDown(container.dispose);

      final subscription = container.listen(
        learnerHomeFeedProvider,
        (_, _) {},
        fireImmediately: true,
      );
      addTearDown(subscription.close);

      await expectLater(
        container.read(learnerHomeFeedProvider.future),
        throwsA(isA<ApiException>()),
      );

      final controller = container.read(authControllerProvider.notifier);
      container
          .read(authSessionExpiryProvider.notifier)
          .expire(
            const ApiException(
              statusCode: 401,
              code: 'SESSION_EXPIRED',
              message: 'expired',
            ),
          );
      await Future<void>.delayed(Duration.zero);

      await controller.login(
        email: 'learner@example.test',
        password: 'password',
      );
      await container.read(learnerHomeFeedProvider.future);

      expect(container.read(authControllerProvider).error, isNull);
      expect(container.read(authSessionExpiryProvider), isNull);
      expect(repository.loginCallCount, 1);
      expect(repository.meCallCount, 1);
      expect(homeApi.fetchCount, 2);
    },
  );
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
  Map<String, dynamic>? retryQueryParameters;
  String? retryRequestHeader;

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
      return _jsonResponse(401, {'success': false, 'message': 'Unauthorized'});
    }

    retryAuthorization = options.headers['Authorization'] as String?;
    retryQueryParameters = options.queryParameters;
    retryRequestHeader = options.headers['X-Request-Shape'] as String?;
    return _jsonResponse(retryStatusCode, {
      'success': retryStatusCode < 400,
      'data': {'ok': true},
    });
  }
}

class _RefreshAdapter implements HttpClientAdapter {
  _RefreshAdapter({
    this.shouldFail = false,
    this.networkFailure = false,
    this.delay,
  });

  final bool shouldFail;
  final bool networkFailure;
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

    if (networkFailure) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        message: 'Connection refused',
      );
    }

    if (shouldFail) {
      return _jsonResponse(401, {
        'success': false,
        'message': 'Refresh failed',
      });
    }

    return _jsonResponse(200, {
      'success': true,
      'data': {
        'accessToken': 'refreshed-access',
        'refreshToken': 'rotated-refresh',
      },
    });
  }
}

class _LearnerHomeAdapter implements HttpClientAdapter {
  _LearnerHomeAdapter({this.statusCode = 200, this.networkFailure = false});

  final int statusCode;
  bool networkFailure;
  int homeCallCount = 0;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    homeCallCount += 1;
    if (networkFailure) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        message: 'Connection refused',
      );
    }

    if (statusCode != 200) {
      return _jsonResponse(statusCode, {
        'success': false,
        'message': 'Unauthorized',
      });
    }

    return _jsonResponse(200, {
      'success': true,
      'data': {
        'profileCompletion': {'percentage': 100},
        'sections': const [],
      },
    });
  }
}

Future<LearnerHomeFailure> _captureLearnerHomeFailure(
  Future<Object?> request,
) async {
  try {
    await request;
  } on LearnerHomeFailure catch (error) {
    return error;
  }

  fail('Expected a LearnerHomeFailure');
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
    return _jsonResponse(401, {'success': false, 'message': 'Unauthorized'});
  }
}

class _LoginAuthRepository extends AuthRepository {
  _LoginAuthRepository()
    : super(
        api: AuthApi(Dio()),
        tokenStorage: _MemoryTokenStorage(null),
        accessTokenHolder: AccessTokenHolder(),
      );

  final _user = User(
    id: 'learner-1',
    displayName: 'Learner',
    email: 'learner@example.test',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    createdAt: DateTime(2026),
  );

  int loginCallCount = 0;
  int meCallCount = 0;

  @override
  String? get accessToken => 'new-access-token';

  @override
  Future<User> login({required String email, required String password}) async {
    loginCallCount += 1;
    return _user;
  }

  @override
  Future<User> me() async {
    meCallCount += 1;
    return _user;
  }
}

class _ReloadableLearnerHomeApi extends LearnerHomeApi {
  _ReloadableLearnerHomeApi({this.failFirst = false}) : super(Dio());

  final bool failFirst;
  int fetchCount = 0;

  @override
  Future<LearnerHomeFeed> fetchHomeFeed() async {
    fetchCount += 1;
    if (failFirst && fetchCount == 1) {
      throw const ApiException(code: 'NETWORK_ERROR', message: 'unavailable');
    }

    return LearnerHomeFeed(
      profileCompletion: const LearnerHomeProfileCompletion(
        hasInterests: true,
        hasSavedLocation: true,
        hasSavedProjects: false,
        hasActivity: false,
      ),
      sections: const [],
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
