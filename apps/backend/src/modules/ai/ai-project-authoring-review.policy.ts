import { randomUUID } from 'node:crypto';

import {
  normalizeSubmitComponent,
  type NormalizedSubmitComponent,
} from '../learning-projects/learning-projects.submit-components.js';

import {
  type AiProjectAuthoringProposalBlock,
  type AiProjectAuthoringProposalDiffBlock,
  type AiProjectAuthoringReviewStateBlock,
  AUTHORING_REVIEW_DECISIONS,
  AUTHORING_REVIEW_FIELD_TARGETS,
  AUTHORING_REVIEW_SECTION_TARGETS,
} from './ai.content-blocks.js';
import {
  MAX_PROPOSAL_COMPONENTS,
  MAX_PROPOSAL_STEPS,
  MIN_PROPOSAL_COMPONENTS,
  MIN_PROPOSAL_STEPS,
  validateAuthoringProposalQuality,
  type NormalizedAuthoringProposalProviderPayload,
} from './ai-project-authoring-proposal.policy.js';
import type { AiLocale } from './ai.types.js';

export type AuthoringReviewDecision = (typeof AUTHORING_REVIEW_DECISIONS)[number];

export type AuthoringReviewTarget =
  | (typeof AUTHORING_REVIEW_FIELD_TARGETS)[number]
  | (typeof AUTHORING_REVIEW_SECTION_TARGETS)[number];

export type DraftProjectSnapshot = {
  title: string;
  shortDescription: string;
  description: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDurationMinutes: number | null;
  requiredComponents: Array<{
    componentName: string;
    materialType: string;
    quantity: number;
    unit: string;
    componentRole: string;
    isRequired: boolean;
    canBeSubstituted: boolean;
    searchKeywords: string[];
    notes: string | null;
  }>;
  steps: Array<{ title: string; description: string }>;
};

const LOCKED_DECISIONS = new Set<AuthoringReviewDecision>([
  'ACCEPT_PROPOSAL',
  'KEEP_CURRENT',
]);

export const isDiscussionDecision = (decision: AuthoringReviewDecision) =>
  decision === 'UNDER_DISCUSSION' ||
  decision === 'REVISION_REQUESTED' ||
  decision === 'NEEDS_REVISION';

export const normalizeReviewDecision = (
  decision: AuthoringReviewDecision,
): AuthoringReviewDecision =>
  decision === 'NEEDS_REVISION' ? 'REVISION_REQUESTED' : decision;

export const isLockedDecision = (decision: AuthoringReviewDecision) =>
  LOCKED_DECISIONS.has(decision);

export const defaultFieldDecisions = () => ({
  title: 'UNREVIEWED' as const,
  shortDescription: 'UNREVIEWED' as const,
  description: 'UNREVIEWED' as const,
  difficulty: 'UNREVIEWED' as const,
  estimatedMinutes: 'UNREVIEWED' as const,
});

export const defaultReviewState = (input: {
  proposalId: string;
  baseUpdatedAt: string;
}): AiProjectAuthoringReviewStateBlock => {
  const now = new Date().toISOString();
  return {
    type: 'project_authoring_review_state',
    reviewStateId: randomUUID(),
    proposalId: input.proposalId,
    baseUpdatedAt: input.baseUpdatedAt,
    status: 'IN_REVIEW',
    fieldDecisions: defaultFieldDecisions(),
    componentDecision: 'UNREVIEWED',
    stepDecision: 'UNREVIEWED',
    lockedTargets: [],
    revisionRequests: [],
    resolvedProposalId: null,
    createdAt: now,
    updatedAt: now,
  };
};

export const computeLockedTargets = (
  state: Pick<
    AiProjectAuthoringReviewStateBlock,
    'fieldDecisions' | 'componentDecision' | 'stepDecision'
  >,
): AuthoringReviewTarget[] => {
  const locked: AuthoringReviewTarget[] = [];
  for (const target of AUTHORING_REVIEW_FIELD_TARGETS) {
    if (isLockedDecision(state.fieldDecisions[target])) {
      locked.push(target);
    }
  }
  if (isLockedDecision(state.componentDecision)) {
    locked.push('components');
  }
  if (isLockedDecision(state.stepDecision)) {
    locked.push('steps');
  }
  return locked;
};

