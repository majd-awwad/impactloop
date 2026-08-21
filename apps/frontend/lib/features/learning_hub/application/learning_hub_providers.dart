import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_response.dart';
import '../../materials/data/models/category.dart';
import '../data/learning_project_draft_storage.dart';
import '../data/learning_hub_api_mapper.dart';
import '../domain/learning_project_repository.dart';
import '../domain/learning_projects_result.dart';
import '../domain/models/learning_project.dart';
import '../domain/models/learning_project_submission.dart';
import '../domain/models/project_build.dart';
import '../domain/models/smart_build_plan.dart';

final learningHubRepositoryProvider = Provider<LearningProjectRepository>(
  (ref) => throw StateError(
    'learningHubRepositoryProvider is not configured. '
    'Override it in ProviderScope (see main.dart).',
  ),
);

final learningProjectDraftStorageProvider =
    Provider<LearningProjectDraftStorage>((ref) {
      return createLearningProjectDraftStorage();
    });

final projectCategoriesProvider =
    FutureProvider.autoDispose<List<MaterialCategory>>((ref) {
      return ref.watch(learningHubRepositoryProvider).fetchProjectCategories();
    });

final materialCategoriesProvider =
    FutureProvider.autoDispose<List<MaterialCategory>>((ref) {
      return ref.watch(learningHubRepositoryProvider).fetchMaterialCategories();
    });

final learningProjectsProvider = FutureProvider.autoDispose
    .family<LearningProjectsResult, LearningProjectsQuery>((ref, query) async {
      return ref.watch(learningHubRepositoryProvider).fetchProjects(query);
    });

final savedLearningProjectsProvider = FutureProvider.autoDispose
    .family<LearningProjectsResult, LearningProjectsQuery>((ref, query) async {
      return ref.watch(learningHubRepositoryProvider).fetchSavedProjects(query);
    });

final followedLearningProjectsProvider = FutureProvider.autoDispose
    .family<LearningProjectsResult, LearningProjectsQuery>((ref, query) async {
      return ref
          .watch(learningHubRepositoryProvider)
          .fetchFollowedProjects(query);
    });

final learningProjectProvider = FutureProvider.autoDispose
    .family<LearningProject?, String>((ref, id) async {
      return ref.watch(learningHubRepositoryProvider).fetchProjectById(id);
    });

final myLearningProjectSubmissionsProvider = FutureProvider.autoDispose
    .family<LearningProjectSubmissionsResult, LearningProjectSubmissionsQuery>((
      ref,
      query,
    ) async {
      return ref
          .watch(learningHubRepositoryProvider)
          .fetchMyLearningProjectSubmissions(query);
    });

final myLearningProjectSubmissionProvider = FutureProvider.autoDispose
    .family<LearningProjectSubmission, String>((ref, id) async {
      return ref
          .watch(learningHubRepositoryProvider)
          .fetchMyLearningProjectSubmission(id);
    });

final projectBuildProvider = FutureProvider.autoDispose
    .family<ProjectBuild?, String>((ref, projectId) async {
      return ref.watch(learningHubRepositoryProvider).fetchMyBuild(projectId);
    });

/// Loads an owned build attempt by immutable id for portfolio/history views.
final projectBuildByIdProvider = FutureProvider.autoDispose
    .family<ProjectBuild?, String>((ref, buildId) async {
      return unwrapApiResponse(
        ref.watch(apiClientProvider).get<Map<String, dynamic>>(
          '/api/learner/builds/$buildId',
        ),
        LearningHubApiMapper.fromBuildJson,
      );
    });

final smartBuildPlanProvider = FutureProvider.autoDispose
    .family<SmartBuildPlanResult, String>((ref, projectId) async {
      return ref
          .watch(learningHubRepositoryProvider)
          .optimizeBuildPlan(projectId);
    });

void invalidateLearningHubEngagement(WidgetRef ref, String projectId) {
  ref.invalidate(learningProjectProvider(projectId));
  ref.invalidate(learningProjectsProvider);
  ref.invalidate(savedLearningProjectsProvider);
  ref.invalidate(followedLearningProjectsProvider);
}

void invalidateLearningProjectSubmissions(WidgetRef ref, String projectId) {
  ref.invalidate(myLearningProjectSubmissionProvider(projectId));
  ref.invalidate(myLearningProjectSubmissionsProvider);
}
