import { z } from 'zod';

import { LEARNER_SUBMIT_COMPONENT_ROLES } from '../learning-projects/learning-projects.submit-components.js';

export const aiTextBlockSchema = z.object({
  type: z.literal('text'),
  text: z.string().trim().min(1),
  purpose: z.enum(['answer', 'refusal', 'clarification', 'safety']),
});

export const aiErrorBlockSchema = z.object({
  type: z.literal('error'),
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  retryable: z.boolean(),
});

const aiMaterialCardSchema = z.object({
  materialId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  thumbnailUrl: z.string().url().nullable().optional(),
  categoryLabel: z.string().trim().min(1).optional(),
  condition: z.string().trim().min(1).optional(),
  quantityLabel: z.string().trim().min(1).optional(),
  priceLabel: z.string().trim().min(1),
  locationLabel: z.string().trim().min(1).optional(),
  distanceKm: z.number().nonnegative().nullable().optional(),
  pickupAllowed: z.boolean().optional(),
  deliveryAllowed: z.boolean().optional(),
});

export const aiMaterialResultsBlockSchema = z.object({
  type: z.literal('material_results'),
  items: z.array(aiMaterialCardSchema).min(1).max(10),
});

export const aiMaterialDetailsBlockSchema = z.object({
  type: z.literal('material_details'),
  item: aiMaterialCardSchema,
});

const aiProjectCardSchema = z.object({
  projectId: z.string().trim().min(1),
  title: z.string().trim().min(1),
  thumbnailUrl: z.string().url().nullable().optional(),
  difficulty: z.string().trim().min(1).optional(),
  estimatedTimeLabel: z.string().trim().min(1).optional(),
  interestLabels: z.array(z.string().trim().min(1)).max(6).optional(),
  savedByLearner: z.boolean().optional(),
  activeBuildId: z.string().trim().min(1).nullable().optional(),
  summary: z.string().trim().min(1).optional(),
  categoryLabel: z.string().trim().min(1).optional(),
  readinessPercent: z.number().int().min(0).max(100).optional(),
  matchedComponentCount: z.number().int().min(0).optional(),
  totalRequiredComponentCount: z.number().int().min(0).optional(),
  matchedComponents: z.array(z.string().trim().min(1)).max(20).optional(),
  missingComponents: z.array(z.string().trim().min(1)).max(20).optional(),
  matchExplanation: z.string().trim().min(1).optional(),
});

export const aiProjectResultsBlockSchema = z.object({
  type: z.literal('project_results'),
  items: z.array(aiProjectCardSchema).min(1).max(10),
});

export const aiProjectDetailsBlockSchema = z.object({
  type: z.literal('project_details'),
  item: aiProjectCardSchema.extend({
    summary: z.string().trim().min(1).optional(),
  }),
});

