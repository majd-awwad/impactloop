import 'learning_projects_result.dart';
import 'models/learning_project.dart';
import 'models/learning_project_submission.dart'
    show
        LearningProjectAuthoringSession,
        LearningProjectSubmission,
        LearningProjectSubmissionsQuery,
        LearningProjectSubmissionsResult;
import 'models/project_build.dart';
import 'project_engagement.dart';
import 'project_follow_status.dart';
import 'project_save_status.dart';
import '../../materials/data/models/category.dart';

abstract class LearningProjectRepository {
  Future<LearningProjectsResult> fetchProjects(LearningProjectsQuery query);

  Future<LearningProjectsResult> fetchSavedProjects(
    LearningProjectsQuery query,
  );

  Future<LearningProjectsResult> fetchFollowedProjects(
    LearningProjectsQuery query,
  );

  Future<LearningProject?> fetchProjectById(String id);

  Future<LearningProjectSubmissionsResult> fetchMyLearningProjectSubmissions(
    LearningProjectSubmissionsQuery query,
  );

  Future<LearningProjectSubmission> fetchMyLearningProjectSubmission(String id);

  Future<LearningProjectSubmission> updateMyLearningProjectSubmission(
    String id,
    Map<String, dynamic> payload,
  );

  Future<LearningProjectSubmission> resubmitMyLearningProjectSubmission(
    String id,
  );

  Future<LearningProjectSubmission> submitMyLearningProjectDraft(
    String id, {
    required String idempotencyKey,
  });

  Future<ProjectBuild?> fetchMyBuild(String projectId);

  Future<ProjectBuild> startBuild(
    String projectId, {
    String? recommendationImpressionId,
  });

  Future<ProjectBuild> buildAgain(String projectId);

  Future<ProjectBuild> updateBuildItem(
    String projectId,
    String itemId, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
    String? recommendationImpressionId,
  });

  Future<BuildMaterialCandidatesResult> fetchMaterialCandidates(
    String projectId,
    String itemId,
  );

  Future<ProjectBuild> linkMaterial(
    String projectId,
    String itemId, {
    required String materialId,
  });

  Future<ProjectBuild> unlinkMaterial(String projectId, String itemId);

  Future<ProjectBuild> removeAcquiredMaterialFromBuildItem(
    String projectId,
    String itemId, {
    required String materialId,
    required String reservationId,
  });

  Future<ProjectBuild> completeBuildStep(String projectId, String stepId);

  Future<BuildGuideConversationResult> getOrCreateBuildGuideConversation(
    String projectId,
  );

  Future<LearningSessionBundle> fetchLearningSession(String projectId);

  Future<LearningSessionBundle> setupLearningSession(
    String projectId, {
    String? learningGoal,
    int? confidenceBefore,
  });

  Future<BuildLearningSession> updateLearningSession(
    String projectId, {
    String? learningGoal,
    int? confidenceBefore,
  });

  Future<LearningAnswerSubmissionResult> submitLearningAnswer(
    String projectId,
    String assignmentId, {
    required String selectedOptionKey,
  });

  Future<LearningAssignment> skipLearningAssignment(
    String projectId,
    String assignmentId,
  );

  Future<LearningAssignment> viewLearningHint(
    String projectId,
    String assignmentId,
  );

  Future<StepLearningCheck?> fetchStepLearningCheck(
    String projectId,
    String stepId,
  );

  Future<StepLearningCheck> viewStepLearningCheckHint(
    String projectId,
    String stepId,
  );

  Future<StepLearningCheckAnswerSubmission> submitStepLearningCheckAnswer(
    String projectId,
    String stepId, {
    required String selectedOptionKey,
  });

  Future<StepLearningCheck> skipStepLearningCheck(
    String projectId,
    String stepId,
  );

  Future<StepLearningCheckAiHandoff> fetchStepLearningCheckAiHandoff(
    String projectId,
    String stepId,
  );

  Future<FinalLearningCheck> fetchFinalLearningCheck(String projectId);

  Future<FinalLearningAssignment> viewFinalLearningCheckHint(
    String projectId,
    String assignmentId,
  );

  Future<FinalLearningCheckAnswerSubmission> submitFinalLearningCheckAnswer(
    String projectId,
    String assignmentId, {
    required String selectedOptionKey,
  });

  Future<FinalLearningCheckAnswerSubmission> skipFinalLearningCheckAssignment(
    String projectId,
    String assignmentId,
  );

  Future<FinalLearningCheckAiHandoff> fetchFinalLearningCheckAiHandoff(
    String projectId,
    String assignmentId,
  );

  Future<LearningCompletionReflectionResult> updateLearningCompletionReflection(
    String projectId, {
    LearningGoalOutcome? goalOutcome,
    int? confidenceAfter,
    String? finalReflection,
  });

  Future<void> reportLearningAssignmentUnclear(
    String projectId,
    String assignmentId,
  );

  Future<void> clearLearningAssignmentUnclearReport(
    String projectId,
    String assignmentId,
  );

  Future<List<MaterialCategory>> fetchProjectCategories();

  Future<List<MaterialCategory>> fetchMaterialCategories();

  Future<ProjectEngagement> likeProject(
    String id, {
    String? recommendationImpressionId,
  });

  Future<ProjectEngagement> unlikeProject(
    String id, {
    String? recommendationImpressionId,
  });

  Future<ProjectSaveStatus> saveProject(
    String id, {
    String? recommendationImpressionId,
  });

  Future<ProjectSaveStatus> unsaveProject(
    String id, {
    String? recommendationImpressionId,
  });

  Future<ProjectFollowStatus> followProject(
    String id, {
    String? recommendationImpressionId,
  });

  Future<ProjectFollowStatus> unfollowProject(
    String id, {
    String? recommendationImpressionId,
  });

  Future<void> reviewProject(String id, {required int rating, String? comment});

  Future<void> deleteProjectReview(String id);

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

  Future<LearningProjectAuthoringSession> createAiAuthoringDraft({
    required String ideaText,
    required String categoryId,
    required String difficulty,
    required String idempotencyKey,
    String? locale,
  });

  Future<LearningProjectAuthoringSession> getOrCreateAuthoringConversation({
    required String projectId,
    String? locale,
  });
}
