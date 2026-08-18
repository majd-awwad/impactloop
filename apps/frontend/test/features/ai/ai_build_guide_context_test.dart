import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/application/ai_assistant_shell_provider.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/shared/models/localized_text.dart';

void main() {
  group('BuildGuideContext model request payload', () {
    test('PVC Plant Stand step 3 includes live project and step fields without IDs', () {
      final payload = BuildGuideContext.fromProjectBuild(
        _plantStandBuild(currentStepNumber: 3),
      ).toModelRequestPayload();

      expect(payload['projectTitle'], 'PVC Plant Stand');
      expect(payload['buildStatus'], 'IN_PROGRESS');
      expect(payload['currentStepNumber'], 3);
      expect(payload['totalSteps'], 4);
      expect(payload['currentStepTitle'], 'Assemble and connect');
      expect(
        payload['currentStepInstructions'],
        'Join the frame and connect the parts.',
      );
      expect(payload['materialsReady'], 4);
      expect(payload['materialsTotal'], 4);
      expect(payload['materialNames'], ['PVC Pipe', 'Elbow connectors']);
      expect(payload['upcomingStepTitle'], '4. Test and improve');
      expect(payload['completedSteps'], [
        {'stepNumber': 1, 'title': 'Plan and inspect materials'},
        {'stepNumber': 2, 'title': 'Prepare the main parts'},
      ]);

      final encoded = payload.toString();
      expect(encoded.contains('build-plant'), isFalse);
      expect(encoded.contains('project-plant'), isFalse);
      expect(encoded.contains('step-3'), isFalse);
      expect(payload.containsKey('buildId'), isFalse);
      expect(payload.containsKey('projectId'), isFalse);
    });

    test('step 4 payload does not keep step 3 as current', () {
      final step3 = BuildGuideContext.fromProjectBuild(
        _plantStandBuild(currentStepNumber: 3),
      ).toModelRequestPayload();
      final step4 = BuildGuideContext.fromProjectBuild(
        _plantStandBuild(currentStepNumber: 4),
      ).toModelRequestPayload();

      expect(step3['currentStepNumber'], 3);
      expect(step3['currentStepTitle'], 'Assemble and connect');
      expect(step4['currentStepNumber'], 4);
      expect(step4['currentStepTitle'], 'Test and improve');
      expect(step4['currentStepInstructions'], 'Check stability and improve weak joints.');
      expect(step4['upcomingStepTitle'], isNull);
      expect(step4['completedSteps'], [
        {'stepNumber': 1, 'title': 'Plan and inspect materials'},
        {'stepNumber': 2, 'title': 'Prepare the main parts'},
        {'stepNumber': 3, 'title': 'Assemble and connect'},
      ]);
    });

    test('different projects stay scoped to the live build', () {
      final plant = BuildGuideContext.fromProjectBuild(
        _plantStandBuild(currentStepNumber: 3),
      ).toModelRequestPayload();
      final lamp = BuildGuideContext.fromProjectBuild(
        _ledLampBuild(),
      ).toModelRequestPayload();

      expect(plant['projectTitle'], 'PVC Plant Stand');
      expect(plant['currentStepTitle'], 'Assemble and connect');
      expect(lamp['projectTitle'], 'LED Night Light');
      expect(lamp['currentStepTitle'], 'Wire the LED');
      expect(lamp['currentStepNumber'], 1);
      expect(lamp['materialNames'], ['LED', 'Resistor']);
    });
  });

  group('sendMessage attaches live build-guide context', () {
    test('second follow-up in the same conversation still sends live build context', () async {
      final repository = _RecordingSendRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      _openGuide(container, _plantStandBuild(currentStepNumber: 3));
      await _send(container, 'مش فاهم هاي الخطوة');
      expect(repository.lastSentBuildGuideContext?['currentStepNumber'], 3);

      await _send(container, 'شو القطع اللي بدي استخدمها بهالخطوة؟');
      expect(repository.lastSentText, 'شو القطع اللي بدي استخدمها بهالخطوة؟');
      expect(repository.lastSentBuildGuideContext?['projectTitle'], 'PVC Plant Stand');
      expect(repository.lastSentBuildGuideContext?['currentStepNumber'], 3);
      expect(
        repository.lastSentBuildGuideContext?['currentStepTitle'],
        'Assemble and connect',
      );

      await _send(container, 'طيب وبعدها؟');
      expect(repository.lastSentBuildGuideContext?['currentStepNumber'], 3);
    });

    test('timeout keeps activeBuildGuide and retry resends without retyping', () async {
      final repository = _TimeoutThenSuccessRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      _openGuide(container, _plantStandBuild(currentStepNumber: 3));
      await _send(container, 'اشرح لي أكثر مش فاهم اشي!');

      final chatAfterTimeout = container.read(aiAssistantControllerProvider);
      final shellAfterTimeout = container.read(aiAssistantShellProvider);
      expect(chatAfterTimeout.sendError?.code, 'AI_PROVIDER_TIMEOUT');
      expect(chatAfterTimeout.pendingSend?.text, 'اشرح لي أكثر مش فاهم اشي!');
      expect(shellAfterTimeout.buildGuideContext?.projectTitle, 'PVC Plant Stand');
      expect(shellAfterTimeout.buildGuideContext?.currentStep?.stepNumber, 3);
      expect(
        shellAfterTimeout.buildGuideContext?.currentStep?.title,
        'Assemble and connect',
      );

      await container.read(aiAssistantControllerProvider.notifier).retryPendingSend();

      expect(repository.sendCalls, 2);
      expect(repository.lastSentText, 'اشرح لي أكثر مش فاهم اشي!');
      expect(repository.lastSentBuildGuideContext?['projectTitle'], 'PVC Plant Stand');
      expect(repository.lastSentBuildGuideContext?['currentStepNumber'], 3);
      expect(container.read(aiAssistantControllerProvider).sendError, isNull);
      expect(
        container.read(aiAssistantShellProvider).buildGuideContext?.currentStep?.stepNumber,
        3,
      );
    });

    test('short Arabic help still sends project and current step', () async {
      final repository = _RecordingSendRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      _openGuide(container, _plantStandBuild(currentStepNumber: 3));
      await _send(container, 'مش فاهم');

      expect(repository.lastSentText, 'مش فاهم');
      expect(repository.lastSentBuildGuideContext?['projectTitle'], 'PVC Plant Stand');
      expect(repository.lastSentBuildGuideContext?['currentStepNumber'], 3);
      expect(
        repository.lastSentBuildGuideContext?['currentStepTitle'],
        'Assemble and connect',
      );
    });

    test('later send uses live step 4 instead of stale step 3', () async {
      final repository = _RecordingSendRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      _openGuide(container, _plantStandBuild(currentStepNumber: 3));
      await _send(container, 'مش فاهم');
      expect(repository.lastSentBuildGuideContext?['currentStepNumber'], 3);

      container.read(aiAssistantShellProvider.notifier).syncBuildGuideContextFromBuild(
            _plantStandBuild(currentStepNumber: 4),
          );
      await _send(container, 'شو أعمل هسا؟');

      expect(repository.lastSentText, 'شو أعمل هسا؟');
      expect(repository.lastSentBuildGuideContext?['currentStepNumber'], 4);
      expect(
        repository.lastSentBuildGuideContext?['currentStepTitle'],
        'Test and improve',
      );
      expect(
        repository.lastSentBuildGuideContext?['currentStepTitle'],
        isNot('Assemble and connect'),
      );
    });

    test('switching projects scopes the next request to the new build', () async {
      final repository = _RecordingSendRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      _openGuide(container, _plantStandBuild(currentStepNumber: 3));
      await _send(container, 'كيف أوصلهم؟');
      expect(repository.lastSentBuildGuideContext?['projectTitle'], 'PVC Plant Stand');

      container.read(aiAssistantShellProvider.notifier).open(
            buildGuideContext: BuildGuideContext.fromProjectBuild(_ledLampBuild()),
          );
      await _send(container, 'مش فاهم');

      expect(repository.lastSentBuildGuideContext?['projectTitle'], 'LED Night Light');
      expect(repository.lastSentBuildGuideContext?['currentStepTitle'], 'Wire the LED');
      expect(
        repository.lastSentBuildGuideContext?['currentStepTitle'],
        isNot('Assemble and connect'),
      );
    });

    test('composer prefill does not control whether context is sent', () async {
      final repository = _RecordingSendRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      container.read(aiAssistantShellProvider.notifier).open(
            buildGuideContext: BuildGuideContext.fromProjectBuild(
              _plantStandBuild(currentStepNumber: 3),
            ),
            composerPrefill: 'اشرحلي الخطوة الحالية',
          );
      container.read(aiAssistantControllerProvider.notifier).state =
          const AiChatState(conversationId: 'guide-conv-1');

      container.read(aiAssistantShellProvider.notifier).clearComposerPrefill();
      expect(container.read(aiAssistantShellProvider).composerPrefill, isNull);
      expect(
        container.read(aiAssistantShellProvider).buildGuideContext?.projectTitle,
        'PVC Plant Stand',
      );

      await _send(container, 'hello');

      expect(repository.lastSentText, 'hello');
      expect(repository.lastSentBuildGuideContext?['projectTitle'], 'PVC Plant Stand');
      expect(repository.lastSentBuildGuideContext?['currentStepNumber'], 3);
    });
  });
}

