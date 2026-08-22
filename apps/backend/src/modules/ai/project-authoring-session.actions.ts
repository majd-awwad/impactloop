import { randomUUID } from 'node:crypto';

import type { ProjectAuthoringSessionStage } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import * as learningProjectsRepository from '../learning-projects/learning-projects.repository.js';
import {
  createAssistantMessage,
  createUserMessage,
  loadRecentConversationMessages,
  touchConversationActivity,
} from './ai.repository.js';
import { parseStoredContentBlocks } from './ai-context-builder.js';
import { env } from '../../config/env.js';
import {
  generateAlternativeSequentialComponentListWithRepair,
  validateComponentList,
} from './ai-project-authoring-sequential-components.provider.js';
import {
  resolveComponentReference,
  validateComponentStepConsistency,
  type SequentialComponent as PolicySequentialComponent,
  type StepComponentConsistencyIssue,
} from './ai-project-authoring-sequential.policy.js';
import {
  generateAlternativeSequentialStepPlanWithRepair,
  repairSequentialStepListForConsistency,
  validateStepList,
} from './ai-project-authoring-sequential-steps.provider.js';
import { generateAlternativeStageDiscussionWithRepair } from './ai-project-authoring-sequential-discussion.provider.js';
import {
  advanceSessionAfterStageWrite,
  assertPersistedAuthoringContext,
  assertProposalNotStale,
  buildComponentItemTurn,
  buildComponentListTurn,
  buildStepItemTurn,
  buildStepPlanTurn,
  componentsFromPayload,
  buildStepAuthoringContext,
  canonicalScalarForStage,
  createStageProposalTurn,
  generateStepsConversationExplanation,
  initComponentWorkingState,
  initStepWorkingState,
  loadAuthoringConversationHistory,
  loadProjectForConversation,
  nextStageAfter,
  patchForStage,
  projectComponentsAsSequential,
  projectStepsAsSequential,
  readTrustedComponentList,
  readTrustedStepList,
  STAGE_ORDER,
  stepsFromPayload,
  tryGenerateStepPlan,
  turnKindForStage,
  validateAuthoringStepPlanForSession,
  writeStagePatch,
  type ProjectRecord,
} from './project-authoring-session.helpers.js';
import { projectAuthoringSessionRepository } from './project-authoring-session.repository.js';
import {
  buildAuthoringSessionResponse,
  type AuthoringSessionResponse,
} from './project-authoring-session.state.js';
import {
  parseComponentWorkingState,
  parseStepWorkingState,
  removeWorkingComponentAt,
  removeWorkingStepAt,
  reindexWorkingSteps,
  type SequentialComponent,
  type SequentialStep,
} from './project-authoring-session.state.js';
import type { AiLocale } from './ai.types.js';

export type PersistedAuthoringAction =
  | 'START'
  | 'ACCEPT_CURRENT'
  | 'SUGGEST_ANOTHER'
  | 'SAVE_MANUAL'
  | 'REGENERATE_FAILED_STAGE'
  | 'FINISH'
  | 'CHOOSE_COMPONENT_MODE'
  | 'ACCEPT_COMPONENT_ITEM'
  | 'REMOVE_COMPONENT_ITEM'
  | 'ADD_COMPONENT_ITEM'
  | 'BACK_COMPONENT_ITEM'
  | 'FINALIZE_COMPONENTS'
  | 'CHOOSE_STEP_MODE'
  | 'ACCEPT_STEP_ITEM'
  | 'REMOVE_STEP_ITEM'
  | 'ADD_STEP_ITEM'
  | 'BACK_STEP_ITEM'
  | 'EXPLAIN_STEP'
  | 'FINALIZE_STEPS'
  | 'REVISIT_STAGE';

export type PersistedActionBody = {
  action: PersistedAuthoringAction;
  expectedVersion: number;
  turnId?: string;
  manualValue?: unknown;
  mode?: 'FULL_LIST' | 'ONE_BY_ONE' | 'FULL_PLAN' | 'STEP_BY_STEP';
  targetStage?: string;
};

const assertActionAllowed = (allowed: boolean, locale: AiLocale) => {
  if (!allowed) {
    throw new AppError(
      locale === 'ar' ? 'هذا الإجراء غير متاح في المرحلة الحالية.' : 'This action is not allowed at the current stage.',
      409,
      'AI_AUTHORING_ACTION_NOT_ALLOWED',
    );
  }
};

const requireCurrentTurn = async (
  session: { currentTurnId: string | null; currentTurn: { id: string; status: string } | null },
  turnId: string | undefined,
) => {
  const resolvedTurnId = turnId ?? session.currentTurnId;
  if (!resolvedTurnId || resolvedTurnId !== session.currentTurnId) {
    throw new AppError(
      'This proposal is no longer current.',
      409,
      'AI_AUTHORING_TURN_SUPERSEDED',
    );
  }
  const turn = session.currentTurn;
  if (!turn || turn.status !== 'PROPOSED') {
    if (turn?.status === 'ACCEPTED') {
      return null;
    }
    throw new AppError(
      'This proposal is no longer current.',
      409,
      'AI_AUTHORING_TURN_SUPERSEDED',
    );
  }
  return resolvedTurnId;
};

const saveComponentsToProject = async (input: {
  userId: string;
  project: ProjectRecord;
  session: { baseProjectUpdatedAt: Date };
  components: SequentialComponent[];
  locale: AiLocale;
}) => {
  const normalizedNames = input.components.map((component) =>
    component.componentName.trim().toLowerCase(),
  );
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    throw new AppError(
      'Duplicate component names are not allowed.',
      409,
      'DUPLICATE_COMPONENT_NAME',
    );
  }
  try {
    await writeStagePatch({
      userId: input.userId,
      project: input.project,
      session: input.session as never,
      patch: { requiredComponents: validateComponentList(input.components as PolicySequentialComponent[]) },
    });
  } catch (error) {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر حفظ قائمة المكوّنات. تم الاحتفاظ بالقائمة المقترحة.'
        : 'Could not save the component list. Your proposed list was preserved.',
      502,
      'AI_COMPONENT_SAVE_FAILED',
      { cause: error },
    );
  }
};

const saveStepsToProject = async (input: {
  userId: string;
  project: ProjectRecord;
  session: { baseProjectUpdatedAt: Date };
  steps: SequentialStep[];
  components: SequentialComponent[];
  locale: AiLocale;
}) => {
  const consistency = validateComponentStepConsistency({
    components: input.components as PolicySequentialComponent[],
    steps: input.steps,
    constraints: [],
  });
  if (!consistency.ok) {
    throw new AppError(consistency.issues.join(' '), 409, consistency.code);
  }
  const steps = validateStepList(input.steps);
  try {
    await writeStagePatch({
      userId: input.userId,
      project: input.project,
      session: input.session as never,
      patch: { steps },
    });
  } catch (error) {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذّر حفظ الخطوات. تم الاحتفاظ بخطتك.'
        : 'Could not save the steps. Your reviewed plan was preserved.',
      502,
      'AI_STEP_SAVE_FAILED',
      { cause: error },
    );
  }
};