export const applyReviewDecision = (input: {
  state: AiProjectAuthoringReviewStateBlock;
  target: AuthoringReviewTarget;
  decision: Exclude<AuthoringReviewDecision, 'UNREVIEWED'>;
  comment?: string | null;
}): AiProjectAuthoringReviewStateBlock => {
  const now = new Date().toISOString();
  const next: AiProjectAuthoringReviewStateBlock = {
    ...input.state,
    reviewStateId: randomUUID(),
    createdAt: now,
    updatedAt: now,
    revisionRequests: [...input.state.revisionRequests],
    lockedTargets: [],
    status: 'IN_REVIEW',
    resolvedProposalId: null,
  };

  if (
    (AUTHORING_REVIEW_FIELD_TARGETS as readonly string[]).includes(input.target)
  ) {
    const field = input.target as (typeof AUTHORING_REVIEW_FIELD_TARGETS)[number];
    const storedDecision =
      input.decision === 'NEEDS_REVISION' ? 'REVISION_REQUESTED' : input.decision;
    next.fieldDecisions = {
      ...next.fieldDecisions,
      [field]: storedDecision,
    };
  } else if (input.target === 'components') {
    next.componentDecision =
      input.decision === 'NEEDS_REVISION' ? 'REVISION_REQUESTED' : input.decision;
  } else {
    next.stepDecision =
      input.decision === 'NEEDS_REVISION' ? 'REVISION_REQUESTED' : input.decision;
  }

  if (input.decision === 'NEEDS_REVISION' || input.decision === 'REVISION_REQUESTED') {
    const comment = input.comment?.trim();
    if (!comment || comment.length < 8) {
      throw new Error('revision_comment_required');
    }
    next.revisionRequests = [
      ...next.revisionRequests.filter((entry) => entry.target !== input.target),
      { target: input.target, comment, status: 'OPEN' as const },
    ];
  } else {
    next.revisionRequests = next.revisionRequests.filter(
      (entry) => entry.target !== input.target,
    );
  }

  next.lockedTargets = computeLockedTargets(next);
  next.status = evaluateReviewStatus(next);
  return next;
};

export const applyDiscussionComment = (input: {
  state: AiProjectAuthoringReviewStateBlock;
  target: AuthoringReviewTarget;
  comment: string;
}): AiProjectAuthoringReviewStateBlock => {
  const trimmed = input.comment.trim();
  if (trimmed.length < 8) {
    throw new Error('revision_comment_required');
  }

  const ambiguous =
    trimmed.length < 24 &&
    !/\d/.test(trimmed) &&
    !/(remove|add|replace|without|led|pump|relay|arduino|مضخة|إزالة|إضافة)/i.test(
      trimmed,
    );
  const decision: AuthoringReviewDecision = ambiguous
    ? 'UNDER_DISCUSSION'
    : 'REVISION_REQUESTED';

  const now = new Date().toISOString();
  const next: AiProjectAuthoringReviewStateBlock = {
    ...input.state,
    reviewStateId: randomUUID(),
    createdAt: now,
    updatedAt: now,
    revisionRequests: [
      ...input.state.revisionRequests.filter((entry) => entry.target !== input.target),
      { target: input.target, comment: trimmed, status: 'OPEN' as const },
    ],
    lockedTargets: [],
    status: 'IN_REVIEW',
    resolvedProposalId: null,
  };

  if (
    (AUTHORING_REVIEW_FIELD_TARGETS as readonly string[]).includes(input.target)
  ) {
    const field = input.target as (typeof AUTHORING_REVIEW_FIELD_TARGETS)[number];
    next.fieldDecisions = { ...next.fieldDecisions, [field]: decision };
  } else if (input.target === 'components') {
    next.componentDecision = decision;
  } else {
    next.stepDecision = decision;
  }

  next.lockedTargets = computeLockedTargets(next);
  next.status = evaluateReviewStatus(next);
  return next;
};

export const countReviewProgress = (
  state: Pick<
    AiProjectAuthoringReviewStateBlock,
    'fieldDecisions' | 'componentDecision' | 'stepDecision'
  >,
) => {
  const decisions = [
    state.fieldDecisions.title,
    state.fieldDecisions.shortDescription,
    state.fieldDecisions.description,
    state.fieldDecisions.difficulty,
    state.fieldDecisions.estimatedMinutes,
    state.componentDecision,
    state.stepDecision,
  ].map(normalizeReviewDecision);

  const resolved = decisions.filter(isResolvedDecision).length;
  const needsDiscussion = decisions.filter(isDiscussionDecision).length;
  const unreviewed = decisions.filter((decision) => decision === 'UNREVIEWED').length;

  return {
    total: 7,
    resolved,
    needsDiscussion,
    unreviewed,
  };
};

