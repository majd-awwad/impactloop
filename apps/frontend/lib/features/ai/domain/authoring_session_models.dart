import 'ai_models.dart';

const _authoringDraftPlaceholderTitleEn = 'Untitled draft';
const _authoringDraftPlaceholderTitleAr = 'مسودة بدون عنوان';
const _authoringDraftPlaceholderShortEn = 'Draft in progress';
const _authoringDraftPlaceholderShortAr = 'مسودة قيد الإعداد';
const _authoringDraftPlaceholderDescriptionEn =
    'The project description will be created during guided authoring.';
const _authoringDraftPlaceholderDescriptionAr =
    'سيتم إنشاء وصف المشروع أثناء التأليف الموجّه.';

bool isAuthoringDraftPlaceholderTitle(String value) =>
    value == _authoringDraftPlaceholderTitleEn ||
    value == _authoringDraftPlaceholderTitleAr;

bool isAuthoringDraftPlaceholderShortDescription(String value) =>
    value == _authoringDraftPlaceholderShortEn ||
    value == _authoringDraftPlaceholderShortAr;

bool isAuthoringDraftPlaceholderDescription(String value) =>
    value == _authoringDraftPlaceholderDescriptionEn ||
    value == _authoringDraftPlaceholderDescriptionAr;

String maskAuthoringDraftFieldTitle(String value) =>
    isAuthoringDraftPlaceholderTitle(value) ? '' : value;

String maskAuthoringDraftFieldShortDescription(String value) =>
    isAuthoringDraftPlaceholderShortDescription(value) ? '' : value;

String maskAuthoringDraftFieldDescription(String value) =>
    isAuthoringDraftPlaceholderDescription(value) ? '' : value;

const _authoringDifficultyValues = {'BEGINNER', 'INTERMEDIATE', 'ADVANCED'};

bool isValidAuthoringDifficulty(String? value) {
  final normalized = value?.trim().toUpperCase() ?? '';
  return _authoringDifficultyValues.contains(normalized);
}

String authoringDifficultyForEditor({
  required String maskedDifficulty,
  required Set<String> completedStages,
}) {
  if (!completedStages.contains('DIFFICULTY')) {
    return '';
  }
  if (isValidAuthoringDifficulty(maskedDifficulty)) {
    return maskedDifficulty.trim().toUpperCase();
  }
  return '';
}

AuthoringDraftSnapshot maskAuthoringDraftPlaceholders(AuthoringDraftSnapshot raw) {
  return AuthoringDraftSnapshot(
    title: maskAuthoringDraftFieldTitle(raw.title),
    shortDescription: maskAuthoringDraftFieldShortDescription(raw.shortDescription),
    description: maskAuthoringDraftFieldDescription(raw.description),
    difficulty: raw.difficulty,
    estimatedMinutes: raw.estimatedMinutes,
    components: raw.components,
    steps: raw.steps,
  );
}

AiAuthoringCanonicalProject maskAuthoringCanonicalProjectPlaceholders(
  AiAuthoringCanonicalProject raw,
) {
  return AiAuthoringCanonicalProject(
    id: raw.id,
    updatedAt: raw.updatedAt,
    title: maskAuthoringDraftFieldTitle(raw.title),
    shortDescription: maskAuthoringDraftFieldShortDescription(raw.shortDescription),
    description: maskAuthoringDraftFieldDescription(raw.description),
    difficulty: raw.difficulty,
    estimatedMinutes: raw.estimatedMinutes,
    components: raw.components,
    steps: raw.steps,
  );
}

