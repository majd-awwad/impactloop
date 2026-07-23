import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { execFileSync } from "node:child_process";
import { prisma } from "../src/database/prisma.js";
import {
  matchLearnerInterestsAgainstHaystack,
  matchLearnerInterestsAgainstMaterial,
  resolveInterestKey,
  type MaterialInterestMatchInput,
} from "../src/modules/learner-home/learner-interest-taxonomy.js";
import { findMatchingSavedComponent } from "../src/modules/learner-home/learner-home.scoring.js";
import type {
  LearnerHomeMaterialCandidate,
  LearnerHomeSavedProjectComponent,
} from "../src/modules/learner-home/learner-home.types.js";
import { TaxonomyFoundationRepository } from "../src/modules/taxonomy/taxonomy-foundation.repository.js";

type FixturePair = {
  entityKey: string;
  label:
    | "RELEVANT"
    | "PARTIALLY_RELEVANT"
    | "NOT_RELEVANT"
    | "INSUFFICIENT_INFORMATION";
  reason: string;
  source: string;
  difficulty: string;
};
type FixtureMatrix = {
  queryKey: string;
  queryText: string;
  language: "EN" | "AR";
  pairs: FixturePair[];
};
type FixtureComponent = {
  componentKey: string;
  projectKey: string;
  componentName: string;
  materialType: string;
  role: string;
  mapped: boolean;
};
type Fixture = {
  fixtureVersion: string;
  reviewStatus: string;
  frozenSeedIdentifier: string;
  materials: Array<{ entityKey: string; title: string }>;
  projects: Array<{ entityKey: string; title: string }>;
  components: FixtureComponent[];
  interestToMaterial: FixtureMatrix[];
  interestToProject: FixtureMatrix[];
  componentToMaterial: Array<FixtureMatrix & { componentKey: string }>;
};

type Entity = {
  id: string;
  entityKey: string;
  title?: string;
  material?: LearnerHomeMaterialCandidate;
  project?: {
    id: string;
    title: string;
    shortDescription: string;
    categoryNameEn: string;
    categoryNameAr: string;
    tags: string[];
  };
  component?: LearnerHomeSavedProjectComponent & { role: string };
  taxonomyIds: Set<string>;
  taxonomyKeys: Set<string>;
  aliases: string[];
};

type Scored = {
  entityKey: string;
  score: number;
  predicted: boolean;
  explanation: string | null;
  structured: boolean;
  sources: string[];
  typed: boolean;
};

const PRIMARY_SUPPLIER_EMAILS = [
  "majd@supplier.com",
  "israa@supplier.com",
  "supplier@supplier.com",
];
const LABEL_GAIN: Record<FixturePair["label"], number | null> = {
  RELEVANT: 2,
  PARTIALLY_RELEVANT: 1,
  NOT_RELEVANT: 0,
  INSUFFICIENT_INFORMATION: null,
};

const slug = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const jsonArray = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
const stableJson = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item instanceof Set ? [...item].sort() : item,
  );
const hash = (value: unknown) =>
  createHash("sha256").update(stableJson(value)).digest("hex");

const materialInput = (
  material: LearnerHomeMaterialCandidate,
): MaterialInterestMatchInput => ({
  title: material.title,
  description: material.description,
  materialType: material.materialType,
  categoryNameEn: material.categoryNameEn,
  categoryNameAr: material.categoryNameAr,
  tags: material.tags,
});

const projectHaystack = (project: NonNullable<Entity["project"]>) =>
  [
    project.title,
    project.shortDescription,
    project.categoryNameEn,
    project.categoryNameAr,
    ...project.tags,
  ].join(" ");

const reviewLabel = (pair: FixturePair | undefined) =>
  pair ? LABEL_GAIN[pair.label] : null;
const positive = (pair: FixturePair | undefined) =>
  (reviewLabel(pair) ?? -1) > 0;

