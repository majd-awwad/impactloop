import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/application/authoring_workspace_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/authoring_session_models.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_sequential_authoring_panel.dart';

import 'support/authoring_workspace_fixtures.dart';

Future<void> pumpAuthoringPanel(
  WidgetTester tester, {
  required Size viewport,
  required AuthoringSessionResponse response,
  String projectId = 'project-1',
  String conversationId = 'conv-panel',
  ConfigurableAuthoringRepository? repository,
}) async {
  tester.view.physicalSize = viewport;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);

  final repo = repository ?? ConfigurableAuthoringRepository();

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        aiRepositoryProvider.overrideWithValue(repo),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en')],
        home: Scaffold(
          body: SizedBox(
            width: viewport.width,
            height: viewport.height,
            child: const AiSequentialAuthoringPanel(locale: 'en'),
          ),
        ),
      ),
    ),
  );

  final container = ProviderScope.containerOf(
    tester.element(find.byType(AiSequentialAuthoringPanel)),
  );
  container.read(authoringActiveWorkspaceProvider.notifier).activate(
        projectId: projectId,
        conversationId: conversationId,
      );
  final snapshot = snapshotFromSession(response);
  container.read(authoringWorkspaceControllerProvider.notifier).seedSnapshot(
        projectId: projectId,
        conversationId: conversationId,
        snapshot: snapshot,
        sessionId: response.session.id,
        response: response,
      );
  await tester.pumpAndSettle();
}

AuthoringSessionResponse componentLayoutResponse({int componentCount = 12}) {
  return authoringSessionFixture(
    sessionId: 'sess-layout',
    stage: 'COMPONENTS',
    turn: authoringTurnFixture(
      id: 'turn-components',
      stage: 'COMPONENTS',
      payload: {'components': longComponentPayload(count: componentCount)},
    ),
    availableActions: const [
      'ACCEPT_TURN',
      'CHOOSE_MODE',
      'SUGGEST_ANOTHER',
      'SAVE_MANUAL',
    ],
  );
}

AuthoringSessionResponse stepLayoutResponse({int stepCount = 10}) {
  return authoringSessionFixture(
    sessionId: 'sess-steps-layout',
    stage: 'STEPS_OVERVIEW',
    completedStages: const ['COMPONENTS'],
    turn: authoringTurnFixture(
      id: 'turn-steps',
      stage: 'STEPS_OVERVIEW',
      payload: {'steps': longStepPayload(count: stepCount)},
    ),
    availableActions: const [
      'ACCEPT_TURN',
      'CHOOSE_MODE',
      'SUGGEST_ANOTHER',
      'SAVE_MANUAL',
    ],
  );
}