AiAuthoringCanonicalProject maskAuthoringCanonicalProjectForSession(
  AiAuthoringCanonicalProject raw,
  Set<String> completedStages, {
  String? stage,
}) {
  final masked = maskAuthoringCanonicalProjectPlaceholders(raw);
  if (stage == 'OVERVIEW') {
    return AiAuthoringCanonicalProject(
      id: masked.id,
      updatedAt: masked.updatedAt,
      title: '',
      shortDescription: '',
      description: '',
      difficulty: '',
      estimatedMinutes: null,
      components: masked.components,
      steps: masked.steps,
    );
  }
  return AiAuthoringCanonicalProject(
    id: masked.id,
    updatedAt: masked.updatedAt,
    title: masked.title,
    shortDescription: masked.shortDescription,
    description: masked.description,
    difficulty: authoringDifficultyForEditor(
      maskedDifficulty: masked.difficulty,
      completedStages: completedStages,
    ),
    estimatedMinutes: completedStages.contains('ESTIMATED_DURATION')
        ? masked.estimatedMinutes
        : null,
    components: masked.components,
    steps: masked.steps,
  );
}

class AuthoringWorkspaceKey {
  const AuthoringWorkspaceKey({
    required this.projectId,
    required this.conversationId,
    this.sessionId,
  });

  final String projectId;
  final String conversationId;
  final String? sessionId;

  AuthoringWorkspaceKey copyWith({String? sessionId}) {
    return AuthoringWorkspaceKey(
      projectId: projectId,
      conversationId: conversationId,
      sessionId: sessionId ?? this.sessionId,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is AuthoringWorkspaceKey &&
        other.projectId == projectId &&
        other.conversationId == conversationId &&
        other.sessionId == sessionId;
  }

  @override
  int get hashCode => Object.hash(projectId, conversationId, sessionId);
}

class AuthoringPersistedTurn {
  const AuthoringPersistedTurn({
    required this.id,
    required this.stage,
    required this.kind,
    required this.status,
    required this.payload,
    required this.explanation,
    required this.baseProjectUpdatedAt,
  });

  factory AuthoringPersistedTurn.fromJson(Map<String, dynamic> json) {
    return AuthoringPersistedTurn(
      id: json['id'] as String? ?? '',
      stage: json['stage'] as String? ?? '',
      kind: json['kind'] as String? ?? '',
      status: json['status'] as String? ?? 'PROPOSED',
      payload: json['payload'] is Map
          ? Map<String, dynamic>.from(json['payload'] as Map)
          : const {},
      explanation: json['explanation'] as String? ?? '',
      baseProjectUpdatedAt: json['baseProjectUpdatedAt'] as String? ?? '',
    );
  }

  final String id;
  final String stage;
  final String kind;
  final String status;
  final Map<String, dynamic> payload;
  final String explanation;
  final String baseProjectUpdatedAt;
}

class AuthoringPersistedSession {
  const AuthoringPersistedSession({
    required this.id,
    required this.conversationId,
    required this.learningProjectId,
    required this.stage,
    required this.status,
    required this.version,
    required this.completedStages,
    required this.baseProjectUpdatedAt,
    this.componentReviewState,
    this.stepReviewState,
    this.generationErrorCode,
    this.currentTurnId,
    this.confirmedRequirements,
  });

  factory AuthoringPersistedSession.fromJson(Map<String, dynamic> json) {
    return AuthoringPersistedSession(
      id: json['id'] as String? ?? '',
      conversationId: json['conversationId'] as String? ?? '',
      learningProjectId: json['learningProjectId'] as String? ?? '',
      stage: json['stage'] as String? ?? 'OVERVIEW',
      status: json['status'] as String? ?? 'WAITING_FOR_USER',
      version: (json['version'] as num?)?.toInt() ?? 1,
      completedStages: (json['completedStages'] as List?)
              ?.whereType<String>()
              .toList(growable: false) ??
          const [],
      baseProjectUpdatedAt: json['baseProjectUpdatedAt'] as String? ?? '',
      componentReviewState: json['componentReviewState'] is Map
          ? Map<String, dynamic>.from(json['componentReviewState'] as Map)
          : null,
      stepReviewState: json['stepReviewState'] is Map
          ? Map<String, dynamic>.from(json['stepReviewState'] as Map)
          : null,
      generationErrorCode: json['generationErrorCode'] as String?,
      currentTurnId: json['currentTurnId'] as String?,
      confirmedRequirements: json['confirmedRequirements'] is Map
          ? Map<String, dynamic>.from(json['confirmedRequirements'] as Map)
          : _readConfirmedRequirementsFromComponentState(json['componentReviewState']),
    );
  }

