import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import {
  TAXONOMY_ALIAS_SOURCE,
  resolveLearnerInterests,
} from './learner-interest-resolver.js';
import { TaxonomyFoundationRepository } from './taxonomy-foundation.repository.js';
import { normalizeTaxonomyAlias } from './taxonomy-normalization.js';

const marker = `rp013-${process.pid}-${Date.now()}`;
const conceptIds: string[] = [];

const aliasRow = (input: {
  conceptId: string;
  alias: string;
  language?: 'EN' | 'AR';
  aliasType?: 'CANONICAL' | 'EXPLICIT' | 'TRANSLATION';
  source?: string;
}) => ({
  conceptId: input.conceptId,
  alias: input.alias,
  normalizedAlias: normalizeTaxonomyAlias(input.alias),
  language: input.language ?? ('EN' as const),
  aliasType: input.aliasType ?? ('EXPLICIT' as const),
  source: input.source ?? TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT,
  isActive: true,
});

describe('RP-01.3 learner-interest registry projection', () => {
  before(async () => {
    const concepts = await prisma.$transaction(async (tx) => {
      const active = await tx.taxonomyConcept.create({
        data: {
          canonicalKey: `interest:${marker}-active`,
          conceptType: 'INTEREST',
          labelEn: `${marker} Active Label`,
          labelAr: `عنوان ${marker}`,
          status: 'ACTIVE',
        },
      });
      const inactive = await tx.taxonomyConcept.create({
        data: {
          canonicalKey: `interest:${marker}-inactive`,
          conceptType: 'INTEREST',
          labelEn: `${marker} Inactive`,
          labelAr: `${marker} غير نشط`,
          status: 'INACTIVE',
        },
      });
      const wrongType = await tx.taxonomyConcept.create({
        data: {
          canonicalKey: `component:${marker}-wrong`,
          conceptType: 'COMPONENT',
          labelEn: `${marker} Wrong Type`,
          labelAr: `${marker} نوع خاطئ`,
          status: 'ACTIVE',
        },
      });
      const ambiguousA = await tx.taxonomyConcept.create({
        data: {
          canonicalKey: `interest:${marker}-ambiguous-a`,
          conceptType: 'INTEREST',
          labelEn: `${marker} Ambiguous A`,
          labelAr: `${marker} غامض ا`,
          status: 'ACTIVE',
        },
      });
      const ambiguousB = await tx.taxonomyConcept.create({
        data: {
          canonicalKey: `interest:${marker}-ambiguous-b`,
          conceptType: 'INTEREST',
          labelEn: `${marker} Ambiguous B`,
          labelAr: `${marker} غامض ب`,
          status: 'ACTIVE',
        },
      });

      await tx.taxonomyAlias.createMany({
        data: [
          aliasRow({ conceptId: active.id, alias: `${marker} Arduino Board` }),
          aliasRow({ conceptId: active.id, alias: `لوحة ${marker}`, language: 'AR', aliasType: 'TRANSLATION' }),
          aliasRow({
            conceptId: active.id,
            alias: active.labelEn,
            aliasType: 'CANONICAL',
            source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
          }),
          aliasRow({
            conceptId: active.id,
            alias: active.labelAr,
            language: 'AR',
            aliasType: 'TRANSLATION',
            source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR,
          }),
          aliasRow({ conceptId: inactive.id, alias: `${marker} inactive alias` }),
          aliasRow({ conceptId: wrongType.id, alias: `${marker} wrong alias` }),
          aliasRow({ conceptId: ambiguousA.id, alias: `${marker} shared explicit` }),
          aliasRow({ conceptId: ambiguousB.id, alias: `${marker} shared explicit` }),
          aliasRow({
            conceptId: ambiguousA.id,
            alias: `${marker} shared label`,
            aliasType: 'CANONICAL',
            source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
          }),
          aliasRow({
            conceptId: ambiguousB.id,
            alias: `${marker} shared label`,
            aliasType: 'CANONICAL',
            source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
          }),
        ],
      });
      await tx.learnerInterestConcept.create({
        data: {
          learnerInterestKey: `${marker}_legacy`,
          conceptId: active.id,
        },
      });

      return [active, inactive, wrongType, ambiguousA, ambiguousB];
    });
    conceptIds.push(...concepts.map(({ id }) => id));
  });

  after(async () => {
    try {
      if (conceptIds.length > 0) {
        await prisma.taxonomyAlias.deleteMany({
          where: { conceptId: { in: conceptIds } },
        });
        await prisma.learnerInterestConcept.deleteMany({
          where: { conceptId: { in: conceptIds } },
        });
        await prisma.taxonomyConcept.deleteMany({
          where: { id: { in: conceptIds } },
        });
      }
      const [conceptCount, aliasCount, legacyCount] = await Promise.all([
        prisma.taxonomyConcept.count({
          where: { canonicalKey: { contains: marker } },
        }),
        prisma.taxonomyAlias.count({
          where: { alias: { contains: marker } },
        }),
        prisma.learnerInterestConcept.count({
          where: { learnerInterestKey: { contains: marker } },
        }),
      ]);
      assert.deepEqual(
        { conceptCount, aliasCount, legacyCount },
        { conceptCount: 0, aliasCount: 0, legacyCount: 0 },
      );
    } finally {
      await prisma.$disconnect();
    }
  });

  test('RP-01.3 real loader supplies complete deterministic resolver evidence', async () => {
    const repository = new TaxonomyFoundationRepository();
    const first = await repository.loadLearnerInterestResolutionRegistry();
    const second = await repository.loadLearnerInterestResolutionRegistry();
    assert.deepEqual(second, first);

    const projected = first.filter(({ id }) => conceptIds.includes(id));
    assert.deepEqual(
      projected.map(({ canonicalKey }) => canonicalKey),
      [...projected.map(({ canonicalKey }) => canonicalKey)].sort(),
    );
    const active = projected.find(
      ({ canonicalKey }) => canonicalKey === `interest:${marker}-active`,
    );
    assert.ok(active);
    assert.equal(active.status, 'ACTIVE');
    assert.deepEqual(active.learnerInterests, [
      {
        id: active.learnerInterests[0]!.id,
        learnerInterestKey: `${marker}_legacy`,
      },
    ]);
    assert.ok(active.aliases.some(({ source }) =>
      source === TAXONOMY_ALIAS_SOURCE.REVIEWED_EXPLICIT));
    assert.ok(active.aliases.some(({ source }) =>
      source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN));
    assert.ok(active.aliases.some(({ source }) =>
      source === TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR));

    const result = resolveLearnerInterests([
      `interest:${marker}-active`,
      `${marker}_legacy`,
      `${marker} Arduino Board`,
      `لوحة ${marker}`,
      `${marker} Active Label`,
      `عنوان ${marker}`,
      `${marker} inactive alias`,
      `${marker} wrong alias`,
      `${marker} shared explicit`,
      `${marker} shared label`,
    ], first);

    assert.deepEqual(
      result.mapped.map(({ matchSource }) => matchSource),
      [
        'CANONICAL_KEY',
        'LEGACY_BARE_KEY',
        'REVIEWED_ALIAS',
        'REVIEWED_ALIAS',
        'REVIEWED_LABEL',
        'REVIEWED_LABEL',
      ],
    );
    assert.deepEqual(
      result.unmapped.map(({ reason }) => reason),
      [
        'INACTIVE_TARGET',
        'WRONG_CONCEPT_TYPE',
        'AMBIGUOUS_MAPPING',
        'AMBIGUOUS_MAPPING',
      ],
    );
    assert.deepEqual(result.canonicalKeys, [`interest:${marker}-active`]);
    assert.equal(result.status, 'PARTIALLY_MAPPED');
  });
});
