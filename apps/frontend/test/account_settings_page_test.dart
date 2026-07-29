import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/application/app_settings_notifier.dart';
import 'package:frontend/app/application/app_settings_storage.dart';
import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/profile/presentation/pages/account_settings_page.dart';
import 'package:frontend/features/profile/presentation/widgets/account_settings_widgets.dart';

void main() {
  test('role access resolution follows active-role eligibility', () {
    expect(resolveAccountRoleAccess(_user()).actions, [
      AccountRoleActionKind.becomeSupplier,
    ]);
    expect(
      resolveAccountRoleAccess(
        _user(
          roles: const ['LEARNER', 'SUPPLIER'],
          canSwitchToSupplier: true,
          supplierProfile: _supplierProfile(),
        ),
      ).actions,
      [AccountRoleActionKind.switchToSupplier],
    );
    expect(
      resolveAccountRoleAccess(
        _user(
          roles: const ['LEARNER', 'SUPPLIER'],
          activeRole: 'SUPPLIER',
          canSwitchToLearner: true,
          supplierProfile: _supplierProfile(),
        ),
      ).actions,
      [
        AccountRoleActionKind.supplierProfile,
        AccountRoleActionKind.switchToLearner,
      ],
    );
    expect(
      resolveAccountRoleAccess(
        _user(roles: const ['ADMIN'], activeRole: 'ADMIN'),
      ).isEmpty,
      isTrue,
    );
  });

  test('organization supplier resolution hides learner actions', () {
    final result = resolveAccountRoleAccess(
      _user(
        roles: const ['SUPPLIER'],
        activeRole: 'SUPPLIER',
        supplierProfile: const SupplierProfile(
          supplierType: 'WORKSHOP',
          publicName: 'Reuse University',
        ),
      ),
    );

    expect(result.actions, [AccountRoleActionKind.supplierProfile]);
    expect(result.showOrganizationRestriction, isTrue);
  });

  testWidgets('renders account identity, destinations, and verification', (
    tester,
  ) async {
    final observer = _ReadObserver();
    await _pumpAccount(tester, user: _user(), observer: observer);

    expect(find.text('Account and Settings'), findsOneWidget);
    expect(find.text('Test User'), findsOneWidget);
    expect(find.text('user@example.com'), findsOneWidget);
    expect(find.text('Learner'), findsOneWidget);
    expect(find.text('Active'), findsOneWidget);
    expect(find.text('Personal information'), findsOneWidget);
    expect(find.text('Saved locations'), findsOneWidget);
    expect(find.text('Security'), findsOneWidget);
    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Become a supplier'), findsOneWidget);
    expect(find.text('Verified'), findsNWidgets(2));
    expect(find.text('Logout'), findsOneWidget);

    expect(find.text('Notification preferences'), findsNothing);
    expect(find.text('Delete account'), findsNothing);
    expect(find.text('Two-factor authentication'), findsNothing);
    expect(observer.providers.where(_isForbiddenFeatureProvider), isEmpty);
    expect(tester.takeException(), isNull);
  });

  testWidgets('account destinations and notification inbox navigate', (
    tester,
  ) async {
    final harness = await _pumpAccount(tester, user: _user());

    await tester.tap(find.text('Personal information'));
    await tester.pumpAndSettle();
    expect(find.text('Edit route'), findsOneWidget);

    harness.router.go('/profile/account');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Saved locations'));
    await tester.pumpAndSettle();
    expect(find.text('Locations route'), findsOneWidget);

    harness.router.go('/profile/account');
    await tester.pumpAndSettle();
    await tester.tap(find.text('Security'));
    await tester.pumpAndSettle();
    expect(find.text('Security route'), findsOneWidget);

    harness.router.go('/profile/account');
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Notifications'));
    await tester.tap(find.text('Notifications'));
    await tester.pumpAndSettle();
    expect(find.text('Shared notifications route'), findsOneWidget);
  });

  testWidgets('supplier accounts use their existing inbox route', (
    tester,
  ) async {
    await _pumpAccount(
      tester,
      user: _user(
        roles: const ['SUPPLIER'],
        activeRole: 'SUPPLIER',
        supplierProfile: _supplierProfile(),
      ),
    );
    await tester.ensureVisible(find.text('Notifications'));
    await tester.tap(find.text('Notifications'));
    await tester.pumpAndSettle();
    expect(find.text('Supplier notifications route'), findsOneWidget);
  });

  testWidgets('driver accounts use their existing inbox route', (tester) async {
    await _pumpAccount(
      tester,
      user: _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
    );

    await tester.ensureVisible(find.text('Notifications'));
    await tester.tap(find.text('Notifications'));
    await tester.pumpAndSettle();

    expect(find.text('Driver notifications route'), findsOneWidget);
  });

  testWidgets('appearance and language update local settings and storage', (
    tester,
  ) async {
    final harness = await _pumpAccount(tester, user: _user());

    await tester.ensureVisible(find.text('Dark'));
    await tester.tap(find.text('Dark'));
    await tester.pumpAndSettle();
    expect(
      harness.container.read(appSettingsProvider).themeMode,
      ThemeMode.dark,
    );
    expect(await harness.storage.readThemeMode(), ThemeMode.dark);

    await tester.ensureVisible(find.text('Arabic'));
    await tester.tap(find.text('Arabic'));
    await tester.pumpAndSettle();
    expect(harness.container.read(appSettingsProvider).languageCode, 'ar');
    expect(await harness.storage.readLanguageCode(), 'ar');
    expect(find.text('الحساب والإعدادات'), findsOneWidget);
  });

  testWidgets('dual-role account switches through the shared portal flow', (
    tester,
  ) async {
    final controller = _TestAuthController(
      _user(
        roles: const ['LEARNER', 'SUPPLIER'],
        canSwitchToSupplier: true,
        supplierProfile: _supplierProfile(),
      ),
    );
    await _pumpAccount(tester, controller: controller);

    expect(find.text('Supplier profile'), findsNothing);
    await tester.ensureVisible(find.text('Switch to Supplier'));
    await tester.tap(find.text('Switch to Supplier'));
    await tester.pumpAndSettle();

    expect(controller.requestedRole, 'SUPPLIER');
    expect(find.text('Supplier overview route'), findsOneWidget);
  });

  testWidgets('portal switch failure stays on account page with local copy', (
    tester,
  ) async {
    final controller = _TestAuthController(
      _user(
        roles: const ['LEARNER', 'SUPPLIER'],
        canSwitchToSupplier: true,
        supplierProfile: _supplierProfile(),
      ),
      switchError: const ApiException(message: 'server message'),
    );
    await _pumpAccount(tester, controller: controller);

    await tester.ensureVisible(find.text('Switch to Supplier'));
    await tester.tap(find.text('Switch to Supplier'));
    await tester.pumpAndSettle();

    expect(find.byType(AccountSettingsPage), findsOneWidget);
    expect(
      find.text('Could not switch portals. Please try again.'),
      findsOneWidget,
    );
  });

  testWidgets('confirmed logout success opens login without warning', (
    tester,
  ) async {
    final controller = _TestAuthController(_user());
    await _pumpAccount(tester, controller: controller);

    await tester.ensureVisible(find.text('Logout'));
    await tester.tap(find.text('Logout'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log out').last);
    await tester.pumpAndSettle();

    expect(controller.logoutCalls, 1);
    expect(find.text('Login route'), findsOneWidget);
    expect(
      find.text(
        'You were signed out locally, but the server could not be reached.',
      ),
      findsNothing,
    );
  });

  testWidgets('logout requires confirmation and handles local-only success', (
    tester,
  ) async {
    final controller = _TestAuthController(
      _user(),
      logoutError: const ApiException(message: 'offline'),
    );
    await _pumpAccount(tester, controller: controller);

    await tester.ensureVisible(find.text('Logout'));
    await tester.tap(find.text('Logout'));
    await tester.pumpAndSettle();
    expect(find.text('Log out of ImpactLoop?'), findsOneWidget);

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(controller.logoutCalls, 0);

    await tester.tap(find.text('Logout'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Log out').last);
    await tester.pumpAndSettle();

    expect(controller.logoutCalls, 1);
    expect(find.text('Login route'), findsOneWidget);
    expect(
      find.text(
        'You were signed out locally, but the server could not be reached.',
      ),
      findsOneWidget,
    );
  });

  testWidgets('missing and unverified contact states are read-only', (
    tester,
  ) async {
    await _pumpAccount(
      tester,
      user: _user(phone: null, emailVerified: false, phoneVerified: false),
    );

    expect(find.text('Not verified'), findsOneWidget);
    expect(find.text('Not added'), findsNWidgets(2));
    expect(find.text('Verify email'), findsNothing);
    expect(find.text('Verify phone'), findsNothing);
  });

  testWidgets('Arabic account page is RTL and stable at 320px with scaling', (
    tester,
  ) async {
    final harness = await _pumpAccount(
      tester,
      user: _user(),
      size: const Size(320, 760),
      textScaler: const TextScaler.linear(2),
    );
    harness.container.read(appSettingsProvider.notifier).setLanguageCode('ar');
    await tester.pumpAndSettle();

    expect(find.text('الحساب والإعدادات'), findsOneWidget);
    expect(
      Directionality.of(tester.element(find.text('الحساب والإعدادات'))),
      TextDirection.rtl,
    );
    expect(
      Directionality.of(tester.element(find.text('user@example.com').first)),
      TextDirection.ltr,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('account page is constrained across responsive widths', (
    tester,
  ) async {
    for (final width in [360.0, 430.0, 800.0]) {
      await _pumpAccount(tester, user: _user(), size: Size(width, 1200));

      final hero = tester.renderObject<RenderBox>(
        find.byType(AccountIdentitySummaryCard),
      );
      expect(hero.size.width, lessThanOrEqualTo(720));
      expect(tester.takeException(), isNull);
    }
  });
}

Future<_Harness> _pumpAccount(
  WidgetTester tester, {
  User? user,
  _TestAuthController? controller,
  ProviderObserver? observer,
  Size size = const Size(400, 900),
  TextScaler textScaler = TextScaler.noScaling,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  final authController = controller ?? _TestAuthController(user ?? _user());
  final storage = MemoryAppSettingsStorage();
  final router = GoRouter(
    initialLocation: '/profile/account',
    routes: [
      GoRoute(
        path: '/profile/account',
        builder: (_, _) => const AccountSettingsPage(),
      ),
      _stub('/profile', 'Profile route'),
      _stub('/profile/edit', 'Edit route'),
      _stub('/profile/locations', 'Locations route'),
      _stub('/profile/security', 'Security route'),
      _stub('/notifications', 'Shared notifications route'),
      _stub('/supplier/notifications', 'Supplier notifications route'),
      _stub('/driver/notifications', 'Driver notifications route'),
      _stub('/supplier/profile', 'Supplier profile route'),
      _stub('/supplier/overview', 'Supplier overview route'),
      _stub('/become-supplier', 'Become supplier route'),
      _stub('/become-learner', 'Become learner route'),
      _stub('/home', 'Home route'),
      _stub('/login', 'Login route'),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      observers: [?observer],
      overrides: [
        authControllerProvider.overrideWith(() => authController),
        appSettingsStorageProvider.overrideWithValue(storage),
      ],
      child: _SettingsAwareTestApp(router: router, textScaler: textScaler),
    ),
  );
  await tester.pumpAndSettle();

  final container = ProviderScope.containerOf(
    tester.element(find.byType(AccountSettingsPage)),
  );
  return _Harness(router: router, container: container, storage: storage);
}

GoRoute _stub(String path, String label) {
  return GoRoute(
    path: path,
    builder: (_, _) => Scaffold(body: Center(child: Text(label))),
  );
}

class _SettingsAwareTestApp extends ConsumerWidget {
  const _SettingsAwareTestApp({required this.router, required this.textScaler});

  final GoRouter router;
  final TextScaler textScaler;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(appSettingsProvider);
    return MaterialApp.router(
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: settings.themeMode,
      locale: Locale(settings.languageCode),
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(textScaler: textScaler),
        child: child!,
      ),
      routerConfig: router,
    );
  }
}

class _Harness {
  const _Harness({
    required this.router,
    required this.container,
    required this.storage,
  });

  final GoRouter router;
  final ProviderContainer container;
  final MemoryAppSettingsStorage storage;
}

class _TestAuthController extends AuthController {
  _TestAuthController(this.initialUser, {this.logoutError, this.switchError});

  final User initialUser;
  final ApiException? logoutError;
  final ApiException? switchError;
  String? requestedRole;
  int logoutCalls = 0;

  @override
  AuthState build() => AuthState(
    user: initialUser,
    accessToken: 'test-access',
    hasBootstrapped: true,
  );

  @override
  Future<User> switchActiveRole(String activeRole) async {
    requestedRole = activeRole;
    if (switchError != null) {
      throw switchError!;
    }
    return _user(
      roles: initialUser.roles,
      activeRole: activeRole,
      canSwitchToLearner: true,
      canSwitchToSupplier: true,
      supplierProfile: initialUser.supplierProfile,
    );
  }

  @override
  Future<ApiException?> logout() async {
    logoutCalls++;
    state = const AuthState(isLoading: false, hasBootstrapped: true);
    return logoutError;
  }
}

final class _ReadObserver extends ProviderObserver {
  final providers = <String>[];

  @override
  void didAddProvider(ProviderObserverContext context, Object? value) {
    providers.add(context.provider.toString());
  }
}

bool _isForbiddenFeatureProvider(String description) {
  final normalized = description.toLowerCase();
  return normalized.contains('learnerhome') ||
      normalized.contains('reservation') ||
      normalized.contains('learningproject') ||
      normalized.contains('materialdiscovery') ||
      normalized.contains('notificationslist') ||
      normalized.contains('unreadcount') ||
      normalized.contains('savedlocations') ||
      normalized.contains('impact');
}

SupplierProfile _supplierProfile() => const SupplierProfile(
  supplierType: 'INDIVIDUAL_SUPPLIER',
  publicName: 'Reuse Lab',
);

User _user({
  List<String> roles = const ['LEARNER'],
  String activeRole = 'LEARNER',
  bool canSwitchToLearner = false,
  bool canSwitchToSupplier = false,
  bool canBecomeLearner = false,
  SupplierProfile? supplierProfile,
  String? phone = '+970 599 000 000',
  bool emailVerified = true,
  bool phoneVerified = true,
}) {
  return User(
    id: 'user-1',
    displayName: 'Test User',
    email: 'user@example.com',
    phone: phone,
    accountStatus: 'ACTIVE',
    roles: roles,
    activeRole: activeRole,
    canSwitchToLearner: canSwitchToLearner,
    canSwitchToSupplier: canSwitchToSupplier,
    canBecomeLearner: canBecomeLearner,
    supplierProfile: supplierProfile,
    emailVerifiedAt: emailVerified ? DateTime(2026, 1, 1) : null,
    phoneVerifiedAt: phoneVerified ? DateTime(2026, 1, 1) : null,
    createdAt: DateTime(2026),
  );
}
