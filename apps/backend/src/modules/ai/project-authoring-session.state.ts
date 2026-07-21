import type { AiMessage, ProjectAuthoringSession, ProjectAuthoringTurn } from '../../generated/prisma/client.js';

import type { AiContentBlock } from './ai.content-blocks.js';
import { z } from 'zod';

import type * as LearningProjectsRepository from '../learning-projects/learning-projects.repository.js';

import { buildAvailableActions } from './ai-project-authoring-sequential.snapshot.js';
import {
  mapAuthoringCanonicalProject,
  type AuthoringSnapshot,
} from './ai-project-authoring-sequential.snapshot.js';
import type { AiProjectAuthoringSessionBlock, AiProjectAuthoringTurnBlock } from './ai.content-blocks.js';

type ProjectRecord = NonNullable<
  Awaited<ReturnType<typeof LearningProjectsRepository.findMyLearningProjectSubmissionById>>
>;

export const authoringSessionStateSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  learningProjectId: z.string(),
  stage: z.string(),
  status: z.string(),
  version: z.number().int(),
  completedStages: z.array(z.string()),
  baseProjectUpdatedAt: z.string(),
  componentReviewState: z.record(z.string(), z.unknown()).nullable().optional(),
  stepReviewState: z.record(z.string(), z.unknown()).nullable().optional(),
  generationErrorCode: z.string().nullable().optional(),
  currentTurnId: z.string().nullable().optional(),
  confirmedRequirements: z
    .object({
      requestedStepCount: z.number().int().nullable().optional(),
      requestedComponentCount: z.number().int().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export const authoringTurnStateSchema = z.object({
  id: z.string(),
  stage: z.string(),
  kind: z.string(),
  status: z.string(),
  payload: z.record(z.string(), z.unknown()),
  explanation: z.string().nullable().optional(),
  baseProjectUpdatedAt: z.string(),
});

export const authoringSessionResponseSchema = z.object({
  session: authoringSessionStateSchema,
  currentTurn: authoringTurnStateSchema.nullable(),
  canonicalProject: z.record(z.string(), z.unknown()),
  availableActions: z.array(z.string()),
  conversationMessages: z.array(z.record(z.string(), z.unknown())).optional(),
});

export type AuthoringSessionResponse = z.infer<typeof authoringSessionResponseSchema>;

export type SequentialComponent = {
  componentName: string;
  materialType: string;
  quantity: number;
  unit: string;
  componentRole: 'REQUIRED_MATERIAL' | 'TOOL' | 'CONSUMABLE';
  isRequired: boolean;
  canBeSubstituted: boolean;
  searchKeywords?: string[];
  notes?: string | null;
};

export type SequentialStep = {
  title: string;
  description: string;
};

export type ComponentWorkingState = {
  mode: 'FULL_LIST' | 'ONE_BY_ONE';
  sourceTurnId: string | null;
  workingComponents: SequentialComponent[];
  currentIndex: number;
  acceptedIndexes: number[];
  awaitingFinalSave: boolean;
};

export type StepWorkingState = {
  mode: 'FULL_PLAN' | 'STEP_BY_STEP';
  sourceTurnId: string | null;
  workingSteps: SequentialStep[];
  currentIndex: number;
  acceptedIndexes: number[];
  awaitingFinalSave: boolean;
};

export type SessionWorkingMetadata = {
  returnStage?: 'FINAL_REVIEW';
};

export type AuthoringConfirmedRequirements = {
  requestedStepCount?: number | null;
  requestedComponentCount?: number | null;
};

export const readConfirmedRequirements = (session: {
  componentWorkingState?: unknown;
}): AuthoringConfirmedRequirements => {
  if (!session.componentWorkingState || typeof session.componentWorkingState !== 'object') {
    return {};
  }
  const record = session.componentWorkingState as Record<string, unknown>;
  const requirements = record.confirmedRequirements;
  if (!requirements || typeof requirements !== 'object') {
    return {};
  }
  const parsed = requirements as Record<string, unknown>;
  return {
    requestedStepCount:
      typeof parsed.requestedStepCount === 'number' ? parsed.requestedStepCount : null,
    requestedComponentCount:
      typeof parsed.requestedComponentCount === 'number'
        ? parsed.requestedComponentCount
        : null,
  };
};

export const mergeConfirmedRequirementsIntoComponentState = (
  componentWorkingState: unknown,
  patch: Partial<AuthoringConfirmedRequirements>,
): Record<string, unknown> => {
  const base =
    componentWorkingState && typeof componentWorkingState === 'object'
      ? { ...(componentWorkingState as Record<string, unknown>) }
      : {};
  const current = readConfirmedRequirements({ componentWorkingState: base });
  base.confirmedRequirements = {
    requestedStepCount:
      patch.requestedStepCount !== undefined
        ? patch.requestedStepCount
        : current.requestedStepCount ?? null,
    requestedComponentCount:
      patch.requestedComponentCount !== undefined
        ? patch.requestedComponentCount
        : current.requestedComponentCount ?? null,
  };
  return base;
};

export const emptyComponentWorkingState = (
  components: SequentialComponent[],
  mode: ComponentWorkingState['mode'],
  sourceTurnId: string | null = null,
): ComponentWorkingState => ({
  mode,
  sourceTurnId,
  workingComponents: components,
  currentIndex: 0,
  acceptedIndexes: [],
  awaitingFinalSave: false,
});

export const emptyStepWorkingState = (
  steps: SequentialStep[],
  mode: StepWorkingState['mode'],
  sourceTurnId: string | null = null,
): StepWorkingState => ({
  mode,
  sourceTurnId,
  workingSteps: steps,
  currentIndex: 0,
  acceptedIndexes: [],
  awaitingFinalSave: false,
});

export const parseComponentWorkingState = (value: unknown): ComponentWorkingState | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.workingComponents)) {
    return null;
  }
  return {
    mode: record.mode === 'ONE_BY_ONE' ? 'ONE_BY_ONE' : 'FULL_LIST',
    sourceTurnId: typeof record.sourceTurnId === 'string' ? record.sourceTurnId : null,
    workingComponents: record.workingComponents as SequentialComponent[],
    currentIndex: typeof record.currentIndex === 'number' ? record.currentIndex : 0,
    acceptedIndexes: Array.isArray(record.acceptedIndexes)
      ? (record.acceptedIndexes as number[])
      : [],
    awaitingFinalSave: record.awaitingFinalSave === true,
  };
};

