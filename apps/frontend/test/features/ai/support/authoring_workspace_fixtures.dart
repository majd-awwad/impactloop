import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/domain/authoring_session_models.dart';

class RecordedAuthoringCall {
  RecordedAuthoringCall({
    required this.kind,
    this.action,
    this.turnId,
    this.text,
    this.expectedVersion,
    this.targetStage,
    this.mode,
    this.manualValue,
  });

  final String kind;
  final String? action;
  final String? turnId;
  final String? text;
  final int? expectedVersion;
  final String? targetStage;
  final String? mode;
  final Object? manualValue;
}

class ConfigurableAuthoringRepository implements AiRepository {
  ConfigurableAuthoringRepository({
    List<AuthoringSessionResponse>? startResponses,
    Future<AuthoringSessionResponse> Function(String conversationId)? onStart,
    Future<AuthoringSessionResponse> Function(String sessionId)? onLoad,
    Future<AuthoringSessionResponse> Function({
      required String sessionId,
      required int expectedVersion,
      String? text,
      String? clientMessageId,
      String? questionId,
      List<String>? selectedOptionIds,
      String? otherText,
      String? currentTurnId,
    })? onMessage,
    Future<AuthoringSessionResponse> Function({
      required String sessionId,
      required String action,
      required int expectedVersion,
      String? turnId,
      Object? manualValue,
      String? mode,
      String? targetStage,
    })? onAction,
  })  : _startResponses = startResponses ?? const [],
        onStart = onStart,
        onLoad = onLoad,
        onMessage = onMessage,
        onAction = onAction;

  final List<AuthoringSessionResponse> _startResponses;
  Future<AuthoringSessionResponse> Function(String conversationId)? onStart;
  Future<AuthoringSessionResponse> Function(String sessionId)? onLoad;
  Future<AuthoringSessionResponse> Function({
    required String sessionId,
    required int expectedVersion,
    String? text,
    String? clientMessageId,
    String? questionId,
    List<String>? selectedOptionIds,
    String? otherText,
    String? currentTurnId,
  })? onMessage;
  Future<AuthoringSessionResponse> Function({
    required String sessionId,
    required String action,
    required int expectedVersion,
    String? turnId,
    Object? manualValue,
    String? mode,
    String? targetStage,
  })? onAction;

  final List<RecordedAuthoringCall> calls = [];
  int startSessionCalls = 0;
  ApiException? nextError;

  @override
  Future<AuthoringSessionResponse> startAuthoringSession({
    required String conversationId,
  }) async {
    startSessionCalls += 1;
    calls.add(RecordedAuthoringCall(kind: 'start'));
    _throwIfNeeded();
    if (onStart != null) {
      return onStart!(conversationId);
    }
    if (_startResponses.isEmpty) {
      return authoringSessionFixture(conversationId: conversationId);
    }
    return _startResponses[(startSessionCalls - 1).clamp(0, _startResponses.length - 1)];
  }

  @override
  Future<AuthoringSessionResponse> loadAuthoringSession({
    required String sessionId,
  }) async {
    calls.add(RecordedAuthoringCall(kind: 'load'));
    _throwIfNeeded();
    if (onLoad != null) {
      return onLoad!(sessionId);
    }
    return authoringSessionFixture(sessionId: sessionId);
  }

  @override
  Future<AuthoringSessionResponse> sendAuthoringSessionMessage({
    required String sessionId,
    required int expectedVersion,
    String? text,
    String? clientMessageId,
    String? questionId,
    List<String>? selectedOptionIds,
    String? otherText,
    String? currentTurnId,
  }) async {
    calls.add(
      RecordedAuthoringCall(
        kind: 'message',
        text: text,
        expectedVersion: expectedVersion,
      ),
    );
    _throwIfNeeded();
    if (onMessage != null) {
      return onMessage!(
        sessionId: sessionId,
        text: text,
        expectedVersion: expectedVersion,
        clientMessageId: clientMessageId,
        questionId: questionId,
        selectedOptionIds: selectedOptionIds,
        otherText: otherText,
        currentTurnId: currentTurnId,
      );
    }
    return authoringSessionFixture(sessionId: sessionId, version: expectedVersion);
  }

