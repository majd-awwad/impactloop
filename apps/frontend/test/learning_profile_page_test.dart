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
import 'package:frontend/features/profile/presentation/widgets/profile_family_page_widgets.dart';

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
    expect(find.text('Learning profile'), findsOneWidget);
    expect(find.text('Your learning profile'), findsNothing);
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
    expect(find.byType(LearningProfileSummaryCard), findsOneWidget);
    expect(find.text('Not added'), findsNWidgets(2));
    expect(find.text('Learning profile'), findsOneWidget);
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
    expect(find.byType(ProfileFamilyIntrinsicChip), findsNWidgets(2));
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

    expect(find.byType(ProfileFamilyIntrinsicChip), findsNWidgets(5));
    final collapsedToggle = find.ancestor(
      of: find.text('+10 more'),
      matching: find.byWidgetPredicate(
        (widget) => widget is Semantics && widget.properties.expanded != null,
      ),
    );
    expect(collapsedToggle, findsOneWidget);
    expect(
      tester.widget<Semantics>(collapsedToggle).properties.expanded,
      isFalse,
    );
    await tester.ensureVisible(find.text('+10 more'));
    await tester.tap(find.text('+10 more'));
    await tester.pumpAndSettle();
    expect(find.byType(ProfileFamilyIntrinsicChip), findsNWidgets(15));
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
    expect(
      Directionality.of(tester.element(find.text('Solar Energy'))),
      TextDirection.ltr,
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
    for (final width in [320.0, 360.0, 390.0, 430.0, 1440.0]) {
      await _pumpPage(tester, user: _user(), size: Size(width, 1200));

      final summary = tester.renderObject<RenderBox>(
        find.byType(LearningProfileSummaryCard),
      );
      expect(summary.size.width, lessThanOrEqualTo(920));
      expect(tester.takeException(), isNull);
    }
  });

  testWidgets('interest chips stay intrinsic and dark mode has no overflow', (
    tester,
  ) async {
    await _pumpPage(
      tester,
      user: _user(
        profile: const LearnerProfile(
          learnerType: 'University student',
          skillLevel: 'Intermediate',
          interests: ['arduino', 'robotics', 'sensors', 'circuits', 'displays'],
          bio: 'A compact learner bio.',
        ),
      ),
      size: const Size(360, 800),
      brightness: Brightness.dark,
    );

    final chips = find.byType(ProfileFamilyIntrinsicChip);
    expect(chips, findsNWidgets(5));
    for (final element in chips.evaluate()) {
      final box = element.renderObject! as RenderBox;
      expect(box.size.width, lessThan(180));
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets('interest controls meet 48px targets at 320px', (tester) async {
    await _expectInteractiveInterestTargets(tester, size: const Size(320, 800));
  });

  testWidgets('Arabic RTL interest controls meet 48px targets at 360px', (
    tester,
  ) async {
    await _expectInteractiveInterestTargets(
      tester,
      locale: const Locale('ar'),
      size: const Size(360, 800),
    );
  });

  testWidgets('scaled interest controls meet 48px targets at text scale 1.3', (
    tester,
  ) async {
    await _expectInteractiveInterestTargets(
      tester,
      size: const Size(360, 800),
      textScale: 1.3,
    );
  });
}

Future<void> _expectInteractiveInterestTargets(
  WidgetTester tester, {
  required Size size,
  Locale locale = const Locale('en'),
  double textScale = 1,
}) async {
  await _pumpPage(
    tester,
    locale: locale,
    size: size,
    textScale: textScale,
    user: _user(
      profile: const LearnerProfile(
        learnerType: 'University student',
        skillLevel: 'Intermediate',
        interests: [
          'arduino',
          'robotics',
          'sensors',
          'circuits',
          'displays',
          'woodworking',
        ],
      ),
    ),
  );

  final collapsedControl = find.byWidgetPredicate(
    (widget) =>
        widget is ProfileFamilyIntrinsicChip &&
        widget.onPressed != null &&
        widget.expanded == false,
  );
  _expectMinimumInteractiveChipTarget(
    tester,
    collapsedControl,
    expanded: false,
  );

  await tester.ensureVisible(collapsedControl);
  await tester.tap(collapsedControl);
  await tester.pumpAndSettle();

  final expandedControl = find.byWidgetPredicate(
    (widget) =>
        widget is ProfileFamilyIntrinsicChip &&
        widget.onPressed != null &&
        widget.expanded == true,
  );
  await tester.ensureVisible(expandedControl);
  _expectMinimumInteractiveChipTarget(tester, expandedControl, expanded: true);
  expect(tester.takeException(), isNull);
}

void _expectMinimumInteractiveChipTarget(
  WidgetTester tester,
  Finder chip, {
  required bool expanded,
}) {
  expect(chip, findsOneWidget);
  final chipSize = tester.getSize(chip);
  expect(chipSize.width, greaterThanOrEqualTo(48));
  expect(chipSize.height, greaterThanOrEqualTo(48));

  final semantics = find.descendant(
    of: chip,
    matching: find.byWidgetPredicate(
      (widget) => widget is Semantics && widget.properties.expanded != null,
    ),
  );
  expect(semantics, findsOneWidget);
  expect(tester.getRect(semantics), tester.getRect(chip));
  final semanticsWidget = tester.widget<Semantics>(semantics);
  expect(semanticsWidget.properties.button, isTrue);
  expect(semanticsWidget.properties.expanded, expanded);
  expect(
    find.descendant(of: chip, matching: find.byType(Material)),
    findsOneWidget,
  );
  expect(
    find.descendant(of: chip, matching: find.byType(InkWell)),
    findsOneWidget,
  );
}

Future<GoRouter> _pumpPage(
  WidgetTester tester, {
  required User user,
  Locale locale = const Locale('en'),
  Size size = const Size(400, 900),
  double textScale = 1,
  Brightness brightness = Brightness.light,
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
        theme: brightness == Brightness.dark ? AppTheme.dark : AppTheme.light,
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
