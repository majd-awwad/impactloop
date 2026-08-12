import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_session_refresh.dart';
import '../../../core/errors/api_exception.dart';
import '../../supplier_portal/application/supplier_portal_refresh.dart';
import '../../home/application/home_suggested_materials_provider.dart';
import '../../home/application/learner_home_provider.dart';
import '../../locations/application/saved_locations_providers.dart';
import '../../project_help_sessions/application/project_help_session_auth_cleanup.dart';
import '../data/auth_repository.dart';
import '../data/models/auth_tokens.dart';
import '../data/models/become_learner_request.dart';
import '../data/models/become_supplier_request.dart';
import '../data/models/register_request.dart';
import '../data/models/user.dart';
import 'auth_providers.dart';

enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState {
  const AuthState({
    this.user,
    this.accessToken,
    this.isLoading = false,
    this.hasBootstrapped = false,
    this.error,
  });

  final User? user;
  final String? accessToken;
  final bool isLoading;
  final bool hasBootstrapped;
  final ApiException? error;

  bool get isAuthenticated =>
      accessToken != null && accessToken!.isNotEmpty && user != null;

  AuthStatus get status {
    if (!hasBootstrapped) {
      return AuthStatus.unknown;
    }

    return isAuthenticated
        ? AuthStatus.authenticated
        : AuthStatus.unauthenticated;
  }

  AuthState copyWith({
    User? user,
    String? accessToken,
    bool? isLoading,
    bool? hasBootstrapped,
    ApiException? error,
    bool clearError = false,
    bool clearUser = false,
  }) {
    return AuthState(
      user: clearUser ? null : user ?? this.user,
      accessToken: accessToken ?? this.accessToken,
      isLoading: isLoading ?? this.isLoading,
      hasBootstrapped: hasBootstrapped ?? this.hasBootstrapped,
      error: clearError ? null : error ?? this.error,
    );
  }
}

class AuthController extends Notifier<AuthState> {
  Future<void>? _bootstrapOperation;

  @override
  AuthState build() {
    ref.listen<AuthSessionExpiryState?>(authSessionExpiryProvider, (
      previous,
      next,
    ) {
      if (next == null || previous?.generation == next.generation) {
        return;
      }

      state = AuthState(
        isLoading: false,
        hasBootstrapped: true,
        error: next.error,
      );
      _invalidateProjectHelpSessionProvidersSafely();
    });

    return const AuthState();
  }

  AuthRepository get _repository => ref.read(authRepositoryProvider);

  void _invalidateSupplierPortalProvidersSafely() {
    try {
      invalidateSupplierPortalProviders(ref);
    } catch (_) {
      // Provider refresh should never turn a successful auth action into a
      // user-visible failure. The next supplier page load can fetch fresh data.
    }
  }

  void _invalidateProjectHelpSessionProvidersSafely() {
    try {
      invalidateProjectHelpSessionAuthScopedState(ref);
    } catch (_) {
      // Private PHS state must be dropped at the auth boundary. A later route
      // load will fetch from the server if no provider instance exists yet.
    }
  }

  void _resetAuthenticatedProvidersSafely() {
    try {
      ref.read(authSessionExpiryProvider.notifier).clear();
      invalidateLearnerHomeProviders(ref);
      ref.invalidate(savedLocationsProvider);
      ref.invalidate(homeSuggestedMaterialsProvider);
      invalidateSupplierPortalProviders(ref);
    } catch (_) {
      // A provider reset must never turn a successful login into a failure.
    }
    _invalidateProjectHelpSessionProvidersSafely();
  }

  Future<void> bootstrapSession() {
    return _bootstrapOperation ??= _bootstrapSessionInternal();
  }

  void clearError() {
    if (state.error != null) {
      state = state.copyWith(clearError: true);
    }
  }

  Future<void> _bootstrapSessionInternal() async {
    if (state.isAuthenticated) {
      state = state.copyWith(isLoading: false, hasBootstrapped: true);
      return;
    }

    state = state.copyWith(
      isLoading: true,
      hasBootstrapped: false,
      clearError: true,
    );

    try {
      final user = await _repository.restoreSession();

      state = AuthState(
        user: user,
        accessToken: _repository.accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );
      _resetAuthenticatedProvidersSafely();
    } catch (_) {
      state = const AuthState(isLoading: false, hasBootstrapped: true);
    }
  }

  Future<User> register(RegisterRequest request) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final user = await _repository.register(request);

      state = AuthState(
        user: user,
        accessToken: _repository.accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );
      _resetAuthenticatedProvidersSafely();

