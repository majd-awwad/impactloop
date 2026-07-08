import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { updateAdminLearningProjectComponentSchema } from './admin-learning-projects.validation.js';

describe('updateAdminLearningProjectComponentSchema', () => {
  test('accepts cuid categoryId and numeric quantity', () => {
    const parsed = updateAdminLearningProjectComponentSchema.parse({
      componentName: 'Arduino Uno',
      quantity: 1,
      unit: 'piece',
      componentRole: 'REQUIRED_MATERIAL',
      categoryId: 'clxyz1234567890abcdefghij',
      materialType: 'Arduino Uno',
      searchKeywords: ['arduino', 'microcontroller'],
      isRequired: true,
      canBeSubstituted: true,
    });

    assert.equal(parsed.categoryId, 'clxyz1234567890abcdefghij');
    assert.equal(parsed.quantity, 1);
    assert.equal(parsed.componentRole, 'REQUIRED_MATERIAL');
  });

  test('coerces string quantity to number', () => {
    const parsed = updateAdminLearningProjectComponentSchema.parse({
      quantity: '2',
    });

    assert.equal(parsed.quantity, 2);
  });

  test('rejects invalid component role with clear message', () => {
    const result = updateAdminLearningProjectComponentSchema.safeParse({
      componentRole: 'Required material',
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0]?.message ?? '', /valid value/i);
    }
  });

  test('rejects non-positive quantity', () => {
    const result = updateAdminLearningProjectComponentSchema.safeParse({
      quantity: 0,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0]?.message ?? '', /greater than zero/i);
    }
  });

  test('splits comma-separated keywords into separate entries', () => {
    const parsed = updateAdminLearningProjectComponentSchema.parse({
      searchKeywords: ['arduino, microcontroller'],
    });

    assert.deepEqual(parsed.searchKeywords, ['arduino', 'microcontroller']);
  });

  test('normalizes empty categoryId to null', () => {
    const parsed = updateAdminLearningProjectComponentSchema.parse({
      categoryId: '',
      componentName: 'Sensor',
    });

    assert.equal(parsed.categoryId, null);
  });
});