export const parseStepWorkingState = (value: unknown): StepWorkingState | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.workingSteps)) {
    return null;
  }
  return {
    mode: record.mode === 'STEP_BY_STEP' ? 'STEP_BY_STEP' : 'FULL_PLAN',
    sourceTurnId: typeof record.sourceTurnId === 'string' ? record.sourceTurnId : null,
    workingSteps: record.workingSteps as SequentialStep[],
    currentIndex: typeof record.currentIndex === 'number' ? record.currentIndex : 0,
    acceptedIndexes: Array.isArray(record.acceptedIndexes)
      ? (record.acceptedIndexes as number[])
      : [],
    awaitingFinalSave: record.awaitingFinalSave === true,
  };
};

export const toLegacySessionFields = (
  session: ProjectAuthoringSession,
): Pick<
  AiProjectAuthoringSessionBlock,
  | 'componentReviewMode'
  | 'stepReviewMode'
  | 'currentComponentIndex'
  | 'currentStepIndex'
  | 'acceptedComponentIndexes'
  | 'acceptedStepIndexes'
  | 'componentSourceTotal'
  | 'awaitingComponentsFinalSave'
  | 'awaitingStepsFinalSave'
  | 'workingComponents'
  | 'workingSteps'
> => {
  const componentState = parseComponentWorkingState(session.componentWorkingState);
  const stepState = parseStepWorkingState(session.stepWorkingState);
  return {
    componentReviewMode:
      session.componentReviewMode === 'ONE_BY_ONE'
        ? 'ONE_BY_ONE'
        : session.componentReviewMode === 'FULL_LIST'
          ? 'FULL_LIST'
          : componentState?.mode === 'ONE_BY_ONE'
            ? 'ONE_BY_ONE'
            : componentState?.mode === 'FULL_LIST'
              ? 'FULL_LIST'
              : null,
    stepReviewMode:
      session.stepReviewMode === 'STEP_BY_STEP'
        ? 'STEP_BY_STEP'
        : session.stepReviewMode === 'FULL_PLAN'
          ? 'FULL_PLAN'
          : stepState?.mode === 'STEP_BY_STEP'
            ? 'STEP_BY_STEP'
            : stepState?.mode === 'FULL_PLAN'
              ? 'FULL_PLAN'
              : null,
    currentComponentIndex: componentState?.currentIndex,
    currentStepIndex: stepState?.currentIndex,
    acceptedComponentIndexes: componentState?.acceptedIndexes,
    acceptedStepIndexes: stepState?.acceptedIndexes,
    componentSourceTotal: componentState?.workingComponents.length,
    awaitingComponentsFinalSave: componentState?.awaitingFinalSave ?? false,
    awaitingStepsFinalSave: stepState?.awaitingFinalSave ?? false,
    workingComponents: componentState?.workingComponents,
    workingSteps: stepState?.workingSteps,
  };
};

