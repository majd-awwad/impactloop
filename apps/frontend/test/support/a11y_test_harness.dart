import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/l10n/app_localizations.dart';

/// Narrow mobile viewport used for overflow and text-scale smoke checks.
const a11yNarrowViewport = Size(320, 760);

/// Default mobile viewport for critical-route accessibility smoke tests.
const a11yMobileViewport = Size(390, 844);

/// Text scale exercised by the CI smoke suite (system large-text setting).
const a11ySmokeTextScale = 1.4;

/// Configures the test surface to a mobile viewport with a 1:1 device pixel ratio.
void configureA11yViewport(
  WidgetTester tester, {
  Size viewport = a11yMobileViewport,
}) {
  tester.view.physicalSize = viewport;
  tester.view.devicePixelRatio = 1;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });
}

/// Wraps [child] with the viewport and text scale used by the smoke suite.
Widget wrapWithA11yMediaQuery({
  required Widget child,
  Size viewport = a11yMobileViewport,
  double textScale = a11ySmokeTextScale,
}) {
  return MediaQuery(
    data: MediaQueryData(
      size: viewport,
      textScaler: TextScaler.linear(textScale),
    ),
    child: child,
  );
}

/// Localized [MaterialApp] shell for accessibility widget tests.
Widget a11yMaterialApp({
  required Widget home,
  Locale locale = const Locale('en'),
  double textScale = a11ySmokeTextScale,
  Size viewport = a11yMobileViewport,
}) {
  return wrapWithA11yMediaQuery(
    viewport: viewport,
    textScale: textScale,
    child: MaterialApp(
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: home,
    ),
  );
}

/// Pumps [page] inside [ProviderScope] with the standard a11y viewport and scale.
Future<void> pumpA11yPage(
  WidgetTester tester, {
  required Widget page,
  List<Override> overrides = const [],
  Locale locale = const Locale('en'),
  Size viewport = a11yMobileViewport,
  double textScale = a11ySmokeTextScale,
  bool settle = true,
}) async {
  configureA11yViewport(tester, viewport: viewport);
  await tester.pumpWidget(
    ProviderScope(
      overrides: overrides,
      child: a11yMaterialApp(
        home: page,
        locale: locale,
        textScale: textScale,
        viewport: viewport,
      ),
    ),
  );
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
  }
}

/// Asserts the widget tree did not throw layout or painting exceptions.
void expectNoLayoutExceptions(WidgetTester tester) {
  expect(tester.takeException(), isNull);
}

/// Runs [body] with an active semantics tree and disposes it afterward.
T withSemanticsCheck<T>(WidgetTester tester, T Function() body) {
  final semantics = tester.ensureSemantics();
  try {
    return body();
  } finally {
    semantics.dispose();
  }
}
