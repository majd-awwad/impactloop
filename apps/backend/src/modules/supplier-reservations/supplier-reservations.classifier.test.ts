import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  composeSupplierReservationContract,
  type SupplierReservationClassifierContext,
} from './supplier-reservations.classifier.js';
import { listSupplierReservationsQuerySchema } from './supplier-reservations.validation.js';

const context = (
  status: string,
  overrides: Partial<SupplierReservationClassifierContext> = {},
): SupplierReservationClassifierContext => ({
  status,
  fulfillmentMethod: 'PICKUP',
  deliveryStatus: null,
  hasDelivery: false,
  canAccept: false,
  canDecline: false,
  canSendMessage: false,
  canSupplierComplete: false,
  canSupplierReschedule: false,
  canSupplierAcceptLearnerReschedule: false,
  canSupplierProposeDifferentTime: false,
  canSupplierClose: false,
  canMarkLearnerNoShow: false,
  canReportIncident: false,
  canReportNoDriverAvailable: false,
  canMarkDeliveryPickupExpired: false,
  canReportDriverNoShow: false,
  canSubmitRecoveryPickupWindow: false,
  ...overrides,
});

describe('supplier reservation classifier', () => {
  test('list query defaults and every raw status remain accepted', () => {
    const defaults = listSupplierReservationsQuerySchema.parse({});
    assert.equal(defaults.page, 1);
    assert.equal(defaults.limit, 20);
    assert.equal(defaults.historyScope, 'ALL');

    for (const status of [
      'PENDING',
      'AWAITING_LEARNER_CONFIRMATION',
      'AWAITING_SUPPLIER_CONFIRMATION',
      'ACCEPTED',
      'REJECTED',
      'CANCELLED',
      'COMPLETED',
      'EXPIRED',
      'NO_SHOW',
      'FULFILLMENT_FAILED',
      'AWAITING_RESOLUTION',
    ]) {
      assert.equal(listSupplierReservationsQuerySchema.parse({ status }).status, status);
    }

    assert.equal(
      listSupplierReservationsQuerySchema.safeParse({
        dateFrom: '2026-07-16T00:00:00.000Z',
        dateTo: '2026-07-15T00:00:00.000Z',
      }).success,
      false,
    );
  });

  test('PENDING requires supplier accept or decline', () => {
    const result = composeSupplierReservationContract(
      context('PENDING', { canAccept: true, canDecline: true, canSendMessage: true }),
    );
    assert.equal(result.attentionState, 'SUPPLIER_ACTION_REQUIRED');
    assert.equal(result.nextActor, 'SUPPLIER');
    assert.deepEqual(result.availableActions, ['ACCEPT', 'DECLINE', 'SEND_MESSAGE']);
  });

  test('awaiting learner stays waiting even when messaging is available', () => {
    const result = composeSupplierReservationContract(
      context('AWAITING_LEARNER_CONFIRMATION', { canSendMessage: true }),
    );
    assert.equal(result.attentionState, 'WAITING_FOR_LEARNER');
    assert.equal(result.nextActor, 'LEARNER');
    assert.equal(result.summaryBucket, 'WAITING_FOR_LEARNER');
  });

  test('learner reschedule and recovery resubmission are both supplier action', () => {
    const learnerReschedule = composeSupplierReservationContract(
      context('AWAITING_SUPPLIER_CONFIRMATION', {
        canSupplierAcceptLearnerReschedule: true,
        canSupplierProposeDifferentTime: true,
      }),
    );
    const recovery = composeSupplierReservationContract(
      context('AWAITING_SUPPLIER_CONFIRMATION', {
        fulfillmentMethod: 'DELIVERY',
        hasDelivery: true,
        deliveryStatus: 'AWAITING_RESOLUTION',
        canSubmitRecoveryPickupWindow: true,
      }),
    );
    assert.equal(learnerReschedule.attentionState, 'SUPPLIER_ACTION_REQUIRED');
    assert.ok(learnerReschedule.availableActions.includes('ACCEPT_LEARNER_RESCHEDULE'));
    assert.deepEqual(recovery.availableActions, ['SUBMIT_RECOVERY_PICKUP_WINDOW']);
  });

  test('self pickup switches from learner handover to supplier completion action', () => {
    const before = composeSupplierReservationContract(context('ACCEPTED'));
    const during = composeSupplierReservationContract(
      context('ACCEPTED', { canSupplierComplete: true }),
    );
    assert.equal(before.attentionState, 'FULFILLMENT_IN_PROGRESS');
    assert.equal(before.nextActor, 'LEARNER');
    assert.equal(during.attentionState, 'SUPPLIER_ACTION_REQUIRED');
    assert.ok(during.availableActions.includes('COMPLETE_SELF_PICKUP'));
  });

  test('delivery fulfillment belongs to the driver until supplier escalation is authorized', () => {
    const waiting = composeSupplierReservationContract(
      context('ACCEPTED', {
        fulfillmentMethod: 'DELIVERY',
        hasDelivery: true,
        deliveryStatus: 'WAITING_FOR_DRIVER',
      }),
    );
    const overdue = composeSupplierReservationContract(
      context('ACCEPTED', {
        fulfillmentMethod: 'DELIVERY',
        hasDelivery: true,
        deliveryStatus: 'WAITING_FOR_DRIVER',
        canReportNoDriverAvailable: true,
      }),
    );
    assert.equal(waiting.nextActor, 'DRIVER');
    assert.equal(waiting.summaryBucket, 'FULFILLMENT_IN_PROGRESS');
    assert.equal(overdue.attentionState, 'SUPPLIER_ACTION_REQUIRED');
    assert.ok(overdue.availableActions.includes('REPORT_NO_DRIVER'));
  });

  test('admin review and every terminal raw status are exhaustive', () => {
    const review = composeSupplierReservationContract(context('AWAITING_RESOLUTION'));
    assert.equal(review.attentionState, 'ADMIN_REVIEW_REQUIRED');
    assert.equal(review.nextActor, 'ADMIN');

    for (const status of [
      'COMPLETED',
      'REJECTED',
      'CANCELLED',
      'EXPIRED',
      'NO_SHOW',
      'FULFILLMENT_FAILED',
    ]) {
      const result = composeSupplierReservationContract(context(status));
      assert.equal(result.attentionState, 'TERMINAL');
      assert.equal(result.nextActor, 'NONE');
      assert.equal(
        result.summaryBucket,
        status === 'COMPLETED' ? 'COMPLETED' : 'CLOSED',
      );
    }
  });
});
