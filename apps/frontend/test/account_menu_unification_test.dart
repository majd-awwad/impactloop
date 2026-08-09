import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/widgets/entry_nav_bar.dart';
import 'package:frontend/features/admin_portal/presentation/widgets/admin_profile_button.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/application/portal_navigation.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/driver_portal/presentation/shell/driver_portal_shell.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/features/supplier_portal/presentation/shell/supplier_profile_popover.dart';
import 'package:frontend/features/supplier_portal/presentation/widgets/supplier_portal_avatar.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/l10n/app_localizations_ar.dart';
import 'package:frontend/l10n/app_localizations_en.dart';
import 'package:frontend/shared/widgets/app_account_menu.dart';
import 'package:frontend/shared/widgets/user_avatar.dart';

void main() {
  group('activePortalModeLabel', () {
    final en = AppLocalizationsEn();
    final ar = AppLocalizationsAr();

    test('returns role-accurate English labels', () {
      expect(
        activePortalModeLabel(
          _user(roles: const ['LEARNER'], activeRole: 'LEARNER'),
          en,
        ),
        'Learner mode',
      );
      expect(
        activePortalModeLabel(
          _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
          en,
        ),
        'Supplier mode',
      );
      expect(
        activePortalModeLabel(
          _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
          en,
        ),
        'Driver mode',
      );
      expect(
        activePortalModeLabel(
          _user(roles: const ['ADMIN'], activeRole: 'ADMIN'),
          en,
        ),
        'Admin mode',
      );
      expect(
        activePortalModeLabel(
          _user(roles: const ['MODERATOR'], activeRole: 'MODERATOR'),
          en,
        ),
        'Moderator mode',
      );
    });

    test('returns role-accurate Arabic labels', () {
      expect(
        activePortalModeLabel(
          _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
          ar,
        ),
        'وضع السائق',
      );
      expect(
        activePortalModeLabel(
          _user(roles: const ['SUPPLIER'], activeRole: 'SUPPLIER'),
          ar,
        ),
        'وضع المورد',
      );
    });
  });

  testWidgets(
    'supplier account menu keeps reference actions and layout shell',
    (tester) async {
      await _pumpPage(
        tester,
        user: _user(
          roles: const ['SUPPLIER'],
          activeRole: 'SUPPLIER',
          supplierProfile: const SupplierProfile(
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: 'Reuse Supplier',
          ),
        ),
        child: const Scaffold(
          body: Center(
            child: SupplierProfileButton(
              displayName: 'Reuse Supplier',
              email: 'supplier@example.com',
              verificationStatus: 'VERIFIED',
            ),
          ),
        ),
      );

      await tester.tap(find.byType(SupplierPortalAvatar));
      await tester.pumpAndSettle();

      expect(find.byType(AppAccountMenuPanel), findsOneWidget);
      expect(find.byType(Dialog), findsOneWidget);
      expect(find.text('Reuse Supplier'), findsWidgets);
      expect(find.text('supplier@example.com'), findsOneWidget);
      expect(find.text('Supplier mode'), findsOneWidget);
      expect(find.text('View supplier profile'), findsOneWidget);
      expect(find.text('Account and Settings'), findsOneWidget);
      expect(find.text('Logout'), findsOneWidget);
      expect(find.text('Theme'), findsNothing);
      expect(find.text('Language'), findsNothing);
    },
  );

  testWidgets(
    'learner account menu uses supplier-style panel and learner actions',
    (tester) async {
      await _pumpPage(
        tester,
        user: _user(roles: const ['LEARNER'], activeRole: 'LEARNER'),
        size: const Size(900, 760),
        child: const Scaffold(
          body: EntryNavBar(
            showSignIn: false,
            showCreateAccount: false,
            homeRoute: '/home',
          ),
        ),
      );

      await tester.tap(find.byType(UserAvatar).first);
      await tester.pumpAndSettle();

      expect(find.byType(AppAccountMenuPanel), findsOneWidget);
      expect(find.byType(Dialog), findsOneWidget);
      expect(find.text('Learner mode'), findsOneWidget);
      expect(find.text('Profile'), findsOneWidget);
      expect(find.text('Account and Settings'), findsOneWidget);
      expect(find.text('My reservations'), findsOneWidget);
      expect(find.text('Material requests'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Become a supplier'), findsOneWidget);
      expect(find.text('Logout'), findsOneWidget);
      // Theme/Language live in top nav on desktop widths.
      expect(find.text('Settings'), findsNothing);
    },
  );

  testWidgets('driver account menu shows Driver mode not Learner mode', (
    tester,
  ) async {
    await _pumpPage(
      tester,
      user: _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
      size: const Size(900, 760),
      child: const DriverPortalShell(child: Center(child: Text('Driver jobs'))),
    );

    await tester.tap(find.byType(UserAvatar).first);
    await tester.pumpAndSettle();

    expect(find.byType(AppAccountMenuPanel), findsOneWidget);
    expect(find.text('Driver mode'), findsOneWidget);
    expect(find.text('Learner mode'), findsNothing);
    expect(
      find.descendant(
        of: find.byType(AppAccountMenuPanel),
        matching: find.text('Driver Profile'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(AppAccountMenuPanel),
        matching: find.text('Profile'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(AppAccountMenuPanel),
        matching: find.text('Account and Settings'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(AppAccountMenuPanel),
        matching: find.text('Notifications'),
      ),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: find.byType(AppAccountMenuPanel),
        matching: find.text('Logout'),
      ),
      findsOneWidget,
    );
  });

  testWidgets(
    'admin account menu opens anchored dialog instead of bottom sheet',
    (tester) async {
      await _pumpPage(
        tester,
        user: _user(roles: const ['ADMIN'], activeRole: 'ADMIN'),
        size: const Size(1100, 800),
        child: const Scaffold(
          body: Center(
            child: AdminProfileButton(
              displayName: 'Admin User',
              email: 'admin@example.com',
            ),
          ),
        ),
      );

      await tester.tap(find.text('Admin User'));
      await tester.pumpAndSettle();

      expect(find.byType(AppAccountMenuPanel), findsOneWidget);
      expect(find.byType(Dialog), findsOneWidget);
      expect(find.byType(BottomSheet), findsNothing);
      expect(find.text('Admin mode'), findsOneWidget);
      expect(find.text('Account and Settings'), findsOneWidget);
      expect(find.text('Logout'), findsOneWidget);
    },
  );

  testWidgets('account menus honor RTL Arabic mode labels', (tester) async {
    await _pumpPage(
      tester,
      user: _user(roles: const ['DRIVER'], activeRole: 'DRIVER'),
      size: const Size(900, 760),
      locale: const Locale('ar'),
      child: const Scaffold(
        body: EntryNavBar(
          showSignIn: false,
          showCreateAccount: false,
          homeRoute: '/driver',
          showPublicNavLinks: false,
        ),
      ),
    );

    await tester.tap(find.byType(UserAvatar).first);
    await tester.pumpAndSettle();

    expect(find.text('وضع السائق'), findsOneWidget);
    expect(find.text('Learner mode'), findsNothing);
    expect(find.text('تسجيل الخروج'), findsOneWidget);

    final dialog = tester.widget<Dialog>(find.byType(Dialog));
    expect(dialog.alignment, AlignmentDirectional.topEnd);
  });
}

Future<void> _pumpPage(
  WidgetTester tester, {
  required User user,
  required Widget child,
  Size size = const Size(800, 700),
  Locale locale = const Locale('en'),
}) async {
  await tester.binding.setSurfaceSize(size);
  addTearDown(() => tester.binding.setSurfaceSize(null));

  final router = GoRouter(
    initialLocation: '/test',
    routes: [
      GoRoute(path: '/test', builder: (context, state) => child),
      GoRoute(
        path: '/profile/account',
        builder: (context, state) =>
            const Scaffold(body: Text('Account settings destination')),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const Scaffold(body: Text('Login')),
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
        locale: locale,
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
}

User _user({
  required List<String> roles,
  required String activeRole,
  SupplierProfile? supplierProfile,
}) {
  return User(
    id: 'user-1',
    displayName: activeRole == 'ADMIN' ? 'Admin User' : 'Portal User',
    email: '${activeRole.toLowerCase()}@example.com',
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