const repairPersistedAiStepReferences = async (input: {
  project: ProjectRecord;
  sessionRecord: NonNullable<
    Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>
  >;
  locale: AiLocale;
  steps: SequentialStep[];
  components: PolicySequentialComponent[];
  consistencyIssues: StepComponentConsistencyIssue[];
}) => {
  const referenceIssues = input.consistencyIssues.filter(
    (issue) =>
      issue.code === 'UNKNOWN_COMPONENT_REFERENCE' ||
      issue.code === 'AMBIGUOUS_COMPONENT_REFERENCE',
  );
  if (
    referenceIssues.length === 0 ||
    referenceIssues.length !== input.consistencyIssues.length
  ) {
    throw new AppError(
      input.consistencyIssues.map((issue) => issue.message).join(' '),
      409,
      'AI_STEP_COMPONENT_INCONSISTENT',
    );
  }

  const context = await buildStepAuthoringContext({
    project: input.project,
    conversationId: input.sessionRecord.conversationId,
    sessionId: input.sessionRecord.id,
    uiLocale: input.locale,
    sessionRecord: input.sessionRecord,
  });
  const repaired = await repairSequentialStepListForConsistency({
    ...context,
    invalidSteps: input.steps,
    consistencyIssues: referenceIssues,
    mismatchSource: 'persisted-ai-step-state',
  });
  if (repaired.steps.length !== input.steps.length) {
    throw new AppError(
      'Step reference repair changed the persisted Step count.',
      409,
      'AI_STEP_COMPONENT_INCONSISTENT',
    );
  }

  const failingIndexes = new Set(
    referenceIssues
      .map((issue) => issue.stepIndex)
      .filter((stepIndex): stepIndex is number => stepIndex != null),
  );
  const mergedSteps = input.steps.map((step, stepIndex) => {
    if (!failingIndexes.has(stepIndex)) {
      return step;
    }
    const validExistingRefs = (step.componentRefs ?? []).filter((componentRef) => {
      const resolution = resolveComponentReference(componentRef, input.components).resolution;
      return resolution !== 'UNKNOWN' && resolution !== 'AMBIGUOUS';
    });
    const repairedRefs = repaired.steps[stepIndex]?.componentRefs ?? [];
    return {
      ...step,
      componentRefs: [...new Set([...validExistingRefs, ...repairedRefs])],
    };
  });

  const consistency = validateComponentStepConsistency({
    components: input.components,
    steps: mergedSteps,
    constraints: [],
  });
  if (!consistency.ok) {
    throw new AppError(
      consistency.issues.join(' '),
      409,
      consistency.code,
      {
        issues: consistency.issues,
        consistencyIssues: consistency.consistencyIssues,
        mismatchSource: 'persisted-ai-step-state',
        canonicalComponentIds: input.components
          .map((component) => component.id)
          .filter((id): id is string => Boolean(id)),
      },
    );
  }

  return mergedSteps;
};

const handleAcceptCurrent = async (input: {
  userId: string;
  sessionRecord: Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>;
  project: ProjectRecord;
  locale: AiLocale;
  body: PersistedActionBody;
}): Promise<AuthoringSessionResponse> => {
  const sessionRecord = input.sessionRecord!;
  const turnId = input.body.turnId ?? sessionRecord.currentTurnId;
  if (!turnId) {
    throw new AppError(
      'This proposal is no longer current.',
      409,
      'AI_AUTHORING_TURN_SUPERSEDED',
    );
  }

  if (turnId !== sessionRecord.currentTurnId) {
    const existingTurn = await projectAuthoringSessionRepository.findTurnById(turnId);
    if (existingTurn?.status === 'ACCEPTED') {
      return buildAuthoringSessionResponse({ session: sessionRecord, project: input.project });
    }
    throw new AppError(
      'This proposal is no longer current.',
      409,
      'AI_AUTHORING_TURN_SUPERSEDED',
    );
  }

  const resolvedTurnId = await requireCurrentTurn(sessionRecord, turnId);
  if (!resolvedTurnId) {
    return buildAuthoringSessionResponse({ session: sessionRecord, project: input.project });
  }

  const turn = sessionRecord.currentTurn!;
  assertProposalNotStale({
    turn,
    project: input.project,
    locale: input.locale,
    stage: turn.stage,
  });

  const componentState = parseComponentWorkingState(sessionRecord.componentWorkingState);
  const stepState = parseStepWorkingState(sessionRecord.stepWorkingState);
  const payload = turn.payload as Record<string, unknown>;

  if (
    turn.stage === 'COMPONENTS' &&
    componentState?.mode === 'ONE_BY_ONE' &&
    'component' in payload &&
    !componentState.awaitingFinalSave
  ) {
    const workingComponents = [...componentState.workingComponents];
    const index = Number(payload.index ?? componentState.currentIndex);
    workingComponents[index] = payload.component as SequentialComponent;
    const acceptedIndexes = Array.from(new Set([...componentState.acceptedIndexes, index]));
    const allReviewed = acceptedIndexes.length >= workingComponents.length;

    if (allReviewed) {
      const nextState = {
        ...componentState,
        workingComponents,
        acceptedIndexes,
        awaitingFinalSave: true,
        currentIndex: 0,
      };
      const listTurn = buildComponentListTurn({
        components: workingComponents,
        locale: input.locale,
        awaitingFinalSave: true,
      });
      const accepted = await projectAuthoringSessionRepository.acceptCurrentTurn({
        sessionId: sessionRecord.id,
        expectedVersion: input.body.expectedVersion,
        turnId,
        sessionPatch: {
          status: 'WAITING_FOR_USER',
          currentTurnId: null,
          componentWorkingState: nextState,
        },
      });
      const session = await projectAuthoringSessionRepository.setCurrentTurn({
        sessionId: accepted.id,
        expectedVersion: accepted.version,
        turn: {
          id: randomUUID(),
          sessionId: accepted.id,
          stage: 'COMPONENTS',
          kind: listTurn.kind,
          status: 'PROPOSED',
          payload: listTurn.payload,
          explanation: listTurn.explanation,
          baseProjectUpdatedAt: input.project.updatedAt,
        },
        sessionPatch: {
          componentWorkingState: nextState,
        },
      });
      return buildAuthoringSessionResponse({ session, project: input.project });
    }

    const nextIndex = index + 1;
    const nextState = {
      ...componentState,
      workingComponents,
      acceptedIndexes,
      currentIndex: nextIndex,
    };
    const itemTurn = buildComponentItemTurn({ componentState: nextState, locale: input.locale });
    const accepted = await projectAuthoringSessionRepository.acceptCurrentTurn({
      sessionId: sessionRecord.id,
      expectedVersion: input.body.expectedVersion,
      turnId,
      sessionPatch: {
        status: 'WAITING_FOR_USER',
        currentTurnId: null,
        componentWorkingState: nextState,
      },
    });
    const session = await projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: accepted.id,
      expectedVersion: accepted.version,
      turn: {
        id: randomUUID(),
        sessionId: accepted.id,
        stage: 'COMPONENTS',
        kind: itemTurn.kind,
        status: 'PROPOSED',
        payload: itemTurn.payload,
        explanation: itemTurn.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        componentWorkingState: nextState,
      },
    });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  if (
    turn.stage === 'STEP_REVIEW' &&
    stepState?.mode === 'STEP_BY_STEP' &&
    'title' in payload &&
    'index' in payload &&
    !stepState.awaitingFinalSave
  ) {
    const workingSteps = [...stepState.workingSteps];
    const index = Number(payload.index);
    workingSteps[index] = {
      ...workingSteps[index],
      title: String(payload.title),
      description: String(payload.description),
    };
    const acceptedIndexes = Array.from(new Set([...stepState.acceptedIndexes, index]));
    const allReviewed = acceptedIndexes.length >= workingSteps.length;

    if (allReviewed) {
      const nextState = {
        ...stepState,
        workingSteps,
        acceptedIndexes,
        awaitingFinalSave: true,
        currentIndex: 0,
      };
      const planTurn = buildStepPlanTurn({
        steps: workingSteps,
        locale: input.locale,
        awaitingFinalSave: true,
      });
      const accepted = await projectAuthoringSessionRepository.acceptCurrentTurn({
        sessionId: sessionRecord.id,
        expectedVersion: input.body.expectedVersion,
        turnId,
        sessionPatch: {
          stage: 'STEPS_OVERVIEW',
          status: 'WAITING_FOR_USER',
          currentTurnId: null,
          stepWorkingState: nextState,
        },
      });
      const session = await projectAuthoringSessionRepository.setCurrentTurn({
        sessionId: accepted.id,
        expectedVersion: accepted.version,
        turn: {
          id: randomUUID(),
          sessionId: accepted.id,
          stage: 'STEPS_OVERVIEW',
          kind: planTurn.kind,
          status: 'PROPOSED',
          payload: planTurn.payload,
          explanation: planTurn.explanation,
          baseProjectUpdatedAt: input.project.updatedAt,
        },
        sessionPatch: {
          stepWorkingState: nextState,
        },
      });
      return buildAuthoringSessionResponse({ session, project: input.project });
    }

    const nextIndex = index + 1;
    const nextState = {
      ...stepState,
      workingSteps,
      acceptedIndexes,
      currentIndex: nextIndex,
    };
    const itemTurn = buildStepItemTurn({ stepState: nextState, locale: input.locale });
    const accepted = await projectAuthoringSessionRepository.acceptCurrentTurn({
      sessionId: sessionRecord.id,
      expectedVersion: input.body.expectedVersion,
      turnId,
      sessionPatch: {
        status: 'WAITING_FOR_USER',
        currentTurnId: null,
        stepWorkingState: nextState,
      },
    });
    const session = await projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: accepted.id,
      expectedVersion: accepted.version,
      turn: {
        id: randomUUID(),
        sessionId: accepted.id,
        stage: 'STEP_REVIEW',
        kind: itemTurn.kind,
        status: 'PROPOSED',
        payload: itemTurn.payload,
        explanation: itemTurn.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        stepWorkingState: nextState,
      },
    });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  if (
    turn.stage === 'COMPONENTS' &&
    (componentState?.awaitingFinalSave ||
      componentState?.mode === 'FULL_LIST' ||
      !componentState)
  ) {
    const components = readTrustedComponentList(sessionRecord, turn);
    await saveComponentsToProject({
      userId: input.userId,
      project: input.project,
      session: sessionRecord,
      components: components as SequentialComponent[],
      locale: input.locale,
    });
    try {
      const { session, project } = await advanceSessionAfterStageWrite({
        userId: input.userId,
        session: sessionRecord,
        project: input.project,
        locale: input.locale,
        completedStage: 'COMPONENTS',
        expectedVersion: input.body.expectedVersion,
        clearComponentState: true,
      });
      await touchConversationActivity({
        conversationId: session.conversationId,
        locale: input.locale,
        title: project.title,
      });
      return buildAuthoringSessionResponse({ session, project });
    } catch (error) {
      const refreshedProject =
        await learningProjectsRepository.findMyLearningProjectSubmissionById(
          input.project.id,
          input.userId,
        );
      if (!refreshedProject) {
        throw error;
      }
      const refreshedSession =
        (await projectAuthoringSessionRepository.findByIdForOwner(
          sessionRecord.id,
          input.userId,
        )) ?? sessionRecord;
      await touchConversationActivity({
        conversationId: refreshedSession.conversationId,
        locale: input.locale,
        title: refreshedProject.title,
      });
      return buildAuthoringSessionResponse({
        session: refreshedSession,
        project: refreshedProject,
      });
    }
  }

  if (
    (turn.stage === 'STEPS_OVERVIEW' || turn.stage === 'STEP_REVIEW') &&
    (stepState?.awaitingFinalSave || stepState?.mode === 'FULL_PLAN' || !stepState)
  ) {
    let steps = readTrustedStepList(sessionRecord, turn) as SequentialStep[];
    const components = projectComponentsAsSequential(
      input.project,
    ) as PolicySequentialComponent[];
    const consistency = validateComponentStepConsistency({
      components,
      steps,
      constraints: [],
    });
    if (!consistency.ok) {
      const aiGeneratedPersistedPlan = turn.kind === 'STEP_PLAN';
      if (!aiGeneratedPersistedPlan) {
        throw new AppError(consistency.issues.join(' '), 409, consistency.code);
      }
      steps = await repairPersistedAiStepReferences({
        project: input.project,
        sessionRecord,
        locale: input.locale,
        steps,
        components,
        consistencyIssues: consistency.consistencyIssues,
      });
    }
    await saveStepsToProject({
      userId: input.userId,
      project: input.project,
      session: sessionRecord,
      steps,
      components,
      locale: input.locale,
    });
    const completedStage =
      turn.stage === 'STEP_REVIEW' ? 'STEP_REVIEW' : 'STEPS_OVERVIEW';
    const { session, project } = await advanceSessionAfterStageWrite({
      userId: input.userId,
      session: sessionRecord,
      project: input.project,
      locale: input.locale,
      completedStage,
      expectedVersion: input.body.expectedVersion,
      clearStepState: true,
    });
    await touchConversationActivity({
      conversationId: session.conversationId,
      locale: input.locale,
      title: project.title,
    });
    return buildAuthoringSessionResponse({ session, project });
  }

  if (!['COMPONENTS', 'STEP_REVIEW', 'STEPS_OVERVIEW'].includes(turn.stage)) {
    const stagePayload = { ...(turn.payload as Record<string, unknown>) };
    await writeStagePatch({
      userId: input.userId,
      project: input.project,
      session: sessionRecord,
      patch: patchForStage(turn.stage, stagePayload),
    });
    const { session, project } = await advanceSessionAfterStageWrite({
      userId: input.userId,
      session: sessionRecord,
      project: input.project,
      locale: input.locale,
      completedStage: turn.stage,
      expectedVersion: input.body.expectedVersion,
    });
    await touchConversationActivity({
      conversationId: session.conversationId,
      locale: input.locale,
      title: project.title,
    });
    return buildAuthoringSessionResponse({ session, project });
  }

  throw new AppError('Unsupported accept for current stage.', 400, 'VALIDATION_ERROR');
};

