import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/profile/presentation/pages/profile_page.dart';
import 'package:frontend/features/profile/presentation/widgets/learner_profile_hub_widgets.dart';
import 'package:frontend/shared/widgets/user_avatar.dart';

void main() {
  testWidgets('learner-only profile renders compact authenticated-user data', (
    tester,
  ) async {
    final observer = _ProviderReadObserver();
    await _pumpProfile(
      tester,
      user: _testUser(phone: '+970 599 000 000'),
      observer: observer,
    );

    expect(find.text('Learner User'), findsWidgets);
    expect(find.text('learner@example.com'), findsWidgets);
    expect(find.text('+970 599 000 000'), findsOneWidget);
    expect(find.byType(UserAvatar), findsOneWidget);
    expect(find.text('Learner'), findsOneWidget);
    expect(find.text('Active'), findsOneWidget);
    expect(find.byType(AccountVerificationNotice), findsNothing);
    expect(find.text('University student'), findsOneWidget);
    expect(find.text('Beginner'), findsOneWidget);
    expect(find.text('Robotics'), findsOneWidget);
    expect(
      find.text('Building useful projects with reused parts.'),
      findsOneWidget,
    );
    expect(find.byType(LearnerProfileActionPrompt), findsNothing);
    expect(find.textContaining('%'), findsNothing);
    expect(find.textContaining('CO₂'), findsNothing);
    expect(find.textContaining('kilogram'), findsNothing);
    expect(find.text('Journey'), findsNothing);
    expect(find.text('Impact'), findsNothing);
    expect(find.text('Achievements'), findsNothing);
    expect(find.text('Points'), findsNothing);
    expect(find.text('Streaks'), findsNothing);
    expect(find.text('Become a supplier'), findsOneWidget);
    expect(
      observer.addedProviderDescriptions.where(_isForbiddenFeatureProvider),
      isEmpty,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('unverified email shows one subordinate account notice', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      user: _testUser(emailVerified: false, phoneVerified: false),
    );

    expect(find.byType(AccountVerificationNotice), findsOneWidget);
    expect(find.text('Email not verified'), findsOneWidget);
    expect(find.text('Phone not verified'), findsNothing);
    expect(find.text('Active'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('missing-phone notice uses the existing profile edit route', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      user: _testUser(phone: null, emailVerified: true, phoneVerified: false),
    );

    expect(find.byType(AccountVerificationNotice), findsOneWidget);
    expect(find.text('Add a phone number'), findsOneWidget);
    expect(find.text('Add phone'), findsOneWidget);

    await tester.tap(find.text('Add phone'));
    await tester.pumpAndSettle();
    expect(find.text('Edit profile route'), findsOneWidget);
  });

  testWidgets('empty learner profile shows exactly one setup prompt', (
    tester,
  ) async {
    await _pumpProfile(tester, user: _testUser(learnerProfile: null));

    expect(find.byType(LearnerProfileActionPrompt), findsOneWidget);
    expect(find.text('Set up your learning profile'), findsOneWidget);
    expect(
      find.text('Your supported learning details will appear here.'),
      findsOneWidget,
    );
    expect(find.textContaining('%'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('partial profile prioritizes one interests prompt', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      user: _testUser(
        learnerProfile: const LearnerProfile(
          learnerType: '',
          skillLevel: '',
          interests: [],
        ),
      ),
    );

    expect(find.byType(LearnerProfileActionPrompt), findsOneWidget);
    expect(find.text('Add your interests'), findsOneWidget);
    expect(find.text('Add your learning details'), findsNothing);
    expect(find.text('Add a short bio'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('missing type and level produce one learning-details prompt', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      user: _testUser(
        learnerProfile: const LearnerProfile(
          learnerType: ' ',
          skillLevel: '',
          interests: ['robotics'],
        ),
      ),
    );

    expect(find.byType(LearnerProfileActionPrompt), findsOneWidget);
    expect(find.text('Add your learning details'), findsOneWidget);
    expect(find.text('Add your learner type and skill level.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('missing optional bio is not presented as incomplete', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      user: _testUser(
        learnerProfile: const LearnerProfile(
          learnerType: 'University student',
          skillLevel: 'Beginner',
          interests: ['robotics'],
        ),
      ),
    );

    expect(find.byType(LearnerProfileActionPrompt), findsNothing);
    expect(find.text('Add a short bio'), findsOneWidget);
    expect(find.textContaining('complete'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('dual-role learner-active profile preserves supplier actions', (
    tester,
  ) async {
    final controller = _TestAuthController(
      _testUser(
        roles: const ['LEARNER', 'SUPPLIER'],
        activeRole: 'LEARNER',
        canSwitchToSupplier: true,
        supplierProfile: const SupplierProfile(
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: 'Reuse Lab',
        ),
      ),
    );
    final router = await _pumpProfile(tester, controller: controller);

    expect(find.text('Supplier profile'), findsOneWidget);
    expect(find.text('Switch to Supplier'), findsOneWidget);

    await tester.ensureVisible(find.text('Supplier profile'));
    await _tapDestinationTile(tester, 'Supplier profile');
    await tester.pumpAndSettle();
    expect(find.text('Supplier profile route'), findsOneWidget);

    router.go('/profile');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Switch to Supplier'));
    await _tapDestinationTile(tester, 'Switch to Supplier');
    await tester.pumpAndSettle();
    expect(controller.lastRequestedRole, 'SUPPLIER');
    expect(find.text('Supplier overview route'), findsOneWidget);
  });

  testWidgets('account launcher preserves existing account-action access', (
    tester,
  ) async {
    await _pumpProfile(tester, user: _testUser());

    await tester.ensureVisible(find.text('Account and Settings'));
    await _tapDestinationTile(tester, 'Account and Settings');
    await tester.pumpAndSettle();

    expect(find.text('Personal information'), findsOneWidget);
    expect(find.text('Saved locations'), findsOneWidget);
    expect(find.text('Security'), findsOneWidget);
    expect(find.text('Appearance'), findsOneWidget);
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('Logout'), findsOneWidget);

    await _tapDestinationTile(tester, 'Personal information');
    await tester.pumpAndSettle();
    expect(find.text('Edit profile route'), findsOneWidget);
  });

  testWidgets('Arabic hub is RTL and stable at 320px', (tester) async {
    await _pumpProfile(
      tester,
      user: _testUser(
        phone: '+970 599 000 000',
        emailVerified: false,
        phoneVerified: false,
      ),
      locale: const Locale('ar'),
      size: const Size(320, 760),
    );

    expect(find.text('الملف الشخصي'), findsOneWidget);
    expect(find.text('متعلّم'), findsOneWidget);
    expect(find.text('طالب جامعي'), findsOneWidget);
    expect(find.text('مبتدئ'), findsOneWidget);
    expect(find.text('الروبوتات'), findsOneWidget);
    expect(find.text('البريد الإلكتروني غير موثّق'), findsOneWidget);
    expect(find.byType(AccountVerificationNotice), findsOneWidget);
    expect(find.text('نشط'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('متعلّم'))),
      TextDirection.rtl,
    );
    expect(
      Directionality.of(tester.element(find.text('learner@example.com'))),
      TextDirection.ltr,
    );
    expect(
      Directionality.of(tester.element(find.text('+970 599 000 000'))),
      TextDirection.ltr,
    );
    expect(tester.takeException(), isNull);
  });
}

Future<void> _tapDestinationTile(WidgetTester tester, String title) async {
  final inkWell = find.ancestor(
    of: find.text(title),
    matching: find.byType(InkWell),
  );
  expect(inkWell, findsOneWidget);
  await tester.ensureVisible(inkWell);
  await tester.pumpAndSettle();
  tester.widget<InkWell>(inkWell).onTap?.call();
}

Future<GoRouter> _pumpProfile(
  WidgetTester tester, {
  User? user,
  _TestAuthController? controller,
  Locale locale = const Locale('en'),
  Size size = const Size(400, 900),
  ProviderObserver? observer,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  final authController = controller ?? _TestAuthController(user ?? _testUser());
  final router = GoRouter(
    initialLocation: '/profile',
    routes: [
      GoRoute(path: '/profile', builder: (_, _) => const ProfilePage()),
      GoRoute(
        path: '/profile/edit',
        builder: (_, _) => const Scaffold(body: Text('Edit profile route')),
      ),
      GoRoute(
        path: '/profile/learner/edit',
        builder: (_, _) => const Scaffold(body: Text('Learning edit route')),
      ),
      GoRoute(
        path: '/profile/locations',
        builder: (_, _) => const Scaffold(body: Text('Locations route')),
      ),
      GoRoute(
        path: '/profile/security',
        builder: (_, _) => const Scaffold(body: Text('Security route')),
      ),
      GoRoute(
        path: '/supplier/profile',
        builder: (_, _) => const Scaffold(body: Text('Supplier profile route')),
      ),
      GoRoute(
        path: '/supplier/overview',
        builder: (_, _) =>
            const Scaffold(body: Text('Supplier overview route')),
      ),
      GoRoute(
        path: '/become-supplier',
        builder: (_, _) => const Scaffold(body: Text('Become supplier route')),
      ),
      GoRoute(
        path: '/login',
        builder: (_, _) => const Scaffold(body: Text('Login route')),
      ),
      GoRoute(
        path: '/home',
        builder: (_, _) => const Scaffold(body: Text('Home route')),
      ),
      GoRoute(
        path: '/materials',
        builder: (_, _) => const Scaffold(body: Text('Materials route')),
      ),
      GoRoute(
        path: '/learning',
        builder: (_, _) => const Scaffold(body: Text('Learning route')),
      ),
      GoRoute(
        path: '/learner/reservations',
        builder: (_, _) => const Scaffold(body: Text('Reservations route')),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      observers: [?observer],
      overrides: [authControllerProvider.overrideWith(() => authController)],
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
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

class _TestAuthController extends AuthController {
  _TestAuthController(this.user);

  final User user;
  String? lastRequestedRole;

  @override
  AuthState build() {
    return AuthState(
      user: user,
      accessToken: 'test-access',
      hasBootstrapped: true,
    );
  }

  @override
  Future<User> switchActiveRole(String activeRole) async {
    lastRequestedRole = activeRole;
    return User(
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      phone: user.phone,
      accountStatus: user.accountStatus,
      profileImageUrl: user.profileImageUrl,
      roles: user.roles,
      activeRole: activeRole,
      canSwitchToLearner: true,
      canSwitchToSupplier: user.canSwitchToSupplier,
      supplierProfile: user.supplierProfile,
      learnerProfile: user.learnerProfile,
      createdAt: user.createdAt,
    );
  }
}

final class _ProviderReadObserver extends ProviderObserver {
  final addedProviderDescriptions = <String>[];

  @override
  void didAddProvider(ProviderObserverContext context, Object? value) {
    addedProviderDescriptions.add(context.provider.toString());
  }
}

bool _isForbiddenFeatureProvider(String description) {
  final normalized = description.toLowerCase();
  return normalized.contains('learnerhome') ||
      normalized.contains('reservation') ||
      normalized.contains('learningproject') ||
      normalized.contains('materialdiscovery') ||
      normalized.contains('notification') ||
      normalized.contains('impact');
}

User _testUser({
  LearnerProfile? learnerProfile = const LearnerProfile(
    learnerType: 'University student',
    skillLevel: 'Beginner',
    interests: ['robotics'],
    bio: 'Building useful projects with reused parts.',
  ),
  List<String> roles = const ['LEARNER'],
  String activeRole = 'LEARNER',
  bool canSwitchToSupplier = false,
  SupplierProfile? supplierProfile,
  String? phone = '+970 599 000 000',
  bool emailVerified = true,
  bool phoneVerified = true,
}) {
  return User(
    id: 'user-1',
    displayName: 'Learner User',
    email: 'learner@example.com',
    phone: phone,
    accountStatus: 'ACTIVE',
    roles: roles,
    activeRole: activeRole,
    canSwitchToSupplier: canSwitchToSupplier,
    learnerProfile: learnerProfile,
    supplierProfile: supplierProfile,
    emailVerifiedAt: emailVerified ? DateTime(2026, 1, 2) : null,
    phoneVerifiedAt: phoneVerified ? DateTime(2026, 1, 2) : null,
    createdAt: DateTime(2026),
  );
}
