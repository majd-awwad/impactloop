import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/home/presentation/widgets/learning_spotlight_section.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/materials/data/models/category.dart';

void main() {
  group('LearningSpotlightSection', () {
    testWidgets('shows loading state while projects are loading', (
      tester,
    ) async {
      final completer = Completer<LearningProjectsResult>();

      await tester.pumpWidget(
        _buildHarness(
          repository: _FakeLearningHubRepository(
            fetchProjects: () => completer.future,
          ),
        ),
      );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Learning spotlight'), findsOneWidget);

      completer.complete(_emptyResult());
      await tester.pumpAndSettle();
    });

    testWidgets(
      'shows two API-backed projects that navigate to detail routes',
      (tester) async {
        final router = _buildRouter(
          repository: _FakeLearningHubRepository(
            fetchProjects: () async => LearningProjectsResult(
              items: [
                _project(
                  id: '11111111-1111-1111-1111-111111111111',
                  title: 'Solar Station',
                ),
                _project(
                  id: '22222222-2222-2222-2222-222222222222',
                  title: 'LED Circuit',
                ),
              ],
              page: 1,
              limit: 2,
              total: 2,
              totalPages: 1,
            ),
          ),
        );

        await tester.pumpWidget(router);
        await tester.pumpAndSettle();

        expect(find.text('Solar Station'), findsOneWidget);
        expect(find.text('LED Circuit'), findsOneWidget);
        expect(find.textContaining('4.8'), findsNothing);

        await tester.tap(find.text('Solar Station'));
        await tester.pumpAndSettle();

        expect(
          find.text('detail:11111111-1111-1111-1111-111111111111'),
          findsOneWidget,
        );
      },
    );

    testWidgets('shows empty state when no published projects exist', (
      tester,
    ) async {
      await tester.pumpWidget(
        _buildHarness(
          repository: _FakeLearningHubRepository(
            fetchProjects: () async => _emptyResult(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('No learning projects published yet'), findsOneWidget);
      expect(find.text('Open Learning Hub'), findsOneWidget);
    });

    testWidgets('shows error state with retry action', (tester) async {
      await tester.pumpWidget(
        _buildHarness(
          repository: _FakeLearningHubRepository(
            fetchProjects: () async => throw Exception('network down'),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Unable to load learning projects'), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);

      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();

      expect(find.text('Unable to load learning projects'), findsOneWidget);
    });
  });
}

Widget _buildHarness({required LearningProjectRepository repository}) {
  return ProviderScope(
    overrides: [learningHubRepositoryProvider.overrideWithValue(repository)],
    child: const MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(child: LearningSpotlightSection()),
      ),
    ),
  );
}

Widget _buildRouter({required LearningProjectRepository repository}) {
  final router = GoRouter(
    initialLocation: '/home',
    routes: [
      GoRoute(
        path: '/home',
        builder: (context, state) => const Scaffold(
          body: SingleChildScrollView(child: LearningSpotlightSection()),
        ),
      ),
      GoRoute(
        path: '/learning',
        builder: (context, state) => const Scaffold(body: Text('learning hub')),
      ),
      GoRoute(
        path: '/learning/:id',
        builder: (context, state) {
          final id = state.pathParameters['id']!;
          return Scaffold(body: Text('detail:$id'));
        },
      ),
    ],
  );

  return ProviderScope(
    overrides: [learningHubRepositoryProvider.overrideWithValue(repository)],
    child: MaterialApp.router(routerConfig: router),
  );
}

LearningProjectsResult _emptyResult() {
  return const LearningProjectsResult(
    items: [],
    page: 1,
    limit: 2,
    total: 0,
    totalPages: 0,
  );
}

LearningProject _project({required String id, required String title}) {
  return LearningProject(
    id: id,
    category: const LocalizedText(en: 'Robotics', ar: 'Robotics'),
    title: LocalizedText(en: title, ar: title),
    summary: const LocalizedText(en: 'Summary copy', ar: 'Summary copy'),
    difficulty: const LocalizedText(en: 'Easy', ar: 'Easy'),
    duration: const LocalizedText(en: '45 min', ar: '45 min'),
    ratingLabel: const LocalizedText(en: 'learners', ar: 'learners'),
    ratingValue: 0,
    ratingCount: 0,
    componentCountLabel: const LocalizedText(en: '', ar: ''),
    components: const [],
    steps: const [],
    links: const [],
    imageUrl: null,
    heroIconData: Icons.school_outlined,
    cardGradient: const [0xFF1F2937, 0xFF243B53],
    isFeatured: false,
    hasRatings: false,
  );
}

class _FakeLearningHubRepository implements LearningProjectRepository {
  _FakeLearningHubRepository({
    required Future<LearningProjectsResult> Function() fetchProjects,
  }) : _fetchProjects = fetchProjects;

  final Future<LearningProjectsResult> Function() _fetchProjects;

  @override
  Future<LearningProjectsResult> fetchProjects(LearningProjectsQuery query) {
    return _fetchProjects();
  }

  @override
  Future<LearningProject?> fetchProjectById(String id) async => null;

  @override
  Future<List<MaterialCategory>> fetchProjectCategories() async => const [];

  @override
  Future<void> submitProjectForReview({
    required String title,
    required String shortDescription,
    required String description,
    required String categoryId,
    required String difficulty,
    List<Map<String, dynamic>>? requiredComponents,
    List<Map<String, dynamic>>? steps,
    List<Map<String, dynamic>>? links,
  }) async {
    return;
  }
}
