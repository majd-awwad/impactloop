import 'package:frontend/features/learning_hub/domain/models/learning_project_submission.dart';

Future<LearningProjectAuthoringSession> unimplementedCreateAiAuthoringDraft({
  required String ideaText,
  required String categoryId,
  required String difficulty,
  required String idempotencyKey,
  String? locale,
}) {
  throw UnimplementedError('createAiAuthoringDraft');
}

Future<LearningProjectAuthoringSession> unimplementedGetOrCreateAuthoringConversation({
  required String projectId,
  String? locale,
}) {
  throw UnimplementedError('getOrCreateAuthoringConversation');
}
