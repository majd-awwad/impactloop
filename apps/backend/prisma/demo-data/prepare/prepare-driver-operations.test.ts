import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  CASH_HANDOVER_DEMO_KEY,
  CASH_HANDOVER_PREFERRED_TITLES,
  DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
  DRIVER_FIGURE_357_GROUPED_TITLES,
  DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
  DRIVER_FIGURE_357_INCIDENT_TITLES,
  DRIVER_ON_THE_WAY_DEMO_KEY,
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
  hasDemoMarker,
} from './local-demo-keys.js';
import {
  buildFeasibleDeliveryScheduling,
  isDriverFigure357Ready,
  isForbiddenDriverFigure357Material,
} from './prepare-driver-operations.js';

describe('driver-operations demo markers', () => {
  test('uses Figure 3.57 local-demo namespaces distinct from CASH and ON_THE_WAY', () => {
    assert.equal(
      DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
      'local-demo:driver-figure-357-grouped-v1',
    );
    assert.equal(
      DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
      'local-demo:driver-figure-357-incident-v1',
    );
    assert.notEqual(DRIVER_FIGURE_357_GROUPED_DEMO_KEY, CASH_HANDOVER_DEMO_KEY);
    assert.notEqual(
      DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
      DRIVER_ON_THE_WAY_DEMO_KEY,
    );
    assert.notEqual(
      DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
      CASH_HANDOVER_DEMO_KEY,
    );
    assert.notEqual(
      DRIVER_FIGURE_357_INCIDENT_DEMO_KEY,
      DRIVER_ON_THE_WAY_DEMO_KEY,
    );
  });

  test('recognizes stamped reservation markers', () => {
    assert.equal(
      hasDemoMarker(
        `Grouped job [${DRIVER_FIGURE_357_GROUPED_DEMO_KEY}]`,
        DRIVER_FIGURE_357_GROUPED_DEMO_KEY,
      ),
      true,
    );
    assert.equal(
      hasDemoMarker('unrelated note', DRIVER_FIGURE_357_INCIDENT_DEMO_KEY),
      false,
    );
  });
});

describe('driver-operations material isolation', () => {
  test('never uses CASH handover or ON_THE_WAY preferred materials', () => {
    for (const title of CASH_HANDOVER_PREFERRED_TITLES) {
      assert.equal(isForbiddenDriverFigure357Material(title), true);
    }
    for (const title of DRIVER_ON_THE_WAY_PREFERRED_TITLES) {
      assert.equal(isForbiddenDriverFigure357Material(title), true);
    }
    for (const title of DRIVER_FIGURE_357_GROUPED_TITLES) {
      assert.equal(isForbiddenDriverFigure357Material(title), false);
    }
    for (const title of DRIVER_FIGURE_357_INCIDENT_TITLES) {
      assert.equal(isForbiddenDriverFigure357Material(title), false);
    }
  });
});

describe('driver-operations scheduling helpers', () => {
  test('builds a future pickup then later delivery window', () => {
    const scheduling = buildFeasibleDeliveryScheduling(36);
    const pickupStart = Date.parse(scheduling.supplierPickup.start);
    const pickupEnd = Date.parse(scheduling.supplierPickup.end);
    const deliveryStart = Date.parse(scheduling.learnerDelivery.start);
    const deliveryEnd = Date.parse(scheduling.learnerDelivery.end);

    assert.ok(pickupEnd > pickupStart);
    assert.ok(deliveryEnd > deliveryStart);
    assert.ok(deliveryStart >= pickupStart);
  });
});

describe('driver-operations screenshot readiness', () => {
  test('requires availability preference, grouped history, incident, and isolation', () => {
    assert.equal(
      isDriverFigure357Ready({
        driverAvailablePreference: true,
        groupedCompletedVisible: true,
        groupedItemCount: 2,
        groupedOperationalDeliveries: 1,
        incidentVisible: true,
        cashScenarioUntouched: true,
        onTheWayScenarioUntouched: true,
      }),
      true,
    );

    assert.equal(
      isDriverFigure357Ready({
        driverAvailablePreference: false,
        groupedCompletedVisible: true,
        groupedItemCount: 2,
        groupedOperationalDeliveries: 1,
        incidentVisible: true,
        cashScenarioUntouched: true,
        onTheWayScenarioUntouched: true,
      }),
      false,
    );

    assert.equal(
      isDriverFigure357Ready({
        driverAvailablePreference: true,
        groupedCompletedVisible: true,
        groupedItemCount: 1,
        groupedOperationalDeliveries: 1,
        incidentVisible: true,
        cashScenarioUntouched: true,
        onTheWayScenarioUntouched: true,
      }),
      false,
    );

    assert.equal(
      isDriverFigure357Ready({
        driverAvailablePreference: true,
        groupedCompletedVisible: true,
        groupedItemCount: 2,
        groupedOperationalDeliveries: 2,
        incidentVisible: true,
        cashScenarioUntouched: true,
        onTheWayScenarioUntouched: true,
      }),
      false,
    );

    assert.equal(
      isDriverFigure357Ready({
        driverAvailablePreference: true,
        groupedCompletedVisible: true,
        groupedItemCount: 2,
        groupedOperationalDeliveries: 1,
        incidentVisible: false,
        cashScenarioUntouched: true,
        onTheWayScenarioUntouched: true,
      }),
      false,
    );

    assert.equal(
      isDriverFigure357Ready({
        driverAvailablePreference: true,
        groupedCompletedVisible: true,
        groupedItemCount: 2,
        groupedOperationalDeliveries: 1,
        incidentVisible: true,
        cashScenarioUntouched: false,
        onTheWayScenarioUntouched: true,
      }),
      false,
    );
  });
});
