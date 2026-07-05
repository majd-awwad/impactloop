import 'learning_projects_result.dart';
import 'models/learning_project.dart';
import 'project_engagement.dart';
import 'project_follow_status.dart';
import 'project_save_status.dart';
import '../../materials/data/models/category.dart';

abstract class LearningProjectRepository {
  Future<LearningProjectsResult> fetchProjects(LearningProjectsQuery query);

  Future<LearningProject?> fetchProjectById(String id);

  Future<List<MaterialCategory>> fetchProjectCategories();

  Future<ProjectEngagement> likeProject(String id);

  Future<ProjectEngagement> unlikeProject(String id);

  Future<ProjectSaveStatus> saveProject(String id);

  Future<ProjectSaveStatus> unsaveProject(String id);

  Future<ProjectFollowStatus> followProject(String id);

  Future<ProjectFollowStatus> unfollowProject(String id);

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
  });
}
