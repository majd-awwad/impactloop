import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'support/learning_project_authoring_repository_stubs.dart';
import 'package:go_router/go_router.dart';

import 'package:frontend/app/widgets/app_mobile_bottom_nav_bar.dart';
import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/application/ai_assistant_shell_provider.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_helpers.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/domain/authoring_session_models.dart';
import 'package:frontend/features/ai/presentation/pages/general_learning_chat_page.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_assistant_launcher.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_assistant_shell.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_message_bubble.dart';
import 'package:frontend/features/auth/application/auth_controller.dart';
import 'package:frontend/features/auth/data/models/user.dart';
import 'package:frontend/features/learning_hub/application/learning_hub_providers.dart';
import 'package:frontend/features/learning_hub/domain/learning_project_repository.dart';
import 'package:frontend/features/learning_hub/domain/learning_projects_result.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project.dart';
import 'package:frontend/features/learning_hub/domain/models/learning_project_submission.dart';
import 'package:frontend/features/learning_hub/domain/models/project_build.dart';
import 'package:frontend/features/learning_hub/domain/project_engagement.dart';
import 'package:frontend/features/learning_hub/domain/project_follow_status.dart';
import 'package:frontend/features/learning_hub/domain/project_save_status.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_project_build_guide_page.dart';
import 'package:frontend/features/learning_hub/presentation/pages/learning_project_build_page.dart';
import 'package:frontend/features/materials/data/models/category.dart';
import 'package:frontend/shared/models/localized_text.dart';

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

  group('Build page Ask AI navigation', () {
    testWidgets('wide layout Ask AI opens side panel without leaving build page', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _BuildGuideHubRepository();
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      expect(hubRepository.guideCalls, 1);
      expect(find.byType(LearningProjectBuildPage), findsOneWidget);
      expect(find.byType(LearningProjectBuildGuidePage), findsNothing);
      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);
      expect(find.byType(AiEmbeddedAssistantChat), findsOneWidget);
      expect(find.text('Ask AI'), findsOneWidget);
      expect(find.text('home page'), findsNothing);
      expect(
        router.state.uri.queryParameters['guide'],
        '1',
      );

      final container = ProviderScope.containerOf(
        tester.element(find.byType(MaterialApp)),
      );
      expect(
        container.read(aiAssistantControllerProvider).conversationId,
        'guide-conv-1',
      );
    });

    testWidgets('wide Continue with AI reuses conversation without duplicate request', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _BuildGuideHubRepository(
        build: _sampleProjectBuild(guideConversationId: 'guide-conv-existing'),
      );
      final aiRepository = _FakeAiRepository(
        messages: [
          AiMessageItem(
            id: 'msg-1',
            role: 'ASSISTANT',
            status: 'COMPLETED',
            contentText: null,
            contentBlocks: const [
              AiContentBlock(
                type: 'text',
                text: 'Welcome back to your LED build guide.',
                purpose: 'answer',
              ),
            ],
            createdAt: DateTime.utc(2026, 1, 1),
          ),
        ],
      );
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
        aiRepository: aiRepository,
      );

      await tester.tap(find.text('Continue with AI'));
      await tester.pumpAndSettle();
      expect(hubRepository.guideCalls, 1);
      expect(find.text('Welcome back to your LED build guide.'), findsOneWidget);

      await tester.tap(find.text('Continue with AI'));
      await tester.pumpAndSettle();

      expect(hubRepository.guideCalls, 1);
      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);
      expect(
        ProviderScope.containerOf(tester.element(find.byType(MaterialApp)))
            .read(aiAssistantControllerProvider)
            .conversationId,
        'guide-conv-1',
      );
    });

    testWidgets('wide ownership confirm refetches build while panel stays open', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _RefreshingBuildGuideHubRepository(
        initial: _sampleProjectBuild(),
        refreshed: _sampleProjectBuild(
          materialReadiness: const ProjectBuildMaterialReadiness(
            ready: 1,
            linked: 0,
            reserved: 0,
            missing: 0,
            total: 1,
          ),
          items: const [
            ProjectBuildItem(
              id: 'item-led',
              requiredComponentId: 'cmp-led',
              status: ProjectBuildItemStatus.alreadyOwned,
              component: ProjectRequiredComponentItem(
                id: 'cmp-led',
                name: LocalizedText(en: 'Cardboard', ar: 'كرتون'),
                materialType: 'Cardboard',
                quantity: 1,
                unit: 'piece',
                isRequired: true,
                canBeSubstituted: false,
              ),
              isReadyForBuild: true,
              readinessLabel: 'Already owned',
            ),
          ],
        ),
      );
      final aiRepository = _BuildOwnershipConfirmAiRepository(
        messages: [
          AiMessageItem(
            id: 'msg-ownership',
            role: 'ASSISTANT',
            status: 'COMPLETED',
            contentText: null,
            contentBlocks: const [
              AiContentBlock(
                type: 'action_confirmation',
                pendingActionId: 'pending-build-group',
                actionType: 'UPDATE_BUILD_COMPONENT_STATUSES',
                actionTitle: 'Mark components as already owned?',
                actionSummary: 'Cardboard',
                confirmLabel: 'Confirm',
                cancelLabel: 'Cancel',
              ),
            ],
            createdAt: DateTime.utc(2026, 1, 1),
          ),
        ],
      );
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
        aiRepository: aiRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Confirm'));
      await tester.pumpAndSettle();

      expect(hubRepository.fetchMyBuildCalls, greaterThanOrEqualTo(1));
      expect(find.text('Already owned'), findsWidgets);
      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);
      expect(find.textContaining('Materials: 1/1 ready'), findsOneWidget);
    });

    testWidgets('wide all materials ready shows current step in build and guide', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _RefreshingBuildGuideHubRepository(
        initial: _sampleProjectBuildWithSteps(),
        refreshed: _sampleProjectBuildWithSteps(
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
        ),
      );
      final aiRepository = _BuildOwnershipConfirmAiRepository();
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
        aiRepository: aiRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();
      expect(find.text('Locked'), findsOneWidget);

      await tester.tap(find.text('Confirm'));
      await tester.pumpAndSettle();

      expect(find.text('Current'), findsOneWidget);
      expect(find.textContaining('Step 1: Wire LED'), findsOneWidget);
      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);
    });

    testWidgets('wide step completion confirm advances build while panel stays open', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _RefreshingBuildGuideHubRepository(
        initial: _sampleTwoStepReadyBuild(),
        refreshed: _sampleTwoStepReadyBuild(afterFirstStep: true),
      );
      final aiRepository = _StepCompletionConfirmAiRepository();
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
        aiRepository: aiRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      expect(find.text('Current'), findsOneWidget);
      expect(find.text('Locked'), findsOneWidget);

      await tester.tap(find.text('Yes, I finished it'));
      await tester.pumpAndSettle();

      expect(hubRepository.fetchMyBuildCalls, greaterThanOrEqualTo(1));
      expect(find.text('Completed'), findsOneWidget);
      expect(find.textContaining('Step 2: Attach panel'), findsOneWidget);
      expect(find.textContaining('50%'), findsWidgets);
      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);
      expect(find.text('Step completed'), findsOneWidget);
    });

    testWidgets('wide final step completion shows build completed notice', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _RefreshingBuildGuideHubRepository(
        initial: _sampleSingleStepReadyBuild(),
        refreshed: _sampleFinalStepCompletedBuild(),
      );
      final aiRepository = _StepCompletionConfirmAiRepository();
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
        aiRepository: aiRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Yes, I finished it'));
      await tester.pumpAndSettle();

      expect(hubRepository.fetchMyBuildCalls, greaterThanOrEqualTo(1));
      expect(find.text('Build completed'), findsOneWidget);
      expect(find.textContaining('100%'), findsWidgets);
      expect(find.text('Current'), findsNothing);
      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);
      expect(find.text('Step completed'), findsOneWidget);
    });

    testWidgets('narrow final step completion confirmation fits RTL panel', (
      tester,
    ) async {
      _setNarrowBuildViewport(tester);
      final hubRepository = _RefreshingBuildGuideHubRepository(
        initial: _sampleSingleStepReadyBuild(),
        refreshed: _sampleFinalStepCompletedBuild(),
      );
      final aiRepository = _StepCompletionConfirmAiRepository(
        confirmLabel: 'نعم، أنهيتها',
        cancelLabel: 'إلغاء',
        actionTitle: 'هل أنهيت الخطوة 1: توصيل LED؟',
      );
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
        aiRepository: aiRepository,
        locale: const Locale('ar'),
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      expect(find.text('نعم، أنهيتها'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('نعم، أنهيتها'));
      await tester.pumpAndSettle();

      expect(find.byType(LearningProjectBuildGuidePage), findsOneWidget);
      expect(find.text('Step completed'), findsOneWidget);
      expect(find.text('نعم، أنهيتها'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('wide close and reopen keeps the same guide conversation', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _BuildGuideHubRepository();
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();
      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);

      await tester.tap(find.byTooltip('Close'));
      await tester.pumpAndSettle();
      expect(find.byType(AiBuildGuideSidePanel), findsNothing);

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      expect(hubRepository.guideCalls, 2);
      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);
      expect(
        ProviderScope.containerOf(tester.element(find.byType(MaterialApp)))
            .read(aiAssistantControllerProvider)
            .conversationId,
        'guide-conv-1',
      );
    });

    testWidgets('wide guide query parameters restore panel after refresh', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _BuildGuideHubRepository(
        build: _sampleProjectBuild(guideConversationId: 'guide-conv-1'),
      );
      final router = _buildGuideNavigationRouter(
        initialLocation:
            '/learning/proj-1/build?guide=1&conversationId=guide-conv-1',
      );

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
      );

      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);
      expect(find.byType(LearningProjectBuildPage), findsOneWidget);
      expect(hubRepository.guideCalls, 1);
      expect(find.textContaining('Materials:'), findsOneWidget);
    });

    testWidgets('narrow layout uses full-screen build guide route', (
      tester,
    ) async {
      _setNarrowBuildViewport(tester);
      final hubRepository = _BuildGuideHubRepository();
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      expect(hubRepository.guideCalls, 1);
      expect(find.byType(LearningProjectBuildGuidePage), findsOneWidget);
      expect(find.byType(AiBuildGuideSidePanel), findsNothing);
      expect(find.byType(AiAssistantShellOverlay), findsNothing);
    });

    testWidgets('narrow build-guide back returns to the same build page', (
      tester,
    ) async {
      _setNarrowBuildViewport(tester);
      final hubRepository = _BuildGuideHubRepository();
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();
      expect(find.byType(LearningProjectBuildGuidePage), findsOneWidget);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();

      expect(find.text('Ask AI'), findsOneWidget);
      expect(find.byType(LearningProjectBuildGuidePage), findsNothing);
    });

    testWidgets('wide RTL side panel avoids horizontal overflow', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _BuildGuideHubRepository();
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
        locale: const Locale('ar'),
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(AiBuildGuideSidePanel), findsOneWidget);
    });

    testWidgets('rapid double tap sends only one guide conversation request', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _SlowBuildGuideHubRepository();
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pump();
      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      expect(hubRepository.guideCalls, 1);
    });

    testWidgets('guide conversation failure shows visible error and clears loading', (
      tester,
    ) async {
      _setWideBuildViewport(tester);
      final hubRepository = _BuildGuideHubRepository(failGuide: true);
      final router = _buildGuideNavigationRouter();

      await _pumpBuildGuideHarness(
        tester,
        router: router,
        hubRepository: hubRepository,
      );

      await tester.tap(find.text('Ask AI'));
      await tester.pumpAndSettle();

      expect(hubRepository.guideCalls, 1);
      expect(find.byType(AiBuildGuideSidePanel), findsNothing);
      expect(find.text('Guide assistant is unavailable.'), findsOneWidget);
    });

    testWidgets('general learning route still opens assistant overlay', (
      tester,
    ) async {
      final router = GoRouter(
        initialLocation: '/home',
        routes: [
          ShellRoute(
            builder: (context, state, child) =>
                AppMobileNavigationShell(child: child),
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) =>
                    const Scaffold(body: Text('home page')),
              ),
              GoRoute(
                path: '/ai/general-learning',
                builder: (context, state) => const GeneralLearningChatPage(),
              ),
            ],
          ),
        ],
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

    testWidgets('ultra-narrow assistant shell avoids layout overflow', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(172, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);

      final router = GoRouter(
        initialLocation: '/home',
        routes: [
          ShellRoute(
            builder: (context, state, child) =>
                AppMobileNavigationShell(child: child),
            routes: [
              GoRoute(
                path: '/home',
                builder: (context, state) =>
                    const Scaffold(body: Text('home page')),
              ),
            ],
          ),
        ],
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

      final element = tester.element(find.text('home page'));
      ProviderScope.containerOf(element)
          .read(aiAssistantShellProvider.notifier)
          .open();
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(AiAssistantShellOverlay), findsOneWidget);
      expect(find.byIcon(Icons.more_vert_rounded), findsOneWidget);
    });
  });
}