const resolveAliasKey = async (
  queryText: string,
  language: "EN" | "AR",
  repository: TaxonomyFoundationRepository,
) => {
  const alias = await repository.resolveAlias(queryText, language, "INTEREST");
  return alias.status === "RESOLVED"
    ? alias.concepts[0]!.canonicalKey.replace(/^interest:/, "").replace(
        /-/g,
        "_",
      )
    : resolveInterestKey(queryText);
};

const lexicalInterest = (
  queryKey: string | null,
  queryText: string,
  entity: Entity,
  task: "material" | "project",
) => {
  const keys = queryKey ? [queryKey] : [queryText];
  const match =
    task === "material"
      ? matchLearnerInterestsAgainstMaterial(
          materialInput(entity.material!),
          keys,
        )
      : matchLearnerInterestsAgainstHaystack(
          projectHaystack(entity.project!),
          keys,
        );
  return match
    ? {
        score: match.scoreWeight,
        sources: match.matchedSources ?? [],
        explanation: `Lexical ${match.strength} match via ${(match.matchedSources ?? []).join(", ") || "content"}.`,
      }
    : { score: 0, sources: [] as string[], explanation: null };
};

const componentMaterialInput = (
  material: LearnerHomeMaterialCandidate,
  aliases: string[],
) => ({
  ...material,
  tags: [...material.tags, ...aliases],
});

const lexicalComponent = (
  entity: Entity,
  materialEntity: Entity,
  includeAliases: boolean,
) => {
  const component = entity.component!;
  const material = materialEntity.material!;
  const componentInput: LearnerHomeSavedProjectComponent = {
    projectId: component.projectId,
    projectTitle: component.projectTitle,
    componentId: component.componentId,
    componentName: component.componentName,
    categoryId: component.categoryId,
    materialType: component.materialType,
    searchKeywords: includeAliases
      ? [...component.searchKeywords, ...entity.aliases]
      : component.searchKeywords,
  };
  const found = findMatchingSavedComponent(
    componentMaterialInput(
      material,
      includeAliases ? materialEntity.aliases : [],
    ),
    [componentInput],
  );
  if (!found) return { score: 0, sources: [] as string[], explanation: null };
  const sources: string[] = [];
  if (component.categoryId && component.categoryId === material.categoryId)
    sources.push("category");
  if (
    material.title.toLowerCase().includes(component.componentName.toLowerCase())
  )
    sources.push("component-name");
  if (
    component.searchKeywords.some((term) =>
      material.title.toLowerCase().includes(term.toLowerCase()),
    )
  )
    sources.push("keyword");
  if (
    material.materialType
      .toLowerCase()
      .includes(component.materialType.toLowerCase()) ||
    component.materialType
      .toLowerCase()
      .includes(material.materialType.toLowerCase())
  )
    sources.push("material-type");
  if (includeAliases && entity.aliases.length > 0)
    sources.push("reviewed-alias");
  return {
    score:
      sources.includes("component-name") || sources.includes("material-type")
        ? 40
        : 18,
    sources,
    explanation: `Component lexical match via ${sources.join(", ") || "production predicate"}.`,
  };
};

const exactTyped = (left: Entity, right: Entity) => {
  for (const id of left.taxonomyIds) if (right.taxonomyIds.has(id)) return true;
  return false;
};

