import { prisma } from '../../database/prisma.js';
import type {
  Prisma,
  TaxonomyConceptType,
} from '../../generated/prisma/client.js';
import {
  TAXONOMY_CONCEPT_SEEDS,
  type TaxonomyConceptSeed,
  type TaxonomyMappingRule,
} from './taxonomy-foundation.data.js';
import {
  TAXONOMY_ALIAS_SOURCE,
  type LearnerInterestRegistryConcept,
} from './learner-interest-resolver.js';
import { normalizeTaxonomyAlias, isValidTaxonomyCanonicalKey } from './taxonomy-normalization.js';

export const MAX_TAXONOMY_BATCH_SIZE = 500;

export type TaxonomyAliasCandidate = {
  canonicalKey: string;
  conceptType: TaxonomyConceptType;
  labelEn: string;
  labelAr: string;
  status: 'ACTIVE' | 'INACTIVE';
};

export type TaxonomyAliasResolution =
  | { status: 'NOT_FOUND'; concepts: [] }
  | { status: 'RESOLVED'; concepts: [TaxonomyAliasCandidate] }
  | { status: 'AMBIGUOUS'; concepts: TaxonomyAliasCandidate[] };

export type TaxonomyVocabularyValidation = {
  conceptCount: number;
  aliasCount: number;
  sameTypeCollisions: string[];
  crossTypeCollisions: string[];
};