GoRouter _buildGuideNavigationRouter({String? initialLocation}) {
  return GoRouter(
    initialLocation: initialLocation ?? '/learning/proj-1/build',
    routes: [
      ShellRoute(
        builder: (context, state, child) =>
            AppMobileNavigationShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (context, state) =>
                const Scaffold(body: Text('home page')),
          ),
          GoRoute(
            path: '/ai/assistant',
            builder: (context, state) => AiAssistantRoutePage(
              conversationId: state.uri.queryParameters['conversationId'],
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/learning/:id/build/guide',
        builder: (context, state) => LearningProjectBuildGuidePage(
          projectId: state.pathParameters['id']!,
          conversationId: state.uri.queryParameters['conversationId'] ?? '',
          buildContext: state.extra is BuildGuideContext
              ? state.extra! as BuildGuideContext
              : null,
        ),
      ),
      GoRoute(
        path: '/learning/:id/build',
        builder: (context, state) => LearningProjectBuildPage(
          projectId: state.pathParameters['id']!,
        ),
      ),
    ],
  );
}

ProjectBuild _sampleProjectBuild({
  String? guideConversationId,
  ProjectBuildMaterialReadiness? materialReadiness,
  List<ProjectBuildItem>? items,
  ProjectBuildStepProgress? stepProgress,
  ProjectBuildStatus status = ProjectBuildStatus.inProgress,
}) {
  return ProjectBuild(
    id: 'build-1',
    projectId: 'proj-1',
    status: status,
    guideConversationId: guideConversationId,
    project: const ProjectBuildProject(
      id: 'proj-1',
      title: 'LED project',
      shortDescription: 'Build an LED circuit',
    ),
    progress: const ProjectBuildProgress(total: 1, ready: 0, percent: 0),
    materialReadiness: materialReadiness ??
        const ProjectBuildMaterialReadiness(
          ready: 0,
          linked: 0,
          reserved: 0,
          missing: 1,
          total: 1,
        ),
    stepProgress: stepProgress ??
        const ProjectBuildStepProgress(
          completed: 0,
          total: 1,
          percent: 0,
          steps: [],
        ),
    items: items ??
        const [
          ProjectBuildItem(
            id: 'item-led',
            requiredComponentId: 'cmp-led',
            status: ProjectBuildItemStatus.missing,
            component: ProjectRequiredComponentItem(
              id: 'cmp-led',
              name: LocalizedText(en: 'LED', ar: 'LED'),
              materialType: 'LED',
              quantity: 1,
              unit: 'piece',
              isRequired: true,
              canBeSubstituted: false,
            ),
            isReadyForBuild: false,
            readinessLabel: 'Missing',
          ),
        ],
  );
}

ProjectBuild _sampleProjectBuildWithSteps({
  ProjectBuildMaterialReadiness? materialReadiness,
  ProjectBuildStepProgress? stepProgress,
}) {
  return _sampleProjectBuild(
    materialReadiness: materialReadiness,
    stepProgress: stepProgress ??
        const ProjectBuildStepProgress(
          completed: 0,
          total: 1,
          percent: 0,
          steps: [
            ProjectBuildStepView(
              stepId: 'step-1',
              stepNumber: 1,
              title: 'Wire LED',
              description: 'Wire the LED',
              state: ProjectBuildStepState.locked,
            ),
          ],
        ),
  );
}

const _readyOwnedItem = ProjectBuildItem(
  id: 'item-led',
  requiredComponentId: 'cmp-led',
  status: ProjectBuildItemStatus.alreadyOwned,
  component: ProjectRequiredComponentItem(
    id: 'cmp-led',
    name: LocalizedText(en: 'LED', ar: 'LED'),
    materialType: 'LED',
    quantity: 1,
    unit: 'piece',
    isRequired: true,
    canBeSubstituted: false,
  ),
  isReadyForBuild: true,
  readinessLabel: 'Already owned',
);

const _readyMaterialReadiness = ProjectBuildMaterialReadiness(
  ready: 1,
  linked: 0,
  reserved: 0,
  missing: 0,
  total: 1,
);

ProjectBuild _sampleSingleStepReadyBuild() {
  return _sampleProjectBuild(
    materialReadiness: _readyMaterialReadiness,
    items: const [_readyOwnedItem],
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
  );
}

ProjectBuild _sampleTwoStepReadyBuild({bool afterFirstStep = false}) {
  if (!afterFirstStep) {
    return _sampleProjectBuild(
      materialReadiness: _readyMaterialReadiness,
      items: const [_readyOwnedItem],
      stepProgress: const ProjectBuildStepProgress(
        completed: 0,
        total: 2,
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
          ProjectBuildStepView(
            stepId: 'step-2',
            stepNumber: 2,
            title: 'Attach panel',
            description: 'Attach the panel',
            state: ProjectBuildStepState.locked,
          ),
        ],
      ),
    );
  }

  return _sampleProjectBuild(
    materialReadiness: _readyMaterialReadiness,
    items: const [_readyOwnedItem],
    stepProgress: const ProjectBuildStepProgress(
      completed: 1,
      total: 2,
      percent: 50,
      currentStep: ProjectBuildCurrentStep(
        stepId: 'step-2',
        stepNumber: 2,
        title: 'Attach panel',
      ),
      nextAction: ProjectBuildNextAction.completeCurrentStep,
      steps: [
        ProjectBuildStepView(
          stepId: 'step-1',
          stepNumber: 1,
          title: 'Wire LED',
          description: 'Wire the LED',
          state: ProjectBuildStepState.completed,
        ),
        ProjectBuildStepView(
          stepId: 'step-2',
          stepNumber: 2,
          title: 'Attach panel',
          description: 'Attach the panel',
          state: ProjectBuildStepState.current,
        ),
      ],
    ),
  );
}

