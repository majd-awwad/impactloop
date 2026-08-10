import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import { detectConversationalIntent } from '../ai-conversational-intent.js';
import {
  detectBuildGapIntent,
  detectComponentMaterialMatchingIntent,
  detectComparisonFollowUpIntent,
  detectEducationalLearningIntent,
  detectActiveProjectBuildsIntent,
  detectMaterialDetailsIntent,
  detectMaterialSearchIntent,
  detectOwnedMaterialsProjectIntent,
  detectPlatformGuidanceIntent,
  detectProjectComponentsIntent,
  detectProjectBudgetEstimationIntent,
  detectProjectsWithinBudgetIntent,
  detectProjectMaterialAvailabilityIntent,
  detectProjectSearchIntent,
  detectRecentProjectDetailsIntent,
  detectSavedProjectsIntent,
  shouldDeferMaterialSearchForOwnedMaterialsProjectUse,
} from './ai-agent-filter-extractor.service.js';
import { stripBenignListPrefixForParsing } from './ai-agent-number-parser.service.js';
import type { AiAgentRouteDecision, AiAgentRouteType } from './ai-agent.types.js';

const normalize = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ');

type RoutePattern = {
  route: AiAgentRouteType;
  confidence: number;
  suggestedTool?: string;
  patterns: RegExp[];
};

