import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/widgets/app_mobile_bottom_nav_bar.dart';
import 'package:frontend/l10n/app_localizations.dart';

void main() {
  testWidgets('mobile navigation shell keeps routed page content visible', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      const ProviderScope(
        child: MaterialApp(
          home: AppMobileNavigationShell(
            child: Scaffold(body: Center(child: Text('Home page body'))),
          ),
        ),
      ),
    );

    await tester.pump();

    expect(find.text('Home page body'), findsOneWidget);
    expect(find.byType(AppMobileBottomNavBar), findsOneWidget);
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Materials'), findsOneWidget);
    expect(find.text('Learning'), findsOneWidget);
    expect(find.text('Reservations'), findsOneWidget);
    expect(find.text('Profile'), findsOneWidget);
    expect(
      tester.getSize(find.byType(AppMobileBottomNavBar)).height,
      inInclusiveRange(68, 74),
    );
    expect(tester.takeException(), isNull);
  });

  for (final width in [360.0, 390.0]) {
    testWidgets(
      'compact nav at ${width.toInt()}px keeps Home selected without overflow',
      (tester) async {
        await _pumpNav(
          tester,
          size: Size(width, 800),
          location: '/home',
        );

        expect(tester.takeException(), isNull);
        expect(find.byType(AppMobileBottomNavBar), findsOneWidget);
        expect(
          tester.getSize(find.byType(AppMobileBottomNavBar)).height,
          inInclusiveRange(68, 74),
        );

        final bubbles = tester
            .widgetList<AnimatedContainer>(find.byType(AnimatedContainer))
            .toList();
        expect(bubbles, hasLength(5));
        final sizes = [
          for (final finder in find.byType(AnimatedContainer).evaluate())
            tester.getSize(find.byWidget(finder.widget)),
        ];
        sizes.sort((a, b) => b.height.compareTo(a.height));
        final selectedSize = sizes.first;
        expect(selectedSize.height, lessThanOrEqualTo(64));
        expect(selectedSize.height, greaterThanOrEqualTo(44));
        expect(selectedSize.height, lessThan(68));
        expect(selectedSize.width, lessThan(width / 4));

        for (final label in const [
          'Home',
          'Materials',
          'Learning',
          'Reservations',
          'Profile',
        ]) {
          final textFinder = find.text(label);
          expect(textFinder, findsOneWidget);
          final text = tester.widget<Text>(textFinder);
          expect(text.maxLines, 1);
          expect(tester.getSize(textFinder).height, lessThan(16));
        }
      },
    );
  }

  testWidgets('Arabic RTL compact nav keeps one-line labels at 360px', (
    tester,
  ) async {
    await _pumpNav(
      tester,
      size: const Size(360, 800),
      locale: const Locale('ar'),
      location: '/home',
    );

    expect(tester.takeException(), isNull);
    expect(
      Directionality.of(tester.element(find.byType(AppMobileBottomNavBar))),
      TextDirection.rtl,
    );
    for (final label in const [
      'الرئيسية',
      'المواد',
      'التعلّم',
      'الحجوزات',
      'الملف الشخصي',
    ]) {
      final textFinder = find.text(label);
      expect(textFinder, findsOneWidget);
      expect(tester.getSize(textFinder).height, lessThan(16));
    }
  });

  testWidgets('SafeArea system inset is not stacked with a large extra margin', (
    tester,
  ) async {
    await _pumpNav(
      tester,
      size: const Size(360, 800),
      location: '/home',
          viewPaddingBottom: 24,
    );

    final height = tester.getSize(find.byType(AppMobileBottomNavBar)).height;
    expect(height, closeTo(95, 4));
    expect(height, lessThan(104));
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pumpNav(
  WidgetTester tester, {
  required Size size,
  Locale locale = const Locale('en'),
  String location = '/home',
  double viewPaddingBottom = 0,
}) async {
  final previousOnError = FlutterError.onError;
  FlutterError.onError = (details) {
    final message = details.exceptionAsString();
    if (message.contains('RenderFlex overflowed') ||
        message.contains('overflowed by')) {
      fail('Layout overflow: $message');
    }
    previousOnError?.call(details);
  };
  addTearDown(() {
    FlutterError.onError = previousOnError;
  });

  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  tester.view.padding = FakeViewPadding(
    left: 0,
    top: 0,
    right: 0,
    bottom: viewPaddingBottom,
  );
  tester.view.viewPadding = FakeViewPadding(
    left: 0,
    top: 0,
    right: 0,
    bottom: viewPaddingBottom,
  );
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.view.resetPadding();
    tester.view.resetViewPadding();
  });

  final router = GoRouter(
    initialLocation: location,
    routes: [
      for (final path in const [
        '/home',
        '/materials',
        '/learning',
        '/learner/reservations',
        '/profile',
        '/login',
      ])
        GoRoute(
          path: path,
          builder: (context, state) => AppMobileNavigationShell(
            child: Scaffold(body: Center(child: Text('page:$path'))),
          ),
        ),
    ],
  );

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp.router(
        locale: locale,
        supportedLocales: const [Locale('en'), Locale('ar')],
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        routerConfig: router,
      ),
    ),
  );
  await tester.pump();
}