  @override
  Future<AuthoringSessionResponse> runAuthoringSessionAction({
    required String sessionId,
    required String action,
    required int expectedVersion,
    String? turnId,
    Object? manualValue,
    String? mode,
    String? targetStage,
  }) async {
    calls.add(
      RecordedAuthoringCall(
        kind: 'action',
        action: action,
        turnId: turnId,
        expectedVersion: expectedVersion,
        targetStage: targetStage,
        mode: mode,
        manualValue: manualValue,
      ),
    );
    _throwIfNeeded();
    if (onAction != null) {
      return onAction!(
        sessionId: sessionId,
        action: action,
        expectedVersion: expectedVersion,
        turnId: turnId,
        manualValue: manualValue,
        mode: mode,
        targetStage: targetStage,
      );
    }
    return authoringSessionFixture(sessionId: sessionId, version: expectedVersion + 1);
  }

  void _throwIfNeeded() {
    if (nextError != null) {
      final error = nextError!;
      nextError = null;
      throw error;
    }
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError();
}

AuthoringPersistedTurn authoringTurnFixture({
  required String id,
  String stage = 'TITLE',
  String status = 'PROPOSED',
  Map<String, dynamic>? payload,
  String explanation = 'Suggestion',
}) {
  return AuthoringPersistedTurn(
    id: id,
    stage: stage,
    kind: 'PROPOSAL',
    status: status,
    payload: payload ?? const {'value': 'Arduino desk light'},
    explanation: explanation,
    baseProjectUpdatedAt: '2026-07-17T12:00:00.000Z',
  );
}

AiAuthoringCanonicalProject canonicalProjectFixture({
  String projectId = 'project-1',
  String updatedAt = '2026-07-17T12:00:00.000Z',
  String title = 'Arduino desk light',
  String shortDescription = 'Short',
  String description = 'Full description',
  String difficulty = 'BEGINNER',
  int estimatedMinutes = 90,
  List<AiAuthoringProposalComponent> components = const [],
  List<AiAuthoringProposalStep> steps = const [],
}) {
  return AiAuthoringCanonicalProject(
    id: projectId,
    updatedAt: updatedAt,
    title: title,
    shortDescription: shortDescription,
    description: description,
    difficulty: difficulty,
    estimatedMinutes: estimatedMinutes,
    components: components,
    steps: steps,
  );
}

AuthoringSessionResponse authoringSessionFixture({
  String projectId = 'project-1',
  String conversationId = 'conv-1',
  String sessionId = 'session-1',
  int version = 1,
  String stage = 'TITLE',
  String status = 'WAITING_FOR_USER',
  AuthoringPersistedTurn? turn,
  AiAuthoringCanonicalProject? canonicalProject,
  List<String> availableActions = const [
    'ACCEPT_TURN',
    'SUGGEST_ANOTHER',
    'SAVE_MANUAL',
  ],
  Map<String, dynamic>? componentReviewState,
  Map<String, dynamic>? stepReviewState,
  List<String> completedStages = const [],
  List<Map<String, dynamic>> conversationMessages = const [],
}) {
  return AuthoringSessionResponse(
    session: AuthoringPersistedSession(
      id: sessionId,
      conversationId: conversationId,
      learningProjectId: projectId,
      stage: stage,
      status: status,
      version: version,
      completedStages: completedStages,
      baseProjectUpdatedAt: '2026-07-17T12:00:00.000Z',
      componentReviewState: componentReviewState,
      stepReviewState: stepReviewState,
    ),
    currentTurn: turn,
    canonicalProject: canonicalProject ??
        canonicalProjectFixture(projectId: projectId),
    availableActions: availableActions,
    conversationMessages: conversationMessages,
  );
}

AiAuthoringSnapshot snapshotFromSession(AuthoringSessionResponse response) {
  return authoringSessionResponseToSnapshot(response);
}

List<Map<String, dynamic>> longComponentPayload({int count = 12}) {
  return List.generate(
    count,
    (index) => {
      'componentName': 'Component $index',
      'materialType': 'Electronic',
      'quantity': index + 1,
      'unit': 'piece',
      'componentRole': 'REQUIRED_MATERIAL',
      'isRequired': true,
      'canBeSubstituted': false,
      'notes': 'Note $index',
    },
  );
}

List<Map<String, dynamic>> longStepPayload({int count = 10}) {
  return List.generate(
    count,
    (index) => {
      'title': 'Step ${index + 1}',
      'description': 'Description for step ${index + 1}',
      'safetyNote': index.isEven ? 'Wear goggles' : null,
    },
  );
}