ProviderContainer _container(_RecordingSendRepository repository) {
  return ProviderContainer(
    overrides: [
      aiRepositoryProvider.overrideWithValue(repository),
    ],
  );
}

void _openGuide(ProviderContainer container, ProjectBuild build) {
  container.read(aiAssistantShellProvider.notifier).open(
        buildGuideContext: BuildGuideContext.fromProjectBuild(build),
      );
  container.read(aiAssistantControllerProvider.notifier).state =
      const AiChatState(conversationId: 'guide-conv-1');
}

Future<void> _send(ProviderContainer container, String text) {
  return container.read(aiAssistantControllerProvider.notifier).sendMessage(
        text: text,
        locale: 'ar',
      );
}

ProjectBuild _plantStandBuild({required int currentStepNumber}) {
  return ProjectBuild(
    id: 'build-plant',
    projectId: 'project-plant',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-plant',
      title: 'PVC Plant Stand',
      shortDescription: 'A simple plant stand build',
    ),
    progress: const ProjectBuildProgress(total: 4, ready: 4, percent: 100),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 4,
      linked: 4,
      reserved: 0,
      missing: 0,
      total: 4,
    ),
    stepProgress: ProjectBuildStepProgress(
      completed: currentStepNumber - 1,
      total: 4,
      percent: currentStepNumber == 3 ? 50 : 75,
      currentStep: ProjectBuildCurrentStep(
        stepId: 'step-$currentStepNumber',
        stepNumber: currentStepNumber,
        title: currentStepNumber == 3
            ? 'Assemble and connect'
            : 'Test and improve',
      ),
      steps: [
        const ProjectBuildStepView(
          stepId: 'step-1',
          stepNumber: 1,
          title: 'Plan and inspect materials',
          description: 'Review the component list.',
          state: ProjectBuildStepState.completed,
        ),
        const ProjectBuildStepView(
          stepId: 'step-2',
          stepNumber: 2,
          title: 'Prepare the main parts',
          description: 'Cut and organize the parts.',
          state: ProjectBuildStepState.completed,
        ),
        ProjectBuildStepView(
          stepId: 'step-3',
          stepNumber: 3,
          title: 'Assemble and connect',
          description: 'Join the frame and connect the parts.',
          state: currentStepNumber == 3
              ? ProjectBuildStepState.current
              : ProjectBuildStepState.completed,
        ),
        ProjectBuildStepView(
          stepId: 'step-4',
          stepNumber: 4,
          title: 'Test and improve',
          description: 'Check stability and improve weak joints.',
          state: currentStepNumber == 4
              ? ProjectBuildStepState.current
              : ProjectBuildStepState.locked,
        ),
      ],
    ),
    items: [
      _item(id: 'item-pvc', componentId: 'cmp-pvc', name: 'PVC Pipe'),
      _item(id: 'item-elbow', componentId: 'cmp-elbow', name: 'Elbow connectors'),
      _item(id: 'item-pvc-2', componentId: 'cmp-pvc-2', name: 'PVC Pipe'),
    ],
  );
}

