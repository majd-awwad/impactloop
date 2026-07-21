import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'support/learning_project_authoring_repository_stubs.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/home/presentation/widgets/learning_spotlight_section.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project_submission.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/project_engagement.dart';
import 'package:frontend/features/learning_hub/domain/project_follow_status.dart';
import 'package:frontend/features/learning_hub/domain/project_save_status.dart';
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

    testWidgets('shows compact engagement controls on project cards', (
      tester,
    ) async {
      final router = _buildRouter(
        repository: _FakeLearningHubRepository(
          fetchProjects: () async => LearningProjectsResult(
            items: [
              _project(
                id: '11111111-1111-1111-1111-111111111111',
                title: 'Solar Station',
                likesCount: 7,
                followersCount: 3,
                isSaved: true,
              ),
            ],
            page: 1,
            limit: 2,
            total: 1,
            totalPages: 1,
          ),
        ),
      );

      await tester.pumpWidget(router);
      await tester.pumpAndSettle();

      expect(find.text('7 likes'), findsOneWidget);
      expect(find.text('Saved'), findsOneWidget);
      expect(find.text('3 followers'), findsOneWidget);

      await tester.tap(find.byTooltip('Remove saved project'));
      await tester.pumpAndSettle();

      expect(find.text('login'), findsOneWidget);
    });

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
      GoRoute(
        path: '/login',
        builder: (context, state) => const Scaffold(body: Text('login')),
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

LearningProject _project({
  required String id,
  required String title,
  int likesCount = 0,
  bool isLiked = false,
  bool isSaved = false,
  int followersCount = 0,
  bool isFollowing = false,
}) {
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
    likesCount: likesCount,
    isLiked: isLiked,
    isSaved: isSaved,
    followersCount: followersCount,
    isFollowing: isFollowing,
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
  Future<LearningProjectsResult> fetchSavedProjects(
    LearningProjectsQuery query,
  ) {
    return _fetchProjects();
  }

  @override
  Future<LearningProjectsResult> fetchFollowedProjects(
    LearningProjectsQuery query,
  ) {
    return _fetchProjects();
  }

  @override
  Future<LearningProject?> fetchProjectById(String id) async => null;

  @override
  Future<LearningProjectSubmissionsResult> fetchMyLearningProjectSubmissions(
    LearningProjectSubmissionsQuery query,
  ) async {
    return const LearningProjectSubmissionsResult(
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    );
  }

  @override
  Future<LearningProjectSubmission> fetchMyLearningProjectSubmission(
    String id,
  ) {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmission> updateMyLearningProjectSubmission(
    String id,
    Map<String, dynamic> payload,
  ) {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmission> resubmitMyLearningProjectSubmission(
    String id,
  ) {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmission> submitMyLearningProjectDraft(
    String id, {
    required String idempotencyKey,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async => null;

  @override
  Future<ProjectBuild> startBuild(String projectId) async {
    return ProjectBuild(
      id: 'test-build',
      projectId: projectId,
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'test-project',
        title: 'Test project',
        shortDescription: '',
      ),
      progress: const ProjectBuildProgress(total: 0, ready: 0, percent: 0),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 0,
        linked: 0,
        reserved: 0,
        missing: 0,
        total: 0,
      ),
      stepProgress: const ProjectBuildStepProgress(
        completed: 0,
        total: 0,
        percent: 0,
        steps: [],
      ),
      items: const [],
    );
  }

  @override
  Future<ProjectBuild> updateBuildItem(
    String projectId,
    String itemId, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
  }) async {
    return startBuild(projectId);
  }

  @override
  Future<BuildMaterialCandidatesResult> fetchMaterialCandidates(
    String projectId,
    String itemId,
  ) async {
    return BuildMaterialCandidatesResult(
      itemId: itemId,
      componentId: 'component',
      searchTerm: '',
      items: const [],
    );
  }

  @override
  Future<ProjectBuild> linkMaterial(
    String projectId,
    String itemId, {
    required String materialId,
  }) async {
    return startBuild(projectId);
  }

  @override
  Future<ProjectBuild> unlinkMaterial(String projectId, String itemId) async {
    return startBuild(projectId);
  }

  @override
  Future<ProjectBuild> completeBuildStep(String projectId, String stepId) async {
    return startBuild(projectId);
  }

  @override
  Future<BuildGuideConversationResult> getOrCreateBuildGuideConversation(
    String projectId,
  ) async {
    return BuildGuideConversationResult(
      conversationId: 'guide-conversation',
      buildContext: BuildGuideContext(
        buildId: 'test-build',
        projectId: projectId,
        projectTitle: 'Test project',
        buildStatus: ProjectBuildStatus.inProgress,
        materialReadiness: const ProjectBuildMaterialReadiness(
          ready: 0,
          linked: 0,
          reserved: 0,
          missing: 0,
          total: 0,
        ),
        stepProgress: const ProjectBuildStepProgressSummary(
          completed: 0,
          total: 0,
          percent: 0,
        ),
      ),
    );
  }

  @override
  Future<ProjectEngagement> likeProject(String id) async {
    return ProjectEngagement(projectId: id, likesCount: 1, isLiked: true);
  }

  @override
  Future<ProjectEngagement> unlikeProject(String id) async {
    return ProjectEngagement(projectId: id, likesCount: 0, isLiked: false);
  }

  @override
  Future<ProjectSaveStatus> saveProject(String id) async {
    return ProjectSaveStatus(projectId: id, isSaved: true);
  }

  @override
  Future<ProjectSaveStatus> unsaveProject(String id) async {
    return ProjectSaveStatus(projectId: id, isSaved: false);
  }

  @override
  Future<ProjectFollowStatus> followProject(String id) async {
    return ProjectFollowStatus(
      projectId: id,
      followersCount: 1,
      isFollowing: true,
    );
  }

  @override
  Future<ProjectFollowStatus> unfollowProject(String id) async {
    return ProjectFollowStatus(
      projectId: id,
      followersCount: 0,
      isFollowing: false,
    );
  }

  @override
  Future<void> reviewProject(
    String id, {
    required int rating,
    String? comment,
  }) async {
    return;
  }

  @override
  Future<void> deleteProjectReview(String id) async {
    return;
  }

  @override
  Future<List<MaterialCategory>> fetchProjectCategories() async => const [];

  @override
  Future<List<MaterialCategory>> fetchMaterialCategories() async => const [];

  @override
  Future<void> submitProjectForReview({
    required String idempotencyKey,
    required String title,
    required String shortDescription,
    required String description,
    required String categoryId,
    required String difficulty,
    int? estimatedDurationMinutes,
    List<Map<String, dynamic>>? requiredComponents,
    List<Map<String, dynamic>>? steps,
    List<Map<String, dynamic>>? links,
  }) async {
    return;
  }

  @override
  Future<LearningProjectAuthoringSession> createAiAuthoringDraft({
    required String ideaText,
    required String categoryId,
    required String difficulty,
    required String idempotencyKey,
    String? locale,
  }) =>
      unimplementedCreateAiAuthoringDraft(
        ideaText: ideaText,
        categoryId: categoryId,
        difficulty: difficulty,
        idempotencyKey: idempotencyKey,
        locale: locale,
      );

  @override
  Future<LearningProjectAuthoringSession> getOrCreateAuthoringConversation({
    required String projectId,
    String? locale,
  }) =>
      unimplementedGetOrCreateAuthoringConversation(
        projectId: projectId,
        locale: locale,
      );
}
