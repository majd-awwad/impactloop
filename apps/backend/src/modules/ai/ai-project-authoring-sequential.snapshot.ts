import type { AiMessage } from '@prisma/client';
import { z } from 'zod';

import { AppError } from '../../utils/app-error.js';
import type { learningProjectsRepository } from '../learning-projects/learning-projects.repository.js';

import {
  aiProjectAuthoringSessionBlockSchema,
  aiProjectAuthoringTurnBlockSchema,
  type AiContentBlock,
  type AiProjectAuthoringSessionBlock,
  type AiProjectAuthoringTurnBlock,
} from './ai.content-blocks.js';
import { parseStoredContentBlocks } from './ai-context-builder.js';
import type { SequentialStage } from './ai-project-authoring-sequential.policy.js';

export const AUTHORING_SNAPSHOT_POLICY_VERSION = 'sequential-snapshot-v1';

export const SEQUENTIAL_PROGRESS_STAGES = [
  'TITLE',
  'SHORT_DESCRIPTION',
  'FULL_DESCRIPTION',
  'DIFFICULTY',
  'ESTIMATED_DURATION',
  'COMPONENTS',
  'STEPS',
] as const;

export type SequentialProgressStage = (typeof SEQUENTIAL_PROGRESS_STAGES)[number];

export const authoringCanonicalProjectSchema = z.object({
  id: z.string(),
  updatedAt: z.string(),
  title: z.string(),
  shortDescription: z.string(),
  description: z.string().nullable(),
  difficulty: z.string(),
  estimatedMinutes: z.number().int().positive().nullable(),
  components: z.array(
    z.object({
      id: z.string().optional(),
      componentName: z.string(),
      materialType: z.string().nullable().optional(),
      quantity: z.union([z.string(), z.number()]),
      unit: z.string(),
      componentRole: z.string(),
      isRequired: z.boolean(),
      canBeSubstituted: z.boolean(),
      searchKeywords: z.array(z.string()).optional(),
      notes: z.string().nullable().optional(),
    }),
  ),
  steps: z.array(
    z.object({
      id: z.string().optional(),
      title: z.string(),
      description: z.string(),
    }),
  ),
});

export type AuthoringCanonicalProject = z.infer<typeof authoringCanonicalProjectSchema>;

export const authoringSnapshotTurnSchema = z.object({
  turnId: z.string(),
  sessionId: z.string(),
  stage: z.string(),
  status: z.enum(['PROPOSED', 'ACCEPTED', 'SUPERSEDED', 'REJECTED']),
  proposal: z.record(z.string(), z.unknown()),
  explanation: z.string(),
  baseUpdatedAt: z.string(),
});

export const authoringSnapshotSessionSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  stage: z.string(),
  status: z.enum([
    'WAITING_FOR_USER',
    'PROCESSING',
    'STALE',
    'COMPLETE',
    'GENERATION_FAILED',
  ]),
  completedStages: z.array(z.string()),
  currentTurnId: z.string().nullable(),
  baseUpdatedAt: z.string(),
  isStale: z.boolean(),
  componentReviewMode: z.string().nullable().optional(),
  stepReviewMode: z.string().nullable().optional(),
  currentComponentIndex: z.number().int().nullable().optional(),
  currentStepIndex: z.number().int().nullable().optional(),
  awaitingComponentsFinalSave: z.boolean().optional(),
  awaitingStepsFinalSave: z.boolean().optional(),
  workingComponents: z.array(z.record(z.string(), z.unknown())).optional(),
  workingSteps: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const authoringSnapshotSuggestionSchema = z.object({
  turnId: z.string(),
  stage: z.string(),
  value: z.union([z.string(), z.number()]).optional(),
  components: z.array(z.record(z.string(), z.unknown())).optional(),
  component: z.record(z.string(), z.unknown()).optional(),
  componentIndex: z.number().int().nonnegative().optional(),
  componentTotal: z.number().int().positive().optional(),
  steps: z.array(z.record(z.string(), z.unknown())).optional(),
  step: z.record(z.string(), z.unknown()).optional(),
  stepIndex: z.number().int().nonnegative().optional(),
  stepTotal: z.number().int().positive().optional(),
  explanation: z.string(),
  status: z.enum(['PROPOSED', 'ACCEPTED', 'SUPERSEDED', 'REJECTED']),
});

