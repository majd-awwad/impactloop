import { z } from 'zod';

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
        materials: z.array(aiMaterialCardSchema).min(1).max(5),
      }),
    )
    .min(1)
    .max(10),
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
      }),
    )
    .min(1)
    .max(5),
});

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
  aiComparisonBlockSchema,
  aiRecommendationsBlockSchema,
  aiActionConfirmationBlockSchema,
  aiActionResultBlockSchema,
  aiExternalSourcesBlockSchema,
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
