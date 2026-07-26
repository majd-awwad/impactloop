import { prisma } from '../../database/prisma.js';
import type {
  TaxonomyConceptRelationType,
  TaxonomyConceptStatus,
  TaxonomyConceptType,
} from '../../generated/prisma/client.js';
import { asciiCompare } from '../recommendations/canonical-shadow-user-features.js';
import { TAXONOMY_CONCEPT_RELATION_COMPATIBILITY } from './taxonomy-concept-relation.js';

export const TAXONOMY_COMPATIBILITY_SOURCE_LIMIT = 200;
export const TAXONOMY_COMPATIBILITY_DIAGNOSTIC_LIMIT = 8;

export type CompatibilityRejectionCode =
  | 'UNKNOWN_SOURCE'
  | 'INACTIVE_SOURCE'
  | 'SOURCE_TYPE_MISMATCH'
  | 'INACTIVE_TARGET'
  | 'TARGET_TYPE_MISMATCH'
  | 'MALFORMED_SOURCE_ENDPOINT'
  | 'MALFORMED_TARGET_ENDPOINT'
  | 'DUPLICATE_USABLE_MATCH';

export type CompatibilityDiagnosticSample = {
  relationId?: string;
  sourceCanonicalKey?: string;
  targetCanonicalKey?: string;
};

export type TaxonomyCompatibilitySourceConceptRow = {
  id: string;
  canonicalKey: string;
  conceptType: TaxonomyConceptType;
  status: TaxonomyConceptStatus;
};

export type TaxonomyCompatibilityRelationRow = {
  id: string;
  relationType: TaxonomyConceptRelationType;
  sourceConceptId: string;
  sourceConceptType: TaxonomyConceptType;
  targetConceptId: string;
  targetConceptType: TaxonomyConceptType;
  sourceConcept: TaxonomyCompatibilitySourceConceptRow;
  targetConcept: TaxonomyCompatibilitySourceConceptRow;
};

export type TaxonomyCompatibilityReader = {
  findSourceConcepts: (
    canonicalKeys: readonly string[],
  ) => Promise<readonly TaxonomyCompatibilitySourceConceptRow[]>;
  findOutgoingRelations: (input: {
    relationType: TaxonomyConceptRelationType;
    sourceConceptIds: readonly string[];
  }) => Promise<readonly TaxonomyCompatibilityRelationRow[]>;
};

export const prismaTaxonomyCompatibilityReader: TaxonomyCompatibilityReader = {
  findSourceConcepts: (canonicalKeys) =>
    prisma.taxonomyConcept.findMany({
      where: { canonicalKey: { in: [...canonicalKeys] } },
      select: {
        id: true,
        canonicalKey: true,
        conceptType: true,
        status: true,
      },
    }),
  findOutgoingRelations: ({ relationType, sourceConceptIds }) =>
    prisma.taxonomyConceptRelation.findMany({
      where: {
        relationType,
        sourceConceptId: { in: [...sourceConceptIds] },
      },
      select: {
        id: true,
        relationType: true,
        sourceConceptId: true,
        sourceConceptType: true,
        targetConceptId: true,
        targetConceptType: true,
        sourceConcept: {
          select: {
            id: true,
            canonicalKey: true,
            conceptType: true,
            status: true,
          },
        },
        targetConcept: {
          select: {
            id: true,
            canonicalKey: true,
            conceptType: true,
            status: true,
          },
        },
      },
    }),
};

export class TaxonomyCompatibilityQueryInputError extends Error {
  constructor(readonly code: string, readonly details?: unknown) {
    super(`Taxonomy compatibility query rejected: ${code}`);
    this.name = 'TaxonomyCompatibilityQueryInputError';
  }
}

const assertRequestedTypes = (
  relationType: TaxonomyConceptRelationType,
  expectedSourceConceptTypes: readonly TaxonomyConceptType[],
  expectedTargetConceptTypes: readonly TaxonomyConceptType[],
): void => {
  const compatibility = TAXONOMY_CONCEPT_RELATION_COMPATIBILITY[relationType];
  if (!compatibility) {
    throw new TaxonomyCompatibilityQueryInputError('RELATION_TYPE_UNKNOWN');
  }
  const sourceTypes = [...new Set(expectedSourceConceptTypes)].sort(asciiCompare);
  const targetTypes = [...new Set(expectedTargetConceptTypes)].sort(asciiCompare);
  if (
    sourceTypes.length === 0 ||
    sourceTypes.some(
      (value) =>
        !(compatibility.sourceTypes as readonly TaxonomyConceptType[]).includes(
          value,
        ),
    )
  ) {
    throw new TaxonomyCompatibilityQueryInputError(
      'EXPECTED_SOURCE_TYPE_INCOMPATIBLE',
      { relationType, sourceTypes },
    );
  }
  if (
    targetTypes.length === 0 ||
    targetTypes.some(
      (value) =>
        !(compatibility.targetTypes as readonly TaxonomyConceptType[]).includes(
          value,
        ),
    )
  ) {
    throw new TaxonomyCompatibilityQueryInputError(
      'EXPECTED_TARGET_TYPE_INCOMPATIBLE',
      { relationType, targetTypes },
    );
  }
};