  static Map<String, dynamic>? _readConfirmedRequirementsFromComponentState(Object? value) {
    if (value is! Map) {
      return null;
    }
    final state = Map<String, dynamic>.from(value);
    if (state['confirmedRequirements'] is! Map) {
      return null;
    }
    return Map<String, dynamic>.from(state['confirmedRequirements'] as Map);
  }

  final String id;
  final String conversationId;
  final String learningProjectId;
  final String stage;
  final String status;
  final int version;
  final List<String> completedStages;
  final String baseProjectUpdatedAt;
  final Map<String, dynamic>? componentReviewState;
  final Map<String, dynamic>? stepReviewState;
  final String? generationErrorCode;
  final String? currentTurnId;
  final Map<String, dynamic>? confirmedRequirements;

  int? get requestedStepCount =>
      (confirmedRequirements?['requestedStepCount'] as num?)?.toInt();

  int? get requestedComponentCount =>
      (confirmedRequirements?['requestedComponentCount'] as num?)?.toInt();
}

/// Conversation message helpers for persisted authoring workspace responses.
String? authoringConversationClientMessageId(Map<String, dynamic> message) =>
    message['clientMessageId'] as String?;

class AuthoringSessionResponse {
  const AuthoringSessionResponse({
    required this.session,
    required this.currentTurn,
    required this.canonicalProject,
    required this.availableActions,
    this.conversationMessages = const [],
  });

  factory AuthoringSessionResponse.fromJson(Map<String, dynamic> json) {
    final turnJson = json['currentTurn'];
    return AuthoringSessionResponse(
      session: AuthoringPersistedSession.fromJson(
        Map<String, dynamic>.from(json['session'] as Map? ?? const {}),
      ),
      currentTurn: turnJson is Map
          ? AuthoringPersistedTurn.fromJson(Map<String, dynamic>.from(turnJson))
          : null,
      canonicalProject: AiAuthoringCanonicalProject.fromJson(
        Map<String, dynamic>.from(json['canonicalProject'] as Map? ?? const {}),
      ),
      availableActions: (json['availableActions'] as List?)
              ?.whereType<String>()
              .toList(growable: false) ??
          const [],
      conversationMessages: (json['conversationMessages'] as List?)
              ?.whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(growable: false) ??
          const [],
    );
  }

  final AuthoringPersistedSession session;
  final AuthoringPersistedTurn? currentTurn;
  final AiAuthoringCanonicalProject canonicalProject;
  final List<String> availableActions;
  final List<Map<String, dynamic>> conversationMessages;
}

class AuthoringHistoricalTurnSummary {
  const AuthoringHistoricalTurnSummary({
    required this.turnId,
    required this.stage,
    required this.explanation,
    required this.preview,
  });