export const authoringSnapshotSchema = z.object({
  session: authoringSnapshotSessionSchema,
  currentTurn: authoringSnapshotTurnSchema.nullable(),
  currentSuggestion: authoringSnapshotSuggestionSchema.nullable(),
  canonicalProject: authoringCanonicalProjectSchema,
  availableActions: z.array(z.string()),
  progress: z.object({
    completed: z.number().int().nonnegative(),
    total: z.number().int().positive(),
  }),
});

export type AuthoringSnapshot = z.infer<typeof authoringSnapshotSchema>;

type ProjectRecord = NonNullable<
  Awaited<ReturnType<typeof learningProjectsRepository.findMyLearningProjectSubmissionById>>
>;

const decimalToSerializable = (value: { toNumber(): number } | number): number =>
  typeof value === 'number' ? value : value.toNumber();

const jsonStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string');
};

const isSessionBlock = (
  block: AiContentBlock,
): block is AiProjectAuthoringSessionBlock => block.type === 'project_authoring_session';

const isTurnBlock = (block: AiContentBlock): block is AiProjectAuthoringTurnBlock =>
  block.type === 'project_authoring_turn';

export const mapAuthoringCanonicalProject = (
  project: ProjectRecord,
): AuthoringCanonicalProject =>
  authoringCanonicalProjectSchema.parse({
    id: project.id,
    updatedAt: project.updatedAt.toISOString(),
    title: project.title,
    shortDescription: project.shortDescription,
    description: project.description,
    difficulty: project.difficulty,
    estimatedMinutes: project.estimatedDurationMinutes,
    components: project.requiredComponents.map((component) => ({
      id: component.id,
      componentName: component.componentName,
      materialType: component.materialType,
      quantity: decimalToSerializable(component.quantity),
      unit: component.unit,
      componentRole: component.componentRole,
      isRequired: component.isRequired,
      canBeSubstituted: component.canBeSubstituted,
      searchKeywords: jsonStringList(component.searchKeywords),
      notes: component.notes,
    })),
    steps: project.steps.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
    })),
  });

const mapProgressStage = (stage: SequentialStage): SequentialProgressStage | null => {
  switch (stage) {
    case 'TITLE':
    case 'SHORT_DESCRIPTION':
    case 'FULL_DESCRIPTION':
    case 'DIFFICULTY':
    case 'ESTIMATED_DURATION':
    case 'COMPONENTS':
      return stage;
    case 'STEPS_OVERVIEW':
    case 'STEP_REVIEW':
      return 'STEPS';
    default:
      return null;
  }
};

const completedProgressStages = (
  acceptedStages: SequentialStage[],
): SequentialProgressStage[] => {
  const mapped = acceptedStages
    .map((stage) => mapProgressStage(stage))
    .filter((stage): stage is SequentialProgressStage => stage != null);
  return Array.from(new Set(mapped));
};

export const findLatestAuthoringSessionBlock = (
  messages: AiMessage[],
): AiProjectAuthoringSessionBlock | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (const block of blocks) {
      if (isSessionBlock(block)) {
        const parsed = aiProjectAuthoringSessionBlockSchema.safeParse(block);
        if (parsed.success) {
          return parsed.data;
        }
      }
    }
  }
  return null;
};

export const findTurnBlockById = (
  messages: AiMessage[],
  turnId: string,
): AiProjectAuthoringTurnBlock | null => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'ASSISTANT' || !message.contentBlocks) {
      continue;
    }
    const blocks = parseStoredContentBlocks(message.contentBlocks);
    for (const block of blocks) {
      if (isTurnBlock(block) && block.turnId === turnId) {
        const parsed = aiProjectAuthoringTurnBlockSchema.safeParse(block);
        if (parsed.success) {
          return parsed.data;
        }
      }
    }
  }
  return null;
};

