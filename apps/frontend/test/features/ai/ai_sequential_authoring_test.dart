import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/application/authoring_workspace_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_helpers.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/domain/authoring_session_models.dart';
import 'package:frontend/features/ai/presentation/l10n/ai_l10n.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_content_blocks.dart';
import 'package:frontend/features/ai/presentation/widgets/ai_sequential_authoring_panel.dart';

import 'support/authoring_workspace_fixtures.dart';

void main() {
  group('AiAuthoringSession model', () {
    test('fromJson parses sequential component fields', () {
      final session = AiAuthoringSession.fromJson({
        'sessionId': 'sess-1',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': 'COMPONENTS',
        'flowStatus': 'WAITING_FOR_USER',
        'componentReviewMode': 'ONE_BY_ONE',
        'currentComponentIndex': 1,
        'workingComponents': [
          {
            'componentName': 'Arduino Uno',
            'materialType': 'ELECTRONICS',
            'quantity': 1,
            'unit': 'piece',
            'componentRole': 'REQUIRED_MATERIAL',
            'isRequired': true,
            'canBeSubstituted': false,
          },
          {
            'componentName': 'Soil sensor',
            'materialType': 'ELECTRONICS',
            'quantity': 1,
            'unit': 'piece',
            'componentRole': 'REQUIRED_MATERIAL',
            'isRequired': true,
            'canBeSubstituted': false,
          },
        ],
        'acceptedComponentIndexes': [0],
        'componentSourceTotal': 2,
        'awaitingComponentsFinalSave': false,
      });

      expect(session.currentComponentIndex, 1);
      expect(session.workingComponentCount, 2);
      expect(session.acceptedComponentCount, 1);
      expect(session.componentProgressIndex, 2);
      expect(session.componentProgressTotal, 2);
      expect(session.isComponentOneByOne, isTrue);
      expect(session.awaitingComponentsFinalSave, isFalse);
    });

    test('fromJson parses sequential step fields', () {
      final session = AiAuthoringSession.fromJson({
        'sessionId': 'sess-2',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': 'STEP_REVIEW',
        'flowStatus': 'WAITING_FOR_USER',
        'stepReviewMode': 'STEP_BY_STEP',
        'currentStepIndex': 0,
        'workingSteps': [
          {'title': 'Wire sensor', 'description': 'Connect VCC and GND.'},
          {'title': 'Upload code', 'description': 'Flash the sketch.'},
        ],
        'acceptedStepIndexes': const [],
        'awaitingStepsFinalSave': false,
      });

      expect(session.currentStepIndex, 0);
      expect(session.workingStepCount, 2);
      expect(session.stepProgressIndex, 1);
      expect(session.isStepByStep, isTrue);
      expect(session.awaitingStepsFinalSave, isFalse);
    });

    test('fromJson parses awaiting final save flags', () {
      final session = AiAuthoringSession.fromJson({
        'sessionId': 'sess-3',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': 'COMPONENTS',
        'flowStatus': 'WAITING_FOR_USER',
        'awaitingComponentsFinalSave': true,
        'awaitingStepsFinalSave': true,
      });

      expect(session.awaitingComponentsFinalSave, isTrue);
      expect(session.awaitingStepsFinalSave, isTrue);
    });

    test('componentProgressTotal falls back to componentSourceTotal', () {
      const session = AiAuthoringSession(
        sessionId: 'sess-4',
        projectId: 'proj-1',
        baseUpdatedAt: '2026-07-17T12:00:00.000Z',
        stage: 'COMPONENTS',
        flowStatus: 'WAITING_FOR_USER',
        componentSourceTotal: 5,
      );

      expect(session.componentProgressTotal, 5);
    });
  });

  group('authoring sync helpers', () {
    test('authoringComponentsSynchronized compares normalized component fields', () {
      const canonical = [
        AiAuthoringProposalComponent(
          componentName: 'Arduino Uno',
          materialType: 'Board',
          quantity: 1,
          unit: 'piece',
          componentRole: 'REQUIRED_MATERIAL',
          isRequired: true,
          canBeSubstituted: false,
        ),
      ];
      const visible = [
        AiAuthoringProposalComponent(
          componentName: 'arduino uno',
          materialType: 'Board',
          quantity: 1,
          unit: 'Piece',
          componentRole: 'REQUIRED_MATERIAL',
          isRequired: true,
          canBeSubstituted: false,
        ),
      ];

      expect(authoringComponentsSynchronized(canonical, visible), isTrue);
    });

    test('authoringDraftSnapshotsSynchronized checks steps when requested', () {
      const canonical = AuthoringDraftSnapshot(
        title: 'Door alarm',
        shortDescription: 'Beginner project',
        description: 'Alert on open door',
        difficulty: 'BEGINNER',
        components: const [],
        steps: const [
          AiAuthoringProposalStep(title: 'Wire buzzer', description: 'Connect buzzer to pin 8.'),
        ],
      );
      const visible = AuthoringDraftSnapshot(
        title: 'Door alarm',
        shortDescription: 'Beginner project',
        description: 'Alert on open door',
        difficulty: 'BEGINNER',
        components: const [],
        steps: const [
          AiAuthoringProposalStep(title: 'Wire buzzer', description: 'Connect buzzer to pin 8.'),
        ],
      );

      expect(
        authoringDraftSnapshotsSynchronized(canonical, visible, checkSteps: true),
        isTrue,
      );
    });
  });

  group('AiAuthoringCurrentSuggestion model', () {
    test('fromJson parses step list proposal', () {
      final suggestion = AiAuthoringCurrentSuggestion.fromJson({
        'turnId': 'turn-steps',
        'stage': 'STEPS_OVERVIEW',
        'explanation': 'Ordered plan',
        'status': 'PROPOSED',
        'steps': [
          {'title': 'Prepare parts', 'description': 'Collect Arduino and sensors.'},
          {'title': 'Wire reed switch', 'description': 'Connect reed switch input.'},
        ],
      });

      expect(suggestion.hasStepList, isTrue);
      expect(suggestion.steps.length, 2);
      expect(suggestion.steps.first.title, 'Prepare parts');
    });
  });

  group('AiAssistantController sequential authoring', () {
    late _SequentialMockRepository repository;
    late ProviderContainer container;

    setUp(() {
      repository = _SequentialMockRepository();
      container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    Future<void> seedConversation(List<AiMessageItem> messages) async {
      repository.messages = messages;
      await container
          .read(aiAssistantControllerProvider.notifier)
          .openConversation('conv-sequential');
    }

    AiAuthoringSession sessionBlock({
      String stage = 'TITLE',
      String? componentReviewMode,
      String? stepReviewMode,
      int? currentComponentIndex,
      List<Map<String, dynamic>>? workingComponents,
      List<int>? acceptedComponentIndexes,
      bool awaitingComponentsFinalSave = false,
      int? currentStepIndex,
      List<Map<String, dynamic>>? workingSteps,
      bool awaitingStepsFinalSave = false,
      String? currentTurnId,
    }) {
      return AiAuthoringSession.fromJson({
        'sessionId': 'sess-seq',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': stage,
        'flowStatus': 'WAITING_FOR_USER',
        if (currentTurnId != null) 'currentTurnId': currentTurnId,
        if (componentReviewMode != null)
          'componentReviewMode': componentReviewMode,
        if (stepReviewMode != null) 'stepReviewMode': stepReviewMode,
        if (currentComponentIndex != null)
          'currentComponentIndex': currentComponentIndex,
        if (workingComponents != null) 'workingComponents': workingComponents,
        if (acceptedComponentIndexes != null)
          'acceptedComponentIndexes': acceptedComponentIndexes,
        'awaitingComponentsFinalSave': awaitingComponentsFinalSave,
        if (currentStepIndex != null) 'currentStepIndex': currentStepIndex,
        if (workingSteps != null) 'workingSteps': workingSteps,
        'awaitingStepsFinalSave': awaitingStepsFinalSave,
      });
    }

    AiContentBlock turnBlock({
      required String stage,
      required String turnId,
      Map<String, dynamic>? proposal,
      String explanation = 'Explanation',
    }) {
      return AiContentBlock(
        type: 'project_authoring_turn',
        authoringTurn: AiAuthoringTurn.fromJson({
          'turnId': turnId,
          'sessionId': 'sess-seq',
          'stage': stage,
          'projectId': 'proj-1',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'status': 'PROPOSED',
          'proposal': proposal ?? {'value': 'Suggested title'},
          'explanation': explanation,
        }),
      );
    }

    test('hasLegacyAuthoringWithoutSession is true for legacy proposal only', () async {
      await seedConversation([
        AiMessageItem(
          id: 'assistant-proposal',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: const [
            AiContentBlock(
              type: 'project_authoring_proposal',
              authoringProposalId: 'proposal-legacy',
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 17),
        ),
      ]);

      expect(
        container.read(aiAssistantControllerProvider.notifier).hasLegacyAuthoringWithoutSession,
        isTrue,
      );
    });

    test('hasLegacyAuthoringWithoutSession is false when session exists', () async {
      await seedConversation([
        AiMessageItem(
          id: 'assistant-session',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: [
            AiContentBlock(
              type: 'project_authoring_session',
              authoringSession: sessionBlock(),
            ),
            AiContentBlock(
              type: 'project_authoring_proposal',
              authoringProposalId: 'proposal-legacy',
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 17),
        ),
      ]);

      expect(
        container.read(aiAssistantControllerProvider.notifier).hasLegacyAuthoringWithoutSession,
        isFalse,
      );
    });

    test('hasActiveSequentialAuthoring ignores complete sessions', () async {
      await seedConversation([
        AiMessageItem(
          id: 'assistant-complete',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: [
            AiContentBlock(
              type: 'project_authoring_session',
              authoringSession: sessionBlock(stage: 'COMPLETE'),
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 17),
        ),
      ]);

      expect(
        container.read(aiAssistantControllerProvider.notifier).hasActiveSequentialAuthoring,
        isFalse,
      );
    });

    test('runSequentialAuthoringAction forwards REMOVE_ITEM', () async {
      await seedConversation(const []);
      await container.read(aiAssistantControllerProvider.notifier).runSequentialAuthoringAction(
            action: 'REMOVE_ITEM',
            turnId: 'turn-1',
          );

      expect(repository.lastSequentialAction, 'REMOVE_ITEM');
      expect(repository.lastSequentialTurnId, 'turn-1');
    });

    test('runSequentialAuthoringAction forwards ADD_ITEM with manual value', () async {
      await seedConversation(const []);
      const component = {
        'componentName': 'LED',
        'materialType': 'ELECTRONICS',
        'quantity': 1,
        'unit': 'piece',
        'componentRole': 'REQUIRED_MATERIAL',
        'isRequired': true,
        'canBeSubstituted': false,
      };

      await container.read(aiAssistantControllerProvider.notifier).runSequentialAuthoringAction(
            action: 'ADD_ITEM',
            turnId: 'turn-1',
            manualValue: component,
          );

      expect(repository.lastSequentialAction, 'ADD_ITEM');
      expect(repository.lastSequentialManualValue, component);
    });

    test('isSequentialAuthoringStartPhrase matches legacy explicit phrases', () {
      expect(isSequentialAuthoringStartPhrase('Start'), isTrue);
      expect(isSequentialAuthoringStartPhrase('ابدأ'), isTrue);
      expect(isSequentialAuthoringStartPhrase('يلا نبدأ'), isTrue);
      expect(isSequentialAuthoringStartPhrase('I want to start my project'), isFalse);
    });

    test('AiAuthoringSnapshot parses currentSuggestion', () {
      final snapshot = AiAuthoringSnapshot.fromJson({
        'session': {
          'sessionId': 'sess-1',
          'projectId': 'proj-1',
          'stage': 'TITLE',
          'status': 'WAITING_FOR_USER',
          'completedStages': [],
          'currentTurnId': 'turn-1',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'isStale': false,
        },
        'currentSuggestion': {
          'turnId': 'turn-1',
          'stage': 'TITLE',
          'value': 'Short title',
          'explanation': 'Suggested title',
          'status': 'PROPOSED',
        },
        'canonicalProject': {
          'id': 'proj-1',
          'updatedAt': '2026-07-17T12:00:00.000Z',
          'title': 'Old title',
          'shortDescription': 'Summary',
          'description': 'Description',
          'difficulty': 'BEGINNER',
          'estimatedMinutes': 60,
        },
        'availableActions': ['ACCEPT_TURN', 'SAVE_MANUAL'],
        'progress': {'completed': 0, 'total': 7},
      });

      expect(snapshot.currentSuggestion?.value, 'Short title');
      expect(snapshot.currentSuggestion?.isProposed, isTrue);
    });

    test('AiAuthoringSnapshot parses component currentSuggestion', () {
      final snapshot = AiAuthoringSnapshot.fromJson({
        'session': {
          'sessionId': 'sess-components',
          'projectId': 'proj-1',
          'stage': 'COMPONENTS',
          'status': 'WAITING_FOR_USER',
          'completedStages': ['TITLE'],
          'currentTurnId': 'turn-components',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'isStale': false,
        },
        'currentSuggestion': {
          'turnId': 'turn-components',
          'stage': 'COMPONENTS',
          'explanation': 'Beginner-friendly list',
          'status': 'PROPOSED',
          'components': [
            {
              'componentName': 'Arduino Uno',
              'materialType': 'Microcontroller',
              'quantity': 1,
              'unit': 'piece',
              'componentRole': 'TOOL',
              'isRequired': true,
              'canBeSubstituted': true,
            },
          ],
        },
        'canonicalProject': {
          'id': 'proj-1',
          'updatedAt': '2026-07-17T12:00:00.000Z',
          'title': 'Old title',
          'shortDescription': 'Summary',
          'description': 'Description',
          'difficulty': 'BEGINNER',
          'estimatedMinutes': 120,
        },
        'availableActions': ['CHOOSE_MODE', 'SUGGEST_ANOTHER'],
        'progress': {'completed': 1, 'total': 7},
      });

      expect(snapshot.currentSuggestion?.hasComponentList, isTrue);
      expect(snapshot.currentSuggestion?.components.first.componentName, 'Arduino Uno');
    });

    test('generic component placeholder text is detectable', () {
      expect(
        isGenericComponentPlaceholderText(
          'A coherent component list for the project.',
        ),
        isTrue,
      );
      expect(
        isGenericComponentPlaceholderText('Arduino, soil sensor, LED'),
        isFalse,
      );
    });

    test('sendMessage routes overview text to COMPOSER_MESSAGE action', () async {
      await seedConversation([
        AiMessageItem(
          id: 'assistant-overview',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: [
            AiContentBlock(
              type: 'project_authoring_session',
              authoringSession: sessionBlock(stage: 'OVERVIEW'),
            ),
          ],
          createdAt: DateTime.utc(2026, 7, 17),
        ),
      ]);

      await container.read(aiAssistantControllerProvider.notifier).sendMessage(
            text: 'اه',
            locale: 'ar',
          );

      expect(repository.lastSequentialAction, 'COMPOSER_MESSAGE');
    });

    test('runSequentialAuthoringAction forwards BACK_ITEM', () async {
      await seedConversation(const []);
      await container.read(aiAssistantControllerProvider.notifier).runSequentialAuthoringAction(
            action: 'BACK_ITEM',
            turnId: 'turn-1',
          );

      expect(repository.lastSequentialAction, 'BACK_ITEM');
    });

    test('runSequentialAuthoringAction forwards EXPLAIN_STEP', () async {
      await seedConversation(const []);
      await container.read(aiAssistantControllerProvider.notifier).runSequentialAuthoringAction(
            action: 'EXPLAIN_STEP',
            turnId: 'turn-step',
          );

      expect(repository.lastSequentialAction, 'EXPLAIN_STEP');
      expect(repository.lastSequentialTurnId, 'turn-step');
    });

    test('runSequentialAuthoringAction forwards FINALIZE_SECTION', () async {
      await seedConversation(const []);
      await container.read(aiAssistantControllerProvider.notifier).runSequentialAuthoringAction(
            action: 'FINALIZE_SECTION',
            turnId: 'turn-finalize',
          );

      expect(repository.lastSequentialAction, 'FINALIZE_SECTION');
    });

    test('runSequentialAuthoringAction forwards CONTINUE_GUIDED', () async {
      await seedConversation(const []);
      await container.read(aiAssistantControllerProvider.notifier).runSequentialAuthoringAction(
            action: 'CONTINUE_GUIDED',
          );

      expect(repository.lastSequentialAction, 'CONTINUE_GUIDED');
    });

    test('regenerateStaleAuthoringSuggestion forwards REGENERATE_STALE', () async {
      await seedConversation(const []);
      await container
          .read(aiAssistantControllerProvider.notifier)
          .regenerateStaleAuthoringSuggestion();

      expect(repository.lastSequentialAction, 'REGENERATE_STALE');
    });

    test('findCurrentAuthoringTurn returns latest proposed turn for session', () async {
      await seedConversation([
        AiMessageItem(
          id: 'assistant-turn',
          role: 'ASSISTANT',
          status: 'COMPLETED',
          contentText: null,
          contentBlocks: [
            AiContentBlock(
              type: 'project_authoring_session',
              authoringSession: sessionBlock(currentTurnId: 'turn-current'),
            ),
            turnBlock(stage: 'TITLE', turnId: 'turn-current'),
          ],
          createdAt: DateTime.utc(2026, 7, 17),
        ),
      ]);

      final turn = container
          .read(aiAssistantControllerProvider.notifier)
          .findCurrentAuthoringTurn();
      expect(turn?.turnId, 'turn-current');
      expect(turn?.stage, 'TITLE');
    });
  });

  group('Sequential authoring stage card widget', () {
    late _SequentialMockRepository repository;

    setUp(() {
      repository = _SequentialMockRepository();
    });

    Future<void> pumpStageCard(
      WidgetTester tester, {
      required List<AiMessageItem> messages,
      required AiContentBlock block,
    }) async {
      repository.messages = messages;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiRepositoryProvider.overrideWithValue(repository),
          ],
          child: MaterialApp(
            locale: const Locale('en'),
            localizationsDelegates: const [
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: const [Locale('en')],
            home: _SequentialStageTestHost(
              block: block,
              conversationId: 'conv-sequential',
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pumpAndSettle();
    }

    AiMessageItem assistantMessage(List<AiContentBlock> blocks) {
      return AiMessageItem(
        id: 'assistant-1',
        role: 'ASSISTANT',
        status: 'COMPLETED',
        contentText: null,
        contentBlocks: blocks,
        createdAt: DateTime.utc(2026, 7, 17),
      );
    }

    AiAuthoringSession oneByOneSession({bool awaitingFinalSave = false}) {
      return AiAuthoringSession.fromJson({
        'sessionId': 'sess-seq',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': 'COMPONENTS',
        'flowStatus': 'WAITING_FOR_USER',
        'componentReviewMode': 'ONE_BY_ONE',
        'currentComponentIndex': 0,
        'workingComponents': [
          {
            'componentName': 'Arduino Uno',
            'materialType': 'ELECTRONICS',
            'quantity': 1,
            'unit': 'piece',
            'componentRole': 'REQUIRED_MATERIAL',
            'isRequired': true,
            'canBeSubstituted': false,
          },
          {
            'componentName': 'Soil sensor',
            'materialType': 'ELECTRONICS',
            'quantity': 1,
            'unit': 'piece',
            'componentRole': 'REQUIRED_MATERIAL',
            'isRequired': true,
            'canBeSubstituted': false,
          },
        ],
        'acceptedComponentIndexes': const [],
        'awaitingComponentsFinalSave': awaitingFinalSave,
      });
    }

    testWidgets('shows legacy transition banner and continue guided action', (tester) async {
      final block = const AiContentBlock(
        type: 'project_authoring_proposal',
        authoringProposalId: 'legacy-proposal',
      );
      final messages = [
        assistantMessage([block]),
      ];

      await pumpStageCard(tester, messages: messages, block: block);
      await tester.pumpAndSettle();

      expect(
        find.text(AiL10n.authoringSequentialLegacyTransitionBanner.en),
        findsOneWidget,
      );
      expect(
        find.text(AiL10n.authoringSequentialContinueGuided.en),
        findsOneWidget,
      );

      await tester.tap(find.text(AiL10n.authoringSequentialContinueGuided.en));
      await tester.pumpAndSettle();

      expect(repository.lastSequentialAction, 'CONTINUE_GUIDED');
    });

    testWidgets('shows component progress in one-by-one mode', (tester) async {
      final session = oneByOneSession();
      final turn = AiContentBlock(
        type: 'project_authoring_turn',
        authoringTurn: AiAuthoringTurn.fromJson({
          'turnId': 'turn-component',
          'sessionId': 'sess-seq',
          'stage': 'COMPONENTS',
          'projectId': 'proj-1',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'status': 'PROPOSED',
          'proposal': {
            'index': 0,
            'total': 2,
            'component': {
              'componentName': 'Arduino Uno',
              'materialType': 'ELECTRONICS',
              'quantity': 1,
              'unit': 'piece',
              'componentRole': 'REQUIRED_MATERIAL',
              'isRequired': true,
              'canBeSubstituted': false,
            },
          },
          'explanation': 'Component 1 of 2: Arduino Uno',
        }),
      );
      final messages = [
        assistantMessage([
          AiContentBlock(type: 'project_authoring_session', authoringSession: session),
          turn,
        ]),
      ];

      await pumpStageCard(tester, messages: messages, block: turn);

      expect(find.text('Component 1 of 2'), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialAcceptComponent.en), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialRemoveItem.en), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialAddItem.en), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialBackItem.en), findsOneWidget);
    });

    testWidgets('shows step progress and explain more in step-by-step mode', (tester) async {
      final session = AiAuthoringSession.fromJson({
        'sessionId': 'sess-seq',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': 'STEP_REVIEW',
        'flowStatus': 'WAITING_FOR_USER',
        'stepReviewMode': 'STEP_BY_STEP',
        'currentStepIndex': 1,
        'workingSteps': [
          {'title': 'Wire sensor', 'description': 'Connect VCC and GND.'},
          {'title': 'Upload code', 'description': 'Flash the sketch.'},
        ],
      });
      final turn = AiContentBlock(
        type: 'project_authoring_turn',
        authoringTurn: AiAuthoringTurn.fromJson({
          'turnId': 'turn-step',
          'sessionId': 'sess-seq',
          'stage': 'STEP_REVIEW',
          'projectId': 'proj-1',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'status': 'PROPOSED',
          'proposal': {
            'index': 1,
            'title': 'Upload code',
            'description': 'Flash the sketch.',
          },
          'explanation': 'Step 2 of 2: Upload code',
        }),
      );
      final messages = [
        assistantMessage([
          AiContentBlock(type: 'project_authoring_session', authoringSession: session),
          turn,
        ]),
      ];

      await pumpStageCard(tester, messages: messages, block: turn);

      expect(find.text('Step 2 of 2'), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialAcceptStep.en), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialExplainStep.en), findsOneWidget);
    });

    testWidgets('shows accept list and save when awaitingComponentsFinalSave', (tester) async {
      final session = oneByOneSession(awaitingFinalSave: true);
      final turn = AiContentBlock(
        type: 'project_authoring_turn',
        authoringTurn: AiAuthoringTurn.fromJson({
          'turnId': 'turn-final-list',
          'sessionId': 'sess-seq',
          'stage': 'COMPONENTS',
          'projectId': 'proj-1',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'status': 'PROPOSED',
          'proposal': {
            'components': [
              {
                'componentName': 'Arduino Uno',
                'materialType': 'ELECTRONICS',
                'quantity': 1,
                'unit': 'piece',
                'componentRole': 'REQUIRED_MATERIAL',
                'isRequired': true,
                'canBeSubstituted': false,
              },
            ],
          },
          'explanation': 'Review the full list.',
        }),
      );
      final messages = [
        assistantMessage([
          AiContentBlock(type: 'project_authoring_session', authoringSession: session),
          turn,
        ]),
      ];

      await pumpStageCard(tester, messages: messages, block: turn);

      expect(find.text(AiL10n.authoringSequentialAcceptListAndSave.en), findsOneWidget);

      await tester.tap(find.text(AiL10n.authoringSequentialAcceptListAndSave.en));
      await tester.pumpAndSettle();

      expect(repository.lastSequentialAction, 'FINALIZE_SECTION');
    });

    testWidgets('component remove action calls repository', (tester) async {
      final session = oneByOneSession();
      final turn = AiContentBlock(
        type: 'project_authoring_turn',
        authoringTurn: AiAuthoringTurn.fromJson({
          'turnId': 'turn-remove',
          'sessionId': 'sess-seq',
          'stage': 'COMPONENTS',
          'projectId': 'proj-1',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'status': 'PROPOSED',
          'proposal': {
            'index': 0,
            'component': {
              'componentName': 'Arduino Uno',
              'materialType': 'ELECTRONICS',
              'quantity': 1,
              'unit': 'piece',
              'componentRole': 'REQUIRED_MATERIAL',
              'isRequired': true,
              'canBeSubstituted': false,
            },
          },
          'explanation': 'Component 1 of 2',
        }),
      );
      final messages = [
        assistantMessage([
          AiContentBlock(type: 'project_authoring_session', authoringSession: session),
          turn,
        ]),
      ];

      await pumpStageCard(tester, messages: messages, block: turn);
      await tester.tap(find.text(AiL10n.authoringSequentialRemoveItem.en));
      await tester.pumpAndSettle();

      expect(repository.lastSequentialAction, 'REMOVE_ITEM');
    });

    testWidgets('overview session block shows start button', (tester) async {
      final session = AiAuthoringSession.fromJson({
        'sessionId': 'sess-overview',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': 'OVERVIEW',
        'flowStatus': 'WAITING_FOR_USER',
      });
      final sessionBlockWidget = AiContentBlock(
        type: 'project_authoring_session',
        authoringSession: session,
      );
      final messages = [
        assistantMessage([sessionBlockWidget]),
      ];

      await pumpStageCard(tester, messages: messages, block: sessionBlockWidget);

      expect(find.text(AiL10n.authoringSequentialStart.en), findsOneWidget);
    });

    testWidgets('overview start button calls START action', (tester) async {
      final session = AiAuthoringSession.fromJson({
        'sessionId': 'sess-overview',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': 'OVERVIEW',
        'flowStatus': 'WAITING_FOR_USER',
      });
      final sessionBlockWidget = AiContentBlock(
        type: 'project_authoring_session',
        authoringSession: session,
      );
      final messages = [
        assistantMessage([sessionBlockWidget]),
      ];

      await pumpStageCard(tester, messages: messages, block: sessionBlockWidget);
      await tester.tap(find.text(AiL10n.authoringSequentialStart.en));
      await tester.pumpAndSettle();

      expect(repository.lastSequentialAction, 'START');
    });

    testWidgets('final review shows finish button', (tester) async {
      final session = AiAuthoringSession.fromJson({
        'sessionId': 'sess-final',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': 'FINAL_REVIEW',
        'flowStatus': 'WAITING_FOR_USER',
      });
      const block = AiContentBlock(type: 'project_authoring_turn');
      final messages = [
        assistantMessage([
          AiContentBlock(type: 'project_authoring_session', authoringSession: session),
        ]),
      ];

      await pumpStageCard(tester, messages: messages, block: block);

      expect(find.text(AiL10n.authoringSequentialFinish.en), findsOneWidget);
    });

    testWidgets('components stage shows accept and one-by-one actions in content block view', (tester) async {
      final session = AiAuthoringSession.fromJson({
        'sessionId': 'sess-components',
        'projectId': 'proj-1',
        'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
        'stage': 'COMPONENTS',
        'flowStatus': 'WAITING_FOR_USER',
      });
      final turn = AiContentBlock(
        type: 'project_authoring_turn',
        authoringTurn: AiAuthoringTurn.fromJson({
          'turnId': 'turn-components',
          'sessionId': 'sess-components',
          'stage': 'COMPONENTS',
          'projectId': 'proj-1',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'status': 'PROPOSED',
          'proposal': {
            'components': [
              {
                'componentName': 'Arduino Uno',
                'materialType': 'ELECTRONICS',
                'quantity': 1,
                'unit': 'piece',
                'componentRole': 'REQUIRED_MATERIAL',
                'isRequired': true,
                'canBeSubstituted': false,
              },
            ],
          },
          'explanation': 'Choose review mode',
        }),
      );
      final messages = [
        assistantMessage([
          AiContentBlock(type: 'project_authoring_session', authoringSession: session),
          turn,
        ]),
      ];

      await pumpStageCard(tester, messages: messages, block: turn);

      expect(find.text(AiL10n.authoringSequentialReviewOneByOne.en), findsOneWidget);
    });
  });

  group('AiSequentialAuthoringPanel widget', () {
    late _SequentialMockRepository repository;

    setUp(() {
      repository = _SequentialMockRepository();
    });

    AiAuthoringSnapshot componentSnapshot({
      List<Map<String, dynamic>>? canonicalComponents,
    }) {
      return AiAuthoringSnapshot.fromJson({
        'session': {
          'sessionId': 'sess-components',
          'projectId': 'proj-1',
          'stage': 'COMPONENTS',
          'status': 'WAITING_FOR_USER',
          'completedStages': ['TITLE'],
          'currentTurnId': 'turn-components',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'isStale': false,
        },
        'currentSuggestion': {
          'turnId': 'turn-components',
          'stage': 'COMPONENTS',
          'explanation': 'Beginner-friendly list',
          'status': 'PROPOSED',
          'components': [
            {
              'componentName': 'Arduino Uno',
              'materialType': 'Microcontroller',
              'quantity': 1,
              'unit': 'piece',
              'componentRole': 'TOOL',
              'isRequired': true,
              'canBeSubstituted': true,
              'notes': 'Controls the project logic.',
            },
            {
              'componentName': 'Soil moisture sensor',
              'materialType': 'Sensor',
              'quantity': 1,
              'unit': 'piece',
              'componentRole': 'REQUIRED_MATERIAL',
              'isRequired': true,
              'canBeSubstituted': true,
            },
          ],
        },
        'canonicalProject': {
          'id': 'proj-1',
          'updatedAt': '2026-07-17T12:00:00.000Z',
          'title': 'Soil moisture alert',
          'shortDescription': 'Summary',
          'description': 'Description',
          'difficulty': 'BEGINNER',
          'estimatedMinutes': 120,
          'components': canonicalComponents ??
              [
                {
                  'id': 'comp-old',
                  'componentName': 'Ultrasonic sensor',
                  'materialType': 'Sensor',
                  'quantity': 1,
                  'unit': 'piece',
                  'componentRole': 'REQUIRED_MATERIAL',
                  'isRequired': true,
                  'canBeSubstituted': false,
                },
              ],
        },
        'availableActions': ['ACCEPT_TURN', 'CHOOSE_MODE', 'SUGGEST_ANOTHER', 'SAVE_MANUAL'],
        'progress': {'completed': 5, 'total': 7},
      });
    }

    Future<ProviderContainer> pumpPanel(WidgetTester tester) async {
      repository.sequentialSnapshot = componentSnapshot();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiRepositoryProvider.overrideWithValue(repository),
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
                height: 720,
                width: 420,
                child: AiSequentialAuthoringPanel(locale: 'en'),
              ),
            ),
          ),
        ),
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(AiSequentialAuthoringPanel)),
      );
      await container
          .read(aiAssistantControllerProvider.notifier)
          .openConversation('conv-panel');
      container.read(authoringActiveWorkspaceProvider.notifier).activate(
            projectId: 'proj-1',
            conversationId: 'conv-panel',
          );
      container.read(authoringWorkspaceControllerProvider.notifier).seedSnapshot(
            projectId: 'proj-1',
            conversationId: 'conv-panel',
            snapshot: repository.sequentialSnapshot!,
            sessionId: 'sess-components',
      );
      await tester.pumpAndSettle();
      return container;
    }

    testWidgets('shows saved and proposed component labels with accept action', (tester) async {
      await pumpPanel(tester);

      expect(find.text(AiL10n.authoringSequentialSavedComponents.en), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialProposedComponents.en), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialAcceptListAndSave.en), findsOneWidget);
      expect(find.textContaining('Ultrasonic sensor'), findsOneWidget);
      expect(find.textContaining('Arduino Uno'), findsOneWidget);
      expect(find.text('COMPONENTS'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('reload draft fetches the persisted session once and replaces stale components', (
      tester,
    ) async {
      repository.pendingAuthoringSessionLoad = Completer<AuthoringSessionResponse>();
      repository.loadedAuthoringSession = authoringSessionFixture(
        projectId: 'proj-1',
        conversationId: 'conv-panel',
        sessionId: 'sess-components',
        version: 2,
        stage: 'COMPONENTS',
        turn: authoringTurnFixture(
          id: 'turn-components-reloaded',
          stage: 'COMPONENTS',
          payload: const {
            'components': [
              {
                'componentName': 'Soil moisture sensor',
                'materialType': 'Sensor',
                'quantity': 1,
                'unit': 'piece',
                'componentRole': 'REQUIRED_MATERIAL',
                'isRequired': true,
                'canBeSubstituted': false,
              },
            ],
          },
        ),
        canonicalProject: canonicalProjectFixture(
          projectId: 'proj-1',
          updatedAt: '2026-07-17T12:10:00.000Z',
          components: const [
            AiAuthoringProposalComponent(
              id: 'comp-saved',
              componentName: 'Soil moisture sensor',
              materialType: 'Sensor',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
              canBeSubstituted: false,
            ),
          ],
        ),
      );
      final container = await pumpPanel(tester);
      container.read(authoringSaveSyncFailedProvider.notifier).markFailed();
      await tester.pump();

      final reloadNotice =
          find.text('Components were saved on the server. Reload the draft.');
      final panelScroll = find.descendant(
        of: find.byType(AiSequentialAuthoringPanel),
        matching: find.byType(Scrollable),
      ).first;
      await tester.scrollUntilVisible(reloadNotice, 300, scrollable: panelScroll);
      expect(reloadNotice, findsOneWidget);
      await tester.tap(find.text(AiL10n.authoringSequentialReloadDraft.en));
      await tester.pump();
      await container.read(authoringWorkspaceControllerProvider.notifier).reload();
      expect(repository.authoringSessionLoadCalls, 1);

      repository.pendingAuthoringSessionLoad!.complete(repository.loadedAuthoringSession);
      await tester.pumpAndSettle();

      final savedComponent = find.textContaining('Soil moisture sensor');
      await tester.drag(panelScroll, const Offset(0, 600));
      await tester.pumpAndSettle();
      expect(savedComponent, findsWidgets);
      expect(find.textContaining('Ultrasonic sensor'), findsNothing);
      expect(repository.authoringSessionLoadCalls, 1);
      expect(repository.authoringSessionStartCalls, 0);

      final update = container.read(authoringCanonicalProjectUpdateProvider);
      container
          .read(authoringWorkspaceControllerProvider.notifier)
          .acknowledgeEditorSynchronized(
            ScopedAuthoringEditorMirror(
              projectId: update!.projectId,
              canonicalUpdatedAt: update.canonicalUpdatedAt,
              snapshot: update.snapshot,
            ),
          );
      await tester.pump();
      expect(
        find.text('Components were saved on the server. Reload the draft.'),
        findsNothing,
      );
    });

    testWidgets('shows one-by-one and suggest another actions without overflow', (tester) async {
      await pumpPanel(tester);

      expect(find.text(AiL10n.authoringSequentialReviewOneByOne.en), findsOneWidget);
      expect(find.text('Suggest another list'), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialEnterOwnComponentList.en), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('short viewport renders panel without overflow', (tester) async {
      repository.sequentialSnapshot = componentSnapshot();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiRepositoryProvider.overrideWithValue(repository),
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
                height: 360,
                width: 420,
                child: AiSequentialAuthoringPanel(locale: 'en'),
              ),
            ),
          ),
        ),
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(AiSequentialAuthoringPanel)),
      );
      await container
          .read(aiAssistantControllerProvider.notifier)
          .openConversation('conv-panel');
      container.read(authoringActiveWorkspaceProvider.notifier).activate(
            projectId: 'proj-1',
            conversationId: 'conv-panel',
          );
      container.read(authoringWorkspaceControllerProvider.notifier).seedSnapshot(
            projectId: 'proj-1',
            conversationId: 'conv-panel',
            snapshot: repository.sequentialSnapshot!,
            sessionId: 'sess-components',
          );
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows generate step plan after generation failure', (tester) async {
      repository.sequentialSnapshot = AiAuthoringSnapshot.fromJson({
        'session': {
          'sessionId': 'sess-steps-failed',
          'projectId': 'proj-1',
          'stage': 'STEPS_OVERVIEW',
          'status': 'GENERATION_FAILED',
          'completedStages': ['COMPONENTS'],
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'isStale': false,
        },
        'canonicalProject': {
          'id': 'proj-1',
          'updatedAt': '2026-07-17T12:00:00.000Z',
          'title': 'LDR desk light',
          'shortDescription': 'Summary',
          'description': 'Description',
          'difficulty': 'BEGINNER',
          'estimatedMinutes': 120,
          'components': [
            {
              'id': 'comp-ldr',
              'componentName': 'LDR',
              'materialType': 'Sensor',
              'quantity': 1,
              'unit': 'piece',
              'componentRole': 'REQUIRED_MATERIAL',
              'isRequired': true,
              'canBeSubstituted': false,
            },
          ],
        },
        'availableActions': ['REGENERATE_STALE'],
        'progress': {'completed': 6, 'total': 7},
      });
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiRepositoryProvider.overrideWithValue(repository),
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
                height: 720,
                width: 420,
                child: AiSequentialAuthoringPanel(locale: 'en'),
              ),
            ),
          ),
        ),
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(AiSequentialAuthoringPanel)),
      );
      await container
          .read(aiAssistantControllerProvider.notifier)
          .openConversation('conv-panel');
      container.read(authoringActiveWorkspaceProvider.notifier).activate(
            projectId: 'proj-1',
            conversationId: 'conv-panel',
          );
      container.read(authoringWorkspaceControllerProvider.notifier).seedSnapshot(
            projectId: 'proj-1',
            conversationId: 'conv-panel',
            snapshot: repository.sequentialSnapshot!,
            sessionId: 'sess-steps-failed',
          );
      await tester.pumpAndSettle();

      expect(
        find.textContaining('Components saved. The step plan could not be generated.'),
        findsOneWidget,
      );
      expect(find.text(AiL10n.authoringSequentialGenerateStepPlan.en), findsOneWidget);
      expect(find.textContaining('Soil moisture sensor'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows ordered step plan without placeholder text', (tester) async {
      repository.sequentialSnapshot = AiAuthoringSnapshot.fromJson({
        'session': {
          'sessionId': 'sess-steps',
          'projectId': 'proj-1',
          'stage': 'STEPS_OVERVIEW',
          'status': 'WAITING_FOR_USER',
          'completedStages': ['COMPONENTS'],
          'currentTurnId': 'turn-steps',
          'baseUpdatedAt': '2026-07-17T12:00:00.000Z',
          'isStale': false,
        },
        'currentSuggestion': {
          'turnId': 'turn-steps',
          'stage': 'STEPS_OVERVIEW',
          'explanation': 'Beginner-friendly ordered plan.',
          'status': 'PROPOSED',
          'steps': [
            {
              'title': 'Prepare the components',
              'description': 'Collect the Arduino, reed switch, buzzer, and LED.',
            },
            {
              'title': 'Connect the reed switch',
              'description': 'Wire the magnetic door sensor to a digital input.',
            },
          ],
        },
        'canonicalProject': {
          'id': 'proj-1',
          'updatedAt': '2026-07-17T12:00:00.000Z',
          'title': 'Door alarm',
          'shortDescription': 'Summary',
          'description': 'Description',
          'difficulty': 'BEGINNER',
          'estimatedMinutes': 90,
          'components': [],
          'steps': [],
        },
        'availableActions': [
          'ACCEPT_TURN',
          'CHOOSE_MODE',
          'SUGGEST_ANOTHER',
          'SAVE_MANUAL',
        ],
        'progress': {'completed': 6, 'total': 7},
      });
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            aiRepositoryProvider.overrideWithValue(repository),
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
                height: 720,
                width: 420,
                child: AiSequentialAuthoringPanel(locale: 'en'),
              ),
            ),
          ),
        ),
      );
      final container = ProviderScope.containerOf(
        tester.element(find.byType(AiSequentialAuthoringPanel)),
      );
      await container
          .read(aiAssistantControllerProvider.notifier)
          .openConversation('conv-steps');
      container.read(authoringWorkspaceControllerProvider.notifier).seedSnapshot(
            projectId: 'proj-1',
            conversationId: 'conv-steps',
            snapshot: repository.sequentialSnapshot!,
            sessionId: 'sess-steps',
          );
      await tester.pumpAndSettle();

      expect(find.textContaining('Prepare the components'), findsOneWidget);
      expect(find.textContaining('Connect the reed switch'), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialAcceptPlanAndSave.en), findsOneWidget);
      expect(find.text(AiL10n.authoringSequentialReviewStepByStep.en), findsOneWidget);
      expect(find.textContaining('ordered step outline'), findsNothing);
      expect(tester.takeException(), isNull);
    });
  });
  group('authoring stale helpers', () {
    test('stale component recovery is not a generic retry', () {
      expect(
        hasStaleComponentProposalRecovery('AI_AUTHORING_PROPOSAL_STALE', 'COMPONENTS'),
        isTrue,
      );
      expect(isRetryableAuthoringError('AI_AUTHORING_PROPOSAL_STALE'), isFalse);
      expect(
        authoringErrorMessageForDisplay(
          const ApiException(
            message: 'fallback',
            code: 'AI_AUTHORING_PROPOSAL_STALE',
          ),
          stage: 'COMPONENTS',
        ),
        'The draft changed after this component suggestion.',
      );
    });

    test('step generation failure recovery does not repeat component acceptance', () {
      expect(
        hasStepPlanGenerationRecovery('AI_STEP_GENERATION_FAILED_AFTER_COMPONENT_SAVE'),
        isTrue,
      );
      expect(
        isRetryableAuthoringError('AI_STEP_GENERATION_FAILED_AFTER_COMPONENT_SAVE'),
        isFalse,
      );
    });
  });

  group('authoring workspace isolation', () {
    late _SequentialMockRepository repository;
    late ProviderContainer container;

    setUp(() {
      repository = _SequentialMockRepository();
      container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(repository),
        ],
      );
    });

    tearDown(() {
      container.dispose();
    });

    AiAuthoringSnapshot snapshotForProject({
      required String projectId,
      required String stage,
      required String updatedAt,
      String status = 'WAITING_FOR_USER',
      String? currentTurnId,
    }) {
      return AiAuthoringSnapshot.fromJson({
        'session': {
          'sessionId': 'sess-$projectId',
          'projectId': projectId,
          'stage': stage,
          'status': status,
          'completedStages': stage == 'STEPS_OVERVIEW' ? ['COMPONENTS'] : const [],
          if (currentTurnId != null) 'currentTurnId': currentTurnId,
          'baseUpdatedAt': updatedAt,
          'isStale': false,
        },
        if (currentTurnId != null)
          'currentSuggestion': {
            'turnId': currentTurnId,
            'stage': stage,
            'explanation': 'Suggestion for $projectId',
            'status': 'PROPOSED',
            'components': [
              {
                'componentName': 'LDR',
                'materialType': 'Sensor',
                'quantity': 1,
                'unit': 'piece',
                'componentRole': 'REQUIRED_MATERIAL',
                'isRequired': true,
                'canBeSubstituted': false,
              },
            ],
          },
        'canonicalProject': {
          'id': projectId,
          'updatedAt': updatedAt,
          'title': 'Project $projectId',
          'shortDescription': 'Summary',
          'description': 'Description',
          'difficulty': 'BEGINNER',
          'estimatedMinutes': 120,
          'components': [
            {
              'id': 'comp-$projectId',
              'componentName': 'LDR',
              'materialType': 'Sensor',
              'quantity': 1,
              'unit': 'piece',
              'componentRole': 'REQUIRED_MATERIAL',
              'isRequired': true,
              'canBeSubstituted': false,
            },
          ],
        },
        'availableActions': ['ACCEPT_TURN'],
        'progress': {'completed': 5, 'total': 7},
      });
    }

    test('foreign project snapshot does not update active workspace', () async {
      repository.messages = const [];
      container.read(authoringActiveWorkspaceProvider.notifier).activate(
            projectId: 'proj-b',
            conversationId: 'conv-b',
          );
      await container
          .read(aiAssistantControllerProvider.notifier)
          .openConversation('conv-b');

      repository.sequentialSnapshot = snapshotForProject(
        projectId: 'proj-a',
        stage: 'COMPONENTS',
        updatedAt: '2026-07-17T12:00:00.000Z',
        currentTurnId: 'turn-a',
      );
      await container
          .read(aiAssistantControllerProvider.notifier)
          .refreshAuthoringSnapshot();

      expect(
        container.read(aiAssistantControllerProvider).authoringSnapshot,
        isNull,
      );
      expect(container.read(authoringCanonicalProjectUpdateProvider), isNull);
    });

    test('successful accept publishes scoped canonical update for active project', () async {
      repository.messages = const [];
      container.read(authoringActiveWorkspaceProvider.notifier).activate(
            projectId: 'proj-b',
            conversationId: 'conv-b',
          );
      await container
          .read(aiAssistantControllerProvider.notifier)
          .openConversation('conv-b');

      final acceptedSnapshot = snapshotForProject(
        projectId: 'proj-b',
        stage: 'STEPS_OVERVIEW',
        updatedAt: '2026-07-17T12:05:00.000Z',
      );
      repository.sequentialSnapshot = acceptedSnapshot;

      await container.read(aiAssistantControllerProvider.notifier).runSequentialAuthoringAction(
            action: 'ACCEPT_TURN',
            turnId: 'turn-b',
          );
      await Future<void>.delayed(Duration.zero);
      await Future<void>.delayed(Duration.zero);

      final update = container.read(authoringCanonicalProjectUpdateProvider);
      expect(update?.projectId, 'proj-b');
      expect(update?.canonicalUpdatedAt, '2026-07-17T12:05:00.000Z');
      expect(
        container.read(aiAssistantControllerProvider).authoringSnapshot?.session.stage,
        'STEPS_OVERVIEW',
      );
    });

    test('older COMPONENTS snapshot cannot regress newer STEPS stage', () async {
      repository.messages = const [];
      container.read(authoringActiveWorkspaceProvider.notifier).activate(
            projectId: 'proj-b',
            conversationId: 'conv-b',
          );
      await container
          .read(aiAssistantControllerProvider.notifier)
          .openConversation('conv-b');

      final stepsSnapshot = snapshotForProject(
        projectId: 'proj-b',
        stage: 'STEPS_OVERVIEW',
        updatedAt: '2026-07-17T12:05:00.000Z',
      );
      repository.sequentialSnapshot = stepsSnapshot;
      await container
          .read(aiAssistantControllerProvider.notifier)
          .refreshAuthoringSnapshot();

      repository.sequentialSnapshot = snapshotForProject(
        projectId: 'proj-b',
        stage: 'COMPONENTS',
        updatedAt: '2026-07-17T12:04:00.000Z',
        currentTurnId: 'turn-old',
      );
      await container
          .read(aiAssistantControllerProvider.notifier)
          .refreshAuthoringSnapshot();

      expect(
        container.read(aiAssistantControllerProvider).authoringSnapshot?.session.stage,
        'STEPS_OVERVIEW',
      );
    });
  });

  group('component sync warning', () {
    test('acknowledgeEditorSynchronized clears stale reload draft warning', () {
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(_SequentialMockRepository()),
        ],
      );
      addTearDown(container.dispose);

      final snapshot = AiAuthoringSnapshot.fromJson({
        'session': {
          'sessionId': 'sess-sync',
          'projectId': 'proj-b',
          'stage': 'STEPS_OVERVIEW',
          'status': 'GENERATION_FAILED',
          'completedStages': ['COMPONENTS'],
          'baseUpdatedAt': '2026-07-17T12:05:00.000Z',
          'isStale': false,
        },
        'canonicalProject': {
          'id': 'proj-b',
          'updatedAt': '2026-07-17T12:05:00.000Z',
          'title': 'Desk light',
          'shortDescription': 'Summary',
          'description': 'Description',
          'difficulty': 'BEGINNER',
          'estimatedMinutes': 120,
          'components': [
            {
              'id': 'comp-ldr',
              'componentName': 'LDR photoresistor',
              'materialType': 'Sensor',
              'quantity': 1,
              'unit': 'piece',
              'componentRole': 'REQUIRED_MATERIAL',
              'isRequired': true,
              'canBeSubstituted': false,
            },
          ],
        },
        'availableActions': ['REGENERATE_STALE'],
        'progress': {'completed': 6, 'total': 7},
      });

      container.read(aiAssistantControllerProvider.notifier).state = container
          .read(aiAssistantControllerProvider)
          .copyWith(
            conversationId: 'conv-b',
            authoringSnapshot: snapshot,
            sendError: const ApiException(
              message: 'Components were saved on the server. Reload the draft.',
              code: 'AI_COMPONENT_CLIENT_SYNC_FAILED',
            ),
          );
      container.read(authoringSaveSyncFailedProvider.notifier).markFailed();

      final mirror = ScopedAuthoringEditorMirror(
        projectId: 'proj-b',
        canonicalUpdatedAt: '2026-07-17T12:05:00.000Z',
        snapshot: snapshot.canonicalProject.toDraftSnapshot(),
      );
      container
          .read(aiAssistantControllerProvider.notifier)
          .acknowledgeEditorSynchronized(mirror);

      expect(container.read(authoringSaveSyncFailedProvider), isFalse);
      expect(container.read(aiAssistantControllerProvider).sendError, isNull);
      expect(container.read(authoringSaveSuccessVisibleProvider), isTrue);
    });

    test('genuine mismatch still marks sync failed', () {
      final container = ProviderContainer(
        overrides: [
          aiRepositoryProvider.overrideWithValue(_SequentialMockRepository()),
        ],
      );
      addTearDown(container.dispose);

      final snapshot = AiAuthoringSnapshot.fromJson({
        'session': {
          'sessionId': 'sess-sync',
          'projectId': 'proj-b',
          'stage': 'COMPONENTS',
          'status': 'WAITING_FOR_USER',
          'baseUpdatedAt': '2026-07-17T12:05:00.000Z',
          'isStale': false,
        },
        'canonicalProject': {
          'id': 'proj-b',
          'updatedAt': '2026-07-17T12:05:00.000Z',
          'title': 'Desk light',
          'shortDescription': 'Summary',
          'description': 'Description',
          'difficulty': 'BEGINNER',
          'estimatedMinutes': 120,
          'components': [
            {
              'id': 'comp-ldr',
              'componentName': 'LDR photoresistor',
              'materialType': 'Sensor',
              'quantity': 1,
              'unit': 'piece',
              'componentRole': 'REQUIRED_MATERIAL',
              'isRequired': true,
              'canBeSubstituted': false,
            },
          ],
        },
        'availableActions': ['ACCEPT_TURN'],
        'progress': {'completed': 5, 'total': 7},
      });

      container.read(aiAssistantControllerProvider.notifier).state = container
          .read(aiAssistantControllerProvider)
          .copyWith(
            conversationId: 'conv-b',
            authoringSnapshot: snapshot,
          );

      final mirror = ScopedAuthoringEditorMirror(
        projectId: 'proj-b',
        canonicalUpdatedAt: '2026-07-17T12:05:00.000Z',
        snapshot: const AuthoringDraftSnapshot(
          title: 'Desk light',
          shortDescription: 'Summary',
          description: 'Description',
          difficulty: 'BEGINNER',
          components: [
            AiAuthoringProposalComponent(
              id: 'comp-ldr',
              componentName: 'Soil moisture sensor',
              materialType: 'Sensor',
              quantity: 1,
              unit: 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: true,
              canBeSubstituted: false,
            ),
          ],
        ),
      );

      container
          .read(aiAssistantControllerProvider.notifier)
          .acknowledgeEditorSynchronized(mirror);

      expect(container.read(authoringSaveSyncFailedProvider), isFalse);
      expect(container.read(authoringSaveSuccessVisibleProvider), isFalse);
    });
  });
}