export const unlockReviewTarget = (input: {
  state: AiProjectAuthoringReviewStateBlock;
  target: AuthoringReviewTarget;
}): AiProjectAuthoringReviewStateBlock => {
  const now = new Date().toISOString();
  const next: AiProjectAuthoringReviewStateBlock = {
    ...input.state,
    reviewStateId: randomUUID(),
    createdAt: now,
    updatedAt: now,
    revisionRequests: input.state.revisionRequests.filter(
      (entry) => entry.target !== input.target,
    ),
    status: 'IN_REVIEW',
    resolvedProposalId: null,
  };

  if (
    (AUTHORING_REVIEW_FIELD_TARGETS as readonly string[]).includes(input.target)
  ) {
    const field = input.target as (typeof AUTHORING_REVIEW_FIELD_TARGETS)[number];
    next.fieldDecisions = { ...next.fieldDecisions, [field]: 'UNREVIEWED' };
  } else if (input.target === 'components') {
    next.componentDecision = 'UNREVIEWED';
  } else {
    next.stepDecision = 'UNREVIEWED';
  }

  next.lockedTargets = computeLockedTargets(next);
  return next;
};

const isResolvedDecision = (decision: AuthoringReviewDecision) =>
  decision === 'ACCEPT_PROPOSAL' || decision === 'KEEP_CURRENT';

export const evaluateReviewStatus = (
  state: Pick<
    AiProjectAuthoringReviewStateBlock,
    | 'fieldDecisions'
    | 'componentDecision'
    | 'stepDecision'
    | 'revisionRequests'
  > & { status?: AiProjectAuthoringReviewStateBlock['status'] },
): AiProjectAuthoringReviewStateBlock['status'] => {
  if (state.status === 'APPLIED') {
    return 'APPLIED';
  }

  const fieldValues = AUTHORING_REVIEW_FIELD_TARGETS.map(
    (target) => state.fieldDecisions[target],
  );
  const allResolved =
    fieldValues.every(isResolvedDecision) &&
    isResolvedDecision(state.componentDecision) &&
    isResolvedDecision(state.stepDecision);

  const hasOpenRevision =
    state.revisionRequests.some((entry) => entry.status === 'OPEN') ||
    fieldValues.some(isDiscussionDecision) ||
    isDiscussionDecision(state.componentDecision) ||
    isDiscussionDecision(state.stepDecision) ||
    fieldValues.some((decision) => decision === 'UNREVIEWED') ||
    state.componentDecision === 'UNREVIEWED' ||
    state.stepDecision === 'UNREVIEWED';

  if (allResolved && !hasOpenRevision) {
    return 'READY_TO_APPLY';
  }

  if (
    fieldValues.some(isDiscussionDecision) ||
    isDiscussionDecision(state.componentDecision) ||
    isDiscussionDecision(state.stepDecision) ||
    state.revisionRequests.some((entry) => entry.status === 'OPEN')
  ) {
    return 'DISCUSSION_NEEDED';
  }

  return 'IN_REVIEW';
};

export const markReviewStateApplied = (
  state: AiProjectAuthoringReviewStateBlock,
): AiProjectAuthoringReviewStateBlock => ({
  ...state,
  status: 'APPLIED',
  updatedAt: new Date().toISOString(),
});

export const reviewStateFingerprint = (
  state: AiProjectAuthoringReviewStateBlock,
) =>
  JSON.stringify({
    proposalId: state.proposalId,
    fieldDecisions: state.fieldDecisions,
    componentDecision: state.componentDecision,
    stepDecision: state.stepDecision,
    revisionRequests: state.revisionRequests,
  });

export const proposalComponentsToSubmit = (
  proposal: AiProjectAuthoringProposalBlock,
): NormalizedSubmitComponent[] =>
  proposal.requiredComponents.map((component) =>
    normalizeSubmitComponent({
      name: component.componentName,
      quantity: component.quantity,
      unit: component.unit,
      componentRole: component.componentRole,
      isRequired: component.isRequired,
      canBeSubstituted: component.canBeSubstituted,
      notes: component.notes,
      materialType: component.materialType,
      searchKeywords: [
        ...component.searchKeywords,
        ...component.alternativeKeywords,
      ],
    }),
  );