export const resolveCurrentTurn = (
  messages: AiMessage[],
  session: AiProjectAuthoringSessionBlock,
): AiProjectAuthoringTurnBlock | null => {
  if (!session.currentTurnId) {
    return null;
  }

  const current = findTurnBlockById(messages, session.currentTurnId);
  if (!current) {
    return null;
  }
  if (current.sessionId !== session.sessionId) {
    return null;
  }
  if (current.projectId !== session.projectId) {
    return null;
  }
  return current.status === 'PROPOSED' ? current : null;
};

export const assertAuthoringProjectContext = (input: {
  project: ProjectRecord;
  session: AiProjectAuthoringSessionBlock;
  turn?: AiProjectAuthoringTurnBlock | null;
}) => {
  if (input.session.projectId !== input.project.id) {
    throw new AppError(
      'This authoring session does not belong to this project.',
      409,
      'AI_AUTHORING_PROJECT_CONTEXT_MISMATCH',
    );
  }
  if (input.turn && input.turn.projectId !== input.project.id) {
    throw new AppError(
      'This authoring session does not belong to this project.',
      409,
      'AI_AUTHORING_PROJECT_CONTEXT_MISMATCH',
    );
  }
};

export const reconcileAuthoringSessionBlock = (
  session: AiProjectAuthoringSessionBlock,
  project: ProjectRecord,
  messages: AiMessage[],
): AiProjectAuthoringSessionBlock => {
  const componentCount = project.requiredComponents?.length ?? 0;
  const componentsAccepted =
    session.acceptedStages.includes('COMPONENTS') ||
    (session.lastAcceptedTurnId
      ? findTurnBlockById(messages, session.lastAcceptedTurnId)?.stage === 'COMPONENTS'
      : false);

  if (
    session.stage === 'COMPONENTS' &&
    componentCount > 0 &&
    componentsAccepted
  ) {
    const acceptedStages = session.acceptedStages.includes('COMPONENTS')
      ? session.acceptedStages
      : [...session.acceptedStages, 'COMPONENTS'];
    return {
      ...session,
      stage: 'STEPS_OVERVIEW',
      acceptedStages,
      awaitingComponentsFinalSave: false,
      currentTurnId:
        session.flowStatus === 'WAITING_FOR_USER' ? session.currentTurnId : null,
      flowStatus:
        session.flowStatus === 'WAITING_FOR_USER'
          ? 'WAITING_FOR_USER'
          : 'GENERATION_FAILED',
    };
  }

  return session;
};