const handleSaveManual = async (input: {
  userId: string;
  sessionRecord: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  project: ProjectRecord;
  locale: AiLocale;
  body: PersistedActionBody;
}): Promise<AuthoringSessionResponse> => {
  if (input.body.manualValue === undefined || input.body.manualValue === null) {
    throw new AppError('Manual value is required.', 400, 'VALIDATION_ERROR');
  }

  const stage =
    input.sessionRecord.stage === 'OVERVIEW' ? 'TITLE' : input.sessionRecord.stage;
  let patch: Parameters<typeof writeStagePatch>[0]['patch'] = {};

  if (stage === 'TITLE') patch = { title: String(input.body.manualValue) };
  if (stage === 'SHORT_DESCRIPTION') patch = { shortDescription: String(input.body.manualValue) };
  if (stage === 'FULL_DESCRIPTION') patch = { description: String(input.body.manualValue) };
  if (stage === 'DIFFICULTY') {
    patch = {
      difficulty: String(input.body.manualValue) as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
    };
  }
  if (stage === 'ESTIMATED_DURATION') {
    const minutes = Number(input.body.manualValue);
    if (!Number.isInteger(minutes) || minutes <= 0) {
      throw new AppError(
        input.locale === 'ar'
          ? 'يجب أن تكون المدة التقديرية عددًا موجبًا من الدقائق.'
          : 'Estimated duration must be a positive number of minutes.',
        400,
        'INVALID_ESTIMATED_DURATION',
      );
    }
    patch = { estimatedDurationMinutes: minutes };
  }
  if (stage === 'COMPONENTS') {
    if (!Array.isArray(input.body.manualValue)) {
      throw new AppError(
        input.locale === 'ar' ? 'يجب إرسال قائمة مكوّنات صالحة.' : 'A valid component list is required.',
        400,
        'VALIDATION_ERROR',
      );
    }
    const components = validateComponentList(input.body.manualValue as PolicySequentialComponent[]);
    const normalizedNames = components.map((component) =>
      component.componentName.trim().toLowerCase(),
    );
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      throw new AppError('Duplicate component names are not allowed.', 409, 'DUPLICATE_COMPONENT_NAME');
    }
    patch = { requiredComponents: components };
  }
  if (stage === 'STEPS_OVERVIEW' || stage === 'STEP_REVIEW') {
    if (!Array.isArray(input.body.manualValue)) {
      throw new AppError(
        input.locale === 'ar' ? 'يجب إرسال خطة خطوات صالحة.' : 'A valid step plan is required.',
        400,
        'VALIDATION_ERROR',
      );
    }
    const steps = validateStepList(
      stepsFromPayload({ steps: input.body.manualValue }) as SequentialStep[],
    );
    const consistency = validateComponentStepConsistency({
      components: projectComponentsAsSequential(input.project) as PolicySequentialComponent[],
      steps,
      constraints: [],
    });
    if (!consistency.ok) {
      throw new AppError(consistency.issues.join(' '), 409, 'AI_STEP_COMPONENT_INCONSISTENT');
    }
    patch = { steps };
  }

  if (Object.keys(patch).length === 0) {
    throw new AppError('Manual value is not supported for this stage.', 400, 'VALIDATION_ERROR');
  }

  try {
    await writeStagePatch({
      userId: input.userId,
      project: input.project,
      session: input.sessionRecord,
      patch,
    });
  } catch (error) {
    if (stage === 'COMPONENTS') {
      throw new AppError(
        input.locale === 'ar'
          ? 'تعذّر حفظ قائمة المكوّنات. تم الاحتفاظ بإدخالك.'
          : 'Could not save the component list. Your input was preserved.',
        502,
        'AI_COMPONENT_SAVE_FAILED',
        { cause: error },
      );
    }
    if (stage === 'STEPS_OVERVIEW' || stage === 'STEP_REVIEW') {
      throw new AppError(
        input.locale === 'ar'
          ? 'تعذّر حفظ الخطوات. تم الاحتفاظ بخطتك.'
          : 'Could not save the steps. Your reviewed plan was preserved.',
        502,
        'AI_STEP_SAVE_FAILED',
        { cause: error },
      );
    }
    throw error;
  }

  const refreshed = await learningProjectsRepository.findMyLearningProjectSubmissionById(
    input.project.id,
    input.userId,
  );
  if (!refreshed) {
    throw new AppError('Project not found after save.', 404, 'LEARNING_PROJECT_NOT_FOUND');
  }

  const completedStages = input.sessionRecord.completedStages.includes(stage)
    ? input.sessionRecord.completedStages
    : [...input.sessionRecord.completedStages, stage];
  const nextStage = nextStageAfter(stage);

  let session = await projectAuthoringSessionRepository.updateSession({
    sessionId: input.sessionRecord.id,
    expectedVersion: input.body.expectedVersion,
    patch: {
      stage: nextStage,
      status: nextStage === 'FINAL_REVIEW' || nextStage === 'COMPLETE' ? 'WAITING_FOR_USER' : 'WAITING_FOR_ASSISTANT',
      currentTurnId: null,
      completedStages,
      baseProjectUpdatedAt: refreshed.updatedAt,
      generationErrorCode: null,
    },
  });

  if (nextStage !== 'FINAL_REVIEW' && nextStage !== 'COMPLETE') {
    if (nextStage === 'STEPS_OVERVIEW' && stage === 'COMPONENTS') {
      session = await tryGenerateStepPlan({ session, project: refreshed, locale: input.locale });
    } else {
      try {
        const proposal = await createStageProposalTurn({
          session,
          project: refreshed,
          locale: input.locale,
          stage: nextStage,
        });
        session = await projectAuthoringSessionRepository.setCurrentTurn({
          sessionId: session.id,
          expectedVersion: session.version,
          turn: {
            id: randomUUID(),
            sessionId: session.id,
            stage: nextStage,
            kind: turnKindForStage(nextStage),
            status: 'PROPOSED',
            payload: proposal.payload,
            explanation: proposal.explanation,
            baseProjectUpdatedAt: refreshed.updatedAt,
          },
          sessionPatch: {
            status: 'WAITING_FOR_USER',
            baseProjectUpdatedAt: refreshed.updatedAt,
          },
        });
      } catch (error) {
        // Preserve accepted fields, expose a specific recoverable error, and
        // never leave the stage spinning without a Retry.
        await projectAuthoringSessionRepository.updateSession({
          sessionId: session.id,
          expectedVersion: session.version,
          patch: {
            status: 'GENERATION_FAILED',
            currentTurnId: null,
            generationErrorCode:
              error instanceof AppError
                ? error.code
                : 'AI_AUTHORING_STAGE_GENERATION_FAILED',
          },
        });
        throw error;
      }
    }
  }

  return buildAuthoringSessionResponse({ session, project: refreshed });
};

