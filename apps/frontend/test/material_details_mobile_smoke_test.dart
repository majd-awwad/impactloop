import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/app/theme/app_theme.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/material_discovery/application/material_discovery_providers.dart';
import 'package:frontend/features/material_discovery/application/material_related_projects_providers.dart';
import 'package:frontend/features/material_discovery/data/mock_material_discovery_repository.dart';
import 'package:frontend/features/material_discovery/data/mock_materials.dart';
import 'package:frontend/features/material_discovery/data/models/material_related_projects.dart';
import 'package:frontend/features/material_discovery/presentation/pages/material_details_page.dart';
import 'package:frontend/l10n/app_localizations.dart';
import 'package:go_router/go_router.dart';

class _LearnerAuth extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        displayName: 'Learner',
        email: 'learner@example.test',
        accountStatus: 'ACTIVE',
        roles: const ['LEARNER'],
        activeRole: 'LEARNER',
        createdAt: DateTime(2026),
      ),
      accessToken: 'token',
      hasBootstrapped: true,
    );
  }
}

List<Override> _overrides() {
  return [
    authControllerProvider.overrideWith(_LearnerAuth.new),
    materialDiscoveryRepositoryProvider.overrideWithValue(
      const MockMaterialDiscoveryRepository(),
    ),
    materialRelatedProjectsInitialProvider.overrideWith(
      (ref, materialId) async => MaterialRelatedProjectsPage(
        materialId: materialId,
        items: const [],
        pagination: const MaterialRelatedProjectsPagination(
          page: 1,
          limit: 4,
          total: 0,
          totalPages: 0,
        ),
      ),
    ),
  ];
}

void main() {
  testWidgets('MaterialDetailsPage renders on mobile width for learner', (
    tester,
  ) async {
    final material = mockMaterials.first;
    final router = GoRouter(
      routes: [
        GoRoute(
          path: '/materials/:id',
          builder: (context, state) => MaterialDetailsPage(
            materialId: material.id,
            repository: const MockMaterialDiscoveryRepository(),
          ),
        ),
        GoRoute(path: '/materials', builder: (_, __) => const SizedBox()),
        GoRoute(path: '/', builder: (_, __) => const SizedBox()),
      ],
      initialLocation: '/materials/${material.id}',
    );
    addTearDown(router.dispose);

    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));

    await tester.pumpWidget(
      ProviderScope(
        overrides: _overrides(),
        child: MaterialApp.router(
          theme: AppTheme.light,
          locale: const Locale('en'),
          supportedLocales: AppLocalizations.supportedLocales,
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
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text(material.title.en), findsWidgets);
    expect(find.textContaining('Reserve'), findsWidgets);
  });

  testWidgets(
    'pushing materials/:id from learner shell shows detail on mobile',
    (tester) async {
      final material = mockMaterials.first;
      final rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
      final router = GoRouter(
        navigatorKey: rootNavigatorKey,
        initialLocation: '/materials',
        routes: [
          ShellRoute(
            builder: (context, state, child) => Scaffold(
              body: child,
              bottomNavigationBar: const SizedBox(height: 72),
            ),
            routes: [
              GoRoute(
                path: '/materials',
                builder: (context, state) => Center(
                  child: TextButton(
                    onPressed: () => context.push('/materials/${material.id}'),
                    child: const Text('Open material'),
                  ),
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/materials/:id',
            builder: (context, state) => MaterialDetailsPage(
              materialId: material.id,
              repository: const MockMaterialDiscoveryRepository(),
            ),
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      await tester.pumpWidget(
        ProviderScope(
          overrides: _overrides(),
          child: MaterialApp.router(
            theme: AppTheme.light,
            locale: const Locale('en'),
            supportedLocales: AppLocalizations.supportedLocales,
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
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open material'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text(material.title.en), findsWidgets);
      expect(find.textContaining('Reserve'), findsWidgets);
      // Sticky mobile CTA lives in bottomNavigationBar; unbounded-height
      // Columns there previously blanked the whole page.
      expect(find.text('Reserve Material'), findsWidgets);
    },
  );

  testWidgets(
    'mobile sticky reserve bar does not blank MaterialDetailsPage',
    (tester) async {
      final material = mockMaterials.first;
      FlutterErrorDetails? layoutError;
      final oldHandler = FlutterError.onError;
      FlutterError.onError = (details) {
        layoutError ??= details;
        oldHandler?.call(details);
      };
      addTearDown(() => FlutterError.onError = oldHandler);

      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final router = GoRouter(
        routes: [
          GoRoute(
            path: '/materials/:id',
            builder: (context, state) => MaterialDetailsPage(
              materialId: material.id,
              repository: const MockMaterialDiscoveryRepository(),
            ),
          ),
          GoRoute(path: '/materials', builder: (_, __) => const SizedBox()),
          GoRoute(path: '/', builder: (_, __) => const SizedBox()),
        ],
        initialLocation: '/materials/${material.id}',
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: _overrides(),
          child: MaterialApp.router(
            theme: AppTheme.light,
            locale: const Locale('en'),
            supportedLocales: AppLocalizations.supportedLocales,
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
      await tester.pumpAndSettle();

      expect(layoutError, isNull, reason: layoutError?.exceptionAsString());
      expect(tester.takeException(), isNull);
      expect(find.text(material.title.en), findsWidgets);
      expect(find.text('Reserve Material'), findsWidgets);

      final titleSize = tester.getSize(find.text(material.title.en).first);
      expect(titleSize.height, greaterThan(0));
      expect(titleSize.width, greaterThan(0));
    },
  );
}
