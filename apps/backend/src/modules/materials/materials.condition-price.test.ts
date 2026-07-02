import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  applyConditionPriceMultiplier,
  conditionPriceMultiplier,
} from '../../constants/material-condition-factors.js';
import {
  calculateAdjustedPrice,
  evaluateApprovedPriceRuleRequest,
  resolveAdminApprovedAdjustedMaxUnitPriceNis,
  resolveBaseSuggestedMaxUnitPriceNis,
  resolveConditionAdjustedMaxUnitPriceNis,
  resolveFinalAllowedMaxUnitPriceNis,
} from '../price-rule-requests/price-rule-request-pricing.js';
import { calculateMaxAllowedPrice } from '../materials/materials.service.js';
import { mapPriceRuleRequestNotification } from '../supplier-notifications/supplier-notifications.service.js';

describe('condition price multipliers', () => {
  test('NEW uses 1.00 multiplier', () => {
    assert.equal(conditionPriceMultiplier('NEW'), 1);
    assert.equal(applyConditionPriceMultiplier(100, 'NEW'), 100);
  });

  test('LIKE_NEW uses 0.85 multiplier', () => {
    assert.equal(applyConditionPriceMultiplier(100, 'LIKE_NEW'), 85);
  });

  test('GOOD uses 0.65 multiplier', () => {
    assert.equal(applyConditionPriceMultiplier(100, 'GOOD'), 65);
  });

  test('NEEDS_REPAIR uses 0.35 multiplier', () => {
    assert.equal(applyConditionPriceMultiplier(100, 'NEEDS_REPAIR'), 35);
  });

  test('calculateMaxAllowedPrice applies condition to existing price rule max', () => {
    const max = calculateMaxAllowedPrice({
      maxAllowedUnitPriceNis: 100,
      maxAllowedTotalPriceNis: null,
      quantity: 1,
      condition: 'GOOD',
    });

    assert.equal(max, 65);
  });

  test('approved price rule request compares against condition-adjusted max when no admin override', () => {
    const request = {
      status: 'APPROVED',
      aiSuggestedMaxUnitPriceNis: 100,
      adminApprovedMaxUnitPriceNis: null,
    };

    assert.equal(
      resolveConditionAdjustedMaxUnitPriceNis(request, 'GOOD'),
      65,
    );

    const acceptance = evaluateApprovedPriceRuleRequest(request, 70, 'GOOD');
    assert.equal(acceptance.ok, false);
    if (!acceptance.ok) {
      assert.equal(acceptance.reason, 'PRICE_TOO_HIGH');
      assert.equal(acceptance.maxAllowed, 65);
    }

    const allowed = evaluateApprovedPriceRuleRequest(request, 60, 'GOOD');
    assert.equal(allowed.ok, true);
  });

  test('AI base 17 + GOOD gives adjusted 11.05', () => {
    const request = {
      status: 'PENDING',
      aiSuggestedMaxUnitPriceNis: 17,
      adminApprovedMaxUnitPriceNis: null,
    };

    assert.equal(resolveBaseSuggestedMaxUnitPriceNis(request), 17);
    assert.equal(calculateAdjustedPrice(17, 'GOOD'), 11.05);
    assert.equal(resolveConditionAdjustedMaxUnitPriceNis(request, 'GOOD'), 11.05);
  });

  test('admin approved adjusted price 10 is final allowed and not multiplied again', () => {
    const request = {
      status: 'REJECTED',
      aiSuggestedMaxUnitPriceNis: 17,
      adminApprovedMaxUnitPriceNis: 10,
      condition: 'GOOD' as const,
      unit: 'piece',
      supplierPriceNis: 15,
      materialName: 'Widget',
      listingDraftJson: null,
      publishedMaterialId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      id: 'req-1',
      categoryId: null,
      category: null,
      materialType: null,
      publishedAt: null,
      moderatorNote: 'Too high',
    };

    assert.equal(resolveAdminApprovedAdjustedMaxUnitPriceNis(request), 10);
    assert.equal(resolveFinalAllowedMaxUnitPriceNis(request, 'GOOD'), 10);
    assert.notEqual(resolveFinalAllowedMaxUnitPriceNis(request, 'GOOD'), 6.5);

    const acceptance = evaluateApprovedPriceRuleRequest(request, 10, 'GOOD');
    assert.equal(acceptance.ok, true);
    if (acceptance.ok) {
      assert.equal(acceptance.maxAllowed, 10);
    }

    const tooHigh = evaluateApprovedPriceRuleRequest(request, 11, 'GOOD');
    assert.equal(tooHigh.ok, false);
    if (!tooHigh.ok) {
      assert.equal(tooHigh.maxAllowed, 10);
    }
  });

  test('without admin override final allowed uses adjusted suggestion 11.05', () => {
    const request = {
      status: 'REJECTED',
      aiSuggestedMaxUnitPriceNis: 17,
      adminApprovedMaxUnitPriceNis: null,
    };

    assert.equal(resolveFinalAllowedMaxUnitPriceNis(request, 'GOOD'), 11.05);
  });

  test('price rule notification uses final allowed price for badge and body', () => {
    const request = {
      status: 'REJECTED',
      aiSuggestedMaxUnitPriceNis: 17,
      adminApprovedMaxUnitPriceNis: 10,
      condition: 'GOOD' as const,
      unit: 'piece',
      supplierPriceNis: 15,
      materialName: 'Widget',
      listingDraftJson: { title: 'Widget listing' },
      publishedMaterialId: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      id: 'req-1',
      categoryId: null,
      category: null,
      materialType: null,
      publishedAt: null,
      moderatorNote: 'Too high',
    };

    const notification = mapPriceRuleRequestNotification(request as any);

    assert.equal(notification.kind, 'PRICE_REJECTED');
    assert.equal(notification.maxAllowedUnitPriceNis, 10);
    assert.match(notification.body, /10 NIS/);
    assert.doesNotMatch(notification.body, /6\.5 NIS/);
  });
});
