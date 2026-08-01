import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  RECOMMENDATION_SCORER_VERSION,
  parseRecommendationScorerVersion,
} from '../../config/recommendation-scoring-version.js';
import { RECOMMENDATION_ALGORITHM_VERSION } from '../recommendation-events/recommendation-events.service.js';
import {
  MAX_REVIEWED_INTEREST_SCORER_TERMS,
  REVIEWED_INTEREST_SCORER_VOCABULARY,
  buildInterestMatchReason,
  matchLearnerInterestsAgainstHaystackForScorerVersion,
  matchLearnerInterestsAgainstMaterialForScorerVersion,
} from './learner-interest-taxonomy.js';
import {
  scoreSuggestedMaterial,
  scoreSuggestedProject,
} from './learner-home.scoring.js';
import type {
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
} from './learner-home.types.js';

const material = (
  overrides: Partial<LearnerHomeMaterialCandidate> = {},
): LearnerHomeMaterialCandidate => ({
  id: 'material-normalized',
  ownerId: 'owner-1',
  title: 'Art and Crafts',
  description: 'A reviewed interest alias only',
  materialType: 'Miscellaneous',
  categoryId: 'category-1',
  categoryNameEn: 'Other Reusable Materials',
  categoryNameAr: 'مواد أخرى',
  status: 'AVAILABLE',
  isFree: false,
  deliveryAllowed: false,
  pickupAllowed: true,
  viewsCount: 0,
  likesCount: 0,
  city: 'Ramallah',
  area: null,
  tags: [],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  availableQuantity: 1,
  mapped: {},
  ...overrides,
});

const project = (
  overrides: Partial<LearnerHomeProjectCandidate> = {},
): LearnerHomeProjectCandidate => ({
  id: 'project-normalized',
  title: 'Art and Crafts',
  shortDescription: 'A reviewed interest alias only',
  difficulty: 'BEGINNER',
  estimatedDurationMinutes: 30,
  coverImageUrl: null,
  categoryId: 'project-category-1',
  categoryNameEn: 'Other',
  categoryNameAr: 'أخرى',
  tags: [],
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  likesCount: 0,
  savesCount: 0,
  reviewCount: 0,
  reviewAverage: 0,
  requiredComponents: [],
  mapped: {},
  ...overrides,
});

describe('guarded normalized recommendation scoring', () => {
  test('defaults to legacy, rejects invalid versions, and records the scorer version', () => {
    assert.equal(RECOMMENDATION_SCORER_VERSION, 'legacy-v1');
    assert.equal(
      RECOMMENDATION_ALGORITHM_VERSION,
      'learner-home-v1:legacy-v1',
    );
    assert.equal(parseRecommendationScorerVersion(undefined), 'legacy-v1');
    assert.equal(
      parseRecommendationScorerVersion('normalized-interests-v2'),
      'normalized-interests-v2',
    );
    assert.throws(
      () => parseRecommendationScorerVersion('unsupported-v3'),
      /Invalid RECOMMENDATION_SCORER_VERSION/,
    );
  });

  test('builds a deterministic, bounded vocabulary from learner-interest seeds only', () => {
    const arduino = REVIEWED_INTEREST_SCORER_VOCABULARY.arduino!;
    const art = REVIEWED_INTEREST_SCORER_VOCABULARY.art_crafts!;
    assert.ok(arduino.terms.length <= MAX_REVIEWED_INTEREST_SCORER_TERMS);
    assert.ok(art.terms.length <= MAX_REVIEWED_INTEREST_SCORER_TERMS);
    assert.deepEqual(
      arduino.terms.map((candidate) => candidate.term),
      [...new Set(arduino.terms.map((candidate) => candidate.term))],
    );
    assert.ok(
      art.terms.some(
        (candidate) =>
          candidate.term === 'art and crafts' &&
          candidate.source === 'reviewed_alias' &&
          candidate.language === 'EN',
      ),
    );
    assert.ok(
      arduino.terms.some(
        (candidate) =>
          candidate.term === 'أردوينو' &&
          candidate.source === 'reviewed_alias' &&
          candidate.language === 'AR',
      ),
    );
    assert.equal(
      REVIEWED_INTEREST_SCORER_VOCABULARY.sensors!.terms.some((candidate) =>
        candidate.term.includes('hc-sr04'),
      ),
      false,
    );
  });

  test('legacy mode preserves a missed alias while normalized mode adds one score', () => {
    const input = {
      title: 'Art and Crafts',
      description: 'A reviewed interest alias only',
      materialType: 'Miscellaneous',
      categoryNameEn: 'Other Reusable Materials',
      categoryNameAr: 'مواد أخرى',
      tags: [],
    };
    assert.equal(
      matchLearnerInterestsAgainstMaterialForScorerVersion(
        input,
        ['art_crafts'],
        'legacy-v1',
      ),
      null,
    );
    const normalized = matchLearnerInterestsAgainstMaterialForScorerVersion(
      input,
      ['art_crafts'],
      'normalized-interests-v2',
    );
    assert.equal(normalized?.scoreWeight, 12);
    assert.equal(normalized?.evidenceKind, 'reviewed_alias');
    assert.equal(normalized?.evidenceLanguage, 'EN');
  });

  test('reviewed Arabic aliases match once and produce bounded explanations', () => {
    const normalized = matchLearnerInterestsAgainstHaystackForScorerVersion(
      'لوحة أردوينو أردوينو',
      ['arduino'],
      'normalized-interests-v2',
    );
    assert.equal(normalized?.scoreWeight, 12);
    assert.equal(normalized?.evidenceLanguage, 'AR');
    assert.equal(
      buildInterestMatchReason(normalized!),
      'Matches your Arduino interest through a reviewed Arabic term',
    );
    assert.doesNotMatch(
      buildInterestMatchReason(normalized!),
      /أردوينو|12|taxonomy|alias/i,
    );
  });

  test('canonical evidence stays at 40 and aliases do not multiply it', () => {
    const canonical = matchLearnerInterestsAgainstHaystackForScorerVersion(
      'Arduino board أردوينو robot robots',
      ['arduino'],
      'normalized-interests-v2',
    );
    assert.equal(canonical?.scoreWeight, 40);
    assert.equal(canonical?.evidenceKind, undefined);
  });

  test('the scoring entry points select normalized mode without changing non-content signals', () => {
    const baseMaterial = material();
    const legacyMaterial = scoreSuggestedMaterial({
      material: baseMaterial,
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      includeAudit: true,
      scorerVersion: 'legacy-v1',
    });
    const normalizedMaterial = scoreSuggestedMaterial({
      material: baseMaterial,
      interests: ['art_crafts'],
      savedComponents: [],
      savedLocation: { city: null, area: null },
      includeAudit: true,
      scorerVersion: 'normalized-interests-v2',
    });
    assert.equal(legacyMaterial.score, 0);
    assert.equal(normalizedMaterial.audit?.relevanceScore, 12);
    assert.equal(
      normalizedMaterial.score - (normalizedMaterial.audit?.bonusScore ?? 0),
      12,
    );

    const legacyProject = scoreSuggestedProject({
      project: project(),
      interests: ['art_crafts'],
      availableMaterials: [],
      scorerVersion: 'legacy-v1',
    });
    const normalizedProject = scoreSuggestedProject({
      project: project(),
      interests: ['art_crafts'],
      availableMaterials: [],
      scorerVersion: 'normalized-interests-v2',
    });
    assert.equal(normalizedProject.score - legacyProject.score, 12);
  });
});
