import type { z } from 'zod';

import type { AiToolDefinition } from './ai-tool.types.js';
import {
  buildIdInputSchema,
  compareMaterialIdsInputSchema,
  compareProjectIdsInputSchema,
  componentIdInputSchema,
  emptyObjectSchema,
  findMaterialsForProjectInputSchema,
  materialIdInputSchema,
  personalizedRecommendationsInputSchema,
  projectIdInputSchema,
  searchAvailableMaterialsInputSchema,
  searchLearningProjectsInputSchema,
  matchProjectsByOwnedMaterialsInputSchema,
} from './ai-tool.types.js';
import { executeLearnerAgentTool } from './ai-tool-handlers.js';

const defineReadTool = <TInput extends z.ZodTypeAny>(
  definition: AiToolDefinition<TInput>,
): AiToolDefinition<TInput> => definition;

export const AI_TOOL_REGISTRY = {
  get_learner_context: defineReadTool({
    name: 'get_learner_context',
    kind: 'read',
    description: 'Bounded learner interests and location summary',
    inputSchema: emptyObjectSchema,
    timeoutMs: 5_000,
    maxOutputBytes: 8_192,
    handler: (input, context) =>
      executeLearnerAgentTool('get_learner_context', input, context),
  }),
  search_available_materials: defineReadTool({
    name: 'search_available_materials',
    kind: 'read',
    description: 'Search publicly available materials',
    inputSchema: searchAvailableMaterialsInputSchema,
    timeoutMs: 10_000,
    maxOutputBytes: 32_768,
    handler: (input, context) =>
      executeLearnerAgentTool('search_available_materials', input, context),
  }),
  get_material_details: defineReadTool({
    name: 'get_material_details',
    kind: 'read',
    description: 'Get trusted public material details',
    inputSchema: materialIdInputSchema,
    timeoutMs: 8_000,
    maxOutputBytes: 16_384,
    handler: (input, context) =>
      executeLearnerAgentTool('get_material_details', input, context),
  }),
  search_learning_projects: defineReadTool({
    name: 'search_learning_projects',
    kind: 'read',
    description: 'Search published learning projects',
    inputSchema: searchLearningProjectsInputSchema,
    timeoutMs: 10_000,
    maxOutputBytes: 32_768,
    handler: (input, context) =>
      executeLearnerAgentTool('search_learning_projects', input, context),
  }),
  match_projects_by_owned_materials: defineReadTool({
    name: 'match_projects_by_owned_materials',
    kind: 'read',
    description:
      'Match learner-listed owned materials to published project required components',
    inputSchema: matchProjectsByOwnedMaterialsInputSchema,
    timeoutMs: 12_000,
    maxOutputBytes: 48_768,
    handler: (input, context) =>
      executeLearnerAgentTool('match_projects_by_owned_materials', input, context),
  }),
  get_learning_project_details: defineReadTool({
    name: 'get_learning_project_details',
    kind: 'read',
    description: 'Get published project details',
    inputSchema: projectIdInputSchema,
    timeoutMs: 8_000,
    maxOutputBytes: 24_576,
    handler: (input, context) =>
      executeLearnerAgentTool('get_learning_project_details', input, context),
  }),
  get_project_required_components: defineReadTool({
    name: 'get_project_required_components',
    kind: 'read',
    description: 'Get required project components',
    inputSchema: projectIdInputSchema,
    timeoutMs: 8_000,
    maxOutputBytes: 24_576,
    handler: (input, context) =>
      executeLearnerAgentTool('get_project_required_components', input, context),
  }),
  get_saved_projects: defineReadTool({
    name: 'get_saved_projects',
    kind: 'read',
    description: 'Get authenticated learner saved projects',
    inputSchema: emptyObjectSchema,
    timeoutMs: 8_000,
    maxOutputBytes: 24_576,
    handler: (input, context) =>
      executeLearnerAgentTool('get_saved_projects', input, context),
  }),
  get_active_project_builds: defineReadTool({
    name: 'get_active_project_builds',
    kind: 'read',
    description: 'Get learner active project builds',
    inputSchema: emptyObjectSchema,
    timeoutMs: 8_000,
    maxOutputBytes: 24_576,
    handler: (input, context) =>
      executeLearnerAgentTool('get_active_project_builds', input, context),
  }),
  get_build_checklist: defineReadTool({
    name: 'get_build_checklist',
    kind: 'read',
    description: 'Get owned build checklist',
    inputSchema: buildIdInputSchema,
    timeoutMs: 8_000,
    maxOutputBytes: 32_768,
    handler: (input, context) =>
      executeLearnerAgentTool('get_build_checklist', input, context),
  }),
  analyze_build_gaps: defineReadTool({
    name: 'analyze_build_gaps',
    kind: 'read',
    description: 'Analyze missing build components deterministically',
    inputSchema: buildIdInputSchema,
    timeoutMs: 10_000,
    maxOutputBytes: 32_768,
    handler: (input, context) =>
      executeLearnerAgentTool('analyze_build_gaps', input, context),
  }),
  find_materials_for_component: defineReadTool({
    name: 'find_materials_for_component',
    kind: 'read',
    description: 'Match materials to a component',
    inputSchema: componentIdInputSchema,
    timeoutMs: 12_000,
    maxOutputBytes: 32_768,
    handler: (input, context) =>
      executeLearnerAgentTool('find_materials_for_component', input, context),
  }),
  find_materials_for_project: defineReadTool({
    name: 'find_materials_for_project',
    kind: 'read',
    description: 'Match materials across project components',
    inputSchema: findMaterialsForProjectInputSchema,
    timeoutMs: 15_000,
    maxOutputBytes: 48_768,
    handler: (input, context) =>
      executeLearnerAgentTool('find_materials_for_project', input, context),
  }),
  compare_materials: defineReadTool({
    name: 'compare_materials',
    kind: 'read',
    description: 'Compare up to four materials',
    inputSchema: compareMaterialIdsInputSchema,
    timeoutMs: 8_000,
    maxOutputBytes: 24_576,
    handler: (input, context) =>
      executeLearnerAgentTool('compare_materials', input, context),
  }),
  compare_projects: defineReadTool({
    name: 'compare_projects',
    kind: 'read',
    description: 'Compare up to four projects',
    inputSchema: compareProjectIdsInputSchema,
    timeoutMs: 8_000,
    maxOutputBytes: 24_576,
    handler: (input, context) =>
      executeLearnerAgentTool('compare_projects', input, context),
  }),
  get_personalized_recommendations: defineReadTool({
    name: 'get_personalized_recommendations',
    kind: 'read',
    description: 'Personalized recommendations from learner-home services',
    inputSchema: personalizedRecommendationsInputSchema,
    timeoutMs: 12_000,
    maxOutputBytes: 32_768,
    handler: (input, context) =>
      executeLearnerAgentTool('get_personalized_recommendations', input, context),
  }),
} as const;

export type AiRegisteredToolName = keyof typeof AI_TOOL_REGISTRY;

export const isRegisteredToolName = (
  value: string,
): value is AiRegisteredToolName => value in AI_TOOL_REGISTRY;

export const getRegisteredTool = (name: string) => {
  if (!isRegisteredToolName(name)) {
    return null;
  }

  return AI_TOOL_REGISTRY[name];
};
