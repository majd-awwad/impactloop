import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { Prisma } from '../../generated/prisma/client.js';

import { resolveBuildItemState, resolveBuildItemStepUnlockReadinessFromState } from './learning-projects.build-item-state.js';
import type {
  LinkedMaterialRecord,
  LinkedReservationRecord,
} from './learning-projects.build-material-linking.js';

const completedReservation = {
  id: 'res-1',
  status: 'COMPLETED',
  quantityRequested: new Prisma.Decimal(1),
  materialId: 'mat-1',
} as LinkedReservationRecord;

const linkedMaterial = {
  id: 'mat-1',
  title: 'Linked material',
  condition: 'GOOD',
  status: 'REUSED',
  isFree: true,
  price: null,
  currency: 'NIS',
  pickupAllowed: true,
  deliveryAllowed: false,
  ownerId: 'owner-1',
  materialType: 'Bags',
  unit: 'bags',
  category: { id: 'cat-1', nameEn: 'Packaging', nameAr: 'تغليف' },
  location: { city: 'Ramallah', area: 'Al Bireh' },
  images: [],
  supplierProfile: null,
  owner: { displayName: 'Supplier' },
} as LinkedMaterialRecord;

describe('learning-projects.build-item-state', () => {
  test('selected incompatible unit stays selected with incompatible allocation', () => {
    const resolved = resolveBuildItemState({
      status: 'MISSING',
      requiredQuantity: 1,
      requiredUnit: 'piece',
      materialUnit: 'bags',
      linkedMaterial,
    });

    assert.equal(resolved.acquisitionState, 'selected');
    assert.equal(resolved.allocationResult, 'incompatible_unit');
    assert.equal(resolved.isReadyForBuild, false);
  });

  test('completed incompatible unit is acquired with incompatible allocation', () => {
    const resolved = resolveBuildItemState({
      status: 'MISSING',
      requiredQuantity: 1,
      requiredUnit: 'piece',
      materialUnit: 'bags',
      linkedMaterial,
      linkedReservation: completedReservation,
    });

    assert.equal(resolved.acquisitionState, 'acquired');
    assert.equal(resolved.allocationResult, 'incompatible_unit');
    assert.equal(resolved.isReadyForBuild, false);
    assert.equal(resolved.quantityAllocation?.acquiredQuantity, 1);
  });

  test('completed insufficient quantity is acquired but not ready', () => {
    const resolved = resolveBuildItemState({
      status: 'MISSING',
      requiredQuantity: 4,
      requiredUnit: 'pieces',
      materialUnit: 'piece',
      linkedMaterial: { ...linkedMaterial, unit: 'piece' },
      linkedReservation: {
        ...completedReservation,
        quantityRequested: new Prisma.Decimal(2),
      },
    });

    assert.equal(resolved.acquisitionState, 'acquired');
    assert.equal(resolved.allocationResult, 'insufficient_quantity');
    assert.equal(resolved.isReadyForBuild, false);
  });

  test('completed sufficient compatible quantity is acquired and ready', () => {
    const resolved = resolveBuildItemState({
      status: 'MISSING',
      requiredQuantity: 1,
      requiredUnit: 'piece',
      materialUnit: 'piece',
      linkedMaterial: { ...linkedMaterial, unit: 'piece' },
      linkedReservation: completedReservation,
    });

    assert.equal(resolved.acquisitionState, 'acquired');
    assert.equal(resolved.allocationResult, 'sufficient');
    assert.equal(resolved.isReadyForBuild, true);
  });
});

describe('learning-projects.build-item-state step unlock', () => {
  test('AVAILABLE self-report is ready for build but does not unlock steps', () => {
    const resolved = resolveBuildItemState({ status: 'AVAILABLE' });
    const stepUnlock = resolveBuildItemStepUnlockReadinessFromState({
      status: 'AVAILABLE',
    });

    assert.equal(resolved.isReadyForBuild, true);
    assert.equal(stepUnlock.isReadyForStepUnlock, false);
  });

  test('ALTERNATIVE self-report is ready for build but does not unlock steps', () => {
    const resolved = resolveBuildItemState({ status: 'ALTERNATIVE' });
    const stepUnlock = resolveBuildItemStepUnlockReadinessFromState({
      status: 'ALTERNATIVE',
    });

    assert.equal(resolved.isReadyForBuild, true);
    assert.equal(stepUnlock.isReadyForStepUnlock, false);
  });

  test('ALREADY_OWNED unlocks steps under existing checklist semantics', () => {
    const resolved = resolveBuildItemState({ status: 'ALREADY_OWNED' });
    const stepUnlock = resolveBuildItemStepUnlockReadinessFromState({
      status: 'ALREADY_OWNED',
    });

    assert.equal(resolved.isReadyForBuild, true);
    assert.equal(stepUnlock.isReadyForStepUnlock, true);
  });

  test('completed sufficient compatible acquisition unlocks steps', () => {
    const stepUnlock = resolveBuildItemStepUnlockReadinessFromState({
      status: 'MISSING',
      requiredQuantity: 1,
      requiredUnit: 'piece',
      materialUnit: 'piece',
      linkedMaterial: { ...linkedMaterial, unit: 'piece' },
      linkedReservation: completedReservation,
    });

    assert.equal(stepUnlock.isReadyForStepUnlock, true);
  });

  test('partial completed acquisition stays locked for steps', () => {
    const stepUnlock = resolveBuildItemStepUnlockReadinessFromState({
      status: 'MISSING',
      requiredQuantity: 4,
      requiredUnit: 'pieces',
      materialUnit: 'piece',
      linkedMaterial: { ...linkedMaterial, unit: 'piece' },
      linkedReservation: {
        ...completedReservation,
        quantityRequested: new Prisma.Decimal(2),
      },
    });

    assert.equal(stepUnlock.isReadyForStepUnlock, false);
  });

  test('incompatible completed acquisition stays locked for steps', () => {
    const stepUnlock = resolveBuildItemStepUnlockReadinessFromState({
      status: 'MISSING',
      requiredQuantity: 1,
      requiredUnit: 'piece',
      materialUnit: 'bags',
      linkedMaterial,
      linkedReservation: completedReservation,
    });

    assert.equal(stepUnlock.isReadyForStepUnlock, false);
  });
});
