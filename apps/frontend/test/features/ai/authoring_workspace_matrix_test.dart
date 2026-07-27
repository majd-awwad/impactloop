import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:frontend/core/errors/api_exception.dart';
import 'package:frontend/features/ai/application/ai_chat_controller.dart';
import 'package:frontend/features/ai/application/authoring_workspace_controller.dart';
import 'package:frontend/features/ai/data/ai_repository.dart';
import 'package:frontend/features/ai/domain/ai_models.dart';

import 'support/authoring_workspace_fixtures.dart';

ProviderContainer _container(ConfigurableAuthoringRepository repository) {
  final container = ProviderContainer(
    overrides: [aiRepositoryProvider.overrideWithValue(repository)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('canonical field synchronization matrix', () {
    Future<void> expectAcceptUpdatesField({
      required String stage,
      required String turnId,
      required String nextStage,
      required AiAuthoringCanonicalProject canonical,
      required void Function(AuthoringDraftSnapshot snapshot) assertField,
    }) async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: stage,
            turn: authoringTurnFixture(id: turnId, stage: stage),
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
          return authoringSessionFixture(
            stage: nextStage,
            version: 2,
            // Accepting a stage marks it complete; the canonical masking layer
            // only reveals a scalar (difficulty, estimated minutes) once its
            // stage is in completedStages, mirroring the real accept response.
            completedStages: [stage],
            canonicalProject: canonical,
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'ACCEPT_TURN', turnId: turnId);
      final update = container.read(authoringCanonicalProjectUpdateProvider);
      expect(update?.projectId, 'project-1');
      assertField(update!.snapshot);
    }

    test('short description accept synchronizes canonical shortDescription', () async {
      await expectAcceptUpdatesField(
        stage: 'SHORT_DESCRIPTION',
        turnId: 'turn-short',
        nextStage: 'DESCRIPTION',
        canonical: canonicalProjectFixture(shortDescription: 'Concise summary'),
        assertField: (snapshot) => expect(snapshot.shortDescription, 'Concise summary'),
      );
    });

    test('full description accept synchronizes canonical description', () async {
      await expectAcceptUpdatesField(
        stage: 'DESCRIPTION',
        turnId: 'turn-full',
        nextStage: 'DIFFICULTY',
        canonical: canonicalProjectFixture(description: 'Detailed build guide'),
        assertField: (snapshot) => expect(snapshot.description, 'Detailed build guide'),
      );
    });

    test('difficulty accept synchronizes canonical difficulty', () async {
      await expectAcceptUpdatesField(
        stage: 'DIFFICULTY',
        turnId: 'turn-diff',
        nextStage: 'ESTIMATED_DURATION',
        canonical: canonicalProjectFixture(difficulty: 'ADVANCED'),
        assertField: (snapshot) => expect(snapshot.difficulty, 'ADVANCED'),
      );
    });

    test('estimated duration accept synchronizes canonical minutes', () async {
      await expectAcceptUpdatesField(
        stage: 'ESTIMATED_DURATION',
        turnId: 'turn-duration',
        nextStage: 'COMPONENTS',
        canonical: canonicalProjectFixture(estimatedMinutes: 150),
        assertField: (snapshot) => expect(snapshot.estimatedMinutes, 150),
      );
    });

    test('steps finalize replaces canonical steps without duplicates', () async {
      final steps = [
        const AiAuthoringProposalStep(
          title: 'Wire sensor',
          description: 'Connect leads.',
        ),
        const AiAuthoringProposalStep(
          title: 'Upload sketch',
          description: 'Flash firmware.',
        ),
      ];
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'STEPS_OVERVIEW',
            version: 7,
            stepReviewState: const {
              'mode': 'FULL_PLAN',
              'awaitingFinalSave': true,
              'workingSteps': [],
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
          expect(action, 'FINALIZE_STEPS');
          return authoringSessionFixture(
            stage: 'FINAL_REVIEW',
            version: 8,
            canonicalProject: canonicalProjectFixture(
              updatedAt: '2026-07-17T12:20:00.000Z',
              steps: steps,
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
      expect(canonical?.steps.map((step) => step.title), ['Wire sensor', 'Upload sketch']);
      expect(canonical?.steps, hasLength(2));
    });
  });

  group('component workflow matrix', () {
    test('suggest another list creates a different turn identity', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'COMPONENTS',
            turn: authoringTurnFixture(id: 'turn-a', stage: 'COMPONENTS'),
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
          expect(action, 'SUGGEST_ANOTHER');
          return authoringSessionFixture(
            stage: 'COMPONENTS',
            version: 2,
            turn: authoringTurnFixture(id: 'turn-c', stage: 'COMPONENTS'),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'SUGGEST_ANOTHER', turnId: 'turn-a');
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.snapshot?.currentSuggestion?.turnId, 'turn-c');
      expect(state.historicalTurns.single.turnId, 'turn-a');
    });

    test('manual component save sends SAVE_MANUAL without canonical write before accept', () async {
      Object? capturedManual;
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'COMPONENTS',
            turn: authoringTurnFixture(id: 'turn-manual', stage: 'COMPONENTS'),
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
          capturedManual = manualValue;
          return authoringSessionFixture(
            stage: 'COMPONENTS',
            version: 2,
            turn: authoringTurnFixture(
              id: 'turn-manual-saved',
              stage: 'COMPONENTS',
              payload: manualValue as Map<String, dynamic>?,
            ),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      final manualValue = {
        'components': [
          {
            'componentName': 'Resistor',
            'quantity': 2,
            'unit': 'piece',
            'componentRole': 'REQUIRED_MATERIAL',
            'isRequired': true,
            'canBeSubstituted': false,
          },
        ],
      };
      await controller.runAction(
        action: 'SAVE_MANUAL',
        turnId: 'turn-manual',
        manualValue: manualValue,
      );
      expect(capturedManual, manualValue);
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.canonicalProject.components,
        isEmpty,
      );
    });

    test('one-by-one accept item does not finalize canonical components', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'COMPONENTS',
            version: 3,
            componentReviewState: const {
              'mode': 'ONE_BY_ONE',
              'currentIndex': 0,
              'workingComponents': [
                {'componentName': 'LED', 'quantity': 1},
              ],
            },
            turn: authoringTurnFixture(id: 'item-turn', stage: 'COMPONENTS'),
            availableActions: const ['ACCEPT_TURN'],
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
          expect(action, 'ACCEPT_CURRENT');
          return authoringSessionFixture(
            stage: 'COMPONENTS',
            version: 3,
            componentReviewState: const {
              'mode': 'ONE_BY_ONE',
              'currentIndex': 1,
              'workingComponents': [
                {'componentName': 'LED', 'quantity': 1},
                {'componentName': 'Resistor', 'quantity': 2},
              ],
            },
            turn: authoringTurnFixture(id: 'item-turn-2', stage: 'COMPONENTS'),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'ACCEPT_TURN', turnId: 'item-turn');
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.canonicalProject.components,
        isEmpty,
      );
    });

    test('finalize components sends one FINALIZE_COMPONENTS action', () async {
      String? capturedAction;
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
          capturedAction = action;
          return authoringSessionFixture(
            stage: 'STEPS_OVERVIEW',
            version: 5,
            canonicalProject: canonicalProjectFixture(
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
      expect(capturedAction, 'FINALIZE_COMPONENTS');
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.session.stage,
        'STEPS_OVERVIEW',
      );
    });
  });

  group('steps workflow matrix', () {
    test('suggest another plan creates a different turn identity', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'STEPS_OVERVIEW',
            turn: authoringTurnFixture(id: 'plan-a', stage: 'STEPS_OVERVIEW'),
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
          expect(action, 'SUGGEST_ANOTHER');
          return authoringSessionFixture(
            version: 2,
            stage: 'STEPS_OVERVIEW',
            turn: authoringTurnFixture(id: 'plan-b', stage: 'STEPS_OVERVIEW'),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'SUGGEST_ANOTHER', turnId: 'plan-a');
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.currentSuggestion?.turnId,
        'plan-b',
      );
    });

    test('step component inconsistency preserves canonical steps and manual state', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'STEPS_OVERVIEW',
            version: 6,
            canonicalProject: canonicalProjectFixture(
              steps: [
                const AiAuthoringProposalStep(
                  title: 'Existing step',
                  description: 'Keep me',
                ),
              ],
            ),
          ),
        ],
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
          message: 'Steps do not match components',
          code: 'AI_STEP_COMPONENT_INCONSISTENT',
        );
      };
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'FINALIZE_SECTION');
      final state = container.read(authoringWorkspaceControllerProvider);
      expect(state.actionError?.code, 'AI_STEP_COMPONENT_INCONSISTENT');
      expect(state.snapshot?.canonicalProject.steps.single.title, 'Existing step');
      expect(container.read(authoringSaveSuccessVisibleProvider), isFalse);
    });
  });

  group('final review revisit and finish matrix', () {
    for (final target in <String>[
      'TITLE',
      'SHORT_DESCRIPTION',
      'DIFFICULTY',
      'COMPONENTS',
      'STEPS_OVERVIEW',
    ]) {
      test('revisit $target sends REVISIT_STAGE and keeps unrelated canonical data', () async {
        String? capturedTarget;
        final repository = ConfigurableAuthoringRepository(
          startResponses: [
            authoringSessionFixture(
              stage: 'FINAL_REVIEW',
              version: 10,
              canonicalProject: canonicalProjectFixture(
                title: 'Canonical title',
                components: [
                  const AiAuthoringProposalComponent(
                    componentName: 'LED',
                    materialType: 'Electronic',
                    quantity: 1,
                    unit: 'piece',
                    componentRole: 'REQUIRED_MATERIAL',
                    isRequired: true,
                    canBeSubstituted: false,
                  ),
                ],
              ),
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
            capturedTarget = targetStage;
            return authoringSessionFixture(
              stage: target,
              version: 11,
              turn: authoringTurnFixture(id: 'revisit-$target', stage: target),
              canonicalProject: canonicalProjectFixture(
                title: 'Canonical title',
                components: [
                  const AiAuthoringProposalComponent(
                    componentName: 'LED',
                    materialType: 'Electronic',
                    quantity: 1,
                    unit: 'piece',
                    componentRole: 'REQUIRED_MATERIAL',
                    isRequired: true,
                    canBeSubstituted: false,
                  ),
                ],
              ),
            );
          },
        );
        final container = _container(repository);
        final controller = container.read(authoringWorkspaceControllerProvider.notifier);
        await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
        await controller.revisitStage(target);
        expect(capturedTarget, target);
        expect(
          container.read(authoringWorkspaceControllerProvider).snapshot?.canonicalProject.title,
          'Canonical title',
        );
      });
    }

    test('finish is idempotent and does not call start session on reload', () async {
      var finishCalls = 0;
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(stage: 'FINAL_REVIEW', version: 12, sessionId: 'sess-finish'),
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
          if (action == 'FINISH') {
            finishCalls += 1;
          }
          return authoringSessionFixture(
            stage: 'COMPLETE',
            status: 'COMPLETE',
            version: 13,
            turn: null,
          );
        },
        onLoad: (sessionId) async {
          return authoringSessionFixture(
            stage: 'COMPLETE',
            status: 'COMPLETE',
            version: 13,
            sessionId: sessionId,
            turn: null,
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'FINISH');
      await controller.reload();
      expect(finishCalls, 1);
      expect(repository.startSessionCalls, 1);
      expect(
        container.read(authoringWorkspaceControllerProvider).snapshot?.session.isComplete,
        isTrue,
      );
    });
  });

  group('legacy transition matrix', () {
    test('reload uses loadAuthoringSession not startAuthoringSession', () async {
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(sessionId: 'sess-reload', version: 2),
        ],
        onLoad: (sessionId) async {
          return authoringSessionFixture(
            sessionId: sessionId,
            version: 3,
            stage: 'COMPLETE',
            status: 'COMPLETE',
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.reload();
      expect(repository.startSessionCalls, 1);
      expect(repository.calls.where((call) => call.kind == 'load'), hasLength(1));
      expect(
        container.read(authoringWorkspaceControllerProvider).response?.session.stage,
        'COMPLETE',
      );
    });
  });

  group('feedback safety matrix', () {
    test('accept without explicit turn id uses current turn B not historical turn A', () async {
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
          return authoringSessionFixture(version: 3, stage: 'SHORT_DESCRIPTION');
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'ACCEPT_TURN');
      expect(capturedTurnId, 'turn-b');
    });
  });

  group('client sync failure matrix', () {
    test('canonical client sync failure shows reload error without repeating mutation', () async {
      var actionCalls = 0;
      final repository = ConfigurableAuthoringRepository(
        startResponses: [
          authoringSessionFixture(
            stage: 'TITLE',
            turn: authoringTurnFixture(id: 'turn-title'),
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
          actionCalls += 1;
          return authoringSessionFixture(
            version: 2,
            stage: 'SHORT_DESCRIPTION',
            canonicalProject: canonicalProjectFixture(
              title: 'Synced title',
              updatedAt: '2026-07-17T12:30:00.000Z',
            ),
          );
        },
      );
      final container = _container(repository);
      final controller = container.read(authoringWorkspaceControllerProvider.notifier);
      await controller.activateAndLoad(projectId: 'project-1', conversationId: 'conv-1');
      await controller.runAction(action: 'ACCEPT_TURN', turnId: 'turn-title');
      await Future<void>.delayed(Duration.zero);
      expect(container.read(authoringSaveSyncFailedProvider), isTrue);
      expect(container.read(authoringWorkspaceControllerProvider).actionError?.code,
          'CANONICAL_CLIENT_SYNC_FAILED');
      expect(actionCalls, 1);

      // The editor mirrors exactly the canonical snapshot that was published to
      // it (after masking), so build the acknowledgement from that snapshot.
      final published = container.read(authoringCanonicalProjectUpdateProvider);
      final mirror = ScopedAuthoringEditorMirror(
        projectId: 'project-1',
        canonicalUpdatedAt: published!.canonicalUpdatedAt,
        snapshot: published.snapshot,
      );
      controller.acknowledgeEditorSynchronized(mirror);
      expect(container.read(authoringSaveSyncFailedProvider), isFalse);
      expect(container.read(authoringSaveSuccessVisibleProvider), isTrue);
    });
  });
}
