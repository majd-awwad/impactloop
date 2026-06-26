import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  estimateCo2KgFromReusedMaterials,
  getCo2FactorKgPerUnit,
  resolveCo2CategoryFactorKey,
} from './admin-impact-estimator.js';

describe('admin impact estimator', () => {
  test('resolves category factor keys conservatively', () => {
    assert.equal(resolveCo2CategoryFactorKey('Electronics'), 'electronics');
    assert.equal(resolveCo2CategoryFactorKey('Wood & Panels'), 'wood');
    assert.equal(resolveCo2CategoryFactorKey('Plastics'), 'plastics');
    assert.equal(resolveCo2CategoryFactorKey('Fabric & Textiles'), 'fabric');
    assert.equal(resolveCo2CategoryFactorKey('Tools & Hardware'), 'tools');
    assert.equal(resolveCo2CategoryFactorKey('Other'), 'default');
  });

  test('estimates CO2 from reused material quantities', () => {
    const result = estimateCo2KgFromReusedMaterials([
      { quantity: 2, unit: 'piece', categoryNameEn: 'Electronics' },
      { quantity: 4, unit: 'sheet', categoryNameEn: 'Wood & Panels' },
    ]);

    assert.equal(result.estimatedCo2Kg, 5.6);
    assert.equal(result.estimatedCo2Label, '5.6 kg CO₂e');
    assert.match(result.estimatedCo2Method, /Conservative MVP estimates/);
    assert.equal(getCo2FactorKgPerUnit('Unknown Category'), 0.5);
  });
});
