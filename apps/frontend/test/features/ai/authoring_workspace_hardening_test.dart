import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/application/authoring_workspace_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';
import 'package:frontend/features/ai/domain/ai_helpers.dart';
import 'package:frontend/features/ai/domain/authoring_session_models.dart';

import 'support/authoring_workspace_fixtures.dart';

ProviderContainer _container(ConfigurableAuthoringRepository repository) {
  final container = ProviderContainer(
    overrides: [aiRepositoryProvider.overrideWithValue(repository)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('workspace isolation and lifecycle', () {
    test('project A state cannot enter project B workspace', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            projectId: 'project-a',
            conversationId: 'conv-a',
            sessionId: 'session-a',
            turn: authoringTurnFixture(id: 'turn-a'),
            canonicalProject: canonicalProjectFixture(
              projectId: 'project-a',
              title: 'Project A',
            ),
          ),
          authoringSessionFixture(
            projectId: 'project-b',
            conversationId: 'conv-b',
            sessionId: 'session-b',
            turn: authoringTurnFixture(id: 'turn-b', payload: {'value': 'Project B'}),
            canonicalProject: canonicalProjectFixture(
              projectId: 'project-b',
              title: 'Project B',
            ),
          ),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);

      await controller.activateAndLoad(
        projectId: 'project-a',
        conversationId: 'conv-a',
      );
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.canonicalProject.title,
        'Project A',
      );

      await controller.activateAndLoad(
        projectId: 'project-b',
        conversationId: 'conv-b',
      );
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.lifecycle, AuthoringWorkspaceLifecycle.ready);
      expect(state.snapshot?.session.projectId, 'project-b');
      expect(state.snapshot?.canonicalProject.title, 'Project B');
    });

    test('route switch clears prior workspace generation', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(sessionId: 'session-a'),
          authoringSessionFixture(sessionId: 'session-b', conversationId: 'conv-b'),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      final genA = container.read(authoringWorkspaceControllerProvider).workspaceGeneration;
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-b');
      final genB = container.read(authoringWorkspaceControllerProvider).workspaceGeneration;
      expect(genB, greaterThan(genA));
    });

    test('late project A response is ignored after project B activation', () async {
      final completerA = Completer<AuthoringSessionResponse>();
      final repository = ConfigurableAuthoringRepository(
        onStart: (conversationId) async {
          if (conversationId == 'conv-a') {
            return completerA.future;
          }
          return authoringSessionFixture(
            projectId: 'project-b',
            conversationId: 'conv-b',
            sessionId: 'session-b',
            canonicalProject: canonicalProjectFixture(
              projectId: 'project-b',
              title: 'Project B',
            ),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);

      final futureA = controller.activateAndLoad(
        projectId: 'project-a',
        conversationId: 'conv-a',
      );
      await controller.activateAndLoad(
        projectId: 'project-b',
        conversationId: 'conv-b',
      );
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.canonicalProject.title,
        'Project B',
      );

      completerA.complete(
        authoringSessionFixture(
          projectId: 'project-a',
          conversationId: 'conv-a',
          sessionId: 'session-a',
          canonicalProject: canonicalProjectFixture(
            projectId: 'project-a',
            title: 'Late A',
          ),
        ),
      );
      await futureA;
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.canonicalProject.title,
        'Project B',
      );
    });

    test('older version response is rejected', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(version: 3, turn: authoringTurnFixture(id: 'turn-3')),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      final state = container.read(authoringWorkspaceControllerProvider);
      final accepted = controller.applyIncomingResponseForTest(
        incoming: authoringSessionFixture(
          version: 2,
          turn: authoringTurnFixture(id: 'turn-2'),
        ),
        operationGeneration: controller.operationGeneration,
        workspaceGeneration: state.workspaceGeneration,
      );
      expect(accepted, isFalse);
      expect(state.response?.session.version, 3);
    });

    test('activation failure shows failed lifecycle without legacy fallback', () async {
      final repository = ConfigurableAuthoringRepository();
      repository.nextError = const ApiException(
        message: 'Network down',
        code: 'NETWORK_ERROR',
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.lifecycle, AuthoringWorkspaceLifecycle.failed);
      expect(state.snapshot, isNull);
      expect(state.actionError?.code, 'NETWORK_ERROR');
    });
  });

  group('feedback and current-turn safety', () {
    test('feedback replaces active turn and preserves learner message', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            version: 1,
            turn: authoringTurnFixture(id: 'turn-a', payload: {'value': 60}),
          ),
        ],
        onMessage: ({
          required sessionId,
          required expectedVersion,
          text,
          clientMessageId,
          questionId,
          selectedOptionIds,
          otherText,
          currentTurnId,
        }) async {
          return authoringSessionFixture(
            version: 2,
            turn: authoringTurnFixture(id: 'turn-b', payload: {'value': 90}),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.sendFeedback(text: 'Need 90 minutes', locale: 'en');
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.pendingUserMessages, isEmpty);
      expect(
        state.sessionConversationMessages.map((item) => item.contentText),
        contains('Need 90 minutes'),
      );
      expect(state.snapshot?.currentSuggestion?.turnId, 'turn-b');
      expect(state.historicalTurns.map((item) => item.turnId), contains('turn-a'));
      expect(state.snapshot?.canonicalProject.title, 'Arduino desk light');
    });

    test('feedback failure keeps turn A active without Saved', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(turn: authoringTurnFixture(id: 'turn-a')),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      repository.nextError = const ApiException(
        message: 'Provider failed',
        code: 'AI_PROVIDER_ERROR',
      );
      await controller.sendFeedback(text: 'Retry me', locale: 'en');
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.snapshot?.currentSuggestion?.turnId, 'turn-a');
      expect(state.actionError, isNotNull);
      expect(state.historicalTurns, isEmpty);
    });

    test('feedback retry does not duplicate learner message', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(turn: authoringTurnFixture(id: 'turn-a')),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      repository.nextError = const ApiException(message: 'fail', code: 'NETWORK_ERROR');
      await controller.sendFeedback(text: 'Same text', locale: 'en');
      repository.nextError = null;
      repository.onMessage = ({
        required sessionId,
        required expectedVersion,
        text,
        clientMessageId,
        questionId,
        selectedOptionIds,
        otherText,
        currentTurnId,
      }) async {
        return authoringSessionFixture(
          version: 2,
          turn: authoringTurnFixture(id: 'turn-b'),
        );
      };
      await controller.sendFeedback(text: 'Same text', locale: 'en');
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.pendingUserMessages, isEmpty);
      expect(
        state.sessionConversationMessages
            .where((item) => item.contentText == 'Same text')
            .length,
        1,
      );
    });

    test('accept uses current turn B id not historical turn A', () async {
      String? capturedTurnId;
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            version: 2,
            turn: authoringTurnFixture(id: 'turn-b'),
          ),
        ],
        onAction: ({
          required sessionId,
          required action,
          required expectedVersion,
          turnId,
          manualValue,
          mode,
          targetStage,
        }) async {
          capturedTurnId = turnId;
          return authoringSessionFixture(
            version: 3,
            stage: 'SHORT_DESCRIPTION',
            turn: authoringTurnFixture(id: 'turn-c', stage: 'SHORT_DESCRIPTION'),
            canonicalProject: canonicalProjectFixture(title: 'Accepted title'),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'ACCEPT_TURN', turnId: 'turn-b');
      expect(capturedTurnId, 'turn-b');
      expect(
        container.read(authoringWorkspaceControllerProvider).lastActionTurnId,
        'turn-b',
      );
    });

    test('delayed turn B cannot overwrite newer turn C', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(version: 3, turn: authoringTurnFixture(id: 'turn-c')),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      final state = container.read(authoringWorkspaceControllerProvider);
      final accepted = controller.applyIncomingResponseForTest(
        incoming: authoringSessionFixture(
          version: 2,
          turn: authoringTurnFixture(id: 'turn-b'),
        ),
        operationGeneration: controller.operationGeneration,
        workspaceGeneration: state.workspaceGeneration,
      );
      expect(accepted, isFalse);
      expect(state.snapshot?.currentSuggestion?.turnId, 'turn-c');
    });
  });

  group('canonical synchronization', () {
    test('title accept publishes canonical update immediately', () async {
      final container = _container(
        ConfigurableAuthoringRepository(
          startResponses: [
            authoringSessionFixture(turn: authoringTurnFixture(id: 'turn-title')),
          ],
          onAction: ({
            required sessionId,
            required action,
            required expectedVersion,
            turnId,
            manualValue,
            mode,
            targetStage,
          }) async {
            return authoringSessionFixture(
              version: 2,
              stage: 'SHORT_DESCRIPTION',
              canonicalProject: canonicalProjectFixture(
                title: 'Accepted Arduino Light',
                updatedAt: '2026-07-17T12:05:00.000Z',
              ),
            );
          },
        ),
      );
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'ACCEPT_TURN', turnId: 'turn-title');
      final update = container.read(authoringCanonicalProjectUpdateProvider);
      expect(update?.snapshot.title, 'Accepted Arduino Light');
      expect(update?.projectId, 'project-1');
    });

    test('canonical project fields map from session response', () {
      final components = [
        const AiAuthoringProposalComponent(
          componentName: 'Breadboard',
          materialType: 'Tool',
          quantity: 1,
          unit: 'piece',
          componentRole: 'TOOL',
          isRequired: true,
          canBeSubstituted: true,
        ),
      ];
      final steps = [
        const AiAuthoringProposalStep(
          title: 'Wire circuit',
          description: 'Connect the sensor.',
        ),
      ];
      final canonical = canonicalProjectFixture(
        title: 'T',
        shortDescription: 'SD',
        description: 'FD',
        difficulty: 'ADVANCED',
        estimatedMinutes: 120,
        components: components,
        steps: steps,
        updatedAt: '2026-07-18T00:00:00.000Z',
      );
      final snapshot = snapshotFromSession(authoringSessionFixture(canonicalProject: canonical));
      expect(snapshot.canonicalProject.title, 'T');
      expect(snapshot.canonicalProject.shortDescription, 'SD');
      expect(snapshot.canonicalProject.description, 'FD');
      expect(snapshot.canonicalProject.difficulty, '');
      expect(snapshot.canonicalProject.estimatedMinutes, isNull);
      expect(snapshot.canonicalProject.components.single.componentName, 'Breadboard');
      expect(snapshot.canonicalProject.steps.single.title, 'Wire circuit');
    });

    test('invalid or unaccepted difficulty maps to empty editor value', () {
      expect(
        authoringDifficultyForEditor(
          maskedDifficulty: 'BEGINNER',
          completedStages: const {},
        ),
        '',
      );
      expect(
        authoringDifficultyForEditor(
          maskedDifficulty: 'not-a-level',
          completedStages: const {'DIFFICULTY'},
        ),
        '',
      );
      expect(
        authoringDifficultyForEditor(
          maskedDifficulty: 'beginner',
          completedStages: const {'DIFFICULTY'},
        ),
        'BEGINNER',
      );
      expect(isValidAuthoringDifficulty(''), isFalse);
      expect(isValidAuthoringDifficulty('EASY'), isFalse);
      expect(isValidAuthoringDifficulty('advanced'), isTrue);
    });

    test('failed component generation keeps accepted duration and no invalid components', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'COMPONENTS',
            status: 'GENERATION_FAILED',
            version: 5,
            completedStages: const [
              'TITLE',
              'SHORT_DESCRIPTION',
              'DESCRIPTION',
              'DIFFICULTY',
              'ESTIMATED_DURATION',
            ],
            availableActions: const ['REGENERATE_STALE'],
            canonicalProject: canonicalProjectFixture(
              title: 'Arduino LDR night light',
              estimatedMinutes: 180,
              components: const [],
            ),
          ),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.snapshot?.session.status, 'GENERATION_FAILED');
      final canonicalUpdate =
          container.read(authoringCanonicalProjectUpdateProvider);
      expect(
        canonicalUpdate,
        isNotNull,
        reason: 'accepted duration must not be hidden on component failure',
      );
      expect(canonicalUpdate!.snapshot.estimatedMinutes, 180);
      expect(
        canonicalUpdate.snapshot.components,
        isEmpty,
        reason: 'an invalid proposal must never reach the editor',
      );
    });

    test('component finalize replaces list without duplicates', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'COMPONENTS',
            version: 4,
            componentReviewState: const {
              'mode': 'FULL_LIST',
              'awaitingFinalSave': true,
              'workingComponents': [],
            },
            availableActions: const ['FINALIZE_SECTION'],
          ),
        ],
        onAction: ({
          required sessionId,
          required action,
          required expectedVersion,
          turnId,
          manualValue,
          mode,
          targetStage,
        }) async {
          expect(action, 'FINALIZE_COMPONENTS');
          return authoringSessionFixture(
            stage: 'STEPS_OVERVIEW',
            version: 5,
            canonicalProject: canonicalProjectFixture(
              updatedAt: '2026-07-17T12:10:00.000Z',
              components: [
                const AiAuthoringProposalComponent(
                  componentName: 'Breadboard',
                  materialType: 'Tool',
                  quantity: 1,
                  unit: 'piece',
                  componentRole: 'TOOL',
                  isRequired: true,
                  canBeSubstituted: true,
                ),
              ],
            ),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'FINALIZE_SECTION');
      final canonical =
          container.read(authoringWorkspaceControllerProvider).snapshot?.canonicalProject;
      expect(canonical?.components, hasLength(1));
      expect(canonical?.components.single.componentName, 'Breadboard');
    });
  });

  group('components workflow', () {
    test('natural component feedback creates revised list turn', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'COMPONENTS',
            version: 1,
            turn: authoringTurnFixture(
              id: 'turn-a',
              stage: 'COMPONENTS',
              payload: {
                'components': [
                  {
                    'componentName': 'Jumper wires',
                    'quantity': 10,
                    'unit': 'piece',
                    'componentRole': 'TOOL',
                    'isRequired': true,
                    'canBeSubstituted': true,
                  },
                ],
              },
            ),
          ),
        ],
        onMessage: ({
          required sessionId,
          required expectedVersion,
          text,
          clientMessageId,
          questionId,
          selectedOptionIds,
          otherText,
          currentTurnId,
        }) async {
          return authoringSessionFixture(
            stage: 'COMPONENTS',
            version: 2,
            turn: authoringTurnFixture(
              id: 'turn-b',
              stage: 'COMPONENTS',
              payload: {
                'components': [
                  {
                    'componentName': 'Breadboard',
                    'quantity': 1,
                    'unit': 'piece',
                    'componentRole': 'TOOL',
                    'isRequired': true,
                    'canBeSubstituted': true,
                  },
                  {
                    'componentName': 'Jumper wires',
                    'quantity': 15,
                    'unit': 'piece',
                    'componentRole': 'TOOL',
                    'isRequired': true,
                    'canBeSubstituted': true,
                  },
                ],
              },
            ),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.sendFeedback(
        text: 'ضيف Breadboard وخلي Jumper wires عددهم 15.',
        locale: 'ar',
      );
      final suggestion =
          container.read(authoringWorkspaceControllerProvider).snapshot?.currentSuggestion;
      expect(suggestion?.turnId, 'turn-b');
      expect(
        suggestion?.components.map((c) => c.componentName),
        containsAll(['Breadboard', 'Jumper wires']),
      );
      final wires = suggestion!.components.firstWhere(
        (component) => component.componentName == 'Jumper wires',
      );
      expect(wires.quantity, 15);
      expect(
        container.read(authoringWorkspaceControllerProvider).historicalTurns.single.turnId,
        'turn-a',
      );
    });

    test('step generation failure keeps components saved stage', () async {
      final response = authoringSessionFixture(
        stage: 'STEPS_OVERVIEW',
        status: 'GENERATION_FAILED',
        version: 6,
        availableActions: const ['REGENERATE_STALE'],
        canonicalProject: canonicalProjectFixture(
          components: [
            const AiAuthoringProposalComponent(
              componentName: 'LDR',
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
      final snapshot = snapshotFromSession(response);
      expect(snapshot.session.status, 'GENERATION_FAILED');
      expect(snapshot.session.stage, 'STEPS_OVERVIEW');
      expect(snapshot.canonicalProject.components, isNotEmpty);
      expect(snapshot.availableActions, contains('REGENERATE_STALE'));
    });

    test('explain step action does not promote turn to history', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'STEP_REVIEW',
            version: 3,
            stepReviewState: const {
              'mode': 'STEP_BY_STEP',
              'currentIndex': 0,
              'workingSteps': [
                {'title': 'Wire', 'description': 'Connect'},
              ],
            },
            turn: authoringTurnFixture(
              id: 'step-turn',
              stage: 'STEP_REVIEW',
              payload: {
                'index': 0,
                'total': 1,
                'title': 'Wire',
                'description': 'Connect',
              },
            ),
            availableActions: const ['EXPLAIN_STEP', 'ACCEPT_TURN'],
          ),
        ],
        onAction: ({
          required sessionId,
          required action,
          required expectedVersion,
          turnId,
          manualValue,
          mode,
          targetStage,
        }) async {
          expect(action, 'EXPLAIN_STEP');
          return authoringSessionFixture(
            stage: 'STEP_REVIEW',
            version: 3,
            turn: authoringTurnFixture(
              id: 'step-turn',
              stage: 'STEP_REVIEW',
              explanation: 'Explain wiring polarity carefully.',
              payload: {
                'index': 0,
                'total': 1,
                'title': 'Wire',
                'description': 'Connect',
              },
            ),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'EXPLAIN_STEP', turnId: 'step-turn');
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.historicalTurns, isEmpty);
      expect(state.snapshot?.currentSuggestion?.turnId, 'step-turn');
      expect(state.snapshot?.currentSuggestion?.explanation, contains('polarity'));
    });

    test('activateAndLoad restores persisted conversation messages', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'STEPS_OVERVIEW',
            version: 4,
            turn: authoringTurnFixture(
              id: 'steps-turn',
              stage: 'STEPS_OVERVIEW',
              payload: {'steps': longStepPayload(count: 6)},
            ),
            conversationMessages: [
              {
                'id': 'msg-user-1',
                'role': 'USER',
                'status': 'COMPLETED',
                'contentText': 'اشرحلي أول خطوة',
                'contentBlocks': [],
                'createdAt': '2026-07-20T10:00:00.000Z',
              },
              {
                'id': 'msg-assistant-1',
                'role': 'ASSISTANT',
                'status': 'COMPLETED',
                'contentText': 'الخطوة الأولى تجهّز المكوّنات.',
                'contentBlocks': [],
                'createdAt': '2026-07-20T10:00:01.000Z',
              },
            ],
          ),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      final messages =
          container.read(authoringWorkspaceControllerProvider).sessionConversationMessages;
      expect(messages.map((item) => item.contentText), contains('اشرحلي أول خطوة'));
      expect(messages.map((item) => item.contentText), contains('الخطوة الأولى تجهّز المكوّنات.'));
    });

    test('STEPS explanation keeps turn and ingests assistant reply', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'STEPS_OVERVIEW',
            version: 4,
            turn: authoringTurnFixture(
              id: 'steps-turn',
              stage: 'STEPS_OVERVIEW',
              payload: {'steps': longStepPayload(count: 6)},
            ),
            availableActions: const [
              'ACCEPT_TURN',
              'SUGGEST_ANOTHER',
              'SAVE_MANUAL',
              'CHOOSE_MODE',
            ],
          ),
        ],
        onMessage: ({
          required sessionId,
          required expectedVersion,
          text,
          clientMessageId,
          questionId,
          selectedOptionIds,
          otherText,
          currentTurnId,
        }) async {
          return authoringSessionFixture(
            stage: 'STEPS_OVERVIEW',
            version: 4,
            turn: authoringTurnFixture(
              id: 'steps-turn',
              stage: 'STEPS_OVERVIEW',
              payload: {'steps': longStepPayload(count: 6)},
            ),
            availableActions: const [
              'ACCEPT_TURN',
              'SUGGEST_ANOTHER',
              'SAVE_MANUAL',
              'CHOOSE_MODE',
            ],
            conversationMessages: [
              {
                'id': 'msg-user-2',
                'role': 'USER',
                'status': 'COMPLETED',
                'contentText': text,
                'contentBlocks': [],
                'createdAt': '2026-07-20T10:05:00.000Z',
              },
              {
                'id': 'msg-assistant-2',
                'role': 'ASSISTANT',
                'status': 'COMPLETED',
                'contentText': 'الخطوة الأولى تبدأ بتجهيز Arduino والتحقق من المكوّنات.',
                'contentBlocks': [],
                'createdAt': '2026-07-20T10:05:01.000Z',
              },
            ],
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.sendFeedback(
        text: 'اشرحلي أول خطوة بالتفصيل',
        locale: 'ar',
      );
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.isBusy, isFalse);
      expect(state.snapshot?.currentSuggestion?.turnId, 'steps-turn');
      expect(state.historicalTurns, isEmpty);
      expect(
        state.sessionConversationMessages.map((item) => item.contentText),
        contains('اشرحلي أول خطوة بالتفصيل'),
      );
      expect(
        state.sessionConversationMessages.map((item) => item.contentText),
        contains('الخطوة الأولى تبدأ بتجهيز Arduino والتحقق من المكوّنات.'),
      );
      await controller.sendFeedback(text: 'طيب ليش لازم أبدأ فيها؟', locale: 'ar');
      final afterFollowUp = container.read(authoringWorkspaceControllerProvider);
      expect(afterFollowUp.isBusy, isFalse);
      expect(afterFollowUp.snapshot?.currentSuggestion?.turnId, 'steps-turn');
    });

    test('scalar explanation accepts unchanged turn and reconciles optimistic user', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'SHORT_DESCRIPTION',
            version: 3,
            turn: authoringTurnFixture(
              id: 'desc-turn',
              stage: 'SHORT_DESCRIPTION',
              payload: {'value': 'وصف للمبتدئين'},
            ),
          ),
        ],
        onMessage: ({
          required sessionId,
          required expectedVersion,
          text,
          clientMessageId,
          questionId,
          selectedOptionIds,
          otherText,
          currentTurnId,
        }) async {
          return authoringSessionFixture(
            stage: 'SHORT_DESCRIPTION',
            version: 3,
            turn: authoringTurnFixture(
              id: 'desc-turn',
              stage: 'SHORT_DESCRIPTION',
              payload: {'value': 'وصف للمبتدئين'},
            ),
            conversationMessages: [
              {
                'id': 'msg-user-scalar',
                'role': 'USER',
                'status': 'COMPLETED',
                'contentText': text,
                'contentBlocks': [],
                'createdAt': '2026-07-20T10:10:00.000Z',
                'clientMessageId': clientMessageId,
              },
              {
                'id': 'msg-assistant-scalar',
                'role': 'ASSISTANT',
                'status': 'COMPLETED',
                'contentText': 'هذا الوصف مناسب لأنه يركز على فكرة بسيطة للمبتدئ.',
                'contentBlocks': [],
                'createdAt': '2026-07-20T10:10:01.000Z',
              },
            ],
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.sendFeedback(
        text: 'ليش هذا الوصف مناسب للمبتدئ؟',
        locale: 'ar',
      );
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.isBusy, isFalse);
      expect(state.snapshot?.currentSuggestion?.turnId, 'desc-turn');
      expect(
        state.sessionConversationMessages.map((item) => item.contentText),
        contains('ليش هذا الوصف مناسب للمبتدئ؟'),
      );
      expect(
        state.sessionConversationMessages.map((item) => item.contentText),
        contains('هذا الوصف مناسب لأنه يركز على فكرة بسيطة للمبتدئ.'),
      );
    });
  });

  group('final review revisit and finish', () {
    test('revisit stage sends REVISIT_STAGE with target', () async {
      String? target;
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'FINAL_REVIEW',
            version: 8,
            availableActions: const ['FINISH'],
          ),
        ],
        onAction: ({
          required sessionId,
          required action,
          required expectedVersion,
          turnId,
          manualValue,
          mode,
          targetStage,
        }) async {
          target = targetStage;
          return authoringSessionFixture(
            stage: 'TITLE',
            version: 9,
            turn: authoringTurnFixture(id: 'revisit-title', stage: 'TITLE'),
            canonicalProject: canonicalProjectFixture(title: 'Still canonical'),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.revisitStage('TITLE');
      expect(target, 'TITLE');
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.session.stage,
        'TITLE',
      );
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.canonicalProject.title,
        'Still canonical',
      );
    });

    test('finish marks session complete without changing draft title source', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(stage: 'FINAL_REVIEW', version: 10),
        ],
        onAction: ({
          required sessionId,
          required action,
          required expectedVersion,
          turnId,
          manualValue,
          mode,
          targetStage,
        }) async {
          expect(action, 'FINISH');
          return authoringSessionFixture(
            stage: 'COMPLETE',
            status: 'COMPLETE',
            version: 11,
            turn: null,
            availableActions: const [],
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'FINISH');
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.response?.session.stage, 'COMPLETE');
      expect(state.snapshot?.session.isComplete, isTrue);
      expect(state.snapshot?.currentSuggestion, isNull);
    });
  });

  group('legacy transition', () {
    test('legacy conversation stays in ready state without session snapshot', () async {
      final repository = ConfigurableAuthoringRepository();
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(
        projectId: 'project-1',
        conversationId: 'conv-1',
        hasLegacyBlocks: true,
      );
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.hasLegacyWithoutSession, isTrue);
      expect(state.snapshot, isNull);
      expect(state.lifecycle, AuthoringWorkspaceLifecycle.ready);
      expect(repository.startSessionCalls, 0);
    });

    test('continue guided authoring starts dedicated session once', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(sessionId: 'new-session'),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(
        projectId: 'project-1',
        conversationId: 'conv-1',
        hasLegacyBlocks: true,
      );
      await controller.continueGuidedAuthoring();
      expect(repository.startSessionCalls, 1);
      expect(
        container.read(authoringWorkspaceControllerProvider).response?.session.id,
        'new-session',
      );
      expect(
        container.read(authoringWorkspaceControllerProvider).hasLegacyWithoutSession,
        isFalse,
      );
    });
  });

  group('error mapping', () {
    for (final code in <String>[
      'AI_AUTHORING_SESSION_STALE',
      'AI_AUTHORING_TURN_SUPERSEDED',
      'AI_AUTHORING_CONTEXT_MISMATCH',
      'AI_AUTHORING_ACTION_NOT_ALLOWED',
      'AI_AUTHORING_PROPOSAL_STALE',
      'AI_RESPONSE_INVALID',
      'AI_PROVIDER_RESPONSE_INVALID',
      'INVALID_ESTIMATED_DURATION',
      'AI_COMPONENT_SAVE_FAILED',
      'AI_STEP_GENERATION_FAILED',
      'AI_STEP_COMPONENT_INCONSISTENT',
      'AI_STEP_SAVE_FAILED',
      'CANONICAL_CLIENT_SYNC_FAILED',
      'NETWORK_ERROR',
    ]) {
      test('maps $code to specific message', () {
        final message = aiErrorMessageForCode(code, 'fallback');
        expect(message, isNot('fallback'));
        expect(message.toLowerCase(), isNot(contains('something went wrong')));
      });
    }

    test('stale action triggers reload not blind retry', () async {
      var loadCalls = 0;
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(version: 1, turn: authoringTurnFixture(id: 'turn-a')),
          authoringSessionFixture(version: 5, turn: authoringTurnFixture(id: 'turn-reloaded')),
        ],
        onLoad: (sessionId) async {
          loadCalls += 1;
          return authoringSessionFixture(version: 5, turn: authoringTurnFixture(id: 'turn-reloaded'));
        },
      );
      repository.onAction = ({
        required sessionId,
        required action,
        required expectedVersion,
        turnId,
        manualValue,
        mode,
        targetStage,
      }) async {
        throw const ApiException(message: 'stale', code: 'AI_AUTHORING_SESSION_STALE');
      };
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'ACCEPT_TURN', turnId: 'turn-a');
      expect(loadCalls, 1);
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.currentSuggestion?.turnId,
        'turn-reloaded',
      );
    });

    test('invalid AI response refreshes the persisted session before retry UI is shown', () async {
      var loadCalls = 0;
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(version: 1, turn: authoringTurnFixture(id: 'turn-a')),
        ],
        onLoad: (sessionId) async {
          loadCalls += 1;
          return authoringSessionFixture(version: 2, stage: 'COMPONENTS', turn: null);
        },
      );
      repository.onAction = ({
        required sessionId,
        required action,
        required expectedVersion,
        turnId,
        manualValue,
        mode,
        targetStage,
      }) async {
        throw const ApiException(
          message: 'invalid provider response',
          code: 'AI_RESPONSE_INVALID',
        );
      };
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'ACCEPT_TURN', turnId: 'turn-a');
      expect(loadCalls, 1);
      expect(container.read(authoringWorkspaceControllerProvider).snapshot?.session.stage, 'COMPONENTS');
    });
  });

  group('clarification startup', () {
    test('overview canonical fields are masked before authoring begins', () {
      final snapshot = authoringSessionResponseToSnapshot(
        authoringSessionFixture(
          stage: 'OVERVIEW',
          turn: AuthoringPersistedTurn(
            id: 'clarify-1',
            stage: 'OVERVIEW',
            kind: 'FOLLOW_UP_QUESTION',
            status: 'PROPOSED',
            payload: const {
              'questionId': 'q1',
              'question': 'ما مستوى الصعوبة المناسب؟',
              'options': [
                {'id': 'q1-1', 'label': 'مبتدئ', 'value': 'مبتدئ'},
              ],
            },
            explanation: 'سؤال توضيحي',
            baseProjectUpdatedAt: '2026-07-17T12:00:00.000Z',
          ),
          canonicalProject: canonicalProjectFixture(
            title: 'Arduino soil moisture monitor',
            shortDescription: 'Summarize what the learner will build.',
            description: 'Explain the project goal and expected outcome.',
          ),
          availableActions: const ['START'],
        ),
      );

      expect(snapshot.canonicalProject.title, '');
      expect(snapshot.canonicalProject.shortDescription, '');
      expect(snapshot.canonicalProject.description, '');
      expect(snapshot.canonicalProject.difficulty, '');
      expect(snapshot.currentTurn?.proposal['question'], contains('مستوى'));
    });

    test('stale response cannot clear active clarification turn', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            version: 3,
            stage: 'OVERVIEW',
            turn: AuthoringPersistedTurn(
              id: 'clarify-2',
              stage: 'OVERVIEW',
              kind: 'FOLLOW_UP_QUESTION',
              status: 'PROPOSED',
              payload: const {
                'questionId': 'q2',
                'question': 'السؤال الثاني',
                'options': [
                  {'id': 'q2-1', 'label': 'خيار أ', 'value': 'خيار أ'},
                ],
              },
              explanation: 'q2',
              baseProjectUpdatedAt: '2026-07-17T12:00:00.000Z',
            ),
            availableActions: const ['START'],
          ),
        ],
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      final state = container.read(authoringWorkspaceControllerProvider);
      final accepted = controller.applyIncomingResponseForTest(
        incoming: authoringSessionFixture(
          version: 2,
          stage: 'OVERVIEW',
          turn: null,
        ),
        operationGeneration: controller.operationGeneration,
        workspaceGeneration: state.workspaceGeneration,
      );
      expect(accepted, isFalse);
      expect(state.response?.currentTurn?.id, 'clarify-2');
    });

    test('clarification options are deduped by backend option id', () {
      final question = AuthoringClarificationQuestion.fromPayload({
        'questionId': 'q2',
        'question': 'السؤال الثاني',
        'options': [
          {'id': 'q2-1', 'label': 'خيار أ', 'value': 'خيار أ'},
          {'id': 'q2-1', 'label': 'خيار مكرر', 'value': 'خيار مكرر'},
        ],
      });
      expect(question.options, hasLength(1));
      expect(question.options.first.id, 'q2-1');
    });
  });

  group('composer scroll contract', () {
    test('composer sendFeedback ingests assistant exchange for rendering', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'SHORT_DESCRIPTION',
            version: 3,
            turn: authoringTurnFixture(
              id: 'desc-turn',
              stage: 'SHORT_DESCRIPTION',
              payload: const {'value': 'Night light for beginners using Arduino and LDR.'},
            ),
          ),
        ],
        onMessage: ({
          required sessionId,
          required expectedVersion,
          text,
          clientMessageId,
          questionId,
          selectedOptionIds,
          otherText,
          currentTurnId,
        }) async {
          return authoringSessionFixture(
            stage: 'SHORT_DESCRIPTION',
            version: 3,
            turn: authoringTurnFixture(
              id: 'desc-turn',
              stage: 'SHORT_DESCRIPTION',
              payload: const {'value': 'Night light for beginners using Arduino and LDR.'},
            ),
            conversationMessages: [
              {
                'id': 'msg-user-scroll',
                'role': 'USER',
                'status': 'COMPLETED',
                'contentText': text,
                'contentBlocks': [],
                'createdAt': '2026-07-20T10:05:00.000Z',
                'clientMessageId': clientMessageId,
              },
              {
                'id': 'msg-assistant-scroll',
                'role': 'ASSISTANT',
                'status': 'COMPLETED',
                'contentText': 'It focuses on light sensing instead of motion.',
                'contentBlocks': [],
                'createdAt': '2026-07-20T10:05:01.000Z',
              },
            ],
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.sendFeedback(
        text: 'Why is this description good for beginners?',
        locale: 'en',
      );
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.isBusy, isFalse);
      expect(state.snapshot?.currentSuggestion?.turnId, 'desc-turn');
      expect(
        state.sessionConversationMessages.map((item) => item.contentText),
        contains('It focuses on light sensing instead of motion.'),
      );
    });
  });
}
