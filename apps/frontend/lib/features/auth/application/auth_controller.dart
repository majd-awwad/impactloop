import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_session_refresh.dart';
import '../../../core/errors/api_exception.dart';
import '../../supplier_portal/application/supplier_portal_refresh.dart';
import '../data/auth_repository.dart';
import '../data/models/auth_tokens.dart';
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
    });

    return const AuthState();
  }

  AuthRepository get _repository => ref.read(authRepositoryProvider);

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
      invalidateSupplierPortalProviders(ref);

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

    return establishedUser;
  }

  Future<void> refreshCurrentUser() async {
    final user = await _repository.me();
    state = state.copyWith(user: user);
  }

  void syncAuthenticatedUser(User user) {
    state = AuthState(
      user: user,
      accessToken: _repository.accessToken,
      isLoading: false,
      hasBootstrapped: true,
    );
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

    try {
      await _repository.logout();
      invalidateSupplierPortalProviders(ref);
      state = const AuthState(isLoading: false, hasBootstrapped: true);
      return null;
    } on ApiException catch (error) {
      state = AuthState(isLoading: false, hasBootstrapped: true, error: error);
      return error;
    } catch (error) {
      final apiError = normalizeApiException(error);
      state = AuthState(
        isLoading: false,
        hasBootstrapped: true,
        error: apiError,
      );
      return apiError;
    }
  }

  Future<User> loadMe() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final user = await _repository.me();

      state = state.copyWith(
        user: user,
        accessToken: _repository.accessToken,
        isLoading: false,
        hasBootstrapped: true,
      );

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
      invalidateSupplierPortalProviders(ref);
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
      invalidateSupplierPortalProviders(ref);
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
