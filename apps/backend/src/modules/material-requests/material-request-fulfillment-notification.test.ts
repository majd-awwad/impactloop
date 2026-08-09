import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMaterialRequestFulfilledNotification } from './material-request-fulfillment-notification.js';

test('builds the canonical material-request fulfillment notification', () => {
  assert.deepEqual(
    buildMaterialRequestFulfilledNotification({
      requestId: 'request-1',
      learnerId: 'learner-1',
      requestedItemName: 'DC motor',
    }),
    {
      userId: 'learner-1',
      notificationType: 'MATERIAL_REQUEST_FULFILLED',
      title: 'Material request fulfilled',
      body: 'Your request "DC motor" was marked fulfilled after a completed reservation.',
      relatedEntityType: 'MATERIAL_REQUEST',
      relatedEntityId: 'request-1',
      eventKey: 'mr:fulfilled:request-1',
      entityType: 'MATERIAL_REQUEST',
      entityId: 'request-1',
      actionType: 'OPEN_ENTITY',
    },
  );
});
