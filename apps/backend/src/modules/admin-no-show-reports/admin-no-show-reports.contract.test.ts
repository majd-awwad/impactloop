import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyAdminReportContract,
  type AdminReportClassifierContext,
} from './admin-no-show-reports.classifier.js';

const baseContext = (): AdminReportClassifierContext => ({
  report: {
    status: 'PENDING_REVIEW',
    reasonCode: 'REPEATED_DELAY',
    targetRole: 'LEARNER',
    targetUserId: 'learner-1',
    deliveryId: null,
  },
  reservation: {
    status: 'ACCEPTED',
    fulfillmentMethod: 'PICKUP',
    pendingRescheduleRequestedBy: null,
    pendingRescheduleReason: null,
  },
  delivery: null,
});

test('classifies standard accountability reports and their pending actions', () => {
  const contract = classifyAdminReportContract(baseContext());

  assert.deepEqual(contract, {
    workflowType: 'ACCOUNTABILITY',
    operationalState: 'NOT_REQUIRED',
    strikeImpact: 'STRIKE_IF_VERIFIED',
    availableActions: ['VERIFY', 'REJECT', 'RESOLVE_WITHOUT_STRIKE'],
  });
});

test('classifies delivery-linked system recovery without accountability actions', () => {
  const context = baseContext();
  context.report.reasonCode = 'NO_DRIVER_AVAILABLE';
  context.report.targetRole = 'SYSTEM';
  context.report.targetUserId = null;
  context.report.deliveryId = 'delivery-1';
  context.reservation.status = 'AWAITING_RESOLUTION';
  context.reservation.fulfillmentMethod = 'DELIVERY';
  context.delivery = {
    id: 'delivery-1',
    status: 'AWAITING_RESOLUTION',
    assignedDriverProfileId: null,
  };

  const contract = classifyAdminReportContract(context);

  assert.equal(contract.workflowType, 'SYSTEM_RECOVERY');
  assert.equal(contract.operationalState, 'REQUIRES_RESOLUTION');
  assert.equal(contract.strikeImpact, 'NONE');
  assert.deepEqual(contract.availableActions, [
    'REQUEST_SUPPLIER_RESCHEDULE',
    'CANCEL_AND_RELEASE_HOLD',
  ]);
});

test('keeps accountability-and-recovery workflow stable after recovery', () => {
  const context = baseContext();
  context.report.reasonCode = 'PICKUP_FAILED';
  context.report.targetRole = 'SUPPLIER';
  context.report.deliveryId = 'delivery-1';
  context.reservation.status = 'AWAITING_RESOLUTION';
  context.reservation.fulfillmentMethod = 'DELIVERY';
  context.delivery = {
    id: 'delivery-1',
    status: 'FAILED_PICKUP',
    assignedDriverProfileId: null,
  };

  const beforeRecovery = classifyAdminReportContract(context);
  assert.equal(beforeRecovery.workflowType, 'ACCOUNTABILITY_AND_RECOVERY');
  assert.deepEqual(beforeRecovery.availableActions, [
    'VERIFY',
    'REQUEST_SUPPLIER_RESCHEDULE',
    'CANCEL_AND_RELEASE_HOLD',
  ]);

  context.reservation.status = 'AWAITING_SUPPLIER_CONFIRMATION';
  context.reservation.pendingRescheduleRequestedBy = 'SUPPLIER';
  context.reservation.pendingRescheduleReason = 'STALE_PICKUP_ADMIN_REQUEST';
  const afterRecovery = classifyAdminReportContract(context);

  assert.equal(afterRecovery.workflowType, 'ACCOUNTABILITY_AND_RECOVERY');
  assert.equal(afterRecovery.operationalState, 'RESOLVED');
  assert.deepEqual(afterRecovery.availableActions, [
    'VERIFY',
    'REJECT',
    'RESOLVE_WITHOUT_STRIKE',
  ]);
});

test('fails closed for an individual recovery target with no target user', () => {
  const context = baseContext();
  context.report.reasonCode = 'DRIVER_DID_NOT_ARRIVE';
  context.report.targetRole = 'DRIVER';
  context.report.targetUserId = null;
  context.report.deliveryId = 'delivery-1';
  context.reservation.status = 'AWAITING_RESOLUTION';
  context.reservation.fulfillmentMethod = 'DELIVERY';
  context.delivery = {
    id: 'delivery-1',
    status: 'DRIVER_NO_SHOW',
    assignedDriverProfileId: null,
  };

  const beforeRecovery = classifyAdminReportContract(context);
  assert.equal(beforeRecovery.workflowType, 'ACCOUNTABILITY_AND_RECOVERY');
  assert.equal(beforeRecovery.strikeImpact, 'NONE');
  assert.deepEqual(beforeRecovery.availableActions, [
    'REQUEST_SUPPLIER_RESCHEDULE',
    'CANCEL_AND_RELEASE_HOLD',
  ]);

  context.reservation.status = 'EXPIRED';
  const afterRecovery = classifyAdminReportContract(context);
  assert.equal(afterRecovery.workflowType, 'ACCOUNTABILITY_AND_RECOVERY');
  assert.equal(afterRecovery.operationalState, 'RESOLVED');
  assert.deepEqual(afterRecovery.availableActions, ['RESOLVE_WITHOUT_STRIKE']);
});
