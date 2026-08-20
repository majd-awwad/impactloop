import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  ADMIN_CO2_CATEGORY_FACTORS_KG_PER_KG,
  ADMIN_IMPACT_CO2_METHODOLOGY_VERSION,
  convertQuantityToKg,
  estimateCo2eFromCompletedReuseEvents,
  estimateCo2KgFromReusedMaterials,
  getCo2FactorKgPerKg,
  resolveCo2CategoryFactorKey,
} from './admin-impact-estimator.js';

const TEST_FACTORS = {
  electronics: 1.2,
  wood: 0.8,
  plastics: 0.6,
  fabric: 0.4,
  tools: 1.0,
  default: 0.5,
} as const;

describe('admin impact estimator', () => {
  test('resolves category factor keys conservatively', () => {
    assert.equal(resolveCo2CategoryFactorKey('Electronics'), 'electronics');
    assert.equal(resolveCo2CategoryFactorKey('Wood & Panels'), 'wood');
    assert.equal(resolveCo2CategoryFactorKey('Plastics'), 'plastics');
    assert.equal(resolveCo2CategoryFactorKey('Fabric & Textiles'), 'fabric');
    assert.equal(resolveCo2CategoryFactorKey('Tools & Hardware'), 'tools');
    assert.equal(resolveCo2CategoryFactorKey('Other'), 'default');
  });

  test('converts only documented mass units to kilograms', () => {
    assert.equal(convertQuantityToKg(2, 'kg'), 2);
    assert.equal(convertQuantityToKg(500, 'g'), 0.5);
    assert.equal(convertQuantityToKg(2, 'kilogram'), 2);
    assert.equal(convertQuantityToKg(250, 'grams'), 0.25);
    assert.equal(convertQuantityToKg(2, 'piece'), null);
    assert.equal(convertQuantityToKg(3, 'sheet'), null);
    assert.equal(convertQuantityToKg(4, 'box'), null);
    assert.equal(convertQuantityToKg(1, 'set'), null);
    assert.equal(convertQuantityToKg(2, 'meter'), null);
    assert.equal(convertQuantityToKg(1, 'unit'), null);
    assert.equal(convertQuantityToKg(0, 'kg'), null);
  });

  test('production factor map is empty until a documented source exists', () => {
    assert.deepEqual(ADMIN_CO2_CATEGORY_FACTORS_KG_PER_KG, {});
    assert.equal(getCo2FactorKgPerKg('Electronics'), null);
    assert.equal(getCo2FactorKgPerKg('Electronics', TEST_FACTORS), 1.2);
  });

  test('includes kg and converted grams, excludes unsupported units, and reports coverage', () => {
    const result = estimateCo2eFromCompletedReuseEvents(
      [
        { quantity: 2, unit: 'kg', categoryNameEn: 'Electronics' },
        { quantity: 500, unit: 'g', categoryNameEn: 'Wood & Panels' },
        { quantity: 4, unit: 'piece', categoryNameEn: 'Electronics' },
        { quantity: 3, unit: 'sheet', categoryNameEn: 'Wood & Panels' },
      ],
      TEST_FACTORS,
    );

    // 2 kg * 1.2 + 0.5 kg * 0.8 = 2.4 + 0.4 = 2.8
    assert.equal(result.estimatedCo2eKg, 2.8);
    assert.equal(result.estimatedCo2eLabel, '2.8 kg CO₂e');
    assert.equal(result.includedReuseEvents, 2);
    assert.equal(result.totalCompletedReuseEvents, 4);
    assert.equal(result.coveragePercent, 50);
    assert.equal(result.isEstimate, true);
    assert.equal(result.unavailableReason, null);
    assert.equal(result.methodologyVersion, ADMIN_IMPACT_CO2_METHODOLOGY_VERSION);
  });

  test('zero eligible environmental rows are handled safely', () => {
    const result = estimateCo2eFromCompletedReuseEvents(
      [
        { quantity: 2, unit: 'piece', categoryNameEn: 'Electronics' },
        { quantity: 1, unit: 'sheet', categoryNameEn: 'Wood & Panels' },
      ],
      TEST_FACTORS,
    );

    assert.equal(result.estimatedCo2eKg, null);
    assert.equal(result.estimatedCo2eLabel, null);
    assert.equal(result.includedReuseEvents, 0);
    assert.equal(result.totalCompletedReuseEvents, 2);
    assert.equal(result.coveragePercent, 0);
    assert.equal(result.unavailableReason, 'NO_ELIGIBLE_EVENTS');
  });

  test('production estimator withholds a number when no documented factors exist', () => {
    const result = estimateCo2eFromCompletedReuseEvents([
      { quantity: 2, unit: 'kg', categoryNameEn: 'Electronics' },
    ]);

    assert.equal(result.estimatedCo2eKg, null);
    assert.equal(result.includedReuseEvents, 0);
    assert.equal(result.totalCompletedReuseEvents, 1);
    assert.equal(result.unavailableReason, 'NO_ELIGIBLE_EVENTS');
  });

  test('dashboard wrapper no longer treats piece or sheet as kilograms', () => {
    const result = estimateCo2KgFromReusedMaterials([
      { quantity: 2, unit: 'piece', categoryNameEn: 'Electronics' },
      { quantity: 4, unit: 'sheet', categoryNameEn: 'Wood & Panels' },
    ]);

    assert.equal(result.estimatedCo2Kg, 0);
    assert.equal(result.estimatedCo2Label, '0 kg CO₂e');
    assert.match(result.estimatedCo2Method, /mass-only/);
    assert.match(result.estimatedCo2Method, /not certified/i);
  });
});
