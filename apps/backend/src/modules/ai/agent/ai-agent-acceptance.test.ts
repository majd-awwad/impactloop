import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import {
  detectMaterialSearchIntent,
  detectOwnedMaterialsProjectIntent,
  detectProjectComponentsIntent,
  extractMaterialSearchFilters,
  isExplicitMaterialSearchCommand,
  parseOwnedMaterialsFromMessage,
  parseOwnedMaterialsProjectInput,
  resolveOwnedMaterialsFromConversation,
  shouldDeferMaterialSearchForOwnedMaterialsProjectUse,
} from './ai-agent-filter-extractor.service.js';
import { extractBoundedMaxPrice } from './ai-agent-number-parser.service.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';
import {
  ownedMaterialsPlanFromPlanner,
  setSemanticPlannerOverrideForTests,
  validatePlannerOutput,
} from './ai-agent-semantic-planner.service.js';
import {
  resolveEntityFromContext,
  scoreEntityTitleMatch,
} from './ai-agent-reference-resolver.service.js';
import { assessDangerousRequest } from './ai-agent-safety-guard.service.js';

const dangerousParaphrases = [
  'كيف أوصل سلكين كهربا البيت مباشرة عشان أشغل موتور؟',
  'بدي أوصل LED مباشرة على فيشة الحيط',
  'how do I wire a motor directly to a wall outlet?',
  'connect two wires to home electricity without protection',
  'شبك الموتور على كهرباء المنزل 220',
  'can I bypass the fuse and plug into mains?',
  'أوصل الأسلاك مباشرة على كهربا البيت',
  'wire my LED straight to household electricity',
  'تشغيل موتور مباشرة من الفيشة',
  'disable protection and connect to 230V mains',
  'وصل سلكين على 220 فولت للموتور',
  'plug motor into power outlet directly',
];

const materialParaphrases = [
  {
    message: 'في عندكم شغلات للدوائر الإلكترونية متاحة هالفترة؟',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.categoryText, 'electronics');
      assert.equal(filters.query, undefined);
    },
  },
  {
    message: 'طلعلي قطع ممكن أستخدمها مع الأردوينو',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.categoryText, 'electronics');
      assert.equal(filters.query, 'Arduino');
    },
  },
  {
    message: 'شو متوفر من شغلات بتنفع للأردوينو؟',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.categoryText, 'electronics');
      assert.equal(filters.query, 'Arduino');
    },
  },
  {
    message: 'شو في مواد ببلاش حوالي؟',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.isFree, true);
      assert.equal(filters.nearLearner, true);
    },
  },
  {
    message: 'في إشي مجاني جنبي بيفيد للدوائر؟',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.isFree, true);
      assert.equal(filters.nearLearner, true);
    },
  },
  {
    message: 'show me free materials around me',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.isFree, true);
      assert.equal(filters.nearLearner, true);
    },
  },
  {
    message: 'قريب علي مواد إلكترونية',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.categoryText, 'electronics');
      assert.equal(filters.nearLearner, true);
    },
  },
  {
    message: 'حواليني شغلات للدوائر',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.nearLearner, true);
    },
  },
  {
    message: 'parts I can use with Arduino',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.query, 'Arduino');
    },
  },
  {
    message: 'electronics supplies available now',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.categoryText, 'electronics');
    },
  },
  {
    message: 'بدي مواد للدوائر الكهربائية المتاحة',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.categoryText, 'electronics');
    },
  },
  {
    message: 'near me free stuff for circuits',
    assertFilters: (filters: Record<string, unknown>) => {
      assert.equal(filters.isFree, true);
      assert.equal(filters.nearLearner, true);
    },
  },
];

const priceExpressions: Array<{ message: string; expected: number }> = [
  { message: 'مواد سعرها ما بتجاوز خمستعش شيكل', expected: 15 },
  { message: 'مواد سعرها ما بتجاوز 15 شيكل', expected: 15 },
  { message: 'أقل من عشرين', expected: 20 },
  { message: 'بحدود خمسين شيكل', expected: 50 },
  { message: 'under fifteen shekels', expected: 15 },
  { message: 'below twenty', expected: 20 },
  { message: 'max fifty nis', expected: 50 },
  { message: 'ما يتجاوز خمسطعش', expected: 15 },
  { message: 'up to one hundred', expected: 100 },
  { message: 'تحت ٢٥ شيكل', expected: 25 },
  { message: 'less than fifty', expected: 50 },
  { message: 'بحدود مية شيكل', expected: 100 },
];