  final String turnId;
  final String stage;
  final String explanation;
  final String preview;
}

const _sequentialProgressStages = <String>[
  'TITLE',
  'SHORT_DESCRIPTION',
  'FULL_DESCRIPTION',
  'DIFFICULTY',
  'ESTIMATED_DURATION',
  'COMPONENTS',
  'STEPS',
];

String? _mapProgressStage(String stage) {
  return switch (stage) {
    'TITLE' ||
    'SHORT_DESCRIPTION' ||
    'FULL_DESCRIPTION' ||
    'DIFFICULTY' ||
    'ESTIMATED_DURATION' ||
    'COMPONENTS' =>
      stage,
    'STEPS_OVERVIEW' || 'STEP_REVIEW' => 'STEPS',
    _ => null,
  };
}

Map<String, dynamic>? _readWorkingComponentState(Map<String, dynamic>? value) {
  if (value == null || value['workingComponents'] is! List) {
    return null;
  }
  return value;
}

Map<String, dynamic>? _readWorkingStepState(Map<String, dynamic>? value) {
  if (value == null || value['workingSteps'] is! List) {
    return null;
  }
  return value;
}

AiAuthoringCurrentSuggestion? _buildCurrentSuggestion(AuthoringPersistedTurn? turn) {
  if (turn == null || turn.status != 'PROPOSED') {
    return null;
  }
  if (turn.kind == 'FOLLOW_UP_QUESTION' || turn.kind == 'EXPLANATION') {
    return null;
  }
  final payload = turn.payload;
  return AiAuthoringCurrentSuggestion(
    turnId: turn.id,
    stage: turn.stage,
    explanation: turn.explanation,
    status: turn.status,
    value: payload['value'],
    components: _mapJsonList(
      payload['components'],
      (component) => AiAuthoringProposalComponent.fromJson(component),
    ),
    component: payload['component'] is Map
        ? Map<String, dynamic>.from(payload['component'] as Map)
        : null,
    componentIndex: (payload['index'] as num?)?.toInt(),
    componentTotal: (payload['total'] as num?)?.toInt(),
    steps: _mapJsonList(
      payload['steps'],
      (step) => AiAuthoringProposalStep.fromJson(step),
    ),
    step: payload['title'] is String
        ? {
            'index': payload['index'],
            'title': payload['title'],
            'description': payload['description'],
            'safetyNote': payload['safetyNote'],
          }
        : null,
    stepIndex: (payload['index'] as num?)?.toInt(),
    stepTotal: (payload['total'] as num?)?.toInt(),
  );
}

List<T> _mapJsonList<T>(
  Object? value,
  T Function(Map<String, dynamic> json) mapper,
) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => mapper(Map<String, dynamic>.from(item)))
      .toList(growable: false);
}

String _mapSessionStatus({
  required String stage,
  required String persistedStatus,
}) {
  if (stage == 'COMPLETE' || persistedStatus == 'COMPLETE') {
    return 'COMPLETE';
  }
  return switch (persistedStatus) {
    'GENERATION_FAILED' => 'GENERATION_FAILED',
    'STALE' => 'STALE',
    'WAITING_FOR_ASSISTANT' || 'SAVING' => 'PROCESSING',
    _ => 'WAITING_FOR_USER',
  };
}

AiAuthoringSnapshot authoringSessionResponseToSnapshot(
  AuthoringSessionResponse response, {
  bool hasLegacyBlocks = false,
}) {
  final session = response.session;
  final componentState = _readWorkingComponentState(session.componentReviewState);
  final stepState = _readWorkingStepState(session.stepReviewState);
  final currentTurn = response.currentTurn;
  final legacyTurn = currentTurn == null || currentTurn.status != 'PROPOSED'
      ? null
      : currentTurn;

  final completedStages = session.completedStages
      .map(_mapProgressStage)
      .whereType<String>()
      .toSet()
      .toList(growable: false);
  final completedStageSet = completedStages.toSet();

  var availableActions = List<String>.from(response.availableActions);
  if (hasLegacyBlocks && session.stage == 'OVERVIEW' && !availableActions.contains('CONTINUE_GUIDED')) {
    availableActions = ['CONTINUE_GUIDED'];
  }

  return AiAuthoringSnapshot(
    session: AiAuthoringSnapshotSession(
      sessionId: session.id,
      projectId: session.learningProjectId,
      stage: session.stage,
      status: _mapSessionStatus(
        stage: session.stage,
        persistedStatus: session.status,
      ),
      completedStages: completedStages,
      currentTurnId: session.currentTurnId,
      baseUpdatedAt: session.baseProjectUpdatedAt,
      isStale: session.status == 'STALE',
      componentReviewMode: componentState?['mode'] == 'ONE_BY_ONE'
          ? 'ONE_BY_ONE'
          : componentState?['mode'] == 'FULL_LIST'
              ? 'FULL_LIST'
              : null,
      awaitingComponentsFinalSave: componentState?['awaitingFinalSave'] == true,
      currentComponentIndex: (componentState?['currentIndex'] as num?)?.toInt(),
      componentSourceTotal: componentState?['workingComponents'] is List
          ? (componentState!['workingComponents'] as List).length
          : null,
      stepReviewMode: stepState?['mode'] == 'STEP_BY_STEP'
          ? 'STEP_BY_STEP'
          : stepState?['mode'] == 'FULL_PLAN'
              ? 'FULL_PLAN'
              : null,
      awaitingStepsFinalSave: stepState?['awaitingFinalSave'] == true,
      currentStepIndex: (stepState?['currentIndex'] as num?)?.toInt(),
      workingSteps: _mapJsonList(
        stepState?['workingSteps'],
        (step) => AiAuthoringProposalStep.fromJson(step),
      ),
    ),
    currentTurn: legacyTurn == null
        ? null
        : AiAuthoringTurn(
            turnId: legacyTurn.id,
            sessionId: session.id,
            stage: legacyTurn.stage,
            projectId: session.learningProjectId,
            baseUpdatedAt: legacyTurn.baseProjectUpdatedAt,
            status: legacyTurn.status,
            proposal: legacyTurn.payload,
            explanation: legacyTurn.explanation,
          ),
    currentSuggestion: _buildCurrentSuggestion(legacyTurn),
    canonicalProject: maskAuthoringCanonicalProjectForSession(
      response.canonicalProject,
      completedStageSet,
      stage: session.stage,
    ),
    availableActions: availableActions,
    progress: AiAuthoringSnapshotProgress(
      completed: completedStages.length,
      total: _sequentialProgressStages.length,
    ),
  );
}