const getSeedAliases = (seed: TaxonomyConceptSeed) => {
  const aliases = [
    {
      alias: seed.labelEn,
      language: 'EN' as const,
      aliasType: 'CANONICAL' as const,
      source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_EN,
    },
    {
      alias: seed.labelAr,
      language: 'AR' as const,
      aliasType: 'TRANSLATION' as const,
      source: TAXONOMY_ALIAS_SOURCE.REVIEWED_LABEL_AR,
    },
    ...seed.aliases,
  ];
  const seen = new Set<string>();

  return aliases.filter((item) => {
    const normalizedAlias = normalizeTaxonomyAlias(item.alias);
    const key = `${item.language}:${normalizedAlias}`;
    if (normalizedAlias.length === 0) {
      throw new Error(`Blank taxonomy alias: ${seed.canonicalKey}`);
    }
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

export const validateTaxonomyVocabulary = (
  seeds: readonly TaxonomyConceptSeed[] = TAXONOMY_CONCEPT_SEEDS,
): TaxonomyVocabularyValidation => {
  const canonicalKeys = new Set<string>();
  const sameTypeAliases = new Map<string, string>();
  const crossTypeAliases = new Map<string, Set<string>>();
  const sameTypeCollisions: string[] = [];
  const crossTypeCollisions: string[] = [];
  let aliasCount = 0;

  for (const seed of seeds) {
    if (canonicalKeys.has(seed.canonicalKey)) {
      throw new Error(`Duplicate taxonomy canonical key: ${seed.canonicalKey}`);
    }
    if (!isValidTaxonomyCanonicalKey(seed.canonicalKey)) {
      throw new Error(`Invalid taxonomy canonical key: ${seed.canonicalKey}`);
    }
    if (seed.labelEn.trim().length === 0 || seed.labelAr.trim().length === 0) {
      throw new Error(`Bilingual labels are required: ${seed.canonicalKey}`);
    }
    canonicalKeys.add(seed.canonicalKey);

    for (const item of getSeedAliases(seed)) {
      const normalizedAlias = normalizeTaxonomyAlias(item.alias);
      aliasCount += 1;
      const sameTypeKey = `${seed.conceptType}:${item.language}:${normalizedAlias}`;
      const previous = sameTypeAliases.get(sameTypeKey);
      if (previous && previous !== seed.canonicalKey) {
        sameTypeCollisions.push(`${sameTypeKey}: ${previous}, ${seed.canonicalKey}`);
      } else {
        sameTypeAliases.set(sameTypeKey, seed.canonicalKey);
      }

      const crossTypeKey = `${item.language}:${normalizedAlias}`;
      const conceptKeys = crossTypeAliases.get(crossTypeKey) ?? new Set<string>();
      conceptKeys.add(seed.canonicalKey);
      crossTypeAliases.set(crossTypeKey, conceptKeys);
    }
  }

  if (sameTypeCollisions.length > 0) {
    throw new Error(`Ambiguous aliases within a concept type: ${sameTypeCollisions.join('; ')}`);
  }

  for (const [key, concepts] of crossTypeAliases) {
    if (concepts.size > 1) {
      crossTypeCollisions.push(`${key}: ${[...concepts].sort().join(', ')}`);
    }
  }

  return {
    conceptCount: seeds.length,
    aliasCount,
    sameTypeCollisions,
    crossTypeCollisions,
  };
};

export const resolveTaxonomyAliasCandidates = (
  candidates: readonly TaxonomyAliasCandidate[],
): TaxonomyAliasResolution => {
  const active = candidates.filter((candidate) => candidate.status === 'ACTIVE');
  const unique = [...new Map(active.map((candidate) => [candidate.canonicalKey, candidate])).values()];

  if (unique.length === 0) {
    return { status: 'NOT_FOUND', concepts: [] };
  }
  if (unique.length === 1) {
    return { status: 'RESOLVED', concepts: [unique[0]!] };
  }

  return { status: 'AMBIGUOUS', concepts: unique };
};

const assertBatch = (values: readonly string[], label: string) => {
  if (values.length > MAX_TAXONOMY_BATCH_SIZE) {
    throw new Error(`${label} taxonomy batch exceeds ${MAX_TAXONOMY_BATCH_SIZE}.`);
  }
};

const materialWhereForRule = (rule: TaxonomyMappingRule): Prisma.MaterialWhereInput => ({
  OR: [
    ...(rule.materialCategoryNames ?? []).map((name) => ({
      category: { nameEn: { equals: name, mode: 'insensitive' as const } },
    })),
    ...(rule.materialTypeNames ?? []).map((name) => ({
      materialType: { equals: name, mode: 'insensitive' as const },
    })),
    ...(rule.materialTagValues ?? []).map((tag) => ({
      tags: { some: { tag: { equals: tag, mode: 'insensitive' as const } } },
    })),
  ],
});

const projectWhereForRule = (rule: TaxonomyMappingRule): Prisma.LearningProjectWhereInput => ({
  OR: [
    ...(rule.projectCategoryNames ?? []).map((name) => ({
      category: { nameEn: { equals: name, mode: 'insensitive' as const } },
    })),
    ...(rule.projectTagValues ?? []).map((tag) => ({
      tags: { some: { tag: { equals: tag, mode: 'insensitive' as const } } },
    })),
  ],
});

const componentWhereForRule = (rule: TaxonomyMappingRule): Prisma.ProjectRequiredComponentWhereInput => ({
  OR: [
    ...(rule.componentNameValues ?? []).map((name) => ({
      componentName: { equals: name, mode: 'insensitive' as const },
    })),
    ...(rule.componentTypeValues ?? []).map((name) => ({
      materialType: { equals: name, mode: 'insensitive' as const },
    })),
  ],
});

export class TaxonomyFoundationRepository {
  async loadLearnerInterestResolutionRegistry(): Promise<LearnerInterestRegistryConcept[]> {
    const concepts = await prisma.taxonomyConcept.findMany({
      select: {
        id: true,
        canonicalKey: true,
        conceptType: true,
        status: true,
        labelEn: true,
        labelAr: true,
        aliases: {
          where: { isActive: true },
          select: {
            id: true,
            alias: true,
            normalizedAlias: true,
            language: true,
            aliasType: true,
            source: true,
            isActive: true,
          },
          orderBy: [
            { normalizedAlias: 'asc' },
            { language: 'asc' },
            { id: 'asc' },
          ],
          take: MAX_TAXONOMY_BATCH_SIZE + 1,
        },
        learnerInterests: {
          select: {
            id: true,
            learnerInterestKey: true,
          },
          orderBy: [
            { learnerInterestKey: 'asc' },
            { id: 'asc' },
          ],
          take: MAX_TAXONOMY_BATCH_SIZE + 1,
        },
      },
      orderBy: [
        { canonicalKey: 'asc' },
        { id: 'asc' },
      ],
      take: MAX_TAXONOMY_BATCH_SIZE + 1,
    });

    if (concepts.length > MAX_TAXONOMY_BATCH_SIZE) {
      throw new Error(
        `Learner-interest taxonomy registry exceeds ${MAX_TAXONOMY_BATCH_SIZE} concepts.`,
      );
    }
    for (const concept of concepts) {
      if (concept.aliases.length > MAX_TAXONOMY_BATCH_SIZE) {
        throw new Error(
          `Taxonomy concept ${concept.canonicalKey} exceeds ${MAX_TAXONOMY_BATCH_SIZE} active aliases.`,
        );
      }
      if (concept.learnerInterests.length > MAX_TAXONOMY_BATCH_SIZE) {
        throw new Error(
          `Taxonomy concept ${concept.canonicalKey} exceeds ${MAX_TAXONOMY_BATCH_SIZE} learner-interest keys.`,
        );
      }
    }

    return concepts;
  }

  async resolveConceptByKey(canonicalKey: string) {
    return prisma.taxonomyConcept.findFirst({ where: { canonicalKey, status: 'ACTIVE' } });
  }

  async resolveAlias(alias: string, language?: 'EN' | 'AR', conceptType?: TaxonomyConceptType) {
    const normalizedAlias = normalizeTaxonomyAlias(alias);
    if (normalizedAlias.length === 0) {
      return { status: 'NOT_FOUND', concepts: [] } as const;
    }

    const aliases = await prisma.taxonomyAlias.findMany({
      where: {
        normalizedAlias,
        ...(language ? { language } : {}),
        isActive: true,
        concept: {
          status: 'ACTIVE',
          ...(conceptType ? { conceptType } : {}),
        },
      },
      select: {
        concept: {
          select: {
            canonicalKey: true,
            conceptType: true,
            labelEn: true,
            labelAr: true,
            status: true,
          },
        },
      },
    });

    return resolveTaxonomyAliasCandidates(aliases.map(({ concept }) => concept));
  }

  async listConceptsForMaterial(materialId: string) {
    return prisma.materialConcept.findMany({
      where: { materialId, concept: { status: 'ACTIVE' } },
      include: { concept: { include: { aliases: { where: { isActive: true } } } } },
    });
  }

  async listConceptsForProject(projectId: string) {
    return prisma.learningProjectConcept.findMany({
      where: { projectId, concept: { status: 'ACTIVE' } },
      include: { concept: { include: { aliases: { where: { isActive: true } } } } },
    });
  }

  async listConceptsForProjectComponent(componentId: string) {
    return prisma.projectComponentConcept.findMany({
      where: { componentId, concept: { status: 'ACTIVE' } },
      include: { concept: { include: { aliases: { where: { isActive: true } } } } },
    });
  }

  async resolveStoredLearnerInterest(learnerInterestKey: string) {
    return prisma.learnerInterestConcept.findFirst({
      where: { learnerInterestKey, concept: { status: 'ACTIVE' } },
      include: { concept: { include: { aliases: { where: { isActive: true } } } } },
    });
  }

  async loadMappingsForEntities(input: {
    materialIds?: readonly string[];
    projectIds?: readonly string[];
    componentIds?: readonly string[];
    learnerInterestKeys?: readonly string[];
  }) {
    const materialIds = [...new Set(input.materialIds ?? [])];
    const projectIds = [...new Set(input.projectIds ?? [])];
    const componentIds = [...new Set(input.componentIds ?? [])];
    const learnerInterestKeys = [...new Set(input.learnerInterestKeys ?? [])];
    assertBatch(materialIds, 'Material');
    assertBatch(projectIds, 'Project');
    assertBatch(componentIds, 'Component');
    assertBatch(learnerInterestKeys, 'Learner-interest');

    const [materials, projects, components, interests] = await Promise.all([
      prisma.materialConcept.findMany({
        where: { materialId: { in: [...materialIds] }, concept: { status: 'ACTIVE' } },
        include: { concept: true },
      }),
      prisma.learningProjectConcept.findMany({
        where: { projectId: { in: [...projectIds] }, concept: { status: 'ACTIVE' } },
        include: { concept: true },
      }),
      prisma.projectComponentConcept.findMany({
        where: { componentId: { in: [...componentIds] }, concept: { status: 'ACTIVE' } },
        include: { concept: true },
      }),
      prisma.learnerInterestConcept.findMany({
        where: { learnerInterestKey: { in: [...learnerInterestKeys] }, concept: { status: 'ACTIVE' } },
        include: { concept: true },
      }),
    ]);

    return { materials, projects, components, interests };
  }
}

export const seedTaxonomyFoundation = async () => {
  const validation = validateTaxonomyVocabulary();
  const result = await prisma.$transaction(async (tx) => {
    const conceptIds = new Map<string, string>();
    let aliasRows = 0;
    let learnerInterestRows = 0;
    let materialRows = 0;
    let projectRows = 0;
    let componentRows = 0;

    for (const seed of TAXONOMY_CONCEPT_SEEDS) {
      const persisted = await tx.taxonomyConcept.upsert({
        where: { canonicalKey: seed.canonicalKey },
        create: {
          canonicalKey: seed.canonicalKey,
          conceptType: seed.conceptType,
          labelEn: seed.labelEn,
          labelAr: seed.labelAr,
          status: 'ACTIVE',
        },
        update: {
          conceptType: seed.conceptType,
          labelEn: seed.labelEn,
          labelAr: seed.labelAr,
        },
        select: { id: true },
      });
      conceptIds.set(seed.canonicalKey, persisted.id);

      const aliases = getSeedAliases(seed).map((item) => ({
        conceptId: persisted.id,
        alias: item.alias,
        normalizedAlias: normalizeTaxonomyAlias(item.alias),
        language: item.language,
        aliasType: item.aliasType,
        source: item.source,
        isActive: true,
      }));
      const createdAliases = await tx.taxonomyAlias.createMany({
        data: aliases,
        skipDuplicates: true,
      });
      aliasRows += createdAliases.count;
    }

    for (const seed of TAXONOMY_CONCEPT_SEEDS) {
      const conceptId = conceptIds.get(seed.canonicalKey);
      if (!conceptId) {
        throw new Error(`Missing persisted concept: ${seed.canonicalKey}`);
      }

      for (const rule of seed.mappingRules) {
        if (rule.learnerInterestKeys) {
          const created = await tx.learnerInterestConcept.createMany({
            data: rule.learnerInterestKeys.map((learnerInterestKey) => ({ learnerInterestKey, conceptId })),
            skipDuplicates: true,
          });
          learnerInterestRows += created.count;
        }

        if (
          rule.materialCategoryNames?.length ||
          rule.materialTypeNames?.length ||
          rule.materialTagValues?.length
        ) {
          const materials = await tx.material.findMany({
            where: materialWhereForRule(rule),
            select: { id: true },
          });
          const created = await tx.materialConcept.createMany({
            data: materials.map(({ id }) => ({ materialId: id, conceptId })),
            skipDuplicates: true,
          });
          materialRows += created.count;
        }

        if (rule.projectCategoryNames?.length || rule.projectTagValues?.length) {
          const projects = await tx.learningProject.findMany({
            where: projectWhereForRule(rule),
            select: { id: true },
          });
          const created = await tx.learningProjectConcept.createMany({
            data: projects.map(({ id }) => ({ projectId: id, conceptId })),
            skipDuplicates: true,
          });
          projectRows += created.count;
        }

        if (rule.componentNameValues?.length || rule.componentTypeValues?.length) {
          const components = await tx.projectRequiredComponent.findMany({
            where: componentWhereForRule(rule),
            select: { id: true },
          });
          const created = await tx.projectComponentConcept.createMany({
            data: components.map(({ id }) => ({ componentId: id, conceptId })),
            skipDuplicates: true,
          });
          componentRows += created.count;
        }
      }
    }

    return { aliasRows, learnerInterestRows, materialRows, projectRows, componentRows };
  });

  return {
    ...validation,
    ...result,
    conceptTypeCounts: TAXONOMY_CONCEPT_SEEDS.reduce<Record<string, number>>((counts, seed) => {
      counts[seed.conceptType] = (counts[seed.conceptType] ?? 0) + 1;
      return counts;
    }, {}),
  };
};
