import 'package:dio/dio.dart';

import '../../../core/auth/auth_interceptor.dart';
import '../../../core/network/api_response.dart';
import 'models/auth_tokens.dart';
import 'models/become_learner_request.dart';
import 'models/become_supplier_request.dart';
import 'models/register_request.dart';
import 'models/user.dart';

class AuthApi {
  const AuthApi(this._client);

  final Dio _client;

  static const _authBasePath = '/api/auth';

  Future<({AuthTokens tokens, User user})> register(RegisterRequest request) {
    return _postAuthSession('$_authBasePath/register', data: request.toJson());
  }

  Future<({AuthTokens tokens, User user})> login({
    required String email,
    required String password,
  }) {
    return _postAuthSession(
      '$_authBasePath/login',
      data: {'email': email.trim(), 'password': password},
    );
  }

  Future<AuthTokens> refresh({String? refreshToken}) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(
        '$_authBasePath/refresh',
        data: refreshToken == null
            ? const <String, dynamic>{}
            : {'refreshToken': refreshToken},
        options: Options(
          extra: const {AuthInterceptor.skipAuthRefreshExtraKey: true},
        ),
      ),
      AuthTokens.fromJson,
    );
  }

  Future<void> logout({String? refreshToken}) {
    return unwrapApiVoidResponse(
      _client.post<Map<String, dynamic>>(
        '$_authBasePath/logout',
        data: refreshToken == null
            ? const <String, dynamic>{}
            : {'refreshToken': refreshToken},
      ),
    );
  }

  Future<User> me() {
    return unwrapApiResponse(
      _client.get<Map<String, dynamic>>(
        '$_authBasePath/me',
        options: Options(
          headers: const {'Cache-Control': 'no-cache'},
        ),
      ),
      (json) => User.fromJson(json['user'] as Map<String, dynamic>),
    );
  }

  Future<({AuthTokens tokens, User user})> becomeSupplier(
    BecomeSupplierRequest request,
  ) {
    return _postAuthSession(
      '$_authBasePath/become-supplier',
      data: request.toJson(),
    );
  }

  Future<({AuthTokens tokens, User user})> becomeLearner(
    BecomeLearnerRequest request,
  ) {
    return _postAuthSession(
      '$_authBasePath/become-learner',
      data: request.toJson(),
    );
  }

  Future<({AuthTokens tokens, User user})> switchRole({
    required String activeRole,
  }) {
    return _postAuthSession(
      '$_authBasePath/switch-role',
      data: {'activeRole': activeRole.trim().toUpperCase()},
    );
  }

  Future<({AuthTokens tokens, User user})> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmNewPassword,
  }) {
    return unwrapApiResponse(
      _client.patch<Map<String, dynamic>>(
        '$_authBasePath/change-password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
          'confirmNewPassword': confirmNewPassword,
        },
      ),
      (json) {
        final userJson = json['user'];

        if (userJson is! Map<String, dynamic>) {
          throw const FormatException('Missing user in auth response');
        }

        return (
          tokens: AuthTokens.fromJson(json),
          user: User.fromJson(userJson),
        );
      },
    );
  }

  Future<void> forgotPassword({required String email}) {
    return unwrapApiVoidResponse(
      _client.post<Map<String, dynamic>>(
        '$_authBasePath/forgot-password',
        data: {'email': email.trim()},
        options: Options(
          extra: const {AuthInterceptor.skipAuthRefreshExtraKey: true},
        ),
      ),
    );
  }

  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) {
    return unwrapApiVoidResponse(
      _client.post<Map<String, dynamic>>(
        '$_authBasePath/reset-password',
        data: {'token': token, 'newPassword': newPassword},
        options: Options(
          extra: const {AuthInterceptor.skipAuthRefreshExtraKey: true},
        ),
      ),
    );
  }

  Future<({AuthTokens tokens, User user})> _postAuthSession(
    String path, {
    required Map<String, dynamic> data,
  }) {
    return unwrapApiResponse(
      _client.post<Map<String, dynamic>>(path, data: data),
      (json) {
        final userJson = json['user'];

        if (userJson is! Map<String, dynamic>) {
          throw const FormatException('Missing user in auth response');
        }

        return (
          tokens: AuthTokens.fromJson(json),
          user: User.fromJson(userJson),
        );
      },
    );
  }
}