String historicalTurnPreview(AuthoringPersistedTurn turn) {
  final payload = turn.payload;
  if (payload['steps'] is List && (payload['steps'] as List).isNotEmpty) {
    return _mapJsonList(
      payload['steps'],
      (step) => AiAuthoringProposalStep.fromJson(step),
    ).map((step) => step.title).join(', ');
  }
  if (payload['components'] is List && (payload['components'] as List).isNotEmpty) {
    return _mapJsonList(
      payload['components'],
      (component) => AiAuthoringProposalComponent.fromJson(component),
    ).map((component) => component.componentName).join(', ');
  }
  if (payload['component'] is Map) {
    return '${(payload['component'] as Map)['componentName']}';
  }
  if (payload['title'] is String) {
    return '${payload['title']}';
  }
  if (payload['value'] != null) {
    return '${payload['value']}';
  }
  return turn.explanation;
}

AuthoringHistoricalTurnSummary historicalSummaryFromTurn(
  AuthoringPersistedTurn turn,
) {
  return AuthoringHistoricalTurnSummary(
    turnId: turn.id,
    stage: turn.stage,
    explanation: turn.explanation,
    preview: historicalTurnPreview(turn),
  );
}

String? mapUiActionToPersistedAction({
  required String uiAction,
  required AuthoringSessionResponse response,
  String? mode,
}) {
  final session = response.session;
  final componentState = _readWorkingComponentState(session.componentReviewState);
  final stepState = _readWorkingStepState(session.stepReviewState);
  switch (uiAction) {
    case 'START':
    case 'CONTINUE_GUIDED':
      return 'START';
    case 'ACCEPT_TURN':
      return 'ACCEPT_CURRENT';
    case 'SUGGEST_ANOTHER':
      return 'SUGGEST_ANOTHER';
    case 'SAVE_MANUAL':
      return 'SAVE_MANUAL';
    case 'REGENERATE_STALE':
      return 'REGENERATE_FAILED_STAGE';
    case 'FINISH':
      return 'FINISH';
    case 'EXPLAIN_STEP':
      return 'EXPLAIN_STEP';
    case 'REVISIT_STAGE':
      return 'REVISIT_STAGE';
    case 'FINALIZE_SECTION':
      if (componentState?['awaitingFinalSave'] == true) {
        return 'FINALIZE_COMPONENTS';
      }
      if (stepState?['awaitingFinalSave'] == true) {
        return 'FINALIZE_STEPS';
      }
      return 'ACCEPT_CURRENT';
    case 'CHOOSE_MODE':
      return switch (mode) {
        'COMPONENTS_FULL_LIST' || 'COMPONENTS_ONE_BY_ONE' => 'CHOOSE_COMPONENT_MODE',
        'STEPS_FULL_PLAN' || 'STEP_BY_STEP' => 'CHOOSE_STEP_MODE',
        _ => switch (session.stage) {
            'COMPONENTS' => 'CHOOSE_COMPONENT_MODE',
            'STEPS_OVERVIEW' || 'STEP_REVIEW' => 'CHOOSE_STEP_MODE',
            _ => null,
          },
      };
    case 'REMOVE_ITEM':
      if (session.stage == 'COMPONENTS' &&
          componentState?['mode'] == 'ONE_BY_ONE') {
        return 'REMOVE_COMPONENT_ITEM';
      }
      if (session.stage == 'STEP_REVIEW' && stepState?['mode'] == 'STEP_BY_STEP') {
        return 'REMOVE_STEP_ITEM';
      }
      return null;
    case 'ADD_ITEM':
      if (session.stage == 'COMPONENTS' &&
          componentState?['mode'] == 'ONE_BY_ONE') {
        return 'ADD_COMPONENT_ITEM';
      }
      if (session.stage == 'STEP_REVIEW' && stepState?['mode'] == 'STEP_BY_STEP') {
        return 'ADD_STEP_ITEM';
      }
      return null;
    case 'BACK_ITEM':
      if (session.stage == 'COMPONENTS' &&
          componentState?['mode'] == 'ONE_BY_ONE') {
        return 'BACK_COMPONENT_ITEM';
      }
      if (session.stage == 'STEP_REVIEW' && stepState?['mode'] == 'STEP_BY_STEP') {
        return 'BACK_STEP_ITEM';
      }
      return null;
    default:
      return null;
  }
}

