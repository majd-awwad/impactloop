import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/materials/data/models/category.dart';

/// Default Learning Hub repository for widget/integration tests.
///
/// Returns empty published-project lists so Home spotlight and Learning Hub
/// pages render without hitting the unconfigured provider stub.
const emptyLearningHubRepository = _EmptyLearningHubRepository();

class _EmptyLearningHubRepository implements LearningProjectRepository {
  const _EmptyLearningHubRepository();

  static const _emptyResult = LearningProjectsResult(
    items: [],
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  );

  @override
  Future<LearningProjectsResult> fetchProjects(
    LearningProjectsQuery query,
  ) async {
    return _emptyResult;
  }

  @override
  Future<LearningProject?> fetchProjectById(String id) async => null;

  @override
  Future<List<MaterialCategory>> fetchProjectCategories() async {
    return const [];
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
  }) async {
    return;
  }
}