void main() {
  group('authoring workspace responsive layout', () {
    final viewports = <String, Size>{
      'desktop normal 1440x900': const Size(1440, 900),
      'desktop short 1280x600': const Size(1280, 600),
      'narrow desktop 900x650': const Size(900, 650),
      'mobile portrait 390x844': const Size(390, 844),
      'small mobile 320x568': const Size(320, 568),
      'mobile keyboard 390x500': const Size(390, 500),
    };

    for (final entry in viewports.entries) {
      testWidgets('${entry.key} long component list has no overflow', (tester) async {
        await pumpAuthoringPanel(
          tester,
          viewport: entry.value,
          response: componentLayoutResponse(),
        );
        expect(tester.takeException(), isNull);
        expect(find.byType(TextField), findsOneWidget);
      });

      testWidgets('${entry.key} long step plan has no overflow', (tester) async {
        await pumpAuthoringPanel(
          tester,
          viewport: entry.value,
          response: stepLayoutResponse(),
        );
        expect(tester.takeException(), isNull);
        expect(find.byType(TextField), findsOneWidget);
      });
    }

    testWidgets('mobile portrait shows sticky composer with action buttons', (tester) async {
      await pumpAuthoringPanel(
        tester,
        viewport: const Size(390, 844),
        response: componentLayoutResponse(componentCount: 6),
      );
      expect(find.byType(TextField), findsOneWidget);
      expect(find.byIcon(Icons.arrow_upward_rounded), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('workspace loading state shows bounded progress indicator', (tester) async {
      final startCompleter = Completer<AuthoringSessionResponse>();
      addTearDown(() {
        if (!startCompleter.isCompleted) {
          startCompleter.complete(authoringSessionFixture());
        }
      });

      tester.view.physicalSize = const Size(1280, 600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiRepositoryProvider.overrideWithValue(
              ConfigurableAuthoringRepository(
                onStart: (_) => startCompleter.future,
              ),
            ),
          ],
          child: MaterialApp(
            home: Scaffold(
              body: SizedBox(
                width: 500,
                height: 600,
                child: Builder(
                  builder: (context) {
                    WidgetsBinding.instance.addPostFrameCallback((_) {
                      final container = ProviderScope.containerOf(context);
                      container.read(authoringActiveWorkspaceProvider.notifier).activate(
                            projectId: 'project-1',
                            conversationId: 'conv-1',
                          );
                      container
                          .read(authoringWorkspaceControllerProvider.notifier)
                          .activateAndLoad(
                            projectId: 'project-1',
                            conversationId: 'conv-1',
                          );
                    });
                    return const AiSequentialAuthoringPanel(locale: 'en');
                  },
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('conversation renders below proposal and composer stays visible', (tester) async {
      final response = authoringSessionFixture(
        sessionId: 'sess-chat-layout',
        stage: 'SHORT_DESCRIPTION',
        turn: authoringTurnFixture(
          id: 'turn-short',
          stage: 'SHORT_DESCRIPTION',
          payload: const {'value': 'Night light for beginners using Arduino and LDR.'},
        ),
        conversationMessages: [
          {
            'id': 'msg-user-1',
            'role': 'USER',
            'status': 'COMPLETED',
            'contentText': 'Why is this description good for beginners?',
            'contentBlocks': [],
            'createdAt': '2026-07-20T10:00:00.000Z',
          },
          {
            'id': 'msg-assistant-1',
            'role': 'ASSISTANT',
            'status': 'COMPLETED',
            'contentText': 'It focuses on light sensing instead of motion.',
            'contentBlocks': [],
            'createdAt': '2026-07-20T10:00:01.000Z',
          },
        ],
      );
      await pumpAuthoringPanel(
        tester,
        viewport: const Size(1280, 700),
        response: response,
      );

      expect(find.text('Why is this description good for beginners?'), findsOneWidget);
      expect(find.text('It focuses on light sensing instead of motion.'), findsOneWidget);
      expect(find.text('Night light for beginners using Arduino and LDR.'), findsOneWidget);
      expect(find.byType(TextField), findsOneWidget);

      final proposalOffset = tester.getTopLeft(find.text(
        'Night light for beginners using Arduino and LDR.',
      ));
      final userOffset = tester.getTopLeft(
        find.text('Why is this description good for beginners?'),
      );
      expect(proposalOffset.dy < userOffset.dy, isTrue);
    });
  });

  group('authoring workspace scroll contract', () {
    Future<void> scrollPanelUp(WidgetTester tester) async {
      final listFinder = find.byType(ListView);
      for (var attempt = 0; attempt < 6; attempt += 1) {
        await tester.drag(listFinder, const Offset(0, 500));
        await tester.pump();
      }
      await tester.pumpAndSettle();
    }

    List<Map<String, dynamic>> tallConversationMessages({int count = 28}) {
      return List.generate(count, (index) {
        return {
          'id': 'msg-$index',
          'role': index.isEven ? 'USER' : 'ASSISTANT',
          'status': 'COMPLETED',
          'contentText':
              'Conversation filler message $index with enough text to expand the authoring panel layout height.',
          'contentBlocks': <dynamic>[],
          'createdAt': '2026-07-20T10:${index.toString().padLeft(2, '0')}:00.000Z',
        };
      });
    }

    testWidgets('accept scalar proposal does not auto-scroll to chat tail', (tester) async {
      final repository = ConfigurableAuthoringRepository(
        onAction: ({
          required String sessionId,
          required String action,
          required int expectedVersion,
          String? turnId,
          Object? manualValue,
          String? mode,
          String? targetStage,
        }) async {
          return authoringSessionFixture(
            sessionId: sessionId,
            version: expectedVersion + 1,
            stage: 'SHORT_DESCRIPTION',
            turn: authoringTurnFixture(
              id: 'turn-short-next',
              stage: 'SHORT_DESCRIPTION',
              payload: const {'value': 'Beginner night light with Arduino and LDR.'},
            ),
            conversationMessages: tallConversationMessages(),
          );
        },
      );
      final response = authoringSessionFixture(
        sessionId: 'sess-scroll-accept',
        version: 1,
        stage: 'TITLE',
        turn: authoringTurnFixture(
          id: 'turn-title',
          stage: 'TITLE',
          payload: const {'value': 'Arduino night light'},
        ),
        conversationMessages: tallConversationMessages(),
      );
      await pumpAuthoringPanel(
        tester,
        viewport: const Size(1280, 420),
        response: response,
        repository: repository,
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(AiSequentialAuthoringPanel)),
      );
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);

      await scrollPanelUp(tester);
      expect(find.text('Arduino night light'), findsOneWidget);
      expect(find.text('Conversation filler message 27'), findsNothing);

      await controller.runAction(action: 'ACCEPT_TURN', turnId: 'turn-title');
      await tester.pumpAndSettle();

      expect(find.text('Conversation filler message 27'), findsNothing);
    });

    testWidgets('suggest another does not auto-scroll to chat tail', (tester) async {
      final repository = ConfigurableAuthoringRepository(
        onAction: ({
          required String sessionId,
          required String action,
          required int expectedVersion,
          String? turnId,
          Object? manualValue,
          String? mode,
          String? targetStage,
        }) async {
          return authoringSessionFixture(
            sessionId: sessionId,
            version: expectedVersion + 1,
            stage: 'TITLE',
            turn: authoringTurnFixture(
              id: 'turn-title-alt',
              stage: 'TITLE',
              payload: const {'value': 'Alternate Arduino night light title'},
            ),
            conversationMessages: tallConversationMessages(),
          );
        },
      );
      final response = authoringSessionFixture(
        sessionId: 'sess-scroll-suggest',
        version: 1,
        stage: 'TITLE',
        turn: authoringTurnFixture(
          id: 'turn-title',
          stage: 'TITLE',
          payload: const {'value': 'Arduino night light'},
        ),
        conversationMessages: tallConversationMessages(),
      );
      await pumpAuthoringPanel(
        tester,
        viewport: const Size(1280, 420),
        response: response,
        repository: repository,
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(AiSequentialAuthoringPanel)),
      );
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);

      await scrollPanelUp(tester);
      expect(find.text('Arduino night light'), findsOneWidget);
      expect(find.text('Conversation filler message 27'), findsNothing);

      await controller.runAction(action: 'SUGGEST_ANOTHER', turnId: 'turn-title');
      await tester.pumpAndSettle();

      expect(find.text('Conversation filler message 27'), findsNothing);
    });
  });
}