export const buildAvailableActions = (input: {
  session: AiProjectAuthoringSessionBlock;
  currentTurn: AiProjectAuthoringTurnBlock | null;
  hasLegacyBlocks?: boolean;
}): string[] => {
  const { session, currentTurn } = input;

  if (input.hasLegacyBlocks && session.stage === 'OVERVIEW') {
    return ['CONTINUE_GUIDED'];
  }

  if (session.stage === 'OVERVIEW') {
    return ['START'];
  }

  if (session.flowStatus === 'STALE') {
    return ['REGENERATE_STALE'];
  }

  if (
    session.flowStatus === 'GENERATION_FAILED' &&
    session.stage === 'STEPS_OVERVIEW'
  ) {
    return ['REGENERATE_STALE'];
  }

  if (session.flowStatus === 'WAITING_FOR_ASSISTANT') {
    return [];
  }

  if (session.stage === 'COMPLETE' || session.flowStatus === 'COMPLETE') {
    return ['FINISH'];
  }

  if (session.stage === 'FINAL_REVIEW') {
    return ['FINISH'];
  }

  if (!currentTurn || currentTurn.status !== 'PROPOSED') {
    return [];
  }

  const foundationStages = new Set<SequentialStage>(['TITLE', 'ESTIMATED_DURATION']);
  const actions = foundationStages.has(session.stage)
    ? ['ACCEPT_TURN', 'SUGGEST_ANOTHER', 'SAVE_MANUAL']
    : session.stage === 'COMPONENTS'
      ? ['ACCEPT_TURN', 'SUGGEST_ANOTHER', 'SAVE_MANUAL']
      : session.stage === 'STEPS_OVERVIEW' || session.stage === 'STEP_REVIEW'
        ? ['ACCEPT_TURN', 'SUGGEST_ANOTHER', 'SAVE_MANUAL']
        : ['ACCEPT_TURN', 'SUGGEST_ANOTHER', 'DISCUSS', 'SAVE_MANUAL'];

  if (
    session.stage === 'STEPS_OVERVIEW' &&
    session.stepReviewMode !== 'STEP_BY_STEP' &&
    !session.awaitingStepsFinalSave
  ) {
    actions.push('CHOOSE_MODE');
  }

  if (
    session.stage === 'COMPONENTS' &&
    session.componentReviewMode !== 'ONE_BY_ONE' &&
    !session.awaitingComponentsFinalSave
  ) {
    actions.push('CHOOSE_MODE');
  }

  if (
    session.stage === 'COMPONENTS' &&
    session.componentReviewMode === 'ONE_BY_ONE' &&
    !session.awaitingComponentsFinalSave
  ) {
    actions.push('REMOVE_ITEM', 'BACK_ITEM', 'ADD_ITEM');
  }

  if (session.stage === 'STEP_REVIEW' && session.stepReviewMode === 'STEP_BY_STEP') {
    actions.push('EXPLAIN_STEP', 'BACK_ITEM', 'REMOVE_ITEM', 'ADD_ITEM');
  }

  if (session.awaitingComponentsFinalSave) {
    return ['FINALIZE_SECTION', 'SUGGEST_ANOTHER'];
  }

  if (session.awaitingStepsFinalSave && session.stepReviewMode === 'STEP_BY_STEP') {
    return ['FINALIZE_SECTION', 'SUGGEST_ANOTHER'];
  }

  return actions;
};

