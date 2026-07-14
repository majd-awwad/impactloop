import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/application/auth_providers.dart';
import 'package:frontend/features/auth/data/auth_api.dart';
import 'package:frontend/features/auth/data/auth_repository.dart';
import 'package:frontend/features/auth/data/models/auth_tokens.dart';
import 'package:frontend/features/auth/data/models/register_request.dart';
import 'package:frontend/features/auth/data/models/user.dart';

void main() {
  test('successful change-password replaces access token and mobile refresh storage', () async {
    final tokenStorage = _MemoryTokenStorage('old-refresh');
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'old-access';
    final api = _RecordingAuthApi(
      changePasswordResult: (
        tokens: const AuthTokens(
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        ),
        user: _testUser(),
      ),
    );
    final repository = AuthRepository(
      api: api,
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    final user = await repository.changePassword(
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    );

    expect(user.email, 'learner@example.com');
    expect(accessTokenHolder.accessToken, 'new-access');
    expect(await tokenStorage.readRefreshToken(), 'new-refresh');
    expect(api.changePasswordCalls, 1);
  });

  test('web change-password response without refresh token leaves mobile storage unchanged when absent', () async {
    final tokenStorage = _MemoryTokenStorage('old-refresh');
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'old-access';
    final api = _RecordingAuthApi(
      changePasswordResult: (
        tokens: const AuthTokens(accessToken: 'new-access'),
        user: _testUser(),
      ),
    );
    final repository = AuthRepository(
      api: api,
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    await repository.changePassword(
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    );

    expect(accessTokenHolder.accessToken, 'new-access');
    expect(await tokenStorage.readRefreshToken(), 'old-refresh');
  });

  test('auth controller keeps user authenticated after successful change-password', () async {
    final tokenStorage = _MemoryTokenStorage('old-refresh');
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'old-access';
    final api = _RecordingAuthApi(
      changePasswordResult: (
        tokens: const AuthTokens(
          accessToken: 'new-access',
          refreshToken: 'new-refresh',
        ),
        user: _testUser(),
      ),
    );
    final repository = AuthRepository(
      api: api,
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    final container = ProviderContainer(
      overrides: [authRepositoryProvider.overrideWithValue(repository)],
    );
    addTearDown(container.dispose);

    final user = await container
        .read(authControllerProvider.notifier)
        .changePassword(
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
          confirmNewPassword: 'NewPassword123!',
        );

    final state = container.read(authControllerProvider);
    expect(user.email, 'learner@example.com');
    expect(state.isAuthenticated, isTrue);
    expect(state.accessToken, 'new-access');
    expect(state.user?.email, 'learner@example.com');
  });

  test('failed change-password leaves existing session unchanged', () async {
    final tokenStorage = _MemoryTokenStorage('old-refresh');
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'old-access';
    final api = _RecordingAuthApi(
      changePasswordError: const ApiException(
        message: 'Current password is incorrect.',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
      ),
    );
    final repository = AuthRepository(
      api: api,
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    await expectLater(
      repository.changePassword(
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword123!',
        confirmNewPassword: 'NewPassword123!',
      ),
      throwsA(isA<ApiException>()),
    );

    expect(accessTokenHolder.accessToken, 'old-access');
    expect(await tokenStorage.readRefreshToken(), 'old-refresh');
    expect(api.changePasswordCalls, 1);
  });

  test('profile and supplier flows share repository session replacement', () async {
    final tokenStorage = _MemoryTokenStorage('shared-refresh');
    final accessTokenHolder = AccessTokenHolder()..accessToken = 'shared-access';
    final api = _RecordingAuthApi(
      changePasswordResult: (
        tokens: const AuthTokens(
          accessToken: 'shared-new-access',
          refreshToken: 'shared-new-refresh',
        ),
        user: _testUser(),
      ),
    );
    final repository = AuthRepository(
      api: api,
      tokenStorage: tokenStorage,
      accessTokenHolder: accessTokenHolder,
    );

    await repository.changePassword(
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword123!',
      confirmNewPassword: 'NewPassword123!',
    );
    expect(accessTokenHolder.accessToken, 'shared-new-access');

    accessTokenHolder.accessToken = 'shared-access';
    await tokenStorage.saveRefreshToken('shared-refresh');

    await repository.changePassword(
      currentPassword: 'OldPassword123!',
      newPassword: 'AnotherPassword123!',
      confirmNewPassword: 'AnotherPassword123!',
    );

    expect(api.changePasswordCalls, 2);
    expect(accessTokenHolder.accessToken, 'shared-new-access');
    expect(await tokenStorage.readRefreshToken(), 'shared-new-refresh');
  });
}

User _testUser() {
  return User(
    id: 'user-1',
    displayName: 'Learner User',
    email: 'learner@example.com',
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
  _RecordingAuthApi({
    this.changePasswordResult,
    this.changePasswordError,
  }) : super(Dio());

  final ({AuthTokens tokens, User user})? changePasswordResult;
  final ApiException? changePasswordError;
  int changePasswordCalls = 0;

  @override
  Future<({AuthTokens tokens, User user})> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmNewPassword,
  }) async {
    changePasswordCalls += 1;
    if (changePasswordError != null) {
      throw changePasswordError!;
    }
    return changePasswordResult!;
  }

  @override
  Future<({AuthTokens tokens, User user})> register(RegisterRequest request) {
    throw UnimplementedError();
  }

  @override
  Future<({AuthTokens tokens, User user})> login({
    required String email,
    required String password,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<AuthTokens> refresh({String? refreshToken}) {
    throw UnimplementedError();
  }

  @override
  Future<void> logout({String? refreshToken}) {
    throw UnimplementedError();
  }

  @override
  Future<User> me() {
    throw UnimplementedError();
  }
}
