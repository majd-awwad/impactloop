import 'dart:async';

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
import 'package:frontend/features/profile/data/models/learner_profile_summary.dart';
import 'package:frontend/features/profile/data/profile_api.dart';
import 'package:frontend/features/profile/data/profile_repository.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/profile/presentation/pages/profile_page.dart';
import 'package:frontend/features/profile/presentation/widgets/learner_profile_dashboard_widgets.dart';
import 'package:frontend/shared/widgets/notification_bell_button.dart';

void main() {
  testWidgets('renders the real dashboard contract and learning identity', (
    tester,
  ) async {
    await _pumpProfile(tester, repository: _FakeProfileRepository.success());

    expect(find.byType(LearnerIdentityDashboardHero), findsOneWidget);
    expect(find.text('Learner User'), findsOneWidget);
    expect(find.text('learner@example.com'), findsOneWidget);
    expect(find.text('67%'), findsOneWidget);
    expect(find.text('4 of 6 steps complete'), findsOneWidget);
    expect(find.text('Active reservations'), findsOneWidget);
    expect(find.text('Completed builds'), findsOneWidget);
    expect(find.text('Saved projects'), findsOneWidget);
    expect(find.text('Liked materials'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
    expect(find.text('4'), findsWidgets);
    expect(find.text('7'), findsOneWidget);
    expect(find.text('8'), findsOneWidget);
    expect(find.text('Smart irrigation device'), findsOneWidget);
    expect(find.text('2 of 5 steps'), findsOneWidget);
    expect(find.text('University student'), findsOneWidget);
    expect(find.text('Beginner'), findsOneWidget);
    expect(find.text('Robotics'), findsOneWidget);
    expect(
      find.text('Building useful projects with reused parts.'),
      findsOneWidget,
    );
    expect(find.text('Account and Settings'), findsOneWidget);
    expect(find.text('Saved locations'), findsOneWidget);
    expect(find.textContaining('CO₂'), findsNothing);
    expect(find.text('Points'), findsNothing);
    expect(find.text('Achievements'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('uses first missing step and hides action at 100 percent', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      repository: _FakeProfileRepository.success(
        summary: _summary(missingSteps: const ['phone', 'saved_location']),
      ),
    );

    expect(find.text('Add or review your phone'), findsOneWidget);
    expect(find.text('Add a saved location'), findsNothing);

    await _pumpProfile(
      tester,
      repository: _FakeProfileRepository.success(
        summary: _summary(
          percentage: 100,
          completedSteps: 6,
          missingSteps: const [],
        ),
      ),
    );

    expect(find.text('Profile complete'), findsOneWidget);
    expect(find.text('6 of 6 steps complete'), findsOneWidget);
    expect(find.text('Add or review your phone'), findsNothing);
  });

  testWidgets('zero metrics remain visible and continuation can be absent', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      repository: _FakeProfileRepository.success(
        summary: _summary(zeroJourney: true, continueProject: false),
      ),
    );

    expect(find.text('0'), findsNWidgets(4));
    expect(find.text('Continue project'), findsNothing);
    expect(find.byType(ContinueProjectDashboardCard), findsNothing);
    expect(find.text('Your learning profile'), findsOneWidget);
  });

  testWidgets('identity remains visible while summary shows skeleton', (
    tester,
  ) async {
    final completer = Completer<LearnerProfileSummary>();
    await _pumpProfile(
      tester,
      repository: _FakeProfileRepository(() => completer.future),
      settle: false,
    );

    expect(find.text('Learner User'), findsOneWidget);
    expect(find.byType(LearnerDashboardSkeleton), findsOneWidget);
    expect(find.text('Your learning profile'), findsOneWidget);
    expect(find.text('Account and Settings'), findsOneWidget);

    completer.complete(_summary());
    await tester.pumpAndSettle();
    expect(find.byType(LearnerDashboardSkeleton), findsNothing);
    expect(find.text('67%'), findsOneWidget);
  });

  testWidgets('summary failure preserves navigation and retry succeeds', (
    tester,
  ) async {
    var fail = true;
    final repository = _FakeProfileRepository(() async {
      if (fail) throw StateError('failed');
      return _summary();
    });
    await _pumpProfile(tester, repository: repository);

    expect(find.text('Your dashboard could not be loaded.'), findsOneWidget);
    expect(find.text('Learner User'), findsOneWidget);
    expect(find.text('Your learning profile'), findsOneWidget);
    expect(find.text('Account and Settings'), findsOneWidget);

    fail = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();

    expect(repository.calls, 2);
    expect(find.text('67%'), findsOneWidget);
  });

  testWidgets('dashboard routes use exact committed destinations', (
    tester,
  ) async {
    final harness = await _pumpProfile(
      tester,
      repository: _FakeProfileRepository.success(),
    );

    await tester.tap(find.byTooltip('Edit profile'));
    await tester.pumpAndSettle();
    expect(find.text('Edit profile route'), findsOneWidget);
    harness.router.pop();
    await tester.pumpAndSettle();

    await _tapTextSurface(tester, 'Active reservations');
    await tester.pumpAndSettle();
    expect(find.text('Reservations route'), findsOneWidget);
    harness.router.pop();
    await tester.pumpAndSettle();

    await _tapTextSurface(tester, 'Saved projects');
    await tester.pumpAndSettle();
    expect(find.text('Saved projects route'), findsOneWidget);
    harness.router.pop();
    await tester.pumpAndSettle();

    await _tapTextSurface(tester, 'Liked materials');
    await tester.pumpAndSettle();
    expect(find.text('Liked materials route'), findsOneWidget);
    harness.router.pop();
    await tester.pumpAndSettle();

    await _tapTextSurface(tester, 'Smart irrigation device');
    await tester.pumpAndSettle();
    expect(find.text('Build route project-1'), findsOneWidget);
  });

  testWidgets(
    'liked return avoids duplicate fetch while other routes refresh',
    (tester) async {
      final repository = _FakeProfileRepository.success();
      final harness = await _pumpProfile(tester, repository: repository);
      expect(repository.calls, 1);

      await _tapTextSurface(tester, 'Liked materials');
      await tester.pumpAndSettle();
      harness.router.pop();
      await tester.pumpAndSettle();
      expect(repository.calls, 1);

      await _tapTextSurface(tester, 'Active reservations');
      await tester.pumpAndSettle();
      harness.router.pop();
      await tester.pumpAndSettle();
      expect(repository.calls, 2);
    },
  );

  testWidgets('learning profile appears once and quick actions stay compact', (
    tester,
  ) async {
    await _pumpProfile(tester, repository: _FakeProfileRepository.success());

    expect(find.text('Your learning profile'), findsOneWidget);
    expect(find.text('Quick actions'), findsOneWidget);
    expect(find.text('My builds'), findsOneWidget);
    expect(find.text('Account and Settings'), findsOneWidget);
    expect(find.text('Saved locations'), findsOneWidget);
  });

  testWidgets('switching users clears a completed cached summary immediately', (
    tester,
  ) async {
    final secondSummary = Completer<LearnerProfileSummary>();
    var call = 0;
    final repository = _FakeProfileRepository(() {
      call += 1;
      return call == 1 ? Future.value(_summary()) : secondSummary.future;
    });
    final controller = _TestAuthController(_testUser());
    await _pumpProfile(tester, repository: repository, controller: controller);
    expect(find.text('67%'), findsOneWidget);

    controller.replaceUser(
      _testUser(id: 'user-2', displayName: 'Second Learner'),
    );
    await tester.pump();

    expect(find.text('Second Learner'), findsOneWidget);
    expect(find.text('67%'), findsNothing);
    expect(find.byType(LearnerDashboardSkeleton), findsOneWidget);

    secondSummary.complete(_summary(percentage: 33, completedSteps: 2));
    await tester.pumpAndSettle();
    expect(find.text('33%'), findsOneWidget);
  });

  testWidgets('stale first-user completion cannot replace second-user data', (
    tester,
  ) async {
    final firstSummary = Completer<LearnerProfileSummary>();
    final secondSummary = Completer<LearnerProfileSummary>();
    var call = 0;
    final repository = _FakeProfileRepository(() {
      call += 1;
      return call == 1 ? firstSummary.future : secondSummary.future;
    });
    final controller = _TestAuthController(_testUser());
    await _pumpProfile(
      tester,
      repository: repository,
      controller: controller,
      settle: false,
    );

    controller.replaceUser(
      _testUser(id: 'user-2', displayName: 'Second Learner'),
    );
    await tester.pump();
    secondSummary.complete(_summary(percentage: 33, completedSteps: 2));
    await tester.pumpAndSettle();
    expect(find.text('33%'), findsOneWidget);

    firstSummary.complete(_summary());
    await tester.pumpAndSettle();
    expect(find.text('33%'), findsOneWidget);
    expect(find.text('67%'), findsNothing);
  });

  testWidgets('Arabic dashboard is RTL and stable at increased text scale', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      repository: _FakeProfileRepository.success(),
      locale: const Locale('ar'),
      size: const Size(360, 800),
      textScale: 1.3,
    );

    expect(find.text('رحلتك في ImpactLoop'), findsOneWidget);
    expect(find.text('حجوزات نشطة'), findsOneWidget);
    expect(find.text('مشاريع مكتملة'), findsOneWidget);
    expect(find.text('المواد التي أعجبتني'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('حجوزات نشطة'))),
      TextDirection.rtl,
    );
    expect(
      Directionality.of(tester.element(find.text('learner@example.com'))),
      TextDirection.ltr,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('dashboard has no overflow at required viewport sizes', (
    tester,
  ) async {
    for (final size in const [
      Size(430, 932),
      Size(390, 844),
      Size(360, 800),
      Size(320, 800),
      Size(1440, 900),
    ]) {
      await _pumpProfile(
        tester,
        repository: _FakeProfileRepository.success(),
        size: size,
      );
      expect(tester.takeException(), isNull, reason: 'viewport $size');
      final hero = tester.renderObject<RenderBox>(
        find.byType(LearnerIdentityDashboardHero),
      );
      expect(hero.size.width, lessThanOrEqualTo(1040));
    }
  });
}

Future<void> _tapTextSurface(WidgetTester tester, String text) async {
  final label = find.text(text);
  await tester.ensureVisible(label);
  await tester.pumpAndSettle();
  final inkWell = find
      .ancestor(of: label, matching: find.byType(InkWell))
      .first;
  tester.widget<InkWell>(inkWell).onTap?.call();
}

class _ProfileHarness {
  const _ProfileHarness({required this.router, required this.controller});

  final GoRouter router;
  final _TestAuthController controller;
}

Future<_ProfileHarness> _pumpProfile(
  WidgetTester tester, {
  required _FakeProfileRepository repository,
  User? user,
  Locale locale = const Locale('en'),
  Size size = const Size(430, 932),
  double textScale = 1,
  bool settle = true,
  _TestAuthController? controller,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  final router = GoRouter(
    initialLocation: '/profile',
    routes: [
      GoRoute(path: '/profile', builder: (_, _) => const ProfilePage()),
      _stubRoute('/profile/edit', 'Edit profile route'),
      _stubRoute('/profile/account', 'Account settings route'),
      _stubRoute('/profile/learning', 'Learning profile route'),
      _stubRoute('/profile/learner/edit', 'Learning edit route'),
      _stubRoute('/profile/locations', 'Locations route'),
      _stubRoute('/learner/reservations', 'Reservations route'),
      _stubRoute('/learning', 'Learning route'),
      _stubRoute('/materials/liked', 'Liked materials route'),
      _stubRoute(
        '/home/recommendations/saved_projects',
        'Saved projects route',
      ),
      GoRoute(
        path: '/learning/:id/build',
        builder: (_, state) =>
            Scaffold(body: Text('Build route ${state.pathParameters['id']}')),
      ),
      _stubRoute('/home', 'Home route'),
    ],
  );
  addTearDown(router.dispose);

  final authController = controller ?? _TestAuthController(user ?? _testUser());
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => authController),
        profileRepositoryProvider.overrideWithValue(repository),
        myNotificationUnreadCountProvider.overrideWith(_ProfileZeroUnread.new),
      ],
      child: MaterialApp.router(
        theme: AppTheme.light,
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: child!,
        ),
        routerConfig: router,
      ),
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
  return _ProfileHarness(router: router, controller: authController);
}

