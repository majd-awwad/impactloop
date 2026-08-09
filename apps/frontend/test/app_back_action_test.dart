import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:frontend/shared/widgets/app_back_action.dart';

void main() {
  testWidgets('renders the compact English variant with localized semantics', (
    tester,
  ) async {
    await tester.pumpWidget(
      const _LocalizedHarness(
        locale: Locale('en'),
        child: AppBackAction.compact(onBack: _noop),
      ),
    );

    expect(find.byKey(const ValueKey('app-back-compact')), findsOneWidget);
    expect(find.byTooltip('Back'), findsOneWidget);
    expect(tester.getSize(find.byType(IconButton)), const Size(48, 48));
  });

  testWidgets('renders the page-level Arabic RTL variant and label', (
    tester,
  ) async {
    await tester.pumpWidget(
      const _LocalizedHarness(
        locale: Locale('ar'),
        child: AppBackAction.pageLevel(onBack: _noop),
      ),
    );

    expect(find.byKey(const ValueKey('app-back-page-level')), findsOneWidget);
    expect(find.text('رجوع'), findsOneWidget);
    expect(find.byTooltip('رجوع'), findsOneWidget);
    expect(
      Directionality.of(
        tester.element(find.byKey(const ValueKey('app-back-page-level'))),
      ),
      TextDirection.rtl,
    );
    expect(
      tester.getSize(find.byType(OutlinedButton)).height,
      greaterThanOrEqualTo(44),
    );
  });

  testWidgets('adaptive variant chooses compact and page-level treatments', (
    tester,
  ) async {
    await tester.pumpWidget(
      const _LocalizedHarness(
        mediaSize: Size(430, 800),
        child: AppBackAction(onBack: _noop),
      ),
    );
    expect(find.byKey(const ValueKey('app-back-compact')), findsOneWidget);

    await tester.pumpWidget(
      const _LocalizedHarness(
        mediaSize: Size(1100, 800),
        child: AppBackAction(onBack: _noop),
      ),
    );
    expect(find.byKey(const ValueKey('app-back-page-level')), findsOneWidget);
  });

  testWidgets('page-level treatment stays intrinsic in a stretched column', (
    tester,
  ) async {
    await tester.pumpWidget(
      const _LocalizedHarness(
        mediaSize: Size(1100, 800),
        child: SizedBox(
          width: 900,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [AppBackAction.pageLevel(onBack: _noop)],
          ),
        ),
      ),
    );

    expect(tester.getSize(find.byType(OutlinedButton)).width, lessThan(200));
  });

  testWidgets('breadcrumb ancestors are visible and independently navigable', (
    tester,
  ) async {
    final router = _router(initialLocation: '/detail');
    addTearDown(router.dispose);
    await tester.pumpWidget(_RouterHarness(router: router));

    expect(find.text('Origin'), findsOneWidget);
    expect(find.text('Section'), findsOneWidget);
    expect(find.text('Detail'), findsOneWidget);

    await tester.tap(
      find.byKey(const ValueKey('app-back-breadcrumb-ancestor-1')),
    );
    await tester.pumpAndSettle();

    expect(router.state.uri.path, '/section');
    expect(find.text('Section destination'), findsOneWidget);
  });

  testWidgets(
    'returns to the actual pushed origin before considering fallback',
    (tester) async {
      final router = _router();
      addTearDown(router.dispose);
      await tester.pumpWidget(_RouterHarness(router: router));

      router.push('/detail');
      await tester.pumpAndSettle();
      await tester.tap(find.byType(AppBackAction));
      await tester.pumpAndSettle();

      expect(router.state.uri.path, '/origin');
      expect(find.text('Origin'), findsOneWidget);
    },
  );

  testWidgets('uses fallback only for direct entry with no app stack', (
    tester,
  ) async {
    final router = _router(initialLocation: '/detail');
    addTearDown(router.dispose);
    await tester.pumpWidget(_RouterHarness(router: router));

    expect(router.canPop(), isFalse);
    await tester.tap(find.byType(AppBackAction));
    await tester.pumpAndSettle();

    expect(router.state.uri.path, '/fallback');
    expect(find.text('Fallback'), findsOneWidget);
  });

  testWidgets('custom onBack is authoritative and runs once', (tester) async {
    var calls = 0;
    final completer = Completer<void>();
    await tester.pumpWidget(
      _LocalizedHarness(
        child: AppBackAction(
          fallbackLocation: '/unused',
          onBack: () async {
            calls++;
            await completer.future;
          },
        ),
      ),
    );

    await tester.tap(find.byType(AppBackAction));
    await tester.pump();
    await tester.tap(find.byType(AppBackAction), warnIfMissed: false);
    expect(calls, 1);
    completer.complete();
    await tester.pump();
  });

  testWidgets('PopScope veto remains authoritative and fallback does not run', (
    tester,
  ) async {
    final router = _router(guardDetail: true);
    addTearDown(router.dispose);
    await tester.pumpWidget(_RouterHarness(router: router));
    router.push('/detail');
    await tester.pumpAndSettle();

    await tester.tap(find.byType(AppBackAction));
    await tester.pumpAndSettle();

    expect(router.state.uri.path, '/detail');
    expect(find.text('Guarded detail'), findsOneWidget);
    expect(find.text('Fallback'), findsNothing);
  });
}

void _noop() {}

class _LocalizedHarness extends StatelessWidget {
  const _LocalizedHarness({
    required this.child,
    this.locale = const Locale('en'),
    this.mediaSize,
  });

  final Widget child;
  final Locale locale;
  final Size? mediaSize;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      locale: locale,
      supportedLocales: const [Locale('en'), Locale('ar')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: Scaffold(
        body: Builder(
          builder: (context) => MediaQuery(
            data: MediaQuery.of(context).copyWith(size: mediaSize),
            child: Align(child: child),
          ),
        ),
      ),
    );
  }
}

GoRouter _router({
  String initialLocation = '/origin',
  bool guardDetail = false,
}) {
  return GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: '/origin',
        builder: (_, _) => const Scaffold(body: Text('Origin')),
      ),
      GoRoute(
        path: '/fallback',
        builder: (_, _) => const Scaffold(body: Text('Fallback')),
      ),
      GoRoute(
        path: '/section',
        builder: (_, _) => const Scaffold(body: Text('Section destination')),
      ),
      GoRoute(
        path: '/detail',
        builder: (_, _) => PopScope(
          canPop: !guardDetail,
          child: Scaffold(
            body: Column(
              children: [
                AppBackBreadcrumb(
                  fallbackLocation: '/fallback',
                  ancestors: const [
                    AppBackBreadcrumbItem(label: 'Origin', location: '/origin'),
                    AppBackBreadcrumbItem(
                      label: 'Section',
                      location: '/section',
                    ),
                  ],
                  currentLabel: guardDetail ? 'Guarded detail' : 'Detail',
                ),
              ],
            ),
          ),
        ),
      ),
    ],
  );
}

class _RouterHarness extends StatelessWidget {
  const _RouterHarness({required this.router});

  final GoRouter router;

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      routerConfig: router,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
    );
  }
}
