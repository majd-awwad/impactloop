import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/widgets/app_mobile_bottom_nav_bar.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/application/ai_assistant_shell_provider.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_helpers.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/presentation/l10n/ai_l10n.dart';
import 'package:frontend/features/ai/presentation/pages/general_learning_chat_page.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_assistant_launcher.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_assistant_shell.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_message_bubble.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';

void main() {
  group('ImpactLoop Assistant', () {
    test('createClientMessageId stays stable for retry attempts', () {
      final first = createClientMessageId();
      final second = createClientMessageId();
      expect(first, isNotEmpty);
      expect(second, isNotEmpty);
      expect(first == second, isFalse);
    });

    test('createClientMessageId avoids web-unsafe nextInt bound', () {
      // On Flutter web, `1 << 32` evaluates to 0 and crashes Random.nextInt(0).
      for (var i = 0; i < 100; i++) {
        expect(() => createClientMessageId(), returnsNormally);
      }
      expect(createClientMessageId(), startsWith('cmsg-'));
    });

    test('AiTurnResponse maps mock backend envelope', () {
      final turn = AiTurnResponse.fromJson({
        'conversationId': 'conv-1',
        'userMessageId': 'msg-user-1',
        'assistantMessageId': 'msg-assistant-1',
        'contentBlocks': [
          {
            'type': 'text',
            'text': 'Arduino Uno is a microcontroller board.',
            'purpose': 'answer',
          },
        ],
        'meta': {'scopeClassification': 'DOMAIN_KNOWLEDGE'},
      });

      expect(turn.conversationId, 'conv-1');
      expect(turn.userMessageId, 'msg-user-1');
      expect(turn.assistantMessageId, 'msg-assistant-1');
      expect(turn.scopeClassification, 'DOMAIN_KNOWLEDGE');
      expect(turn.contentBlocks, hasLength(1));
      expect(turn.contentBlocks.first.text, 'Arduino Uno is a microcontroller board.');
    });

    test('controller shows user message before API completes', () async {
      final repository = _FakeAiRepository(sendDelay: const Duration(seconds: 5));
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      final notifier = container.read(aiAssistantControllerProvider.notifier);
      final sendFuture = notifier.sendMessage(
        text: 'How does Arduino Uno work?',
        locale: 'en',
      );

      var state = container.read(aiAssistantControllerProvider);
      expect(state.isSending, isTrue);
      expect(state.messages, hasLength(1));
      expect(state.messages.single.role, 'USER');
      expect(state.messages.single.contentText, 'How does Arduino Uno work?');

      await sendFuture;

      state = container.read(aiAssistantControllerProvider);
      expect(state.isSending, isFalse);
      expect(state.messages, hasLength(2));
      expect(state.messages.last.role, 'ASSISTANT');
      expect(
        state.messages.last.contentBlocks.first.text,
        'Mock answer for How does Arduino Uno work?',
      );
    });

    test('controller keeps user message visible on API failure', () async {
      final repository = _FakeAiRepository(
        failSendWith: const ApiException(
          message: 'Provider failed',
          code: 'AI_PROVIDER_ERROR',
        ),
      );
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      await container.read(aiAssistantControllerProvider.notifier).sendMessage(
            text: 'What is ESP32?',
            locale: 'en',
          );

      final state = container.read(aiAssistantControllerProvider);
      expect(state.isSending, isFalse);
      expect(state.sendError?.code, 'AI_PROVIDER_ERROR');
      expect(state.messages, hasLength(1));
      expect(state.messages.single.role, 'USER');
      expect(state.messages.single.contentText, 'What is ESP32?');
      expect(state.pendingSend?.clientMessageId, isNotEmpty);
    });

    test('controller retry reuses clientMessageId without duplicate user bubble', () async {
      final repository = _RetryOnceAiRepository();
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      final notifier = container.read(aiAssistantControllerProvider.notifier);
      await notifier.sendMessage(text: 'Retry me', locale: 'en');
      final firstPendingId =
          container.read(aiAssistantControllerProvider).pendingSend?.clientMessageId;
      expect(firstPendingId, isNotNull);

      await notifier.retryPendingSend();

      final state = container.read(aiAssistantControllerProvider);
      expect(repository.sendCalls, 2);
      expect(repository.firstClientMessageId, repository.lastClientMessageId);
      expect(
        state.messages.where((message) => message.role == 'USER').length,
        1,
      );
      expect(state.messages.last.role, 'ASSISTANT');
    });

    test('controller lazily creates conversation on first send', () async {
      final repository = _FakeAiRepository();
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      expect(container.read(aiAssistantControllerProvider).conversationId, isNull);

      await container.read(aiAssistantControllerProvider.notifier).sendMessage(
            text: 'First message',
            locale: 'en',
          );

      final state = container.read(aiAssistantControllerProvider);
      expect(state.conversationId, 'conv-created');
      expect(repository.sendCalls, 1);
    });

    test('controller onAccepted runs after optimistic state is applied', () async {
      final repository = _FakeAiRepository(sendDelay: const Duration(seconds: 5));
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      var accepted = false;
      final sendFuture = container
          .read(aiAssistantControllerProvider.notifier)
          .sendMessage(
            text: 'Pending send',
            locale: 'en',
            onAccepted: () {
              accepted = true;
              final state = container.read(aiAssistantControllerProvider);
              expect(state.messages.single.contentText, 'Pending send');
            },
          );

      expect(accepted, isTrue);
      await sendFuture;
    });

    test('state listeners rebuild message list after send', () async {
      final repository = _FakeAiRepository();
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      final observedLengths = <int>[];
      container.listen(
        aiAssistantControllerProvider,
        (previous, next) => observedLengths.add(next.messages.length),
        fireImmediately: true,
      );

      await container.read(aiAssistantControllerProvider.notifier).sendMessage(
            text: 'Listener test',
            locale: 'en',
          );

      expect(observedLengths.first, 0);
      expect(observedLengths, contains(1));
      expect(observedLengths.last, greaterThanOrEqualTo(2));
    });

    testWidgets('shows unified welcome state in English LTR', (tester) async {
      await tester.pumpWidget(_buildAssistantHarness(locale: const Locale('en')));
      await tester.pumpAndSettle();

      expect(find.text('How can I help with your project?'), findsOneWidget);
      expect(find.text('Explain Arduino Uno simply'), findsOneWidget);
      expect(
        Directionality.of(tester.element(find.byType(AiAssistantShellOverlay))),
        TextDirection.ltr,
      );
    });

    testWidgets('shows welcome state in Arabic RTL', (tester) async {
      await tester.pumpWidget(_buildAssistantHarness(locale: const Locale('ar')));
      await tester.pumpAndSettle();

      expect(find.text('كيف يمكنني مساعدتك في مشروعك؟'), findsOneWidget);
      expect(
        Directionality.of(tester.element(find.byType(AiAssistantShellOverlay))),
        TextDirection.rtl,
      );
    });

    testWidgets('renders assistant response immediately from send turn', (
      tester,
    ) async {
      final repository = _EmptyReloadAiRepository();

      await tester.pumpWidget(
        _buildAssistantHarness(
          locale: const Locale('en'),
          repository: repository,
        ),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'How do I use an Arduino Uno?');
      await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
      await tester.pumpAndSettle();

      expect(
        find.text('Mock answer for How do I use an Arduino Uno?'),
        findsOneWidget,
      );
      expect(find.byType(AiMessageBubble), findsNWidgets(2));
    });

    test('controller regression keeps reply when reload returns empty', () async {
      final repository = _EmptyReloadAiRepository();
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
        ],
      );
      addTearDown(container.dispose);

      await container.read(aiAssistantControllerProvider.notifier).sendMessage(
            text: 'Explain breadboard',
            locale: 'en',
          );

      final state = container.read(aiAssistantControllerProvider);
      expect(state.messages.length, 2);
      expect(
        state.messages.last.contentBlocks.first.text,
        'Mock answer for Explain breadboard',
      );
    });

    testWidgets('shows retry for retryable provider failures', (tester) async {
      await tester.binding.setSurfaceSize(const Size(900, 900));
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final repository = _FakeAiRepository(
        failSendWith: const ApiException(
          message: 'Provider failed',
          code: 'AI_PROVIDER_ERROR',
        ),
      );

      await tester.pumpWidget(
        _buildAssistantHarness(locale: const Locale('en'), repository: repository),
      );
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField), 'What is ESP32?');
      await tester.tap(find.byIcon(Icons.arrow_upward_rounded));
      await tester.pumpAndSettle();

      expect(find.text('Retry'), findsOneWidget);
      expect(find.text('What is ESP32?'), findsOneWidget);
      expect(repository.sendCalls, 1);

      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();

      expect(repository.sendCalls, 2);
      expect(repository.lastClientMessageId, repository.firstClientMessageId);
    });

    testWidgets('global launcher is visible for learner shell', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiRepositoryProvider.overrideWithValue(_FakeAiRepository()),
            authControllerProvider.overrideWith(
              () => _LearnerAuthController(),
            ),
          ],
          child: MaterialApp(
            home: AppMobileNavigationShell(
              child: Scaffold(body: Container()),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(AiAssistantLauncher), findsOneWidget);
    });

    testWidgets('launcher hides while assistant is open', (tester) async {
      await tester.pumpWidget(_buildAssistantHarness(locale: const Locale('en')));
      await tester.pumpAndSettle();

      expect(find.byType(AiAssistantLauncher), findsNothing);
    });

    testWidgets('legacy general learning route remains compatible', (tester) async {
      final router = GoRouter(
        routes: [
          ShellRoute(
            builder: (context, state, child) =>
                AppMobileNavigationShell(child: child),
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) => const Scaffold(body: Text('Home')),
              ),
              GoRoute(
                path: '/ai/assistant',
                builder: (context, state) => GeneralLearningChatPage(
                  initialConversationId:
                      state.uri.queryParameters['conversationId'],
                ),
              ),
            ],
          ),
          GoRoute(
            path: '/ai/general-learning',
            redirect: (_, state) {
              final conversationId = state.uri.queryParameters['conversationId'];
              if (conversationId == null || conversationId.isEmpty) {
                return '/ai/assistant';
              }
              return '/ai/assistant?conversationId=$conversationId';
            },
          ),
        ],
        initialLocation: '/home',
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiRepositoryProvider.overrideWithValue(_FakeAiRepository()),
            authControllerProvider.overrideWith(
              () => _LearnerAuthController(),
            ),
          ],
          child: MaterialApp.router(
            routerConfig: router,
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en'), Locale('ar')],
          ),
        ),
      );
      await tester.pumpAndSettle();

      router.go('/ai/general-learning');
      await tester.pumpAndSettle();

      expect(find.byType(AiAssistantShellOverlay), findsOneWidget);
    });

    testWidgets('suggested prompt sends a message', (tester) async {
      final repository = _FakeAiRepository();

      await tester.pumpWidget(
        _buildAssistantHarness(locale: const Locale('en'), repository: repository),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.text('Explain Arduino Uno simply'));
      await tester.pumpAndSettle();

      expect(repository.sendCalls, 1);
      expect(repository.lastSentText, 'Explain Arduino Uno simply');
    });
  });
}

