import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  CASH_HANDOVER_DEMO_KEY,
  CASH_HANDOVER_PREFERRED_TITLES,
  DRIVER_ON_THE_WAY_DEMO_KEY,
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
} from './local-demo-keys.js';
import {
  assertPreferredTitleSetsAreDisjoint,
  canMutateReservationForDemo,
  selectIsolatedScenarioCandidate,
  type ScenarioCandidate,
} from './prepare-delivery-isolation.js';

const candidate = (
  overrides: Partial<ScenarioCandidate> &
    Pick<ScenarioCandidate, 'reservationId' | 'materialTitle'>,
): ScenarioCandidate => ({
  deliveryId: overrides.deliveryId ?? `d-${overrides.reservationId}`,
  reservationStatus: overrides.reservationStatus ?? 'ACCEPTED',
  paymentMethod: overrides.paymentMethod ?? 'CASH',
  message: overrides.message ?? null,
  deliveryNote: overrides.deliveryNote ?? null,
  ...overrides,
});

describe('delivery scenario isolation', () => {
  test('CASH and ON_THE_WAY preferred materials are disjoint', () => {
    assertPreferredTitleSetsAreDisjoint();
    for (const title of CASH_HANDOVER_PREFERRED_TITLES) {
      assert.equal(DRIVER_ON_THE_WAY_PREFERRED_TITLES.includes(title as never), false);
    }
  });

  test('refuses to mutate COMPLETED reservations', () => {
    assert.equal(canMutateReservationForDemo('COMPLETED'), false);
    assert.equal(canMutateReservationForDemo('ACCEPTED'), true);
    assert.equal(canMutateReservationForDemo('PENDING'), true);
  });

  test('CASH selector never consumes the ON_THE_WAY reservation', () => {
    const cash = candidate({
      reservationId: 'r-cash',
      materialTitle: 'Mixed Color LED Packs',
      deliveryNote: CASH_HANDOVER_DEMO_KEY,
    });
    const driver = candidate({
      reservationId: 'r-driver',
      materialTitle: 'Resistor Assortment Boxes',
      message: DRIVER_ON_THE_WAY_DEMO_KEY,
      paymentMethod: 'CARD',
    });

    const cashPick = selectIsolatedScenarioCandidate({
      kind: 'cash-handover',
      candidates: [driver, cash],
    });
    const driverPick = selectIsolatedScenarioCandidate({
      kind: 'driver-on-the-way',
      candidates: [cash, driver],
    });

    assert.equal(cashPick.selected?.reservationId, 'r-cash');
    assert.equal(driverPick.selected?.reservationId, 'r-driver');
    assert.notEqual(
      cashPick.selected?.reservationId,
      driverPick.selected?.reservationId,
    );
  });

  test('does not select COMPLETED or the other scenario material', () => {
    const completedCash = candidate({
      reservationId: 'r-done',
      materialTitle: 'Mixed Color LED Packs',
      reservationStatus: 'COMPLETED',
      deliveryNote: CASH_HANDOVER_DEMO_KEY,
    });
    const resistor = candidate({
      reservationId: 'r-resistor',
      materialTitle: 'Resistor Assortment Boxes',
      reservationStatus: 'ACCEPTED',
    });

    const cashPick = selectIsolatedScenarioCandidate({
      kind: 'cash-handover',
      candidates: [completedCash, resistor],
    });
    assert.equal(cashPick.selected, null);
    assert.equal(
      cashPick.skipped.some((row) => row.reservationId === 'r-done'),
      true,
    );
    assert.equal(
      cashPick.skipped.some((row) => row.reservationId === 'r-resistor'),
      true,
    );
  });
});
