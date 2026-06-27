import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../materials/data/models/category.dart';
import '../data/api_learning_hub_repository.dart';
import '../domain/learning_project_repository.dart';
import '../domain/learning_projects_result.dart';
import '../domain/models/learning_project.dart';

final learningHubRepositoryProvider = Provider<LearningProjectRepository>((
  ref,
) {
  return ApiLearningHubRepository(ref.watch(apiClientProvider));
});

final projectCategoriesProvider =
    FutureProvider.autoDispose<List<MaterialCategory>>((ref) {
      return ref.watch(learningHubRepositoryProvider).fetchProjectCategories();
    });

final learningProjectsProvider = FutureProvider.autoDispose
    .family<LearningProjectsResult, LearningProjectsQuery>((ref, query) async {
      return ref.watch(learningHubRepositoryProvider).fetchProjects(query);
    });

final learningProjectProvider = FutureProvider.autoDispose
    .family<LearningProject?, String>((ref, id) async {
      return ref.watch(learningHubRepositoryProvider).fetchProjectById(id);
    });