export const aiComponentListBlockSchema = z.object({
  type: z.literal('component_list'),
  projectId: z.string().trim().min(1),
  projectTitle: z.string().trim().min(1).optional(),
  projectImageUrl: z.string().url().nullable().optional(),
  items: z
    .array(
      z.object({
        componentId: z.string().trim().min(1),
        name: z.string().trim().min(1),
        quantity: z.number().positive(),
        unit: z.string().trim().min(1).optional(),
        required: z.boolean(),
        categoryLabel: z.string().trim().min(1).optional(),
        alternativesAllowed: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(30),
});

export const aiBuildChecklistBlockSchema = z.object({
  type: z.literal('build_checklist'),
  buildId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  readyCount: z.number().int().nonnegative(),
  totalRequired: z.number().int().nonnegative(),
  items: z
    .array(
      z.object({
        componentId: z.string().trim().min(1),
        name: z.string().trim().min(1),
        status: z.string().trim().min(1),
        readinessLabel: z.string().trim().min(1),
        linkedMaterialId: z.string().trim().min(1).nullable().optional(),
        linkedReservationId: z.string().trim().min(1).nullable().optional(),
      }),
    )
    .min(1)
    .max(40),
});

export const aiComponentMatchesBlockSchema = z.object({
  type: z.literal('component_matches'),
  buildId: z.string().trim().min(1).optional(),
  groups: z
    .array(
      z.object({
        componentId: z.string().trim().min(1),
        componentName: z.string().trim().min(1),
        materials: z.array(aiMaterialCardSchema).max(5),
      }),
    )
    .min(1)
    .max(10),
});

const aiProjectBudgetComponentLineSchema = z.object({
  componentId: z.string().trim().min(1),
  componentName: z.string().trim().min(1),
  requiredQuantity: z.number().positive(),
  requiredUnit: z.string().trim().min(1).nullable().optional(),
  status: z.enum([
    'SELECTED',
    'NO_AVAILABLE_MATCH',
    'INSUFFICIENT_QUANTITY',
    'PRICE_UNAVAILABLE',
    'UNSUPPORTED_CURRENCY',
    'UNIT_ASSUMPTION_REQUIRED',
  ]),
  selectedMaterialId: z.string().trim().min(1).nullable().optional(),
  selectedMaterialTitle: z.string().trim().min(1).nullable().optional(),
  isFree: z.boolean().nullable().optional(),
  unitPrice: z.number().nonnegative().nullable().optional(),
  effectiveComponentCost: z.number().nonnegative().nullable().optional(),
  allocatedQuantity: z.number().nonnegative().nullable().optional(),
  availableQuantity: z.number().nonnegative().nullable().optional(),
  listingUnit: z.string().trim().min(1).nullable().optional(),
  alternativesCount: z.number().int().nonnegative(),
  matchEvidence: z.string().trim().min(1).nullable().optional(),
  assumptionNote: z.string().trim().min(1).nullable().optional(),
});

export const aiProjectBudgetEstimateBlockSchema = z.object({
  type: z.literal('project_budget_estimate'),
  projectId: z.string().trim().min(1),
  projectTitle: z.string().trim().min(1),
  projectImageUrl: z.string().url().nullable().optional(),
  categoryLabel: z.string().trim().min(1).nullable().optional(),
  difficulty: z.string().trim().min(1).nullable().optional(),
  estimateStatus: z.enum(['COMPLETE', 'PARTIAL', 'ZERO_COST_AVAILABLE_MATERIALS']),
  estimatedSubtotalNis: z.number().nonnegative(),
  currency: z.literal('NIS'),
  requiredComponentCount: z.number().int().nonnegative(),
  pricedComponentCount: z.number().int().nonnegative(),
  missingComponentCount: z.number().int().nonnegative(),
  unpricedComponentCount: z.number().int().nonnegative(),
  quantityAssumptionWarning: z.string().trim().min(1).nullable().optional(),
  deliveryExcludedNotice: z.string().trim().min(1),
  components: z.array(aiProjectBudgetComponentLineSchema).max(30),
});

export const aiComparisonBlockSchema = z.object({
  type: z.literal('comparison'),
  subject: z.enum(['MATERIAL', 'PROJECT']),
  items: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        title: z.string().trim().min(1),
        facts: z.array(z.string().trim().min(1)).min(1).max(12),
      }),
    )
    .min(2)
    .max(4),
});

export const aiRecommendationsBlockSchema = z.object({
  type: z.literal('recommendations'),
  recommendationType: z.enum(['MATERIALS', 'PROJECTS', 'NEXT_ACTIONS']),
  items: z
    .array(
      z.object({
        itemType: z.enum(['MATERIAL', 'PROJECT', 'ACTION']),
        itemId: z.string().trim().min(1),
        title: z.string().trim().min(1),
        reasons: z.array(z.string().trim().min(1)).min(1).max(6),
        thumbnailUrl: z.string().url().nullable().optional(),
        priceLabel: z.string().trim().min(1).optional(),
        categoryLabel: z.string().trim().min(1).optional(),
        difficulty: z.string().trim().min(1).optional(),
        estimatedTimeLabel: z.string().trim().min(1).optional(),
        distanceKm: z.number().nonnegative().nullable().optional(),
        savedByLearner: z.boolean().optional(),
        activeBuildId: z.string().trim().min(1).nullable().optional(),
      }),
    )
    .min(1)
    .max(10),
});

