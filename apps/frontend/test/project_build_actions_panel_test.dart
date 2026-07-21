import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'support/learning_project_authoring_repository_stubs.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project_submission.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/project_engagement.dart';
import 'package:frontend/features/learning_hub/domain/project_follow_status.dart';
import 'package:frontend/features/learning_hub/domain/project_save_status.dart';
import 'package:frontend/features/learning_hub/presentation/widgets/project_build_actions_panel.dart';
import 'package:frontend/features/materials/data/models/category.dart';

void main() {
  testWidgets('continues an existing project build checklist', (tester) async {
    final router = GoRouter(
      initialLocation: '/learning/test-project',
      routes: [
        GoRoute(
          path: '/learning/:id',
          builder: (context, state) => Scaffold(
            body: SingleChildScrollView(
              child: ProjectBuildActionsPanel(project: _project()),
            ),
          ),
        ),
        GoRoute(
          path: '/learning/:id/build',
          builder: (context, state) =>
              const Scaffold(body: Text('build checklist page')),
        ),
        GoRoute(
          path: '/materials',
          builder: (context, state) {
            return const Scaffold(body: Text('materials page'));
          },
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          authControllerProvider.overrideWith(_TestAuthController.new),
          learningHubRepositoryProvider.overrideWithValue(
            _BuildPanelRepository(),
          ),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Build checklist'), findsOneWidget);
    expect(find.text('Continue checklist'), findsOneWidget);
    expect(find.text('1/2 ready for build'), findsOneWidget);

    await tester.tap(find.text('Continue checklist'));
    await tester.pumpAndSettle();

    expect(find.text('build checklist page'), findsOneWidget);
  });
}

LearningProject _project() {
  return const LearningProject(
    id: 'test-project',
    category: LocalizedText(en: 'Robotics', ar: 'Robotics'),
    title: LocalizedText(en: 'Sensor station', ar: 'Sensor station'),
    summary: LocalizedText(en: 'Build a station', ar: 'Build a station'),
    difficulty: LocalizedText(en: 'Easy', ar: 'Easy'),
    duration: LocalizedText(en: '45 min', ar: '45 min'),
    ratingLabel: LocalizedText(en: 'learners', ar: 'learners'),
    ratingValue: 0,
    ratingCount: 0,
    componentCountLabel: LocalizedText(en: '2 components', ar: '2 components'),
    components: [
      LocalizedText(en: 'Arduino board', ar: 'Arduino board'),
      LocalizedText(en: 'Jumper wires', ar: 'Jumper wires'),
    ],
    requiredComponents: [
      ProjectRequiredComponentItem(
        id: 'component-1',
        name: LocalizedText(en: 'Arduino board', ar: 'Arduino board'),
        materialType: 'Electronics',
        quantity: 1,
        unit: 'piece',
        isRequired: true,
        canBeSubstituted: false,
      ),
      ProjectRequiredComponentItem(
        id: 'component-2',
        name: LocalizedText(en: 'Jumper wires', ar: 'Jumper wires'),
        materialType: 'Electronics',
        quantity: 10,
        unit: 'pieces',
        isRequired: true,
        canBeSubstituted: false,
      ),
    ],
    steps: [
      ProjectStep(
        title: LocalizedText(en: 'Connect parts', ar: 'Connect parts'),
      ),
    ],
    links: [],
    imageUrl: null,
    heroIconData: Icons.memory_rounded,
    cardGradient: [0xFF1F2937, 0xFF243B53],
    isFeatured: false,
    hasRatings: false,
  );
}

class _TestAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      user: User(
        id: 'learner-1',
        displayName: 'Learner',
        email: 'learner@example.com',
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

class _BuildPanelRepository implements LearningProjectRepository {
  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    return ProjectBuild(
      id: 'build-1',
      projectId: projectId,
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'test-project',
        title: 'Sensor station',
        shortDescription: 'Build a station',
      ),
      progress: const ProjectBuildProgress(total: 2, ready: 1, percent: 50),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 1,
        linked: 0,
        reserved: 0,
        missing: 1,
        total: 2,
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
  Future<ProjectBuild> startBuild(String projectId) async {
    return (await fetchMyBuild(projectId))!;
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
  ) {
    throw UnimplementedError();
  }

  @override
  Future<ProjectBuild> linkMaterial(
    String projectId,
    String itemId, {
    required String materialId,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<ProjectBuild> unlinkMaterial(String projectId, String itemId) {
    throw UnimplementedError();
  }

  @override
  Future<ProjectBuild> completeBuildStep(String projectId, String stepId) {
    throw UnimplementedError();
  }

  @override
  Future<BuildGuideConversationResult> getOrCreateBuildGuideConversation(
    String projectId,
  ) {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectsResult> fetchProjects(LearningProjectsQuery query) {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectsResult> fetchSavedProjects(
    LearningProjectsQuery query,
  ) {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectsResult> fetchFollowedProjects(
    LearningProjectsQuery query,
  ) {
    throw UnimplementedError();
  }

  @override
  Future<LearningProject?> fetchProjectById(String id) {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmissionsResult> fetchMyLearningProjectSubmissions(
    LearningProjectSubmissionsQuery query,
  ) {
    throw UnimplementedError();
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
  Future<List<MaterialCategory>> fetchProjectCategories() {
    throw UnimplementedError();
  }

  @override
  Future<List<MaterialCategory>> fetchMaterialCategories() {
    throw UnimplementedError();
  }

  @override
  Future<ProjectEngagement> likeProject(String id) {
    throw UnimplementedError();
  }

  @override
  Future<ProjectEngagement> unlikeProject(String id) {
    throw UnimplementedError();
  }

  @override
  Future<ProjectSaveStatus> saveProject(String id) {
    throw UnimplementedError();
  }

  @override
  Future<ProjectSaveStatus> unsaveProject(String id) {
    throw UnimplementedError();
  }

  @override
  Future<ProjectFollowStatus> followProject(String id) {
    throw UnimplementedError();
  }

  @override
  Future<ProjectFollowStatus> unfollowProject(String id) {
    throw UnimplementedError();
  }

  @override
  Future<void> reviewProject(
    String id, {
    required int rating,
    String? comment,
  }) {
    throw UnimplementedError();
  }

  @override
  Future<void> deleteProjectReview(String id) {
    throw UnimplementedError();
  }

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
  }) {
    throw UnimplementedError();
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
