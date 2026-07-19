import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/api_config.dart';
import '../errors/api_exception.dart';
import '../network/api_response.dart';
import '../network/dio_platform_adapter.dart';
import 'access_token_holder.dart';
import 'token_storage.dart';

final tokenStorageProvider = Provider<TokenStorage>((ref) {
  return createTokenStorage();
});

final authSessionRefresherProvider = Provider<AuthSessionRefresher>((ref) {
  final refreshClient = Dio(
    BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 10),
      headers: const {
        'Accept': 'application/json',
        'X-Client-Platform': kIsWeb ? 'web' : 'mobile',
      },
    ),
  );

  configureDioPlatformAdapter(refreshClient);

  return AuthSessionRefresher(
    refreshClient: refreshClient,
    tokenStorage: ref.watch(tokenStorageProvider),
    accessTokenHolder: ref.watch(accessTokenHolderProvider),
  );
});

final authSessionExpiryProvider =
    NotifierProvider<AuthSessionExpiryNotifier, AuthSessionExpiryState?>(
  AuthSessionExpiryNotifier.new,
);

class AuthSessionExpiryState {
  const AuthSessionExpiryState({required this.generation, required this.error});

  final int generation;
  final ApiException error;
}

class AuthSessionExpiryNotifier extends Notifier<AuthSessionExpiryState?> {
  int _generation = 0;

  @override
  AuthSessionExpiryState? build() => null;

  void expire(ApiException error) {
    _generation += 1;
    state = AuthSessionExpiryState(generation: _generation, error: error);
  }

  void clear() {
    if (state != null) {
      state = null;
    }
  }
}

class AuthSessionRefresher {
  AuthSessionRefresher({
    required Dio refreshClient,
    required TokenStorage tokenStorage,
    required AccessTokenHolder accessTokenHolder,
  })  : _refreshClient = refreshClient,
        _tokenStorage = tokenStorage,
        _accessTokenHolder = accessTokenHolder;

  final Dio _refreshClient;
  final TokenStorage _tokenStorage;
  final AccessTokenHolder _accessTokenHolder;

  Future<String>? _refreshOperation;

  Future<String> refreshAccessToken() {
    return _refreshOperation ??= _refreshAccessTokenInternal().whenComplete(() {
      _refreshOperation = null;
    });
  }

  Future<void> clearSession() async {
    _accessTokenHolder.accessToken = null;
    await _tokenStorage.clearRefreshToken();
  }

  Future<String> _refreshAccessTokenInternal() async {
    final storedRefreshToken = await _tokenStorage.readRefreshToken();

    try {
      final response = await _refreshClient.post<Map<String, dynamic>>(
        '/api/auth/refresh',
        data: storedRefreshToken == null
            ? const <String, dynamic>{}
            : {'refreshToken': storedRefreshToken},
      );

      final body = response.data;
      if (body == null || body['success'] != true) {
        final errorBody = body?['error'];
        throw ApiException(
          message: body?['message'] as String? ?? 'Session refresh failed',
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

      final data = body['data'];
      if (data is! Map<String, dynamic>) {
        throw const ApiException(message: 'Unexpected refresh response');
      }

      final accessToken = data['accessToken'] as String?;
      if (accessToken == null || accessToken.isEmpty) {
        throw const ApiException(message: 'Refresh response missing token');
      }

      _accessTokenHolder.accessToken = accessToken;

      final refreshToken = data['refreshToken'] as String?;
      if (refreshToken != null && refreshToken.isNotEmpty) {
        await _tokenStorage.saveRefreshToken(refreshToken);
      }

      return accessToken;
    } on ApiException {
      rethrow;
    } on DioException catch (error) {
      throw mapDioException(error);
    }
  }
}