export const draftComponentsToSubmit = (
  draft: DraftProjectSnapshot,
): NormalizedSubmitComponent[] =>
  draft.requiredComponents.map((component) =>
    normalizeSubmitComponent({
      name: component.componentName,
      quantity: Number(component.quantity),
      unit: component.unit,
      componentRole: component.componentRole as NormalizedSubmitComponent['componentRole'],
      isRequired: component.isRequired,
      canBeSubstituted: component.canBeSubstituted,
      notes: component.notes ?? undefined,
      materialType: component.materialType,
      searchKeywords: component.searchKeywords,
    }),
  );

export const buildMergedDraftInput = (input: {
  review: AiProjectAuthoringReviewStateBlock;
  proposal: AiProjectAuthoringProposalBlock;
  draft: DraftProjectSnapshot;
}) => {
  const { review, proposal, draft } = input;
  const pickField = <T extends keyof AiProjectAuthoringProposalBlock['project']>(
    target: (typeof AUTHORING_REVIEW_FIELD_TARGETS)[number],
    proposalValue: AiProjectAuthoringProposalBlock['project'][T],
    draftValue: T extends 'estimatedMinutes'
      ? number | null | undefined
      : string,
  ) => {
    const decision = review.fieldDecisions[target];
    if (decision === 'ACCEPT_PROPOSAL') {
      return proposalValue;
    }
    if (decision === 'KEEP_CURRENT') {
      return draftValue;
    }
    throw new Error(`unresolved_field:${target}`);
  };

  const title = pickField('title', proposal.project.title, draft.title);
  const shortDescription = pickField(
    'shortDescription',
    proposal.project.shortDescription,
    draft.shortDescription,
  );
  const description = pickField(
    'description',
    proposal.project.description,
    draft.description,
  );
  const difficulty = pickField(
    'difficulty',
    proposal.project.difficulty,
    draft.difficulty,
  );
  const estimatedMinutes = pickField(
    'estimatedMinutes',
    proposal.project.estimatedMinutes ?? undefined,
    draft.estimatedDurationMinutes ?? undefined,
  );

  const requiredComponents =
    review.componentDecision === 'ACCEPT_PROPOSAL'
      ? proposalComponentsToSubmit(proposal)
      : review.componentDecision === 'KEEP_CURRENT'
        ? draftComponentsToSubmit(draft)
        : (() => {
            throw new Error('unresolved_section:components');
          })();

  const steps =
    review.stepDecision === 'ACCEPT_PROPOSAL'
      ? proposal.steps
      : review.stepDecision === 'KEEP_CURRENT'
        ? draft.steps
        : (() => {
            throw new Error('unresolved_section:steps');
          })();

  return {
    title,
    shortDescription,
    description,
    difficulty,
    estimatedDurationMinutes:
      estimatedMinutes === null || estimatedMinutes === undefined
        ? undefined
        : Number(estimatedMinutes),
    requiredComponents,
    steps,
  };
};

