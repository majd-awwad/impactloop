import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  componentMatchesJourneyNeedle,
  findMatchingJourneyComponent,
  formatComponentInventory,
  parseJourneyComponentNeedles,
} from './match-journey-component.js';
import { PROJECT_DATA_03_PROJECTS } from '../projects/najah-projects.data.js';
import { MR_JOURNEY_PLANS } from './behavior-journeys.data.js';

const NAJAH_CAPACITANCE = {
  componentName: 'دائرة تحسس سعوية (Capacitance)',
  materialType: 'Capacitance Sensing Circuit',
  searchKeywords: ['capacitance', 'liquid sensing'],
};

describe('match-journey-component', () => {
  test('parses pipe-separated needles', () => {
    assert.deepEqual(parseJourneyComponentNeedles('Capacitance|سعوية'), [
      'capacitance',
      'سعوية',
    ]);
  });

  test('matches current Najah capacitance identity by English substring', () => {
    assert.equal(
      componentMatchesJourneyNeedle(NAJAH_CAPACITANCE, 'Capacitance'),
      true,
    );
  });

  test('matches Arabic-only capacitance label via alternate needle', () => {
    const arabicOnly = {
      componentName: 'دائرة تحسس سعوية',
      materialType: 'Liquid Sensing Circuit',
      searchKeywords: ['liquid sensing'],
    };
    assert.equal(
      componentMatchesJourneyNeedle(arabicOnly, 'Capacitance'),
      false,
    );
    assert.equal(
      componentMatchesJourneyNeedle(arabicOnly, 'Capacitance|سعوية'),
      true,
    );
  });

  test('matches via searchKeywords when name/type drifted', () => {
    const drifted = {
      componentName: 'Liquid sensing addon',
      materialType: 'Custom Sensor Board',
      searchKeywords: ['capacitance', 'liquid sensing'],
    };
    assert.equal(componentMatchesJourneyNeedle(drifted, 'Capacitance'), true);
  });

  test('prefers the longest matching component name', () => {
    const match = findMatchingJourneyComponent(
      [
        { componentName: 'Cap', materialType: 'Other', searchKeywords: [] },
        NAJAH_CAPACITANCE,
      ],
      'Capacitance',
    );
    assert.equal(match?.componentName, NAJAH_CAPACITANCE.componentName);
  });

  test('does not match unrelated Arduino components', () => {
    assert.equal(
      componentMatchesJourneyNeedle(
        {
          componentName: 'Arduino Mega 2560',
          materialType: 'Arduino Mega 2560',
          searchKeywords: ['arduino mega'],
        },
        'Capacitance|سعوية',
      ),
      false,
    );
  });

  test('formats inventory for validation errors', () => {
    assert.equal(
      formatComponentInventory([NAJAH_CAPACITANCE]),
      'دائرة تحسس سعوية (Capacitance) / Capacitance Sensing Circuit',
    );
  });

  test('current Najah trainer identity still matches the MR journey needle', () => {
    const project = PROJECT_DATA_03_PROJECTS.find(
      (row) => row.key === 'najah-automated-liquid-sample-trainer',
    );
    assert.ok(project);
    const plan = MR_JOURNEY_PLANS.find((row) => row.key === 'user52-capacitance-open');
    assert.ok(plan);
    const match = findMatchingJourneyComponent(
      project.components.map((component) => ({
        componentName: component.name,
        materialType: component.materialType,
        searchKeywords: component.keywords,
      })),
      plan.componentIncludes,
    );
    assert.equal(match?.materialType, 'Capacitance Sensing Circuit');
    assert.match(match?.componentName ?? '', /Capacitance|سعوية/);
  });
});
