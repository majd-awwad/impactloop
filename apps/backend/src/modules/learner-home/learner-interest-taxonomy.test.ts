import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  buildInterestMatchReason,
  buildMaterialMatchHaystack,
  getLearnerInterestOptionsResponse,
  isCustomInterestKey,
  matchInterestKeyAgainstHaystack,
  matchInterestKeyAgainstMaterial,
  matchLearnerInterestsAgainstHaystack,
  normalizeLearnerInterestKeys,
  resolveInterestKey,
  toCustomInterestKey,
} from './learner-interest-taxonomy.js';
import { scoreSuggestedMaterial } from './learner-home.scoring.js';
import type { LearnerHomeMaterialCandidate } from './learner-home.types.js';

const baseMaterial = (
  overrides: Partial<LearnerHomeMaterialCandidate> = {},
): LearnerHomeMaterialCandidate => ({
  id: 'material-1',
  ownerId: 'owner-1',
  title: 'Jumper wire pack',
  description: 'Assorted jumper wires for breadboards',
  materialType: 'Electronics',
  categoryId: 'cat-electronics',
  categoryNameEn: 'Electronics',
  categoryNameAr: 'Electronics',
  status: 'AVAILABLE',
  isFree: false,
  deliveryAllowed: false,
  pickupAllowed: true,
  viewsCount: 4,
  likesCount: 1,
  city: 'Ramallah',
  area: null,
  tags: ['wire', 'electronics'],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  availableQuantity: 2,
  mapped: {},
  ...overrides,
});