export const validateFinalMergedProject = (input: {
  merged: ReturnType<typeof buildMergedDraftInput>;
  review: AiProjectAuthoringReviewStateBlock;
  proposal: AiProjectAuthoringProposalBlock;
  draft: DraftProjectSnapshot;
  locale: AiLocale;
  ideaText: string;
  categoryName: string;
  clarificationSummary: string;
}) => {
  const issues: string[] = [];

  if (input.merged.requiredComponents.length < MIN_PROPOSAL_COMPONENTS) {
    issues.push('Final project must include at least one component.');
  }
  if (input.merged.requiredComponents.length > MAX_PROPOSAL_COMPONENTS) {
    issues.push('Final project has too many components.');
  }
  if (input.merged.steps.length < MIN_PROPOSAL_STEPS) {
    issues.push('Final project must include at least three steps.');
  }
  if (input.merged.steps.length > MAX_PROPOSAL_STEPS) {
    issues.push('Final project has too many steps.');
  }

  const names = new Set<string>();
  for (const component of input.merged.requiredComponents) {
    const key = component.name.trim().toLowerCase();
    if (names.has(key)) {
      issues.push('Final component names must be unique.');
      break;
    }
    names.add(key);
  }

  if (input.review.componentDecision === 'ACCEPT_PROPOSAL') {
    const normalized: NormalizedAuthoringProposalProviderPayload = {
      project: {
        title: input.proposal.project.title,
        shortDescription: input.proposal.project.shortDescription,
        description: input.proposal.project.description,
        difficulty: input.proposal.project.difficulty,
        estimatedMinutes: input.proposal.project.estimatedMinutes,
      },
      requiredComponents: input.proposal.requiredComponents.map((component) => ({
        componentName: component.componentName,
        materialType: component.materialType,
        quantity: component.quantity,
        unit: component.unit,
        componentRole: component.componentRole,
        isRequired: component.isRequired,
        canBeSubstituted: component.canBeSubstituted,
        searchKeywords: component.searchKeywords,
        alternativeKeywords: component.alternativeKeywords,
        notes: component.notes,
      })),
      steps: input.proposal.steps,
      assumptions: input.proposal.assumptions,
      warnings: input.proposal.warnings,
      safetyConsiderations: input.proposal.safetyConsiderations,
      assistantText: 'validation',
    };
    const quality = validateAuthoringProposalQuality(normalized, {
      locale: input.locale,
      ideaText: input.ideaText,
      categoryName: input.categoryName,
      draftDifficulty: input.draft.difficulty,
      clarification: {
        type: 'project_authoring_clarification' as const,
        summary: input.clarificationSummary,
        knownFacts: [],
        assumptions: [],
        warnings: [],
        status: 'READY_FOR_PROPOSAL' as const,
        nextQuestion: null,
        remainingTopics: 0,
      },
      recentAuthoringAnswers: [],
    });
    if (!quality.ok) {
      issues.push(...quality.issues);
    }
  }

  return issues;
};

const componentNames = (proposal: AiProjectAuthoringProposalBlock) =>
  proposal.requiredComponents.map((component) => component.componentName);

const stepTitles = (proposal: AiProjectAuthoringProposalBlock) =>
  proposal.steps.map((step) => step.title);

export const deriveProposalDiff = (input: {
  from: AiProjectAuthoringProposalBlock;
  to: AiProjectAuthoringProposalBlock;
}): AiProjectAuthoringProposalDiffBlock => {
  const changedTargets: AuthoringReviewTarget[] = [];
  const fieldChanges: AiProjectAuthoringProposalDiffBlock['fieldChanges'] = [];

  for (const target of AUTHORING_REVIEW_FIELD_TARGETS) {
    const before =
      target === 'estimatedMinutes'
        ? String(input.from.project.estimatedMinutes ?? '')
        : String(input.from.project[target]);
    const after =
      target === 'estimatedMinutes'
        ? String(input.to.project.estimatedMinutes ?? '')
        : String(input.to.project[target]);
    if (before !== after) {
      changedTargets.push(target);
      fieldChanges.push({ target, before, after });
    }
  }

  const fromComponents = new Set(componentNames(input.from));
  const toComponents = new Set(componentNames(input.to));
  const added = [...toComponents].filter((name) => !fromComponents.has(name));
  const removed = [...fromComponents].filter((name) => !toComponents.has(name));
  const updated = [...toComponents].filter((name) => {
    if (!fromComponents.has(name)) {
      return false;
    }
    const fromComponent = input.from.requiredComponents.find(
      (entry) => entry.componentName === name,
    );
    const toComponent = input.to.requiredComponents.find(
      (entry) => entry.componentName === name,
    );
    return JSON.stringify(fromComponent) !== JSON.stringify(toComponent);
  });

  if (added.length > 0 || removed.length > 0 || updated.length > 0) {
    changedTargets.push('components');
  }

  const fromSteps = stepTitles(input.from);
  const toSteps = stepTitles(input.to);
  const stepAdded = toSteps.filter((title) => !fromSteps.includes(title));
  const stepRemoved = fromSteps.filter((title) => !toSteps.includes(title));
  const stepUpdated = toSteps.filter((title) => {
    if (!fromSteps.includes(title)) {
      return false;
    }
    const fromStep = input.from.steps.find((step) => step.title === title);
    const toStep = input.to.steps.find((step) => step.title === title);
    return fromStep?.description !== toStep?.description;
  });
  const reordered =
    fromSteps.length === toSteps.length &&
    fromSteps.join('|') !== toSteps.join('|') &&
    stepAdded.length === 0 &&
    stepRemoved.length === 0;

  if (stepAdded.length > 0 || stepRemoved.length > 0 || stepUpdated.length > 0 || reordered) {
    changedTargets.push('steps');
  }

  return {
    type: 'project_authoring_proposal_diff',
    fromProposalId: input.from.proposalId,
    toProposalId: input.to.proposalId,
    changedTargets,
    fieldChanges,
    componentChanges: { added, removed, updated },
    stepChanges: {
      added: stepAdded,
      removed: stepRemoved,
      updated: stepUpdated,
      reordered,
    },
  };
};