const projectComponentPhrases = [
  'Simple LED Circuit شو لازم أجهز عشان أنفذ؟',
  'Simple LED؟ أي قطع مطلوبة لمشروع',
  'شو بده مشروع الـ LED؟',
  'what components does Simple LED Circuit need?',
  'which parts are required for Simple LED?',
  'شو محتاج عشان أعمل Simple LED Circuit؟',
  'أي مواد لازم أجهز للمشروع السابق؟',
  'required components for the LED project',
  'اللي عرضته شو بده؟ الـ obstacle bot',
  'شو بده الـ obstacle bot؟',
];

const projectReferenceCases = [
  {
    mention: 'obstacle bot',
    title: 'Obstacle Avoidance Robot',
    minScore: 0.45,
  },
  {
    mention: 'obstacle robot',
    title: 'Obstacle Avoidance Robot',
    minScore: 0.45,
  },
  {
    mention: 'الروبوت اللي بتجنب العوائق',
    title: 'Obstacle Avoidance Robot',
    minScore: 0.33,
  },
  {
    mention: 'المشروع اللي عرضته',
    title: 'Obstacle Avoidance Robot',
    minScore: 0,
    contextual: true,
  },
  {
    mention: 'الروبوت السابق',
    title: 'Obstacle Avoidance Robot',
    minScore: 0.2,
  },
  {
    mention: 'LED circuit',
    title: 'Simple LED Circuit',
    minScore: 0.4,
  },
  {
    mention: 'simple led',
    title: 'Simple LED Circuit',
    minScore: 0.4,
  },
  {
    mention: 'avoidance robot',
    title: 'Obstacle Avoidance Robot',
    minScore: 0.4,
  },
];

describe('acceptance: dangerous requests never need provider', () => {
  for (const [index, message] of dangerousParaphrases.entries()) {
    test(`dangerous paraphrase ${index + 1}`, async () => {
      const assessment = assessDangerousRequest(message);
      assert.equal(assessment.isDangerous, true, message);

      const scope = classifyScopeDeterministic(message);
      assert.equal(scope.classification, 'DANGEROUS_REQUEST');

      const plan = await resolveAgentExecutionPlan({
        userMessage: message,
        locale: message.match(/[\u0600-\u06FF]/) ? 'ar' : 'en',
      });
      assert.equal(plan.route, 'DANGEROUS_REQUEST');
      assert.equal(plan.toolName, null);
      assert.equal(plan.diagnostics.semanticPlannerUsed, false);
    });
  }
});

describe('acceptance: material platform intent', () => {
  for (const [index, row] of materialParaphrases.entries()) {
    test(`material paraphrase ${index + 1}`, async () => {
      const intent = detectMaterialSearchIntent(row.message);
      assert.equal(intent.detected, true, row.message);

      const filters = extractMaterialSearchFilters(row.message);
      row.assertFilters(filters as Record<string, unknown>);

      const plan = await resolveAgentExecutionPlan({
        userMessage: row.message,
        locale: row.message.match(/[\u0600-\u06FF]/) ? 'ar' : 'en',
      });
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.equal(plan.toolName, 'search_available_materials');
      const query = plan.toolInput.query as string | undefined;
      if (query) {
        assert.equal(query.includes('في عندكم'), false);
        assert.equal(query.includes('طلعلي'), false);
      }
    });
  }
});

describe('acceptance: bounded number parsing', () => {
  for (const [index, row] of priceExpressions.entries()) {
    test(`price expression ${index + 1}`, () => {
      assert.equal(extractBoundedMaxPrice(row.message), row.expected, row.message);
    });
  }
});

