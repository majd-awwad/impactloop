import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/auth/presentation/widgets/auth_entry_branding_panel.dart';
import 'package:frontend/features/auth/presentation/widgets/auth_shell.dart';
import 'package:frontend/l10n/app_localizations.dart';

Widget _harness(Size viewportSize) => ProviderScope(
  child: MaterialApp(
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    home: MediaQuery(
      data: MediaQueryData(size: viewportSize),
      child: const AuthShell(
        showSignIn: false,
        showCreateAccount: false,
        formContent: Text('form-marker'),
      ),
    ),
  ),
);

void main() {
  testWidgets('wide short viewport keeps the two-column web layout', (
    tester,
  ) async {
    await tester.binding.setSurfaceSize(const Size(1200, 600));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_harness(const Size(1200, 600)));
    await tester.pumpAndSettle();

    final brandingCenter = tester.getCenter(find.byType(AuthEntryBrandingPanel));
    final formCenter = tester.getCenter(find.text('form-marker'));
    expect((brandingCenter.dx - formCenter.dx).abs(), greaterThan(200));
  });

  testWidgets('narrow viewport keeps the stacked mobile layout', (tester) async {
    await tester.binding.setSurfaceSize(const Size(390, 700));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(_harness(const Size(390, 700)));
    await tester.pumpAndSettle();

    final brandingCenter = tester.getCenter(find.byType(AuthEntryBrandingPanel));
    final formCenter = tester.getCenter(find.text('form-marker'));
    expect((brandingCenter.dx - formCenter.dx).abs(), lessThan(20));
    expect(tester.takeException(), isNull);
  });
}