String? mapUiModeToPersistedMode(String? mode, {String? stage}) {
  final resolved = switch (mode) {
    'COMPONENTS_FULL_LIST' => 'FULL_LIST',
    'COMPONENTS_ONE_BY_ONE' => 'ONE_BY_ONE',
    'STEPS_FULL_PLAN' => 'FULL_PLAN',
    'STEP_BY_STEP' => 'STEP_BY_STEP',
    _ => null,
  };
  if (resolved != null) {
    return resolved;
  }
  return switch (stage) {
    'COMPONENTS' => 'ONE_BY_ONE',
    'STEPS_OVERVIEW' || 'STEP_REVIEW' => 'STEP_BY_STEP',
    _ => null,
  };
}

class AuthoringClarificationOption {
  const AuthoringClarificationOption({
    required this.id,
    required this.label,
    required this.value,
  });

  factory AuthoringClarificationOption.fromJson(Map<String, dynamic> json) {
    return AuthoringClarificationOption(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      value: json['value'] as String? ?? json['label'] as String? ?? '',
    );
  }

  final String id;
  final String label;
  final String value;
}

class AuthoringClarificationSummaryItem {
  const AuthoringClarificationSummaryItem({
    required this.questionId,
    required this.label,
    required this.answer,
  });

  factory AuthoringClarificationSummaryItem.fromJson(Map<String, dynamic> json) {
    return AuthoringClarificationSummaryItem(
      questionId: json['questionId'] as String? ?? '',
      label: json['label'] as String? ?? '',
      answer: json['answer'] as String? ?? '',
    );
  }

  final String questionId;
  final String label;
  final String answer;
}

class AuthoringClarificationQuestion {
  const AuthoringClarificationQuestion({
    required this.questionId,
    required this.question,
    required this.options,
    required this.allowMultiple,
    required this.allowOther,
    required this.otherLabel,
    required this.questionNumber,
    required this.maxQuestions,
    this.helperText,
    this.summary = const [],
  });

