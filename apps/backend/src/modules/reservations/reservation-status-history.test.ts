import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatReservationHistoryNote,
  mapLegacyReservationHistoryNote,
  parseReservationHistoryNote,
} from './reservation-status-history.js';

test('formatReservationHistoryNote stores machine-readable event codes', () => {
  assert.equal(
    formatReservationHistoryNote('ACCEPTED_BY_SUPPLIER'),
    'event:ACCEPTED_BY_SUPPLIER',
  );
  assert.equal(
    formatReservationHistoryNote('DECLINED_BY_SUPPLIER', {
      reasonText: 'Out of stock',
    }),
    'event:DECLINED_BY_SUPPLIER|Out of stock',
  );
});

test('parseReservationHistoryNote reads coded notes and preserves reason text', () => {
  assert.deepEqual(parseReservationHistoryNote('event:ACCEPTED_BY_SUPPLIER'), {
    eventCode: 'ACCEPTED_BY_SUPPLIER',
    reasonText: null,
  });
  assert.deepEqual(
    parseReservationHistoryNote(
      'event:SUPPLIER_REQUESTED_RESCHEDULE|Need more prep time',
    ),
    {
      eventCode: 'SUPPLIER_REQUESTED_RESCHEDULE',
      reasonText: 'Need more prep time',
    },
  );
});

test('mapLegacyReservationHistoryNote maps known English system notes', () => {
  assert.deepEqual(
    mapLegacyReservationHistoryNote('Pickup completed by supplier'),
    {
      eventCode: 'PICKUP_COMPLETED_BY_SUPPLIER',
      reasonText: null,
    },
  );
  assert.deepEqual(
    mapLegacyReservationHistoryNote(
      'Supplier requested reschedule: Need more prep time',
    ),
    {
      eventCode: 'SUPPLIER_REQUESTED_RESCHEDULE',
      reasonText: 'Need more prep time',
    },
  );
});

test('parseReservationHistoryNote infers decline and fulfillment notes from transitions', () => {
  assert.deepEqual(
    parseReservationHistoryNote('Out of stock', {
      oldStatus: 'PENDING',
      newStatus: 'REJECTED',
    }),
    {
      eventCode: 'DECLINED_BY_SUPPLIER',
      reasonText: 'Out of stock',
    },
  );
  assert.deepEqual(
    parseReservationHistoryNote('Driver did not arrive', {
      oldStatus: 'ACCEPTED',
      newStatus: 'AWAITING_RESOLUTION',
    }),
    {
      eventCode: 'FULFILLMENT_ISSUE_REPORTED',
      reasonText: 'Driver did not arrive',
    },
  );
});
