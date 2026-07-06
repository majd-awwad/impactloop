import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../materials/data/models/category.dart';
import '../data/learning_project_draft_storage.dart';
import '../domain/learning_project_repository.dart';
import '../domain/learning_projects_result.dart';
import '../domain/models/learning_project.dart';

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

void invalidateLearningHubEngagement(WidgetRef ref, String projectId) {
  ref.invalidate(learningProjectProvider(projectId));
  ref.invalidate(learningProjectsProvider);
  ref.invalidate(savedLearningProjectsProvider);
  ref.invalidate(followedLearningProjectsProvider);
}
