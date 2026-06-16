import 'package:dio/dio.dart';

import '../../../core/network/api_response.dart';
import 'models/auth_tokens.dart';
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
      _client.get<Map<String, dynamic>>('$_authBasePath/me'),
      (json) => User.fromJson(json['user'] as Map<String, dynamic>),
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
