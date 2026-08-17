import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learner_builds/application/learner_builds_providers.dart';
import 'package:frontend/features/learner_builds/data/models/learner_build_models.dart';
import 'package:frontend/features/learner_builds/presentation/pages/portfolio_page.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_project_build_page.dart';
import 'package:frontend/features/notifications/application/notifications_provider.dart';

void main() {
  testWidgets('portfolio page load triggers one bounded fetch', (tester) async {
    var fetchCount = 0;
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerPortfolioProvider.overrideWith((ref) async {
            fetchCount += 1;
            return const LearnerBuildListResult(
              items: [],
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            );
          }),
        ],
        child: MaterialApp(
          home: const PortfolioPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(fetchCount, 1);
    expect(find.text('Your private Portfolio is ready for completed projects.'), findsOneWidget);
  });

  testWidgets('portfolio page shows empty state copy', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerPortfolioProvider.overrideWith(
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
          home: const PortfolioPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Portfolio'), findsOneWidget);
    expect(
      find.text('Your private Portfolio is ready for completed projects.'),
      findsOneWidget,
    );
    expect(
      find.text(
        'Complete a project and add your story, photo, or learning reflection to see it here.',
      ),
      findsOneWidget,
    );
    expect(find.text('Explore projects'), findsOneWidget);
  });

  testWidgets('portfolio page shows Arabic title', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerPortfolioProvider.overrideWith(
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
          home: const PortfolioPage(),
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

    expect(find.text('معرض الإنجازات'), findsWidgets);
  });

  testWidgets('portfolio lists completed build with impact summary', (
    tester,
  ) async {
    final completedItem = LearnerBuildListItem(
      id: 'build-complete',
      projectId: 'project-1',
      attemptNumber: 2,
      status: ProjectBuildStatus.completed,
      project: const LearnerBuildListProject(
        id: 'project-1',
        title: 'Solar charger',
        shortDescription: 'Completed portfolio entry',
      ),
      startedAt: DateTime(2026, 1, 1),
      updatedAt: DateTime(2026, 2, 1),
      completedAt: DateTime(2026, 2, 1),
      completionStoryPreview: 'It worked on the first sunny day.',
      impactSummary: const ProjectBuildImpactSummary(
        projectId: 'project-1',
        projectTitle: 'Solar charger',
        attemptNumber: 2,
        completedStepCount: 4,
        totalStepCount: 4,
        acquiredViaImpactLoopCount: 2,
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learnerPortfolioProvider.overrideWith(
            (ref) async => LearnerBuildListResult(
              items: [completedItem],
              page: 1,
              limit: 20,
              total: 1,
              totalPages: 1,
            ),
          ),
        ],
        child: MaterialApp(
          home: const PortfolioPage(),
          localizationsDelegates: const [
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          supportedLocales: const [Locale('en')],
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Solar charger'), findsOneWidget);
    expect(find.text('Attempt 2'), findsOneWidget);
    expect(find.text('View completed build'), findsOneWidget);
    expect(find.text('It worked on the first sunny day.'), findsOneWidget);
    expect(find.text('4 of 4 steps completed'), findsNothing);
  });

  testWidgets('completed build page shows read-only notice', (tester) async {
    final completedBuild = ProjectBuild(
      id: 'build-complete',
      projectId: 'project-1',
      status: ProjectBuildStatus.completed,
      isReadOnly: true,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Completed kit',
        shortDescription: 'Done',
      ),
      progress: const ProjectBuildProgress(total: 2, ready: 2, percent: 100),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 2,
        linked: 2,
        reserved: 0,
        missing: 0,
        total: 2,
      ),
      stepProgress: const ProjectBuildStepProgress(
        completed: 2,
        total: 2,
        percent: 100,
        steps: [],
        nextAction: ProjectBuildNextAction.buildCompleted,
      ),
      items: const [],
      completionStory: const ProjectBuildCompletionStory(
        reflection: 'Finished!',
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learningHubRepositoryProvider.overrideWithValue(
            _CompletedBuildRepository(completedBuild),
          ),
          myNotificationUnreadCountProvider.overrideWith(
            () => _ZeroUnreadCount(),
          ),
        ],
        child: MaterialApp.router(
          routerConfig: GoRouter(
            routes: [
              GoRoute(
                path: '/learning/:id/build',
                builder: (context, state) => LearningProjectBuildPage(
                  projectId: state.pathParameters['id']!,
                ),
              ),
            ],
            initialLocation: '/learning/project-1/build',
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

    expect(
      find.text(
        'The build is complete. You can document the result and completion story.',
      ),
      findsOneWidget,
    );
    expect(find.text('This build is read-only.'), findsNothing);
    expect(find.text('Completion story'), findsOneWidget);
    expect(find.text('Complete step'), findsNothing);
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

class _CompletedBuildRepository implements LearningProjectRepository {
  const _CompletedBuildRepository(this.build);

  final ProjectBuild build;

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async => build;

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _ZeroUnreadCount extends NotificationUnreadCountNotifier {
  @override
  Future<int> build() async => 0;
}
