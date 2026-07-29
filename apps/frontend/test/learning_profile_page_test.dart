import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/profile/presentation/pages/learning_profile_page.dart';
import 'package:frontend/features/profile/presentation/widgets/learning_profile_widgets.dart';
import 'package:frontend/features/profile/presentation/widgets/profile_visual_components.dart';

void main() {
  testWidgets('renders only supported authenticated-user learning data', (
    tester,
  ) async {
    await _pumpPage(tester, user: _user());

    expect(find.text('University student'), findsOneWidget);
    expect(find.text('Beginner'), findsOneWidget);
    expect(find.text('Robotics'), findsOneWidget);
    expect(find.text('A short learning bio.'), findsOneWidget);
    expect(find.text('Edit'), findsOneWidget);
    expect(find.textContaining('%'), findsNothing);
    expect(find.textContaining('achievement'), findsNothing);
    expect(find.text('Impact'), findsNothing);
    expect(find.textContaining('reservation'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('null profile has one setup action and one empty state', (
    tester,
  ) async {
    await _pumpPage(tester, user: _user(profile: null));

    expect(find.text('Set up'), findsOneWidget);
    expect(find.text('No learning details yet'), findsOneWidget);
    expect(find.byType(LearningProfileSummaryCard), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('partial and malformed values render explicit empty states', (
    tester,
  ) async {
    await _pumpPage(
      tester,
      user: _user(
        profile: const LearnerProfile(
          learnerType: ' ',
          skillLevel: 'Explorer',
          interests: [' ', 'robotics', 'Robotics', 'custom:solar_energy'],
          bio: '   ',
        ),
      ),
    );

    expect(find.text('Not added'), findsOneWidget);
    expect(find.text('Explorer'), findsOneWidget);
    expect(find.text('Robotics'), findsOneWidget);
    expect(find.text('Solar Energy'), findsOneWidget);
    expect(find.text('Not added (optional)'), findsOneWidget);
    expect(find.byType(ProfileInterestChip), findsNWidgets(2));
    expect(tester.takeException(), isNull);
  });

  testWidgets('many interests and long bio expand without horizontal scroll', (
    tester,
  ) async {
    final interests = List.generate(14, (index) => 'topic_$index');
    final longBio = List.filled(
      18,
      'I enjoy learning how reusable materials become useful projects.',
    ).join(' ');

    await _pumpPage(
      tester,
      size: const Size(320, 760),
      user: _user(
        profile: LearnerProfile(
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: interests,
          bio: longBio,
        ),
      ),
    );

    expect(find.byType(ProfileInterestChip), findsNWidgets(8));
    final collapsedToggle = find.ancestor(
      of: find.text('Show 6 more interests'),
      matching: find.byWidgetPredicate(
        (widget) => widget is Semantics && widget.properties.expanded != null,
      ),
    );
    expect(collapsedToggle, findsOneWidget);
    expect(
      tester.widget<Semantics>(collapsedToggle).properties.expanded,
      isFalse,
    );
    await tester.ensureVisible(find.text('Show 6 more interests'));
    await tester.tap(find.text('Show 6 more interests'));
    await tester.pumpAndSettle();
    expect(find.byType(ProfileInterestChip), findsNWidgets(14));
    final expandedToggle = find.ancestor(
      of: find.text('Show fewer interests'),
      matching: find.byWidgetPredicate(
        (widget) => widget is Semantics && widget.properties.expanded != null,
      ),
    );
    expect(expandedToggle, findsOneWidget);
    expect(
      tester.widget<Semantics>(expandedToggle).properties.expanded,
      isTrue,
    );

    await tester.ensureVisible(find.text('Show more bio'));
    await tester.tap(find.text('Show more bio'));
    await tester.pumpAndSettle();
    final bioText = tester.widget<Text>(find.text(longBio));
    expect(bioText.maxLines, isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('Arabic profile is RTL and stable at 320px with large text', (
    tester,
  ) async {
    await _pumpPage(
      tester,
      locale: const Locale('ar'),
      size: const Size(320, 760),
      textScale: 1.35,
      user: _user(
        profile: const LearnerProfile(
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: ['robotics', 'custom:solar_energy'],
        ),
      ),
    );

    expect(find.text('ملف التعلّم'), findsWidgets);
    expect(find.text('طالب جامعي'), findsOneWidget);
    expect(find.text('مبتدئ'), findsOneWidget);
    expect(find.text('الروبوتات'), findsOneWidget);
    expect(find.text('Solar Energy'), findsOneWidget);
    expect(find.text('غير مضافة (اختيارية)'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('طالب جامعي'))),
      TextDirection.rtl,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('the single edit action opens the existing editor route', (
    tester,
  ) async {
    await _pumpPage(tester, user: _user());

    final editButton = find.widgetWithText(OutlinedButton, 'Edit');
    tester.widget<OutlinedButton>(editButton).onPressed?.call();
    await tester.pumpAndSettle();

    expect(find.text('Editor route'), findsOneWidget);
  });

  testWidgets('learning profile is constrained across responsive widths', (
    tester,
  ) async {
    for (final width in [360.0, 430.0, 800.0]) {
      await _pumpPage(tester, user: _user(), size: Size(width, 1200));

      final summary = tester.renderObject<RenderBox>(
        find.byType(LearningProfileSummaryCard),
      );
      expect(summary.size.width, lessThanOrEqualTo(720));
      expect(tester.takeException(), isNull);
    }
  });
}

Future<GoRouter> _pumpPage(
  WidgetTester tester, {
  required User user,
  Locale locale = const Locale('en'),
  Size size = const Size(400, 900),
  double textScale = 1,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  final router = GoRouter(
    initialLocation: '/profile/learning',
    routes: [
      GoRoute(
        path: '/profile/learning',
        builder: (_, _) => const LearningProfilePage(),
      ),
      GoRoute(
        path: '/profile/learner/edit',
        builder: (_, _) => const Scaffold(body: Text('Editor route')),
      ),
      GoRoute(
        path: '/profile',
        builder: (_, _) => const Scaffold(body: Text('Profile hub')),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => _TestAuthController(user)),
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
  await tester.pumpAndSettle();
  return router;
}

class _TestAuthController extends AuthController {
  _TestAuthController(this.user);

  final User user;

  @override
  AuthState build() =>
      AuthState(user: user, accessToken: 'test-access', hasBootstrapped: true);
}

User _user({
  LearnerProfile? profile = const LearnerProfile(
    learnerType: 'University student',
    skillLevel: 'Beginner',
    interests: ['robotics'],
    bio: 'A short learning bio.',
  ),
}) {
  return User(
    id: 'learner-1',
    displayName: 'Learner',
    email: 'learner@example.com',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    activeRole: 'LEARNER',
    learnerProfile: profile,
    createdAt: DateTime(2026),
  );
}
