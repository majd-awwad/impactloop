import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import '../../support/learning_project_authoring_repository_stubs.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/application/ai_assistant_shell_provider.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_helpers.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/domain/authoring_session_models.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_message_bubble.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project_submission.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/project_engagement.dart';
import 'package:frontend/features/learning_hub/domain/project_follow_status.dart';
import 'package:frontend/features/learning_hub/domain/project_save_status.dart';
import 'package:frontend/features/materials/data/models/category.dart';

void main() {
  group('AI action controller flow', () {
    test('confirm endpoint called once', () async {
      final repository = _RecordingAiRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-1');

      await controller.confirmPendingAction(
        pendingActionId: 'pending-1',
        locale: 'en',
      );

      expect(repository.confirmCalls, 1);
      expect(repository.confirmIds, ['pending-1']);
    });

    test('double tap does not send duplicate confirm requests', () async {
      final repository = _SlowConfirmRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-1');

      final first = controller.confirmPendingAction(
        pendingActionId: 'pending-1',
        locale: 'en',
      );
      final second = controller.confirmPendingAction(
        pendingActionId: 'pending-1',
        locale: 'en',
      );
      await Future.wait([first, second]);

      expect(repository.confirmCalls, 1);
    });

    test('cancel endpoint called once', () async {
      final repository = _RecordingAiRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-1');

      await controller.cancelPendingAction('pending-1');

      expect(repository.cancelCalls, 1);
      expect(repository.cancelIds, ['pending-1']);
    });

    test('inline action_result appears after confirm', () async {
      final repository = _RecordingAiRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-1');

      await controller.confirmPendingAction(
        pendingActionId: 'pending-1',
        locale: 'en',
      );

      expect(
        controller.state.messages.first.contentBlocks.any(
          (block) =>
              block.type == 'action_result' && block.actionStatus == 'EXECUTED',
        ),
        isTrue,
      );
    });

    test('confirmation retained after failed confirm', () async {
      final repository = _FailingConfirmRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = AiChatState(
        conversationId: 'conv-1',
        messages: [
          AiMessageItem(
            id: 'assistant-1',
            role: 'ASSISTANT',
            status: 'COMPLETED',
            contentText: null,
            contentBlocks: const [
              AiContentBlock(
                type: 'action_confirmation',
                pendingActionId: 'pending-1',
                actionType: 'SAVE_MATERIAL',
                actionTitle: 'Save this material?',
                actionSummary: 'Arduino kit',
              ),
            ],
            createdAt: DateTime.utc(2026, 1, 1),
          ),
        ],
      );

      await controller.confirmPendingAction(
        pendingActionId: 'pending-1',
        locale: 'en',
      );

      expect(
        controller.state.messages.first.contentBlocks.any(
          (block) => block.type == 'action_confirmation',
        ),
        isTrue,
      );
      expect(
        controller.state.actionErrors['pending-1']?.message,
        'Action confirmation failed.',
      );
    });

    test('history restore keeps executed result visible', () async {
      final repository = _RecordingAiRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      await controller.openConversation('conv-1');

      expect(
        controller.state.messages.first.contentBlocks.any(
          (block) =>
              block.type == 'action_result' && block.actionStatus == 'EXECUTED',
        ),
        isTrue,
      );
    });

    test('build ownership confirm refreshes build guide context', () async {
      final repository = _BuildOwnershipConfirmRepository();
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
        pendingActionId: 'pending-build-1',
        locale: 'en',
      );

      expect(hubRepository.fetchMyBuildCalls, greaterThanOrEqualTo(1));
      expect(hubRepository.lastProjectId, 'project-1');
      final shell = container.read(aiAssistantShellProvider);
      expect(shell.buildGuideContext?.materialReadiness.ready, 3);
      expect(shell.buildGuideContext?.currentStep?.stepNumber, 1);
    });

    test('step completion confirm refreshes project build and guide context', () async {
      final repository = _StepCompletionConfirmRepository();
      final hubRepository = _StepCompletionTrackingBuildRepository();
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
          learningHubRepositoryProvider.overrideWithValue(hubRepository),
          aiAssistantShellProvider.overrideWith(
            () => _StepCompletionShellNotifier(),
          ),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-build');

      await controller.confirmPendingAction(
        pendingActionId: 'pending-step-1',
        locale: 'en',
      );

      expect(repository.confirmCalls, 1);
      expect(repository.lastConfirmedActionType, 'COMPLETE_CURRENT_BUILD_STEP');
      expect(hubRepository.fetchMyBuildCalls, greaterThanOrEqualTo(2));
      expect(hubRepository.lastProjectId, 'project-1');
      final shell = container.read(aiAssistantShellProvider);
      expect(shell.buildGuideContext?.stepProgress.completed, 1);
      expect(shell.buildGuideContext?.stepProgress.percent, 100);
      expect(shell.buildGuideContext?.buildStatus, ProjectBuildStatus.completed);
      expect(shell.buildGuideContext?.currentStep, isNull);
    });
  });

  group('AI action confirmation widgets', () {
    testWidgets('executed state disables both buttons', (tester) async {
      await tester.pumpWidget(
        _buildBlockHarness(
          blocks: _confirmationWithResult(status: 'EXECUTED'),
          locale: const Locale('en'),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
      expect(tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed, isNull);
    });

    testWidgets('cancelled state disables both buttons', (tester) async {
      await tester.pumpWidget(
        _buildBlockHarness(
          blocks: _confirmationWithResult(status: 'CANCELLED'),
          locale: const Locale('en'),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
      expect(tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed, isNull);
    });

    testWidgets('expired state disables both buttons', (tester) async {
      await tester.pumpWidget(
        _buildBlockHarness(
          blocks: [
            AiContentBlock(
              type: 'action_confirmation',
              pendingActionId: 'pending-expired',
              actionType: 'SAVE_MATERIAL',
              actionTitle: 'Save this material?',
              actionSummary: 'Arduino kit',
              expiresAt: DateTime.utc(2020, 1, 1),
            ),
          ],
          locale: const Locale('en'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('This confirmation has expired.'), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
    });

    testWidgets('executing state shows progress and prevents interaction', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiRepositoryProvider.overrideWithValue(_SlowConfirmRepository()),
          ],
          child: MaterialApp(
            locale: const Locale('en'),
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en'), Locale('ar')],
            home: Scaffold(
              body: Consumer(
                builder: (context, ref, _) {
                  ref.watch(aiAssistantControllerProvider);
                  return AiMessageBubble(
                    locale: 'en',
                    message: AiMessageItem(
                      id: 'assistant-1',
                      role: 'ASSISTANT',
                      status: 'COMPLETED',
                      contentText: null,
                      contentBlocks: const [
                        AiContentBlock(
                          type: 'action_confirmation',
                          pendingActionId: 'pending-1',
                          actionType: 'SAVE_MATERIAL',
                          actionTitle: 'Save this material?',
                          actionSummary: 'Arduino kit',
                        ),
                      ],
                      createdAt: DateTime.utc(2026, 1, 1),
                    ),
                  );
                },
              ),
            ),
          ),
        ),
      );
      await tester.pump();

      final container =
          ProviderScope.containerOf(tester.element(find.byType(MaterialApp)));
      container.read(aiAssistantControllerProvider.notifier).state =
          container.read(aiAssistantControllerProvider).copyWith(
                conversationId: 'conv-1',
                pendingActionBusyId: 'pending-1',
              );
      await tester.pump();

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed, isNull);
    });

    testWidgets('Arabic RTL layout keeps action buttons usable', (tester) async {
      await tester.pumpWidget(
        _buildBlockHarness(
          blocks: [
            AiContentBlock(
              type: 'action_confirmation',
              pendingActionId: 'pending-ar',
              actionType: 'SAVE_MATERIAL',
              actionTitle: 'حفظ هذه المادة؟',
              actionSummary: 'عدة Arduino',
              confirmLabel: 'تأكيد',
              cancelLabel: 'إلغاء',
            ),
          ],
          locale: const Locale('ar'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('تأكيد'), findsOneWidget);
      expect(find.text('إلغاء'), findsOneWidget);
    });

    testWidgets('grouped build ownership confirmation shows canonical components', (
      tester,
    ) async {
      await tester.pumpWidget(
        _buildBlockHarness(
          blocks: const [
            AiContentBlock(
              type: 'action_confirmation',
              pendingActionId: 'pending-build-group',
              actionType: 'UPDATE_BUILD_COMPONENT_STATUSES',
              actionTitle: 'Mark components as already owned?',
              actionSummary:
                  'I will mark these components as already owned:\n- LED\n- Resistor',
              confirmLabel: 'Confirm',
              cancelLabel: 'Cancel',
            ),
          ],
          locale: Locale('en'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('LED'), findsOneWidget);
      expect(find.textContaining('Resistor'), findsOneWidget);
      expect(find.text('Confirm'), findsOneWidget);
      expect(find.text('Cancel'), findsOneWidget);
    });

    testWidgets('Arabic grouped ownership summary stays within narrow width', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        _buildBlockHarness(
          blocks: const [
            AiContentBlock(
              type: 'action_confirmation',
              pendingActionId: 'pending-build-ar',
              actionType: 'UPDATE_BUILD_COMPONENT_STATUSES',
              actionTitle: 'تحديد المكونات كموجودة لديك؟',
              actionSummary:
                  'سيتم تحديد المكونات التالية كـموجودة لديك:\n- LED\n- مقاومة',
              confirmLabel: 'تأكيد',
              cancelLabel: 'إلغاء',
            ),
          ],
          locale: Locale('ar'),
          maxWidth: 300,
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('تأكيد'), findsOneWidget);
      expect(find.textContaining('LED'), findsOneWidget);
    });

    testWidgets('narrow mobile width avoids horizontal overflow', (tester) async {
      tester.view.physicalSize = const Size(320, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        _buildBlockHarness(
          blocks: [
            AiContentBlock(
              type: 'action_confirmation',
              pendingActionId: 'pending-narrow',
              actionType: 'SAVE_MATERIAL',
              actionTitle: 'Save this material?',
              actionSummary: 'A very long material title that should wrap safely',
            ),
          ],
          locale: const Locale('en'),
          maxWidth: 300,
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });

    testWidgets('external_sources rendering shows safe link text', (tester) async {
      await tester.pumpWidget(
        _buildBlockHarness(
          blocks: [
            AiContentBlock(
              type: 'external_sources',
              externalSources: const [
                AiExternalSourceItem(
                  title: 'Arduino Wire library',
                  url: 'https://www.arduino.cc/reference/en/language/functions/communication/wire/',
                  snippet: 'Official Wire reference.',
                ),
              ],
            ),
          ],
          locale: const Locale('en'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Arduino Wire library'), findsOneWidget);
      expect(find.text('Official Wire reference.'), findsOneWidget);
    });
  });

  group('AI action helpers', () {
    test('resolveActionConfirmationUiState marks executed results disabled', () {
      final blocks = _confirmationWithResult(status: 'EXECUTED');
      final state = resolveActionConfirmationUiState(
        block: blocks.first,
        messageBlocks: blocks,
        blockIndex: 0,
        pendingActionBusyId: null,
        actionErrorMessage: null,
      );

      expect(state.isDisabled, isTrue);
      expect(state.resolvedStatus, 'EXECUTED');
    });

    test('reconcileConversationMessages preserves pending confirmation blocks', () {
      const pendingId = 'pending-link-1';
      final current = [
        AiMessageItem(
          id: 'assistant-new',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: _linkConfirmationBlocks(pendingId: pendingId),
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 1),
        ),
      ];
      final incoming = [
        AiMessageItem(
          id: 'assistant-new',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: const [
            AiContentBlock(
              type: 'text',
              text: 'سأربط المادة بالمكوّن.',
              purpose: 'answer',
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 1),
        ),
      ];

      final reconciled = reconcileConversationMessages(
        current: current,
        incoming: incoming,
      );

      expect(reconciled, hasLength(1));
      expect(
        reconciled.single.contentBlocks.any(
          (block) =>
              block.type == 'action_confirmation' &&
              block.pendingActionId == pendingId,
        ),
        isTrue,
      );
    });

    test('reconcileConversationMessages keeps newer local-only assistant turn', () {
      final current = [
        AiMessageItem(
          id: 'user-new',
          role: 'USER',
          status: 'COMPLETED',
          contentText: 'اربط أول وحدة',
          contentBlocks: const [],
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 0),
        ),
        AiMessageItem(
          id: 'assistant-new',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: _linkConfirmationBlocks(),
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 1),
        ),
      ];
      final incoming = [
        AiMessageItem(
          id: 'user-old',
          role: 'USER',
          status: 'COMPLETED',
          contentText: 'لاقيلّي مواد',
          contentBlocks: const [],
          createdAt: DateTime.utc(2026, 7, 8, 11, 0, 0),
        ),
      ];

      final reconciled = reconcileConversationMessages(
        current: current,
        incoming: incoming,
      );

      expect(reconciled, hasLength(3));
      expect(
        reconciled.where((message) => message.id == 'assistant-new'),
        hasLength(1),
      );
      expect(
        reconciled
            .firstWhere((message) => message.id == 'assistant-new')
            .contentBlocks
            .any((block) => block.type == 'action_confirmation'),
        isTrue,
      );
    });

    test('reconcileConversationMessages keeps step completion confirmation', () {
      const pendingId = 'pending-step-complete';
      final current = [
        AiMessageItem(
          id: 'assistant-new',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: _stepCompletionConfirmationBlocks(pendingId: pendingId),
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 1),
        ),
      ];
      final incoming = [
        AiMessageItem(
          id: 'assistant-new',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: const [
            AiContentBlock(
              type: 'text',
              text: 'راجع التفاصيل ثم أكّد إكمال الخطوة:',
              purpose: 'answer',
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 1),
        ),
      ];

      final reconciled = reconcileConversationMessages(
        current: current,
        incoming: incoming,
      );

      expect(reconciled, hasLength(1));
      expect(
        reconciled.single.contentBlocks.any(
          (block) =>
              block.type == 'action_confirmation' &&
              block.pendingActionId == pendingId &&
              block.actionType == 'COMPLETE_CURRENT_BUILD_STEP',
        ),
        isTrue,
      );
    });
  });

  group('Build guide step completion stability', () {
    test('close and reopen restores pending step completion confirmation', () async {
      final repository = _CanonicalHistoryStepCompletionRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-build');

      await controller.openConversation('conv-build');
      expect(
        controller.state.messages.any(
          (message) => message.contentBlocks.any(
            (block) =>
                block.type == 'action_confirmation' &&
                block.pendingActionId == 'pending-step-1' &&
                block.actionType == 'COMPLETE_CURRENT_BUILD_STEP',
          ),
        ),
        isTrue,
      );

      await controller.startNewChat();
      expect(
        controller.state.messages.any(
          (message) => message.contentBlocks.any(
            (block) => block.type == 'action_confirmation',
          ),
        ),
        isFalse,
      );

      await controller.openConversation('conv-build');
      expect(
        controller.state.messages.any(
          (message) => message.contentBlocks.any(
            (block) =>
                block.type == 'action_confirmation' &&
                block.pendingActionId == 'pending-step-1',
          ),
        ),
        isTrue,
      );
    });
  });

  group('Build guide link confirmation stability', () {
    test('send keeps action_confirmation after background reload', () async {
      final repository = _StaleReloadLinkRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-build');

      await controller.sendMessage(text: 'اربط أول وحدة', locale: 'ar');
      await Future<void>.delayed(Duration.zero);

      final messages = controller.state.messages;
      expect(messages, hasLength(2));
      expect(
        messages.last.contentBlocks.any(
          (block) =>
              block.type == 'action_confirmation' &&
              block.pendingActionId == 'pending-link-1',
        ),
        isTrue,
      );
    });

    test('stale openConversation reload does not remove newer confirmation', () async {
      final repository = _StaleOpenConversationRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      final openFuture = controller.openConversation('conv-build');
      await controller.sendMessage(text: 'اربط أول وحدة', locale: 'ar');
      await openFuture;
      await Future<void>.delayed(const Duration(milliseconds: 20));

      expect(
        controller.state.messages.last.contentBlocks.any(
          (block) =>
              block.type == 'action_confirmation' &&
              block.pendingActionId == 'pending-link-1',
        ),
        isTrue,
      );
    });

    test('confirmation remains visible after microtasks and timers', () async {
      final repository = _StaleReloadLinkRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-build');

      await controller.sendMessage(text: 'اربط أول وحدة', locale: 'ar');
      await Future<void>.delayed(const Duration(milliseconds: 50));

      final confirmationBlocks = controller.state.messages
          .expand((message) => message.contentBlocks)
          .where((block) => block.type == 'action_confirmation')
          .toList();
      expect(confirmationBlocks, hasLength(1));
      expect(confirmationBlocks.single.pendingActionId, 'pending-link-1');
      expect(confirmationBlocks.single.confirmLabel, 'تأكيد');
    });

    test('projectBuildProvider invalidation keeps confirmation visible', () async {
      final repository = _StaleReloadLinkRepository();
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

      await controller.sendMessage(text: 'اربط أول وحدة', locale: 'ar');
      container.invalidate(projectBuildProvider('project-1'));
      await Future<void>.delayed(const Duration(milliseconds: 10));

      expect(
        controller.state.messages.last.contentBlocks.any(
          (block) => block.type == 'action_confirmation',
        ),
        isTrue,
      );
    });

    test('refreshBuildGuideContext keeps confirmation visible', () async {
      final repository = _StaleReloadLinkRepository();
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

      await controller.sendMessage(text: 'اربط أول وحدة', locale: 'ar');
      await container
          .read(aiAssistantShellProvider.notifier)
          .refreshBuildGuideContext();

      expect(
        controller.state.messages.last.contentBlocks.any(
          (block) => block.type == 'action_confirmation',
        ),
        isTrue,
      );
      expect(container.read(aiAssistantShellProvider).buildGuideContext, isNotNull);
    });

    test('canonical history reload keeps one confirmation', () async {
      final repository = _CanonicalHistoryLinkRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-build');

      await controller.sendMessage(text: 'اربط أول وحدة', locale: 'ar');
      await controller.openConversation('conv-build');

      final confirmations = controller.state.messages
          .expand((message) => message.contentBlocks)
          .where((block) => block.type == 'action_confirmation')
          .toList();
      expect(confirmations, hasLength(1));
      expect(confirmations.single.pendingActionId, 'pending-link-1');
    });

    test('close and reopen restores pending confirmation from history', () async {
      final repository = _CanonicalHistoryLinkRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      await controller.sendMessage(text: 'اربط أول وحدة', locale: 'ar');

      await controller.startNewChat();
      expect(
        controller.state.messages.any(
          (message) => message.contentBlocks.any(
            (block) => block.type == 'action_confirmation',
          ),
        ),
        isFalse,
      );

      await controller.openConversation('conv-build');
      expect(
        controller.state.messages.any(
          (message) => message.contentBlocks.any(
            (block) =>
                block.type == 'action_confirmation' &&
                block.pendingActionId == 'pending-link-1',
          ),
        ),
        isTrue,
      );
    });

    test('link confirm calls endpoint once and keeps executed result', () async {
      final repository = _LinkConfirmOnceRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = AiChatState(
        conversationId: 'conv-build',
        messages: [
          AiMessageItem(
            id: 'assistant-link-1',
            role: 'ASSISTANT',
            status: 'COMPLETED',
            contentText: null,
            contentBlocks: _linkConfirmationBlocks(),
            createdAt: DateTime.utc(2026, 7, 8),
          ),
        ],
      );

      await controller.confirmPendingAction(
        pendingActionId: 'pending-link-1',
        locale: 'ar',
      );

      expect(repository.confirmCalls, 1);
      final assistantMessage = controller.state.messages.firstWhere(
        (message) => message.id == 'assistant-link-1',
      );
      expect(
        assistantMessage.contentBlocks.any(
          (block) =>
              block.type == 'action_result' &&
              block.actionStatus == 'EXECUTED',
        ),
        isTrue,
      );
      expect(
        assistantMessage.contentBlocks.any(
          (block) => block.type == 'action_confirmation',
        ),
        isTrue,
      );
    });

    test('link cancel performs zero confirm writes and keeps cancelled result', () async {
      final repository = _LinkCancelRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = AiChatState(
        conversationId: 'conv-build',
        messages: [
          AiMessageItem(
            id: 'assistant-link-1',
            role: 'ASSISTANT',
            status: 'COMPLETED',
            contentText: null,
            contentBlocks: _linkConfirmationBlocks(),
            createdAt: DateTime.utc(2026, 7, 8),
          ),
        ],
      );

      await controller.cancelPendingAction('pending-link-1');

      expect(repository.confirmCalls, 0);
      expect(repository.cancelCalls, 1);
      final assistantMessage = controller.state.messages.firstWhere(
        (message) => message.id == 'assistant-link-1',
      );
      expect(
        assistantMessage.contentBlocks.any(
          (block) =>
              block.type == 'action_result' &&
              block.actionStatus == 'CANCELLED',
        ),
        isTrue,
      );
    });

    test('general save confirmation flow remains unchanged', () async {
      final repository = _RecordingAiRepository();
      final container = _container(repository);
      addTearDown(container.dispose);

      final controller = container.read(aiAssistantControllerProvider.notifier);
      controller.state = const AiChatState(conversationId: 'conv-1');

      await controller.confirmPendingAction(
        pendingActionId: 'pending-1',
        locale: 'en',
      );

      expect(repository.confirmCalls, 1);
      expect(
        controller.state.messages.first.contentBlocks.any(
          (block) =>
              block.type == 'action_result' && block.actionStatus == 'EXECUTED',
        ),
        isTrue,
      );
    });
  });
}

ProviderContainer _container(AiRepository repository) {
  return ProviderContainer(
    overrides: [aiRepositoryProvider.overrideWithValue(repository)],
  );
}

List<AiContentBlock> _linkConfirmationBlocks({String pendingId = 'pending-link-1'}) {
  return [
    const AiContentBlock(
      type: 'text',
      text: 'سأربط المادة بالمكوّن.',
      purpose: 'answer',
    ),
    AiContentBlock(
      type: 'action_confirmation',
      pendingActionId: pendingId,
      actionType: 'LINK_MATERIAL_TO_BUILD_COMPONENT',
      actionTitle: 'ربط المادة بالمكوّن؟',
      actionSummary: 'سيتم ربط LED بمكوّن LED.',
      confirmLabel: 'تأكيد',
      cancelLabel: 'إلغاء',
    ),
  ];
}

List<AiContentBlock> _stepCompletionConfirmationBlocks({
  String pendingId = 'pending-step-complete',
}) {
  return [
    AiContentBlock(
      type: 'action_confirmation',
      pendingActionId: pendingId,
      actionType: 'COMPLETE_CURRENT_BUILD_STEP',
      actionTitle: 'Did you finish Step 1: Wire LED?',
      actionSummary: 'Current progress: 0%.',
      confirmLabel: 'Yes, I finished it',
      cancelLabel: 'Cancel',
    ),
  ];
}

List<AiContentBlock> _confirmationWithResult({required String status}) {
  return [
    const AiContentBlock(
      type: 'action_confirmation',
      pendingActionId: 'pending-1',
      actionType: 'SAVE_MATERIAL',
      actionTitle: 'Save this material?',
      actionSummary: 'Arduino kit',
    ),
    AiContentBlock(
      type: 'action_result',
      actionType: 'SAVE_MATERIAL',
      actionStatus: status,
      actionTitle: status == 'EXECUTED' ? 'Material saved' : 'Action cancelled',
      actionSummary: status == 'EXECUTED' ? 'Material saved' : 'Cancelled',
    ),
  ];
}

Widget _buildBlockHarness({
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

class _RecordingAiRepository implements AiRepository {
  int confirmCalls = 0;
  int cancelCalls = 0;
  final List<String> confirmIds = [];
  final List<String> cancelIds = [];

  @override
  Future<void> archiveConversation({required String conversationId}) async {}

  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    confirmCalls += 1;
    confirmIds.add(pendingActionId);
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'SAVE_MATERIAL',
      actionStatus: 'EXECUTED',
      actionTitle: 'Material saved',
      actionSummary: 'Material saved',
    );
  }

  @override
  Future<AiContentBlock?> cancelPendingAction({required String pendingActionId}) async {
    cancelCalls += 1;
    cancelIds.add(pendingActionId);
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'SAVE_MATERIAL',
      actionStatus: 'CANCELLED',
      actionTitle: 'Action cancelled',
      actionSummary: 'Cancelled',
    );
  }

  @override
  Future<AiConversationSummary> createConversation({
    required String locale,
    String? title,
  }) async {
    return AiConversationSummary(
      id: 'conv-created',
      mode: 'LEARNER_ASSISTANT',
      locale: locale,
      title: title,
      preview: null,
      updatedAt: DateTime.utc(2026, 1, 1),
    );
  }

  @override
  Future<AiConversationListPage> listConversations({
    int limit = 20,
    int page = 1,
    AiConversationStatus status = AiConversationStatus.active,
  }) async {
    return const AiConversationListPage(items: [], total: 0);
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
        mode: 'LEARNER_ASSISTANT',
        locale: 'en',
        title: null,
        preview: null,
        updatedAt: DateTime.utc(2026, 1, 1),
      ),
      items: [
        AiMessageItem(
          id: 'assistant-1',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: _confirmationWithResult(status: 'EXECUTED'),
          createdAt: DateTime.utc(2026, 1, 1),
        ),
      ],
    );
  }

  @override
  Future<void> restoreConversation({required String conversationId}) async {}

  @override
  Future<AiTurnResponse> sendMessage({
    required String conversationId,
    required String text,
    required String locale,
    required String clientMessageId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> startAuthoring({required String conversationId}) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> generateAuthoringProposal({
    required String conversationId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> submitAuthoringProposalReview({
    required String conversationId,
    required String proposalId,
    required String target,
    required String decision,
    String? comment,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> reviseAuthoringProposal({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> prepareApplyReviewedAuthoringProposal({
    required String conversationId,
    required String reviewStateId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> submitAuthoringProposalDiscussion({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
    required String target,
    required String comment,
    required String clientMessageId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> runSequentialAuthoringAction({
    required String conversationId,
    required String action,
    String? turnId,
    String? comment,
    String? clientMessageId,
    Object? manualValue,
    String? mode,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> discussSequentialAuthoringTurn({
    required String conversationId,
    required String turnId,
    required String comment,
    required String clientMessageId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiAuthoringSnapshot?> loadSequentialAuthoringState({
    required String conversationId,
  }) async {
    return null;
  }

  @override
  Future<AuthoringSessionResponse> startAuthoringSession({
    required String conversationId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AuthoringSessionResponse> loadAuthoringSession({
    required String sessionId,
  }) async {
    throw UnimplementedError();
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
    throw UnimplementedError();
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
    throw UnimplementedError();
  }
}

class _SlowConfirmRepository extends _RecordingAiRepository {
  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    confirmCalls += 1;
    confirmIds.add(pendingActionId);
    await Future<void>.delayed(const Duration(milliseconds: 50));
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'SAVE_MATERIAL',
      actionStatus: 'EXECUTED',
      actionTitle: 'Material saved',
      actionSummary: 'Material saved',
    );
  }
}

class _FailingConfirmRepository extends _RecordingAiRepository {
  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    confirmCalls += 1;
    throw const ApiException(
      message: 'Action confirmation failed.',
      code: 'AI_ACTION_EXECUTION_FAILED',
    );
  }
}

class _BuildOwnershipConfirmRepository extends _RecordingAiRepository {
  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    confirmCalls += 1;
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'UPDATE_BUILD_COMPONENT_STATUSES',
      actionStatus: 'EXECUTED',
      actionTitle: 'Components updated',
      actionSummary: 'LED and Resistor marked as already owned.',
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
        locale: 'en',
        title: null,
        preview: null,
        updatedAt: DateTime.utc(2026, 1, 1),
      ),
      items: const [],
    );
  }
}

class _TrackingBuildRepository implements LearningProjectRepository {
  int fetchMyBuildCalls = 0;
  String? lastProjectId;

  ProjectBuild _refreshedBuild(String projectId) {
    return ProjectBuild(
      id: 'build-1',
      projectId: projectId,
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Test project',
        shortDescription: '',
      ),
      progress: const ProjectBuildProgress(total: 3, ready: 3, percent: 100),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 3,
        linked: 0,
        reserved: 0,
        missing: 0,
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
        steps: [],
      ),
      items: const [],
    );
  }

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    fetchMyBuildCalls += 1;
    lastProjectId = projectId;
    return _refreshedBuild(projectId);
  }

  @override
  Future<LearningProjectsResult> fetchProjects(
    LearningProjectsQuery query,
  ) async {
    return const LearningProjectsResult(
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    );
  }

  @override
  Future<LearningProjectsResult> fetchSavedProjects(
    LearningProjectsQuery query,
  ) async {
    return fetchProjects(query);
  }

  @override
  Future<LearningProjectsResult> fetchFollowedProjects(
    LearningProjectsQuery query,
  ) async {
    return fetchProjects(query);
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
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmission> updateMyLearningProjectSubmission(
    String id,
    Map<String, dynamic> payload,
  ) async {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmission> resubmitMyLearningProjectSubmission(
    String id,
  ) async {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmission> submitMyLearningProjectDraft(
    String id, {
    required String idempotencyKey,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectBuild> startBuild(
    String projectId, {
    String? recommendationImpressionId,
  }) async {
    return _refreshedBuild(projectId);
  }

  @override
  Future<ProjectBuild> updateBuildItem(
    String projectId,
    String itemId, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
    String? recommendationImpressionId,
  }) async {
    return _refreshedBuild(projectId);
  }

  @override
  Future<BuildMaterialCandidatesResult> fetchMaterialCandidates(
    String projectId,
    String itemId,
  ) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectBuild> linkMaterial(
    String projectId,
    String itemId, {
    required String materialId,
  }) async {
    return _refreshedBuild(projectId);
  }

  @override
  Future<ProjectBuild> unlinkMaterial(String projectId, String itemId) async {
    return _refreshedBuild(projectId);
  }

  @override
  Future<ProjectBuild> completeBuildStep(String projectId, String stepId) async {
    return _refreshedBuild(projectId);
  }

  @override
  Future<BuildGuideConversationResult> getOrCreateBuildGuideConversation(
    String projectId,
  ) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectEngagement> likeProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectEngagement> unlikeProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectSaveStatus> saveProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectSaveStatus> unsaveProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectFollowStatus> followProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectFollowStatus> unfollowProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<List<MaterialCategory>> fetchProjectCategories() async => const [];

  @override
  Future<List<MaterialCategory>> fetchMaterialCategories() async => const [];

  @override
  Future<void> reviewProject(
    String id, {
    required int rating,
    String? comment,
  }) async {}

  @override
  Future<void> deleteProjectReview(String id) async {}

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
  }) async {}

  @override
  Future<LearningProjectAuthoringSession> createAiAuthoringDraft({
    required String ideaText,
    required String categoryId,
    required String difficulty,
    required String idempotencyKey,
    String? locale,
  }) =>
      unimplementedCreateAiAuthoringDraft(
        ideaText: ideaText,
        categoryId: categoryId,
        difficulty: difficulty,
        idempotencyKey: idempotencyKey,
        locale: locale,
      );

  @override
  Future<LearningProjectAuthoringSession> getOrCreateAuthoringConversation({
    required String projectId,
    String? locale,
  }) =>
      unimplementedGetOrCreateAuthoringConversation(
        projectId: projectId,
        locale: locale,
      );
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

class _StepCompletionConfirmRepository extends _RecordingAiRepository {
  String? lastConfirmedActionType;

  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    confirmCalls += 1;
    confirmIds.add(pendingActionId);
    lastConfirmedActionType = 'COMPLETE_CURRENT_BUILD_STEP';
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'COMPLETE_CURRENT_BUILD_STEP',
      actionStatus: 'EXECUTED',
      actionTitle: 'Step completed',
      actionSummary: 'Build completed.',
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
        locale: 'en',
        title: null,
        preview: null,
        updatedAt: DateTime.utc(2026, 1, 1),
      ),
      items: const [],
    );
  }
}

class _StepCompletionTrackingBuildRepository implements LearningProjectRepository {
  int fetchMyBuildCalls = 0;
  String? lastProjectId;

  ProjectBuild _inProgressBuild(String projectId) {
    return ProjectBuild(
      id: 'build-1',
      projectId: projectId,
      status: ProjectBuildStatus.inProgress,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Test project',
        shortDescription: '',
      ),
      progress: const ProjectBuildProgress(total: 1, ready: 1, percent: 100),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 1,
        linked: 0,
        reserved: 0,
        missing: 0,
        total: 1,
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
        nextAction: ProjectBuildNextAction.completeCurrentStep,
        steps: [
          ProjectBuildStepView(
            stepId: 'step-1',
            stepNumber: 1,
            title: 'Wire LED',
            description: 'Wire the LED',
            state: ProjectBuildStepState.current,
          ),
        ],
      ),
      items: const [],
    );
  }

  ProjectBuild _completedBuild(String projectId) {
    return ProjectBuild(
      id: 'build-1',
      projectId: projectId,
      status: ProjectBuildStatus.completed,
      project: const ProjectBuildProject(
        id: 'project-1',
        title: 'Test project',
        shortDescription: '',
      ),
      progress: const ProjectBuildProgress(total: 1, ready: 1, percent: 100),
      materialReadiness: const ProjectBuildMaterialReadiness(
        ready: 1,
        linked: 0,
        reserved: 0,
        missing: 0,
        total: 1,
      ),
      stepProgress: const ProjectBuildStepProgress(
        completed: 1,
        total: 1,
        percent: 100,
        currentStep: null,
        nextAction: ProjectBuildNextAction.buildCompleted,
        steps: [
          ProjectBuildStepView(
            stepId: 'step-1',
            stepNumber: 1,
            title: 'Wire LED',
            description: 'Wire the LED',
            state: ProjectBuildStepState.completed,
          ),
        ],
      ),
      items: const [],
    );
  }

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    fetchMyBuildCalls += 1;
    lastProjectId = projectId;
    if (fetchMyBuildCalls >= 2) {
      return _completedBuild(projectId);
    }
    return _inProgressBuild(projectId);
  }

  @override
  Future<LearningProjectsResult> fetchProjects(
    LearningProjectsQuery query,
  ) async {
    return const LearningProjectsResult(
      items: [],
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    );
  }

  @override
  Future<LearningProjectsResult> fetchSavedProjects(
    LearningProjectsQuery query,
  ) async {
    return fetchProjects(query);
  }

  @override
  Future<LearningProjectsResult> fetchFollowedProjects(
    LearningProjectsQuery query,
  ) async {
    return fetchProjects(query);
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
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmission> updateMyLearningProjectSubmission(
    String id,
    Map<String, dynamic> payload,
  ) async {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmission> resubmitMyLearningProjectSubmission(
    String id,
  ) async {
    throw UnimplementedError();
  }

  @override
  Future<LearningProjectSubmission> submitMyLearningProjectDraft(
    String id, {
    required String idempotencyKey,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectBuild> startBuild(
    String projectId, {
    String? recommendationImpressionId,
  }) async {
    return _inProgressBuild(projectId);
  }

  @override
  Future<ProjectBuild> updateBuildItem(
    String projectId,
    String itemId, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
    String? recommendationImpressionId,
  }) async {
    return fetchMyBuildCalls >= 2
        ? _completedBuild(projectId)
        : _inProgressBuild(projectId);
  }

  @override
  Future<BuildMaterialCandidatesResult> fetchMaterialCandidates(
    String projectId,
    String itemId,
  ) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectBuild> linkMaterial(
    String projectId,
    String itemId, {
    required String materialId,
  }) async {
    return _inProgressBuild(projectId);
  }

  @override
  Future<ProjectBuild> unlinkMaterial(String projectId, String itemId) async {
    return _inProgressBuild(projectId);
  }

  @override
  Future<ProjectBuild> completeBuildStep(String projectId, String stepId) async {
    return _completedBuild(projectId);
  }

  @override
  Future<BuildGuideConversationResult> getOrCreateBuildGuideConversation(
    String projectId,
  ) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectEngagement> likeProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectEngagement> unlikeProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectSaveStatus> saveProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectSaveStatus> unsaveProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectFollowStatus> followProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<ProjectFollowStatus> unfollowProject(
    String id, {
    String? recommendationImpressionId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<List<MaterialCategory>> fetchProjectCategories() async => const [];

  @override
  Future<List<MaterialCategory>> fetchMaterialCategories() async => const [];

  @override
  Future<void> reviewProject(
    String id, {
    required int rating,
    String? comment,
  }) async {}

  @override
  Future<void> deleteProjectReview(String id) async {}

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
  }) async {}

  @override
  Future<LearningProjectAuthoringSession> createAiAuthoringDraft({
    required String ideaText,
    required String categoryId,
    required String difficulty,
    required String idempotencyKey,
    String? locale,
  }) =>
      unimplementedCreateAiAuthoringDraft(
        ideaText: ideaText,
        categoryId: categoryId,
        difficulty: difficulty,
        idempotencyKey: idempotencyKey,
        locale: locale,
      );

  @override
  Future<LearningProjectAuthoringSession> getOrCreateAuthoringConversation({
    required String projectId,
    String? locale,
  }) =>
      unimplementedGetOrCreateAuthoringConversation(
        projectId: projectId,
        locale: locale,
      );
}

class _StepCompletionShellNotifier extends AiAssistantShellNotifier {
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
          missing: 0,
          total: 1,
        ),
        currentStep: ProjectBuildCurrentStep(
          stepId: 'step-1',
          stepNumber: 1,
          title: 'Wire LED',
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

class _StaleReloadLinkRepository implements AiRepository {
  int listCalls = 0;

  @override
  Future<void> archiveConversation({required String conversationId}) async {}

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
      actionTitle: 'تم الربط',
      actionSummary: 'تم ربط المادة.',
    );
  }

  @override
  Future<AiContentBlock?> cancelPendingAction({required String pendingActionId}) async {
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'LINK_MATERIAL_TO_BUILD_COMPONENT',
      actionStatus: 'CANCELLED',
      actionTitle: 'تم الإلغاء',
      actionSummary: 'تم الإلغاء.',
    );
  }

  @override
  Future<AiConversationSummary> createConversation({
    required String locale,
    String? title,
  }) async {
    return AiConversationSummary(
      id: 'conv-build',
      mode: 'LEARNER_ASSISTANT',
      locale: locale,
      title: title,
      preview: null,
      updatedAt: DateTime.utc(2026, 7, 8),
    );
  }

  @override
  Future<AiConversationListPage> listConversations({
    int limit = 20,
    int page = 1,
    AiConversationStatus status = AiConversationStatus.active,
  }) async {
    return const AiConversationListPage(items: [], total: 0);
  }

  @override
  Future<AiConversationMessagesPage> listMessages({
    required String conversationId,
    int limit = 50,
    int page = 1,
  }) async {
    listCalls += 1;
    await Future<void>.delayed(const Duration(milliseconds: 5));
    return AiConversationMessagesPage(
      conversation: AiConversationSummary(
        id: conversationId,
        mode: 'LEARNER_ASSISTANT',
        locale: 'ar',
        title: null,
        preview: null,
        updatedAt: DateTime.utc(2026, 7, 8),
      ),
      items: [
        AiMessageItem(
          id: 'user-link-1',
          role: 'USER',
          status: 'COMPLETED',
          contentText: 'اربط أول وحدة',
          contentBlocks: const [],
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 0),
        ),
        AiMessageItem(
          id: 'assistant-link-1',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: const [
            AiContentBlock(
              type: 'text',
              text: 'سأربط المادة بالمكوّن.',
              purpose: 'answer',
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 1),
        ),
      ],
    );
  }

  @override
  Future<void> restoreConversation({required String conversationId}) async {}

  @override
  Future<AiTurnResponse> sendMessage({
    required String conversationId,
    required String text,
    required String locale,
    required String clientMessageId,
  }) async {
    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'user-link-1',
      assistantMessageId: 'assistant-link-1',
      contentBlocks: _linkConfirmationBlocks(),
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
  }

  @override
  Future<AiTurnResponse> startAuthoring({required String conversationId}) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> generateAuthoringProposal({
    required String conversationId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> submitAuthoringProposalReview({
    required String conversationId,
    required String proposalId,
    required String target,
    required String decision,
    String? comment,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> reviseAuthoringProposal({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> prepareApplyReviewedAuthoringProposal({
    required String conversationId,
    required String reviewStateId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> submitAuthoringProposalDiscussion({
    required String conversationId,
    required String proposalId,
    required String reviewStateId,
    required String target,
    required String comment,
    required String clientMessageId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> runSequentialAuthoringAction({
    required String conversationId,
    required String action,
    String? turnId,
    String? comment,
    String? clientMessageId,
    Object? manualValue,
    String? mode,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiTurnResponse> discussSequentialAuthoringTurn({
    required String conversationId,
    required String turnId,
    required String comment,
    required String clientMessageId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AiAuthoringSnapshot?> loadSequentialAuthoringState({
    required String conversationId,
  }) async {
    return null;
  }

  @override
  Future<AuthoringSessionResponse> startAuthoringSession({
    required String conversationId,
  }) async {
    throw UnimplementedError();
  }

  @override
  Future<AuthoringSessionResponse> loadAuthoringSession({
    required String sessionId,
  }) async {
    throw UnimplementedError();
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
    throw UnimplementedError();
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
    throw UnimplementedError();
  }
}

class _StaleOpenConversationRepository extends _StaleReloadLinkRepository {
  @override
  Future<AiConversationMessagesPage> listMessages({
    required String conversationId,
    int limit = 50,
    int page = 1,
  }) async {
    listCalls += 1;
    await Future<void>.delayed(const Duration(milliseconds: 25));
    return AiConversationMessagesPage(
      conversation: AiConversationSummary(
        id: conversationId,
        mode: 'LEARNER_ASSISTANT',
        locale: 'ar',
        title: null,
        preview: null,
        updatedAt: DateTime.utc(2026, 7, 8),
      ),
      items: const [],
    );
  }
}

class _CanonicalHistoryLinkRepository extends _StaleReloadLinkRepository {
  @override
  Future<AiConversationMessagesPage> listMessages({
    required String conversationId,
    int limit = 50,
    int page = 1,
  }) async {
    listCalls += 1;
    return AiConversationMessagesPage(
      conversation: AiConversationSummary(
        id: conversationId,
        mode: 'LEARNER_ASSISTANT',
        locale: 'ar',
        title: null,
        preview: null,
        updatedAt: DateTime.utc(2026, 7, 8),
      ),
      items: [
        AiMessageItem(
          id: 'user-link-1',
          role: 'USER',
          status: 'COMPLETED',
          contentText: 'اربط أول وحدة',
          contentBlocks: const [],
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 0),
        ),
        AiMessageItem(
          id: 'assistant-link-1',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: _linkConfirmationBlocks(),
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 1),
        ),
      ],
    );
  }
}

class _LinkConfirmOnceRepository extends _CanonicalHistoryLinkRepository {
  int confirmCalls = 0;

  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    confirmCalls += 1;
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'LINK_MATERIAL_TO_BUILD_COMPONENT',
      actionStatus: 'EXECUTED',
      actionTitle: 'تم الربط',
      actionSummary: 'تم ربط المادة.',
    );
  }
}

class _LinkCancelRepository extends _CanonicalHistoryLinkRepository {
  int confirmCalls = 0;
  int cancelCalls = 0;

  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    confirmCalls += 1;
    throw UnimplementedError();
  }

  @override
  Future<AiContentBlock?> cancelPendingAction({required String pendingActionId}) async {
    cancelCalls += 1;
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'LINK_MATERIAL_TO_BUILD_COMPONENT',
      actionStatus: 'CANCELLED',
      actionTitle: 'تم الإلغاء',
      actionSummary: 'تم الإلغاء.',
    );
  }
}

class _CanonicalHistoryStepCompletionRepository extends _RecordingAiRepository {
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
        locale: 'en',
        title: null,
        preview: null,
        updatedAt: DateTime.utc(2026, 7, 8),
      ),
      items: [
        AiMessageItem(
          id: 'user-step-1',
          role: 'USER',
          status: 'COMPLETED',
          contentText: 'خلصت الخطوة',
          contentBlocks: const [],
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 0),
        ),
        AiMessageItem(
          id: 'assistant-step-1',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: _stepCompletionConfirmationBlocks(
            pendingId: 'pending-step-1',
          ),
          createdAt: DateTime.utc(2026, 7, 8, 12, 0, 1),
        ),
      ],
    );
  }
}