const PLATFORM_ROUTE_PATTERNS: RoutePattern[] = [
  {
    route: 'ACTION_REQUEST',
    confidence: 0.95,
    suggestedTool: 'prepare_action',
    patterns: [
      /\b(save|reserve|book|link|start|unlink|cancel)\b/i,
      /(احفظ|احفظلي|احجز|احجزلي|اربط|ابدأ|ابدألي|الغي|إلغاء|الغ)/i,
    ],
  },
  {
    route: 'COMPONENT_MATERIAL_MATCHING',
    confidence: 0.93,
    suggestedTool: 'find_materials_for_component',
    patterns: [
      /\b(find|match|suggest)\b.*\b(material|materials)\b.*\b(component|missing)\b/i,
      /(مواد).*(مكون|ناقص|missing)/i,
      /(لاقي|لاقيلي).*(مواد).*(مكون|ناقص|missing|اللي ناقص)/i,
    ],
  },
  {
    route: 'PROJECT_COMPONENTS',
    confidence: 0.94,
    suggestedTool: 'get_project_required_components',
    patterns: [
      /\b(required components|components needed|components for|project components|what components|which parts)\b/i,
      /\b(what|which).*(components|parts).*(need|required|for)\b/i,
      /(شو|ما|اعرض).*(مكونات|components).*(مطلوب|required|للمشروع|لمشروع)/i,
      /(مكونات|components).*(مشروع|project)/i,
      /(مواد|materials).*(مطلوب|required).*(مشروع|project)/i,
    ],
  },
  {
    route: 'BUILD_GAP_ANALYSIS',
    confidence: 0.93,
    suggestedTool: 'analyze_build_gaps',
    patterns: [
      /\b(what|which).*\b(missing|left|need|gap)\b/i,
      /(شو|ما).*(ناقص|ناقصني|نقص|باقي|يلزمني)/i,
      /\b(build checklist|gap analysis)\b/i,
    ],
  },
  {
    route: 'MATERIAL_SEARCH',
    confidence: 0.92,
    suggestedTool: 'search_available_materials',
    patterns: [
      /\b(search|find|show|list|available|browse)\b.*\b(material|materials|supplies|components|stuff)\b/i,
      /(اعرض|ورّيني|وريني|ابحث|لاقي|لاقيلي|بدي|بدّي|شو في|ايش في|هات|هاتلي).*(مواد|مادة|أشياء|اشياء)/i,
      /\b(materials?|stuff)\b.*\b(under|below|free|near|delivery|pickup)\b/i,
      /(مواد|مادة|أشياء|اشياء).*(مجاني|مجانية|فري|free|ببلاش|قريب|توصيل|تحت)/i,
    ],
  },
  {
    route: 'MATERIAL_DETAILS',
    confidence: 0.92,
    suggestedTool: 'get_material_details',
    patterns: [
      /\b(details?|info|more about)\b.*\b(material)\b/i,
      /(تفاصيل|معلومات).*(مادة|المواد)/i,
      /(احكيلي|اخبرني|حكيلي|tell me).*(عن|about).*(أول|الاول|اول|first|second|ثاني).*(مادة|مواد|material)/i,
      /(احكيلي|اخبرني|حكيلي).*(عن|about).*(مادة|مواد|material)/i,
    ],
  },
  {
    route: 'OWNED_MATERIALS_PROJECT_MATCH',
    confidence: 0.95,
    suggestedTool: 'match_projects_by_owned_materials',
    patterns: [
      /(?:عندي|معي).*(?:شو\s+أقدر\s+أعمل|شو\s+اقدر\s+اعمل|شو\s+مشروع)/i,
      /(?:شو|ما)\s+(?:بقدر|أقدر|اقدر)\s+(?:أبني|ابني)\s+باستخدام/i,
      /(?:مشاريع|مشروع)\s+باستخدام/i,
      /\bi\s+have\b.*\bwhat\s+can\s+i\s+(?:build|make)\b/i,
      /\bwhat\s+(?:projects\s+can\s+i\s+make|can\s+i\s+(?:make|build))\s+with\b/i,
      /\bwhat\s+can\s+i\s+do\s+with\b/i,
      /\bprojects?\s+using\b/i,
      /\bwhat\s+can\s+i\s+build\s+using\b/i,
    ],
  },
  {
    route: 'PROJECT_SEARCH',
    confidence: 0.92,
    suggestedTool: 'search_learning_projects',
    patterns: [
      /\b(search|find|show|list|browse)\b.*\b(project|projects)\b/i,
      /(اعرض|ورّيني|وريني|ابحث|شو في).*(مشاريع|مشروع)/i,
      /\b(arduino|robotics|beginner)\b.*\b(project|projects)\b/i,
    ],
  },
  {
    route: 'PROJECT_DETAILS',
    confidence: 0.93,
    suggestedTool: 'get_learning_project_details',
    patterns: [
      /(?:اخر|آخر|last|recent|previous).*(?:مشروع|project)/i,
      /(?:مشروع|project).*(?:اخر|آخر|last|recent|previous|السابق)/i,
      /(?:اشرح|احكيلي|حكيلي|tell|explain).*(?:عن|about).*(?:اخر|آخر|last|recent).*(?:مشروع|project)/i,
    ],
  },
  {
    route: 'SAVED_PROJECTS',
    confidence: 0.93,
    suggestedTool: 'get_saved_projects',
    patterns: [
      /\b(saved|bookmarked)\b.*\b(project|projects)\b/i,
      /(المشاريع|مشروع).*(حفظت|محفوظ|حفظتها|حفظته)/i,
      /(شو|ما).*(المشاريع|مشروع).*(حفظ)/i,
      /(اخر|آخر|last).*(مشروع|project).*(حفظت|محفوظ|saved)/i,
    ],
  },
  {
    route: 'ACTIVE_PROJECT_BUILDS',
    confidence: 0.94,
    suggestedTool: 'get_active_project_builds',
    patterns: [
      /\b(active|current|my)\b.*\b(build|builds)\b/i,
      /(مشاريع).*(بنيتها|بشتغل|شغال|بلشت|بدأت|قيد التنفيذ)/i,
      /(بلشت فيها|بشتغل عليها|قيد التنفيذ|بدأت فيها|شغال عليها)/i,
      /(اعرض|وريني|ورجيني).*(المشاريع).*(بلشت|بدأت|بشتغل)/i,
      /(مشاريعي).*(قيد|نشطة|active)/i,
    ],
  },
  {
    route: 'BUILD_CHECKLIST',
    confidence: 0.9,
    suggestedTool: 'get_build_checklist',
    patterns: [
      /\b(checklist|components needed|required components)\b/i,
      /(قائمة|المكونات).*(مطلوب|التحقق)/i,
    ],
  },
  {
    route: 'PROJECT_MATERIAL_MATCHING',
    confidence: 0.91,
    suggestedTool: 'find_materials_for_project',
    patterns: [
      /\b(find|match|suggest)\b.*\b(material|materials)\b.*\b(project)\b/i,
      /(لاقي|لاقيلي|find).*(مواد).*(مشروع)/i,
    ],
  },
  {
    route: 'MATERIAL_COMPARISON',
    confidence: 0.92,
    suggestedTool: 'compare_materials',
    patterns: [
      /\b(compare|comparison|versus|vs)\b.*\b(material|materials)\b/i,
      /(قارن|مقارنة).*(مواد|مادة|مادتين)/i,
      /(أول|الاول|اول).*(مادتين|مادتين)/i,
      /(أول|الاول|الثاني).*(مادة|مواد)/i,
    ],
  },
  {
    route: 'PROJECT_COMPARISON',
    confidence: 0.92,
    suggestedTool: 'compare_projects',
    patterns: [
      /\b(compare|comparison|versus|vs)\b.*\b(project|projects)\b/i,
      /(قارن|مقارنة).*(مشاريع|مشروع|مشروعين)/i,
      /(أول|الاول|اول).*(مشروعين)/i,
    ],
  },
  {
    route: 'PERSONALIZED_RECOMMENDATION',
    confidence: 0.92,
    suggestedTool: 'get_personalized_recommendations',
    patterns: [
      /\b(recommend|suggest|what should i)\b/i,
      /(شو بتنصحني|بتنصحني|اقترح|انصحني)/i,
      /\b(based on my interests|for me)\b/i,
      /(بناءً على|حسب).*(اهتماماتي|اهتمامات)/i,
    ],
  },
];

