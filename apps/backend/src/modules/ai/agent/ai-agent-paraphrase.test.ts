import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  detectBuildGapIntent,
  detectProjectComponentsIntent,
  mergeMaterialSearchPlan,
} from './ai-agent-filter-extractor.service.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
import { routeToToolName } from './ai-agent-route-mapping.js';

type ParaphraseExpectation = {
  label: string;
  message: string;
  route: string;
  tool: string;
  assertPlan: (plan: Record<string, unknown>) => void;
};

const FREE_MATERIAL_PARAPHRASES: ParaphraseExpectation[] = [
  {
    label: '1',
    message: 'اعرضلي مواد مجانية',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
  {
    label: '2',
    message: 'اعرضلي مواد متوفرة وتكون فري',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => {
      assert.equal(plan.isFree, true);
      assert.equal(plan.query, undefined);
    },
  },
  {
    label: '3',
    message: 'اعرضلي free مواد متوفرة',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
  {
    label: '4',
    message: 'بدي أشياء ببلاش',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
  {
    label: '5',
    message: 'شو في مواد ما عليها سعر؟',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
  {
    label: '6',
    message: 'مواد بدون تكلفة',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
  {
    label: '7',
    message: 'free available materials',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
  {
    label: '8',
    message: 'ورجيني إلكترونيات فري',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => {
      assert.equal(plan.isFree, true);
      assert.equal(plan.categoryText, 'electronics');
    },
  },
  {
    label: '9',
    message: 'في عندكم مواد مجانية؟',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
  {
    label: '10',
    message: 'هات مواد ما بدها مصاري',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
];

const PRICE_PARAPHRASES: ParaphraseExpectation[] = [
  {
    label: '11',
    message: 'مواد تحت 20 شيكل',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.maxPrice, 20),
  },
  {
    label: '12',
    message: 'بدي مواد أقل من عشرين',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.maxPrice, 20),
  },
  {
    label: '13',
    message: 'show materials under 20 NIS',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.maxPrice, 20),
  },
  {
    label: '14',
    message: 'مواد بسعر أقصاه 20',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.maxPrice, 20),
  },
];

const NEAR_PARAPHRASES: ParaphraseExpectation[] = [
  {
    label: '15',
    message: 'مواد قريبة مني',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.nearLearner, true),
  },
  {
    label: '16',
    message: 'شو في إشي مجاني جنبي؟',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => {
      assert.equal(plan.isFree, true);
      assert.equal(plan.nearLearner, true);
    },
  },
  {
    label: '17',
    message: 'free materials near me',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => {
      assert.equal(plan.isFree, true);
      assert.equal(plan.nearLearner, true);
    },
  },
  {
    label: '18',
    message: 'مواد حوالي نابلس',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.city, 'Nablus'),
  },
];

const CODE_SWITCH_PARAPHRASES: ParaphraseExpectation[] = [
  {
    label: '19',
    message: 'بدي electronics تكون free',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => {
      assert.equal(plan.isFree, true);
      assert.equal(plan.categoryText, 'electronics');
    },
  },
  {
    label: '20',
    message: 'show me مواد خشب near me',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => {
      assert.equal(plan.categoryText, 'wood');
      assert.equal(plan.nearLearner, true);
    },
  },
  {
    label: '21',
    message: 'delivery متاح لمواد مجانية',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => {
      assert.equal(plan.isFree, true);
      assert.equal(plan.deliveryAllowed, true);
    },
  },
];

const SPELLING_PARAPHRASES: ParaphraseExpectation[] = [
  {
    label: '22',
    message: 'مواد مجانيه',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
  {
    label: '23',
    message: 'الكترونيات متوفره',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.categoryText, 'electronics'),
  },
  {
    label: '24',
    message: 'فريي materials',
    route: 'MATERIAL_SEARCH',
    tool: 'search_available_materials',
    assertPlan: (plan) => assert.equal(plan.isFree, true),
  },
];

const ALL_PARAPHRASES = [
  ...FREE_MATERIAL_PARAPHRASES,
  ...PRICE_PARAPHRASES,
  ...NEAR_PARAPHRASES,
  ...CODE_SWITCH_PARAPHRASES,
  ...SPELLING_PARAPHRASES,
];

describe('ai agent material paraphrase understanding', () => {
  for (const paraphrase of ALL_PARAPHRASES) {
    test(`case ${paraphrase.label}: ${paraphrase.message}`, async () => {
      const route = resolveAgentRoute({
        userMessage: paraphrase.message,
        locale: 'ar',
      });
      assert.equal(route.route, paraphrase.route);

      const tool = routeToToolName(route.route, route.suggestedTool);
      assert.equal(tool, paraphrase.tool);

      const plan = await resolveAgentExecutionPlan({
        userMessage: paraphrase.message,
        locale: 'ar',
      });
      assert.equal(plan.route, paraphrase.route);
      assert.equal(plan.toolName, paraphrase.tool);
      paraphrase.assertPlan(plan.toolInput);
    });
  }
});

describe('ai agent project intent distinction', () => {
  test('case 25: project required components', () => {
    const message = 'شو مكونات Simple LED Circuit؟';
    assert.equal(detectProjectComponentsIntent(message), true);
    assert.equal(detectBuildGapIntent(message), false);
    const route = resolveAgentRoute({ userMessage: message, locale: 'ar' });
    assert.equal(route.route, 'PROJECT_COMPONENTS');
  });

  test('case 26: build gap analysis', () => {
    const message = 'شو ناقصني في Simple LED Circuit؟';
    assert.equal(detectBuildGapIntent(message), true);
    const route = resolveAgentRoute({ userMessage: message, locale: 'ar' });
    assert.equal(route.route, 'BUILD_GAP_ANALYSIS');
  });

  test('case 27: required project materials without project name', () => {
    const message = 'شو المواد المطلوبة للمشروع؟';
    const route = resolveAgentRoute({ userMessage: message, locale: 'ar' });
    assert.equal(route.route, 'PROJECT_COMPONENTS');
  });

  test('case 28: missing component material matching phrase', () => {
    const message = 'لاقيلي مواد للي ناقص';
    const route = resolveAgentRoute({ userMessage: message, locale: 'ar' });
    assert.equal(route.route, 'COMPONENT_MATERIAL_MATCHING');
  });
});

describe('material query extraction', () => {
  test('does not keep command sentence as query', () => {
    const plan = mergeMaterialSearchPlan('ورجيني مواد تكون free');
    assert.equal(plan.isFree, true);
    assert.equal(plan.query, undefined);
  });

  test('keeps item-specific query separate from filters', () => {
    const plan = mergeMaterialSearchPlan('بدي breadboard مجاني قريب مني');
    assert.equal(plan.isFree, true);
    assert.equal(plan.nearLearner, true);
    assert.equal(plan.query, 'breadboard');
  });
});