export const aiBuildStepGuideBlockSchema = z.object({
  type: z.literal('build_step_guide'),
  projectBuildId: z.string().trim().min(1),
  projectId: z.string().trim().min(1),
  projectTitle: z.string().trim().min(1),
  projectStepId: z.string().trim().min(1),
  stepNumber: z.number().int().positive(),
  totalSteps: z.number().int().nonnegative(),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  imageUrl: z.string().url().nullable().optional(),
  progressPercent: z.number().int().min(0).max(100),
  completedSteps: z.number().int().nonnegative(),
  materialReadiness: z.object({
    ready: z.number().int().nonnegative(),
    linked: z.number().int().nonnegative(),
    reserved: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  stepStatus: z.literal('CURRENT'),
});

export const aiActionConfirmationBlockSchema = z.object({
  type: z.literal('action_confirmation'),
  pendingActionId: z.string().trim().min(1),
  actionType: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  target: z.object({
    type: z.enum(['MATERIAL', 'PROJECT', 'BUILD', 'COMPONENT', 'RESERVATION']),
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
  }),
  expiresAt: z.string().datetime(),
  confirmLabel: z.string().trim().min(1),
  cancelLabel: z.string().trim().min(1),
});

export const aiActionResultBlockSchema = z.object({
  type: z.literal('action_result'),
  actionType: z.string().trim().min(1),
  status: z.enum(['EXECUTED', 'CANCELLED', 'FAILED']),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  target: z
    .object({
      type: z.enum(['MATERIAL', 'PROJECT', 'BUILD', 'COMPONENT', 'RESERVATION']),
      id: z.string().trim().min(1),
      title: z.string().trim().min(1),
    })
    .optional(),
  navigation: z
    .object({
      route: z.string().trim().min(1),
      id: z.string().trim().min(1),
    })
    .optional(),
});

export const aiExternalSourcesBlockSchema = z.object({
  type: z.literal('external_sources'),
  query: z.string().trim().min(1).max(300).optional(),
  items: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        url: z.string().url(),
        source: z.string().trim().min(1).max(120).optional(),
        publishedAt: z.string().datetime().nullable().optional(),
        snippet: z.string().trim().min(1).max(500).optional(),
        provenance: z.enum(['authoritative', 'unverified']).optional(),
      }),
    )
    .min(1)
    .max(5),
});

const authoringFactSourceSchema = z.enum([
  'IDEA',
  'DRAFT',
  'LEARNER_ANSWER',
  'PROFILE',
]);

const authoringKnownFactSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(500),
  source: authoringFactSourceSchema,
});

const authoringNextQuestionSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^[a-z][a-z0-9_]*$/),
    prompt: z.string().trim().min(1).max(500),
    answerType: z.enum(['FREE_TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE']),
    options: z.array(z.string().trim().min(1).max(200)),
  })
  .superRefine((value, ctx) => {
    const normalized = value.options.map((option) =>
      option.trim().toLowerCase(),
    );
    const unique = new Set(normalized);
    if (unique.size !== normalized.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Question options must be unique.',
        path: ['options'],
      });
    }

    if (value.answerType === 'FREE_TEXT') {
      if (value.options.length > 0) {
        ctx.addIssue({
          code: 'custom',
          message: 'FREE_TEXT questions must not include options.',
          path: ['options'],
        });
      }
      return;
    }

    const minOptions = value.answerType === 'SINGLE_CHOICE' ? 2 : 2;
    const maxOptions = value.answerType === 'SINGLE_CHOICE' ? 4 : 6;
    if (value.options.length < minOptions || value.options.length > maxOptions) {
      ctx.addIssue({
        code: 'custom',
        message: 'Question options count is invalid for the answer type.',
        path: ['options'],
      });
    }
  });

export const aiProjectAuthoringClarificationBlockSchema = z
  .object({
    type: z.literal('project_authoring_clarification'),
    status: z.enum(['NEEDS_CLARIFICATION', 'READY_FOR_PROPOSAL']),
    summary: z.string().trim().min(1).max(2000),
    knownFacts: z.array(authoringKnownFactSchema).max(20),
    nextQuestion: authoringNextQuestionSchema.nullable(),
    remainingTopics: z.number().int().min(0).max(20),
    assumptions: z.array(z.string().trim().min(1).max(500)).max(10),
    warnings: z.array(z.string().trim().min(1).max(500)).max(10),
  })
  .superRefine((value, ctx) => {
    const factKeys = value.knownFacts.map((fact) => fact.key);
    if (new Set(factKeys).size !== factKeys.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Known fact keys must be unique.',
        path: ['knownFacts'],
      });
    }

    if (value.status === 'NEEDS_CLARIFICATION' && value.nextQuestion === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'NEEDS_CLARIFICATION requires nextQuestion.',
        path: ['nextQuestion'],
      });
    }

    if (value.status === 'READY_FOR_PROPOSAL' && value.nextQuestion !== null) {
      ctx.addIssue({
        code: 'custom',
        message: 'READY_FOR_PROPOSAL requires nextQuestion to be null.',
        path: ['nextQuestion'],
      });
    }
  });

