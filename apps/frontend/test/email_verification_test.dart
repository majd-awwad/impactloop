import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/auth/access_token_holder.dart';
import 'package:frontend/core/auth/auth_session_refresh.dart';
import 'package:frontend/core/auth/token_storage.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/application/auth_providers.dart';
import 'package:frontend/features/auth/data/auth_api.dart';
import 'package:frontend/features/auth/data/auth_repository.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/auth/presentation/views/verify_email_view.dart';
import 'package:frontend/features/profile/presentation/widgets/learner_profile_hub_widgets.dart';
import 'package:frontend/features/reservations/presentation/reservation_create_error_message.dart';
import 'package:frontend/l10n/app_localizations.dart';

class _FakeAuthApi extends AuthApi {
  _FakeAuthApi({this.confirmError}) : super(Dio());

  final Object? confirmError;
  var confirmCount = 0;

  @override
  Future<void> confirmEmailVerification({required String token}) async {
    confirmCount += 1;
    if (confirmError != null) {
      throw confirmError!;
    }
  }
}

class _NoopTokenStorage implements TokenStorage {
  @override
  Future<void> clearRefreshToken() async {}

  @override
  Future<String?> readRefreshToken() async => null;

  @override
  Future<void> saveRefreshToken(String refreshToken) async {}
}

class _NoopSessionRefresher implements AuthSessionRefresher {
  @override
  Future<void> clearSession() async {}

  @override
  Future<String> refreshAccessToken() async => '';
}

AuthRepository _repository(_FakeAuthApi api) {
  return AuthRepository(
    api: api,
    tokenStorage: _NoopTokenStorage(),
    accessTokenHolder: AccessTokenHolder(),
    sessionRefresher: _NoopSessionRefresher(),
  );
}

class _TestAuthController extends AuthController {
  _TestAuthController(this.user);

  final User user;

  @override
  AuthState build() {
    return AuthState(
      user: user,
      accessToken: 'token',
      hasBootstrapped: true,
    );
  }

  @override
  Future<void> refreshCurrentUser() async {}
}

Future<void> _pumpVerifyView(
  WidgetTester tester, {
  required String? token,
  required AuthRepository repository,
  AuthController? controller,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authRepositoryProvider.overrideWithValue(repository),
        if (controller != null)
          authControllerProvider.overrideWith(() => controller),
      ],
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: VerifyEmailView(token: token),
      ),
    ),
  );
  await tester.pump();
  await tester.pumpAndSettle();
}

void main() {
  test('verification notice only appears when verification is required', () {
    expect(
      resolveAccountVerificationNotice(
        User(
          id: '1',
          displayName: 'Learner',
          email: 'learner@example.com',
          accountStatus: 'ACTIVE',
          roles: const ['LEARNER'],
          emailVerificationRequired: true,
          createdAt: DateTime.utc(2026),
        ),
      )?.kind,
      AccountVerificationNoticeKind.emailUnverified,
    );

    expect(
      resolveAccountVerificationNotice(
        User(
          id: '1',
          displayName: 'Learner',
          email: 'learner@example.com',
          accountStatus: 'ACTIVE',
          roles: const ['LEARNER'],
          emailVerificationRequired: false,
          phone: '+970599000000',
          phoneVerifiedAt: DateTime.utc(2026),
          createdAt: DateTime.utc(2026),
        ),
      ),
      isNull,
    );
  });

  test('reservation create maps EMAIL_VERIFICATION_REQUIRED', () {
    const error = ApiException(
      message: 'blocked',
      code: 'EMAIL_VERIFICATION_REQUIRED',
      statusCode: 403,
    );

    expect(
      reservationCreateErrorMessage(error),
      contains('verify your email'),
    );
  });

  testWidgets('verify email view confirms token and shows success', (
    tester,
  ) async {
    final api = _FakeAuthApi();
    final repository = _repository(api);

    await _pumpVerifyView(
      tester,
      token: 'valid-token',
      repository: repository,
      controller: _TestAuthController(
        User(
          id: '1',
          displayName: 'Learner',
          email: 'learner@example.com',
          accountStatus: 'ACTIVE',
          roles: const ['LEARNER'],
          emailVerifiedAt: DateTime.utc(2026),
          emailVerificationRequired: true,
          createdAt: DateTime.utc(2026),
        ),
      ),
    );

    expect(api.confirmCount, 1);
    expect(find.text('Email verified'), findsOneWidget);
    expect(
      find.text(
        'Your account is verified and all ImpactLoop features are now available.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('verify email view shows expired token state', (tester) async {
    final api = _FakeAuthApi(
      confirmError: const ApiException(
        message: 'expired',
        code: 'EMAIL_VERIFICATION_TOKEN_EXPIRED',
        statusCode: 400,
      ),
    );

    await _pumpVerifyView(
      tester,
      token: 'expired-token',
      repository: _repository(api),
    );

    expect(find.text('This verification link has expired.'), findsOneWidget);
  });

  testWidgets('verify email view handles missing token', (tester) async {
    await _pumpVerifyView(
      tester,
      token: null,
      repository: _repository(_FakeAuthApi()),
    );

    expect(find.text('This verification link is invalid.'), findsOneWidget);
  });
}
