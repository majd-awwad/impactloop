import '../../../core/auth/access_token_holder.dart';
import '../../../core/auth/auth_session_refresh.dart';
import '../../../core/auth/token_storage.dart';
import 'auth_api.dart';
import 'models/auth_tokens.dart';
import 'models/become_learner_request.dart';
import 'models/become_supplier_request.dart';
import 'models/register_request.dart';
import 'models/user.dart';

class AuthRepository {
  AuthRepository({
    required AuthApi api,
    required TokenStorage tokenStorage,
    required AccessTokenHolder accessTokenHolder,
    required AuthSessionRefresher sessionRefresher,
  }) : _api = api,
       _tokenStorage = tokenStorage,
       _accessTokenHolder = accessTokenHolder,
       _sessionRefresher = sessionRefresher;

  final AuthApi _api;
  final TokenStorage _tokenStorage;
  final AccessTokenHolder _accessTokenHolder;
  final AuthSessionRefresher _sessionRefresher;

  String? get accessToken => _accessTokenHolder.accessToken;

  Future<User> register(RegisterRequest request) async {
    final result = await _api.register(request);
    await _persistSession(result.tokens, result.user);
    return result.user;
  }

  Future<User> login({required String email, required String password}) async {
    final result = await _api.login(email: email, password: password);
    await _persistSession(result.tokens, result.user);
    return result.user;
  }

  Future<User> establishSession({
    required AuthTokens tokens,
    required User user,
  }) async {
    await _persistSession(tokens, user);
    return user;
  }

  Future<User> restoreSession() async {
    try {
      await refresh();
      return await me();
    } catch (_) {
      await _sessionRefresher.clearSession();
      rethrow;
    }
  }

  Future<String> refresh() {
    return _sessionRefresher.refreshAccessToken();
  }

  Future<void> logout() async {
    final storedRefreshToken = await _tokenStorage.readRefreshToken();

    try {
      await _api.logout(refreshToken: storedRefreshToken);
    } finally {
      await _sessionRefresher.clearSession();
    }
  }

  Future<User> me() async {
    return _api.me();
  }

  Future<User> becomeSupplier(BecomeSupplierRequest request) async {
    final result = await _api.becomeSupplier(request);
    await _persistSession(result.tokens, result.user);
    return result.user;
  }

  Future<User> becomeLearner(BecomeLearnerRequest request) async {
    final result = await _api.becomeLearner(request);
    await _persistSession(result.tokens, result.user);
    return result.user;
  }

  Future<User> switchActiveRole(String activeRole) async {
    final result = await _api.switchRole(activeRole: activeRole);
    await _persistSession(result.tokens, result.user);
    return result.user;
  }

  Future<User> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmNewPassword,
  }) async {
    final result = await _api.changePassword(
      currentPassword: currentPassword,
      newPassword: newPassword,
      confirmNewPassword: confirmNewPassword,
    );
    await _persistSession(result.tokens, result.user);
    return result.user;
  }

  Future<void> forgotPassword({required String email}) {
    return _api.forgotPassword(email: email);
  }

  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) {
    return _api.resetPassword(token: token, newPassword: newPassword);
  }

  Future<void> _persistSession(AuthTokens tokens, User user) async {
    await _applyTokens(tokens);
  }

  Future<void> _applyTokens(AuthTokens tokens) async {
    _accessTokenHolder.accessToken = tokens.accessToken;

    if (tokens.refreshToken != null && tokens.refreshToken!.isNotEmpty) {
      await _tokenStorage.saveRefreshToken(tokens.refreshToken!);
    }
  }
}
