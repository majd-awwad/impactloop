import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/profile/application/profile_providers.dart';
import 'package:frontend/features/profile/data/profile_api.dart';
import 'package:frontend/features/profile/data/profile_repository.dart';
import 'package:frontend/features/profile/presentation/pages/learner_profile_edit_page.dart';
import 'package:frontend/features/profile/presentation/pages/profile_edit_page.dart';

void main() {
  testWidgets('profile edit saves without phone validation error when phone is empty', (
    tester,
  ) async {
    final repository = _RecordingProfileRepository();

    await tester.binding.setSurfaceSize(const Size(400, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(_testUser()),
          ),
          profileRepositoryProvider.overrideWithValue(repository),
        ],
        child: const MaterialApp(home: ProfileEditPage()),
      ),
    );

    await tester.pump();

    await tester.enterText(find.byType(TextFormField).at(0), 'Updated Name');
    await tester.tap(find.text('Save changes'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(repository.lastUpdatePhone, isFalse);
    expect(repository.lastPhone, isNull);
    expect(find.textContaining('Too small'), findsNothing);
    expect(find.textContaining('>=5 characters'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('learner profile edit navigates to profile after successful save', (
    tester,
  ) async {
    final repository = _RecordingProfileRepository();
    final router = GoRouter(
      initialLocation: '/profile/learner/edit',
      routes: [
        GoRoute(
          path: '/profile',
          builder: (context, state) => const Scaffold(
            body: Center(child: Text('Profile hub')),
          ),
        ),
        GoRoute(
          path: '/profile/learner/edit',
          builder: (context, state) => const LearnerProfileEditPage(),
        ),
      ],
    );

    await tester.binding.setSurfaceSize(const Size(900, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(_testUser()),
          ),
          profileRepositoryProvider.overrideWithValue(repository),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );

    await tester.pumpAndSettle();

    await tester.tap(find.text('Save changes'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();

    expect(find.text('Profile hub'), findsOneWidget);
  });
}

class _RecordingProfileRepository extends ProfileRepository {
  _RecordingProfileRepository() : super(api: ProfileApi(Dio()));

  bool lastUpdatePhone = false;
  String? lastPhone;

  @override
  Future<User> updateProfile({
    String? displayName,
    String? phone,
    String? profileImageUrl,
    bool updatePhone = false,
    bool updateProfileImage = false,
  }) async {
    lastUpdatePhone = updatePhone;
    lastPhone = phone;
    return _testUser(displayName: displayName ?? 'Learner User');
  }

  @override
  Future<User> updateLearnerProfile({
    required String learnerType,
    required String skillLevel,
    required List<String> interests,
    String? bio,
  }) async {
    return _testUser(
      learnerProfile: LearnerProfile(
        learnerType: learnerType,
        skillLevel: skillLevel,
        interests: interests,
        bio: bio,
      ),
    );
  }
}

class _TestAuthController extends AuthController {
  _TestAuthController(this.user);

  User user;

  @override
  AuthState build() {
    return AuthState(
      user: user,
      accessToken: 'test-access',
      hasBootstrapped: true,
    );
  }

  @override
  Future<void> refreshCurrentUser() async {
    state = state.copyWith(user: user);
  }
}

User _testUser({
  String displayName = 'Learner User',
  LearnerProfile? learnerProfile,
}) {
  return User(
    id: 'user-1',
    displayName: displayName,
    email: 'learner@example.com',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    learnerProfile:
        learnerProfile ??
        const LearnerProfile(
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: ['Robotics'],
          bio: 'Initial bio',
        ),
    createdAt: DateTime(2026),
  );
}
