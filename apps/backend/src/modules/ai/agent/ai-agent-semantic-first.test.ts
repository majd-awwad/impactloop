import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { classifyScopeDeterministic } from '../ai-scope-guard.js';
import {
  detectEducationalLearningIntent,
  detectMaterialSearchIntent,
} from './ai-agent-filter-extractor.service.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';
import { resolveAgentRoute } from './ai-agent-router.service.js';
import { scoreEntityTitleMatch as scoreTitle } from './ai-agent-reference-resolver.service.js';

describe('semantic-first out of scope', () => {
  const cases = [
    'ما هي فلسطين؟',
    'اشرحلي عن القدس',
    'كيف الطقس اليوم؟',
    'مين فاز بالمباراة؟',
  ];

  for (const message of cases) {
    test(`routes ${message} to OUT_OF_SCOPE`, () => {
      const scope = classifyScopeDeterministic(message);
      const route = resolveAgentRoute({ userMessage: message, locale: 'ar' });
      assert.equal(scope.classification, 'OUT_OF_SCOPE');
      assert.equal(route.route, 'OUT_OF_SCOPE');
    });
  }
});

describe('semantic-first material platform intent', () => {
  const cases = [
    {
      message: 'مواد الها علاقة بالالكترونيات',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
        assert.equal(plan.query, undefined);
      },
    },
    {
      message: 'طيب اعرضلي مواد الها علاقة بتحتوي الالكترونيات',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
        assert.equal(plan.query, undefined);
      },
    },
    {
      message: 'بدي شغلات إلكترونية',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
      },
    },
    {
      message: 'عندكم breadboard؟',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.query, 'breadboard');
      },
    },
    {
      message: 'electronics materials',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
      },
    },
    {
      message: 'مواد دوائر كهربائية',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.categoryText, 'electronics');
      },
    },
    {
      message: 'بدي قطع للـ Arduino',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.query, 'Arduino');
      },
    },
    {
      message: 'شو في حساسات متوفرة؟',
      assertPlan: (plan: Record<string, unknown>) => {
        assert.equal(plan.query, 'sensor');
      },
    },
  ];

  for (const sample of cases) {
    test(`material search: ${sample.message}`, async () => {
      const intent = detectMaterialSearchIntent(sample.message);
      assert.equal(intent.detected, true, 'material intent should be detected');

      const route = resolveAgentRoute({
        userMessage: sample.message,
        locale: 'ar',
      });
      assert.equal(route.route, 'MATERIAL_SEARCH');

      const plan = await resolveAgentExecutionPlan({
        userMessage: sample.message,
        locale: 'ar',
      });
      assert.equal(plan.route, 'MATERIAL_SEARCH');
      assert.equal(plan.toolName, 'search_available_materials');
      sample.assertPlan(plan.toolInput);
    });
  }
});

describe('semantic-first general learning distinction', () => {
  const cases = [
    'كيف بستخدم breadboard؟',
    'اشرحلي شو هي الحساسات',
    'شو الفرق بين المحرك والسيرفو؟',
  ];

  for (const message of cases) {
    test(`educational intent: ${message}`, () => {
      assert.equal(detectEducationalLearningIntent(message), true);
      assert.equal(detectMaterialSearchIntent(message).detected, false);
      const route = resolveAgentRoute({ userMessage: message, locale: 'ar' });
      assert.equal(route.route, 'GENERAL_LEARNING');
    });
  }
});

describe('semantic-first project title resolution', () => {
  test('scores shortened project names against recent titles', () => {
    const score = scoreTitle('Obstacle Robot', 'Obstacle Avoidance Robot');
    assert.ok(score >= 0.65);
  });

  test('extracts leading project mention from mixed Arabic/English phrase', () => {
    const route = resolveAgentRoute({
      userMessage: 'Obstacle Robot شو مكونات مشروع ال',
      locale: 'ar',
    });
    assert.equal(route.route, 'PROJECT_COMPONENTS');
  });
});