ProjectBuild _ledLampBuild() {
  return ProjectBuild(
    id: 'build-lamp',
    projectId: 'project-lamp',
    status: ProjectBuildStatus.inProgress,
    project: const ProjectBuildProject(
      id: 'project-lamp',
      title: 'LED Night Light',
      shortDescription: 'A small lamp',
    ),
    progress: const ProjectBuildProgress(total: 2, ready: 2, percent: 100),
    materialReadiness: const ProjectBuildMaterialReadiness(
      ready: 2,
      linked: 2,
      reserved: 0,
      missing: 0,
      total: 2,
    ),
    stepProgress: const ProjectBuildStepProgress(
      completed: 0,
      total: 2,
      percent: 0,
      currentStep: ProjectBuildCurrentStep(
        stepId: 'step-led-1',
        stepNumber: 1,
        title: 'Wire the LED',
      ),
      steps: [
        ProjectBuildStepView(
          stepId: 'step-led-1',
          stepNumber: 1,
          title: 'Wire the LED',
          description: 'Connect the LED to the resistor.',
          state: ProjectBuildStepState.current,
        ),
        ProjectBuildStepView(
          stepId: 'step-led-2',
          stepNumber: 2,
          title: 'Test the circuit',
          description: 'Power the board and check the LED.',
          state: ProjectBuildStepState.locked,
        ),
      ],
    ),
    items: [
      _item(id: 'item-led', componentId: 'cmp-led', name: 'LED'),
      _item(id: 'item-resistor', componentId: 'cmp-resistor', name: 'Resistor'),
    ],
  );
}

