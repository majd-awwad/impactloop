import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/profile/presentation/pages/profile_page.dart';
import 'package:frontend/shared/widgets/user_avatar.dart';

void main() {
  testWidgets('profile page renders account details and settings', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

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
    expect(find.text('Profile management'), findsOneWidget);
    expect(find.text('Edit profile'), findsOneWidget);
    expect(find.text('Security'), findsOneWidget);
    expect(find.text('Coming soon'), findsNothing);
    expect(find.text('Account status'), findsOneWidget);
    expect(find.text('Settings'), findsWidgets);
    expect(find.text('Appearance'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('Logout'), findsOneWidget);
    expect(find.byType(UserAvatar), findsNothing);
    expect(find.text('Profile'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('profile page shows bio completion hint when bio is missing', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

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

    expect(find.text('Add a short bio'), findsOneWidget);
    expect(
      find.text(
        'Add a short bio to help personalize project suggestions.',
      ),
      findsOneWidget,
    );
    expect(find.text('University Student'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('profile page shows interests completion hint when interests are missing', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(
              _testUser(
                learnerProfile: const LearnerProfile(
                  learnerType: 'University student',
                  skillLevel: 'Beginner',
                  interests: [],
                  bio: 'Building useful projects with reused parts.',
                ),
              ),
            ),
          ),
        ],
        child: const MaterialApp(home: ProfilePage()),
      ),
    );

    await tester.pump();

    expect(find.text('Add your interests'), findsOneWidget);
    expect(
      find.text('Add interests to improve project suggestions.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('profile page shows combined completion hint when bio and interests are missing', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(
              _testUser(
                learnerProfile: const LearnerProfile(
                  learnerType: 'University student',
                  skillLevel: 'Beginner',
                  interests: [],
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
    expect(tester.takeException(), isNull);
  });

  testWidgets('profile page uses two-column desktop layout on wide screens', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

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

    final rowFinder = find.descendant(
      of: find.byType(ConstrainedBox),
      matching: find.byWidgetPredicate(
        (widget) =>
            widget is Row &&
            widget.children.whereType<Expanded>().length == 2,
      ),
    );
    expect(rowFinder, findsOneWidget);

    final rowBox = tester.getTopLeft(rowFinder);
    final settingsBox = tester.getTopLeft(find.text('Settings'));
    final learnerProfileBox = tester.getTopLeft(find.text('Learner profile'));

    expect(settingsBox.dx, lessThan(learnerProfileBox.dx));
    expect(rowBox.dx, lessThan(settingsBox.dx));
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