ProjectBuild _sampleFinalStepCompletedBuild() {
  return _sampleProjectBuild(
    status: ProjectBuildStatus.completed,
    materialReadiness: _readyMaterialReadiness,
    items: const [_readyOwnedItem],
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
  );
}

void _setWideBuildViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(1400, 900);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
}

void _setNarrowBuildViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
}

Future<void> _pumpBuildGuideHarness(
  WidgetTester tester, {
  required GoRouter router,
  required LearningProjectRepository hubRepository,
  AiRepository? aiRepository,
  Locale locale = const Locale('en'),
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(() => _LearnerAuthController()),
        learningHubRepositoryProvider.overrideWithValue(hubRepository),
        aiRepositoryProvider.overrideWithValue(aiRepository ?? _FakeAiRepository()),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: locale,
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
}

class _RefreshingBuildGuideHubRepository extends _BuildGuideHubRepository {
  _RefreshingBuildGuideHubRepository({
    required ProjectBuild initial,
    required ProjectBuild refreshed,
  })  : _initial = initial,
        _refreshed = refreshed,
        super(build: initial);

  final ProjectBuild _initial;
  final ProjectBuild _refreshed;
  int fetchMyBuildCalls = 0;

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async {
    fetchMyBuildCalls += 1;
    if (fetchMyBuildCalls < 3) {
      return _initial;
    }
    return _refreshed;
  }
}

class _BuildOwnershipConfirmAiRepository extends _FakeAiRepository {
  _BuildOwnershipConfirmAiRepository({List<AiMessageItem>? messages})
      : super(
          messages: messages ??
              [
                AiMessageItem(
                  id: 'msg-ownership',
                  role: 'ASSISTANT',
                  status: 'COMPLETED',
                  contentText: null,
                  contentBlocks: const [
                    AiContentBlock(
                      type: 'action_confirmation',
                      pendingActionId: 'pending-build-group',
                      actionType: 'UPDATE_BUILD_COMPONENT_STATUSES',
                      actionTitle: 'Mark components as already owned?',
                      actionSummary: 'Cardboard',
                      confirmLabel: 'Confirm',
                      cancelLabel: 'Cancel',
                    ),
                  ],
                  createdAt: DateTime.utc(2026, 1, 1),
                ),
              ],
        );

  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'UPDATE_BUILD_COMPONENT_STATUSES',
      actionStatus: 'EXECUTED',
      actionTitle: 'Components updated',
      actionSummary: 'Cardboard marked as already owned.',
    );
  }
}