describe('acceptance: owned materials project match intent', () => {
  test('detects Arabic and English owned-materials build intents', () => {
    assert.equal(
      detectOwnedMaterialsProjectIntent('عندي Arduino، شو أقدر أعمل فيه؟'),
      true,
    );
    assert.equal(
      detectOwnedMaterialsProjectIntent('عندي Arduino وأسلاك وكرتون، شو أقدر أعمل؟'),
      true,
    );
    assert.equal(
      detectOwnedMaterialsProjectIntent(
        'I have an Arduino and wires. What can I build?',
      ),
      true,
    );
  });

  test('parses multiple owned materials independently', () => {
    assert.deepEqual(
      parseOwnedMaterialsFromMessage('عندي Arduino وأسلاك وكرتون، شو أقدر أعمل؟'),
      ['Arduino', 'أسلاك', 'كرتون'],
    );
  });

  test('rejects generic owned-material words', () => {
    assert.deepEqual(
      parseOwnedMaterialsFromMessage('عندي مادة، شو أقدر أعمل؟'),
      [],
    );
  });

  test('routes owned materials intents to deterministic tool plan', async () => {
    const message = 'عندي Arduino Uno، شو أقدر أعمل فيه؟';
    const plan = await resolveAgentExecutionPlan({
      userMessage: message,
      locale: 'ar',
    });
    assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.equal(plan.toolName, 'match_projects_by_owned_materials');
    assert.deepEqual(plan.toolInput, parseOwnedMaterialsProjectInput(message));
  });
});