class _LearnerAuthController extends AuthController {
  @override
  AuthState build() {
    return AuthState(
      hasBootstrapped: true,
      accessToken: 'test-token',
      user: User(
        id: 'learner-1',
        displayName: 'Learner',
        email: 'learner@test.com',
        accountStatus: 'ACTIVE',
        roles: const ['LEARNER'],
        createdAt: DateTime.utc(2026, 1, 1),
      ),
    );
  }
}

Widget _buildAssistantHarness({
  required Locale locale,
  AiRepository? repository,
}) {
  return ProviderScope(
    overrides: [
      aiRepositoryProvider.overrideWithValue(repository ?? _FakeAiRepository()),
      authControllerProvider.overrideWith(() => _LearnerAuthController()),
      aiAssistantShellProvider.overrideWith(() => _OpenAssistantShellNotifier()),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
      home: AppMobileNavigationShell(
        child: const Scaffold(body: SizedBox.shrink()),
      ),
    ),
  );
}

class _OpenAssistantShellNotifier extends AiAssistantShellNotifier {
  @override
  AiAssistantShellState build() => const AiAssistantShellState(isOpen: true);
}

class _FakeAiRepository implements AiRepository {
  _FakeAiRepository({
    this.messages = const [],
    this.sendDelay = Duration.zero,
    this.failSendWith,
  });