const handleChooseComponentMode = async (input: {
  sessionRecord: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  project: ProjectRecord;
  locale: AiLocale;
  body: PersistedActionBody;
}): Promise<AuthoringSessionResponse> => {
  assertActionAllowed(input.sessionRecord.stage === 'COMPONENTS', input.locale);
  if (!input.body.mode) {
    throw new AppError('Mode is required.', 400, 'VALIDATION_ERROR');
  }

  const turn = input.sessionRecord.currentTurn;
  const proposalComponents = turn
    ? (componentsFromPayload(turn.payload as Record<string, unknown>) as SequentialComponent[])
    : [];
  const workingComponents =
    proposalComponents.length > 0 ? proposalComponents : projectComponentsAsSequential(input.project);
  const mode = input.body.mode === 'ONE_BY_ONE' ? 'ONE_BY_ONE' : 'FULL_LIST';
  const componentState = initComponentWorkingState(
    workingComponents,
    mode,
    turn?.id ?? null,
  );

  if (mode === 'ONE_BY_ONE') {
    const itemTurn = buildComponentItemTurn({ componentState, locale: input.locale });
    const session = await projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: input.sessionRecord.id,
      expectedVersion: input.body.expectedVersion,
      turn: {
        id: randomUUID(),
        sessionId: input.sessionRecord.id,
        stage: 'COMPONENTS',
        kind: itemTurn.kind,
        status: 'PROPOSED',
        payload: itemTurn.payload,
        explanation: itemTurn.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        componentReviewMode: 'ONE_BY_ONE',
        componentWorkingState: componentState,
        status: 'WAITING_FOR_USER',
        baseProjectUpdatedAt: input.project.updatedAt,
      },
    });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  const listTurn = buildComponentListTurn({ components: workingComponents, locale: input.locale });
  const session = await projectAuthoringSessionRepository.setCurrentTurn({
    sessionId: input.sessionRecord.id,
    expectedVersion: input.body.expectedVersion,
    turn: {
      id: randomUUID(),
      sessionId: input.sessionRecord.id,
      stage: 'COMPONENTS',
      kind: listTurn.kind,
      status: 'PROPOSED',
      payload: listTurn.payload,
      explanation: listTurn.explanation,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      componentReviewMode: 'FULL_LIST',
      componentWorkingState: componentState,
      status: 'WAITING_FOR_USER',
      baseProjectUpdatedAt: input.project.updatedAt,
    },
  });
  return buildAuthoringSessionResponse({ session, project: input.project });
};

const handleChooseStepMode = async (input: {
  sessionRecord: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  project: ProjectRecord;
  locale: AiLocale;
  body: PersistedActionBody;
}): Promise<AuthoringSessionResponse> => {
  assertActionAllowed(
    input.sessionRecord.stage === 'STEPS_OVERVIEW' ||
      input.sessionRecord.stage === 'STEP_REVIEW',
    input.locale,
  );
  if (!input.body.mode) {
    throw new AppError('Mode is required.', 400, 'VALIDATION_ERROR');
  }

  const turn = input.sessionRecord.currentTurn;
  const proposalSteps = turn
    ? (stepsFromPayload(turn.payload as Record<string, unknown>) as SequentialStep[])
    : [];
  const workingSteps =
    proposalSteps.length > 0 ? proposalSteps : projectStepsAsSequential(input.project);
  const mode = input.body.mode === 'STEP_BY_STEP' ? 'STEP_BY_STEP' : 'FULL_PLAN';
  const stepState = initStepWorkingState(workingSteps, mode, turn?.id ?? null);

  if (mode === 'STEP_BY_STEP') {
    const itemTurn = buildStepItemTurn({ stepState, locale: input.locale });
    const session = await projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: input.sessionRecord.id,
      expectedVersion: input.body.expectedVersion,
      turn: {
        id: randomUUID(),
        sessionId: input.sessionRecord.id,
        stage: 'STEP_REVIEW',
        kind: itemTurn.kind,
        status: 'PROPOSED',
        payload: itemTurn.payload,
        explanation: itemTurn.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        stage: 'STEP_REVIEW',
        stepReviewMode: 'STEP_BY_STEP',
        stepWorkingState: stepState,
        status: 'WAITING_FOR_USER',
        baseProjectUpdatedAt: input.project.updatedAt,
      },
    });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  const planTurn = buildStepPlanTurn({ steps: workingSteps, locale: input.locale });
  const session = await projectAuthoringSessionRepository.setCurrentTurn({
    sessionId: input.sessionRecord.id,
    expectedVersion: input.body.expectedVersion,
    turn: {
      id: randomUUID(),
      sessionId: input.sessionRecord.id,
      stage: 'STEPS_OVERVIEW',
      kind: planTurn.kind,
      status: 'PROPOSED',
      payload: planTurn.payload,
      explanation: planTurn.explanation,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      stage: 'STEPS_OVERVIEW',
      stepReviewMode: 'FULL_PLAN',
      stepWorkingState: stepState,
      status: 'WAITING_FOR_USER',
      baseProjectUpdatedAt: input.project.updatedAt,
    },
  });
  return buildAuthoringSessionResponse({ session, project: input.project });
};