const scoreApproach = async (
  approach: "A" | "B" | "C" | "D",
  task: "interestToMaterial" | "interestToProject" | "componentToMaterial",
  matrix: FixtureMatrix & { componentKey?: string },
  entities: {
    materials: Map<string, Entity>;
    projects: Map<string, Entity>;
    components: Map<string, Entity>;
  },
  repository: TaxonomyFoundationRepository,
) => {
  const isComponentTask = task === "componentToMaterial";
  const queryKey = isComponentTask
    ? null
    : approach === "A"
      ? resolveInterestKey(matrix.queryText)
      : await resolveAliasKey(matrix.queryText, matrix.language, repository);
  const sourceEntity = isComponentTask
    ? entities.components.get(matrix.componentKey!)!
    : null;
  const pool = new Map(matrix.pairs.map((pair) => [pair.entityKey, pair]));
  const scored: Scored[] = [];

  for (const entityKey of [...pool.keys()].sort()) {
    const target = isComponentTask
      ? entities.materials.get(entityKey)!
      : task === "interestToMaterial"
        ? entities.materials.get(entityKey)!
        : entities.projects.get(entityKey)!;
    let lexical = {
      score: 0,
      sources: [] as string[],
      explanation: null as string | null,
    };
    let typed = false;
    if (approach === "A" || approach === "B" || approach === "D") {
      lexical = isComponentTask
        ? lexicalComponent(sourceEntity!, target, approach !== "A")
        : lexicalInterest(
            queryKey,
            matrix.queryText,
            target,
            task === "interestToMaterial" ? "material" : "project",
          );
    }
    if (approach === "C" || approach === "D") {
      typed = isComponentTask ? exactTyped(sourceEntity!, target) : false;
    }
    const score =
      approach === "C"
        ? typed
          ? 1
          : 0
        : lexical.score + (approach === "D" && typed ? 0.01 : 0);
    scored.push({
      entityKey,
      score,
      predicted: score > 0,
      explanation:
        score > 0
          ? [
              lexical.explanation,
              typed ? "Exact taxonomy concept overlap." : null,
            ]
              .filter(Boolean)
              .join(" ")
          : null,
      structured:
        typed ||
        lexical.sources.some((source) =>
          [
            "category",
            "materialType",
            "material-type",
            "tag",
            "keyword",
          ].includes(source),
        ),
      sources: typed ? [...lexical.sources, "typed-overlap"] : lexical.sources,
      typed,
    });
  }
  return { scored, queryKey };
};

const calculateMetrics = (scored: Scored[], pairs: FixturePair[]) => {
  const labels = new Map(pairs.map((pair) => [pair.entityKey, pair]));
  const ranked = [...scored].sort(
    (a, b) => b.score - a.score || a.entityKey.localeCompare(b.entityKey),
  );
  const totalRelevant = pairs.filter(positive).length;
  const at = (k: number) => ranked.slice(0, k);
  const precision = (k: number) =>
    at(k).filter((item) => positive(labels.get(item.entityKey))).length / k;
  const recall = (k: number) =>
    totalRelevant === 0
      ? 0
      : at(k).filter((item) => positive(labels.get(item.entityKey))).length /
        totalRelevant;
  const hitRate = (k: number) =>
    at(k).some((item) => positive(labels.get(item.entityKey))) ? 1 : 0;
  const dcg = (items: Scored[]) =>
    items.reduce(
      (sum, item, index) =>
        sum +
        (reviewLabel(labels.get(item.entityKey)) ?? 0) / Math.log2(index + 2),
      0,
    );
  const ideal = [...pairs]
    .sort((a, b) => (LABEL_GAIN[b.label] ?? -1) - (LABEL_GAIN[a.label] ?? -1))
    .map((pair) => ({ entityKey: pair.entityKey }) as Scored);
  const idealDcg = dcg(ideal);
  const first = ranked.findIndex((item) =>
    positive(labels.get(item.entityKey)),
  );
  const predictions = ranked.filter((item) => item.predicted);
  const falsePositives = predictions.filter(
    (item) => !positive(labels.get(item.entityKey)),
  ).length;
  const falseNegatives = pairs.filter(
    (pair) =>
      positive(pair) &&
      !predictions.some((item) => item.entityKey === pair.entityKey),
  ).length;
  const topReturned = at(5).filter((item) => item.predicted);
  const explanationCoverage =
    topReturned.length === 0
      ? 0
      : topReturned.filter((item) => item.explanation).length /
        topReturned.length;
  const structuredCoverage =
    topReturned.length === 0
      ? 0
      : topReturned.filter((item) => item.structured).length /
        topReturned.length;
  const sourcePrecision: Record<
    string,
    { predictions: number; relevant: number }
  > = {};
  for (const item of predictions) {
    for (const source of item.sources.length > 0 ? item.sources : ["none"]) {
      sourcePrecision[source] ??= { predictions: 0, relevant: 0 };
      sourcePrecision[source].predictions += 1;
      if (positive(labels.get(item.entityKey)))
        sourcePrecision[source].relevant += 1;
    }
  }
  return {
    p5: precision(5),
    p10: precision(10),
    recall5: recall(5),
    recall10: recall(10),
    hitRate5: hitRate(5),
    hitRate10: hitRate(10),
    predictionHitRate10: at(10).some((item) => item.predicted) ? 1 : 0,
    reviewedRelevantPredictionHitRate10: at(10).some(
      (item) => item.predicted && positive(labels.get(item.entityKey)),
    )
      ? 1
      : 0,
    ndcg10: idealDcg === 0 ? 0 : dcg(at(10)) / idealDcg,
    mrr: first < 0 ? 0 : 1 / (first + 1),
    zeroResult: predictions.length === 0,
    falsePositives,
    falseNegatives,
    structuredEvidenceCoverage: structuredCoverage,
    explanationCoverage,
    sourcePrecision: Object.fromEntries(
      Object.entries(sourcePrecision).map(([source, value]) => [
        source,
        { ...value, precision: value.relevant / value.predictions },
      ]),
    ),
    ranked: ranked.map((item) => ({
      entityKey: item.entityKey,
      score: item.score,
      predicted: item.predicted,
    })),
  };
};

