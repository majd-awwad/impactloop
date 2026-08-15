import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/profile/application/profile_providers.dart';
import 'package:frontend/features/profile/data/profile_api.dart';
import 'package:frontend/features/profile/data/profile_repository.dart';
import 'package:frontend/features/profile/data/models/learner_interest_options.dart';
import 'package:frontend/features/profile/presentation/pages/learner_profile_edit_page.dart';
import 'package:frontend/features/auth/application/auth_route_helpers.dart';
import 'package:frontend/features/profile/presentation/pages/profile_edit_page.dart';
import 'package:frontend/features/profile/presentation/widgets/profile_edit_widgets.dart';

void main() {
  test('dropdown values replace a trim/case-equivalent supported value', () {
    final values = learnerProfileDropdownValues(
      supported: const ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
      current: ' INTERMEDIATE ',
    );

    expect(values, const ['Beginner', ' INTERMEDIATE ', 'Advanced', 'Expert']);
    expect(
      values.where((value) => value.trim().toLowerCase() == 'intermediate'),
      hasLength(1),
    );
  });

  test('dropdown values retain a genuinely unsupported current value', () {
    expect(
      learnerProfileDropdownValues(
        supported: const ['Beginner', 'Intermediate'],
        current: 'Exploring',
      ),
      const ['Exploring', 'Beginner', 'Intermediate'],
    );
  });

  testWidgets(
    'profile edit saves without phone validation error when phone is empty',
    (tester) async {
      final repository = _RecordingProfileRepository();

      await tester.binding.setSurfaceSize(const Size(400, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        _profileEditApp(
          repository: repository,
          child: const ProfileEditPage(),
        ),
      );

      await tester.pump();

      await tester.enterText(find.byType(TextFormField).at(0), 'Updated Name');
      await tester.ensureVisible(find.text('Save changes'));
      await tester.tap(find.text('Save changes'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));

      expect(repository.lastUpdatePhone, isFalse);
      expect(repository.lastPhone, isNull);
      expect(find.textContaining('Too small'), findsNothing);
      expect(find.textContaining('>=5 characters'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('profile edit renders hero, sections, and actions in English', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(400, 1200));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _profileEditApp(
        repository: _RecordingProfileRepository(),
        child: const ProfileEditPage(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Edit profile'), findsOneWidget);
    expect(
      find.text('Update your personal information and profile photo.'),
      findsOneWidget,
    );
    expect(find.byType(ProfileEditIdentityHero), findsOneWidget);
    expect(find.text('Learner User'), findsWidgets);
    expect(find.text('learner@example.com'), findsOneWidget);
    expect(find.text('Edit personal information'), findsOneWidget);
    expect(find.text('Profile photo'), findsOneWidget);
    expect(find.text('Basic information'), findsOneWidget);
    expect(find.text('Save changes'), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);
    expect(
      find.text('Saving a new phone number will mark it as not verified.'),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('profile edit mobile and web layouts render without overflow', (
    tester,
  ) async {
    final repository = _RecordingProfileRepository();

    Future<void> pumpAt(Size size) async {
      await tester.binding.setSurfaceSize(size);
      await tester.pumpWidget(
        _profileEditApp(
          repository: repository,
          child: const ProfileEditPage(),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Edit profile'), findsOneWidget);
      expect(find.text('Profile photo'), findsOneWidget);
      expect(find.text('Basic information'), findsOneWidget);
      expect(find.text('Save changes'), findsOneWidget);
    }

    addTearDown(() => tester.binding.setSurfaceSize(null));
    await pumpAt(const Size(360, 800));
    await pumpAt(const Size(1440, 900));
  });

  testWidgets(
    'learner profile edit syncs auth state and opens the learning profile',
    (tester) async {
      final repository = _RecordingProfileRepository();
      final router = GoRouter(
        initialLocation: '/profile/learner/edit',
        routes: [
          GoRoute(
            path: '/profile/learning',
            builder: (context, state) => Consumer(
              builder: (context, ref, _) => Scaffold(
                body: Text(
                  'Learning profile: ${ref.watch(authControllerProvider).user?.learnerProfile?.bio}',
                ),
              ),
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

      await tester.enterText(find.byType(TextFormField).last, 'Updated bio');
      await tester.tap(find.text('Save changes'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pumpAndSettle();

      expect(find.text('Learning profile: Updated bio'), findsOneWidget);
      expect(repository.learnerUpdateCount, 1);
      expect(repository.lastLearnerType, 'University student');
      expect(repository.lastSkillLevel, 'Beginner');
    },
  );

  testWidgets('editor back acts as cancel without saving', (tester) async {
    final repository = _RecordingProfileRepository();
    final router = GoRouter(
      initialLocation: '/profile/learner/edit',
      routes: [
        GoRoute(
          path: '/profile/learning',
          builder: (_, _) => const Scaffold(body: Text('Learning profile')),
        ),
        GoRoute(
          path: '/profile/learner/edit',
          builder: (_, _) => const LearnerProfileEditPage(),
        ),
      ],
    );
    addTearDown(router.dispose);

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

    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();

    expect(find.text('Learning profile'), findsOneWidget);
    expect(repository.learnerUpdateCount, 0);
  });

  testWidgets(
    'equivalent stored casing has one label and saves exact learner values',
    (tester) async {
      final repository = _RecordingProfileRepository();
      await _pumpLearnerEditor(
        tester,
        repository: repository,
        user: _testUser(
          learnerProfile: const LearnerProfile(
            learnerType: 'UNIVERSITY STUDENT',
            skillLevel: ' INTERMEDIATE ',
            interests: ['robotics'],
          ),
        ),
      );

      final fields = find.byType(DropdownButtonFormField<String>);
      final dropdowns = find.byType(DropdownButton<String>);
      final learnerTypeField = tester.widget<DropdownButtonFormField<String>>(
        fields.at(0),
      );
      final skillLevelField = tester.widget<DropdownButtonFormField<String>>(
        fields.at(1),
      );

      expect(learnerTypeField.initialValue, 'UNIVERSITY STUDENT');
      expect(skillLevelField.initialValue, ' INTERMEDIATE ');
      expect(
        _itemLabels(
          tester.widget<DropdownButton<String>>(dropdowns.at(0)),
          'University student',
        ),
        hasLength(1),
      );
      expect(
        _itemLabels(
          tester.widget<DropdownButton<String>>(dropdowns.at(1)),
          'Intermediate',
        ),
        hasLength(1),
      );
      expect(find.text('University student'), findsOneWidget);
      expect(find.text('Intermediate'), findsOneWidget);

      await tester.ensureVisible(find.text('Save changes'));
      await tester.tap(find.text('Save changes'));
      await tester.pumpAndSettle();

      expect(repository.lastLearnerType, 'UNIVERSITY STUDENT');
      expect(repository.lastSkillLevel, ' INTERMEDIATE ');
      expect(find.text('Learning profile route'), findsOneWidget);
    },
  );

  testWidgets('selecting supported values submits the new exact values', (
    tester,
  ) async {
    final repository = _RecordingProfileRepository();
    await _pumpLearnerEditor(
      tester,
      repository: repository,
      user: _testUser(
        learnerProfile: const LearnerProfile(
          learnerType: 'UNIVERSITY STUDENT',
          skillLevel: 'INTERMEDIATE',
          interests: ['robotics'],
        ),
      ),
    );

    await tester.tap(find.byType(DropdownButtonFormField<String>).at(0));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Self learner').last);
    await tester.pumpAndSettle();

    await tester.tap(find.byType(DropdownButtonFormField<String>).at(1));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Advanced').last);
    await tester.pumpAndSettle();

    await tester.ensureVisible(find.text('Save changes'));
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    expect(repository.lastLearnerType, 'Self learner');
    expect(repository.lastSkillLevel, 'Advanced');
  });

  testWidgets('failed interest options still render a complete savable form', (
    tester,
  ) async {
    final repository = _RecordingProfileRepository();

    await tester.binding.setSurfaceSize(const Size(500, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(_testUser()),
          ),
          profileRepositoryProvider.overrideWithValue(repository),
          learnerInterestOptionsProvider.overrideWith(
            (ref) => Future.error(StateError('offline')),
          ),
        ],
        child: const MaterialApp(home: LearnerProfileEditPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('built-in list'), findsOneWidget);
    expect(find.text('Save changes'), findsOneWidget);
    expect(find.text('Robotics'), findsOneWidget);
    await tester.tap(find.text('Save changes'));
    await tester.pump();
    expect(repository.learnerUpdateCount, 1);
  });

  testWidgets('unsupported stored values stay selected and do not crash', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(500, 1000));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(
              _testUser(
                learnerProfile: const LearnerProfile(
                  learnerType: 'Community mentor',
                  skillLevel: 'Exploring',
                  interests: ['robotics'],
                ),
              ),
            ),
          ),
        ],
        child: const MaterialApp(home: LearnerProfileEditPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Community Mentor'), findsOneWidget);
    expect(find.text('Exploring'), findsOneWidget);
    final fields = find.byType(DropdownButtonFormField<String>);
    expect(
      tester.widget<DropdownButtonFormField<String>>(fields.at(0)).initialValue,
      'Community mentor',
    );
    expect(
      tester.widget<DropdownButtonFormField<String>>(fields.at(1)).initialValue,
      'Exploring',
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Arabic editor localizes visible labels but preserves values', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(_testUser()),
          ),
        ],
        child: const MaterialApp(
          locale: Locale('ar'),
          supportedLocales: [Locale('en'), Locale('ar')],
          localizationsDelegates: [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: LearnerProfileEditPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('تعديل ملف التعلّم'), findsOneWidget);
    expect(find.text('طالب جامعي'), findsOneWidget);
    expect(find.text('مبتدئ'), findsOneWidget);
    expect(find.text('الروبوتات'), findsOneWidget);
    expect(find.text('حفظ التغييرات'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Arabic personal editor localizes controls and uses RTL', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(360, 900));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      _profileEditApp(
        repository: _RecordingProfileRepository(),
        locale: const Locale('ar'),
        child: const ProfileEditPage(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('تعديل الملف الشخصي'), findsOneWidget);
    expect(find.text('حدّث معلوماتك الشخصية وصورة ملفك.'), findsOneWidget);
    expect(find.byType(ProfileEditIdentityHero), findsOneWidget);
    expect(find.text('اسم العرض'), findsOneWidget);
    expect(find.text('المعلومات الأساسية'), findsOneWidget);
    expect(find.text('صورة الملف الشخصي'), findsOneWidget);
    expect(find.text('اختيار صورة'), findsOneWidget);
    expect(find.text('حفظ التغييرات'), findsOneWidget);
    expect(find.text('إلغاء'), findsOneWidget);
    expect(
      find.text('سيؤدي حفظ رقم هاتف جديد إلى اعتباره غير موثّق.'),
      findsOneWidget,
    );
    expect(
      Directionality.of(tester.element(find.text('تعديل الملف الشخصي'))),
      TextDirection.rtl,
    );
    expect(tester.takeException(), isNull);
  });
}

Widget _profileEditApp({
  required Widget child,
  required _RecordingProfileRepository repository,
  Locale locale = const Locale('en'),
}) {
  final router = GoRouter(
    initialLocation: '/profile/edit',
    routes: [
      GoRoute(
        path: '/profile/edit',
        builder: (context, state) => child,
      ),
      GoRoute(
        path: accountSettingsRoute,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Account settings')),
        ),
      ),
    ],
  );

  return ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(
        () => _TestAuthController(_testUser()),
      ),
      profileRepositoryProvider.overrideWithValue(repository),
    ],
    child: MaterialApp.router(
      theme: AppTheme.light,
      locale: locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      routerConfig: router,
    ),
  );
}

List<String> _itemLabels(DropdownButton<String> dropdown, String label) {
  return dropdown.items!
      .map((item) => item.child)
      .whereType<Text>()
      .map((text) => text.data ?? '')
      .where((value) => value == label)
      .toList(growable: false);
}

Future<GoRouter> _pumpLearnerEditor(
  WidgetTester tester, {
  required User user,
  required _RecordingProfileRepository repository,
}) async {
  await tester.binding.setSurfaceSize(const Size(600, 1200));
  addTearDown(() => tester.binding.setSurfaceSize(null));

  final router = GoRouter(
    initialLocation: '/profile/learner/edit',
    routes: [
      GoRoute(
        path: '/profile/learning',
        builder: (_, _) => const Scaffold(body: Text('Learning profile route')),
      ),
      GoRoute(
        path: '/profile/learner/edit',
        builder: (_, _) => const LearnerProfileEditPage(),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => _TestAuthController(user)),
        profileRepositoryProvider.overrideWithValue(repository),
        learnerInterestOptionsProvider.overrideWith(
          (ref) async => fallbackLearnerInterestOptions,
        ),
      ],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

class _RecordingProfileRepository extends ProfileRepository {
  _RecordingProfileRepository() : super(api: ProfileApi(Dio()));

  bool lastUpdatePhone = false;
  String? lastPhone;
  int learnerUpdateCount = 0;
  String? lastLearnerType;
  String? lastSkillLevel;

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
    learnerUpdateCount++;
    lastLearnerType = learnerType;
    lastSkillLevel = skillLevel;
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
