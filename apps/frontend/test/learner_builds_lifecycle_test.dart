import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learner_builds/application/learner_builds_providers.dart';
import 'package:frontend/features/learner_builds/data/models/learner_build_models.dart';
import 'package:frontend/features/learner_builds/presentation/pages/my_builds_page.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';

void main() {
  testWidgets('my builds page shows lifecycle tab labels', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsListProvider.overrideWith(
            (ref) async => const LearnerBuildListResult(
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            ),
          ),
        ],
        child: MaterialApp(
          home: const MyBuildsPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Active'), findsOneWidget);
    expect(find.text('Paused'), findsOneWidget);
    expect(find.text('Completed'), findsOneWidget);
    expect(find.text('Archived'), findsOneWidget);
  });

  testWidgets('my builds page shows Arabic tab labels', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsListProvider.overrideWith(
            (ref) async => const LearnerBuildListResult(
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            ),
          ),
        ],
        child: MaterialApp(
          locale: const Locale('ar'),
          home: const MyBuildsPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: const [Locale('ar'), Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('نشطة'), findsOneWidget);
    expect(find.text('مؤجلة'), findsOneWidget);
    expect(find.text('مكتملة'), findsOneWidget);
    expect(find.text('مؤرشفة'), findsOneWidget);
  });

  testWidgets('my builds active empty state offers learning hub action', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsListProvider.overrideWith(
            (ref) async => const LearnerBuildListResult(
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            ),
          ),
        ],
        child: MaterialApp.router(
          routerConfig: GoRouter(
            routes: [
              GoRoute(
                path: '/',
                builder: (context, state) => const MyBuildsPage(),
              ),
              GoRoute(
                path: '/learning',
                builder: (context, state) =>
                    const Scaffold(body: Text('learning hub page')),
              ),
            ],
          ),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('No builds here yet'), findsOneWidget);
    expect(find.text('Browse Learning Hub'), findsOneWidget);

    await tester.tap(find.text('Browse Learning Hub'));
    await tester.pumpAndSettle();

    expect(find.text('learning hub page'), findsOneWidget);
  });

  testWidgets('my builds list shows resume hint for paused build card', (
    tester,
  ) async {
    final pausedItem = LearnerBuildListItem(
      id: 'build-paused',
      projectId: 'project-1',
      attemptNumber: 1,
      status: ProjectBuildStatus.paused,
      project: const LearnerBuildListProject(
        id: 'project-1',
        title: 'Paused greenhouse kit',
        shortDescription: 'Paused build',
      ),
      startedAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 1, 2),
      pausedAt: DateTime(2026, 1, 2),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerBuildsListProvider.overrideWith(
            (ref) async => LearnerBuildListResult(
              items: [pausedItem],
              page: 1,
              limit: 20,
              total: 1,
              totalPages: 1,
            ),
          ),
        ],
        child: MaterialApp(
          home: const MyBuildsPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Paused greenhouse kit'), findsOneWidget);
    expect(find.text('Paused'), findsWidgets);
    expect(find.text('Open build'), findsOneWidget);
  });
}

class _TestAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        email: 'learner@example.com',
        displayName: 'Learner',
        accountStatus: 'ACTIVE',
        activeRole: 'LEARNER',
        roles: const ['LEARNER'],
        createdAt: DateTime(2026),
      ),
      accessToken: 'token',
      hasBootstrapped: true,
    );
  }
}
