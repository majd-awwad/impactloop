import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project_submission.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_session.dart';
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
  Future<LearningProjectSubmission> submitMyLearningProjectDraft(
    String id, {
    required String idempotencyKey,
  }) async {
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
  Future<ProjectBuild> buildAgain(String projectId) async {
    return startBuild(projectId);
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
  Future<ProjectBuild> removeAcquiredMaterialFromBuildItem(
    String projectId,
    String itemId, {
    required String materialId,
    required String reservationId,
  }) async {
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
  Future<LearningSessionBundle> fetchLearningSession(String projectId) async {
    return const LearningSessionBundle(
      session: null,
      learningSetup: ProjectBuildLearningSetup(
        status: LearningSetupStatus.notRequested,
      ),
    );
  }

  @override
  Future<LearningSessionBundle> setupLearningSession(
    String projectId, {
    String? learningGoal,
    int? confidenceBefore,
  }) async {
    return fetchLearningSession(projectId);
  }

  @override
  Future<BuildLearningSession> updateLearningSession(
    String projectId, {
    String? learningGoal,
    int? confidenceBefore,
  }) async {
    throw UnimplementedError('updateLearningSession');
  }

  @override
  Future<LearningAnswerSubmissionResult> submitLearningAnswer(
    String projectId,
    String assignmentId, {
    required String selectedOptionKey,
  }) async {
    throw UnimplementedError('submitLearningAnswer');
  }

  @override
  Future<LearningAssignment> skipLearningAssignment(
    String projectId,
    String assignmentId,
  ) async {
    throw UnimplementedError('skipLearningAssignment');
  }

  @override
  Future<LearningAssignment> viewLearningHint(
    String projectId,
    String assignmentId,
  ) async {
    throw UnimplementedError('viewLearningHint');
  }

  @override
  Future<StepLearningCheck?> fetchStepLearningCheck(
    String projectId,
    String stepId,
  ) async {
    return null;
  }

  @override
  Future<StepLearningCheck> viewStepLearningCheckHint(
    String projectId,
    String stepId,
  ) async {
    throw UnimplementedError('viewStepLearningCheckHint');
  }

  @override
  Future<StepLearningCheckAnswerSubmission> submitStepLearningCheckAnswer(
    String projectId,
    String stepId, {
    required String selectedOptionKey,
  }) async {
    throw UnimplementedError('submitStepLearningCheckAnswer');
  }

  @override
  Future<StepLearningCheck> skipStepLearningCheck(
    String projectId,
    String stepId,
  ) async {
    throw UnimplementedError('skipStepLearningCheck');
  }

  @override
  Future<StepLearningCheckAiHandoff> fetchStepLearningCheckAiHandoff(
    String projectId,
    String stepId,
  ) async {
    throw UnimplementedError('fetchStepLearningCheckAiHandoff');
  }

  @override
  Future<FinalLearningCheck> fetchFinalLearningCheck(String projectId) async {
    throw UnimplementedError('fetchFinalLearningCheck');
  }

  @override
  Future<FinalLearningAssignment> viewFinalLearningCheckHint(
    String projectId,
    String assignmentId,
  ) async {
    throw UnimplementedError('viewFinalLearningCheckHint');
  }

  @override
  Future<FinalLearningCheckAnswerSubmission> submitFinalLearningCheckAnswer(
    String projectId,
    String assignmentId, {
    required String selectedOptionKey,
  }) async {
    throw UnimplementedError('submitFinalLearningCheckAnswer');
  }

  @override
  Future<FinalLearningCheckAnswerSubmission> skipFinalLearningCheckAssignment(
    String projectId,
    String assignmentId,
  ) async {
    throw UnimplementedError('skipFinalLearningCheckAssignment');
  }

  @override
  Future<FinalLearningCheckAiHandoff> fetchFinalLearningCheckAiHandoff(
    String projectId,
    String assignmentId,
  ) async {
    throw UnimplementedError('fetchFinalLearningCheckAiHandoff');
  }

  @override
  Future<LearningCompletionReflectionResult> updateLearningCompletionReflection(
    String projectId, {
    LearningGoalOutcome? goalOutcome,
    int? confidenceAfter,
    String? finalReflection,
  }) async {
    throw UnimplementedError('updateLearningCompletionReflection');
  }

  @override
  Future<void> reportLearningAssignmentUnclear(
    String projectId,
    String assignmentId,
  ) async {
    throw UnimplementedError('reportLearningAssignmentUnclear');
  }

  @override
  Future<void> clearLearningAssignmentUnclearReport(
    String projectId,
    String assignmentId,
  ) async {
    throw UnimplementedError('clearLearningAssignmentUnclearReport');
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

  @override
  Future<LearningProjectAuthoringSession> createAiAuthoringDraft({
    required String ideaText,
    required String categoryId,
    required String difficulty,
    required String idempotencyKey,
    String? locale,
  }) {
    throw UnimplementedError('createAiAuthoringDraft');
  }

  @override
  Future<LearningProjectAuthoringSession> getOrCreateAuthoringConversation({
    required String projectId,
    String? locale,
  }) {
    throw UnimplementedError('getOrCreateAuthoringConversation');
  }
}