const sampleKey = (sample: CompatibilityDiagnosticSample): string =>
  [
    sample.sourceCanonicalKey ?? '',
    sample.targetCanonicalKey ?? '',
    sample.relationId ?? '',
  ].join('\t');

export class TaxonomyCompatibilityRepository {
  constructor(
    private readonly reader: TaxonomyCompatibilityReader =
      prismaTaxonomyCompatibilityReader,
  ) {}

  async queryBatch(input: {
    relationType: TaxonomyConceptRelationType;
    sourceCanonicalKeys: readonly string[];
    expectedSourceConceptTypes: readonly TaxonomyConceptType[];
    expectedTargetConceptTypes: readonly TaxonomyConceptType[];
    diagnosticLimit?: number;
  }): Promise<{
    matches: Array<{
      sourceCanonicalKey: string;
      targetCanonicalKeys: string[];
    }>;
    diagnostics: {
      requestedSourceCount: number;
      uniqueSourceCount: number;
      relationRowsExamined: number;
      usableMatchCount: number;
      rejectedCounts: Partial<Record<CompatibilityRejectionCode, number>>;
      rejectedSamples: Partial<
        Record<
          CompatibilityRejectionCode,
          {
            total: number;
            sample: CompatibilityDiagnosticSample[];
            sampleLimit: number;
            truncated: boolean;
          }
        >
      >;
    };
  }> {
    const diagnosticLimit =
      input.diagnosticLimit ?? TAXONOMY_COMPATIBILITY_DIAGNOSTIC_LIMIT;
    if (
      !Number.isInteger(diagnosticLimit) ||
      diagnosticLimit < 0 ||
      diagnosticLimit > TAXONOMY_COMPATIBILITY_DIAGNOSTIC_LIMIT
    ) {
      throw new TaxonomyCompatibilityQueryInputError(
        'DIAGNOSTIC_LIMIT_INVALID',
        diagnosticLimit,
      );
    }
    assertRequestedTypes(
      input.relationType,
      input.expectedSourceConceptTypes,
      input.expectedTargetConceptTypes,
    );

    const sourceCanonicalKeys = [...new Set(input.sourceCanonicalKeys)].sort(
      asciiCompare,
    );
    if (sourceCanonicalKeys.length > TAXONOMY_COMPATIBILITY_SOURCE_LIMIT) {
      throw new TaxonomyCompatibilityQueryInputError('SOURCE_LIMIT_EXCEEDED', {
        actual: sourceCanonicalKeys.length,
        maximum: TAXONOMY_COMPATIBILITY_SOURCE_LIMIT,
      });
    }

    const rejectedCounts: Partial<Record<CompatibilityRejectionCode, number>> = {};
    const sampleCandidates = new Map<
      CompatibilityRejectionCode,
      CompatibilityDiagnosticSample[]
    >();
    const reject = (
      code: CompatibilityRejectionCode,
      sample: CompatibilityDiagnosticSample,
    ): void => {
      rejectedCounts[code] = (rejectedCounts[code] ?? 0) + 1;
      const samples = sampleCandidates.get(code) ?? [];
      if (!samples.some((candidate) => sampleKey(candidate) === sampleKey(sample))) {
        samples.push(sample);
        samples.sort((left, right) => asciiCompare(sampleKey(left), sampleKey(right)));
        if (samples.length > diagnosticLimit) samples.length = diagnosticLimit;
      }
      sampleCandidates.set(code, samples);
    };
    const emptyResult = () => ({
      matches: sourceCanonicalKeys.map((sourceCanonicalKey) => ({
        sourceCanonicalKey,
        targetCanonicalKeys: [],
      })),
      diagnostics: {
        requestedSourceCount: input.sourceCanonicalKeys.length,
        uniqueSourceCount: sourceCanonicalKeys.length,
        relationRowsExamined: 0,
        usableMatchCount: 0,
        rejectedCounts,
        rejectedSamples: {},
      },
    });
    if (sourceCanonicalKeys.length === 0) return emptyResult();

    const sources = await this.reader.findSourceConcepts(sourceCanonicalKeys);
    const sourceByKey = new Map(sources.map((source) => [source.canonicalKey, source]));
    const expectedSourceTypes = new Set(input.expectedSourceConceptTypes);
    const expectedTargetTypes = new Set(input.expectedTargetConceptTypes);
    const usableSources = new Map<string, TaxonomyCompatibilitySourceConceptRow>();
    for (const canonicalKey of sourceCanonicalKeys) {
      const source = sourceByKey.get(canonicalKey);
      if (!source) {
        reject('UNKNOWN_SOURCE', { sourceCanonicalKey: canonicalKey });
      } else if (!expectedSourceTypes.has(source.conceptType)) {
        reject('SOURCE_TYPE_MISMATCH', { sourceCanonicalKey: canonicalKey });
      } else if (source.status !== 'ACTIVE') {
        reject('INACTIVE_SOURCE', { sourceCanonicalKey: canonicalKey });
      } else {
        usableSources.set(source.id, source);
      }
    }

    const relations = await this.reader.findOutgoingRelations({
      relationType: input.relationType,
      sourceConceptIds: [...usableSources.keys()],
    });
    const targetsBySource = new Map(
      sourceCanonicalKeys.map((key) => [key, new Set<string>()]),
    );
    for (const relation of relations) {
      const source = usableSources.get(relation.sourceConceptId);
      const sourceKey = relation.sourceConcept.canonicalKey;
      const targetKey = relation.targetConcept.canonicalKey;
      const sample = {
        relationId: relation.id,
        sourceCanonicalKey: sourceKey,
        targetCanonicalKey: targetKey,
      };
      if (
        relation.relationType !== input.relationType ||
        !source ||
        relation.sourceConcept.id !== relation.sourceConceptId ||
        relation.sourceConceptType !== relation.sourceConcept.conceptType ||
        relation.sourceConcept.canonicalKey !== source.canonicalKey ||
        relation.sourceConcept.status !== 'ACTIVE' ||
        !expectedSourceTypes.has(relation.sourceConceptType)
      ) {
        reject('MALFORMED_SOURCE_ENDPOINT', sample);
        continue;
      }
      if (
        relation.targetConcept.id !== relation.targetConceptId ||
        relation.targetConceptType !== relation.targetConcept.conceptType
      ) {
        reject('MALFORMED_TARGET_ENDPOINT', sample);
        continue;
      }
      if (!expectedTargetTypes.has(relation.targetConceptType)) {
        reject('TARGET_TYPE_MISMATCH', sample);
        continue;
      }
      if (relation.targetConcept.status !== 'ACTIVE') {
        reject('INACTIVE_TARGET', sample);
        continue;
      }
      const targets = targetsBySource.get(source.canonicalKey)!;
      if (targets.has(targetKey)) {
        reject('DUPLICATE_USABLE_MATCH', sample);
        continue;
      }
      targets.add(targetKey);
    }

    const rejectedSamples: Partial<
      Record<
        CompatibilityRejectionCode,
        {
          total: number;
          sample: CompatibilityDiagnosticSample[];
          sampleLimit: number;
          truncated: boolean;
        }
      >
    > = {};
    for (const code of Object.keys(rejectedCounts).sort(asciiCompare) as CompatibilityRejectionCode[]) {
      const total = rejectedCounts[code] ?? 0;
      const sample = sampleCandidates.get(code) ?? [];
      rejectedSamples[code] = {
        total,
        sample,
        sampleLimit: diagnosticLimit,
        truncated: total > sample.length,
      };
    }
    const matches = sourceCanonicalKeys.map((sourceCanonicalKey) => ({
      sourceCanonicalKey,
      targetCanonicalKeys: [...(targetsBySource.get(sourceCanonicalKey) ?? [])].sort(
        asciiCompare,
      ),
    }));
    return {
      matches,
      diagnostics: {
        requestedSourceCount: input.sourceCanonicalKeys.length,
        uniqueSourceCount: sourceCanonicalKeys.length,
        relationRowsExamined: relations.length,
        usableMatchCount: matches.reduce(
          (sum, group) => sum + group.targetCanonicalKeys.length,
          0,
        ),
        rejectedCounts,
        rejectedSamples,
      },
    };
  }
}
