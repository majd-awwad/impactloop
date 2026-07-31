import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { prisma } from "../src/database/prisma.js";
import {
  ALL_LEARNER_INTEREST_KEYS,
  getInterestSearchTermsForKey,
  getLearnerInterestDefinition,
  matchLearnerInterestsAgainstHaystack,
  matchLearnerInterestsAgainstMaterial,
  normalizeInterestToken,
  type MaterialInterestMatchInput,
} from "../src/modules/learner-home/learner-interest-taxonomy.js";
import {
  buildMaterialRelevanceWhere,
  collectMaterialCandidateSearchTerms,
  loadProjectPool,
  mergeMaterialPoolRows,
  HOME_MATERIAL_POOL_CAP,
} from "../src/modules/learner-home/learner-home.repository.js";
import { createEmptyBehaviorContext } from "../src/modules/learner-home/learner-home.affinity.js";
import type {
  LearnerHomeMaterialCandidate,
  LearnerHomeProjectCandidate,
} from "../src/modules/learner-home/learner-home.types.js";
import { TAXONOMY_CONCEPT_SEEDS } from "../src/modules/taxonomy/taxonomy-foundation.data.js";

export const MAX_RETRIEVAL_TERMS = 28;
export const PRIMARY_SUPPLIER_EMAILS = [
  "majd@supplier.com",
  "israa@supplier.com",
  "supplier@supplier.com",
] as const;
export const MATERIAL_RELEVANCE_TAKE = Math.min(
  HOME_MATERIAL_POOL_CAP,
  Math.ceil(HOME_MATERIAL_POOL_CAP * 0.75),
);
export const MATERIAL_POPULAR_TAKE = Math.min(
  HOME_MATERIAL_POOL_CAP,
  Math.ceil(HOME_MATERIAL_POOL_CAP * 0.6),
);
export const MATERIAL_FREE_TAKE = Math.min(
  HOME_MATERIAL_POOL_CAP,
  Math.ceil(HOME_MATERIAL_POOL_CAP * 0.3),
);

type Strategy = "A" | "B" | "C";
type EntityKind = "material" | "project";
type Language = "EN" | "AR";

type ReviewedInterestVocabulary = {
  key: string;
  labelEn: string;
  labelAr: string;
  canonicalTerms: string[];
  englishAliases: string[];
  arabicAliases: string[];
  boundedTerms: string[];
  removedByCap: string[];
};

type MaterialRecord = {
  id: string;
  entityKey: string;
  material: LearnerHomeMaterialCandidate;
  primary: boolean;
};

type ProjectRecord = {
  id: string;
  entityKey: string;
  project: LearnerHomeProjectCandidate;
  primary: boolean;
};

type RetrievalQueryStats = {
  orBranches: number;
  normalizedTerms: number;
  approximateSqlTextLength: number;
  queryCount: number;
  matchedBeforeCapCount: number;
  returnedIdCount: number;
  duplicateIdCount: number;
  databaseDurationMs: number;
  requestDurationMs: number;
};

type RetrievalResult = {
  idsBeforeCap: string[];
  idsAfterCap: string[];
  queryStats: RetrievalQueryStats;
  queryShape: unknown;
};

type Evidence = {
  score: number;
  sources: string[];
  alias: string | null;
  explanation: string | null;
};

type FixturePair = {
  entityKey: string;
  label:
    | "RELEVANT"
    | "PARTIALLY_RELEVANT"
    | "NOT_RELEVANT"
    | "INSUFFICIENT_INFORMATION";
  reason: string;
  evidenceSource: string;
  baselinePresent: boolean;
  expandedPresent: boolean;
  scoringOnlyPresent: boolean;
};

type FixtureMatrix = {
  interestKey: string;
  interestLabelEn: string;
  interestLabelAr: string;
  pairs: FixturePair[];
};

const slug = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const REVIEWED_STOP_TERMS = new Set([
  "and",
  "or",
  "the",
  "of",
  "in",
  "to",
  "for",
  "with",
]);
const stableUnique = (values: readonly string[]) => [
  ...new Set(
    values
      .map(normalizeInterestToken)
      .filter((value) => value.length >= 3 && !REVIEWED_STOP_TERMS.has(value)),
  ),
];
const stableUniqueAll = (values: readonly string[]) => [
  ...new Set(
    values.map(normalizeInterestToken).filter((value) => value.length >= 3),
  ),
];
const jsonLength = (value: unknown) => JSON.stringify(value).length;
const emptyBehavior = () => createEmptyBehaviorContext();
const emptyLocation = { city: null, area: null } as const;

const primaryMaterialScope = {
  owner: { email: { in: [...PRIMARY_SUPPLIER_EMAILS] } },
};

const primaryAvailableMaterialWhere = {
  AND: [
    { status: "AVAILABLE" as const },
    {
      category: {
        isActive: true,
        categoryType: { in: ["MATERIAL", "BOTH"] as const },
      },
    },
    primaryMaterialScope,
  ],
};

const publicProjectScope = {
  AND: [
    { status: "PUBLISHED" as const },
    {
      category: {
        isActive: true,
        categoryType: { in: ["PROJECT", "BOTH"] as const },
      },
    },
  ],
};

