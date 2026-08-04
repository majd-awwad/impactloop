import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  isCoverageRequiredMaterialComponent,
  isPersonallyReadyBuildItem,
  matchesMaterialAvailabilityFilter,
  summarizeMaterialCoverage,
  summarizePersonalBuildReadiness,
} from './learning-projects.material-coverage.js';

describe('learning-projects.material-coverage', () => {
  test('required material denominator excludes tools and optional components', () => {
    assert.equal(
      isCoverageRequiredMaterialComponent({
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
      }),
      true,
    );
    assert.equal(
      isCoverageRequiredMaterialComponent({
        componentRole: 'TOOL',
        isRequired: true,
      }),
      false,
    );
    assert.equal(
      isCoverageRequiredMaterialComponent({
        componentRole: 'OPTIONAL_MATERIAL',
        isRequired: false,
      }),
      false,
    );
  });

  test('PARTIAL components do not count as AVAILABLE in coverage ratio', () => {
    const summary = summarizeMaterialCoverage([
      { componentId: 'a', componentName: 'A', availabilityStatus: 'PARTIAL' },
      { componentId: 'b', componentName: 'B', availabilityStatus: 'PARTIAL' },
    ]);

    assert.equal(summary.availableComponents, 0);
    assert.equal(summary.partialComponents, 2);
    assert.equal(summary.coverageLevel, 'NONE');
    assert.equal(summary.availabilityRatio, 0);
  });

  test('personal readiness excludes checklist-only AVAILABLE and ALTERNATIVE states', () => {
    assert.equal(
      isPersonallyReadyBuildItem({
        status: 'AVAILABLE',
        acquisitionState: 'missing',
        allocationResult: 'not_applicable',
      }),
      false,
    );
    assert.equal(
      isPersonallyReadyBuildItem({
        status: 'ALTERNATIVE',
        acquisitionState: 'missing',
        allocationResult: 'not_applicable',
      }),
      false,
    );
    assert.equal(
      isPersonallyReadyBuildItem({
        status: 'SELECTED',
        acquisitionState: 'selected',
        allocationResult: 'not_applicable',
      }),
      false,
    );
    assert.equal(
      isPersonallyReadyBuildItem({
        status: 'RESERVED',
        acquisitionState: 'reserved',
        allocationResult: 'not_applicable',
      }),
      false,
    );
    assert.equal(
      isPersonallyReadyBuildItem({
        status: 'ALREADY_OWNED',
        acquisitionState: 'already_owned',
        allocationResult: 'not_applicable',
      }),
      true,
    );
    assert.equal(
      isPersonallyReadyBuildItem({
        status: 'MISSING',
        acquisitionState: 'acquired',
        allocationResult: 'sufficient',
      }),
      true,
    );
  });

  test('partial and incompatible acquisitions are not personally ready', () => {
    assert.equal(
      isPersonallyReadyBuildItem({
        status: 'MISSING',
        acquisitionState: 'acquired',
        allocationResult: 'insufficient',
      }),
      false,
    );
    assert.equal(
      isPersonallyReadyBuildItem({
        status: 'MISSING',
        acquisitionState: 'acquired',
        allocationResult: 'sufficient',
        allocationWarning: 'incompatible_unit',
      }),
      false,
    );
  });

  test('summarizePersonalBuildReadiness counts only personally ready required items', () => {
    const readiness = summarizePersonalBuildReadiness({
      buildId: 'build-1',
      buildStatus: 'IN_PROGRESS',
      items: [
        {
          id: 'item-1',
          status: 'ALREADY_OWNED',
          requiredComponent: {
            id: 'comp-1',
            projectId: 'project-1',
            componentName: 'Board',
            materialType: 'electronics',
            categoryId: null,
            quantity: { toNumber: () => 1 } as never,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            isRequired: true,
            canBeSubstituted: false,
            searchKeywords: null,
            alternativeKeywords: null,
            createdAt: new Date(),
          },
          linkedMaterial: null,
          linkedReservation: null,
        },
        {
          id: 'item-2',
          status: 'AVAILABLE',
          requiredComponent: {
            id: 'comp-2',
            projectId: 'project-1',
            componentName: 'Wire',
            materialType: 'electronics',
            categoryId: null,
            quantity: { toNumber: () => 1 } as never,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            isRequired: true,
            canBeSubstituted: false,
            searchKeywords: null,
            alternativeKeywords: null,
            createdAt: new Date(),
          },
          linkedMaterial: null,
          linkedReservation: null,
        },
      ],
      allocationByItemId: new Map([
        [
          'item-1',
          {
            requiredQuantity: 1,
            requiredUnit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            materialUnit: null,
            availableQuantity: null,
            peerClaimsOnMaterial: 0,
            allocationWarning: null,
          },
        ],
        [
          'item-2',
          {
            requiredQuantity: 1,
            requiredUnit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            materialUnit: null,
            availableQuantity: null,
            peerClaimsOnMaterial: 0,
            allocationWarning: null,
          },
        ],
      ]),
    });

    assert.equal(readiness?.readyComponents, 1);
    assert.equal(readiness?.totalRequiredComponents, 2);
    assert.equal(readiness?.needsMaterialComponents, 1);
  });

  test('matchesMaterialAvailabilityFilter supports canonical browse filters', () => {
    const full = summarizeMaterialCoverage([
      { componentId: 'a', componentName: 'A', availabilityStatus: 'AVAILABLE' },
      { componentId: 'b', componentName: 'B', availabilityStatus: 'AVAILABLE' },
    ]);
    const none = summarizeMaterialCoverage([
      { componentId: 'a', componentName: 'A', availabilityStatus: 'MISSING' },
      { componentId: 'b', componentName: 'B', availabilityStatus: 'PARTIAL' },
    ]);

    assert.equal(matchesMaterialAvailabilityFilter(full, 'ANY'), true);
    assert.equal(matchesMaterialAvailabilityFilter(full, 'FULL'), true);
    assert.equal(matchesMaterialAvailabilityFilter(none, 'NONE'), true);
    assert.equal(matchesMaterialAvailabilityFilter(none, 'FULL'), false);
  });
});