export const buildAuthoringSnapshot = (input: {
  project: ProjectRecord;
  messages: AiMessage[];
  session?: AiProjectAuthoringSessionBlock | null;
  hasLegacyBlocks?: boolean;
}): AuthoringSnapshot | null => {
  const rawSession = input.session ?? findLatestAuthoringSessionBlock(input.messages);
  if (!rawSession) {
    return null;
  }

  assertAuthoringProjectContext({
    project: input.project,
    session: rawSession,
  });

  const session = reconcileAuthoringSessionBlock(
    rawSession,
    input.project,
    input.messages,
  );

  const currentTurn = resolveCurrentTurn(input.messages, session);
  if (currentTurn) {
    assertAuthoringProjectContext({
      project: input.project,
      session,
      turn: currentTurn,
    });
  }
  const completedStages = completedProgressStages(session.acceptedStages);
  const status =
    session.flowStatus === 'COMPLETE' || session.stage === 'COMPLETE'
      ? 'COMPLETE'
      : session.flowStatus === 'GENERATION_FAILED'
        ? 'GENERATION_FAILED'
        : session.flowStatus === 'STALE'
          ? 'STALE'
          : session.flowStatus === 'PROCESSING' ||
              session.flowStatus === 'WAITING_FOR_ASSISTANT' ||
              session.flowStatus === 'SAVING'
            ? 'PROCESSING'
            : 'WAITING_FOR_USER';

  const snapshot = authoringSnapshotSchema.parse({
    session: {
      sessionId: session.sessionId,
      projectId: session.projectId,
      stage: session.stage,
      status,
      completedStages,
      currentTurnId: session.currentTurnId,
      baseUpdatedAt: session.baseUpdatedAt,
      isStale: session.flowStatus === 'STALE',
      componentReviewMode: session.componentReviewMode ?? null,
      stepReviewMode: session.stepReviewMode ?? null,
      currentComponentIndex: session.currentComponentIndex ?? null,
      currentStepIndex: session.currentStepIndex ?? null,
      awaitingComponentsFinalSave: session.awaitingComponentsFinalSave ?? false,
      awaitingStepsFinalSave: session.awaitingStepsFinalSave ?? false,
      workingComponents: session.workingComponents,
      workingSteps: session.workingSteps,
    },
    currentTurn: currentTurn
      ? {
          turnId: currentTurn.turnId,
          sessionId: currentTurn.sessionId,
          stage: currentTurn.stage,
          status: currentTurn.status,
          proposal: currentTurn.proposal as Record<string, unknown>,
          explanation: currentTurn.explanation,
          baseUpdatedAt: currentTurn.baseUpdatedAt,
        }
      : null,
    currentSuggestion: currentTurn
      ? {
          turnId: currentTurn.turnId,
          stage: currentTurn.stage,
          value:
            'value' in currentTurn.proposal
              ? (currentTurn.proposal.value as string | number)
              : undefined,
          components:
            'components' in currentTurn.proposal &&
            Array.isArray(currentTurn.proposal.components)
              ? (currentTurn.proposal.components as AuthoringCanonicalProject['components'])
              : undefined,
          component:
            'component' in currentTurn.proposal
              ? (currentTurn.proposal.component as Record<string, unknown>)
              : undefined,
          componentIndex:
            'index' in currentTurn.proposal
              ? Number(currentTurn.proposal.index)
              : undefined,
          componentTotal:
            'total' in currentTurn.proposal
              ? Number(currentTurn.proposal.total)
              : undefined,
          steps:
            'steps' in currentTurn.proposal &&
            Array.isArray(currentTurn.proposal.steps)
              ? (currentTurn.proposal.steps as AuthoringCanonicalProject['steps'])
              : undefined,
          step:
            'title' in currentTurn.proposal && 'index' in currentTurn.proposal
              ? {
                  index: currentTurn.proposal.index,
                  title: currentTurn.proposal.title,
                  description: currentTurn.proposal.description,
                }
              : undefined,
          stepIndex:
            'index' in currentTurn.proposal
              ? Number(currentTurn.proposal.index)
              : undefined,
          stepTotal:
            'total' in currentTurn.proposal
              ? Number(currentTurn.proposal.total)
              : undefined,
          explanation: currentTurn.explanation,
          status: currentTurn.status,
        }
      : null,
    canonicalProject: mapAuthoringCanonicalProject(input.project),
    availableActions: buildAvailableActions({
      session,
      currentTurn,
      hasLegacyBlocks: input.hasLegacyBlocks,
    }),
    progress: {
      completed: completedStages.length,
      total: SEQUENTIAL_PROGRESS_STAGES.length,
    },
  });

  const requiresProposal =
    session.stage !== 'OVERVIEW' &&
    session.stage !== 'FINAL_REVIEW' &&
    session.stage !== 'COMPLETE' &&
    session.flowStatus === 'WAITING_FOR_USER' &&
    !(session.stage === 'COMPONENTS' && session.awaitingComponentsFinalSave) &&
    !(session.stage === 'STEPS_OVERVIEW' && session.awaitingStepsFinalSave);

  if (requiresProposal && (!currentTurn || currentTurn.status !== 'PROPOSED')) {
    throw new Error(
      `Authoring snapshot invariant violated: stage ${session.stage} requires an active proposed turn.`,
    );
  }

  if (
    currentTurn &&
    session.flowStatus !== 'STALE' &&
    session.stage !== 'OVERVIEW' &&
    session.stage !== 'FINAL_REVIEW' &&
    session.stage !== 'COMPLETE'
  ) {
    const projectBasis = new Date(input.project.updatedAt).toISOString();
    if (session.baseUpdatedAt !== projectBasis) {
      throw new Error(
        `Authoring snapshot version invariant violated: session.baseUpdatedAt (${session.baseUpdatedAt}) !== project.updatedAt (${projectBasis}).`,
      );
    }
    if (currentTurn.baseUpdatedAt !== projectBasis) {
      throw new Error(
        `Authoring snapshot version invariant violated: turn.baseUpdatedAt (${currentTurn.baseUpdatedAt}) !== project.updatedAt (${projectBasis}).`,
      );
    }
  }

  return snapshot;
};