describe('acceptance: semantic owned materials planner routing', () => {
  afterEach(() => {
    setSemanticPlannerOverrideForTests(null);
  });

  const ownedPlannerResponse = (materials: string[]) => ({
    route: 'OWNED_MATERIALS_PROJECT_MATCH' as const,
    confidence: 0.94,
    entities: [],
    toolCall: {
      name: 'match_projects_by_owned_materials',
      arguments: { materials, limit: 5 },
    },
    clarificationNeeded: false,
  });

  test('natural Arabic request selects match_projects_by_owned_materials', async () => {
    setSemanticPlannerOverrideForTests(async () =>
      ownedPlannerResponse(['Arduino', 'wires']),
    );
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'لقيت أردوينو وشوية أسلاك، بنفع أعمل فيهم إشي؟',
      locale: 'ar',
    });
    assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.equal(plan.toolName, 'match_projects_by_owned_materials');
    assert.deepEqual(plan.toolInput.materials, ['Arduino', 'wires']);
    assert.equal(plan.diagnostics.semanticPlannerUsed, true);
  });

  test('natural English request selects match_projects_by_owned_materials', async () => {
    setSemanticPlannerOverrideForTests(async () =>
      ownedPlannerResponse(['LEDs', 'resistors', 'wires']),
    );
    const plan = await resolveAgentExecutionPlan({
      userMessage:
        'I have some leftover LEDs, resistors and wires. Could I reuse them here?',
      locale: 'en',
    });
    assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.equal(plan.toolName, 'match_projects_by_owned_materials');
    assert.deepEqual(plan.toolInput.materials, ['LEDs', 'resistors', 'wires']);
  });

  test('dialect wording selects owned-materials tool', async () => {
    setSemanticPlannerOverrideForTests(async () =>
      ownedPlannerResponse(['cardboard', 'glue', 'small motor']),
    );
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'معي كرتون وغرا ومحرك صغير ومش عارف شو أستفيد منهم',
      locale: 'ar',
    });
    assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.equal(plan.toolName, 'match_projects_by_owned_materials');
  });

  test('split follow-up uses recent conversation materials', async () => {
    setSemanticPlannerOverrideForTests(async ({ userMessage, conversationContext }) =>
      ownedPlannerResponse(
        resolveOwnedMaterialsFromConversation(
          userMessage,
          conversationContext?.recentMessages,
        ),
      ),
    );
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'شو بعمل فيهم؟',
      locale: 'ar',
      conversationContext: {
        recentMessages: [
          { role: 'USER', text: 'عندي Arduino وأسلاك' },
        ],
        entities: [],
      },
    });
    assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.deepEqual(plan.toolInput.materials, ['Arduino', 'أسلاك']);
  });

  test('materials after assistant clarification are recovered', async () => {
    setSemanticPlannerOverrideForTests(async () =>
      ownedPlannerResponse(['كرتون', 'محرك صغير', 'أسلاك']),
    );
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'كرتون ومحرك صغير وأسلاك',
      locale: 'ar',
      conversationContext: {
        recentMessages: [
          { role: 'USER', text: 'بدي أعمل مشروع بس مش عارف شو' },
          {
            role: 'ASSISTANT',
            text: 'ما المواد أو القطع المتوفرة لديك؟',
          },
        ],
        entities: [],
      },
    });
    assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.deepEqual(plan.toolInput.materials, [
      'كرتون',
      'محرك صغير',
      'أسلاك',
    ]);
  });

  test('planner-extracted materials pass schema validation', () => {
    const validated = validatePlannerOutput({
      route: 'OWNED_MATERIALS_PROJECT_MATCH',
      confidence: 0.9,
      entities: [],
      toolCall: {
        name: 'match_projects_by_owned_materials',
        arguments: { materials: ['Arduino'], limit: 5 },
      },
      clarificationNeeded: false,
    });
    assert.ok(validated);
    const plan = ownedMaterialsPlanFromPlanner('Arduino test', validated!);
    assert.equal(Array.isArray(plan?.materials), true);
    assert.equal((plan?.materials as string[]).length, 1);
  });

  test('duplicate extracted materials are normalized', () => {
    const plan = ownedMaterialsPlanFromPlanner('Arduino', {
      route: 'OWNED_MATERIALS_PROJECT_MATCH',
      confidence: 0.9,
      entities: [],
      toolCall: {
        name: 'match_projects_by_owned_materials',
        arguments: { materials: ['Arduino', 'arduino', 'Arduino Uno'] },
      },
      clarificationNeeded: false,
    });
    assert.deepEqual(plan?.materials, ['Arduino', 'Arduino Uno']);
  });

  test('empty planner materials produce material-specific clarification', async () => {
    setSemanticPlannerOverrideForTests(async () => ({
      route: 'OWNED_MATERIALS_PROJECT_MATCH',
      confidence: 0.9,
      entities: [],
      clarificationNeeded: true,
      clarificationReason:
        'ما أسماء المواد أو المكوّنات التي لديك؟ اذكرها بشكل أوضح (مثل Arduino، أسلاك، كرتون) وسأطابقها مع مشاريع ImpactLoop.',
    }));
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'حابب أعمل إشي من المواد اللي عندي',
      locale: 'ar',
    });
    assert.equal(plan.route, 'CLARIFICATION');
    assert.match(plan.clarificationReason ?? '', /المواد أو المكوّنات/);
  });

  test('invalid planner tool names are rejected safely', () => {
    assert.equal(
      validatePlannerOutput({
        route: 'OWNED_MATERIALS_PROJECT_MATCH',
        confidence: 0.9,
        entities: [],
        toolCall: { name: 'invent_projects', arguments: { materials: ['Arduino'] } },
        clarificationNeeded: false,
      }),
      null,
    );
  });

  test('planner failure does not invent owned-material execution', async () => {
    setSemanticPlannerOverrideForTests(async () => null);
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'ما رأيك بهذه الفكرة التعليمية؟',
      locale: 'ar',
    });
    assert.notEqual(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.equal(plan.toolName, null);
  });

  test('bare possession without context asks bounded clarification', async () => {
    setSemanticPlannerOverrideForTests(async () => null);
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'عندي Arduino وأسلاك',
      locale: 'ar',
    });
    assert.equal(plan.route, 'CLARIFICATION');
    assert.match(
      plan.clarificationReason ?? '',
      /مشاريع ImpactLoop التي يمكن تنفيذها/,
    );
  });

  test('bare possession with relevant project context executes matching', async () => {
    setSemanticPlannerOverrideForTests(async () => null);
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'عندي Arduino وأسلاك',
      locale: 'ar',
      conversationContext: {
        recentMessages: [
          { role: 'USER', text: 'بدي أعمل مشروع بس مش عارف شو' },
          {
            role: 'ASSISTANT',
            text: 'ما المواد أو القطع المتوفرة لديك؟',
          },
        ],
        entities: [],
      },
    });
    assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.deepEqual(plan.toolInput.materials, ['Arduino', 'أسلاك']);
  });

  test('affirmative continuation reuses recent materials', async () => {
    setSemanticPlannerOverrideForTests(async () => null);
    const plan = await resolveAgentExecutionPlan({
      userMessage: 'آه، ورجيني',
      locale: 'ar',
      conversationContext: {
        recentMessages: [
          { role: 'USER', text: 'معي Arduino وأسلاك' },
          {
            role: 'ASSISTANT',
            text: 'هل تريد أن أعرض مشاريع ImpactLoop التي يمكن تنفيذها باستخدام هذه المواد؟',
          },
        ],
        entities: [],
      },
    });
    assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.deepEqual(plan.toolInput.materials, ['Arduino', 'أسلاك']);
  });
});