const matchExternalKnowledgeRoute = (text: string): AiAgentRouteDecision | null => {
  const patterns = [
    /\b(arduino|esp32|raspberry pi)\b.*\b(library|documentation|datasheet|docs|reference|compatibility|specification|firmware)\b/i,
    /\b(library|documentation|datasheet|docs|reference|compatibility|specification|firmware)\b.*\b(arduino|esp32|raspberry pi)\b/i,
    /(مكتبة|داتا شيت|مواصفات|توافق|وثائق).*(arduino|esp32|اردوينو)/i,
    /\b(current|latest|updated)\b.*\b(library|documentation|docs|firmware)\b/i,
  ];

  if (patterns.some((pattern) => pattern.test(text))) {
    return {
      route: 'EXTERNAL_DOMAIN_KNOWLEDGE',
      confidence: 0.9,
      source: 'deterministic',
    };
  }

  return null;
};

const matchSemanticPlatformRoute = (text: string): AiAgentRouteDecision | null => {
  if (detectOwnedMaterialsProjectIntent(text)) {
    return {
      route: 'OWNED_MATERIALS_PROJECT_MATCH',
      confidence: 0.95,
      source: 'deterministic',
      suggestedTool: 'match_projects_by_owned_materials',
    };
  }

  if (detectActiveProjectBuildsIntent(text)) {
    return {
      route: 'ACTIVE_PROJECT_BUILDS',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'get_active_project_builds',
    };
  }

  if (detectSavedProjectsIntent(text)) {
    return {
      route: 'SAVED_PROJECTS',
      confidence: 0.93,
      source: 'deterministic',
      suggestedTool: 'get_saved_projects',
    };
  }

  if (detectRecentProjectDetailsIntent(text)) {
    return {
      route: 'PROJECT_DETAILS',
      confidence: 0.93,
      source: 'deterministic',
      suggestedTool: 'get_learning_project_details',
    };
  }

  if (detectProjectSearchIntent(text)) {
    return {
      route: 'PROJECT_SEARCH',
      confidence: 0.92,
      source: 'deterministic',
      suggestedTool: 'search_learning_projects',
    };
  }

  if (detectMaterialDetailsIntent(text)) {
    return {
      route: 'MATERIAL_DETAILS',
      confidence: 0.92,
      source: 'deterministic',
      suggestedTool: 'get_material_details',
    };
  }

  if (detectProjectsWithinBudgetIntent(text)) {
    return {
      route: 'PROJECTS_WITHIN_BUDGET',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'find_projects_within_budget',
    };
  }

  if (detectProjectBudgetEstimationIntent(text)) {
    return {
      route: 'PROJECT_BUDGET_ESTIMATION',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'estimate_project_material_budget',
    };
  }

  if (detectProjectMaterialAvailabilityIntent(text)) {
    return {
      route: 'PROJECT_MATERIAL_AVAILABILITY',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'match_available_materials_for_project',
    };
  }

  if (detectProjectComponentsIntent(text)) {
    return {
      route: 'PROJECT_COMPONENTS',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'get_project_required_components',
    };
  }

  if (detectComponentMaterialMatchingIntent(text)) {
    return {
      route: 'COMPONENT_MATERIAL_MATCHING',
      confidence: 0.93,
      source: 'deterministic',
      suggestedTool: 'find_materials_for_component',
    };
  }

  if (detectBuildGapIntent(text)) {
    return {
      route: 'BUILD_GAP_ANALYSIS',
      confidence: 0.93,
      source: 'deterministic',
      suggestedTool: 'analyze_build_gaps',
    };
  }

  if (
    /(قارن|مقارنة|compare)/i.test(text) &&
    /(مادتين|مواد|مادة|materials?)/i.test(text)
  ) {
    return {
      route: 'MATERIAL_COMPARISON',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'compare_materials',
    };
  }

  if (
    /(قارن|مقارنة|compare)/i.test(text) &&
    /(مشروعين|مشاريع|مشروع|projects?)/i.test(text)
  ) {
    return {
      route: 'PROJECT_COMPARISON',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'compare_projects',
    };
  }

  const materialIntent = detectMaterialSearchIntent(text);
  if (materialIntent.detected && !detectPlatformGuidanceIntent(text)) {
    return {
      route: 'MATERIAL_SEARCH',
      confidence: materialIntent.confidence,
      source: 'deterministic',
      suggestedTool: 'search_available_materials',
    };
  }

  return null;
};

