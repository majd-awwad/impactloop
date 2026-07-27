import assert from 'node:assert/strict';
import type { AiMessage } from '@prisma/client';
import { describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';

import type {
  AiProjectAuthoringSessionBlock,
  AiProjectAuthoringTurnBlock,
} from './ai.content-blocks.js';
import {
  assertAuthoringProjectContext,
  buildAvailableActions,
  reconcileAuthoringSessionBlock,
  resolveCurrentTurn,
} from './ai-project-authoring-sequential.snapshot.js';

const TIMESTAMP = '2026-07-17T12:00:00.000Z';

const baseSession = (
  overrides: Partial<AiProjectAuthoringSessionBlock> = {},
): AiProjectAuthoringSessionBlock => ({
  type: 'project_authoring_session',
  sessionId: 'sess-a',
  projectId: 'proj-a',
  baseUpdatedAt: TIMESTAMP,
  stage: 'COMPONENTS',
  flowStatus: 'WAITING_FOR_USER',
  acceptedStages: ['TITLE', 'ESTIMATED_DURATION', 'COMPONENTS'],
  currentTurnId: 'turn-components-a',
  policyVersion: 'project-authoring-sequential-v1',
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP,
  ...overrides,
});

const componentTurn = (
  overrides: Partial<AiProjectAuthoringTurnBlock> = {},
): AiProjectAuthoringTurnBlock => ({
  type: 'project_authoring_turn',
  turnId: 'turn-components-a',
  sessionId: 'sess-a',
  stage: 'COMPONENTS',
  projectId: 'proj-a',
  baseUpdatedAt: TIMESTAMP,
  status: 'PROPOSED',
  proposal: {
    components: [
      {
        componentName: 'Soil moisture sensor',
        materialType: 'Sensor',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
      },
    ],
  },
  explanation: 'Soil moisture list',
  createdAt: TIMESTAMP,
  ...overrides,
});

const assistantMessage = (blocks: unknown[]): AiMessage =>
  ({
    id: 'msg-1',
    conversationId: 'conv-a',
    role: 'ASSISTANT',
    status: 'COMPLETED',
    contentText: null,
    contentBlocks: blocks,
    createdAt: new Date(TIMESTAMP),
    updatedAt: new Date(TIMESTAMP),
  }) as AiMessage;

const projectRecord = (projectId: string) =>
  ({
    id: projectId,
    updatedAt: new Date(TIMESTAMP),
    title: 'Desk light',
    shortDescription: 'Summary',
    description: 'Description',
    difficulty: 'BEGINNER',
    estimatedMinutes: 120,
    requiredComponents: [
      {
        id: 'comp-1',
        componentName: 'LDR',
        materialType: 'Sensor',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
      },
    ],
    steps: [],
  }) as never;

describe('authoring sequential snapshot isolation', () => {
  test('resolveCurrentTurn rejects foreign project turns', () => {
    const session = baseSession({ projectId: 'proj-b', currentTurnId: 'turn-components-a' });
    const messages = [assistantMessage([componentTurn({ projectId: 'proj-a' })])];

    assert.equal(resolveCurrentTurn(messages, session), null);
  });

  test('resolveCurrentTurn rejects superseded accepted turns', () => {
    const session = baseSession({ currentTurnId: 'turn-components-a' });
    const messages = [
      assistantMessage([componentTurn({ status: 'ACCEPTED' })]),
    ];

    assert.equal(resolveCurrentTurn(messages, session), null);
  });

  test('assertAuthoringProjectContext rejects session/project mismatch', () => {
    assert.throws(
      () =>
        assertAuthoringProjectContext({
          project: projectRecord('proj-b'),
          session: baseSession({ projectId: 'proj-a' }),
        }),
      (error: unknown) =>
        error instanceof AppError &&
        error.code === 'AI_AUTHORING_PROJECT_CONTEXT_MISMATCH',
    );
  });

  test('reconcileAuthoringSessionBlock advances stuck COMPONENTS session', () => {
    const session = baseSession({
      stage: 'COMPONENTS',
      flowStatus: 'WAITING_FOR_ASSISTANT',
      currentTurnId: 'turn-components-a',
    });
    const messages = [
      assistantMessage([componentTurn({ status: 'ACCEPTED', turnId: 'turn-components-a' })]),
    ];

    const reconciled = reconcileAuthoringSessionBlock(
      session,
      projectRecord('proj-a'),
      messages,
    );

    assert.equal(reconciled.stage, 'STEPS_OVERVIEW');
    assert.equal(reconciled.flowStatus, 'GENERATION_FAILED');
    assert.equal(reconciled.currentTurnId, null);
    assert.ok(reconciled.acceptedStages.includes('COMPONENTS'));
  });

  test('buildAvailableActions exposes step regeneration after generation failure', () => {
    const actions = buildAvailableActions({
      session: baseSession({
        stage: 'STEPS_OVERVIEW',
        flowStatus: 'GENERATION_FAILED',
        currentTurnId: null,
      }),
      currentTurn: null,
    });

    assert.deepEqual(actions, ['REGENERATE_STALE']);
  });

  test('buildAvailableActions exposes CHOOSE_MODE at STEPS_OVERVIEW in FULL_PLAN mode', () => {
    const actions = buildAvailableActions({
      session: baseSession({
        stage: 'STEPS_OVERVIEW',
        flowStatus: 'WAITING_FOR_USER',
        currentTurnId: 'turn-steps',
        stepReviewMode: 'FULL_PLAN',
      }),
      currentTurn: {
        type: 'project_authoring_turn',
        turnId: 'turn-steps',
        sessionId: 'sess-a',
        stage: 'STEPS_OVERVIEW',
        projectId: 'proj-a',
        baseUpdatedAt: TIMESTAMP,
        status: 'PROPOSED',
        proposal: {
          steps: [
            { title: 'Step 1', description: 'Prepare materials' },
            { title: 'Step 2', description: 'Assemble' },
            { title: 'Step 3', description: 'Finish' },
          ],
        },
        explanation: 'Step plan',
        createdAt: TIMESTAMP,
      },
    });

    assert.ok(actions.includes('CHOOSE_MODE'));
    assert.ok(actions.includes('SAVE_MANUAL'));
  });

  test('buildAvailableActions exposes CHOOSE_MODE at COMPONENTS in FULL_LIST mode', () => {
    const actions = buildAvailableActions({
      session: baseSession({
        stage: 'COMPONENTS',
        flowStatus: 'WAITING_FOR_USER',
        currentTurnId: 'turn-components',
        componentReviewMode: 'FULL_LIST',
      }),
      currentTurn: componentTurn(),
    });

    assert.ok(actions.includes('CHOOSE_MODE'));
    assert.ok(actions.includes('SAVE_MANUAL'));
  });

  test('buildAvailableActions exposes step review item controls', () => {
    const actions = buildAvailableActions({
      session: baseSession({
        stage: 'STEP_REVIEW',
        flowStatus: 'WAITING_FOR_USER',
        currentTurnId: 'turn-step',
        stepReviewMode: 'STEP_BY_STEP',
      }),
      currentTurn: {
        type: 'project_authoring_turn',
        turnId: 'turn-step',
        sessionId: 'sess-a',
        stage: 'STEP_REVIEW',
        projectId: 'proj-a',
        baseUpdatedAt: TIMESTAMP,
        status: 'PROPOSED',
        proposal: {
          index: 0,
          total: 3,
          title: 'Prepare materials',
          description: 'Gather the listed items.',
        },
        explanation: 'Step 1 of 3',
        createdAt: TIMESTAMP,
      },
    });

    assert.ok(actions.includes('EXPLAIN_STEP'));
    assert.ok(actions.includes('BACK_ITEM'));
    assert.ok(actions.includes('REMOVE_ITEM'));
    assert.ok(actions.includes('ADD_ITEM'));
  });

  test('buildAvailableActions does not expose actions while waiting for assistant', () => {
    const actions = buildAvailableActions({
      session: baseSession({
        stage: 'STEPS_OVERVIEW',
        flowStatus: 'WAITING_FOR_ASSISTANT',
        currentTurnId: null,
      }),
      currentTurn: null,
    });

    assert.deepEqual(actions, []);
  });
});