const mutateComponentWorking = async (input: {
  sessionRecord: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  project: ProjectRecord;
  locale: AiLocale;
  body: PersistedActionBody;
  action: 'REMOVE' | 'ADD' | 'BACK';
}): Promise<AuthoringSessionResponse> => {
  const componentState = parseComponentWorkingState(input.sessionRecord.componentWorkingState);
  assertActionAllowed(
    input.sessionRecord.stage === 'COMPONENTS' &&
      componentState?.mode === 'ONE_BY_ONE',
    input.locale,
  );
  if (!componentState) {
    throw new AppError('Component working state is missing.', 400, 'VALIDATION_ERROR');
  }

  const index =
    typeof input.body.manualValue === 'number'
      ? input.body.manualValue
      : componentState.currentIndex;

  if (input.action === 'BACK') {
    const previous = Math.max(0, componentState.currentIndex - 1);
    const nextState = { ...componentState, currentIndex: previous };
    const itemTurn = buildComponentItemTurn({ componentState: nextState, locale: input.locale });
    const session = await projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: input.sessionRecord.id,
      expectedVersion: input.body.expectedVersion,
      turn: {
        id: randomUUID(),
        sessionId: input.sessionRecord.id,
        stage: 'COMPONENTS',
        kind: itemTurn.kind,
        status: 'PROPOSED',
        payload: itemTurn.payload,
        explanation: itemTurn.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        componentWorkingState: nextState,
        status: 'WAITING_FOR_USER',
      },
    });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  let workingComponents = [...componentState.workingComponents];
  if (input.action === 'REMOVE') {
    workingComponents = removeWorkingComponentAt(workingComponents, index);
  } else if (input.body.manualValue && typeof input.body.manualValue === 'object') {
    workingComponents.push(input.body.manualValue as SequentialComponent);
  }

  const nextIndex = Math.min(index, Math.max(workingComponents.length - 1, 0));
  const nextState = {
    ...componentState,
    workingComponents,
    currentIndex: nextIndex,
    acceptedIndexes: [],
    awaitingFinalSave: false,
  };
  const itemTurn = buildComponentItemTurn({ componentState: nextState, locale: input.locale });
  const session = await projectAuthoringSessionRepository.setCurrentTurn({
    sessionId: input.sessionRecord.id,
    expectedVersion: input.body.expectedVersion,
    turn: {
      id: randomUUID(),
      sessionId: input.sessionRecord.id,
      stage: 'COMPONENTS',
      kind: itemTurn.kind,
      status: 'PROPOSED',
      payload: itemTurn.payload,
      explanation: itemTurn.explanation,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      componentWorkingState: nextState,
      status: 'WAITING_FOR_USER',
    },
  });
  return buildAuthoringSessionResponse({ session, project: input.project });
};

