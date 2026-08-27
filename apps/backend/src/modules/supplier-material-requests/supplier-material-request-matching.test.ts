import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  scoreMaterialComponentRelevance,
} from '../learning-projects/learning-projects.build-candidate-ranking.js';
import { isWeakMatchScore } from '../material-requests/material-requests.lifecycle.js';
import { buildRequestRankingComponent } from './supplier-material-requests.service.js';

const material = (input: {
  title: string;
  description: string;
  materialType: string;
  tags: string[];
}) => ({
  id: input.title,
  ...input,
  condition: 'GOOD',
  isFree: false,
  price: 1,
  pickupAllowed: true,
  deliveryAllowed: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  categoryId: 'electronics',
  city: 'Nablus',
  area: null,
  supplierVerified: false,
  ownerCompletedHandovers: 0,
});

const classify = (
  candidate: ReturnType<typeof material>,
  request: Parameters<typeof buildRequestRankingComponent>[0],
) => {
  const rankingScore = scoreMaterialComponentRelevance(
    candidate,
    buildRequestRankingComponent(request),
  );
  return { rankingScore, isWeakMatch: isWeakMatchScore({ rankingScore }) };
};

describe('supplier material-request matching', () => {
  test('recognizes an HC-SR04 listing as a real ultrasonic-sensor match', () => {
    const result = classify(
      material({
        title: 'Free Workshop Ultrasonic Sensors',
        description: 'Surplus HC-SR04 sensors offered after a workshop.',
        materialType: 'Ultrasonic Sensor',
        tags: ['sensor', 'ultrasonic', 'free'],
      }),
      {
        categoryId: 'wrong-demo-category',
        requestedItemName: 'Ultrasonic distance sensor',
        description:
          'Need an HC-SR04 or similar sensor for the obstacle-avoidance robot.',
      },
    );

    assert.ok(result.rankingScore > 150);
    assert.equal(result.isWeakMatch, false);
  });

  test('marks same-category but unrelated electronics as weak', () => {
    const result = classify(
      material({
        title: 'Arduino Uno R3 Boards',
        description: 'Tested Arduino boards from a university lab.',
        materialType: 'Arduino Uno',
        tags: ['arduino', 'microcontroller', 'robotics'],
      }),
      {
        categoryId: 'electronics',
        requestedItemName: 'OAK-D Camera',
        description: 'Need an OAK-D depth camera for bottle-separator vision.',
      },
    );

    assert.equal(result.rankingScore, 150);
    assert.equal(result.isWeakMatch, true);
  });
});