export type AiProjectAuthoringClarificationBlock = z.infer<
  typeof aiProjectAuthoringClarificationBlockSchema
>;

export const aiAuthoringClarificationProviderSchema = z.object({
  clarification: aiProjectAuthoringClarificationBlockSchema,
  assistantText: z.string().trim().min(1).max(4000),
});

/** Reused for OpenAI-compatible strict structured output requests. */
export const aiAuthoringClarificationProviderJsonSchema = z.toJSONSchema(
  aiAuthoringClarificationProviderSchema,
);

export type AiAuthoringClarificationProviderResult = z.infer<
  typeof aiAuthoringClarificationProviderSchema
>;

const proposalComponentSchema = z.object({
  componentName: z.string().trim().min(1).max(200),
  materialType: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(99999),
  unit: z.string().trim().min(1).max(50),
  componentRole: z.enum(LEARNER_SUBMIT_COMPONENT_ROLES),
  isRequired: z.boolean(),
  canBeSubstituted: z.boolean(),
  searchKeywords: z.array(z.string().trim().min(1).max(80)).max(5),
  alternativeKeywords: z.array(z.string().trim().min(1).max(80)).max(5),
  notes: z.string().trim().max(1000).optional(),
});

const proposalStepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

const proposalProjectFieldsSchema = z.object({
  title: z.string().trim().min(3).max(200),
  shortDescription: z.string().trim().min(10).max(500),
  description: z.string().trim().min(10).max(10000),
  difficulty: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']),
  estimatedMinutes: z.number().int().positive().max(10000).optional(),
});

export const aiProjectAuthoringProposalBlockSchema = z
  .object({
    type: z.literal('project_authoring_proposal'),
    proposalId: z.string().trim().min(1).max(80),
    version: z.number().int().positive().max(99).optional().default(1),
    parentProposalId: z.string().trim().min(1).max(80).optional(),
    revisionReviewStateId: z.string().trim().min(1).max(80).optional(),
    baseUpdatedAt: z.string().datetime(),
    clarificationMessageId: z.string().trim().min(1).max(64),
    status: z.literal('PREVIEW'),
    categoryDisplayName: z.string().trim().min(1).max(200),
    project: proposalProjectFieldsSchema,
    requiredComponents: z.array(proposalComponentSchema).min(1).max(50),
    steps: z.array(proposalStepSchema).min(3).max(100),
    assumptions: z.array(z.string().trim().min(1).max(500)).max(10),
    warnings: z.array(z.string().trim().min(1).max(500)).max(10),
    safetyConsiderations: z.array(z.string().trim().min(1).max(500)).max(10),
  })
  .superRefine((value, ctx) => {
    const componentKeys = value.requiredComponents.map((component) =>
      component.componentName.trim().toLowerCase(),
    );
    if (new Set(componentKeys).size !== componentKeys.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Proposal component names must be unique.',
        path: ['requiredComponents'],
      });
    }

    const stepSignatures = value.steps.map(
      (step) =>
        `${step.title.trim().toLowerCase()}|${step.description.trim().toLowerCase()}`,
    );
    if (new Set(stepSignatures).size !== stepSignatures.length) {
      ctx.addIssue({
        code: 'custom',
        message: 'Proposal steps must not duplicate.',
        path: ['steps'],
      });
    }
  });

export type AiProjectAuthoringProposalBlock = z.infer<
  typeof aiProjectAuthoringProposalBlockSchema
>;