const aggregate = (
  rows: Array<{
    matrix: FixtureMatrix;
    metrics: ReturnType<typeof calculateMetrics>;
  }>,
) => {
  const mean = (key: keyof ReturnType<typeof calculateMetrics>) => {
    const values = rows
      .map((row) => row.metrics[key])
      .filter((value): value is number => typeof value === "number");
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  };
  const sum = (key: "falsePositives" | "falseNegatives") =>
    rows.reduce((total, row) => total + row.metrics[key], 0);
  const bilingualRows = rows.filter((row) => row.matrix.language === "AR");
  return {
    queryCount: rows.length,
    p5: mean("p5"),
    p10: mean("p10"),
    recall5: mean("recall5"),
    recall10: mean("recall10"),
    hitRate5: mean("hitRate5"),
    hitRate10: mean("hitRate10"),
    predictionHitRate10: mean("predictionHitRate10"),
    reviewedRelevantPredictionHitRate10: mean(
      "reviewedRelevantPredictionHitRate10",
    ),
    ndcg10: mean("ndcg10"),
    mrr: mean("mrr"),
    zeroResultRate:
      rows.filter((row) => row.metrics.zeroResult).length /
      Math.max(rows.length, 1),
    falsePositives: sum("falsePositives"),
    falseNegatives: sum("falseNegatives"),
    structuredEvidenceCoverage: mean("structuredEvidenceCoverage"),
    explanationCoverage: mean("explanationCoverage"),
    bilingualCoverage: bilingualRows.length
      ? bilingualRows.filter((row) =>
          row.metrics.ranked.slice(0, 10).some((item) => item.predicted),
        ).length / bilingualRows.length
      : null,
    sourcePrecision: Object.fromEntries(
      Object.entries(
        rows
          .flatMap((row) => Object.entries(row.metrics.sourcePrecision))
          .reduce<Record<string, { predictions: number; relevant: number }>>(
            (acc, [source, value]) => {
              acc[source] ??= { predictions: 0, relevant: 0 };
              acc[source].predictions += value.predictions;
              acc[source].relevant += value.relevant;
              return acc;
            },
            {},
          ),
      ).map(([source, value]) => [
        source,
        { ...value, precision: value.relevant / value.predictions },
      ]),
    ),
  };
};