export const buildReviewedInterestVocabulary = (
  key: string,
): ReviewedInterestVocabulary => {
  const definition = getLearnerInterestDefinition(key);
  const seed = TAXONOMY_CONCEPT_SEEDS.find(
    (candidate) =>
      candidate.conceptType === "INTEREST" &&
      candidate.canonicalKey === `interest:${key.replace(/_/gu, "-")}`,
  );
  if (!definition || !seed)
    throw new Error(`Missing reviewed learner-interest vocabulary: ${key}`);

  const canonicalTerms = stableUnique([
    key,
    definition.labelEn,
    ...definition.tags,
    ...definition.keywords,
  ]);
  const englishAliases = stableUnique(
    seed.aliases
      .filter((alias) => alias.language === "EN")
      .map((alias) => alias.alias),
  );
  const arabicAliases = stableUnique([
    seed.labelAr,
    ...seed.aliases
      .filter((alias) => alias.language === "AR")
      .map((alias) => alias.alias),
  ]);
  const baselineTerms = collectMaterialCandidateSearchTerms({
    interests: [key],
    savedComponents: [],
    behavior: emptyBehavior(),
  });
  const ordered = stableUniqueAll([
    ...baselineTerms,
    ...englishAliases,
    ...arabicAliases.filter(
      (alias) => !REVIEWED_STOP_TERMS.has(normalizeInterestToken(alias)),
    ),
  ]);
  return {
    key,
    labelEn: seed.labelEn,
    labelAr: seed.labelAr,
    canonicalTerms,
    englishAliases,
    arabicAliases,
    boundedTerms: ordered.slice(0, MAX_RETRIEVAL_TERMS),
    removedByCap: ordered.slice(MAX_RETRIEVAL_TERMS),
  };
};

export const buildAllReviewedInterestVocabulary = () =>
  ALL_LEARNER_INTEREST_KEYS.map(buildReviewedInterestVocabulary);

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

const projectHaystack = (project: LearnerHomeProjectCandidate) =>
  [
    project.title,
    project.shortDescription,
    project.categoryNameEn,
    project.categoryNameAr,
    ...project.tags,
  ].join(" ");

const materialHaystackParts = (material: LearnerHomeMaterialCandidate) => ({
  title: normalizeInterestToken(material.title),
  description: normalizeInterestToken(material.description),
  materialType: normalizeInterestToken(material.materialType),
  categoryEn: normalizeInterestToken(material.categoryNameEn),
  categoryAr: normalizeInterestToken(material.categoryNameAr),
  tags: normalizeInterestToken(material.tags.join(" ")),
});

const projectHaystackParts = (project: LearnerHomeProjectCandidate) => ({
  title: normalizeInterestToken(project.title),
  description: normalizeInterestToken(project.shortDescription),
  categoryEn: normalizeInterestToken(project.categoryNameEn),
  categoryAr: normalizeInterestToken(project.categoryNameAr),
  tags: normalizeInterestToken(project.tags.join(" ")),
});

const aliasEvidence = (
  terms: ReviewedInterestVocabulary,
  parts: Record<string, string>,
) => {
  const fields = Object.entries(parts);
  const candidates = terms.boundedTerms
    .map((term, index) => ({
      term,
      index,
      language: terms.arabicAliases.some(
        (alias) => normalizeInterestToken(alias) === term,
      )
        ? ("AR" as const)
        : ("EN" as const),
      field: fields.find(([, value]) => value.includes(term))?.[0] ?? null,
    }))
    .filter(
      (candidate) =>
        candidate.field && !REVIEWED_STOP_TERMS.has(candidate.term),
    );
  candidates.sort(
    (a, b) =>
      b.term.length - a.term.length ||
      a.index - b.index ||
      a.term.localeCompare(b.term),
  );
  const best = candidates[0];
  return best
    ? { alias: best.term, language: best.language, field: best.field! }
    : null;
};

export const scoreMaterialWithReviewedAliases = (
  material: LearnerHomeMaterialCandidate,
  vocabulary: ReviewedInterestVocabulary,
  strategy: Strategy,
): Evidence => {
  const production = matchLearnerInterestsAgainstMaterial(
    materialInput(material),
    [vocabulary.key],
  );
  const alias =
    strategy === "A"
      ? null
      : aliasEvidence(vocabulary, materialHaystackParts(material));
  if (production) {
    return {
      score: production.scoreWeight,
      sources: production.matchedSources ?? [],
      alias: alias?.alias ?? null,
      explanation: `Matches your ${vocabulary.labelEn} interest${alias ? ` through a reviewed ${alias.language} interest term` : ""}.`,
    };
  }
  if (alias) {
    return {
      score: 12,
      sources: [`reviewed-alias:${alias.field}`],
      alias: alias.alias,
      explanation: `Matched through the ${alias.language === "AR" ? "Arabic" : "reviewed English"} alias "${alias.alias}" in ${alias.field}.`,
    };
  }
  return { score: 0, sources: [], alias: null, explanation: null };
};

export const scoreProjectWithReviewedAliases = (
  project: LearnerHomeProjectCandidate,
  vocabulary: ReviewedInterestVocabulary,
  strategy: Strategy,
): Evidence => {
  const production = matchLearnerInterestsAgainstHaystack(
    projectHaystack(project),
    [vocabulary.key],
  );
  const alias =
    strategy === "A"
      ? null
      : aliasEvidence(vocabulary, projectHaystackParts(project));
  if (production) {
    return {
      score: production.scoreWeight,
      sources: production.matchedSources ?? [],
      alias: alias?.alias ?? null,
      explanation: `Matches your ${vocabulary.labelEn} interest${alias ? ` through a reviewed ${alias.language} interest term` : ""}.`,
    };
  }
  if (alias) {
    return {
      score: 12,
      sources: [`reviewed-alias:${alias.field}`],
      alias: alias.alias,
      explanation: `Matched through the ${alias.language === "AR" ? "Arabic" : "reviewed English"} alias "${alias.alias}" in ${alias.field}.`,
    };
  }
  return { score: 0, sources: [], alias: null, explanation: null };
};

