import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/widgets/entry_nav_bar.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';

void main() {
  testWidgets('account menu shows profile image avatar when profileImageUrl is set', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(900, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(
              User(
                id: 'user-1',
                displayName: 'Learner User',
                email: 'learner@example.com',
                accountStatus: 'ACTIVE',
                profileImageUrl: '/uploads/profiles/profile_test.webp',
                roles: const ['LEARNER'],
                createdAt: DateTime(2026),
              ),
            ),
          ),
        ],
        child: const MaterialApp(
          home: Scaffold(
            body: EntryNavBar(
              showSignIn: false,
              showCreateAccount: false,
              homeRoute: '/home',
            ),
          ),
        ),
      ),
    );

    await tester.pump();

    expect(find.byType(Image), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

class _TestAuthController extends AuthController {
  _TestAuthController(this.user);

  final User user;

  @override
  AuthState build() {
    return AuthState(
      user: user,
      accessToken: 'test-access',
      hasBootstrapped: true,
    );
  }
}