export const assertLockedProposalValues = (input: {
  parent: AiProjectAuthoringProposalBlock;
  revised: NormalizedAuthoringProposalProviderPayload;
  review: AiProjectAuthoringReviewStateBlock;
  draft: DraftProjectSnapshot;
}) => {
  const issues: string[] = [];
  const locked = new Set(input.review.lockedTargets);

  for (const target of AUTHORING_REVIEW_FIELD_TARGETS) {
    if (!locked.has(target)) {
      continue;
    }
    const decision = input.review.fieldDecisions[target];
    const expected =
      decision === 'ACCEPT_PROPOSAL'
        ? target === 'estimatedMinutes'
          ? String(input.parent.project.estimatedMinutes ?? '')
          : String(input.parent.project[target])
        : target === 'estimatedMinutes'
          ? String(input.draft.estimatedDurationMinutes ?? '')
          : String(input.draft[target as keyof DraftProjectSnapshot] ?? '');
    const actual =
      target === 'estimatedMinutes'
        ? String(input.revised.project.estimatedMinutes ?? '')
        : String(input.revised.project[target]);
    if (expected !== actual) {
      issues.push(`Locked field changed during revision: ${target}`);
    }
  }

  if (locked.has('components')) {
    const expectedNames =
      input.review.componentDecision === 'KEEP_CURRENT'
        ? input.draft.requiredComponents.map((component) => component.componentName)
        : componentNames(input.parent);
    const actualNames = input.revised.requiredComponents.map(
      (component) => component.componentName,
    );
    if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) {
      issues.push('Locked components changed during revision.');
    }
  }

  if (locked.has('steps') && !isDiscussionDecision(input.review.stepDecision)) {
    const expectedTitles =
      input.review.stepDecision === 'KEEP_CURRENT'
        ? input.draft.steps.map((step) => step.title)
        : stepTitles(input.parent);
    const actualTitles = input.revised.steps.map((step) => step.title);
    if (JSON.stringify(expectedTitles) !== JSON.stringify(actualTitles)) {
      issues.push('Locked steps changed during revision.');
    }
  }

  return issues;
};

export const carryForwardReviewAfterRevision = (input: {
  previous: AiProjectAuthoringReviewStateBlock;
  newProposalId: string;
  revisedTargets: AuthoringReviewTarget[];
}): AiProjectAuthoringReviewStateBlock => {
  const now = new Date().toISOString();
  const next: AiProjectAuthoringReviewStateBlock = {
    ...input.previous,
    reviewStateId: randomUUID(),
    proposalId: input.newProposalId,
    createdAt: now,
    updatedAt: now,
    revisionRequests: input.previous.revisionRequests.map((entry) =>
      input.revisedTargets.includes(entry.target)
        ? { ...entry, status: 'RESOLVED' as const }
        : entry,
    ),
    resolvedProposalId: input.newProposalId,
    status: 'IN_REVIEW',
  };

  for (const target of input.revisedTargets) {
    if (
      (AUTHORING_REVIEW_FIELD_TARGETS as readonly string[]).includes(target)
    ) {
      const field = target as (typeof AUTHORING_REVIEW_FIELD_TARGETS)[number];
      next.fieldDecisions = { ...next.fieldDecisions, [field]: 'UNREVIEWED' };
    } else if (target === 'components') {
      next.componentDecision = 'UNREVIEWED';
    } else if (target === 'steps') {
      next.stepDecision = 'UNREVIEWED';
    }
  }

  next.lockedTargets = computeLockedTargets(next);
  next.status = evaluateReviewStatus(next);
  return next;
};