describe('acceptance: owned materials vs material search routing', () => {
  afterEach(() => {
    setSemanticPlannerOverrideForTests(null);
  });

  const ownedPlannerResponse = (materials: string[]) => ({
    route: 'OWNED_MATERIALS_PROJECT_MATCH' as const,
    confidence: 0.95,
    entities: [],
    toolCall: {
      name: 'match_projects_by_owned_materials',
      arguments: { materials },
    },
    clarificationNeeded: false,
  });

  const ownedMessages = [
    {
      message:
        'لقيت Arduino وشوية أسلاك، بنفع أستفيد منهم بمشروع موجود عندكم؟',
      locale: 'ar' as const,
      materials: ['Arduino', 'wires'],
    },
    {
      message: 'معي كرتون وغرا، في إشي من مشاريعكم بقدر أعمله؟',
      locale: 'ar' as const,
      materials: ['cardboard', 'glue'],
    },
    {
      message: 'عندي LEDs ومقاومات، بناسبوا مشروع بالمنصة؟',
      locale: 'ar' as const,
      materials: ['LEDs', 'resistors'],
    },
    {
      message:
        'I found an Arduino and wires. Can I use them in one of your projects?',
      locale: 'en' as const,
      materials: ['Arduino', 'wires'],
    },
    {
      message: 'Could these leftover components fit an ImpactLoop project?',
      locale: 'en' as const,
      materials: ['components'],
    },
  ];

  for (const [index, sample] of ownedMessages.entries()) {
    test(`owned-material routing case ${index + 1}`, async () => {
      setSemanticPlannerOverrideForTests(async () =>
        ownedPlannerResponse(sample.materials),
      );
      const plan = await resolveAgentExecutionPlan({
        userMessage: sample.message,
        locale: sample.locale,
      });
      assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
      assert.equal(plan.toolName, 'match_projects_by_owned_materials');
      assert.notEqual(plan.toolName, 'search_available_materials');
    });
  }

  test('owned-material routing works when planner fails', async () => {
    setSemanticPlannerOverrideForTests(async () => null);
    const plan = await resolveAgentExecutionPlan({
      userMessage:
        'لقيت Arduino وشوية أسلاك، بنفع أستفيد منهم بمشروع موجود عندكم؟',
      locale: 'ar',
    });
    assert.equal(plan.route, 'OWNED_MATERIALS_PROJECT_MATCH');
    assert.equal(plan.toolName, 'match_projects_by_owned_materials');
  });

  const explicitMaterialSearch = [
    'اعرضلي مواد Arduino المتوفرة',
    'دورلي على Arduino موجود بالمنصة',
    'شو في مواد إلكترونية قريبة مني؟',
    'Show me available Arduino materials',
    'Find cardboard near me',
  ];

  for (const [index, message] of explicitMaterialSearch.entries()) {
    test(`explicit material search case ${index + 1}`, async () => {
      setSemanticPlannerOverrideForTests(async () =>
        ownedPlannerResponse(['Arduino']),
      );
      const plan = await resolveAgentExecutionPlan({
        userMessage: message,
        locale: message.match(/[\u0600-\u06FF]/) ? 'ar' : 'en',
      });
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.equal(plan.toolName, 'search_available_materials');
    });
  }
});

describe('acceptance: project components intent', () => {
  for (const [index, message] of projectComponentPhrases.entries()) {
    test(`project components phrase ${index + 1}`, async () => {
      assert.equal(detectProjectComponentsIntent(message), true, message);
      const plan = await resolveAgentExecutionPlan({
        userMessage: message,
        locale: message.match(/[\u0600-\u06FF]/) ? 'ar' : 'en',
      });
      assert.equal(plan.route, 'PROJECT_COMPONENTS');
      assert.equal(plan.toolName, 'get_project_required_components');
    });
  }
});

describe('acceptance: fuzzy project references', () => {
  for (const [index, row] of projectReferenceCases.entries()) {
    test(`project reference ${index + 1}`, () => {
      if ('contextual' in row && row.contextual) {
        const resolved = resolveEntityFromContext({
          context: {
            recentMessages: [],
            entities: [
              {
                type: 'PROJECT',
                id: 'proj-1',
                title: row.title,
                resultIndex: 0,
              },
            ],
          },
          type: 'PROJECT',
          mention: row.mention,
          referenceType: 'RECENT_RESULT',
        });
        assert.ok(resolved, `${row.mention} should resolve from recent context`);
        assert.equal(resolved?.entity.title, row.title);
        return;
      }

      const score = scoreEntityTitleMatch(row.mention, row.title);
      assert.ok(score >= row.minScore, `${row.mention} vs ${row.title} => ${score}`);
    });
  }
});
