import '../../../core/auth/access_token_holder.dart';
import '../../../core/auth/token_storage.dart';
import 'auth_api.dart';
import 'models/auth_tokens.dart';
import 'models/register_request.dart';
import 'models/user.dart';

class AuthRepository {
  AuthRepository({
    required AuthApi api,
    required TokenStorage tokenStorage,
    required AccessTokenHolder accessTokenHolder,
  }) : _api = api,
       _tokenStorage = tokenStorage,
       _accessTokenHolder = accessTokenHolder;

  final AuthApi _api;
  final TokenStorage _tokenStorage;
  final AccessTokenHolder _accessTokenHolder;

  String? get accessToken => _accessTokenHolder.accessToken;

  Future<User> register(RegisterRequest request) async {
    final result = await _api.register(request);
    await _persistSession(result.tokens, result.user);
    return result.user;
  }

  Future<User> login({
    required String email,
    required String password,
  }) async {
    final result = await _api.login(email: email, password: password);
    await _persistSession(result.tokens, result.user);
    return result.user;
  }

  Future<String> refresh() async {
    final storedRefreshToken = await _tokenStorage.readRefreshToken();
    final tokens = await _api.refresh(refreshToken: storedRefreshToken);

    _accessTokenHolder.accessToken = tokens.accessToken;

    if (tokens.refreshToken != null && tokens.refreshToken!.isNotEmpty) {
      await _tokenStorage.saveRefreshToken(tokens.refreshToken!);
    }

    return tokens.accessToken;
  }

  Future<void> logout() async {
    final storedRefreshToken = await _tokenStorage.readRefreshToken();

    try {
      await _api.logout(refreshToken: storedRefreshToken);
    } finally {
      await _clearSession();
    }
  }

  Future<User> me() async {
    return _api.me();
  }

  Future<void> _persistSession(AuthTokens tokens, User user) async {
    _accessTokenHolder.accessToken = tokens.accessToken;

    if (tokens.refreshToken != null && tokens.refreshToken!.isNotEmpty) {
      await _tokenStorage.saveRefreshToken(tokens.refreshToken!);
    }
  }

  Future<void> _clearSession() async {
    _accessTokenHolder.accessToken = null;
    await _tokenStorage.clearRefreshToken();
  }
}