class _StepCompletionConfirmAiRepository extends _FakeAiRepository {
  _StepCompletionConfirmAiRepository({
    List<AiMessageItem>? messages,
    String confirmLabel = 'Yes, I finished it',
    String cancelLabel = 'Cancel',
    String actionTitle = 'Did you finish Step 1: Wire LED?',
    String actionSummary = 'Current progress: 0%.',
  }) : super(
          messages: messages ??
              [
                AiMessageItem(
                  id: 'msg-step-complete',
                  role: 'ASSISTANT',
                  status: 'COMPLETED',
                  contentText: null,
                  contentBlocks: [
                    AiContentBlock(
                      type: 'action_confirmation',
                      pendingActionId: 'pending-step-1',
                      actionType: 'COMPLETE_CURRENT_BUILD_STEP',
                      actionTitle: actionTitle,
                      actionSummary: actionSummary,
                      confirmLabel: confirmLabel,
                      cancelLabel: cancelLabel,
                    ),
                  ],
                  createdAt: DateTime.utc(2026, 1, 1),
                ),
              ],
        );

  @override
  Future<AiContentBlock> confirmPendingAction({
    required String pendingActionId,
    required String idempotencyKey,
    required String locale,
  }) async {
    return const AiContentBlock(
      type: 'action_result',
      actionType: 'COMPLETE_CURRENT_BUILD_STEP',
      actionStatus: 'EXECUTED',
      actionTitle: 'Step completed',
      actionSummary: 'Build completed.',
    );
  }
}