describe('learner interest taxonomy', () => {
  test('normalizes legacy labels and aliases to stable keys', () => {
    assert.deepEqual(
      normalizeLearnerInterestKeys([
        'Electronics',
        'Art & crafts',
        'Audio and media',
        'Fashion and textiles',
      ]),
      ['electronics', 'art_crafts', 'audio_media', 'fabric_textiles'],
    );
    assert.equal(resolveInterestKey('Arduino'), 'arduino');
    assert.equal(resolveInterestKey('education'), 'education');
    assert.deepEqual(normalizeLearnerInterestKeys(['education', 'recycling']), [
      'education',
      'recycling',
    ]);
    assert.equal(resolveInterestKey('unknown topic'), null);
  });

  test('exposes grouped interest options for profile UI', () => {
    const options = getLearnerInterestOptionsResponse();
    const electronics = options.groups.find((group) => group.key === 'electronics');

    assert.ok(electronics);
    assert.ok(electronics.items.some((item) => item.key === 'audio_media'));
    assert.ok(electronics.items.some((item) => item.key === 'wires_connectors'));
  });

  test('audio_media does not match generic jumper wires/resistors by category alone', () => {
    const jumper = baseMaterial({
      title: 'Jumper wire pack',
      tags: ['wire', 'jumper'],
    });
    const resistor = baseMaterial({
      title: 'Resistor assortment',
      description: 'Mixed resistor values',
      tags: ['resistor', 'electronics'],
    });

    assert.equal(
      matchInterestKeyAgainstHaystack(
        [
          jumper.title,
          jumper.description,
          jumper.materialType,
          jumper.categoryNameEn,
          ...jumper.tags,
        ].join(' '),
        'audio_media',
      ),
      null,
    );
    assert.equal(
      matchInterestKeyAgainstHaystack(
        [
          resistor.title,
          resistor.description,
          resistor.materialType,
          resistor.categoryNameEn,
          ...resistor.tags,
        ].join(' '),
        'audio_media',
      ),
      null,
    );
  });

  test('audio_media matches speaker/microphone/amplifier items', () => {
    for (const title of [
      'Bluetooth Speaker Module',
      'Mini Microphone Board',
      'Audio Amplifier Kit',
    ]) {
      const match = matchInterestKeyAgainstHaystack(
        `${title} audio electronics`,
        'audio_media',
      );
      assert.ok(match);
      assert.equal(match?.strength, 'strong');
      assert.equal(buildInterestMatchReason(match!), 'Matches your Audio & Media interest');
    }
  });

  test('arduino, robotics, wires_connectors, and circuits match precisely', () => {
    assert.ok(
      matchInterestKeyAgainstHaystack('arduino uno microcontroller board', 'arduino'),
    );
    assert.ok(matchInterestKeyAgainstHaystack('servo motor robotics kit', 'robotics'));
    assert.ok(matchInterestKeyAgainstHaystack('jumper wire cable connector pack', 'wires_connectors'));
    assert.ok(matchInterestKeyAgainstHaystack('resistor capacitor breadboard kit', 'circuits'));
  });

  test('electronics general interest can match generic electronics items', () => {
    const match = matchLearnerInterestsAgainstHaystack(
      'assorted part pack materialtype electronics category electronics',
      ['electronics'],
    );

    assert.ok(match);
    assert.ok(match!.scoreWeight > 0);
    assert.ok(
      buildInterestMatchReason(match!).toLowerCase().includes('electronics'),
    );
  });

  test('education alias and Lab & Education category resolve through education interest', () => {
    assert.equal(resolveInterestKey('education'), 'education');
    assert.deepEqual(normalizeLearnerInterestKeys(['education', 'recycling']), [
      'education',
      'recycling',
    ]);

    const labParts = buildMaterialMatchHaystack({
      title: 'Teaching Bench Accessory Pack',
      description: 'Surplus accessories from department storage',
      materialType: 'Accessory Pack',
      categoryNameEn: 'Lab & Education Supplies',
      tags: [],
    });
    const educationMatch = matchInterestKeyAgainstMaterial(labParts, 'education');
    assert.ok(educationMatch);
    assert.equal(educationMatch?.strength, 'group');
    assert.deepEqual(educationMatch?.matchedSources, ['category']);

    const probeTitleMatch = matchInterestKeyAgainstMaterial(
      buildMaterialMatchHaystack({
        title: 'Replacement Multimeter Probe Sets',
        description: 'Surplus accessories',
        materialType: 'Probe',
        categoryNameEn: 'Electronics',
        tags: [],
      }),
      'education',
    );
    assert.ok(probeTitleMatch);
    assert.equal(probeTitleMatch?.strength, 'strong');

    const electronicsMatch = matchInterestKeyAgainstMaterial(
      labParts,
      'electronics',
    );
    assert.equal(electronicsMatch, null);
  });

  test('scoreSuggestedMaterial uses precise audio media reasons only for real matches', () => {
    const audioInterest = normalizeLearnerInterestKeys(['Audio & Media']);
    const resistor = scoreSuggestedMaterial({
      material: baseMaterial({
        title: 'Resistor assortment',
        description: 'Mixed resistor values',
        tags: ['resistor'],
      }),
      interests: audioInterest,
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });
    const speaker = scoreSuggestedMaterial({
      material: baseMaterial({
        title: 'Mini Speaker Module',
        description: 'Small amplified speaker board',
        tags: ['speaker', 'audio'],
      }),
      interests: audioInterest,
      savedComponents: [],
      savedLocation: { city: null, area: null },
    });

    assert.equal(resistor.score, 0);
    assert.ok(speaker.score > 0);
    assert.ok(speaker.reasons.includes('Matches your Audio & Media interest'));
  });

  test('custom interests are stored and ignored for taxonomy scoring', () => {
    const customKey = toCustomInterestKey('Solar energy');
    assert.equal(customKey, 'custom:solar_energy');
    assert.equal(resolveInterestKey(customKey), customKey);
    assert.equal(isCustomInterestKey(customKey), true);

    assert.deepEqual(normalizeLearnerInterestKeys(['custom:solar_energy']), [
      'custom:solar_energy',
    ]);

    const match = matchLearnerInterestsAgainstHaystack(
      'solar panel kit renewable energy',
      ['custom:solar_energy'],
    );
    assert.equal(match, null);
  });
});