const providerProposalComponentSchema = z.object({
  componentName: z.string().trim().min(1).max(200),
  materialType: z.string().trim().min(1).max(200).optional(),
  quantity: z.number().positive().max(99999).optional(),
  unit: z.string().trim().min(1).max(50).optional(),
  componentRole: z.enum(LEARNER_SUBMIT_COMPONENT_ROLES).optional(),
  isRequired: z.boolean().optional(),
  canBeSubstituted: z.boolean().optional(),
  searchKeywords: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
  alternativeKeywords: z
    .array(z.string().trim().min(1).max(80))
    .max(5)
    .optional(),
  notes: z.string().trim().max(1000).optional(),
  categoryId: z.unknown().optional(),
  id: z.unknown().optional(),
});

const providerProposalStepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  stepNumber: z.unknown().optional(),
  id: z.unknown().optional(),
});

export const aiAuthoringProposalProviderSchema = z.object({
  project: proposalProjectFieldsSchema.extend({
    categoryId: z.unknown().optional(),
    category: z.unknown().optional(),
    id: z.unknown().optional(),
  }),
  requiredComponents: z.array(providerProposalComponentSchema).min(1).max(50),
  steps: z.array(providerProposalStepSchema).min(3).max(100),
  assumptions: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  warnings: z.array(z.string().trim().min(1).max(500)).max(10).optional(),
  safetyConsiderations: z
    .array(z.string().trim().min(1).max(500))
    .max(10)
    .optional(),
  assistantText: z.string().trim().min(1).max(4000),
});

export type AiAuthoringProposalProviderResult = z.infer<
  typeof aiAuthoringProposalProviderSchema
>;

export const AUTHORING_REVIEW_DECISIONS = [
  'UNREVIEWED',
  'ACCEPT_PROPOSAL',
  'KEEP_CURRENT',
  'UNDER_DISCUSSION',
  'REVISION_REQUESTED',
  'NEEDS_REVISION',
] as const;

export const authoringReviewDecisionSchema = z.enum(AUTHORING_REVIEW_DECISIONS);

export const AUTHORING_REVIEW_FIELD_TARGETS = [
  'title',
  'shortDescription',
  'description',
  'difficulty',
  'estimatedMinutes',
] as const;

export const AUTHORING_REVIEW_SECTION_TARGETS = ['components', 'steps'] as const;

export const authoringReviewTargetSchema = z.enum([
  ...AUTHORING_REVIEW_FIELD_TARGETS,
  ...AUTHORING_REVIEW_SECTION_TARGETS,
]);

export const authoringReviewStatusSchema = z.enum([
  'IN_REVIEW',
  'DISCUSSION_NEEDED',
  'READY_TO_APPLY',
  'APPLIED',
]);

export const aiProjectAuthoringDiscussionContextBlockSchema = z.object({
  type: z.literal('project_authoring_discussion_context'),
  target: authoringReviewTargetSchema,
  proposalId: z.string().trim().min(1).max(80),
  reviewStateId: z.string().trim().min(1).max(80),
});

export type AiProjectAuthoringDiscussionContextBlock = z.infer<
  typeof aiProjectAuthoringDiscussionContextBlockSchema
>;

const authoringReviewFieldDecisionsSchema = z.object({
  title: authoringReviewDecisionSchema,
  shortDescription: authoringReviewDecisionSchema,
  description: authoringReviewDecisionSchema,
  difficulty: authoringReviewDecisionSchema,
  estimatedMinutes: authoringReviewDecisionSchema,
});

const authoringRevisionRequestSchema = z.object({
  target: authoringReviewTargetSchema,
  comment: z.string().trim().min(1).max(1000),
  status: z.enum(['OPEN', 'RESOLVED']),
});

