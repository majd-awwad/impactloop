import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/ai/application/ai_assistant_shell_provider.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_message_bubble.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build_material_link.dart';
import 'package:frontend/shared/models/localized_text.dart';

void main() {
  group('Build guide material blocks', () {
    testWidgets('missing-component checklist renders in narrow side panel', (
      tester,
    ) async {
      await tester.pumpWidget(
        _blockHarness(
          maxWidth: 400,
          locale: const Locale('ar'),
          blocks: const [
            AiContentBlock(
              type: 'text',
              text: 'هذه المكونات ما زالت غير جاهزة للتنفيذ (2):',
            ),
            AiContentBlock(
              type: 'build_checklist',
              buildId: 'build-1',
              projectId: 'project-1',
              readyCount: 1,
              totalRequired: 3,
              checklistItems: [
                AiBuildChecklistItem(
                  componentId: 'cmp-resistor',
                  name: 'Resistor',
                  status: 'MISSING',
                  readinessLabel: 'Missing',
                ),
                AiBuildChecklistItem(
                  componentId: 'cmp-breadboard',
                  name: 'Breadboard',
                  status: 'MISSING',
                  readinessLabel: 'Missing',
                ),
              ],
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Resistor'), findsOneWidget);
      expect(find.text('Breadboard'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('component match cards fit 400px panel without overflow', (
      tester,
    ) async {
      await tester.pumpWidget(
        _blockHarness(
          maxWidth: 400,
          locale: const Locale('en'),
          blocks: const [
            AiContentBlock(
              type: 'component_matches',
              buildId: 'build-1',
              matchGroups: [
                AiComponentMatchGroup(
                  componentId: 'cmp-led',
                  componentName: 'LED',
                  materials: [
                    AiMaterialCardItem(
                      materialId: 'mat-led',
                      title: '[test] available LED with a longer title for wrapping',
                      priceLabel: 'Free',
                      categoryLabel: 'Electronics',
                      condition: 'GOOD',
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('LED'), findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('link confirmation card renders in Arabic RTL panel', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 720);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        _blockHarness(
          maxWidth: 380,
          locale: const Locale('ar'),
          blocks: const [
            AiContentBlock(
              type: 'action_confirmation',
              pendingActionId: 'pending-link-1',
              actionType: 'LINK_MATERIAL_TO_BUILD_COMPONENT',
              actionTitle: 'ربط المادة بالمكوّن؟',
              actionSummary:
                  'سيتم ربط [test] available LED بمكوّن LED. المادة لم تُستلم بعد.',
              confirmLabel: 'تأكيد',
              cancelLabel: 'إلغاء',
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('تأكيد'), findsOneWidget);
      expect(find.textContaining('LED'), findsWidgets);
      expect(tester.takeException(), isNull);
    });

    testWidgets('step completion confirmation fits narrow Arabic RTL panel', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(390, 720);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        _blockHarness(
          maxWidth: 380,
          locale: const Locale('ar'),
          blocks: const [
            AiContentBlock(
              type: 'action_confirmation',
              pendingActionId: 'pending-step-1',
              actionType: 'COMPLETE_CURRENT_BUILD_STEP',
              actionTitle: 'هل أنهيت الخطوة 1: توصيل LED؟',
              actionSummary: 'التقدم الحالي: 0%.',
              confirmLabel: 'نعم، أنهيتها',
              cancelLabel: 'إلغاء',
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('نعم، أنهيتها'), findsOneWidget);
      expect(find.text('إلغاء'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('reservation result shows pending acquisition copy', (
      tester,
    ) async {
      await tester.pumpWidget(
        _blockHarness(
          locale: const Locale('ar'),
          blocks: const [
            AiContentBlock(
              type: 'action_result',
              actionType: 'CONFIRM_MATERIAL_RESERVATION',
              actionStatus: 'EXECUTED',
              actionTitle: 'تم إنشاء الحجز',
              actionSummary:
                  'تم إنشاء الحجز. ستصبح المادة جاهزة للمشروع بعد إتمام الاستلام أو التوصيل.',
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('بعد إتمام الاستلام'),
        findsOneWidget,
      );
    });
  });

  group('Build guide material controller refresh', () {
    test('link confirm refreshes build guide context without inflating ready count', () async {
      final repository = _LinkConfirmRepository();
      final hubRepository = _TrackingBuildRepository();
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
          learningHubRepositoryProvider.overrideWithValue(hubRepository),
          aiAssistantShellProvider.overrideWith(
            () => _BuildGuideShellNotifier(),
          ),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-build');

      await controller.confirmPendingAction(
        pendingActionId: 'pending-link-1',
        locale: 'ar',
      );

      expect(hubRepository.fetchMyBuildCalls, greaterThanOrEqualTo(1));
      expect(hubRepository.lastProjectId, 'project-1');
      final shell = container.read(aiAssistantShellProvider);
      expect(shell.buildGuideContext?.materialReadiness.ready, 1);
      expect(shell.buildGuideContext?.materialReadiness.linked, 1);
      expect(shell.buildGuideContext?.currentStep?.stepNumber, 1);
    });

    test('reservation confirm refreshes build provider and shell context', () async {
      final repository = _ReservationConfirmRepository();
      final hubRepository = _ReservationTrackingBuildRepository();
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
          learningHubRepositoryProvider.overrideWithValue(hubRepository),
          aiAssistantShellProvider.overrideWith(
            () => _BuildGuideShellNotifier(),
          ),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-build');

      await controller.confirmPendingAction(
        pendingActionId: 'pending-reserve-1',
        locale: 'ar',
      );

      expect(hubRepository.fetchMyBuildCalls, greaterThanOrEqualTo(2));
      expect(hubRepository.lastProjectId, 'project-1');
      final shell = container.read(aiAssistantShellProvider);
      expect(shell.buildGuideContext?.materialReadiness.ready, 1);
      expect(shell.buildGuideContext?.materialReadiness.reserved, 1);
      expect(shell.buildGuideContext?.currentStep?.stepNumber, 1);
      final build = await container.read(projectBuildProvider('project-1').future);
      expect(build?.items.first.linkedReservation?.status, 'PENDING');
      expect(build?.items.first.isReadyForBuild, isFalse);
    });

    testWidgets('build step guide block renders in narrow panel', (tester) async {
      await tester.pumpWidget(
        _blockHarness(
          maxWidth: 420,
          locale: const Locale('ar'),
          blocks: const [
            AiContentBlock(
              type: 'text',
              text: 'هيا نبدأ بتنفيذ الخطوة الحالية.',
            ),
            AiContentBlock(
              type: 'build_step_guide',
              buildId: 'build-1',
              projectId: 'project-1',
              actionTitle: 'مشروع LED',
              guideProjectStepId: 'step-1',
              stepNumber: 1,
              totalSteps: 2,
              guideTitle: 'تركيب القطعة الجانبية بعنوان طويل نسبياً للتأكد من الالتفاف',
              guideDescription:
                  'اتبع التعليمات الرسمية المخزنة في المشروع مع مراعاة ترتيب التوصيل.',
              progressPercent: 0,
              completedSteps: 0,
              readyCount: 3,
              totalRequired: 3,
            ),
          ],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('الخطوة 1'), findsOneWidget);
      expect(find.textContaining('تركيب القطعة'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}

Widget _blockHarness({
  required List<AiContentBlock> blocks,
  required Locale locale,
  double maxWidth = 800,
}) {
  return ProviderScope(
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: Scaffold(
        body: Center(
          child: SizedBox(
            width: maxWidth,
            child: AiMessageBubble(
              locale: locale.languageCode,
              message: AiMessageItem(
                id: 'assistant-1',
                role: 'ASSISTANT',
                status: 'COMPLETED',
                contentText: null,
                contentBlocks: blocks,
                createdAt: DateTime.utc(2026, 1, 1),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

class _LinkConfirmRepository implements AiRepository {
  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'LINK_MATERIAL_TO_BUILD_COMPONENT',
      actionStatus: 'EXECUTED',
      actionTitle: 'Material linked',
      actionSummary:
          'تم ربط المادة بالمكوّن. المادة لم تُستلم بعد، لذلك لا تزال غير جاهزة للتنفيذ.',
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
        title: null,
        preview: null,
        updatedAt: DateTime.utc(2026, 1, 1),
      ),
      items: const [],
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _TrackingBuildRepository implements LearningProjectRepository {
  int fetchMyBuildCalls = 0;
  String? lastProjectId;

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    fetchMyBuildCalls += 1;
    lastProjectId = projectId;
    return ProjectBuild(
      id: 'build-1',
      projectId: projectId,
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Test project',
        shortDescription: '',
      ),
      progress: const ProjectBuildProgress(total: 3, ready: 1, percent: 33),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 1,
        linked: 1,
        reserved: 0,
        missing: 2,
        total: 3,
      ),
      stepProgress: const ProjectBuildStepProgress(
        completed: 0,
        total: 1,
        percent: 0,
        currentStep: ProjectBuildCurrentStep(
          stepId: 'step-1',
          stepNumber: 1,
          title: 'Wire LED',
        ),
        steps: [
          ProjectBuildStepView(
            stepId: 'step-1',
            stepNumber: 1,
            title: 'Wire LED',
            description: 'Connect LED',
            state: ProjectBuildStepState.locked,
          ),
        ],
      ),
      items: const [],
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _ReservationTrackingBuildRepository implements LearningProjectRepository {
  int fetchMyBuildCalls = 0;
  String? lastProjectId;

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    fetchMyBuildCalls += 1;
    lastProjectId = projectId;
    return ProjectBuild(
      id: 'build-1',
      projectId: projectId,
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Test project',
        shortDescription: '',
      ),
      progress: const ProjectBuildProgress(total: 3, ready: 1, percent: 33),
      materialReadiness: ProjectBuildMaterialReadiness(
        ready: 1,
        linked: 0,
        reserved: 1,
        missing: 2,
        total: 3,
      ),
      stepProgress: const ProjectBuildStepProgress(
        completed: 0,
        total: 1,
        percent: 0,
        currentStep: ProjectBuildCurrentStep(
          stepId: 'step-1',
          stepNumber: 1,
          title: 'Wire LED',
        ),
        steps: [
          ProjectBuildStepView(
            stepId: 'step-1',
            stepNumber: 1,
            title: 'Wire LED',
            description: 'Connect LED',
            state: ProjectBuildStepState.locked,
          ),
        ],
      ),
      items: [
        ProjectBuildItem(
          id: 'item-led',
          requiredComponentId: 'cmp-led',
          status: ProjectBuildItemStatus.missing,
          isReadyForBuild: false,
          readinessLabel: 'Reservation pending — waiting for supplier',
          linkedMaterial: const LinkedMaterialSummary(
            id: 'mat-led',
            title: 'LED material',
            categoryNameEn: 'Electronics',
            condition: 'GOOD',
            status: 'AVAILABLE',
            isPubliclyAvailable: true,
            isFree: true,
            currency: 'ILS',
            supplierName: 'Supplier',
            city: 'Nablus',
            pickupAllowed: true,
            deliveryAllowed: false,
          ),
          linkedReservation: const LinkedReservationSummary(
            id: 'res-1',
            status: 'PENDING',
            materialId: 'mat-led',
            needsAction: false,
            statusLabel: 'Reservation pending — waiting for supplier',
          ),
          component: const ProjectRequiredComponentItem(
            id: 'cmp-led',
            name: LocalizedText(en: 'LED', ar: 'LED'),
            materialType: 'LED',
            quantity: 1,
            unit: 'piece',
            isRequired: true,
            canBeSubstituted: false,
          ),
        ),
      ],
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _ReservationConfirmRepository implements AiRepository {
  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'CONFIRM_MATERIAL_RESERVATION',
      actionStatus: 'EXECUTED',
      actionTitle: 'Reservation created',
      actionSummary: 'Reservation request created successfully.',
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
        title: null,
        preview: null,
        updatedAt: DateTime.utc(2026, 1, 1),
      ),
      items: const [],
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _BuildGuideShellNotifier extends AiAssistantShellNotifier {
  @override
  AiAssistantShellState build() {
    return const AiAssistantShellState(
      isOpen: true,
      buildGuideContext: BuildGuideContext(
        buildId: 'build-1',
        projectId: 'project-1',
        projectTitle: 'Test project',
        buildStatus: ProjectBuildStatus.inProgress,
        materialReadiness: ProjectBuildMaterialReadiness(
          ready: 1,
          linked: 0,
          reserved: 0,
          missing: 2,
          total: 3,
        ),
        stepProgress: ProjectBuildStepProgressSummary(
          completed: 0,
          total: 1,
          percent: 0,
        ),
      ),
    );
  }
}