GoRoute _stubRoute(String path, String label) {
  return GoRoute(
    path: path,
    builder: (_, _) => Scaffold(body: Text(label)),
  );
}

class _TestAuthController extends AuthController {
  _TestAuthController(this.initialUser);

  final User initialUser;

  @override
  AuthState build() {
    return AuthState(
      user: initialUser,
      accessToken: 'test-access',
      hasBootstrapped: true,
    );
  }

  @override
  Future<void> refreshCurrentUser() async {}

  void replaceUser(User? user) {
    state = AuthState(
      user: user,
      accessToken: user == null ? null : 'test-access',
      hasBootstrapped: true,
    );
  }
}

class _FakeProfileRepository extends ProfileRepository {
  _FakeProfileRepository(this.loader) : super(api: ProfileApi(Dio()));

  factory _FakeProfileRepository.success({LearnerProfileSummary? summary}) {
    return _FakeProfileRepository(() async => summary ?? _summary());
  }

  final Future<LearnerProfileSummary> Function() loader;
  int calls = 0;

  @override
  Future<LearnerProfileSummary> fetchLearnerProfileSummary() {
    calls += 1;
    return loader();
  }
}

class _ProfileZeroUnread extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

LearnerProfileSummary _summary({
  int percentage = 67,
  int completedSteps = 4,
  List<String> missingSteps = const ['phone', 'saved_location'],
  bool zeroJourney = false,
  bool continueProject = true,
}) {
  return LearnerProfileSummary(
    profileCompletion: LearnerProfileCompletionSummary(
      completedSteps: completedSteps,
      totalSteps: 6,
      percentage: percentage,
      missingSteps: missingSteps,
    ),
    journey: LearnerJourneySummary(
      activeReservationsCount: zeroJourney ? 0 : 3,
      completedReservationsCount: zeroJourney ? 0 : 9,
      likedMaterialsCount: zeroJourney ? 0 : 8,
      savedProjectsCount: zeroJourney ? 0 : 7,
      followedProjectsCount: zeroJourney ? 0 : 2,
      activeBuildsCount: zeroJourney ? 0 : 1,
      completedBuildsCount: zeroJourney ? 0 : 4,
    ),
    continueProject: continueProject
        ? LearnerContinueProjectSummary(
            projectId: 'project-1',
            buildId: 'build-1',
            title: 'Smart irrigation device',
            imageUrl: null,
            lastActivityAt: DateTime.utc(2026, 7, 29),
            progress: const LearnerBuildProgressSummary(
              completedSteps: 2,
              totalSteps: 5,
              percentage: 40,
            ),
          )
        : null,
  );
}

User _testUser({String id = 'user-1', String displayName = 'Learner User'}) {
  return User(
    id: id,
    displayName: displayName,
    email: 'learner@example.com',
    phone: '+970 599 000 000',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    activeRole: 'LEARNER',
    learnerProfile: const LearnerProfile(
      learnerType: 'University student',
      skillLevel: 'Beginner',
      interests: ['robotics', 'arduino', 'sensors', 'circuits', 'recycling'],
      bio: 'Building useful projects with reused parts.',
    ),
    emailVerifiedAt: DateTime(2026, 1, 2),
    phoneVerifiedAt: DateTime(2026, 1, 2),
    createdAt: DateTime(2026),
  );
}
