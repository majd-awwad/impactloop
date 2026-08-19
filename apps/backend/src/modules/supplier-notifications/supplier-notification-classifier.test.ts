import test from 'node:test';
import assert from 'node:assert/strict';

import { classifySupplierNotification } from './supplier-notification-classifier.js';

const reservation = (overrides: Partial<{
  status: string;
  attentionState: string;
  nextActor: string;
  availableActions: string[];
}> = {}) => ({
  kind: 'RESERVATION' as const,
  status: 'PENDING',
  attentionState: 'SUPPLIER_ACTION_REQUIRED',
  nextActor: 'SUPPLIER',
  availableActions: ['ACCEPT', 'DECLINE'],
  ...overrides,
});

test('classifies the canonical supplier categories', () => {
  assert.equal(classifySupplierNotification({ rawType: 'RESERVATION_REQUESTED', target: reservation(), resolvedAt: null }).category, 'RESERVATION');
  assert.equal(classifySupplierNotification({ rawType: 'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED', target: reservation({ availableActions: ['SUBMIT_RECOVERY_PICKUP_WINDOW'] }), resolvedAt: null }).category, 'DELIVERY_RECOVERY');
  assert.equal(classifySupplierNotification({ rawType: 'CATEGORY_REQUEST_UPDATE', target: { kind: 'CATEGORY_REQUEST', status: 'PENDING', hasDraft: true, isPublished: false }, resolvedAt: null }).category, 'MATERIAL_REVIEW');
  assert.equal(classifySupplierNotification({ rawType: 'MATERIAL_MODERATION_UPDATE', target: { kind: 'MATERIAL', status: 'AVAILABLE' }, resolvedAt: null }).category, 'MATERIAL_REVIEW');
  assert.equal(classifySupplierNotification({ rawType: 'SUPPLIER_VERIFICATION_UPDATE', target: { kind: 'SUPPLIER_PROFILE', verificationStatus: 'APPROVED' }, resolvedAt: null }).category, 'ACCOUNT');
  assert.equal(classifySupplierNotification({ rawType: 'SYSTEM_MAINTENANCE', target: { kind: 'SUPPLIER_PROFILE', verificationStatus: 'APPROVED' }, resolvedAt: null }).category, 'SYSTEM');
});

test('unknown events and missing targets fail closed', () => {
  assert.deepEqual(
    classifySupplierNotification({ rawType: 'UNRECOGNIZED_EVENT', target: null, resolvedAt: null }),
    { category: 'UNKNOWN', state: 'UNKNOWN', actionType: 'UNKNOWN', waitingOn: null },
  );
  assert.deepEqual(
    classifySupplierNotification({ rawType: 'RESERVATION_REQUESTED', target: null, resolvedAt: null }),
    { category: 'RESERVATION', state: 'UNKNOWN', actionType: 'UNKNOWN', waitingOn: null },
  );
});

test('revalidates reservation actionability and recovery', () => {
  assert.equal(classifySupplierNotification({ rawType: 'RESERVATION_REQUESTED', target: reservation(), resolvedAt: null }).actionType, 'REVIEW_RESERVATION');
  assert.equal(classifySupplierNotification({ rawType: 'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED', target: reservation({ attentionState: 'WAITING_FOR_LEARNER', nextActor: 'LEARNER', availableActions: [] }), resolvedAt: null }).state, 'WAITING');
  assert.equal(classifySupplierNotification({ rawType: 'NO_DRIVER_SUPPLIER_RESCHEDULE_REQUESTED', target: reservation({ availableActions: ['SUBMIT_RECOVERY_PICKUP_WINDOW'] }), resolvedAt: null }).actionType, 'CHOOSE_PICKUP_WINDOW');
  assert.equal(classifySupplierNotification({ rawType: 'RESERVATION_CANCELLED', target: reservation({ status: 'CANCELLED', attentionState: 'TERMINAL', nextActor: 'NONE', availableActions: [] }), resolvedAt: null }).state, 'RESOLVED');
});

test('reservation message notifications stay openable even while waiting on the learner', () => {
  const classification = classifySupplierNotification({
    rawType: 'RESERVATION_MESSAGE_RECEIVED',
    target: reservation({
      status: 'ACCEPTED',
      attentionState: 'WAITING_FOR_LEARNER',
      nextActor: 'LEARNER',
      availableActions: [],
    }),
    resolvedAt: null,
  });
  assert.equal(classification.category, 'RESERVATION');
  assert.equal(classification.state, 'UPDATE');
  assert.equal(classification.actionType, 'OPEN_RESERVATION');
});

test('classifies review decisions and account waiting state', () => {
  assert.equal(classifySupplierNotification({ rawType: 'CATEGORY_REQUEST_UPDATE', target: { kind: 'CATEGORY_REQUEST', status: 'APPROVED', hasDraft: true, isPublished: false }, resolvedAt: null }).actionType, 'CONTINUE_LISTING');
  assert.equal(classifySupplierNotification({ rawType: 'PRICE_REQUEST_UPDATE', target: { kind: 'PRICE_RULE_REQUEST', status: 'REJECTED', hasDraft: true, isPublished: false }, resolvedAt: null }).actionType, 'EDIT_LISTING');
  assert.equal(classifySupplierNotification({ rawType: 'CATEGORY_REQUEST_UPDATE', target: { kind: 'CATEGORY_REQUEST', status: 'APPROVED', hasDraft: false, isPublished: true }, resolvedAt: null }).state, 'RESOLVED');
  assert.equal(classifySupplierNotification({ rawType: 'SUPPLIER_VERIFICATION_UPDATE', target: { kind: 'SUPPLIER_PROFILE', verificationStatus: 'PENDING' }, resolvedAt: null }).waitingOn, 'ADMIN');
});
