import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/app/widgets/app_mobile_bottom_nav_bar.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/notifications/application/notifications_routes.dart';
import 'package:frontend/features/profile/presentation/widgets/learner_profile_hub_widgets.dart';

void main() {
  testWidgets('Arabic mobile navigation is localized and remains usable', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(320, 800));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(
            () => _TestAuthController(_user()),
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
          home: MediaQuery(
            data: MediaQueryData(size: Size(320, 800)),
            child: Scaffold(bottomNavigationBar: AppMobileBottomNavBar()),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    for (final label in const [
      'الرئيسية',
      'المواد',
      'التعلّم',
      'الحجوزات',
      'الملف الشخصي',
    ]) {
      expect(find.text(label), findsOneWidget);
    }
    expect(
      Directionality.of(tester.element(find.text('الرئيسية'))),
      TextDirection.rtl,
    );
    expect(tester.takeException(), isNull);
  });

  test('verification notices use email then phone priority', () {
    expect(
      resolveAccountVerificationNotice(
        _user(emailVerificationRequired: true),
      )?.kind,
      AccountVerificationNoticeKind.emailUnverified,
    );
    expect(
      resolveAccountVerificationNotice(
        _user(emailVerifiedAt: DateTime(2026)),
      )?.kind,
      AccountVerificationNoticeKind.phoneMissing,
    );
    expect(
      resolveAccountVerificationNotice(
        _user(emailVerifiedAt: DateTime(2026), phone: '+970599000000'),
      )?.kind,
      AccountVerificationNoticeKind.phoneUnverified,
    );
    expect(
      resolveAccountVerificationNotice(
        _user(
          emailVerifiedAt: DateTime(2026),
          phone: '+970599000000',
          phoneVerifiedAt: DateTime(2026),
        ),
      ),
      isNull,
    );
  });

  test('completion CTA and notification routes retain exact policy', () {
    expect(
      resolveLearnerProfileCompletionAction([
        'phone',
        'saved_location',
      ])?.route,
      '/profile/edit',
    );
    expect(
      resolveLearnerProfileCompletionAction(['saved_location'])?.route,
      '/profile/locations',
    );
    expect(notificationInboxRouteForUser(_user()), '/notifications');
    expect(
      notificationInboxRouteForUser(
        _user(roles: const ['LEARNER', 'SUPPLIER'], activeRole: 'SUPPLIER'),
      ),
      '/supplier/notifications',
    );
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

User _user({
  String? phone,
  DateTime? emailVerifiedAt,
  bool emailVerificationRequired = false,
  DateTime? phoneVerifiedAt,
  List<String> roles = const ['LEARNER'],
  String activeRole = 'LEARNER',
}) {
  return User(
    id: 'learner-1',
    displayName: 'Learner',
    email: 'learner@example.com',
    phone: phone,
    accountStatus: 'ACTIVE',
    roles: roles,
    activeRole: activeRole,
    emailVerifiedAt: emailVerifiedAt,
    emailVerificationRequired: emailVerificationRequired,
    phoneVerifiedAt: phoneVerifiedAt,
    createdAt: DateTime(2026),
  );
}
