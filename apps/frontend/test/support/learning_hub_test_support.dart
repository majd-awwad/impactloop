import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project_submission.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/project_engagement.dart';
import 'package:frontend/features/learning_hub/domain/project_follow_status.dart';
import 'package:frontend/features/learning_hub/domain/project_save_status.dart';
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
  Future<LearningProjectsResult> fetchSavedProjects(
    LearningProjectsQuery query,
  ) async {
    return _emptyResult;
  }

  @override
  Future<LearningProjectsResult> fetchFollowedProjects(
    LearningProjectsQuery query,
  ) async {
    return _emptyResult;
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
  ) async {
    throw StateError('No test learning project submission configured.');
  }

  @override
  Future<LearningProjectSubmission> updateMyLearningProjectSubmission(
    String id,
    Map<String, dynamic> payload,
  ) async {
    return fetchMyLearningProjectSubmission(id);
  }

  @override
  Future<LearningProjectSubmission> resubmitMyLearningProjectSubmission(
    String id,
  ) async {
    return fetchMyLearningProjectSubmission(id);
  }

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async => null;

  @override
  Future<ProjectBuild> startBuild(
    String projectId, {
    String? recommendationImpressionId,
  }) async {
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
      items: const [],
    );
  }

  @override
  Future<ProjectBuild> updateBuildItem(
    String projectId,
    String itemId, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
    String? recommendationImpressionId,
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
  Future<ProjectEngagement> likeProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    return ProjectEngagement(projectId: id, likesCount: 1, isLiked: true);
  }

  @override
  Future<ProjectEngagement> unlikeProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    return ProjectEngagement(projectId: id, likesCount: 0, isLiked: false);
  }

  @override
  Future<ProjectSaveStatus> saveProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    return ProjectSaveStatus(projectId: id, isSaved: true);
  }

  @override
  Future<ProjectSaveStatus> unsaveProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    return ProjectSaveStatus(projectId: id, isSaved: false);
  }

  @override
  Future<ProjectFollowStatus> followProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    return ProjectFollowStatus(
      projectId: id,
      followersCount: 1,
      isFollowing: true,
    );
  }

  @override
  Future<ProjectFollowStatus> unfollowProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
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
  Future<List<MaterialCategory>> fetchProjectCategories() async {
    return const [];
  }

  @override
  Future<List<MaterialCategory>> fetchMaterialCategories() async {
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
