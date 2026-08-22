import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/invitations/data/invite_accept_providers.dart';
import 'package:frontend/features/invitations/data/models/invite_accept_models.dart';
import 'package:frontend/features/invitations/presentation/pages/invite_accept_page.dart';
import 'package:frontend/l10n/app_localizations.dart';

Widget _harness(InviteValidationResult preview, {User? user}) => ProviderScope(
  overrides: [
    inviteValidationProvider('invite-token').overrideWith((ref) async => preview),
    if (user != null)
      authControllerProvider.overrideWith(() => _TestAuthController(user)),
  ],
  child: MaterialApp(
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    home: const InviteAcceptPage(token: 'invite-token'),
  ),
);

void main() {
  testWidgets('shows a login handoff for an existing signed-out recipient', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(
          valid: true,
          role: 'ADMIN',
          recipientEmail: 'admin@example.test',
          accountState: 'EXISTING_ACCOUNT_LOGGED_OUT',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Invitation details'), findsOneWidget);
    expect(find.text('You already have an ImpactLoop account'), findsOneWidget);
    expect(find.text('Sign in to accept invitation'), findsOneWidget);
  });

  testWidgets('distinguishes expired invitations from invalid links', (tester) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(valid: false, accountState: 'EXPIRED'),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text(
        'This invitation link has expired. Ask an administrator to send a new invitation.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('new administrator invitation shows account fields only', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(
          valid: true,
          role: 'ADMIN',
          recipientEmail: 'admin@example.test',
          accountState: 'NEW_ACCOUNT',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Full name'), findsOneWidget);
    expect(find.text('Password'), findsOneWidget);
    expect(find.text('Confirm password'), findsOneWidget);
    expect(find.text('Phone'), findsNothing);
    expect(find.textContaining('Administrator'), findsOneWidget);
  });

  testWidgets('new driver invitation includes required driver profile fields', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(
          valid: true,
          role: 'DRIVER',
          recipientEmail: 'driver@example.test',
          accountState: 'NEW_ACCOUNT',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Phone'), findsOneWidget);
    expect(find.text('City'), findsOneWidget);
    expect(find.text('Area'), findsOneWidget);
    expect(find.textContaining('Driver'), findsOneWidget);
  });

  testWidgets('matching existing administrator sees role confirmation only', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(
          valid: true,
          role: 'ADMIN',
          recipientEmail: 'learner@example.test',
          accountState: 'EXISTING_ACCOUNT_READY',
        ),
        user: _user(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Add administrator role'), findsOneWidget);
    expect(find.text('Password'), findsNothing);
    expect(find.text('Full name'), findsNothing);
  });

  testWidgets('existing driver without profile sees completion fields', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(
          valid: true,
          role: 'DRIVER',
          recipientEmail: 'learner@example.test',
          accountState: 'EXISTING_ACCOUNT_READY',
          requiresDriverProfile: true,
        ),
        user: _user(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Complete driver details and accept invitation'), findsOneWidget);
    expect(find.text('Phone'), findsOneWidget);
    expect(find.text('Password'), findsNothing);
  });

  testWidgets('wrong account shows a safe switch-account action', (tester) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(
          valid: true,
          role: 'ADMIN',
          recipientEmail: 'owner@example.test',
          accountState: 'WRONG_AUTHENTICATED_ACCOUNT',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Switch account'), findsOneWidget);
    expect(find.textContaining('owner@example.test'), findsWidgets);

  });

  testWidgets('already-granted role has an idempotent completion action', (
    tester,
  ) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(
          valid: true,
          role: 'ADMIN',
          recipientEmail: 'owner@example.test',
          accountState: 'ALREADY_HAS_ROLE',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('This role is already available on your account.'),
      findsOneWidget,
    );
    expect(find.text('Complete invitation'), findsOneWidget);
  });

  testWidgets('revoked link uses a localized message', (tester) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(valid: false, accountState: 'REVOKED'),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.textContaining('has been revoked'), findsOneWidget);
  });

  testWidgets('already accepted link uses a localized message', (tester) async {
    await tester.pumpWidget(
      _harness(
        const InviteValidationResult(
          valid: false,
          accountState: 'ALREADY_ACCEPTED',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('This invitation has already been accepted.'), findsOneWidget);
  });
}

User _user() => User(
  id: 'learner-1',
  displayName: 'Learner',
  email: 'learner@example.test',
  accountStatus: 'ACTIVE',
  roles: const ['LEARNER'],
  createdAt: DateTime(2026),
);

class _TestAuthController extends AuthController {
  _TestAuthController(this.user);

  final User user;

  @override
  AuthState build() => AuthState(
    user: user,
    accessToken: 'test-access-token',
    hasBootstrapped: true,
  );
}