const matchPlatformRoute = (text: string): AiAgentRouteDecision | null => {
  if (detectProjectsWithinBudgetIntent(text)) {
    return {
      route: 'PROJECTS_WITHIN_BUDGET',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'find_projects_within_budget',
    };
  }

  if (detectProjectBudgetEstimationIntent(text)) {
    return {
      route: 'PROJECT_BUDGET_ESTIMATION',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'estimate_project_material_budget',
    };
  }

  if (detectProjectMaterialAvailabilityIntent(text)) {
    return {
      route: 'PROJECT_MATERIAL_AVAILABILITY',
      confidence: 0.94,
      source: 'deterministic',
      suggestedTool: 'match_available_materials_for_project',
    };
  }

  if (detectSavedProjectsIntent(text)) {
    return {
      route: 'SAVED_PROJECTS',
      confidence: 0.93,
      source: 'deterministic',
      suggestedTool: 'get_saved_projects',
    };
  }

  if (detectRecentProjectDetailsIntent(text)) {
    return {
      route: 'PROJECT_DETAILS',
      confidence: 0.93,
      source: 'deterministic',
      suggestedTool: 'get_learning_project_details',
    };
  }

  if (detectProjectSearchIntent(text)) {
    return {
      route: 'PROJECT_SEARCH',
      confidence: 0.92,
      source: 'deterministic',
      suggestedTool: 'search_learning_projects',
    };
  }

  const normalized = normalize(text);

  for (const candidate of PLATFORM_ROUTE_PATTERNS) {
    if (candidate.patterns.some((pattern) => pattern.test(normalized) || pattern.test(text))) {
      if (
        candidate.route === 'ACTION_REQUEST' &&
        detectPlatformGuidanceIntent(text)
      ) {
        continue;
      }
      if (
        candidate.route === 'PROJECT_SEARCH' &&
        detectEducationalLearningIntent(text)
      ) {
        continue;
      }
      if (
        candidate.route === 'PROJECT_DETAILS' &&
        detectSavedProjectsIntent(text)
      ) {
        continue;
      }
      if (
        candidate.route === 'PERSONALIZED_RECOMMENDATION' &&
        detectProjectSearchIntent(text)
      ) {
        continue;
      }
      if (
        candidate.route === 'PROJECT_COMPONENTS' &&
        detectBuildGapIntent(text)
      ) {
        continue;
      }
      if (
        candidate.route === 'PROJECT_COMPONENTS' &&
        shouldDeferMaterialSearchForOwnedMaterialsProjectUse(text)
      ) {
        continue;
      }
      if (
        candidate.route === 'BUILD_CHECKLIST' &&
        detectProjectComponentsIntent(text)
      ) {
        continue;
      }
      if (
        candidate.route === 'BUILD_GAP_ANALYSIS' &&
        detectProjectComponentsIntent(text) &&
        !detectBuildGapIntent(text)
      ) {
        continue;
      }
      return {
        route: candidate.route,
        confidence: candidate.confidence,
        source: 'deterministic',
        suggestedTool: candidate.suggestedTool,
      };
    }
  }

  return matchSemanticPlatformRoute(text);
};

