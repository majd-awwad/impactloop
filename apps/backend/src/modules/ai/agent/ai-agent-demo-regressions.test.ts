import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildPlatformGuidanceResponse } from '../ai.policy.js';
import {
  detectLearnerReservationStatusQuery,
  detectOwnedMaterialsProjectIntent,
  detectPersonalizedRecommendationIntent,
  detectPlatformGuidanceIntent,
  detectRecentProjectDetailsIntent,
  detectSavedProjectsIntent,
  detectSupplierPublishGuidanceIntent,
  parseOwnedMaterialsFromMessage,
  resolveProjectsWithinBudgetNumericContinuation,
} from './ai-agent-filter-extractor.service.js';
import { resolveAgentExecutionPlan } from './ai-agent-plan-resolver.service.js';

describe('learner demo regression coverage', () => {
  test('recognizes the current Arabic platform-guidance phrases', () => {
    assert.equal(
      detectSupplierPublishGuidanceIntent(
        'كيف المورد بقدر ينشر مادة على المنصة؟',
      ),
      true,
    );
    assert.equal(
      detectPlatformGuidanceIntent('كيف بقدر ألغي حجز؟'),
      'RESERVATION_CANCELLATION',
    );
    assert.equal(
      detectPlatformGuidanceIntent('كيف بعرف إذا المادة فيها توصيل؟'),
      'MATERIAL_DELIVERY',
    );
    assert.equal(
      detectPlatformGuidanceIntent(
        'شو الفرق بين الاستلام من المورد والتوصيل؟',
      ),
      'MATERIAL_DELIVERY',
    );
  });

  test('reservation guidance matches the current no-window request flow', () => {
    const reservation = buildPlatformGuidanceResponse(
      'MATERIAL_RESERVATION',
      'ar',
    );
    const delivery = buildPlatformGuidanceResponse('MATERIAL_DELIVERY', 'ar');

    assert.doesNotMatch(reservation, /نافذة|نوافذ/);
    assert.doesNotMatch(delivery, /نافذة|نوافذ/);
    assert.match(delivery, /عنوان/);
  });

  test('recognizes learner-owned reservation and project wording', () => {
    assert.equal(
      detectLearnerReservationStatusQuery('شو حجوزاتي المعلقة؟'),
      true,
    );
    assert.equal(
      detectLearnerReservationStatusQuery('طيب ورجيني كل حجوزاتي'),
      true,
    );
    assert.equal(
      detectSavedProjectsIntent('شو المشاريع اللي حافظها عندي؟'),
      true,
    );
    assert.equal(
      detectRecentProjectDetailsIntent('احكيلي أكثر عن المشروع الأول'),
      true,
    );
  });

  test('uses a deterministic production plan for delivery guidance', async () => {
    const deliveryPlan = await resolveAgentExecutionPlan({
      userMessage: 'كيف بعرف إذا المادة فيها توصيل؟',
      locale: 'ar',
    });
    assert.equal(deliveryPlan.route, 'PLATFORM_GUIDANCE');
    assert.equal(deliveryPlan.platformGuidanceTopic, 'MATERIAL_DELIVERY');
    assert.equal(deliveryPlan.diagnostics.semanticPlannerUsed, false);
  });

  test('recognizes projects that can be built using a named owned material', () => {
    const message = 'شو المشاريع اللي بقدر أعملها باستخدام Arduino؟';
    assert.equal(detectOwnedMaterialsProjectIntent(message), true);
    assert.deepEqual(parseOwnedMaterialsFromMessage(message), ['Arduino']);
  });

  test('does not confuse a learner budget with owned materials', async () => {
    const message = 'عندي ميزانية 50 شيكل، شو في مشاريع بقدر أعملها؟';
    assert.equal(detectOwnedMaterialsProjectIntent(message), false);

    const plan = await resolveAgentExecutionPlan({
      userMessage: message,
      locale: 'ar',
    });
    assert.equal(plan.route, 'PROJECTS_WITHIN_BUDGET');
    assert.equal(plan.toolName, 'find_projects_within_budget');
    assert.equal(plan.toolInput.maxBudgetNis, 50);
  });

  test('keeps a natural rebudget follow-up on the budget tool', () => {
    const continuation = resolveProjectsWithinBudgetNumericContinuation(
      'طيب لو ميزانيتي 100؟',
      {
        recentMessages: [
          {
            role: 'USER',
            text: 'عندي ميزانية 50 شيكل، شو في مشاريع بقدر أعملها؟',
          },
          { role: 'ASSISTANT', text: 'هذه مشاريع ضمن ميزانيتك.' },
        ],
      },
    );

    assert.ok(continuation);
    assert.equal(continuation?.maxBudgetNis, 100);
  });

  test('routes a personal project suggestion to recommendations', async () => {
    const message = 'اقترحلي مشاريع مناسبة إلي';
    assert.equal(detectPersonalizedRecommendationIntent(message), true);

    const plan = await resolveAgentExecutionPlan({
      userMessage: message,
      locale: 'ar',
    });
    assert.equal(plan.route, 'PERSONALIZED_RECOMMENDATION');
    assert.equal(plan.toolName, 'get_personalized_recommendations');
    assert.equal(plan.toolInput.type, 'PROJECTS');
  });
});
