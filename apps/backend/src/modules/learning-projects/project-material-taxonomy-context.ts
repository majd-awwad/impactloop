import { prisma } from '../../database/prisma.js';
import { TaxonomyCompatibilityRepository } from '../taxonomy/taxonomy-compatibility.repository.js';

export type ComponentTaxonomyContext = {
  componentId: string;
  conceptCanonicalKeys: string[];
  conceptIds: string[];
  satisfiedByFormKeys: string[];
  satisfiedByFormConceptIds: string[];
};

export type MaterialTaxonomyContext = {
  materialId: string;
  conceptCanonicalKeys: string[];
  conceptIds: string[];
};

const compatibilityRepository = new TaxonomyCompatibilityRepository();

export const loadComponentTaxonomyContexts = async (
  componentIds: readonly string[],
): Promise<Map<string, ComponentTaxonomyContext>> => {
  const result = new Map<string, ComponentTaxonomyContext>();
  if (componentIds.length === 0) {
    return result;
  }

  const rows = await prisma.projectComponentConcept.findMany({
    where: {
      componentId: { in: [...componentIds] },
      concept: { status: 'ACTIVE' },
    },
    select: {
      componentId: true,
      conceptId: true,
      concept: {
        select: {
          id: true,
          canonicalKey: true,
          conceptType: true,
        },
      },
    },
  });

  const keysByComponent = new Map<string, string[]>();
  const idsByComponent = new Map<string, string[]>();
  for (const row of rows) {
    const keys = keysByComponent.get(row.componentId) ?? [];
    keys.push(row.concept.canonicalKey);
    keysByComponent.set(row.componentId, keys);
    const ids = idsByComponent.get(row.componentId) ?? [];
    ids.push(row.conceptId);
    idsByComponent.set(row.componentId, ids);
  }

  const allComponentKeys = [
    ...new Set(rows.map((row) => row.concept.canonicalKey)),
  ];
  const componentOnlyKeys = allComponentKeys.filter((key) =>
    key.startsWith('component:'),
  );

  let satisfiedByFormKeysBySource = new Map<string, string[]>();
  if (componentOnlyKeys.length > 0) {
    const batch = await compatibilityRepository.queryBatch({
      relationType: 'SATISFIED_BY',
      sourceCanonicalKeys: componentOnlyKeys,
      expectedSourceConceptTypes: ['COMPONENT'],
      expectedTargetConceptTypes: ['MATERIAL_FORM'],
    });
    satisfiedByFormKeysBySource = new Map(
      batch.matches.map((match) => [
        match.sourceCanonicalKey,
        match.targetCanonicalKeys,
      ]),
    );
  }

  const allFormKeys = [
    ...new Set(
      [...satisfiedByFormKeysBySource.values()].flatMap((keys) => keys),
    ),
  ];
  const formConcepts =
    allFormKeys.length === 0
      ? []
      : await prisma.taxonomyConcept.findMany({
          where: {
            canonicalKey: { in: allFormKeys },
            status: 'ACTIVE',
            conceptType: 'MATERIAL_FORM',
          },
          select: { id: true, canonicalKey: true },
        });
  const formIdByKey = new Map(
    formConcepts.map((concept) => [concept.canonicalKey, concept.id]),
  );

  for (const componentId of componentIds) {
    const conceptCanonicalKeys = [
      ...new Set(keysByComponent.get(componentId) ?? []),
    ];
    const conceptIds = [...new Set(idsByComponent.get(componentId) ?? [])];
    const satisfiedByFormKeys = [
      ...new Set(
        conceptCanonicalKeys.flatMap(
          (key) => satisfiedByFormKeysBySource.get(key) ?? [],
        ),
      ),
    ];
    const satisfiedByFormConceptIds = satisfiedByFormKeys
      .map((key) => formIdByKey.get(key))
      .filter((id): id is string => typeof id === 'string');

    result.set(componentId, {
      componentId,
      conceptCanonicalKeys,
      conceptIds,
      satisfiedByFormKeys,
      satisfiedByFormConceptIds,
    });
  }

  return result;
};

export const loadMaterialTaxonomyContexts = async (
  materialIds: readonly string[],
): Promise<Map<string, MaterialTaxonomyContext>> => {
  const result = new Map<string, MaterialTaxonomyContext>();
  if (materialIds.length === 0) {
    return result;
  }

  const rows = await prisma.materialConcept.findMany({
    where: {
      materialId: { in: [...materialIds] },
      concept: { status: 'ACTIVE' },
    },
    select: {
      materialId: true,
      conceptId: true,
      concept: { select: { canonicalKey: true } },
    },
  });

  for (const materialId of materialIds) {
    result.set(materialId, {
      materialId,
      conceptCanonicalKeys: [],
      conceptIds: [],
    });
  }

  for (const row of rows) {
    const entry = result.get(row.materialId)!;
    entry.conceptCanonicalKeys.push(row.concept.canonicalKey);
    entry.conceptIds.push(row.conceptId);
  }

  for (const entry of result.values()) {
    entry.conceptCanonicalKeys = [...new Set(entry.conceptCanonicalKeys)];
    entry.conceptIds = [...new Set(entry.conceptIds)];
  }

  return result;
};

/** Materials linked to any of the given concept IDs (forms that satisfy a component). */
export const findMaterialIdsByConceptIds = async (
  conceptIds: readonly string[],
  take = 60,
): Promise<string[]> => {
  if (conceptIds.length === 0) {
    return [];
  }

  const rows = await prisma.materialConcept.findMany({
    where: {
      conceptId: { in: [...conceptIds] },
      material: {
        status: 'AVAILABLE',
        category: {
          isActive: true,
          categoryType: { in: ['MATERIAL', 'BOTH'] },
        },
      },
    },
    select: { materialId: true },
    distinct: ['materialId'],
    take,
  });

  return rows.map((row) => row.materialId);
};