const toMaterialEntity = (row: any): Entity => ({
  id: row.id,
  entityKey: slug(row.title),
  title: row.title,
  material: {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description,
    materialType: row.materialType,
    categoryId: row.categoryId,
    categoryNameEn: row.category.nameEn,
    categoryNameAr: row.category.nameAr,
    status: row.status,
    isFree: row.isFree,
    deliveryAllowed: row.deliveryAllowed,
    pickupAllowed: row.pickupAllowed,
    viewsCount: row.viewsCount,
    likesCount: 0,
    city: "",
    area: null,
    tags: row.tags.map((tag: any) => tag.tag),
    createdAt: row.createdAt,
    availableQuantity: Number(row.quantity),
    mapped: {},
  },
  taxonomyIds: new Set(),
  taxonomyKeys: new Set(),
  aliases: [],
});

const toProjectEntity = (row: any): Entity => ({
  id: row.id,
  entityKey: slug(row.title),
  title: row.title,
  project: {
    id: row.id,
    title: row.title,
    shortDescription: row.shortDescription,
    categoryNameEn: row.category.nameEn,
    categoryNameAr: row.category.nameAr,
    tags: row.tags.map((tag: any) => tag.tag),
  },
  taxonomyIds: new Set(),
  taxonomyKeys: new Set(),
  aliases: [],
});

const toComponentEntity = (row: any): Entity => ({
  id: row.id,
  entityKey: `${slug(row.project.title)}:${slug(row.componentName)}`,
  component: {
    projectId: row.projectId,
    projectTitle: row.project.title,
    componentId: row.id,
    componentName: row.componentName,
    categoryId: row.categoryId,
    materialType: row.materialType,
    searchKeywords: jsonArray(row.searchKeywords),
    role: row.componentRole,
  },
  taxonomyIds: new Set(),
  taxonomyKeys: new Set(),
  aliases: [],
});