  factory AuthoringClarificationQuestion.fromPayload(Map<String, dynamic> payload) {
    var questionId =
        payload['questionId'] as String? ?? payload['questionKey'] as String? ?? '';
    var question = payload['question'] as String? ?? '';
    Object? options = payload['options'];

    final clarification = payload['clarification'];
    if (clarification is Map && question.trim().isEmpty) {
      final nextQuestion = clarification['nextQuestion'];
      if (nextQuestion is Map) {
        questionId = '${nextQuestion['key'] ?? questionId}'.trim();
        question = '${nextQuestion['prompt'] ?? question}'.trim();
        if (options is! List && nextQuestion['options'] is List) {
          final rawOptions = nextQuestion['options'] as List;
          options = rawOptions
              .asMap()
              .entries
              .map(
                (entry) => {
                  'id': '$questionId-${entry.key + 1}',
                  'label': '${entry.value}',
                  'value': '${entry.value}',
                },
              )
              .toList(growable: false);
        }
      }
    }

    final parsedOptions = options is List
        ? _dedupeClarificationOptions(
            options
                .whereType<Map>()
                .map((item) => AuthoringClarificationOption.fromJson(
                      Map<String, dynamic>.from(item),
                    ))
                .where((option) => option.id.isNotEmpty && option.label.isNotEmpty)
                .toList(growable: false),
          )
        : const <AuthoringClarificationOption>[];

    return AuthoringClarificationQuestion(
      questionId: questionId,
      question: question,
      options: parsedOptions,
      allowMultiple: payload['allowMultiple'] == true,
      allowOther: payload['allowOther'] != false,
      otherLabel: payload['otherLabel'] as String? ?? 'Other',
      helperText: payload['helperText'] as String?,
      questionNumber: (payload['questionNumber'] as num?)?.toInt() ?? 1,
      maxQuestions: (payload['maxQuestions'] as num?)?.toInt() ?? 4,
      summary: _parseClarificationSummary(payload['clarificationSummary']),
    );
  }

  final String questionId;
  final String question;
  final List<AuthoringClarificationOption> options;
  final bool allowMultiple;
  final bool allowOther;
  final String otherLabel;
  final String? helperText;
  final int questionNumber;
  final int maxQuestions;
  final List<AuthoringClarificationSummaryItem> summary;
}

List<AuthoringClarificationOption> _dedupeClarificationOptions(
  List<AuthoringClarificationOption> options,
) {
  final seenIds = <String>{};
  final seenValues = <String>{};
  final deduped = <AuthoringClarificationOption>[];
  for (final option in options) {
    final valueKey = option.value.trim().toLowerCase();
    if (!seenIds.add(option.id) || (valueKey.isNotEmpty && !seenValues.add(valueKey))) {
      continue;
    }
    deduped.add(option);
  }
  return deduped;
}

List<AuthoringClarificationSummaryItem> _parseClarificationSummary(Object? value) {
  if (value is! List) {
    return const [];
  }
  return value
      .whereType<Map>()
      .map((item) => AuthoringClarificationSummaryItem.fromJson(
            Map<String, dynamic>.from(item),
          ))
      .where((item) => item.questionId.isNotEmpty && item.answer.isNotEmpty)
      .toList(growable: false);
}

AuthoringClarificationQuestion? clarificationQuestionFromTurn(
  AuthoringPersistedTurn? turn,
) {
  if (turn == null || turn.stage != 'OVERVIEW' || turn.kind != 'FOLLOW_UP_QUESTION') {
    return null;
  }
  final question = AuthoringClarificationQuestion.fromPayload(turn.payload);
  if (question.question.trim().isEmpty) {
    return null;
  }
  return question;
}

AuthoringClarificationQuestion? clarificationQuestionFromProposal(
  Map<String, dynamic>? payload, {
  required String stage,
}) {
  if (payload == null || stage != 'OVERVIEW') {
    return null;
  }
  final question = AuthoringClarificationQuestion.fromPayload(payload);
  if (question.question.trim().isEmpty) {
    return null;
  }
  return question;
}