export const aiProjectAuthoringReviewStateBlockSchema = z.object({
  type: z.literal('project_authoring_review_state'),
  reviewStateId: z.string().trim().min(1).max(80),
  proposalId: z.string().trim().min(1).max(80),
  baseUpdatedAt: z.string().datetime(),
  status: authoringReviewStatusSchema,
  fieldDecisions: authoringReviewFieldDecisionsSchema,
  componentDecision: authoringReviewDecisionSchema,
  stepDecision: authoringReviewDecisionSchema,
  lockedTargets: z.array(authoringReviewTargetSchema).max(10),
  revisionRequests: z.array(authoringRevisionRequestSchema).max(10),
  resolvedProposalId: z.string().trim().min(1).max(80).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AiProjectAuthoringReviewStateBlock = z.infer<
  typeof aiProjectAuthoringReviewStateBlockSchema
>;

export const aiProjectAuthoringProposalDiffBlockSchema = z.object({
  type: z.literal('project_authoring_proposal_diff'),
  fromProposalId: z.string().trim().min(1).max(80),
  toProposalId: z.string().trim().min(1).max(80),
  changedTargets: z.array(authoringReviewTargetSchema).max(10),
  fieldChanges: z
    .array(
      z.object({
        target: z.enum([
          'title',
          'shortDescription',
          'description',
          'difficulty',
          'estimatedMinutes',
        ]),
        before: z.string().max(10000),
        after: z.string().max(10000),
      }),
    )
    .max(10),
  componentChanges: z.object({
    added: z.array(z.string().trim().min(1).max(200)).max(30),
    removed: z.array(z.string().trim().min(1).max(200)).max(30),
    updated: z.array(z.string().trim().min(1).max(200)).max(30),
  }),
  stepChanges: z.object({
    added: z.array(z.string().trim().min(1).max(200)).max(30),
    removed: z.array(z.string().trim().min(1).max(200)).max(30),
    updated: z.array(z.string().trim().min(1).max(200)).max(30),
    reordered: z.boolean(),
  }),
});

export type AiProjectAuthoringProposalDiffBlock = z.infer<
  typeof aiProjectAuthoringProposalDiffBlockSchema
>;

export const AUTHORING_SEQUENTIAL_STAGES = [
  'OVERVIEW',
  'TITLE',
  'SHORT_DESCRIPTION',
  'FULL_DESCRIPTION',
  'DIFFICULTY',
  'ESTIMATED_DURATION',
  'COMPONENTS',
  'COMPONENTS_MODE',
  'STEPS_OVERVIEW',
  'STEPS_MODE',
  'STEP_REVIEW',
  'FINAL_REVIEW',
  'COMPLETE',
] as const;

export const authoringSequentialStageSchema = z.enum(AUTHORING_SEQUENTIAL_STAGES);

export const authoringSequentialFlowStatusSchema = z.enum([
  'WAITING_FOR_ASSISTANT',
  'WAITING_FOR_USER',
  'SAVING',
  'COMPLETE',
  'STALE',
  'GENERATION_FAILED',
]);

export const authoringSequentialTurnStatusSchema = z.enum([
  'PROPOSED',
  'ACCEPTED',
  'REJECTED',
  'SUPERSEDED',
]);

const authoringSequentialComponentSchema = z.object({
  componentName: z.string().trim().min(1).max(200),
  materialType: z.string().trim().min(1).max(200),
  quantity: z.number().positive().max(99999),
  unit: z.string().trim().min(1).max(50),
  componentRole: z.enum(LEARNER_SUBMIT_COMPONENT_ROLES),
  isRequired: z.boolean(),
  canBeSubstituted: z.boolean(),
  searchKeywords: z.array(z.string().trim().min(1).max(80)).max(5).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const authoringSequentialStepSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
});

export const authoringSequentialTurnProposalSchema = z.union([
  z.object({ value: z.string().trim().min(1).max(200) }),
  z.object({ value: z.string().trim().min(1).max(500) }),
  z.object({ value: z.string().trim().min(1).max(10000) }),
  z.object({ value: z.enum(['BEGINNER', 'INTERMEDIATE', 'ADVANCED']) }),
  z.object({ value: z.number().int().positive().max(10000) }),
  z.object({ components: z.array(authoringSequentialComponentSchema).min(1).max(50) }),
  z.object({ steps: z.array(authoringSequentialStepSchema).min(1).max(100) }),
  z.object({
    index: z.number().int().nonnegative(),
    total: z.number().int().positive(),
    component: authoringSequentialComponentSchema,
  }),
  z.object({
    index: z.number().int().nonnegative(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(5000),
  }),
]);

export const aiProjectAuthoringTurnBlockSchema = z.object({
  type: z.literal('project_authoring_turn'),
  turnId: z.string().trim().min(1).max(80),
  sessionId: z.string().trim().min(1).max(80),
  stage: authoringSequentialStageSchema,
  projectId: z.string().trim().min(1).max(80),
  baseUpdatedAt: z.string().datetime(),
  status: authoringSequentialTurnStatusSchema,
  proposal: authoringSequentialTurnProposalSchema,
  explanation: z.string().trim().min(1).max(2000),
  createdAt: z.string().datetime(),
});

export type AiProjectAuthoringTurnBlock = z.infer<
  typeof aiProjectAuthoringTurnBlockSchema
>;

export const aiProjectAuthoringSessionBlockSchema = z.object({
  type: z.literal('project_authoring_session'),
  sessionId: z.string().trim().min(1).max(80),
  projectId: z.string().trim().min(1).max(80),
  baseUpdatedAt: z.string().datetime(),
  stage: authoringSequentialStageSchema,
  flowStatus: authoringSequentialFlowStatusSchema,
  acceptedStages: z.array(authoringSequentialStageSchema).max(20),
  currentTurnId: z.string().trim().min(1).max(80).nullable(),
  policyVersion: z.literal('project-authoring-sequential-v1'),
  componentReviewMode: z
    .enum(['FULL_LIST', 'ONE_BY_ONE'])
    .nullable()
    .optional(),
  stepReviewMode: z.enum(['FULL_PLAN', 'STEP_BY_STEP']).nullable().optional(),
  currentComponentIndex: z.number().int().nonnegative().optional(),
  workingComponents: z.array(authoringSequentialComponentSchema).max(50).optional(),
  acceptedComponentIndexes: z.array(z.number().int().nonnegative()).max(50).optional(),
  componentSourceTotal: z.number().int().nonnegative().optional(),
  awaitingComponentsFinalSave: z.boolean().optional(),
  currentStepIndex: z.number().int().nonnegative().optional(),
  workingSteps: z.array(authoringSequentialStepSchema).max(100).optional(),
  acceptedStepIndexes: z.array(z.number().int().nonnegative()).max(100).optional(),
  awaitingStepsFinalSave: z.boolean().optional(),
  lastAcceptedTurnId: z.string().trim().min(1).max(80).nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AiProjectAuthoringSessionBlock = z.infer<
  typeof aiProjectAuthoringSessionBlockSchema
>;

export const aiContentBlockSchema = z.discriminatedUnion('type', [
  aiTextBlockSchema,
  aiErrorBlockSchema,
  aiMaterialResultsBlockSchema,
  aiMaterialDetailsBlockSchema,
  aiProjectResultsBlockSchema,
  aiProjectDetailsBlockSchema,
  aiComponentListBlockSchema,
  aiBuildChecklistBlockSchema,
  aiComponentMatchesBlockSchema,
  aiProjectBudgetEstimateBlockSchema,
  aiComparisonBlockSchema,
  aiRecommendationsBlockSchema,
  aiBuildStepGuideBlockSchema,
  aiActionConfirmationBlockSchema,
  aiActionResultBlockSchema,
  aiExternalSourcesBlockSchema,
  aiProjectAuthoringClarificationBlockSchema,
  aiProjectAuthoringProposalBlockSchema,
  aiProjectAuthoringReviewStateBlockSchema,
  aiProjectAuthoringProposalDiffBlockSchema,
  aiProjectAuthoringDiscussionContextBlockSchema,
  aiProjectAuthoringSessionBlockSchema,
  aiProjectAuthoringTurnBlockSchema,
]);

export const aiContentBlocksSchema = z
  .array(aiContentBlockSchema)
  .min(1)
  .max(8);

export type AiTextBlock = z.infer<typeof aiTextBlockSchema>;
export type AiErrorBlock = z.infer<typeof aiErrorBlockSchema>;
export type AiContentBlock = z.infer<typeof aiContentBlockSchema>;

export const aiProviderAnswerSchema = z.object({
  blocks: aiContentBlocksSchema,
});

const confidenceSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }

    return value;
  },
  z.number().finite().min(0).max(1),
);

export const aiScopeClassifierSchema = z.object({
  classification: z.enum([
    'DOMAIN_KNOWLEDGE',
    'OUT_OF_SCOPE',
    'DANGEROUS_REQUEST',
    'UNCLEAR',
    'MIXED',
  ]),
  confidence: confidenceSchema,
  reason: z.string().trim().min(1).max(500),
});

export type AiProviderAnswer = z.infer<typeof aiProviderAnswerSchema>;
export type AiScopeClassifierResult = z.infer<typeof aiScopeClassifierSchema>;