  final List<AiMessageItem> messages;
  final Duration sendDelay;
  final ApiException? failSendWith;

  int sendCalls = 0;
  String? lastSentText;
  String? lastClientMessageId;
  String? firstClientMessageId;

  @override
  Future<void> archiveConversation({required String conversationId}) async {}

  @override
  Future<void> restoreConversation({required String conversationId}) async {}

  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    return const AiContentBlock(type: 'action_result');
  }

  @override
  Future<AiContentBlock?> cancelPendingAction({required String pendingActionId}) async {
    return const AiContentBlock(type: 'action_result', actionStatus: 'CANCELLED');
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
    return const AiConversationListPage(items: []);
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
        title: 'Test',
        preview: null,
        updatedAt: DateTime.utc(2026, 1, 1),
      ),
      items: messages,
    );
  }

  @override
  Future<AiTurnResponse> sendMessage({
    required String conversationId,
    required String text,
    required String locale,
    required String clientMessageId,
  }) async {
    sendCalls += 1;
    lastSentText = text;
    lastClientMessageId = clientMessageId;
    firstClientMessageId ??= clientMessageId;

    if (sendDelay > Duration.zero) {
      await Future<void>.delayed(sendDelay);
    }

    if (failSendWith != null) {
      throw failSendWith!;
    }

    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'user-$sendCalls',
      assistantMessageId: 'assistant-$sendCalls',
      contentBlocks: [
        AiContentBlock(
          type: 'text',
          text: 'Mock answer for $text',
          purpose: 'answer',
        ),
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
  }
}

class _RetryOnceAiRepository extends _FakeAiRepository {
  _RetryOnceAiRepository();

  bool _failedOnce = false;

  @override
  Future<AiTurnResponse> sendMessage({
    required String conversationId,
    required String text,
    required String locale,
    required String clientMessageId,
  }) async {
    sendCalls += 1;
    lastSentText = text;
    lastClientMessageId = clientMessageId;
    firstClientMessageId ??= clientMessageId;

    if (!_failedOnce) {
      _failedOnce = true;
      throw const ApiException(
        message: 'Provider failed',
        code: 'AI_PROVIDER_ERROR',
      );
    }

    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'user-$sendCalls',
      assistantMessageId: 'assistant-$sendCalls',
      contentBlocks: [
        AiContentBlock(
          type: 'text',
          text: 'Mock answer for $text',
          purpose: 'answer',
        ),
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
  }
}

class _EmptyReloadAiRepository extends _FakeAiRepository {
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
        title: 'Test',
        preview: null,
        updatedAt: DateTime.utc(2026, 1, 1),
      ),
      items: const [],
    );
  }
}