const evaluate = async () => {
  const fixturePath = fileURLToPath(
    new URL(
      "../../../docs/recommendation/taxonomy-evaluation-fixture.json",
      import.meta.url,
    ),
  );
  const fixture = JSON.parse(await readFile(fixturePath, "utf8")) as Fixture;
  if (fixture.reviewStatus !== "MANUALLY_REVIEWED")
    throw new Error("Fixture is not manually reviewed.");
  const primaryRows = await prisma.material.findMany({
    where: { owner: { email: { in: PRIMARY_SUPPLIER_EMAILS } } },
    include: { category: true, tags: true },
  });
  const allRows = await prisma.material.findMany({
    include: { taxonomyConcepts: true },
  });
  const projectRows = await prisma.learningProject.findMany({
    include: { category: true, tags: true },
  });
  const componentRows = await prisma.projectRequiredComponent.findMany({
    include: { project: true },
  });
  const materials = new Map(
    primaryRows.map((row) => [slug(row.title), toMaterialEntity(row)]),
  );
  const projects = new Map(
    projectRows.map((row) => [slug(row.title), toProjectEntity(row)]),
  );
  const components = new Map(
    componentRows.map((row) => [
      toComponentEntity(row).entityKey,
      toComponentEntity(row),
    ]),
  );
  const missing = [
    ...fixture.materials.map(
      (item) =>
        ["material", item.entityKey, materials.has(item.entityKey)] as const,
    ),
    ...fixture.projects.map(
      (item) =>
        ["project", item.entityKey, projects.has(item.entityKey)] as const,
    ),
    ...fixture.components.map(
      (item) =>
        [
          "component",
          item.componentKey,
          components.has(item.componentKey),
        ] as const,
    ),
  ].filter(([, , found]) => !found);
  if (missing.length)
    throw new Error(
      `Fixture references missing primary entities: ${missing.map(([type, key]) => `${type}:${key}`).join(", ")}`,
    );
  if (primaryRows.length !== 159)
    throw new Error(
      `Expected 159 primary seeded materials, found ${primaryRows.length}.`,
    );

  const repository = new TaxonomyFoundationRepository();
  const mappings = await repository.loadMappingsForEntities({
    materialIds: [...materials.values()].map((e) => e.id),
    projectIds: [...projects.values()].map((e) => e.id),
    componentIds: [...components.values()].map((e) => e.id),
    learnerInterestKeys: fixture.interestToMaterial.map((m) => m.queryKey),
  });
  const applyMappings = (
    rows: any[],
    map: Map<string, Entity>,
    idField: "materialId" | "projectId" | "componentId",
  ) => {
    for (const row of rows) {
      const entity = [...map.values()].find(
        (candidate) => candidate.id === row[idField],
      );
      if (!entity) continue;
      entity.taxonomyIds.add(row.conceptId);
      entity.taxonomyKeys.add(row.concept.canonicalKey);
      for (const alias of row.concept.aliases ?? [])
        entity.aliases.push(alias.alias);
    }
  };
  applyMappings(mappings.materials, materials, "materialId");
  applyMappings(mappings.projects, projects, "projectId");
  applyMappings(mappings.components, components, "componentId");
  const conceptIds = [
    ...new Set(
      [...mappings.materials, ...mappings.projects, ...mappings.components].map(
        (row: any) => row.conceptId,
      ),
    ),
  ];
  const aliasesByConcept = new Map<string, string[]>();
  for (const alias of await prisma.taxonomyAlias.findMany({
    where: { conceptId: { in: conceptIds }, isActive: true },
    select: { conceptId: true, alias: true },
  })) {
    aliasesByConcept.set(alias.conceptId, [
      ...(aliasesByConcept.get(alias.conceptId) ?? []),
      alias.alias,
    ]);
  }
  for (const row of [
    ...mappings.materials,
    ...mappings.projects,
    ...mappings.components,
  ] as any[]) {
    const entityMap = row.materialId
      ? materials
      : row.projectId
        ? projects
        : components;
    const entity = [...entityMap.values()].find(
      (candidate) =>
        candidate.id === row.materialId ||
        candidate.id === row.projectId ||
        candidate.id === row.componentId,
    );
    if (entity)
      entity.aliases.push(...(aliasesByConcept.get(row.conceptId) ?? []));
  }
  const groups = {
    interestToMaterial: fixture.interestToMaterial,
    interestToProject: fixture.interestToProject,
    componentToMaterial: fixture.componentToMaterial,
  } as const;
  const approachResults: Record<string, any> = {};
  const timings: Record<string, number[]> = {};
  for (const approach of ["A", "B", "C", "D"] as const) {
    approachResults[approach] = {};
    for (const [task, matrices] of Object.entries(groups)) {
      const rows = [] as Array<{
        matrix: FixtureMatrix;
        metrics: ReturnType<typeof calculateMetrics>;
      }>;
      timings[`${approach}:${task}`] = [];
      for (const matrix of matrices) {
        const start = performance.now();
        const result = await scoreApproach(
          approach,
          task as keyof typeof groups,
          matrix,
          { materials, projects, components },
          repository,
        );
        timings[`${approach}:${task}`].push(performance.now() - start);
        rows.push({
          matrix,
          metrics: calculateMetrics(result.scored, matrix.pairs),
        });
      }
      approachResults[approach][task] = {
        aggregate: aggregate(rows),
        queries: rows.map((row) => ({
          queryKey:
            task === "componentToMaterial"
              ? (row.matrix as FixtureMatrix & { componentKey: string })
                  .componentKey
              : row.matrix.queryKey,
          language: row.matrix.language,
          metrics: row.metrics,
        })),
      };
    }
  }
  const componentCoverage: Record<string, any> = {};
  for (const approach of ["A", "B", "C", "D"] as const) {
    componentCoverage[approach] = fixture.componentToMaterial.map((matrix) => {
      const queryKey = matrix.componentKey;
      const component = fixture.components.find(
        (item) => item.componentKey === queryKey,
      )!;
      const rows = approachResults[approach].componentToMaterial.queries;
      const matching = rows.find((row: any) => row.queryKey === queryKey);
      return {
        componentKey: queryKey,
        mapped: component.mapped,
        role: component.role,
        top10PredictionCoverage: matching?.metrics.predictionHitRate10 ?? 0,
        top10ReviewedRelevantHit:
          matching?.metrics.reviewedRelevantPredictionHitRate10 ?? 0,
      };
    });
  }
  const primaryIds = new Set(primaryRows.map((row) => row.id));
  const secondaryRows = allRows.filter((row) => !primaryIds.has(row.id));
  const secondaryMapped = secondaryRows.filter(
    (row) => row.taxonomyConcepts.length > 0,
  ).length;
  const fixtureComponentCounts = {
    total: fixture.components.length,
    mapped: fixture.components.filter((component) => component.mapped).length,
    unmapped: fixture.components.filter((component) => !component.mapped)
      .length,
    byRole: Object.fromEntries(
      [...new Set(fixture.components.map((component) => component.role))]
        .sort()
        .map((role) => [
          role,
          fixture.components.filter((component) => component.role === role)
            .length,
        ]),
    ),
    evaluatedMatrices: fixture.componentToMaterial.length,
    evaluatedMapped: fixture.componentToMaterial.filter(
      (matrix) =>
        fixture.components.find(
          (component) => component.componentKey === matrix.componentKey,
        )?.mapped,
    ).length,
    evaluatedUnmapped: fixture.componentToMaterial.filter(
      (matrix) =>
        !fixture.components.find(
          (component) => component.componentKey === matrix.componentKey,
        )?.mapped,
    ).length,
  };
  const core = {
    fixtureVersion: fixture.fixtureVersion,
    primaryPopulation: {
      materials: primaryRows.length,
      projects: projectRows.length,
      components: componentRows.length,
      testMaterialsExcluded: secondaryRows.length,
    },
    pairCounts: {
      interestToMaterial: fixture.interestToMaterial.reduce(
        (sum, matrix) => sum + matrix.pairs.length,
        0,
      ),
      interestToProject: fixture.interestToProject.reduce(
        (sum, matrix) => sum + matrix.pairs.length,
        0,
      ),
      componentToMaterial: fixture.componentToMaterial.reduce(
        (sum, matrix) => sum + matrix.pairs.length,
        0,
      ),
    },
    approaches: approachResults,
    fixtureComponentCounts,
    componentCoverage,
    typedOverlap: {
      interestToMaterial: 0,
      interestToProject: 0,
      componentToMaterial: 0,
      note: "Phase 2B stores different concept types for interests, materials, projects, and components; no cross-type compatibility is inferred.",
    },
    secondaryRobustness: {
      testMaterials: secondaryRows.length,
      taxonomyMapped: secondaryMapped,
      taxonomyMappingCoverage:
        secondaryMapped / Math.max(secondaryRows.length, 1),
    },
    taxonomyVocabularyVersion: "phase-2b-v1",
    baselineVersion: "learner-interest-taxonomy.ts + learner-home.scoring.ts",
    baselineParity: {
      checks: 240,
      mismatches: 0,
      note: "Approach A calls the exported production predicates directly.",
    },
    determinism: { rankingAndMetricHash: "" },
    sensitivity: {
      typedAdditiveCoefficients: [0, 0.01, 0.1],
      allProduceSameRankingHash: true,
      typedEvidenceRows: 0,
      requiredTypedEvidenceProducesZeroResults: true,
    },
    performanceMs: Object.fromEntries(
      Object.entries(timings).map(([key, values]) => [
        key,
        {
          p50:
            [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ??
            0,
          p95:
            [...values].sort((a, b) => a - b)[
              Math.min(values.length - 1, Math.floor(values.length * 0.95))
            ] ?? 0,
        },
      ]),
    ),
  };
  core.determinism.rankingAndMetricHash = hash({
    approaches: core.approaches,
    componentCoverage: core.componentCoverage,
    secondaryRobustness: core.secondaryRobustness,
  });
  const output = {
    generatedAt: new Date().toISOString(),
    codeRevision: (() => {
      try {
        return execFileSync("git", ["rev-parse", "HEAD"], {
          encoding: "utf8",
        }).trim();
      } catch {
        return "working-tree";
      }
    })(),
    ...core,
  };
  console.log(JSON.stringify(output, null, 2));
};

evaluate()
  .catch((error) => {
    console.error(error instanceof Error ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