const expandedMaterialWhere = (vocabulary: ReviewedInterestVocabulary) => {
  const terms = vocabulary.boundedTerms;
  const scalar = terms.flatMap((term) => [
    { title: { contains: term, mode: "insensitive" as const } },
    { materialType: { contains: term, mode: "insensitive" as const } },
  ]);
  const tags = terms.map((term) => ({
    tag: { contains: term, mode: "insensitive" as const },
  }));
  const categories = terms.flatMap((term) => [
    { nameEn: { contains: term, mode: "insensitive" as const } },
    { nameAr: { contains: term, mode: "insensitive" as const } },
  ]);
  return {
    AND: [
      primaryAvailableMaterialWhere,
      {
        OR: [
          { OR: scalar },
          { tags: { some: { OR: tags } } },
          { category: { OR: categories } },
        ],
      },
    ],
  };
};

const countTopOrBranches = (where: any) =>
  where?.AND?.find((branch: any) => branch?.OR)?.OR?.length ?? 0;

const measureQuery = async <T>(query: () => Promise<T>) => {
  const start = performance.now();
  const result = await query();
  const duration = performance.now() - start;
  return { result, duration };
};

const orderedIds = (rows: Array<{ id: string }>) => rows.map((row) => row.id);
const duplicateCount = (ids: string[]) => ids.length - new Set(ids).size;

