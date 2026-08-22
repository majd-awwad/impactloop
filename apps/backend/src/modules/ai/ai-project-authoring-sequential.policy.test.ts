import assert from 'node:assert/strict';
import type { AiMessage } from '../../generated/prisma/client.js';
import { describe, test } from 'node:test';

import { AppError } from '../../utils/app-error.js';

import type {
  AiProjectAuthoringSessionBlock,
  AiProjectAuthoringTurnBlock,
} from './ai.content-blocks.js';
import {
  catalogAllowsProseTerm,
  expandComponentAliases,
  normalizeComponentIdentity,
  resolveComponentReference,
  validateComponentStepConsistency,
} from './ai-project-authoring-sequential.policy.js';
import {
  assertAuthoringProjectContext,
  buildAvailableActions,
  reconcileAuthoringSessionBlock,
  resolveCurrentTurn,
} from './ai-project-authoring-sequential.snapshot.js';

const ldrCatalog = [
  {
    id: 'comp-arduino',
    componentName: 'Arduino Uno',
    materialType: 'Board',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: [],
    notes: null,
  },
  {
    id: 'comp-ldr',
    componentName: 'LDR photoresistor',
    materialType: 'Sensor',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: [],
    notes: null,
  },
  {
    id: 'comp-led',
    componentName: 'White LED',
    materialType: 'Output',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: [],
    notes: null,
  },
  {
    id: 'comp-220',
    componentName: '220 ohm resistor',
    materialType: 'Electronics',
    quantity: 1,
    unit: 'piece',
    componentRole: 'REQUIRED_MATERIAL' as const,
    isRequired: true,
    canBeSubstituted: false,
    searchKeywords: [],
    notes: null,
  },
];

describe('component-step consistency policy', () => {
  test('structured refs accept alias prose without requiring every component name', () => {
    const result = validateComponentStepConsistency({
      components: ldrCatalog,
      steps: [
        {
          title: 'Build the LDR voltage-divider circuit',
          description: 'Wire the photoresistor with the divider resistor on the breadboard.',
          componentRefs: ['comp-ldr', 'comp-arduino'],
        },
        {
          title: 'Connect the LED',
          description: 'Connect the LED through the 220Ω resistor.',
          componentRefs: ['comp-led', 'comp-220'],
        },
        {
          title: 'Upload and test',
          description: 'Upload the sketch to the Arduino and test the response.',
          componentRefs: ['comp-arduino'],
        },
      ],
    });

    assert.equal(result.ok, true);
  });

  test('foreign component IDs are rejected', () => {
    const result = validateComponentStepConsistency({
      components: ldrCatalog,
      steps: [
        {
          title: 'Wire sensor',
          description: 'Connect the sensor.',
          componentRefs: ['comp-soil'],
        },
        {
          title: 'Test',
          description: 'Test the circuit.',
        },
        {
          title: 'Finish',
          description: 'Finish the build.',
        },
      ],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.issues.join(' '), /unknown component id/i);
      assert.deepEqual(
        result.consistencyIssues.map((issue) => ({
          code: issue.code,
          stepIndex: issue.stepIndex,
          componentRef: issue.componentRef,
          resolution: issue.resolution,
        })),
        [
          {
            code: 'UNKNOWN_COMPONENT_REFERENCE',
            stepIndex: 0,
            componentRef: 'comp-soil',
            resolution: 'UNKNOWN',
          },
        ],
      );
    }
  });

  test('distinct Arabic canonical names retain identity and valid IDs pass', () => {
    const arabicCatalog = [
      { ...ldrCatalog[0]!, id: 'comp-sensor', componentName: 'حساس رطوبة التربة' },
      { ...ldrCatalog[1]!, id: 'comp-board', componentName: 'لوحة أردوينو أونو' },
      { ...ldrCatalog[2]!, id: 'comp-pump', componentName: 'مضخة ري صغيرة' },
    ];
    assert.deepEqual(
      arabicCatalog.map((component) => normalizeComponentIdentity(component.componentName)),
      ['حساس رطوبة التربة', 'لوحة أردوينو أونو', 'مضخة ري صغيرة'],
    );

    const result = validateComponentStepConsistency({
      components: arabicCatalog,
      steps: [
        {
          title: 'توصيل الحساس',
          description: 'وصّل الحساس باللوحة ثم تحقق من ظهور قراءة مستقرة قبل المتابعة.',
          componentRefs: ['comp-sensor', 'comp-board'],
        },
      ],
    });
    assert.equal(result.ok, true);
  });

  test('Arabic display-name normalization resolves to the stable canonical component', () => {
    const arabicCatalog = [
      { ...ldrCatalog[0]!, id: 'comp-board', componentName: 'لوحة أردوينو أونو' },
    ];
    const resolution = resolveComponentReference('لوحة أردوينو أونو', arabicCatalog);
    assert.equal(resolution.resolution, 'NORMALIZED_NAME');
    assert.equal(resolution.component?.id, 'comp-board');
  });

  test('forbidden soil-moisture prose is rejected for LDR catalog', () => {
    const result = validateComponentStepConsistency({
      components: ldrCatalog,
      steps: [
        {
          title: 'Prepare components',
          description: 'Collect the Arduino and soil moisture sensor.',
        },
        {
          title: 'Wire sensor',
          description: 'Connect the sensor.',
        },
        {
          title: 'Test',
          description: 'Test the circuit.',
        },
      ],
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.issues.join(' '), /soil moisture sensor/i);
    }
  });

  test('alias expansion treats LDR and photoresistor as related', () => {
    const aliases = expandComponentAliases('LDR photoresistor');
    assert.ok(aliases.some((alias) => alias.includes('photoresistor')));
    assert.ok(catalogAllowsProseTerm('photoresistor', ldrCatalog));
    assert.ok(catalogAllowsProseTerm('white led', ldrCatalog));
    assert.ok(catalogAllowsProseTerm('220 ohm', ldrCatalog));
  });
});

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
  }) as unknown as AiMessage;

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
