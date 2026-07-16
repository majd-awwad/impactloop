import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_helpers.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_message_bubble.dart';

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
  });
}

ProviderContainer _container(AiRepository repository) {
  return ProviderContainer(
    overrides: [aiRepositoryProvider.overrideWithValue(repository)],
  );
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
