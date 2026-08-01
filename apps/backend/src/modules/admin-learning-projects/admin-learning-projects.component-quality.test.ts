import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { assessComponentQuality } from './admin-learning-projects.component-quality.js';

describe('admin learning project component quality', () => {
  test('flags zero components as hard issue', () => {
    const report = assessComponentQuality([]);
    assert.equal(report.hardIssues.some((issue) => issue.code === 'NO_COMPONENTS'), true);
  });

  test('flags duplicate component names as hard issue', () => {
    const report = assessComponentQuality([
      {
        id: 'a',
        componentName: 'Arduino Uno',
        quantity: 1,
        componentRole: 'REQUIRED_MATERIAL',
        categoryId: 'cat-1',
        categoryType: 'BOTH',
        categoryActive: true,
        materialType: 'Arduino board',
        searchKeywords: ['arduino'],
      },
      {
        id: 'b',
        componentName: 'arduino uno',
        quantity: 1,
        componentRole: 'REQUIRED_MATERIAL',
        categoryId: 'cat-1',
        categoryType: 'BOTH',
        categoryActive: true,
        materialType: 'Arduino board',
        searchKeywords: ['arduino'],
      },
    ]);

    assert.equal(
      report.hardIssues.some((issue) => issue.code === 'DUPLICATE_COMPONENT_NAME'),
      true,
    );
  });

  test('flags weak project-wide warnings without blocking valid component', () => {
    const report = assessComponentQuality([
      {
        id: 'a',
        componentName: 'stuff',
        quantity: 1,
        componentRole: 'CONSUMABLE',
        categoryId: null,
        categoryType: null,
        categoryActive: null,
        materialType: 'Unspecified',
        searchKeywords: [],
      },
    ]);

    assert.equal(report.hardIssues.length, 0);
    assert.equal(
      report.softWarnings.some((issue) => issue.code === 'VAGUE_COMPONENT_NAME'),
      true,
    );
    assert.equal(
      report.softWarnings.some(
        (issue) => issue.code === 'NO_REQUIRED_MATERIAL',
      ),
      true,
    );
  });
});
