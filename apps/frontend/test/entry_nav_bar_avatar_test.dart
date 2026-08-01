import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/widgets/entry_nav_bar.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';
import 'package:frontend/features/supplier_portal/presentation/controllers/supplier_notifications_providers.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:frontend/shared/widgets/user_avatar.dart';

void main() {
  testWidgets(
    'account menu shows profile image avatar when profileImageUrl is set',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              () => _TestAuthController(
                User(
                  id: 'user-1',
                  displayName: 'Learner User',
                  email: 'learner@example.com',
                  accountStatus: 'ACTIVE',
                  profileImageUrl: '/uploads/profiles/profile_test.webp',
                  roles: const ['LEARNER'],
                  createdAt: DateTime(2026),
                ),
              ),
            ),
            myNotificationUnreadCountProvider.overrideWith(
              _ZeroUnreadCountNotifier.new,
            ),
            supplierNotificationsUnreadCountProvider.overrideWith(
              _ZeroSupplierUnreadCountNotifier.new,
            ),
          ],
          child: MaterialApp(
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: const Scaffold(
              body: EntryNavBar(
                showSignIn: false,
                showCreateAccount: false,
                homeRoute: '/home',
              ),
            ),
          ),
        ),
      );

      await tester.pump();

      expect(find.byType(Image), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('learner mode dual-role menu shows switch supplier only once', (
    tester,
  ) async {
    await _pumpEntryNavBar(tester, _dualRoleUser(activeRole: 'LEARNER'));

    await tester.tap(find.byType(UserAvatar).first);
    await tester.pumpAndSettle();

    expect(find.text('My reservations'), findsOneWidget);
    expect(find.text('Switch to Supplier'), findsOneWidget);
    expect(find.text('Become a supplier'), findsNothing);
    expect(find.text('Supplier dashboard'), findsNothing);
  });

  testWidgets(
    'supplier mode dual-role menu shows supplier dashboard only once',
    (tester) async {
      await _pumpEntryNavBar(tester, _dualRoleUser(activeRole: 'SUPPLIER'));

      await tester.tap(find.byType(UserAvatar).first);
      await tester.pumpAndSettle();

      expect(find.text('Supplier dashboard'), findsOneWidget);
      expect(find.text('Switch to Learner'), findsOneWidget);
      expect(find.text('Switch to Supplier'), findsNothing);
      expect(find.text('My reservations'), findsNothing);
    },
  );

  testWidgets('supplier-only personal supplier menu shows become learner', (
    tester,
  ) async {
    await _pumpEntryNavBar(
      tester,
      User(
        id: 'user-1',
        displayName: 'Supplier User',
        email: 'supplier@test.com',
        accountStatus: 'ACTIVE',
        roles: const ['SUPPLIER'],
        activeRole: 'SUPPLIER',
        canBecomeLearner: true,
        supplierProfile: const SupplierProfile(
          supplierType: 'INDIVIDUAL_SUPPLIER',
          publicName: 'Supplier User',
        ),
        createdAt: DateTime(2026),
      ),
    );

    await tester.tap(find.byType(UserAvatar).first);
    await tester.pumpAndSettle();

    expect(find.text('Become a Learner'), findsOneWidget);
    expect(find.text('Switch to Learner'), findsNothing);
  });
}

Future<void> _pumpEntryNavBar(WidgetTester tester, User user) async {
  await tester.binding.setSurfaceSize(const Size(900, 900));
  addTearDown(() => tester.binding.setSurfaceSize(null));

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
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: const Scaffold(
          body: EntryNavBar(
            showSignIn: false,
            showCreateAccount: false,
            homeRoute: '/home',
          ),
        ),
      ),
    ),
  );

  await tester.pump();
}

User _dualRoleUser({required String activeRole}) {
  return User(
    id: 'user-1',
    displayName: 'majd',
    email: 'learner@test.com',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER', 'SUPPLIER'],
    activeRole: activeRole,
    canSwitchToLearner: activeRole == 'SUPPLIER',
    canSwitchToSupplier: activeRole == 'LEARNER',
    supplierProfile: const SupplierProfile(
      supplierType: 'STUDENT',
      publicName: 'majd',
    ),
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
