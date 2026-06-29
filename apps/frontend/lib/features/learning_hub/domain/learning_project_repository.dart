import 'learning_projects_result.dart';
import 'models/learning_project.dart';
import '../../materials/data/models/category.dart';

abstract class LearningProjectRepository {
  Future<LearningProjectsResult> fetchProjects(LearningProjectsQuery query);

  Future<LearningProject?> fetchProjectById(String id);

  Future<List<MaterialCategory>> fetchProjectCategories();
}
