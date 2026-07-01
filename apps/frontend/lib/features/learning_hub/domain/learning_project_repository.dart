import 'learning_projects_result.dart';
import 'models/learning_project.dart';
import '../../materials/data/models/category.dart';

abstract class LearningProjectRepository {
  Future<LearningProjectsResult> fetchProjects(LearningProjectsQuery query);

  Future<LearningProject?> fetchProjectById(String id);

  Future<List<MaterialCategory>> fetchProjectCategories();

  Future<void> submitProjectForReview({
    required String title,
    required String shortDescription,
    required String description,
    required String categoryId,
    required String difficulty,
    List<Map<String, dynamic>>? requiredComponents,
    List<Map<String, dynamic>>? steps,
    List<Map<String, dynamic>>? links,
  });
}
