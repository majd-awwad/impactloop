import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/features/auth/application/auth_providers.dart';
import 'package:frontend/features/auth/application/auth_route_helpers.dart';
import 'package:frontend/features/auth/data/auth_api.dart';
import 'package:frontend/features/auth/data/auth_repository.dart';
import 'package:frontend/features/auth/data/models/auth_tokens.dart';
import 'package:frontend/features/auth/data/models/register_request.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/auth/presentation/widgets/forgot_password_form.dart';
import 'package:frontend/features/auth/presentation/widgets/login_form.dart';
import 'package:frontend/features/auth/presentation/widgets/reset_password_form.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('login forgot password link navigates with email prefill', (
    tester,
  ) async {
    final router = GoRouter(
      initialLocation: loginRoute,
      routes: [
        GoRoute(
          path: loginRoute,
          builder: (context, state) =>
              const Scaffold(body: SingleChildScrollView(child: LoginForm())),
        ),
        GoRoute(
          path: forgotPasswordRoute,
          builder: (context, state) =>
              const Scaffold(body: Text('Forgot route')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(child: MaterialApp.router(routerConfig: router)),
    );

    await tester.enterText(
      find.byType(TextFormField).first,
      'learner@example.com',
    );
    await tester.tap(find.text('Forgot password?'));
    await tester.pumpAndSettle();

    final uri = router.routeInformationProvider.value.uri;
    expect(uri.path, forgotPasswordRoute);
    expect(uri.queryParameters['email'], 'learner@example.com');
  });

  testWidgets('forgot password pre-fills email and shows generic success', (
    tester,
  ) async {
    final api = _RecordingAuthApi();
    final repository = _repositoryFor(api);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
        child: const MaterialApp(
          home: Scaffold(
            body: ForgotPasswordForm(initialEmail: 'learner@example.com'),
          ),
        ),
      ),
    );

    expect(find.text('learner@example.com'), findsOneWidget);

    await tester.tap(find.text('Send reset instructions'));
    await tester.pumpAndSettle();

    expect(api.forgotPasswordEmails, ['learner@example.com']);
    expect(find.text(forgotPasswordGenericSuccessMessage), findsOneWidget);
  });

  testWidgets('reset password shows clean error when token is missing', (
    tester,
  ) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: Scaffold(body: ResetPasswordForm(token: null)),
        ),
      ),
    );

    expect(find.text('Reset link is missing or invalid.'), findsOneWidget);
  });

  testWidgets('reset password blocks mismatched confirmation', (tester) async {
    final api = _RecordingAuthApi();
    final repository = _repositoryFor(api);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
        child: const MaterialApp(
          home: Scaffold(body: ResetPasswordForm(token: 'reset-token')),
        ),
      ),
    );

    await tester.enterText(find.byType(TextFormField).at(0), 'Password123!');
    await tester.enterText(find.byType(TextFormField).at(1), 'Different123!');
    await tester.tap(find.text('Reset password'));
    await tester.pumpAndSettle();

    expect(find.text('Passwords do not match'), findsOneWidget);
    expect(api.resetPasswordCalls, isEmpty);
  });

  testWidgets('reset password submits payload and links to login on success', (
    tester,
  ) async {
    final api = _RecordingAuthApi();
    final repository = _repositoryFor(api);
    final router = GoRouter(
      initialLocation: resetPasswordRoute,
      routes: [
        GoRoute(
          path: resetPasswordRoute,
          builder: (context, state) =>
              const Scaffold(body: ResetPasswordForm(token: 'reset-token')),
        ),
        GoRoute(
          path: loginRoute,
          builder: (context, state) => const Scaffold(body: Text('Login')),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [authRepositoryProvider.overrideWithValue(repository)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );

    await tester.enterText(find.byType(TextFormField).at(0), 'Password123!');
    await tester.enterText(find.byType(TextFormField).at(1), 'Password123!');
    await tester.tap(find.text('Reset password'));
    await tester.pumpAndSettle();

    expect(api.resetPasswordCalls, [
      (token: 'reset-token', newPassword: 'Password123!'),
    ]);
    expect(
      find.text(
        'Your password has been updated. Sign in with your new password.',
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('Go to sign in'));
    await tester.pumpAndSettle();

    expect(router.routeInformationProvider.value.uri.path, loginRoute);
  });

  test(
    'forgot and reset repository methods do not mutate local auth storage',
    () async {
      final api = _RecordingAuthApi();
      final tokenStorage = _FakeTokenStorage(
        initialRefreshToken: 'refresh-token',
      );
      final accessTokenHolder = AccessTokenHolder()
        ..accessToken = 'access-token';
      final repository = AuthRepository(
        api: api,
        tokenStorage: tokenStorage,
        accessTokenHolder: accessTokenHolder,
      );

      await repository.forgotPassword(email: 'learner@example.com');
      await repository.resetPassword(
        token: 'reset-token',
        newPassword: 'Password123!',
      );

      expect(accessTokenHolder.accessToken, 'access-token');
      expect(await tokenStorage.readRefreshToken(), 'refresh-token');
    },
  );
}

AuthRepository _repositoryFor(_RecordingAuthApi api) {
  return AuthRepository(
    api: api,
    tokenStorage: _FakeTokenStorage(),
    accessTokenHolder: AccessTokenHolder(),
  );
}

class _RecordingAuthApi extends AuthApi {
  _RecordingAuthApi() : super(Dio());

  final forgotPasswordEmails = <String>[];
  final resetPasswordCalls = <({String token, String newPassword})>[];

  @override
  Future<void> forgotPassword({required String email}) async {
    forgotPasswordEmails.add(email);
  }

  @override
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    resetPasswordCalls.add((token: token, newPassword: newPassword));
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

class _FakeTokenStorage implements TokenStorage {
  _FakeTokenStorage({this.initialRefreshToken});

  String? initialRefreshToken;

  @override
  Future<void> clearRefreshToken() async {
    initialRefreshToken = null;
  }

  @override
  Future<String?> readRefreshToken() async => initialRefreshToken;

  @override
  Future<void> saveRefreshToken(String refreshToken) async {
    initialRefreshToken = refreshToken;
  }
}