export const assessHardSafetyRoute = (userMessage: string): AiAgentRouteDecision | null => {
  const scope = classifyScopeDeterministic(userMessage);
  if (scope.classification === 'DANGEROUS_REQUEST') {
    return {
      route: 'DANGEROUS_REQUEST',
      confidence: scope.confidence,
      source: 'deterministic',
    };
  }
  return null;
};

/** @deprecated Functional keyword router — retained for legacy tests; not used in semantic-first v2 production path. */
export const resolveAgentRoute = (input: {
  userMessage: string;
  locale: 'en' | 'ar';
}): AiAgentRouteDecision => {
  const routingMessage = stripBenignListPrefixForParsing(input.userMessage);
  const scope = classifyScopeDeterministic(input.userMessage);

  if (scope.classification === 'OUT_OF_SCOPE') {
    return { route: 'OUT_OF_SCOPE', confidence: scope.confidence, source: 'deterministic' };
  }

  if (scope.classification === 'DANGEROUS_REQUEST') {
    return {
      route: 'DANGEROUS_REQUEST',
      confidence: scope.confidence,
      source: 'deterministic',
    };
  }

  const conversationalIntent = detectConversationalIntent(input.userMessage);
  if (conversationalIntent !== 'NONE' && scope.classification !== 'DOMAIN_KNOWLEDGE') {
    return {
      route: 'CONVERSATIONAL_STATIC',
      confidence: 0.95,
      source: 'deterministic',
    };
  }

  const platformRoute = matchPlatformRoute(routingMessage);
  if (platformRoute) {
    return platformRoute;
  }

  const platformGuidanceTopic = detectPlatformGuidanceIntent(routingMessage);
  if (platformGuidanceTopic) {
    return {
      route: 'PLATFORM_GUIDANCE',
      confidence: 0.94,
      source: 'deterministic',
      reason: platformGuidanceTopic,
    };
  }

  const externalKnowledge = matchExternalKnowledgeRoute(routingMessage);
  if (externalKnowledge) {
    return externalKnowledge;
  }

  if (detectEducationalLearningIntent(input.userMessage)) {
    return {
      route: 'GENERAL_LEARNING',
      confidence: 0.9,
      source: 'deterministic',
    };
  }

  if (
    scope.classification === 'DOMAIN_KNOWLEDGE' ||
    scope.classification === 'MIXED'
  ) {

    return {
      route: 'GENERAL_LEARNING',
      confidence: scope.confidence,
      source: 'deterministic',
    };
  }

  return {
    route: 'CLARIFICATION',
    confidence: scope.confidence,
    source: 'deterministic',
  };
};
