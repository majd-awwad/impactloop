import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildNoShowReportIncidentKey,
  resolveNoShowReportIncidentKey,
} from './no-show-report.incident-key.js';

describe('no-show report incident key', () => {
  test('includes delivery, target, and reason when all dimensions matter', () => {
    assert.equal(
      buildNoShowReportIncidentKey({
        reservationId: 'res-1',
        deliveryId: 'del-1',
        targetRole: 'DRIVER',
        targetUserId: 'user-1',
        reasonCode: 'DRIVER_DID_NOT_ARRIVE',
      }),
      'res-1:del-1:DRIVER:user-1:DRIVER_DID_NOT_ARRIVE',
    );
  });

  test('uses wildcard reason for one-per-target supplier incidents', () => {
    assert.equal(
      buildNoShowReportIncidentKey({
        reservationId: 'res-1',
        deliveryId: null,
        targetRole: 'SUPPLIER',
        targetUserId: 'supplier-1',
        includeReasonCode: false,
      }),
      'res-1:_:SUPPLIER:supplier-1:*',
    );
  });

  test('resolves system no-driver incidents without delivery dimension', () => {
    assert.equal(
      resolveNoShowReportIncidentKey({
        reservationId: 'res-1',
        deliveryId: 'del-1',
        targetRole: 'SYSTEM',
        reasonCode: 'NO_DRIVER_AVAILABLE',
      }),
      'res-1:_:SYSTEM:_:NO_DRIVER_AVAILABLE',
    );
  });

  test('resolves partial pickup incidents with delivery-specific keys', () => {
    assert.equal(
      resolveNoShowReportIncidentKey({
        reservationId: 'res-1',
        deliveryId: 'del-1',
        targetRole: 'SUPPLIER',
        targetUserId: 'supplier-1',
        reasonCode: 'PICKUP_FAILED',
        note: 'PARTIAL_PICKUP_INCIDENT; reason=OTHER',
      }),
      'res-1:del-1:SUPPLIER:supplier-1:PICKUP_FAILED',
    );
  });
});