ProjectBuildItem _item({
  required String id,
  required String componentId,
  required String name,
}) {
  return ProjectBuildItem(
    id: id,
    requiredComponentId: componentId,
    status: ProjectBuildItemStatus.alreadyOwned,
    component: ProjectRequiredComponentItem(
      id: componentId,
      name: LocalizedText(en: name, ar: name),
      materialType: 'Hardware',
      quantity: 1,
      unit: 'piece',
      isRequired: true,
      canBeSubstituted: false,
    ),
    isReadyForBuild: true,
    readinessLabel: 'Already owned',
  );
}

class _TimeoutThenSuccessRepository extends _RecordingSendRepository {
  int sendCalls = 0;

  @override
  Future<AiTurnResponse> sendMessage({
    required String conversationId,
    required String text,
    required String locale,
    required String clientMessageId,
    Map<String, Object?>? buildGuideContext,
  }) async {
    sendCalls += 1;
    if (sendCalls == 1) {
      lastSentText = text;
      lastSentBuildGuideContext = buildGuideContext;
      throw const ApiException(
        message: 'The learning assistant timed out. Please try again.',
        code: 'AI_PROVIDER_TIMEOUT',
        statusCode: 504,
      );
    }
    return super.sendMessage(
      conversationId: conversationId,
      text: text,
      locale: locale,
      clientMessageId: clientMessageId,
      buildGuideContext: buildGuideContext,
    );
  }
}

class _RecordingSendRepository implements AiRepository {
  String? lastSentText;
  Map<String, Object?>? lastSentBuildGuideContext;

  @override
  Future<AiTurnResponse> sendMessage({
    required String conversationId,
    required String text,
    required String locale,
    required String clientMessageId,
    Map<String, Object?>? buildGuideContext,
  }) async {
    lastSentText = text;
    lastSentBuildGuideContext = buildGuideContext;
    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'user-1',
      assistantMessageId: 'assistant-1',
      contentBlocks: const [
        AiContentBlock(
          type: 'text',
          text: 'Mock build-guide answer',
          purpose: 'answer',
        ),
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
  }

  @override
  Future<AiConversationMessagesPage> listMessages({
    required String conversationId,
    int limit = 50,
    int page = 1,
  }) async {
    return AiConversationMessagesPage(
      conversation: AiConversationSummary(
        id: conversationId,
        mode: 'BUILD_GUIDE',
        locale: 'ar',
        title: 'Build guide',
        preview: null,
        updatedAt: DateTime.utc(2026, 1, 1),
      ),
      items: const [],
    );
  }

  @override
  Future<AiConversationSummary> createConversation({
    required String locale,
    String? title,
  }) async {
    return AiConversationSummary(
      id: 'guide-conv-1',
      mode: 'BUILD_GUIDE',
      locale: locale,
      title: title,
      preview: null,
      updatedAt: DateTime.utc(2026, 1, 1),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