export const removeWorkingComponentAt = (
  components: SequentialComponent[],
  index: number,
) => components.filter((_, itemIndex) => itemIndex !== index);

export const removeWorkingStepAt = (steps: SequentialStep[], index: number) =>
  steps
    .filter((_, itemIndex) => itemIndex !== index)
    .map((step, itemIndex) => ({ ...step, stepNumber: itemIndex + 1 }));

export const reindexWorkingSteps = (steps: SequentialStep[]) =>
  steps.map((step, index) => ({ ...step, stepNumber: index + 1 }));

export const toLegacySessionBlock = (
  session: ProjectAuthoringSession,
): AiProjectAuthoringSessionBlock => ({
  type: 'project_authoring_session',
  sessionId: session.id,
  projectId: session.learningProjectId,
  baseUpdatedAt: session.baseProjectUpdatedAt.toISOString(),
  stage: session.stage as AiProjectAuthoringSessionBlock['stage'],
  flowStatus: mapPersistedStatusToFlowStatus(session.status),
  acceptedStages: session.completedStages as AiProjectAuthoringSessionBlock['acceptedStages'],
  currentTurnId: session.currentTurnId,
  policyVersion: 'project-authoring-sequential-v1',
  createdAt: session.createdAt.toISOString(),
  updatedAt: session.updatedAt.toISOString(),
  ...toLegacySessionFields(session),
});

export const toLegacyTurnBlock = (
  session: ProjectAuthoringSession,
  turn: ProjectAuthoringTurn,
): AiProjectAuthoringTurnBlock => ({
  type: 'project_authoring_turn',
  turnId: turn.id,
  sessionId: session.id,
  stage: turn.stage as AiProjectAuthoringTurnBlock['stage'],
  projectId: session.learningProjectId,
  baseUpdatedAt: turn.baseProjectUpdatedAt.toISOString(),
  status: turn.status as AiProjectAuthoringTurnBlock['status'],
  proposal: turn.payload as AiProjectAuthoringTurnBlock['proposal'],
  explanation: turn.explanation ?? '',
  createdAt: turn.createdAt.toISOString(),
});

const mapPersistedStatusToFlowStatus = (
  status: ProjectAuthoringSession['status'],
): AiProjectAuthoringSessionBlock['flowStatus'] => {
  switch (status) {
    case 'WAITING_FOR_ASSISTANT':
    case 'SAVING':
      return 'WAITING_FOR_ASSISTANT';
    case 'GENERATION_FAILED':
      return 'GENERATION_FAILED';
    case 'STALE':
      return 'STALE';
    case 'COMPLETE':
      return 'COMPLETE';
    default:
      return 'WAITING_FOR_USER';
  }
};

const readWorkingComponents = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('components' in value)) {
    return undefined;
  }
  const components = (value as { components?: unknown }).components;
  return Array.isArray(components) ? components : undefined;
};