const mutateStepWorking = async (input: {
  sessionRecord: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  project: ProjectRecord;
  locale: AiLocale;
  body: PersistedActionBody;
  action: 'REMOVE' | 'ADD' | 'BACK';
}): Promise<AuthoringSessionResponse> => {
  const stepState = parseStepWorkingState(input.sessionRecord.stepWorkingState);
  assertActionAllowed(
    input.sessionRecord.stage === 'STEP_REVIEW' && stepState?.mode === 'STEP_BY_STEP',
    input.locale,
  );
  if (!stepState) {
    throw new AppError('Step working state is missing.', 400, 'VALIDATION_ERROR');
  }

  let workingSteps = [...stepState.workingSteps];
  const index =
    typeof input.body.manualValue === 'number' ? input.body.manualValue : stepState.currentIndex;

  if (input.action === 'BACK') {
    const previous = Math.max(0, stepState.currentIndex - 1);
    const nextState = { ...stepState, currentIndex: previous };
    const itemTurn = buildStepItemTurn({ stepState: nextState, locale: input.locale });
    const session = await projectAuthoringSessionRepository.setCurrentTurn({
      sessionId: input.sessionRecord.id,
      expectedVersion: input.body.expectedVersion,
      turn: {
        id: randomUUID(),
        sessionId: input.sessionRecord.id,
        stage: 'STEP_REVIEW',
        kind: itemTurn.kind,
        status: 'PROPOSED',
        payload: itemTurn.payload,
        explanation: itemTurn.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        stepWorkingState: nextState,
        status: 'WAITING_FOR_USER',
      },
    });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  if (input.action === 'REMOVE') {
    if (workingSteps.length <= 1) {
      throw new AppError(
        input.locale === 'ar'
          ? 'يجب أن تبقى خطوة واحدة على الأقل في الخطة.'
          : 'At least one step must remain in the plan.',
        409,
        'VALIDATION_ERROR',
      );
    }
    workingSteps = removeWorkingStepAt(workingSteps, index);
  } else if (input.body.manualValue && typeof input.body.manualValue === 'object') {
    const manualStep = input.body.manualValue as {
      title?: string;
      description?: string;
      safetyNote?: string | null;
    };
    const title = `${manualStep.title ?? ''}`.trim();
    const description = `${manualStep.description ?? ''}`.trim();
    if (title.length === 0 || description.length === 0) {
      throw new AppError(
        input.locale === 'ar'
          ? 'يجب إدخال عنوان ووصف للخطوة.'
          : 'Step title and description are required.',
        400,
        'VALIDATION_ERROR',
      );
    }
    workingSteps = reindexWorkingSteps([
      ...workingSteps.slice(0, index + 1),
      {
        title,
        description: manualStep.safetyNote?.trim()
          ? `${description}\n\n${manualStep.safetyNote.trim()}`
          : description,
      },
      ...workingSteps.slice(index + 1),
    ]);
  }

  const nextIndex = Math.min(index, Math.max(workingSteps.length - 1, 0));
  const nextState = {
    ...stepState,
    workingSteps,
    currentIndex: nextIndex,
    acceptedIndexes: [],
    awaitingFinalSave: false,
  };
  const itemTurn = buildStepItemTurn({ stepState: nextState, locale: input.locale });
  const session = await projectAuthoringSessionRepository.setCurrentTurn({
    sessionId: input.sessionRecord.id,
    expectedVersion: input.body.expectedVersion,
    turn: {
      id: randomUUID(),
      sessionId: input.sessionRecord.id,
      stage: 'STEP_REVIEW',
      kind: itemTurn.kind,
      status: 'PROPOSED',
      payload: itemTurn.payload,
      explanation: itemTurn.explanation,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      stepWorkingState: nextState,
      status: 'WAITING_FOR_USER',
    },
  });
  return buildAuthoringSessionResponse({ session, project: input.project });
};

const handleRegenerateFailedStage = async (input: {
  userId: string;
  sessionRecord: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  project: ProjectRecord;
  locale: AiLocale;
  body: PersistedActionBody;
}): Promise<AuthoringSessionResponse> => {
  if (
    input.sessionRecord.status === 'GENERATION_FAILED' &&
    input.sessionRecord.stage === 'STEPS_OVERVIEW'
  ) {
    const preparing = await projectAuthoringSessionRepository.updateSession({
      sessionId: input.sessionRecord.id,
      expectedVersion: input.body.expectedVersion,
      patch: {
        status: 'WAITING_FOR_ASSISTANT',
        generationErrorCode: null,
      },
    });
    const session = await tryGenerateStepPlan({
      session: preparing,
      project: input.project,
      locale: input.locale,
      expectedVersion: preparing.version,
    });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  const componentState = parseComponentWorkingState(input.sessionRecord.componentWorkingState);
  const stepState = parseStepWorkingState(input.sessionRecord.stepWorkingState);
  let stage = input.sessionRecord.stage === 'OVERVIEW' ? 'TITLE' : input.sessionRecord.stage;
  if (stage === 'COMPONENTS' && input.sessionRecord.completedStages.includes('COMPONENTS')) {
    stage = 'STEPS_OVERVIEW';
  }

  let sessionPatch: Record<string, unknown> = {
    status: 'WAITING_FOR_USER',
    baseProjectUpdatedAt: input.project.updatedAt,
    generationErrorCode: null,
  };

  if (stage === 'COMPONENTS' && !input.sessionRecord.componentReviewMode) {
    let generatedComponents: SequentialComponent[];
    let generatedExplanation: string;
    try {
      // Use the full authoritative session context (idea, clarification,
      // accepted duration/difficulty) and the same consistency gate as the
      // initial proposal, instead of an impoverished title-only context.
      const proposal = await createStageProposalTurn({
        session: input.sessionRecord,
        project: input.project,
        locale: input.locale,
        stage: 'COMPONENTS',
      });
      generatedComponents = componentsFromPayload(
        proposal.payload as Record<string, unknown>,
      ) as SequentialComponent[];
      generatedExplanation = proposal.explanation ?? '';
    } catch (error) {
      await projectAuthoringSessionRepository.updateSession({
        sessionId: input.sessionRecord.id,
        expectedVersion: input.body.expectedVersion,
        patch: {
          status: 'GENERATION_FAILED',
          currentTurnId: null,
          generationErrorCode:
            error instanceof AppError ? error.code : 'AI_COMPONENT_PROPOSAL_INVALID',
        },
      });
      throw error;
    }
    const nextComponentState = initComponentWorkingState(
      generatedComponents,
      componentState?.mode ?? 'FULL_LIST',
      input.sessionRecord.currentTurnId,
    );
    sessionPatch = {
      ...sessionPatch,
      stage: 'COMPONENTS',
      componentWorkingState: nextComponentState,
    };
    const listTurn = buildComponentListTurn({
      components: generatedComponents,
      locale: input.locale,
    });
    const newTurn = {
      id: randomUUID(),
      sessionId: input.sessionRecord.id,
      parentTurnId: input.sessionRecord.currentTurnId ?? undefined,
      stage: 'COMPONENTS' as const,
      kind: listTurn.kind,
      status: 'PROPOSED' as const,
      payload: listTurn.payload,
      explanation: generatedExplanation,
      baseProjectUpdatedAt: input.project.updatedAt,
    };
    const session = input.sessionRecord.currentTurnId
      ? await projectAuthoringSessionRepository.supersedeCurrentTurn({
          sessionId: input.sessionRecord.id,
          expectedVersion: input.body.expectedVersion,
          supersededTurnId: input.sessionRecord.currentTurnId,
          newTurn,
          sessionPatch,
        })
      : await projectAuthoringSessionRepository.setCurrentTurn({
          sessionId: input.sessionRecord.id,
          expectedVersion: input.body.expectedVersion,
          turn: newTurn,
          sessionPatch,
        });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  if (
    (stage === 'STEPS_OVERVIEW' || stage === 'STEP_REVIEW') &&
    !input.sessionRecord.stepReviewMode
  ) {
    const generated = await createStageProposalTurn({
      session: input.sessionRecord,
      project: input.project,
      locale: input.locale,
      stage: 'STEPS_OVERVIEW',
    });
    const nextStepState = initStepWorkingState(
      stepsFromPayload(generated.payload) as SequentialStep[],
      stepState?.mode ?? 'FULL_PLAN',
      input.sessionRecord.currentTurnId,
    );
    const session = input.sessionRecord.currentTurnId
      ? await projectAuthoringSessionRepository.supersedeCurrentTurn({
          sessionId: input.sessionRecord.id,
          expectedVersion: input.body.expectedVersion,
          supersededTurnId: input.sessionRecord.currentTurnId,
          newTurn: {
            id: randomUUID(),
            sessionId: input.sessionRecord.id,
            parentTurnId: input.sessionRecord.currentTurnId,
            stage: 'STEPS_OVERVIEW',
            kind: generated.kind,
            status: 'PROPOSED',
            payload: generated.payload,
            explanation: generated.explanation,
            baseProjectUpdatedAt: input.project.updatedAt,
          },
          sessionPatch: {
            ...sessionPatch,
            stage: 'STEPS_OVERVIEW',
            stepWorkingState: nextStepState,
          },
        })
      : await projectAuthoringSessionRepository.setCurrentTurn({
          sessionId: input.sessionRecord.id,
          expectedVersion: input.body.expectedVersion,
          turn: {
            id: randomUUID(),
            sessionId: input.sessionRecord.id,
            stage: 'STEPS_OVERVIEW',
            kind: generated.kind,
            status: 'PROPOSED',
            payload: generated.payload,
            explanation: generated.explanation,
            baseProjectUpdatedAt: input.project.updatedAt,
          },
          sessionPatch: {
            ...sessionPatch,
            stage: 'STEPS_OVERVIEW',
            stepWorkingState: nextStepState,
          },
        });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  const proposal = await createStageProposalTurn({
    session: input.sessionRecord,
    project: input.project,
    locale: input.locale,
    stage,
  });
  const session = input.sessionRecord.currentTurnId
    ? await projectAuthoringSessionRepository.supersedeCurrentTurn({
        sessionId: input.sessionRecord.id,
        expectedVersion: input.body.expectedVersion,
        supersededTurnId: input.sessionRecord.currentTurnId,
        newTurn: {
          id: randomUUID(),
          sessionId: input.sessionRecord.id,
          parentTurnId: input.sessionRecord.currentTurnId,
          stage,
          kind: proposal.kind,
          status: 'PROPOSED',
          payload: proposal.payload,
          explanation: proposal.explanation,
          baseProjectUpdatedAt: input.project.updatedAt,
        },
        sessionPatch: {
          ...sessionPatch,
          stage,
        },
      })
    : await projectAuthoringSessionRepository.setCurrentTurn({
        sessionId: input.sessionRecord.id,
        expectedVersion: input.body.expectedVersion,
        turn: {
          id: randomUUID(),
          sessionId: input.sessionRecord.id,
          stage,
          kind: proposal.kind,
          status: 'PROPOSED',
          payload: proposal.payload,
          explanation: proposal.explanation,
          baseProjectUpdatedAt: input.project.updatedAt,
        },
        sessionPatch: {
          ...sessionPatch,
          stage,
        },
      });
  return buildAuthoringSessionResponse({ session, project: input.project });
};

const handleSuggestAnother = async (input: {
  sessionRecord: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  project: ProjectRecord;
  locale: AiLocale;
  body: PersistedActionBody;
}): Promise<AuthoringSessionResponse> => {
  const currentTurnId = input.body.turnId ?? input.sessionRecord.currentTurnId;
  if (!currentTurnId || currentTurnId !== input.sessionRecord.currentTurnId) {
    throw new AppError(
      'This proposal is no longer current.',
      409,
      'AI_AUTHORING_TURN_SUPERSEDED',
    );
  }
  const turn = input.sessionRecord.currentTurn!;
  assertProposalNotStale({
    turn,
    project: input.project,
    locale: input.locale,
    stage: turn.stage,
  });

  const componentState = parseComponentWorkingState(input.sessionRecord.componentWorkingState);
  const stepState = parseStepWorkingState(input.sessionRecord.stepWorkingState);

  if (turn.stage === 'COMPONENTS' && !input.sessionRecord.componentReviewMode) {
    const currentComponents = componentsFromPayload(turn.payload as Record<string, unknown>);
    let generated;
    try {
      const listContext = await buildStepAuthoringContext({
        project: input.project,
        conversationId: input.sessionRecord.conversationId,
        sessionId: input.sessionRecord.id,
        uiLocale: input.locale,
        sessionRecord: input.sessionRecord,
      });
      generated = await generateAlternativeSequentialComponentListWithRepair({
        locale: listContext.locale,
        projectId: input.project.id,
        ideaText: listContext.ideaText,
        projectTitle: listContext.projectTitle,
        projectShortDescription: listContext.projectShortDescription,
        projectDescription: listContext.projectDescription,
        clarification: listContext.clarification,
        recentAnswers: listContext.recentAnswers,
        previousComponents: currentComponents as PolicySequentialComponent[],
      });
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_COMPONENT_PROPOSAL_IDENTICAL') {
        throw error;
      }
      throw new AppError(
        input.locale === 'ar'
          ? 'تعذّر على المساعد إنشاء قائمة مكوّنات صالحة. أعد المحاولة.'
          : 'The assistant could not create a valid component list. Retry.',
        502,
        'AI_COMPONENT_PROPOSAL_INVALID',
        { cause: error },
      );
    }
    const nextComponentState = componentState
      ? { ...componentState, workingComponents: generated.components }
      : initComponentWorkingState(generated.components, 'FULL_LIST', turn.id);
    const listTurn = buildComponentListTurn({
      components: generated.components,
      locale: input.locale,
    });
    const session = await projectAuthoringSessionRepository.supersedeCurrentTurn({
      sessionId: input.sessionRecord.id,
      expectedVersion: input.body.expectedVersion,
      supersededTurnId: currentTurnId,
      newTurn: {
        id: randomUUID(),
        sessionId: input.sessionRecord.id,
        parentTurnId: currentTurnId,
        stage: 'COMPONENTS',
        kind: listTurn.kind,
        status: 'PROPOSED',
        payload: listTurn.payload,
        explanation: generated.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        componentWorkingState: nextComponentState,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
    });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  if (
    (turn.stage === 'STEPS_OVERVIEW' || turn.stage === 'STEP_REVIEW') &&
    input.sessionRecord.stepReviewMode !== 'STEP_BY_STEP'
  ) {
    const currentSteps = stepsFromPayload(turn.payload as Record<string, unknown>);
    let generated;
    let stepContentLocale = input.locale;
    try {
      const listContext = await buildStepAuthoringContext({
        project: input.project,
        conversationId: input.sessionRecord.conversationId,
        sessionId: input.sessionRecord.id,
        uiLocale: input.locale,
      });
      stepContentLocale = listContext.locale;
      generated = await generateAlternativeSequentialStepPlanWithRepair({
        ...listContext,
        previousSteps: currentSteps as SequentialStep[],
      });
      const validated = validateAuthoringStepPlanForSession({
        project: input.project,
        steps: generated.steps,
        ideaText: listContext.ideaText,
        contentLocale: listContext.locale,
      });
      if (!validated.ok) {
        throw new AppError(validated.issues.join(' '), 502, validated.code);
      }
      generated = { ...generated, steps: validated.sequential };
    } catch (error) {
      if (error instanceof AppError && error.code === 'AI_STEP_PLAN_IDENTICAL') {
        throw error;
      }
      throw new AppError(
        input.locale === 'ar'
          ? 'تعذّر على المساعد إنشاء خطة خطوات صالحة. أعد المحاولة.'
          : 'The assistant could not create a valid step plan. Retry.',
        502,
        'AI_STEP_PROPOSAL_INVALID',
        { cause: error },
      );
    }
    const consistency = validateComponentStepConsistency({
      components: projectComponentsAsSequential(input.project) as PolicySequentialComponent[],
      steps: generated.steps,
      constraints: [],
    });
    if (!consistency.ok) {
      throw new AppError(consistency.issues.join(' '), 409, consistency.code);
    }
    const nextStepState = stepState
      ? { ...stepState, workingSteps: generated.steps }
      : initStepWorkingState(generated.steps, 'FULL_PLAN', turn.id);
    const planTurn = buildStepPlanTurn({
      steps: generated.steps,
      locale: stepContentLocale,
    });
    const session = await projectAuthoringSessionRepository.supersedeCurrentTurn({
      sessionId: input.sessionRecord.id,
      expectedVersion: input.body.expectedVersion,
      supersededTurnId: currentTurnId,
      newTurn: {
        id: randomUUID(),
        sessionId: input.sessionRecord.id,
        parentTurnId: currentTurnId,
        stage: 'STEPS_OVERVIEW',
        kind: planTurn.kind,
        status: 'PROPOSED',
        payload: planTurn.payload,
        explanation: generated.explanation,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
      sessionPatch: {
        stepWorkingState: nextStepState,
        baseProjectUpdatedAt: input.project.updatedAt,
      },
    });
    return buildAuthoringSessionResponse({ session, project: input.project });
  }

  const alternative = await generateAlternativeStageDiscussionWithRepair({
    locale: input.locale,
    stage: turn.stage,
    comment: '',
    currentProposal: turn.payload as never,
    explanation: turn.explanation ?? '',
    projectTitle: input.project.title,
    projectShortDescription: input.project.shortDescription,
    projectDescription: input.project.description,
    canonicalSavedValue: canonicalScalarForStage(input.project, turn.stage),
    repairAttempt: false,
    suggestAnother: true,
  });
  if (alternative.replyType !== 'REVISED_SUGGESTION') {
    throw new AppError(
      input.locale === 'ar'
        ? 'تعذر إنشاء اقتراح بديل.'
        : 'Could not produce an alternative suggestion.',
      502,
      'AI_RESPONSE_INVALID',
    );
  }
  const session = await projectAuthoringSessionRepository.supersedeCurrentTurn({
    sessionId: input.sessionRecord.id,
    expectedVersion: input.body.expectedVersion,
    supersededTurnId: currentTurnId,
    newTurn: {
      id: randomUUID(),
      sessionId: input.sessionRecord.id,
      parentTurnId: currentTurnId,
      stage: turn.stage,
      kind: 'STAGE_PROPOSAL',
      status: 'PROPOSED',
      payload: { value: alternative.suggestion.value },
      explanation:
        input.locale === 'ar'
          ? 'اقتراح بديل مختلف عن السابق.'
          : 'A materially different alternative suggestion.',
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      baseProjectUpdatedAt: input.project.updatedAt,
    },
  });
  return buildAuthoringSessionResponse({ session, project: input.project });
};

const handleRevisitStage = async (input: {
  sessionRecord: NonNullable<Awaited<ReturnType<typeof projectAuthoringSessionRepository.findByIdForOwner>>>;
  project: ProjectRecord;
  locale: AiLocale;
  body: PersistedActionBody;
}): Promise<AuthoringSessionResponse> => {
  assertActionAllowed(input.sessionRecord.stage === 'FINAL_REVIEW', input.locale);
  const targetStage = input.body.targetStage as ProjectAuthoringSessionStage | undefined;
  if (!targetStage || !STAGE_ORDER.includes(targetStage)) {
    throw new AppError('Target stage is required.', 400, 'VALIDATION_ERROR');
  }

  const proposal = await createStageProposalTurn({
    session: input.sessionRecord,
    project: input.project,
    locale: input.locale,
    stage: targetStage,
  });
  const session = await projectAuthoringSessionRepository.setCurrentTurn({
    sessionId: input.sessionRecord.id,
    expectedVersion: input.body.expectedVersion,
    turn: {
      id: randomUUID(),
      sessionId: input.sessionRecord.id,
      stage: targetStage,
      kind: proposal.kind,
      status: 'PROPOSED',
      payload: proposal.payload,
      explanation: proposal.explanation,
      baseProjectUpdatedAt: input.project.updatedAt,
    },
    sessionPatch: {
      stage: targetStage,
      status: 'WAITING_FOR_USER',
      baseProjectUpdatedAt: input.project.updatedAt,
    },
  });
  return buildAuthoringSessionResponse({ session, project: input.project });
};

export const executePersistedAuthoringAction = async (
  userId: string,
  sessionId: string,
  body: PersistedActionBody,
): Promise<AuthoringSessionResponse> => {
  const sessionRecord = await projectAuthoringSessionRepository.findByIdForOwner(
    sessionId,
    userId,
  );
  if (!sessionRecord) {
    throw new AppError('Authoring session not found.', 404, 'AI_AUTHORING_SESSION_NOT_FOUND');
  }
  const { conversation, project } = await loadProjectForConversation(
    userId,
    sessionRecord.conversationId,
  );
  assertPersistedAuthoringContext({
    conversationId: sessionRecord.conversationId,
    conversation,
    session: sessionRecord,
    project,
    userId,
  });
  const locale = (conversation.locale === 'ar' ? 'ar' : 'en') as AiLocale;

  if (
    sessionRecord.status === 'STALE' &&
    body.action !== 'REGENERATE_FAILED_STAGE'
  ) {
    throw new AppError(
      locale === 'ar' ? 'تغيّرت المسودة بعد هذا الاقتراح.' : 'The draft changed after this suggestion.',
      409,
      'AI_AUTHORING_PROPOSAL_STALE',
    );
  }

  if (body.action === 'FINISH') {
    if (sessionRecord.status === 'COMPLETE' && sessionRecord.stage === 'COMPLETE') {
      return buildAuthoringSessionResponse({ session: sessionRecord, project });
    }
    const refreshed = await projectAuthoringSessionRepository.updateSession({
      sessionId: sessionRecord.id,
      expectedVersion: body.expectedVersion,
      patch: {
        stage: 'COMPLETE',
        status: 'COMPLETE',
        currentTurnId: null,
      },
    });
    return buildAuthoringSessionResponse({ session: refreshed, project });
  }

  if (body.action === 'REGENERATE_FAILED_STAGE') {
    return handleRegenerateFailedStage({
      userId,
      sessionRecord,
      project,
      locale,
      body,
    });
  }

  if (body.action === 'SAVE_MANUAL') {
    return handleSaveManual({ userId, sessionRecord, project, locale, body });
  }

  if (body.action === 'CHOOSE_COMPONENT_MODE') {
    return handleChooseComponentMode({ sessionRecord, project, locale, body });
  }

  if (body.action === 'CHOOSE_STEP_MODE') {
    return handleChooseStepMode({ sessionRecord, project, locale, body });
  }

  if (
    body.action === 'ACCEPT_CURRENT' ||
    body.action === 'ACCEPT_COMPONENT_ITEM' ||
    body.action === 'ACCEPT_STEP_ITEM' ||
    body.action === 'FINALIZE_COMPONENTS' ||
    body.action === 'FINALIZE_STEPS'
  ) {
    if (body.action === 'FINALIZE_COMPONENTS') {
      assertActionAllowed(
        parseComponentWorkingState(sessionRecord.componentWorkingState)?.awaitingFinalSave === true,
        locale,
      );
    }
    if (body.action === 'FINALIZE_STEPS') {
      assertActionAllowed(
        parseStepWorkingState(sessionRecord.stepWorkingState)?.awaitingFinalSave === true,
        locale,
      );
    }
    if (body.action === 'ACCEPT_COMPONENT_ITEM') {
      assertActionAllowed(
        sessionRecord.stage === 'COMPONENTS' &&
          parseComponentWorkingState(sessionRecord.componentWorkingState)?.mode === 'ONE_BY_ONE',
        locale,
      );
    }
    if (body.action === 'ACCEPT_STEP_ITEM') {
      assertActionAllowed(
        sessionRecord.stage === 'STEP_REVIEW' &&
          parseStepWorkingState(sessionRecord.stepWorkingState)?.mode === 'STEP_BY_STEP',
        locale,
      );
    }
    return handleAcceptCurrent({ userId, sessionRecord, project, locale, body });
  }

  if (body.action === 'SUGGEST_ANOTHER') {
    return handleSuggestAnother({ sessionRecord, project, locale, body });
  }

  if (body.action === 'REMOVE_COMPONENT_ITEM') {
    return mutateComponentWorking({
      sessionRecord,
      project,
      locale,
      body,
      action: 'REMOVE',
    });
  }
  if (body.action === 'ADD_COMPONENT_ITEM') {
    return mutateComponentWorking({
      sessionRecord,
      project,
      locale,
      body,
      action: 'ADD',
    });
  }
  if (body.action === 'BACK_COMPONENT_ITEM') {
    return mutateComponentWorking({
      sessionRecord,
      project,
      locale,
      body,
      action: 'BACK',
    });
  }

  if (body.action === 'REMOVE_STEP_ITEM') {
    return mutateStepWorking({ sessionRecord, project, locale, body, action: 'REMOVE' });
  }
  if (body.action === 'ADD_STEP_ITEM') {
    return mutateStepWorking({ sessionRecord, project, locale, body, action: 'ADD' });
  }
  if (body.action === 'BACK_STEP_ITEM') {
    return mutateStepWorking({ sessionRecord, project, locale, body, action: 'BACK' });
  }

  if (body.action === 'EXPLAIN_STEP') {
    assertActionAllowed(
      sessionRecord.stage === 'STEP_REVIEW' &&
        parseStepWorkingState(sessionRecord.stepWorkingState)?.mode === 'STEP_BY_STEP',
      locale,
    );
    const stepState = parseStepWorkingState(sessionRecord.stepWorkingState);
    if (!stepState) {
      throw new AppError('Step review state is missing.', 409, 'VALIDATION_ERROR');
    }
    const currentStep = stepState.workingSteps[stepState.currentIndex];
    if (!currentStep) {
      throw new AppError('Current step is missing.', 409, 'VALIDATION_ERROR');
    }
    const explainPrompt =
      locale === 'ar' ? 'اشرح هذه الخطوة أكثر' : 'Explain this step in more detail';
    const userMessage = await createUserMessage({
      conversationId: sessionRecord.conversationId,
      contentText: explainPrompt,
      clientMessageId: `explain-step-${randomUUID()}`,
      locale,
    });
    const listContext = await buildStepAuthoringContext({
      project,
      conversationId: sessionRecord.conversationId,
      sessionId: sessionRecord.id,
      uiLocale: locale,
      userComment: explainPrompt,
      sessionRecord,
    });
    const history = await loadAuthoringConversationHistory(sessionRecord.conversationId, 24);
    const assistantText = await generateStepsConversationExplanation({
      locale,
      comment: explainPrompt,
      history,
      context: listContext,
      currentSteps: stepState.workingSteps,
      intent: 'EXPLAIN_CURRENT_PLAN',
      focusStepIndex: stepState.currentIndex,
    });
    await createAssistantMessage({
      conversationId: sessionRecord.conversationId,
      inReplyToMessageId: userMessage.id,
      status: 'COMPLETED',
      contentBlocks: [
        {
          type: 'text',
          text: assistantText,
          purpose: 'answer',
        },
      ],
      scopeClassification: 'DOMAIN_KNOWLEDGE',
      locale,
      provider: env.aiChatProvider,
      model: null,
      policyVersion: 'project-authoring-sequential-v1',
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
    });
    await touchConversationActivity({
      conversationId: sessionRecord.conversationId,
      locale,
      title: project.title,
    });
    const refreshed = await projectAuthoringSessionRepository.findByIdForOwner(sessionId, userId);
    const messages = await loadRecentConversationMessages({
      conversationId: sessionRecord.conversationId,
      limit: env.aiChatMaxHistoryMessages,
    });
    const conversationMessages = messages.map((message) => {
      const blocks = message.contentBlocks
        ? parseStoredContentBlocks(message.contentBlocks)
        : [];
      const textFromBlocks = blocks
        .filter((block) => block.type === 'text' && 'text' in block)
        .map((block) => block.text)
        .join('\n\n')
        .trim();
      return {
        id: message.id,
        role: message.role,
        status: message.status,
        contentText: message.contentText ?? (textFromBlocks || null),
        contentBlocks: blocks,
        createdAt: message.createdAt.toISOString(),
      };
    });
    return {
      ...buildAuthoringSessionResponse({ session: refreshed!, project }),
      conversationMessages,
    };
  }

  if (body.action === 'REVISIT_STAGE') {
    return handleRevisitStage({ sessionRecord, project, locale, body });
  }

  throw new AppError('Unsupported action.', 400, 'VALIDATION_ERROR');
};