class _SequentialStageTestHost extends ConsumerStatefulWidget {
  const _SequentialStageTestHost({
    required this.block,
    required this.conversationId,
  });

  final AiContentBlock block;
  final String conversationId;

  @override
  ConsumerState<_SequentialStageTestHost> createState() =>
      _SequentialStageTestHostState();
}

class _SequentialStageTestHostState extends ConsumerState<_SequentialStageTestHost> {
  var _ready = false;

  @override
  void initState() {
    super.initState();
    Future<void>(() async {
      await ref
          .read(aiAssistantControllerProvider.notifier)
          .openConversation(widget.conversationId);
      if (mounted) {
        setState(() => _ready = true);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_ready) {
      return const Scaffold(body: SizedBox.shrink());
    }

    return Scaffold(
      body: AiContentBlockView(
        block: widget.block,
        messageBlocks: [widget.block],
        blockIndex: 0,
        locale: 'en',
      ),
    );
  }
}

class _SequentialMockRepository implements AiRepository {
  List<AiMessageItem> messages = const [];
  AiAuthoringSnapshot? sequentialSnapshot;

  String? lastSequentialAction;
  String? lastSequentialTurnId;
  Object? lastSequentialManualValue;
  ApiException? nextSequentialError;
  AuthoringSessionResponse? loadedAuthoringSession;
  Completer<AuthoringSessionResponse>? pendingAuthoringSessionLoad;
  var authoringSessionLoadCalls = 0;
  var authoringSessionStartCalls = 0;

  @override
  Future<AuthoringSessionResponse> startAuthoringSession({
    required String conversationId,
  }) async {
    authoringSessionStartCalls += 1;
    return loadedAuthoringSession ??
        authoringSessionFixture(conversationId: conversationId);
  }

  @override
  Future<AuthoringSessionResponse> loadAuthoringSession({
    required String sessionId,
  }) async {
    authoringSessionLoadCalls += 1;
    final pending = pendingAuthoringSessionLoad;
    if (pending != null) {
      return pending.future;
    }
    return loadedAuthoringSession ?? authoringSessionFixture(sessionId: sessionId);
  }

  @override
  Future<AiAuthoringSnapshot?> loadSequentialAuthoringState({
    required String conversationId,
  }) async {
    return sequentialSnapshot;
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
        mode: 'PROJECT_AUTHORING',
        locale: 'en',
        title: 'Sequential',
        preview: null,
        updatedAt: DateTime.utc(2026, 7, 17),
      ),
      items: messages,
    );
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
    lastSequentialAction = action;
    lastSequentialTurnId = turnId;
    lastSequentialManualValue = manualValue;

    if (nextSequentialError != null) {
      final error = nextSequentialError!;
      nextSequentialError = null;
      throw error;
    }

    return AiTurnResponse(
      conversationId: conversationId,
      userMessageId: 'user-seq',
      assistantMessageId: 'assistant-seq',
      contentBlocks: messages.isEmpty
          ? const [
              AiContentBlock(
                type: 'text',
                text: 'Sequential action handled.',
              ),
            ]
          : messages.last.contentBlocks,
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      authoringSnapshot: sequentialSnapshot,
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}