const readWorkingSteps = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('steps' in value)) {
    return undefined;
  }
  const steps = (value as { steps?: unknown }).steps;
  return Array.isArray(steps) ? steps : undefined;
};

export const buildLegacyBlocksFromPersistedSession = (input: {
  session: ProjectAuthoringSession & { currentTurn: ProjectAuthoringTurn | null };
  supersededTurn?: ProjectAuthoringTurn | null;
  acceptedTurn?: ProjectAuthoringTurn | null;
}): AiContentBlock[] => {
  const blocks: AiContentBlock[] = [toLegacySessionBlock(input.session)];
  if (input.supersededTurn) {
    blocks.push(
      toLegacyTurnBlock(input.session, {
        ...input.supersededTurn,
        status: 'SUPERSEDED',
      }),
    );
  }
  if (input.acceptedTurn) {
    blocks.push(
      toLegacyTurnBlock(input.session, {
        ...input.acceptedTurn,
        status: 'ACCEPTED',
      }),
    );
  }
  if (input.session.currentTurn && input.session.currentTurn.status === 'PROPOSED') {
    blocks.push(toLegacyTurnBlock(input.session, input.session.currentTurn));
  }
  return blocks;
};

export const buildAuthoringSessionResponse = (input: {
  session: ProjectAuthoringSession & { currentTurn: ProjectAuthoringTurn | null };
  project: ProjectRecord;
  messages?: AiMessage[];
}): AuthoringSessionResponse => {
  const legacySession = toLegacySessionBlock(input.session);
  const currentTurn = input.session.currentTurn;
  const legacyTurn =
    currentTurn && currentTurn.status === 'PROPOSED'
      ? toLegacyTurnBlock(input.session, currentTurn)
      : null;

  const availableActions = buildAvailableActions({
    session: legacySession,
    currentTurn: legacyTurn,
  });

  const scalarProposalStages = new Set([
    'TITLE',
    'SHORT_DESCRIPTION',
    'FULL_DESCRIPTION',
    'DIFFICULTY',
    'ESTIMATED_DURATION',
  ]);
  if (
    input.session.status === 'GENERATION_FAILED' &&
    input.session.stage === 'STEPS_OVERVIEW'
  ) {
    if (!availableActions.includes('REGENERATE_STALE')) {
      availableActions.push('REGENERATE_STALE');
    }
  }
  if (
    input.session.status === 'GENERATION_FAILED' &&
    input.session.stage === 'COMPONENTS'
  ) {
    if (!availableActions.includes('REGENERATE_FAILED_STAGE')) {
      availableActions.push('REGENERATE_FAILED_STAGE');
    }
  }
  if (
    scalarProposalStages.has(input.session.stage) &&
    (input.session.status === 'WAITING_FOR_ASSISTANT' ||
      input.session.status === 'GENERATION_FAILED') &&
    !input.session.currentTurn
  ) {
    if (!availableActions.includes('REGENERATE_FAILED_STAGE')) {
      availableActions.push('REGENERATE_FAILED_STAGE');
    }
  }

  const confirmedRequirements = readConfirmedRequirements(input.session);

  return authoringSessionResponseSchema.parse({
    session: {
      id: input.session.id,
      conversationId: input.session.conversationId,
      learningProjectId: input.session.learningProjectId,
      stage: input.session.stage,
      status: input.session.status,
      version: input.session.version,
      completedStages: input.session.completedStages,
      baseProjectUpdatedAt: input.session.baseProjectUpdatedAt.toISOString(),
      componentReviewState: (input.session.componentWorkingState as Record<string, unknown> | null) ?? null,
      stepReviewState: (input.session.stepWorkingState as Record<string, unknown> | null) ?? null,
      generationErrorCode: input.session.generationErrorCode,
      currentTurnId: input.session.currentTurnId,
      confirmedRequirements:
        confirmedRequirements.requestedStepCount != null ||
        confirmedRequirements.requestedComponentCount != null
          ? confirmedRequirements
          : null,
    },
    currentTurn: currentTurn
      ? {
          id: currentTurn.id,
          stage: currentTurn.stage,
          kind: currentTurn.kind,
          status: currentTurn.status,
          payload: currentTurn.payload as Record<string, unknown>,
          explanation: currentTurn.explanation,
          baseProjectUpdatedAt: currentTurn.baseProjectUpdatedAt.toISOString(),
        }
      : null,
    canonicalProject: mapAuthoringCanonicalProject(input.project),
    availableActions,
    conversationMessages: input.messages?.map((message) => ({
      id: message.id,
      role: message.role,
      status: message.status,
      contentText: message.contentText,
      createdAt: message.createdAt.toISOString(),
    })),
  });
};