class _SlowBuildGuideHubRepository extends _BuildGuideHubRepository {
  @override
  Future<BuildGuideConversationResult> getOrCreateBuildGuideConversation(
    String projectId,
  ) async {
    guideCalls += 1;
    await Future<void>.delayed(const Duration(milliseconds: 50));
    if (failGuide) {
      throw const ApiException(
        message: 'Guide assistant is unavailable.',
        code: 'BUILD_GUIDE_UNAVAILABLE',
      );
    }

    return BuildGuideConversationResult(
      conversationId: 'guide-conv-1',
      buildContext: BuildGuideContext(
        buildId: buildRecord.id,
        projectId: projectId,
        projectTitle: buildRecord.project.title,
        buildStatus: buildRecord.status,
        materialReadiness: buildRecord.materialReadiness,
        stepProgress: ProjectBuildStepProgressSummary(
          completed: buildRecord.stepProgress.completed,
          total: buildRecord.stepProgress.total,
          percent: buildRecord.stepProgress.percent,
        ),
      ),
    );
  }
}

class _BuildGuideHubRepository implements LearningProjectRepository {
  _BuildGuideHubRepository({
    ProjectBuild? build,
    this.failGuide = false,
  }) : _build = build ?? _sampleProjectBuild();

  final ProjectBuild _build;
  final bool failGuide;
  int guideCalls = 0;

