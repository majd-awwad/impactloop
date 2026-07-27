import assert from 'node:assert/strict';
import test from 'node:test';

import {
  composeAdminDeliveryContract,
  type AdminDeliveryClassifierContext,
} from './admin-deliveries.classifier.js';

const baseContext = (): AdminDeliveryClassifierContext => ({
  delivery: {
    id: 'delivery-1',
    status: 'WAITING_FOR_DRIVER',
    deliveryGroupId: null,
    assignedDriverProfileId: null,
  },
  reservation: {
    id: 'reservation-1',
    status: 'ACCEPTED',
    pendingRescheduleRequestedBy: null,
    pendingRescheduleReason: null,
  },
  primaryIncident: null,
  hasExpectedRecoveryIncident: true,
  canReopenDriverAssignment: false,
  assignments: [],
});

test('uses mutually exclusive KPI precedence for actionable recovery', () => {
  const context = baseContext();
  context.delivery.status = 'DRIVER_NO_SHOW';
  context.reservation.status = 'AWAITING_RESOLUTION';
  context.primaryIncident = {
    id: 'report-1',
    workflowType: 'ACCOUNTABILITY_AND_RECOVERY',
    operationalState: 'REQUIRES_RESOLUTION',
    availableActions: ['VERIFY', 'REQUEST_SUPPLIER_RESCHEDULE'],
  };

  const contract = composeAdminDeliveryContract(context);
  assert.equal(contract.lifecyclePhase, 'RECOVERY_REQUIRED');
  assert.equal(contract.adminAttentionState, 'ACTION_REQUIRED');
  assert.equal(contract.kpiBucket, 'NEEDS_ADMIN_REVIEW');
});

test('keeps recovery resubmission waiting external only when no decision remains', () => {
  const context = baseContext();
  context.delivery.status = 'DRIVER_NO_SHOW';
  context.reservation.status = 'AWAITING_SUPPLIER_CONFIRMATION';

  const contract = composeAdminDeliveryContract(context);
  assert.equal(contract.lifecyclePhase, 'RECOVERY_IN_PROGRESS');
  assert.equal(contract.adminAttentionState, 'WAITING_EXTERNAL_PARTY');
  assert.equal(contract.kpiBucket, 'ACTIVE_IN_PROGRESS');
});

test('preserves an actionable incident during recovery resubmission', () => {
  const context = baseContext();
  context.delivery.status = 'DRIVER_NO_SHOW';
  context.reservation.status = 'AWAITING_SUPPLIER_CONFIRMATION';
  context.primaryIncident = {
    id: 'report-1',
    workflowType: 'ACCOUNTABILITY_AND_RECOVERY',
    operationalState: 'RESOLVED',
    availableActions: ['VERIFY', 'REJECT', 'RESOLVE_WITHOUT_STRIKE'],
  };

  const contract = composeAdminDeliveryContract(context);
  assert.equal(contract.adminAttentionState, 'ACTION_REQUIRED');
  assert.equal(contract.kpiBucket, 'NEEDS_ADMIN_REVIEW');
});

test('distinguishes active, released, and historical assignment states', () => {
  const context = baseContext();
  context.delivery.status = 'DRIVER_ASSIGNED';
  context.delivery.assignedDriverProfileId = 'driver-1';
  context.assignments = [{
    id: 'assignment-1',
    status: 'ACTIVE',
    acceptedAt: new Date('2026-01-01T00:00:00.000Z'),
    driver: { id: 'driver-1', displayName: 'Driver', email: 'driver@example.com' },
  }];
  assert.equal(composeAdminDeliveryContract(context).assignmentState, 'ACTIVE');

  context.delivery.status = 'WAITING_FOR_DRIVER';
  context.delivery.assignedDriverProfileId = null;
  context.assignments[0].status = 'RELEASED';
  assert.equal(composeAdminDeliveryContract(context).assignmentState, 'RELEASED');

  context.delivery.status = 'DELIVERED';
  assert.equal(composeAdminDeliveryContract(context).assignmentState, 'HISTORICAL');
});
