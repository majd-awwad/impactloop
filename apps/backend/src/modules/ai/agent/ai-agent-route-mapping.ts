import type { AiAgentRouteType } from './ai-agent.types.js';
import { isRegisteredToolName } from './ai-tool-registry.js';

export const routeToToolName = (
  route: AiAgentRouteType,
  suggestedTool?: string,
): string | null => {
  if (suggestedTool && isRegisteredToolName(suggestedTool)) {
    return suggestedTool;
  }

  const mapping: Partial<Record<AiAgentRouteType, string>> = {
    MATERIAL_SEARCH: 'search_available_materials',
    MATERIAL_DETAILS: 'get_material_details',
    PROJECT_SEARCH: 'search_learning_projects',
    PROJECT_DETAILS: 'get_learning_project_details',
    PROJECT_COMPONENTS: 'get_project_required_components',
    SAVED_PROJECTS: 'get_saved_projects',
    ACTIVE_PROJECT_BUILDS: 'get_active_project_builds',
    BUILD_CHECKLIST: 'get_build_checklist',
    BUILD_GAP_ANALYSIS: 'analyze_build_gaps',
    COMPONENT_MATERIAL_MATCHING: 'find_materials_for_component',
    PROJECT_MATERIAL_MATCHING: 'find_materials_for_project',
    PROJECT_MATERIAL_AVAILABILITY: 'match_available_materials_for_project',
    PROJECT_BUDGET_ESTIMATION: 'estimate_project_material_budget',
    PROJECTS_WITHIN_BUDGET: 'find_projects_within_budget',
    OWNED_MATERIALS_PROJECT_MATCH: 'match_projects_by_owned_materials',
    MATERIAL_COMPARISON: 'compare_materials',
    PROJECT_COMPARISON: 'compare_projects',
    PERSONALIZED_RECOMMENDATION: 'get_personalized_recommendations',
  };

  const toolName = mapping[route];
  return toolName && isRegisteredToolName(toolName) ? toolName : null;
};
