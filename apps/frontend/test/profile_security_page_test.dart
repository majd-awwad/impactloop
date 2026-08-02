import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/profile/presentation/pages/profile_security_page.dart';

void main() {
  testWidgets(
    'profile security page toggles new and confirm passwords together',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(400, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              () => _TestAuthController(_testUser()),
            ),
          ],
          child: const MaterialApp(home: ProfileSecurityPage()),
        ),
      );

      await tester.pump();

      final toggleButtons = find.byTooltip('Show password');
      expect(toggleButtons, findsNWidgets(3));

      await tester.enterText(find.byType(TextFormField).at(0), 'Current123!');
      await tester.enterText(find.byType(TextFormField).at(1), 'NewPassword1!');
      await tester.enterText(find.byType(TextFormField).at(2), 'NewPassword1!');

      await tester.tap(toggleButtons.at(1));
      await tester.pump();

      expect(find.byTooltip('Hide password'), findsNWidgets(2));
      expect(find.byTooltip('Show password'), findsOneWidget);

      await tester.tap(find.byTooltip('Show password'));
      await tester.pump();

      expect(find.byTooltip('Hide password'), findsNWidgets(3));
      expect(find.byTooltip('Show password'), findsNothing);

      await tester.tap(find.byTooltip('Hide password').at(1));
      await tester.pump();

      expect(find.byTooltip('Hide password'), findsOneWidget);
      expect(find.byTooltip('Show password'), findsNWidgets(2));

      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('Arabic security copy and password semantics are localized', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 800));
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
          home: ProfileSecurityPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('الأمان'), findsOneWidget);
    expect(find.text('كلمة المرور الحالية'), findsOneWidget);
    expect(find.text('كلمة المرور الجديدة'), findsOneWidget);
    expect(find.text('تأكيد كلمة المرور الجديدة'), findsOneWidget);
    expect(find.text('تحديث كلمة المرور'), findsOneWidget);
    expect(find.byTooltip('إظهار كلمة المرور'), findsNWidgets(3));
    expect(
      Directionality.of(tester.element(find.text('الأمان'))),
      TextDirection.rtl,
    );
    expect(tester.takeException(), isNull);
  });
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

User _testUser() {
  return User(
    id: 'user-1',
    displayName: 'Learner User',
    email: 'learner@example.com',
    accountStatus: 'ACTIVE',
    roles: const ['LEARNER'],
    createdAt: DateTime(2026),
  );
}
