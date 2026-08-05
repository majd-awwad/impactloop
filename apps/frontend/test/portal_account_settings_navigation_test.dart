import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/widgets/entry_nav_bar.dart';
import 'package:frontend/features/admin_portal/presentation/widgets/admin_profile_button.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/application/auth_route_helpers.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/driver_portal/presentation/shell/driver_portal_shell.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/shell/supplier_profile_popover.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/supplier_portal_avatar.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/widgets/user_avatar.dart';

void main() {
  testWidgets(
    'supplier profile menu keeps Supplier Profile and opens account settings',
    (tester) async {
      final user = _user(
        roles: const ['SUPPLIER'],
        activeRole: 'SUPPLIER',
        supplierProfile: const SupplierProfile(
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: 'Reuse Supplier',
        ),
      );
      final router = await _pumpRouter(
        tester,
        user: user,
        startPath: '/supplier/menu-test',
        startPage: const Scaffold(
          body: Center(
            child: SupplierProfileButton(
              displayName: 'Reuse Supplier',
              email: 'account@example.com',
              verificationStatus: 'VERIFIED',
            ),
          ),
        ),
      );

      await tester.tap(find.byType(SupplierPortalAvatar));
      await tester.pumpAndSettle();

      expect(find.text('View supplier profile'), findsOneWidget);
      expect(find.text('Account and Settings'), findsOneWidget);

      await tester.tap(find.text('Account and Settings'));
      await tester.pumpAndSettle();

      expect(
        router.routeInformationProvider.value.uri.path,
        accountSettingsRoute,
      );
      expect(find.text('Account settings destination'), findsOneWidget);
    },
  );

  testWidgets('driver portal account menu opens account settings once', (
    tester,
  ) async {
    final router = await _pumpRouter(
      tester,
      user: _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
      startPath: '/driver/jobs',
      startPage: const DriverPortalShell(
        child: Center(child: Text('Driver jobs')),
      ),
      size: const Size(900, 760),
    );

    await tester.tap(find.byType(UserAvatar));
    await tester.pumpAndSettle();

    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('Account and Settings'), findsOneWidget);

    await tester.tap(find.text('Account and Settings'));
    await tester.pumpAndSettle();

    expect(
      router.routeInformationProvider.value.uri.path,
      accountSettingsRoute,
    );
  });

  testWidgets(
    'Driver Account Settings push keeps back path to /driver/profile',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(1100, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final rootNavigatorKey = GlobalKey<NavigatorState>();
      GoRouter.optionURLReflectsImperativeAPIs = true;
      final router = GoRouter(
        navigatorKey: rootNavigatorKey,
        initialLocation: '/driver/profile',
        routes: [
          ShellRoute(
            builder: (context, state, child) => child,
            routes: [
              GoRoute(
                path: '/driver/profile',
                builder: (context, _) => Scaffold(
                  body: Center(
                    child: TextButton(
                      onPressed: () => context.push(accountSettingsRoute),
                      child: const Text('Open account'),
                    ),
                  ),
                ),
              ),
            ],
          ),
          GoRoute(
            path: accountSettingsRoute,
            parentNavigatorKey: rootNavigatorKey,
            builder: (context, _) => Scaffold(
              body: Column(
                children: [
                  const Text('Account settings destination'),
                  TextButton(
                    onPressed: () => context.pop(),
                    child: const Text('Back from account'),
                  ),
                ],
              ),
            ),
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              () => _TestAuthController(
                _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
              ),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              _ZeroUnreadCountNotifier.new,
            ),
            supplierNotificationsUnreadCountProvider.overrideWith(
              _ZeroSupplierUnreadCountNotifier.new,
            ),
          ],
          child: MaterialApp.router(
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            routerConfig: router,
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open account'));
      await tester.pumpAndSettle();
      expect(find.text('Account settings destination'), findsOneWidget);
      expect(
        router.routeInformationProvider.value.uri.path,
        accountSettingsRoute,
      );

      await tester.tap(find.text('Back from account'));
      await tester.pumpAndSettle();
      expect(find.text('Open account'), findsOneWidget);
      expect(router.routeInformationProvider.value.uri.path, '/driver/profile');
    },
  );

  testWidgets('admin profile menu opens account settings once', (tester) async {
    final router = await _pumpRouter(
      tester,
      user: _user(roles: const ['ADMIN'], activeRole: 'ADMIN'),
      startPath: '/admin/menu-test',
      startPage: const Scaffold(
        body: Center(
          child: AdminProfileButton(
            displayName: 'Admin User',
            email: 'account@example.com',
          ),
        ),
      ),
    );

    await tester.tap(find.text('Admin User'));
    await tester.pumpAndSettle();

    expect(find.text('Account and Settings'), findsOneWidget);

    await tester.tap(find.text('Account and Settings'));
    await tester.pumpAndSettle();

    expect(
      router.routeInformationProvider.value.uri.path,
      accountSettingsRoute,
    );
  });

  testWidgets('moderator shared account menu opens account settings once', (
    tester,
  ) async {
    final router = await _pumpRouter(
      tester,
      user: _user(roles: const ['MODERATOR'], activeRole: 'MODERATOR'),
      startPath: '/home',
      startPage: const Scaffold(
        body: EntryNavBar(
          showSignIn: false,
          showCreateAccount: false,
          homeRoute: '/home',
        ),
      ),
      size: const Size(900, 760),
    );

    await tester.tap(find.byType(UserAvatar));
    await tester.pumpAndSettle();

    expect(find.text('Profile'), findsOneWidget);
    expect(find.text('Account and Settings'), findsOneWidget);

    await tester.tap(find.text('Account and Settings'));
    await tester.pumpAndSettle();

    expect(
      router.routeInformationProvider.value.uri.path,
      accountSettingsRoute,
    );
  });
}

Future<GoRouter> _pumpRouter(
  WidgetTester tester, {
  required User user,
  required String startPath,
  required Widget startPage,
  Size size = const Size(800, 700),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  final router = GoRouter(
    initialLocation: startPath,
    routes: [
      GoRoute(path: startPath, builder: (context, state) => startPage),
      GoRoute(
        path: accountSettingsRoute,
        builder: (context, state) => const Scaffold(
          body: Center(child: Text('Account settings destination')),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => _TestAuthController(user)),
        myNotificationUnreadCountProvider.overrideWith(
          _ZeroUnreadCountNotifier.new,
        ),
        supplierNotificationsUnreadCountProvider.overrideWith(
          _ZeroSupplierUnreadCountNotifier.new,
        ),
      ],
      child: MaterialApp.router(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        routerConfig: router,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

User _user({
  required List<String> roles,
  required String activeRole,
  SupplierProfile? supplierProfile,
}) {
  return User(
    id: 'user-1',
    displayName: activeRole == 'ADMIN' ? 'Admin User' : 'Portal User',
    email: 'account@example.com',
    accountStatus: 'ACTIVE',
    roles: roles,
    activeRole: activeRole,
    supplierProfile: supplierProfile,
    createdAt: DateTime(2026),
  );
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

class _ZeroUnreadCountNotifier extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}

class _ZeroSupplierUnreadCountNotifier
    extends SupplierNotificationsUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}
