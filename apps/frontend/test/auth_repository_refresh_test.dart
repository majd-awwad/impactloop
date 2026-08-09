import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/auth_session_refresh.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/data/auth_api.dart';
import 'package:frontend/features/auth/data/auth_repository.dart';
import 'package:frontend/features/auth/data/models/user.dart';

void main() {
  test(
    'repository refresh delegates to AuthSessionRefresher single-flight path',
    () async {
      final tokenStorage = _MemoryTokenStorage('stored-refresh');
      final accessTokenHolder = AccessTokenHolder()..accessToken = 'old-access';
      final refreshAdapter = _RefreshAdapter(
        delay: const Duration(milliseconds: 30),
      );
      final sessionRefresher = AuthSessionRefresher(
        refreshClient: Dio()..httpClientAdapter = refreshAdapter,
        tokenStorage: tokenStorage,
        accessTokenHolder: accessTokenHolder,
      );
      final repository = AuthRepository(
        api: AuthApi(Dio()),
        tokenStorage: tokenStorage,
        accessTokenHolder: accessTokenHolder,
        sessionRefresher: sessionRefresher,
      );

      final tokens = await Future.wait([
        repository.refresh(),
        sessionRefresher.refreshAccessToken(),
      ]);

      expect(tokens, ['refreshed-access', 'refreshed-access']);
      expect(refreshAdapter.refreshCallCount, 1);
      expect(accessTokenHolder.accessToken, 'refreshed-access');
      expect(await tokenStorage.readRefreshToken(), 'rotated-refresh');
    },
  );

  test(
    'restoreSession persists rotated refresh token then loads current user',
    () async {
      final tokenStorage = _MemoryTokenStorage('stored-refresh');
      final accessTokenHolder = AccessTokenHolder();
      final sessionRefresher = AuthSessionRefresher(
        refreshClient: Dio()..httpClientAdapter = _RefreshAdapter(),
        tokenStorage: tokenStorage,
        accessTokenHolder: accessTokenHolder,
      );
      final api = _RecordingAuthApi(meResult: _testUser());
      final repository = AuthRepository(
        api: api,
        tokenStorage: tokenStorage,
        accessTokenHolder: accessTokenHolder,
        sessionRefresher: sessionRefresher,
      );

      final user = await repository.restoreSession();

      expect(user.email, 'learner@example.test');
      expect(accessTokenHolder.accessToken, 'refreshed-access');
      expect(await tokenStorage.readRefreshToken(), 'rotated-refresh');
      expect(api.meCallCount, 1);
    },
  );

  test('restoreSession clears local session when refresh fails', () async {
    final tokenStorage = _MemoryTokenStorage('stale-refresh');
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'stale-access';
    final sessionRefresher = AuthSessionRefresher(
      refreshClient: Dio()
        ..httpClientAdapter = _RefreshAdapter(shouldFail: true),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );
    final repository = AuthRepository(
      api: _RecordingAuthApi(meResult: _testUser()),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
      sessionRefresher: sessionRefresher,
    );

    await expectLater(
      repository.restoreSession(),
      throwsA(isA<ApiException>()),
    );

    expect(accessTokenHolder.accessToken, isNull);
    expect(await tokenStorage.readRefreshToken(), isNull);
  });

  test('logout clears session through AuthSessionRefresher', () async {
    final tokenStorage = _MemoryTokenStorage('refresh-token');
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'access-token';
    final sessionRefresher = AuthSessionRefresher(
      refreshClient: Dio(),
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );
    final api = _RecordingAuthApi(meResult: _testUser());
    final repository = AuthRepository(
      api: api,
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
      sessionRefresher: sessionRefresher,
    );

    await repository.logout();

    expect(api.logoutRefreshToken, 'refresh-token');
    expect(accessTokenHolder.accessToken, isNull);
    expect(await tokenStorage.readRefreshToken(), isNull);
  });
}

User _testUser() {
  return User(
    id: 'learner-1',
    displayName: 'Learner',
    email: 'learner@example.test',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    createdAt: DateTime(2026),
  );
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

class _RecordingAuthApi extends AuthApi {
  _RecordingAuthApi({required this.meResult}) : super(Dio());

  final User meResult;
  int meCallCount = 0;
  String? logoutRefreshToken;

  @override
  Future<User> me() async {
    meCallCount += 1;
    return meResult;
  }

  @override
  Future<void> logout({String? refreshToken}) async {
    logoutRefreshToken = refreshToken;
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
      return ResponseBody.fromString(
        jsonEncode({'success': false, 'message': 'Refresh failed'}),
        401,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    }

    return ResponseBody.fromString(
      jsonEncode({
        'success': true,
        'data': {
          'accessToken': 'refreshed-access',
          'refreshToken': 'rotated-refresh',
        },
      }),
      200,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }
}