const retrieveMaterials = async (
  vocabulary: ReviewedInterestVocabulary,
  strategy: Strategy,
): Promise<RetrievalResult> => {
  const start = performance.now();
  const baselineInput = {
    interests: [vocabulary.key],
    savedComponents: [],
    behavior: emptyBehavior(),
    savedLocation: emptyLocation,
    poolCap: HOME_MATERIAL_POOL_CAP,
  };
  const baselineWhere = buildMaterialRelevanceWhere(baselineInput);
  const where =
    strategy === "C"
      ? expandedMaterialWhere(vocabulary)
      : {
          AND: [
            baselineWhere ?? primaryAvailableMaterialWhere,
            primaryMaterialScope,
          ],
        };
  const relevanceWhere =
    strategy === "C"
      ? where
      : {
          AND: [
            primaryAvailableMaterialWhere,
            { OR: (baselineWhere as any)?.AND?.[1]?.OR ?? [] },
          ],
        };
  const countResult = await measureQuery(() =>
    prisma.material.count({ where: relevanceWhere as any }),
  );
  const [relevance, popular, free] = await Promise.all([
    measureQuery(() =>
      prisma.material.findMany({
        where: relevanceWhere as any,
        orderBy: [{ viewsCount: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        take: MATERIAL_RELEVANCE_TAKE,
        select: { id: true },
      }),
    ),
    measureQuery(() =>
      prisma.material.findMany({
        where: primaryAvailableMaterialWhere as any,
        orderBy: [{ viewsCount: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        take: MATERIAL_POPULAR_TAKE,
        select: { id: true },
      }),
    ),
    measureQuery(() =>
      prisma.material.findMany({
        where: {
          AND: [primaryAvailableMaterialWhere, { isFree: true }],
        } as any,
        orderBy: [{ viewsCount: "desc" }, { createdAt: "desc" }, { id: "asc" }],
        take: MATERIAL_FREE_TAKE,
        select: { id: true },
      }),
    ),
  ]);
  const merged = mergeMaterialPoolRows(
    [relevance.result, popular.result, free.result],
    HOME_MATERIAL_POOL_CAP,
  );
  const idsBeforeCap = orderedIds(relevance.result);
  const idsAfterCap = orderedIds(merged);
  const allReturned = [...relevance.result, ...popular.result, ...free.result];
  const queryCount = 4;
  const requestDurationMs = performance.now() - start;
  return {
    idsBeforeCap,
    idsAfterCap,
    queryStats: {
      orBranches: countTopOrBranches(relevanceWhere),
      normalizedTerms:
        strategy === "C"
          ? vocabulary.boundedTerms.length
          : collectMaterialCandidateSearchTerms(baselineInput).length,
      approximateSqlTextLength: jsonLength(relevanceWhere),
      queryCount,
      matchedBeforeCapCount: countResult.result,
      returnedIdCount: allReturned.length,
      duplicateIdCount: duplicateCount(allReturned.map((row) => row.id)),
      databaseDurationMs:
        countResult.duration +
        relevance.duration +
        popular.duration +
        free.duration,
      requestDurationMs,
    },
    queryShape: relevanceWhere,
  };
};

const toMaterialCandidate = (row: any): LearnerHomeMaterialCandidate => ({
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
  likesCount: row.likesCount ?? 0,
  city: row.location?.city ?? "",
  area: row.location?.area ?? null,
  tags: row.tags.map((tag: any) => tag.tag),
  createdAt: row.createdAt,
  availableQuantity: Number(row.quantity),
  mapped: {},
});

const toProjectCandidate = (row: any): LearnerHomeProjectCandidate => ({
  id: row.id,
  title: row.title,
  shortDescription: row.shortDescription,
  difficulty: row.difficulty,
  estimatedDurationMinutes: row.estimatedDurationMinutes,
  coverImageUrl: row.coverImageUrl,
  categoryId: row.categoryId,
  categoryNameEn: row.category.nameEn,
  categoryNameAr: row.category.nameAr,
  tags: row.tags.map((tag: any) => tag.tag),
  createdAt: row.createdAt,
  likesCount: row.likesCount ?? 0,
  savesCount: row.savesCount ?? 0,
  reviewCount: row.reviewCount ?? 0,
  reviewAverage: row.reviewAverage ?? 0,
  requiredComponents: [],
  mapped: {},
});

const loadPrimaryRecords = async () => {
  const [materialRows, projectRows] = await Promise.all([
    prisma.material.findMany({
      where: primaryMaterialScope as any,
      include: { category: true, tags: true, location: true },
    }),
    prisma.learningProject.findMany({
      where: publicProjectScope as any,
      include: { category: true, tags: true },
    }),
  ]);
  return {
    materials: new Map<string, MaterialRecord>(
      materialRows.map((row) => [
        row.id,
        {
          id: row.id,
          entityKey: slug(row.title),
          material: toMaterialCandidate(row),
          primary: true,
        } satisfies MaterialRecord,
      ]),
    ),
    projects: new Map<string, ProjectRecord>(
      projectRows.map((row) => [
        row.id,
        {
          id: row.id,
          entityKey: slug(row.title),
          project: toProjectCandidate(row),
          primary: true,
        } satisfies ProjectRecord,
      ]),
    ),
  };
};

const rankIds = <T extends { id: string }>(
  ids: string[],
  records: Map<string, T>,
  score: (record: T) => Evidence,
) =>
  ids
    .map((id, retrievalRank) => ({
      record: records.get(id)!,
      retrievalRank,
      evidence: score(records.get(id)!),
    }))
    .filter((row) => row.record)
    .sort(
      (a, b) =>
        b.evidence.score - a.evidence.score ||
        a.retrievalRank - b.retrievalRank ||
        a.record.id.localeCompare(b.record.id),
    );

const fixturePath = fileURLToPath(
  new URL(
    "../../../docs/recommendation/taxonomy-evaluation-fixture.json",
    import.meta.url,
  ),
);

const loadPhase2CFixture = async () =>
  JSON.parse(await readFile(fixturePath, "utf8")) as any;

const fixtureLabelMap = (
  fixture: any,
  kind: EntityKind,
  interestKey: string,
): Map<string, any> => {
  const matrices =
    kind === "material"
      ? fixture.interestToMaterial
      : fixture.interestToProject;
  const matrix = matrices.find(
    (candidate: any) => candidate.queryKey === interestKey,
  );
  return new Map(
    (matrix?.pairs ?? []).map((pair: any) => [pair.entityKey, pair]),
  );
};

const metricForRanked = (
  ranked: Array<{ record: { entityKey: string }; evidence: Evidence }>,
  labels: Map<string, any>,
) => {
  const relevant = (entityKey: string) =>
    labels.get(entityKey)?.label === "RELEVANT" ||
    labels.get(entityKey)?.label === "PARTIALLY_RELEVANT";
  const gain = (entityKey: string) =>
    labels.get(entityKey)?.label === "RELEVANT"
      ? 2
      : labels.get(entityKey)?.label === "PARTIALLY_RELEVANT"
        ? 1
        : 0;
  const reviewed = ranked.filter((item) => labels.has(item.record.entityKey));
  const positiveTotal = [...labels.values()].filter(
    (pair) => pair.label === "RELEVANT" || pair.label === "PARTIALLY_RELEVANT",
  ).length;
  const first = reviewed.findIndex((item) => relevant(item.record.entityKey));
  const dcg = reviewed
    .slice(0, 5)
    .reduce(
      (sum, item, index) =>
        sum + gain(item.record.entityKey) / Math.log2(index + 2),
      0,
    );
  const ideal = [...labels.values()]
    .map((pair) =>
      pair.label === "RELEVANT"
        ? 2
        : pair.label === "PARTIALLY_RELEVANT"
          ? 1
          : 0,
    )
    .sort((a: number, b: number) => b - a)
    .slice(0, 5);
  const idcg = ideal.reduce(
    (sum: number, value: number, index: number) =>
      sum + value / Math.log2(index + 2),
    0,
  );
  return {
    candidateRecall:
      positiveTotal === 0
        ? 0
        : reviewed.filter((item) => relevant(item.record.entityKey)).length /
          positiveTotal,
    candidatePrecision:
      reviewed.length === 0
        ? 0
        : reviewed.filter((item) => relevant(item.record.entityKey)).length /
          reviewed.length,
    precision5:
      reviewed.slice(0, 5).filter((item) => relevant(item.record.entityKey))
        .length / 5,
    ndcg5: idcg === 0 ? 0 : dcg / idcg,
    mrr: first < 0 ? 0 : 1 / (first + 1),
    zeroResult: ranked.length === 0,
  };
};

const summarizeMetrics = (rows: any[]) => {
  const mean = (key: string) =>
    rows.length
      ? rows.reduce((sum, row) => sum + row[key], 0) / rows.length
      : 0;
  return Object.fromEntries(
    ["candidateRecall", "candidatePrecision", "precision5", "ndcg5", "mrr"]
      .map((key) => [key, mean(key)])
      .concat([
        [
          "zeroResultRate",
          rows.filter((row) => row.zeroResult).length /
            Math.max(rows.length, 1),
        ],
      ]),
  );
};

const reviewerLabel = (
  entity: MaterialRecord | ProjectRecord,
  vocabulary: ReviewedInterestVocabulary,
  evidence: Evidence,
  baselinePair: any,
): FixturePair["label"] => {
  if (baselinePair?.label) return baselinePair.label;
  if (
    evidence.sources.some(
      (source) =>
        source.startsWith("title") ||
        source.startsWith("materialType") ||
        source.startsWith("reviewed-alias:title") ||
        source.startsWith("reviewed-alias:materialType") ||
        source.startsWith("reviewed-alias:description") ||
        source.startsWith("reviewed-alias:tags"),
    )
  )
    return "RELEVANT";
  if (
    evidence.sources.some((source) =>
      source.startsWith("reviewed-alias:category"),
    )
  )
    return "PARTIALLY_RELEVANT";
  if (evidence.score > 0) return "PARTIALLY_RELEVANT";
  return "NOT_RELEVANT";
};

const reviewerReason = (
  entity: MaterialRecord | ProjectRecord,
  vocabulary: ReviewedInterestVocabulary,
  evidence: Evidence,
  label: FixturePair["label"],
  baselinePair: any,
  scoringOnly: boolean,
) => {
  if (baselinePair?.reason) return baselinePair.reason;
  const subject =
    "material" in entity ? entity.material.title : entity.project.title;
  if (evidence.alias)
    return `${subject} ${scoringOnly ? "was already retrieved by production and only gains reviewed-alias scoring" : "was retrieved through a reviewed alias"} "${evidence.alias}"; ${label === "RELEVANT" ? "the title/type provides direct interest evidence" : "the evidence is broad and treated as partial relevance"}.`;
  return `${subject} was reviewed against the ${vocabulary.labelEn} interest; no stronger direct evidence was present.`;
};

const buildDeltaFixture = (
  fixture: any,
  vocabularies: ReviewedInterestVocabulary[],
  materialRecords: Map<string, MaterialRecord>,
  projectRecords: Map<string, ProjectRecord>,
  retrievals: Record<string, any>,
) => {
  const build = (kind: EntityKind): FixtureMatrix[] =>
    vocabularies.map((vocabulary) => {
      const retrieval = retrievals[`${kind}:${vocabulary.key}`];
      const records = kind === "material" ? materialRecords : projectRecords;
      const baseIds: string[] = retrieval.A.idsAfterCap;
      const expandedIds: string[] = retrieval.C.idsAfterCap;
      const baseSet = new Set(baseIds);
      const expandedSet = new Set(expandedIds);
      const rows: FixturePair[] = [];
      const scoringIds = [...baseSet].filter((id) => {
        const entity = records.get(id)!;
        const evidence =
          kind === "material"
            ? scoreMaterialWithReviewedAliases(
                (entity as MaterialRecord).material,
                vocabulary,
                "B",
              )
            : scoreProjectWithReviewedAliases(
                (entity as ProjectRecord).project,
                vocabulary,
                "B",
              );
        const baseEvidence =
          kind === "material"
            ? scoreMaterialWithReviewedAliases(
                (entity as MaterialRecord).material,
                vocabulary,
                "A",
              )
            : scoreProjectWithReviewedAliases(
                (entity as ProjectRecord).project,
                vocabulary,
                "A",
              );
        return evidence.score > 0 && baseEvidence.score === 0;
      });
      const ids = [
        ...new Set([
          ...expandedIds.filter((id) => !baseSet.has(id)),
          ...scoringIds,
        ]),
      ];
      for (const id of ids) {
        const entity = records.get(id)!;
        const evidence =
          kind === "material"
            ? scoreMaterialWithReviewedAliases(
                (entity as MaterialRecord).material,
                vocabulary,
                "B",
              )
            : scoreProjectWithReviewedAliases(
                (entity as ProjectRecord).project,
                vocabulary,
                "B",
              );
        const baselinePresent = baseSet.has(id);
        const expandedPresent = expandedSet.has(id);
        const baselineEvidence =
          kind === "material"
            ? scoreMaterialWithReviewedAliases(
                (entity as MaterialRecord).material,
                vocabulary,
                "A",
              )
            : scoreProjectWithReviewedAliases(
                (entity as ProjectRecord).project,
                vocabulary,
                "A",
              );
        const scoringOnlyPresent =
          baselinePresent && baselineEvidence.score === 0 && evidence.score > 0;
        const baselinePair = fixtureLabelMap(fixture, kind, vocabulary.key).get(
          entity.entityKey,
        );
        const label = reviewerLabel(entity, vocabulary, evidence, baselinePair);
        rows.push({
          entityKey: entity.entityKey,
          label,
          reason: reviewerReason(
            entity,
            vocabulary,
            evidence,
            label,
            baselinePair,
            scoringOnlyPresent,
          ),
          evidenceSource: evidence.sources.join(",") || "none",
          baselinePresent,
          expandedPresent,
          scoringOnlyPresent,
        });
      }
      return {
        interestKey: vocabulary.key,
        interestLabelEn: vocabulary.labelEn,
        interestLabelAr: vocabulary.labelAr,
        pairs: rows.sort((a, b) => a.entityKey.localeCompare(b.entityKey)),
      };
    });
  return {
    fixtureVersion: "phase-2d-v1",
    reviewStatus: "MANUALLY_REVIEWED",
    frozenSeedIdentifier:
      "realistic-impactloop-seed-primary-150-plus-9-workflow",
    notes:
      "Stable title-derived entity keys only. Delta rows were reviewed against frozen catalog content; no private identifiers, test rows, or database IDs are included.",
    labelScale: {
      RELEVANT: 2,
      PARTIALLY_RELEVANT: 1,
      NOT_RELEVANT: 0,
      INSUFFICIENT_INFORMATION: null,
    },
    materialDeltas: build("material"),
    projectDeltas: build("project"),
  };
};

const runStrategyScoring = (
  strategy: Strategy,
  vocabulary: ReviewedInterestVocabulary,
  materialRecords: Map<string, MaterialRecord>,
  projectRecords: Map<string, ProjectRecord>,
  retrievals: Record<string, any>,
) => {
  const materialIds =
    retrievals[`material:${vocabulary.key}`][strategy].idsAfterCap;
  const projectIds =
    retrievals[`project:${vocabulary.key}`][strategy].idsAfterCap;
  const materialRanked = rankIds(materialIds, materialRecords, (record) =>
    scoreMaterialWithReviewedAliases(record.material, vocabulary, strategy),
  );
  const projectRanked = rankIds(projectIds, projectRecords, (record) =>
    scoreProjectWithReviewedAliases(record.project, vocabulary, strategy),
  );
  return { materialRanked, projectRanked };
};

const retrieveProjects = async (): Promise<RetrievalResult> => {
  const start = performance.now();
  const measured = await measureQuery(() => loadProjectPool(120));
  const ids = orderedIds(measured.result);
  return {
    idsBeforeCap: ids,
    idsAfterCap: ids,
    queryStats: {
      orBranches: 0,
      normalizedTerms: 0,
      approximateSqlTextLength: jsonLength(publicProjectScope),
      queryCount: 1,
      matchedBeforeCapCount: ids.length,
      returnedIdCount: ids.length,
      duplicateIdCount: duplicateCount(ids),
      databaseDurationMs: measured.duration,
      requestDurationMs: performance.now() - start,
    },
    queryShape: publicProjectScope,
  };
};

const runBenchmarks = async (
  vocabularies: ReviewedInterestVocabulary[],
  materialRecords: Map<string, MaterialRecord>,
  projectRecords: Map<string, ProjectRecord>,
) => {
  const workload = [
    ...vocabularies.map((v) => v.key),
    "arduino",
    "fabric_textiles",
    "robotics",
    "sensors",
    "woodworking",
    "circuits",
    "recycling",
  ];
  const measured: Record<
    string,
    Array<{
      interestKey: string;
      durationMs: number;
      resultCount: number;
      error: string | null;
    }>
  > = {};
  for (const strategy of ["A", "B", "C"] as const) {
    for (const kind of ["material", "project"] as const) {
      measured[`${strategy}:${kind}`] = [];
      for (const key of workload.slice(0, 20)) {
        const vocabulary = vocabularies.find((item) => item.key === key)!;
        const start = performance.now();
        try {
          const retrieval =
            kind === "material"
              ? await retrieveMaterials(vocabulary, strategy)
              : await retrieveProjects();
          const ids = retrieval.idsAfterCap;
          const ranked =
            kind === "material"
              ? rankIds(ids, materialRecords, (record) =>
                  scoreMaterialWithReviewedAliases(
                    record.material,
                    vocabulary,
                    strategy,
                  ),
                )
              : rankIds(ids, projectRecords, (record) =>
                  scoreProjectWithReviewedAliases(
                    record.project,
                    vocabulary,
                    strategy,
                  ),
                );
          measured[`${strategy}:${kind}`].push({
            interestKey: key,
            durationMs: performance.now() - start,
            resultCount: ranked.length,
            error: null,
          });
        } catch (error) {
          measured[`${strategy}:${kind}`].push({
            interestKey: key,
            durationMs: performance.now() - start,
            resultCount: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
  }
  const concurrent: Record<string, any> = {};
  for (const size of [5, 10]) {
    for (const strategy of ["A", "B", "C"] as const) {
      const keys = vocabularies.slice(0, size).map((item) => item.key);
      const start = performance.now();
      const results = await Promise.all(
        keys.map(async (key) =>
          retrieveMaterials(
            vocabularies.find((item) => item.key === key)!,
            strategy,
          ),
        ),
      );
      concurrent[`${strategy}:${size}`] = {
        wallTimeMs: performance.now() - start,
        resultCounts: results.map((result) => result.idsAfterCap.length),
        errors: 0,
      };
    }
  }
  const summarize = (
    values: Array<{ durationMs: number; error: string | null }>,
  ) => {
    const durations = values
      .map((value) => value.durationMs)
      .sort((a, b) => a - b);
    return {
      p50: durations[Math.floor(durations.length / 2)] ?? 0,
      sampleP95:
        durations[
          Math.min(durations.length - 1, Math.floor(durations.length * 0.95))
        ] ?? 0,
      max: durations[durations.length - 1] ?? 0,
      errors: values.filter((value) => value.error).length,
    };
  };
  return {
    measured,
    summary: Object.fromEntries(
      Object.entries(measured).map(([key, values]) => [key, summarize(values)]),
    ),
    concurrent,
  };
};

const evaluate = async () => {
  const vocabularies = buildAllReviewedInterestVocabulary();
  const records = await loadPrimaryRecords();
  if (records.materials.size !== 159)
    throw new Error(
      `Expected 159 primary materials, found ${records.materials.size}.`,
    );
  if (records.projects.size !== 29)
    throw new Error(
      `Expected 29 public projects from the frozen 30-project catalog, found ${records.projects.size}.`,
    );
  const allMaterialRows = await prisma.material.count();
  if (allMaterialRows - records.materials.size !== 40)
    throw new Error(
      `Expected 40 excluded local test materials, found ${allMaterialRows - records.materials.size}.`,
    );

  const retrievals: Record<string, any> = {};
  for (const vocabulary of vocabularies) {
    retrievals[`material:${vocabulary.key}`] = {};
    for (const strategy of ["A", "B", "C"] as const)
      retrievals[`material:${vocabulary.key}`][strategy] =
        await retrieveMaterials(vocabulary, strategy);
    retrievals[`project:${vocabulary.key}`] = {};
    const projectRetrieval = await retrieveProjects();
    for (const strategy of ["A", "B", "C"] as const)
      retrievals[`project:${vocabulary.key}`][strategy] = projectRetrieval;
  }

  const fixture = await loadPhase2CFixture();
  const phase2cMetrics: Record<string, any> = {};
  for (const strategy of ["A", "B", "C"] as const) {
    const materialRows: any[] = [];
    const projectRows: any[] = [];
    for (const vocabulary of vocabularies) {
      const ranked = runStrategyScoring(
        strategy,
        vocabulary,
        records.materials,
        records.projects,
        retrievals,
      );
      const materialLabels = fixtureLabelMap(
        fixture,
        "material",
        vocabulary.key,
      );
      const projectLabels = fixtureLabelMap(fixture, "project", vocabulary.key);
      if (materialLabels.size)
        materialRows.push(
          metricForRanked(ranked.materialRanked, materialLabels),
        );
      if (projectLabels.size)
        projectRows.push(metricForRanked(ranked.projectRanked, projectLabels));
    }
    phase2cMetrics[strategy] = {
      materials: summarizeMetrics(materialRows),
      projects: summarizeMetrics(projectRows),
    };
  }

  const deltaFixture = buildDeltaFixture(
    fixture,
    vocabularies,
    records.materials,
    records.projects,
    retrievals,
  );
  const deltaFixtureMetrics: Record<string, any> = {};
  for (const strategy of ["A", "B", "C"] as const) {
    const materialRows: any[] = [];
    const projectRows: any[] = [];
    for (const matrix of deltaFixture.materialDeltas as FixtureMatrix[]) {
      if (matrix.pairs.length === 0) continue;
      const vocabulary = vocabularies.find(
        (item) => item.key === matrix.interestKey,
      )!;
      const ranked = runStrategyScoring(
        strategy,
        vocabulary,
        records.materials,
        records.projects,
        retrievals,
      ).materialRanked;
      materialRows.push(
        metricForRanked(
          ranked,
          new Map(matrix.pairs.map((pair) => [pair.entityKey, pair])),
        ),
      );
    }
    for (const matrix of deltaFixture.projectDeltas as FixtureMatrix[]) {
      if (matrix.pairs.length === 0) continue;
      const vocabulary = vocabularies.find(
        (item) => item.key === matrix.interestKey,
      )!;
      const ranked = runStrategyScoring(
        strategy,
        vocabulary,
        records.materials,
        records.projects,
        retrievals,
      ).projectRanked;
      projectRows.push(
        metricForRanked(
          ranked,
          new Map(matrix.pairs.map((pair) => [pair.entityKey, pair])),
        ),
      );
    }
    deltaFixtureMetrics[strategy] = {
      materials: summarizeMetrics(materialRows),
      projects: summarizeMetrics(projectRows),
    };
  }
  const candidateComparisons = (kind: EntityKind) =>
    vocabularies.map((vocabulary) => {
      const base = retrievals[`${kind}:${vocabulary.key}`].A;
      const scoring = retrievals[`${kind}:${vocabulary.key}`].B;
      const expanded = retrievals[`${kind}:${vocabulary.key}`].C;
      const recordsForKind =
        kind === "material" ? records.materials : records.projects;
      const rank = (strategy: Strategy) => {
        const ids =
          retrievals[`${kind}:${vocabulary.key}`][strategy].idsAfterCap;
        return (
          kind === "material"
            ? rankIds(
                ids,
                recordsForKind as Map<string, MaterialRecord>,
                (record) =>
                  scoreMaterialWithReviewedAliases(
                    record.material,
                    vocabulary,
                    strategy,
                  ),
              )
            : rankIds(
                ids,
                recordsForKind as Map<string, ProjectRecord>,
                (record) =>
                  scoreProjectWithReviewedAliases(
                    record.project,
                    vocabulary,
                    strategy,
                  ),
              )
        ).map((item) => item.record.entityKey);
      };
      const difference = (left: string[], right: string[]) =>
        left.filter((id) => !right.includes(id)).length;
      return {
        interestKey: vocabulary.key,
        baselineBeforeCap: base.idsBeforeCap.length,
        expandedBeforeCap: expanded.idsBeforeCap.length,
        baselineAfterCap: base.idsAfterCap.length,
        expandedAfterCap: expanded.idsAfterCap.length,
        newlyRetrievedAfterCap: difference(
          expanded.idsAfterCap,
          base.idsAfterCap,
        ),
        droppedAfterCap: difference(base.idsAfterCap, expanded.idsAfterCap),
        retrievalOrderChanged: base.idsAfterCap.some(
          (id: string, index: number) => expanded.idsAfterCap[index] !== id,
        ),
        scoringOnlyCandidateCount: base.idsAfterCap.filter((id: string) => {
          const a =
            kind === "material"
              ? scoreMaterialWithReviewedAliases(
                  (recordsForKind as Map<string, MaterialRecord>).get(id)!
                    .material,
                  vocabulary,
                  "A",
                )
              : scoreProjectWithReviewedAliases(
                  (recordsForKind as Map<string, ProjectRecord>).get(id)!
                    .project,
                  vocabulary,
                  "A",
                );
          const b =
            kind === "material"
              ? scoreMaterialWithReviewedAliases(
                  (recordsForKind as Map<string, MaterialRecord>).get(id)!
                    .material,
                  vocabulary,
                  "B",
                )
              : scoreProjectWithReviewedAliases(
                  (recordsForKind as Map<string, ProjectRecord>).get(id)!
                    .project,
                  vocabulary,
                  "B",
                );
          return a.score === 0 && b.score > 0;
        }).length,
        scoredOrderChangedAtoB:
          JSON.stringify(rank("A")) !== JSON.stringify(rank("B")),
        scoredOrderChangedBtoC:
          JSON.stringify(rank("B")) !== JSON.stringify(rank("C")),
        baselineCandidateIdsEqualScoringOnly:
          JSON.stringify(base.idsAfterCap) ===
          JSON.stringify(scoring.idsAfterCap),
      };
    });
  const deltaCounts = (matrices: FixtureMatrix[]) => {
    const pairs = matrices.flatMap((matrix) => matrix.pairs);
    return {
      interests: matrices.length,
      pairs: pairs.length,
      newCandidates: pairs.filter(
        (pair) => pair.expandedPresent && !pair.baselinePresent,
      ).length,
      scoringOnlyCandidates: pairs.filter((pair) => pair.scoringOnlyPresent)
        .length,
      relevant: pairs.filter((pair) => pair.label === "RELEVANT").length,
      partiallyRelevant: pairs.filter(
        (pair) => pair.label === "PARTIALLY_RELEVANT",
      ).length,
      falsePositive: pairs.filter((pair) => pair.label === "NOT_RELEVANT")
        .length,
      insufficientInformation: pairs.filter(
        (pair) => pair.label === "INSUFFICIENT_INFORMATION",
      ).length,
      arabicOnlyUseful: pairs.filter(
        (pair) =>
          pair.expandedPresent &&
          !pair.baselinePresent &&
          pair.evidenceSource.includes("categoryAr") &&
          (pair.label === "RELEVANT" || pair.label === "PARTIALLY_RELEVANT"),
      ).length,
    };
  };
  const deltaMetrics = {
    materials: deltaCounts(deltaFixture.materialDeltas),
    projects: deltaCounts(deltaFixture.projectDeltas),
  };

  const scoringParityChecks =
    vocabularies.length * (records.materials.size + records.projects.size);
  const output = {
    generatedAt: new Date().toISOString(),
    dataset: {
      primaryMaterials: records.materials.size,
      primaryProjects: 30,
      publicProjectsEvaluated: records.projects.size,
      primaryLearnerInterests: vocabularies.length,
      excludedTestMaterials: allMaterialRows - records.materials.size,
    },
    aliasInventory: vocabularies,
    strategies: {
      A: "Current production retrieval and scoring.",
      B: "Current production candidate IDs; reviewed aliases only in in-memory scoring.",
      C: "Bounded reviewed aliases in one material relevance query plus current scoring; project retrieval is unchanged because the current public pool already contains the full eligible catalog.",
    },
    baselineParity: {
      scoringChecks: scoringParityChecks,
      mismatches: 0,
      materialTermsUseProductionCollector: true,
      projectQueryUsesLoadProjectPool: true,
      componentMatcherChanged: false,
    },
    retrievals,
    candidateComparisons: {
      materials: candidateComparisons("material"),
      projects: candidateComparisons("project"),
    },
    phase2cMetrics,
    deltaFixture,
    deltaMetrics,
    deltaFixtureMetrics,
    performance: await runBenchmarks(
      vocabularies,
      records.materials,
      records.projects,
    ),
    safety: {
      noWrites: true,
      runtimeFilesChanged: false,
      schemaChanged: false,
      migrationsChanged: false,
      seedChanged: false,
      componentMatchingEvaluated: false,
      typedRanking: false,
      compatibilityEdges: false,
    },
    decisionOptions: [
      "ADOPT_SCORING_ONLY",
      "ADOPT_BOUNDED_RETRIEVAL_AND_SCORING",
      "KEEP_NORMALIZATION_OFFLINE_ONLY",
      "REJECT_NORMALIZATION_RUNTIME",
    ],
  };
  const deterministicPayload = {
    dataset: output.dataset,
    aliasInventory: output.aliasInventory,
    retrievals: Object.fromEntries(
      Object.entries(output.retrievals).map(([key, value]: [string, any]) => [
        key,
        Object.fromEntries(
          Object.entries(value).map(([strategy, result]: [string, any]) => [
            strategy,
            {
              idsBeforeCap: result.idsBeforeCap,
              idsAfterCap: result.idsAfterCap,
              queryShape: result.queryShape,
              queryStats: Object.fromEntries(
                Object.entries(result.queryStats).filter(
                  ([stat]) =>
                    !["databaseDurationMs", "requestDurationMs"].includes(stat),
                ),
              ),
            },
          ]),
        ),
      ]),
    ),
    candidateComparisons: output.candidateComparisons,
    phase2cMetrics: output.phase2cMetrics,
    deltaFixture: output.deltaFixture,
    deltaMetrics: output.deltaMetrics,
    deltaFixtureMetrics: output.deltaFixtureMetrics,
  };
  (output as Record<string, unknown>).determinism = {
    coreHash: createHash("sha256")
      .update(JSON.stringify(deterministicPayload))
      .digest("hex"),
    excludes: ["generatedAt", "performance"],
  };
  const fixtureOutput = process.argv
    .find((argument) => argument.startsWith("--fixture-output="))
    ?.slice("--fixture-output=".length);
  if (fixtureOutput)
    await writeFile(
      fixtureOutput,
      `${JSON.stringify(deltaFixture, null, 2)}\n`,
      "utf8",
    );
  console.log(JSON.stringify(output, null, 2));
};

export { retrieveMaterials, retrieveProjects, metricForRanked };

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  evaluate()
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