  ProjectBuild get buildRecord => _build;

  @override
  Future<BuildGuideConversationResult> getOrCreateBuildGuideConversation(
    String projectId,
  ) async {
    guideCalls += 1;
    if (failGuide) {
      throw const ApiException(
        message: 'Guide assistant is unavailable.',
        code: 'BUILD_GUIDE_UNAVAILABLE',
      );
    }

    return BuildGuideConversationResult(
      conversationId: 'guide-conv-1',
      buildContext: BuildGuideContext(
        buildId: _build.id,
        projectId: projectId,
        projectTitle: _build.project.title,
        buildStatus: _build.status,
        materialReadiness: _build.materialReadiness,
        stepProgress: ProjectBuildStepProgressSummary(
          completed: buildRecord.stepProgress.completed,
          total: buildRecord.stepProgress.total,
          percent: buildRecord.stepProgress.percent,
        ),
      ),
    );
  }

  @override
  Future<ProjectBuild?> fetchMyBuild(String projectId) async => buildRecord;

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
  }) async =>
      _build;

  @override
  Future<ProjectBuild> updateBuildItem(
    String projectId,
    String itemId, {
    required ProjectBuildItemStatus status,
    String? learnerNote,
    String? recommendationImpressionId,
  }) async {
    return _build;
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
    return _build;
  }

  @override
  Future<ProjectBuild> unlinkMaterial(String projectId, String itemId) async {
    return _build;
  }

  @override
  Future<ProjectBuild> completeBuildStep(String projectId, String stepId) async {
    return _build;
  }

  @override
  Future<List<MaterialCategory>> fetchProjectCategories() async => const [];

  @override
  Future<List<MaterialCategory>> fetchMaterialCategories() async => const [];

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

  @override
  Future<AiTurnResponse> startAuthoring({required String conversationId}) async {
    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'idea-1',
      assistantMessageId: 'assistant-bootstrap',
      contentBlocks: const [
        AiContentBlock(
          type: 'project_authoring_clarification',
          authoringStatus: 'NEEDS_CLARIFICATION',
          authoringSummary: 'Mock authoring summary.',
          authoringNextQuestion: AiAuthoringQuestion(
            prompt: 'What behavior do you want?',
            answerType: 'FREE_TEXT',
          ),
        ),
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
  }

  @override
  Future<AiTurnResponse> generateAuthoringProposal({
    required String conversationId,
  }) async {
    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'idea-1',
      assistantMessageId: 'assistant-proposal',
      contentBlocks: const [
        AiContentBlock(
          type: 'project_authoring_proposal',
          authoringProposalProject: AiAuthoringProposalProject(
            title: 'Mock proposal',
            shortDescription: 'Short enough summary for preview.',
            description: 'Long enough description for the mock proposal preview.',
            difficulty: 'BEGINNER',
            estimatedMinutes: 90,
          ),
          authoringProposalCategoryDisplayName: 'Electronics',
          authoringProposalComponents: [
            AiAuthoringProposalComponent(
              componentName: 'Arduino Uno',
              materialType: 'Microcontroller',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
              canBeSubstituted: false,
            ),
          ],
          authoringProposalSteps: [
            AiAuthoringProposalStep(
              title: 'Wire the circuit',
              description: 'Connect the Arduino and sensor on a breadboard.',
            ),
            AiAuthoringProposalStep(
              title: 'Upload code',
              description: 'Flash the moisture-reading sketch.',
            ),
            AiAuthoringProposalStep(
              title: 'Test the alert',
              description: 'Verify the LED turns on when dry.',
            ),
          ],
        ),
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
    );
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