export const buildLegacyAuthoringSnapshotFromPersistedSession = (input: {
  session: ProjectAuthoringSession & { currentTurn: ProjectAuthoringTurn | null };
  project: ProjectRecord;
}): AuthoringSnapshot => {
  const response = buildAuthoringSessionResponse(input);
  const legacySession = toLegacySessionBlock(input.session);
  const currentTurn = input.session.currentTurn;
  const legacyTurn =
    currentTurn && currentTurn.status === 'PROPOSED'
      ? toLegacyTurnBlock(input.session, currentTurn)
      : null;

  const completedStages = response.session.completedStages;
  const status =
    input.session.status === 'COMPLETE'
      ? 'COMPLETE'
      : input.session.status === 'GENERATION_FAILED'
        ? 'GENERATION_FAILED'
        : input.session.status === 'STALE'
          ? 'STALE'
          : input.session.status === 'WAITING_FOR_ASSISTANT' ||
              input.session.status === 'SAVING'
            ? 'PROCESSING'
            : 'WAITING_FOR_USER';

  const snapshot: AuthoringSnapshot = {
    session: {
      sessionId: input.session.id,
      projectId: input.session.learningProjectId,
      stage: input.session.stage,
      status,
      completedStages,
      currentTurnId: input.session.currentTurnId,
      baseUpdatedAt: input.session.baseProjectUpdatedAt.toISOString(),
      isStale: input.session.status === 'STALE',
      componentReviewMode: legacySession.componentReviewMode ?? input.session.componentReviewMode,
      stepReviewMode: legacySession.stepReviewMode ?? input.session.stepReviewMode,
      currentComponentIndex: legacySession.currentComponentIndex,
      currentStepIndex: legacySession.currentStepIndex,
      awaitingComponentsFinalSave: legacySession.awaitingComponentsFinalSave ?? false,
      awaitingStepsFinalSave: legacySession.awaitingStepsFinalSave ?? false,
      workingComponents: legacySession.workingComponents ?? readWorkingComponents(input.session.componentWorkingState),
      workingSteps: legacySession.workingSteps ?? readWorkingSteps(input.session.stepWorkingState),
    },
    currentTurn: legacyTurn
      ? {
          turnId: legacyTurn.turnId,
          sessionId: legacyTurn.sessionId,
          stage: legacyTurn.stage,
          status: legacyTurn.status,
          proposal: legacyTurn.proposal as Record<string, unknown>,
          explanation: legacyTurn.explanation,
          baseUpdatedAt: legacyTurn.baseUpdatedAt,
        }
      : null,
    currentSuggestion: legacyTurn
      ? buildCurrentSuggestion(legacyTurn, legacyTurn.proposal)
      : null,
    canonicalProject: mapAuthoringCanonicalProject(input.project),
    availableActions: response.availableActions,
    progress: {
      completed: completedStages.length,
      total: 7,
    },
  };
  return snapshot;
};

const buildCurrentSuggestion = (
  turn: AiProjectAuthoringTurnBlock,
  payload: AiProjectAuthoringTurnBlock['proposal'],
) => {
  const base = {
    turnId: turn.turnId,
    stage: turn.stage,
    explanation: turn.explanation,
    status: turn.status,
  };
  if ('value' in payload) {
    return { ...base, value: payload.value };
  }
  if ('components' in payload && Array.isArray(payload.components)) {
    return { ...base, components: payload.components };
  }
  if ('steps' in payload && Array.isArray(payload.steps)) {
    return { ...base, steps: payload.steps };
  }
  return base;
};
