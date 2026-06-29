import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/profile/presentation/pages/profile_page.dart';

void main() {
  testWidgets('profile page renders account details and settings', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(_testUser()),
          ),
        ],
        child: const MaterialApp(home: ProfilePage()),
      ),
    );

    await tester.pump();

    expect(find.text('Learner User'), findsWidgets);
    expect(find.text('learner@example.com'), findsWidgets);
    expect(find.text('Learner'), findsOneWidget);
    expect(find.text('Active'), findsWidgets);
    expect(find.text('Learner profile'), findsOneWidget);
    expect(find.text('University Student'), findsOneWidget);
    expect(find.text('Beginner'), findsOneWidget);
    expect(find.text('Robotics'), findsOneWidget);
    expect(find.text('Building useful projects with reused parts.'), findsOneWidget);
    expect(find.text('Complete your learner profile'), findsNothing);
    expect(find.text('Coming soon'), findsOneWidget);
    expect(find.text('Account status'), findsOneWidget);
    expect(find.text('Settings'), findsWidgets);
    expect(find.text('Appearance'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('Logout'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('profile page shows learner completion hint when bio is missing', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(
              _testUser(
                learnerProfile: const LearnerProfile(
                  learnerType: 'University student',
                  skillLevel: 'Beginner',
                  interests: ['Robotics'],
                ),
              ),
            ),
          ),
        ],
        child: const MaterialApp(home: ProfilePage()),
      ),
    );

    await tester.pump();

    expect(find.text('Complete your learner profile'), findsOneWidget);
    expect(
      find.text(
        'Add interests and a short bio to get better project suggestions.',
      ),
      findsOneWidget,
    );
    expect(find.text('University Student'), findsOneWidget);
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

User _testUser({LearnerProfile? learnerProfile}) {
  return User(
    id: 'user-1',
    displayName: 'Learner User',
    email: 'learner@example.com',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    learnerProfile:
        learnerProfile ??
        const LearnerProfile(
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: ['Robotics'],
          bio: 'Building useful projects with reused parts.',
        ),
    createdAt: DateTime(2026),
  );
}