      return user;
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error);
      rethrow;
    } catch (error) {
      final apiError = normalizeApiException(error);
      state = state.copyWith(isLoading: false, error: apiError);
      throw apiError;
    }
  }

  Future<User> login({required String email, required String password}) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      await _repository.login(email: email, password: password);
      final freshUser = await _repository.me();

      state = AuthState(
        user: freshUser,
        accessToken: _repository.accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );
      _resetAuthenticatedProvidersSafely();

      return freshUser;
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error);
      rethrow;
    } catch (error) {
      final apiError = normalizeApiException(error);
      state = state.copyWith(isLoading: false, error: apiError);
      throw apiError;
    }
  }

  Future<User> establishAuthenticatedSession({
    required AuthTokens tokens,
    required User user,
  }) async {
    final establishedUser = await _repository.establishSession(
      tokens: tokens,
      user: user,
    );

    state = AuthState(
      user: establishedUser,
      accessToken: _repository.accessToken,
      isLoading: false,
      hasBootstrapped: true,
    );
    _resetAuthenticatedProvidersSafely();

    return establishedUser;
  }

  Future<void> refreshCurrentUser() async {
    final user = await _repository.me();
    final identityChanged = state.user?.id != user.id;
    state = state.copyWith(user: user);
    if (identityChanged) {
      _invalidateProjectHelpSessionProvidersSafely();
    }
  }

  void syncAuthenticatedUser(User user) {
    final identityChanged = state.user?.id != user.id;
    state = AuthState(
      user: user,
      accessToken: _repository.accessToken,
      isLoading: false,
      hasBootstrapped: true,
    );
    if (identityChanged) {
      _resetAuthenticatedProvidersSafely();
    }
  }

  Future<String> refresh() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final accessToken = await _repository.refresh();

      state = state.copyWith(
        accessToken: accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );

      return accessToken;
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error);
      rethrow;
    } catch (error) {
      final apiError = normalizeApiException(error);
      state = state.copyWith(isLoading: false, error: apiError);
      throw apiError;
    }
  }

  Future<ApiException?> logout() async {
    state = state.copyWith(isLoading: true, clearError: true);

    ApiException? logoutError;
    try {
      await _repository.logout();
    } on ApiException catch (error) {
      logoutError = error;
    } catch (error) {
      logoutError = normalizeApiException(error);
    }
    state = AuthState(
      isLoading: false,
      hasBootstrapped: true,
      error: logoutError,
    );
    _resetAuthenticatedProvidersSafely();
    return logoutError;
  }

  Future<User> loadMe() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final user = await _repository.me();
      final identityChanged = state.user?.id != user.id;

      state = state.copyWith(
        user: user,
        accessToken: _repository.accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );
      if (identityChanged) {
        _invalidateProjectHelpSessionProvidersSafely();
      }

      return user;
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error);
      rethrow;
    } catch (error) {
      final apiError = normalizeApiException(error);
      state = state.copyWith(isLoading: false, error: apiError);
      throw apiError;
    }
  }

  Future<User> becomeSupplier(BecomeSupplierRequest request) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final freshUser = await _repository.becomeSupplier(request);
      state = AuthState(
        user: freshUser,
        accessToken: _repository.accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );
      _invalidateSupplierPortalProvidersSafely();
      return freshUser;
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error);
      rethrow;
    } catch (error) {
      final apiError = normalizeApiException(error);
      state = state.copyWith(isLoading: false, error: apiError);
      throw apiError;
    }
  }

  Future<User> becomeLearner(BecomeLearnerRequest request) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final freshUser = await _repository.becomeLearner(request);
      state = AuthState(
        user: freshUser,
        accessToken: _repository.accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );
      _invalidateSupplierPortalProvidersSafely();
      return freshUser;
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error);
      rethrow;
    } catch (error) {
      final apiError = normalizeApiException(error);
      state = state.copyWith(isLoading: false, error: apiError);
      throw apiError;
    }
  }

  Future<User> switchActiveRole(String activeRole) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final freshUser = await _repository.switchActiveRole(activeRole);
      state = AuthState(
        user: freshUser,
        accessToken: _repository.accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );
      _invalidateSupplierPortalProvidersSafely();
      return freshUser;
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error);
      rethrow;
    } catch (error) {
      final apiError = normalizeApiException(error);
      state = state.copyWith(isLoading: false, error: apiError);
      throw apiError;
    }
  }

  Future<User> changePassword({
    required String currentPassword,
    required String newPassword,
    required String confirmNewPassword,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final freshUser = await _repository.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
        confirmNewPassword: confirmNewPassword,
      );

      state = AuthState(
        user: freshUser,
        accessToken: _repository.accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );

      return freshUser;
    } on ApiException catch (error) {
      state = state.copyWith(isLoading: false, error: error);
      rethrow;
    } catch (error) {
      final apiError = normalizeApiException(error);
      state = state.copyWith(isLoading: false, error: apiError);
      throw apiError;
    }
  }
}

final authControllerProvider = NotifierProvider<AuthController, AuthState>(
  AuthController.new,
);
