import { createHash } from "node:crypto";
import path from "node:path";

import type { env as EnvType } from "../src/config/env.js";
import type {
  LearnerHomeResponse,
  LearnerHomeSectionDetails,
} from "../src/modules/learner-home/learner-home.types.js";
import { matchLearnerInterestsAgainstMaterial } from "../src/modules/learner-home/learner-interest-taxonomy.js";
import type { ShadowDiagnostics } from "../src/modules/recommendations/ml-shadow.service.js";

export type EvaluationModeKey =
  "A_baseline" | "B_shadow" | "C_material" | "D_project" | "E_both";

export type ArchetypeKey =
  | "cold_start"
  | "profile_only"
  | "material_coherent"
  | "material_scattered"
  | "project_coherent"
  | "project_scattered"
  | "mixed"
  | "sparse_candidates";

export type ReleaseClassification =
  "READY_FOR_CONTROLLED_LOCAL_DEMO" | "READY_WITH_WARNINGS" | "NOT_READY";

export type RecommendationFlagState = {
  /** Authoritative runtime mode for this evaluation step. */
  runtimeMode: 'DETERMINISTIC' | 'SHADOW' | 'ML_PRIMARY';
  shadow: boolean;
  materialPath: string;
  projectPath: string;
};

export const EVALUATION_MODES: Record<
  EvaluationModeKey,
  Pick<RecommendationFlagState, 'runtimeMode' | 'shadow'>
> = {
  A_baseline: { runtimeMode: 'DETERMINISTIC', shadow: false },
  B_shadow: { runtimeMode: 'SHADOW', shadow: true },
  // Legacy C/D/E serving-flag modes collapse to ML_PRIMARY (serving flags removed).
  C_material: { runtimeMode: 'ML_PRIMARY', shadow: true },
  D_project: { runtimeMode: 'ML_PRIMARY', shadow: true },
  E_both: { runtimeMode: 'ML_PRIMARY', shadow: true },
};

export const ARCHETYPE_KEYS: ArchetypeKey[] = [
  "cold_start",
  "profile_only",
  "material_coherent",
  "material_scattered",
  "project_coherent",
  "project_scattered",
  "mixed",
  "sparse_candidates",
];

export const ML_SHADOW_TIMEOUT_MS = 1_000;
export const MAX_CANDIDATE_BOUND = 200;

export const REQUIRED_REPORT_KEYS = [
  "runMetadata",
  "artifactVersions",
  "featureSchemaVersions",
  "evaluatedArchetypes",
  "modeComparisons",
  "correctnessInvariants",
  "qualityProxies",
  "confidenceDistributions",
  "latencySummary",
  "fallbackSummary",
  "releaseBlockers",
  "warnings",
  "finalRecommendation",
  "determinism",
] as const;

export type LearnerFixtureRow = {
  id: string;
  learnerProfile: { interests: string[] } | null;
  _count: {
    materialLikes: number;
    materialViews: number;
    projectSaves: number;
    projectLikes: number;
    projectBuilds: number;
  };
  projectSaves: Array<{ projectId: string }>;
  projectLikes: Array<{ projectId: string }>;
  materialLikes: Array<{ material: { categoryId: string } }>;
  materialViews: Array<{ material: { categoryId: string } }>;
};

export type ArchetypeResolution =
  "RESOLVED_CONFIRMED" | "RESOLVED_UNCONFIRMED" | "UNRESOLVED";

export type ArchetypeSelection = {
  archetypeKey: ArchetypeKey;
  archetypeStatus: "RESOLVED" | "UNRESOLVED";
  learnerId?: string;
};

export type EvaluatedArchetype = {
  archetypeKey: ArchetypeKey;
  archetypeStatus: "RESOLVED" | "UNRESOLVED";
  archetypeResolution: ArchetypeResolution;
  accountCriteriaMatched: boolean;
  behavioralCriteriaMatched: boolean;
  observedMaterialConfidence?: string;
  observedProjectConfidence?: string;
};

export type ShadowObservation = ShadowDiagnostics & {
  domain: "material" | "project";
};

export type BaselineRequestProof = {
  shadowObservations: number;
  scorerInvocations: number;
  requestFallbackCount: number;
  artifactLoadsAttributed: number;
  deterministicMode: boolean;
};

export type ArtifactCacheStats = { entries: number; artifactLoadCount: number };

export type CaseMetrics = {
  archetypeKey: ArchetypeKey;
  modeKey: EvaluationModeKey;
  httpStatus: number;
  requestDurationMs: number;
  materialRecommendationStatus: string;
  projectReadinessStatus: string;
  materialConfidence: string;
  projectConfidence: string;
  materialRecentSlotsUsedTop5: number;
  materialRecentSlotsUsedTop10: number;
  projectRecentSlotsUsedTop5: number;
  projectRecentSlotsUsedTop10: number;
  deterministicVsServedTop5Overlap: number | null;
  deterministicVsServedTop10Overlap: number | null;
  duplicateCount: number;
  ineligibleCandidateCount: number;
  unavailableMaterialCount: number;
  unpublishedProjectCount: number;
  hydrationMappingFailureCount: number;
  fallbackOccurred: boolean;
  fallbackReasonCategory: string | null;
  homeBrowseMaterialsConsistent: boolean;
  homeBrowseProjectsConsistent: boolean;
  responseSchemaCompatible: boolean;
  deterministicEquivalent: boolean;
  candidateCountMax: number;
};

export type QualityProxyBlock = {
  offlineDiagnosticProxy: true;
  disclaimer: string;
  top5: Record<string, number>;
  top10: Record<string, number>;
};

export type RecommendationEvaluationReport = {
  runMetadata: Record<string, unknown>;
  artifactVersions: Record<string, string>;
  featureSchemaVersions: Record<string, string>;
  evaluatedArchetypes: EvaluatedArchetype[];
  modeComparisons: CaseMetrics[];
  correctnessInvariants: Record<string, boolean>;
  qualityProxies: {
    materials: QualityProxyBlock;
    projects: QualityProxyBlock;
  };
  confidenceDistributions: Record<string, unknown>;
  latencySummary: Record<string, unknown>;
  fallbackSummary: Record<string, unknown>;
  releaseBlockers: string[];
  warnings: string[];
  finalRecommendation: ReleaseClassification;
  determinism: { stableHash: string; excludes: string[] };
};

const PRIVACY_PATTERN =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|"c[a-z0-9]{24,25}"|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/i;

export const resolveArtifactPaths = (repositoryRoot: string) => ({
  material: path.join(
    repositoryRoot,
    "ml/recommendation/generated/portable-model/material-hybrid-runtime-v2.json",
  ),
  project: path.join(
    repositoryRoot,
    "ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json",
  ),
});

export const engagementScore = (learner: LearnerFixtureRow) =>
  learner._count.materialLikes +
  learner._count.materialViews +
  learner._count.projectSaves +
  learner._count.projectLikes +
  learner._count.projectBuilds;

export const materialCategoryIds = (learner: LearnerFixtureRow) =>
  new Set([
    ...learner.materialLikes.map((row) => row.material.categoryId),
    ...learner.materialViews.map((row) => row.material.categoryId),
  ]);

export const projectIdsForLearner = (learner: LearnerFixtureRow) =>
  new Set([
    ...learner.projectSaves.map((row) => row.projectId),
    ...learner.projectLikes.map((row) => row.projectId),
  ]);

export const materialActionCount = (learner: LearnerFixtureRow) =>
  learner._count.materialLikes + learner._count.materialViews;

export const projectActionCount = (learner: LearnerFixtureRow) =>
  learner._count.projectSaves +
  learner._count.projectLikes +
  learner._count.projectBuilds;

export const percentile = (values: number[], fraction: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * fraction;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return low === high
    ? sorted[low]!
    : sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low);
};

export const summarizeDistribution = (values: number[]) => ({
  sampleCount: values.length,
  min: values.length ? Math.min(...values) : 0,
  median: percentile(values, 0.5),
  p75: percentile(values, 0.75),
  p95: percentile(values, 0.95),
  max: values.length ? Math.max(...values) : 0,
});

export const captureRecommendationFlags = (
  env: typeof EnvType,
): RecommendationFlagState => ({
  runtimeMode: env.recommendationMlRuntimeMode,
  shadow: env.recommendationMlShadowEnabled,
  materialPath: env.recommendationMlMaterialArtifactPath,
  projectPath: env.recommendationMlProjectArtifactPath,
});

export const applyRecommendationFlags = (
  env: typeof EnvType,
  flags: RecommendationFlagState,
): void => {
  env.recommendationMlRuntimeMode = flags.runtimeMode;
  env.recommendationMlShadowEnabled = flags.shadow;
  env.recommendationMlMaterialArtifactPath = flags.materialPath;
  env.recommendationMlProjectArtifactPath = flags.projectPath;
};

export const withRecommendationFlags = async <T>(
  env: typeof EnvType,
  prior: RecommendationFlagState,
  next: RecommendationFlagState,
  run: () => Promise<T>,
): Promise<T> => {
  applyRecommendationFlags(env, next);
  try {
    return await run();
  } finally {
    applyRecommendationFlags(env, prior);
  }
};

export const selectLearnerArchetypes = (
  learners: LearnerFixtureRow[],
  sparseCandidateLearnerId?: string,
  forcedArchetypeLearners?: Partial<Record<ArchetypeKey, string>>,
): ArchetypeSelection[] => {
  const used = new Set<string>();
  for (const learnerId of Object.values(forcedArchetypeLearners ?? {})) {
    if (learnerId) used.add(learnerId);
  }
  const pick = (
    archetypeKey: ArchetypeKey,
    predicate: (learner: LearnerFixtureRow) => boolean,
  ): ArchetypeSelection => {
    const forcedLearnerId = forcedArchetypeLearners?.[archetypeKey];
    if (
      forcedLearnerId &&
      learners.some((learner) => learner.id === forcedLearnerId)
    ) {
      return {
        archetypeKey,
        archetypeStatus: "RESOLVED",
        learnerId: forcedLearnerId,
      };
    }
    const match = learners.find(
      (learner) => !used.has(learner.id) && predicate(learner),
    );
    if (match) used.add(match.id);
    return {
      archetypeKey,
      archetypeStatus: match ? "RESOLVED" : "UNRESOLVED",
      learnerId: match?.id,
    };
  };

  const selections = [
    pick(
      "cold_start",
      (learner) =>
        (learner.learnerProfile?.interests.length ?? 0) === 0 &&
        engagementScore(learner) === 0,
    ),
    pick(
      "profile_only",
      (learner) =>
        (learner.learnerProfile?.interests.length ?? 0) > 0 &&
        engagementScore(learner) === 0,
    ),
    pick("material_coherent", (learner) => {
      const categories = materialCategoryIds(learner);
      return (
        materialActionCount(learner) >= 3 &&
        categories.size > 0 &&
        categories.size <= 2
      );
    }),
    pick(
      "material_scattered",
      (learner) => materialCategoryIds(learner).size >= 4,
    ),
    pick("project_coherent", (learner) => {
      const projectIds = projectIdsForLearner(learner);
      return projectIds.size >= 2 && projectActionCount(learner) >= 3;
    }),
    pick("project_scattered", (learner) => {
      const projectIds = projectIdsForLearner(learner);
      return engagementScore(learner) > 8 && projectIds.size >= 4;
    }),
    pick(
      "mixed",
      (learner) =>
        learner._count.materialViews > 0 &&
        learner._count.projectSaves + learner._count.projectBuilds > 0,
    ),
  ];

  const sparseLearner = learners.find(
    (learner) => learner.id === sparseCandidateLearnerId,
  );
  selections.push({
    archetypeKey: "sparse_candidates",
    archetypeStatus: sparseLearner ? "RESOLVED" : "UNRESOLVED",
    learnerId: sparseLearner?.id,
  });

  return selections;
};

export const countRequestFallbacks = (observations: ShadowObservation[]) =>
  observations.filter((entry) => entry.status === "FALLBACK").length;

export const countScorerInvocations = (observations: ShadowObservation[]) =>
  observations.filter(
    (entry) =>
      entry.status === "SCORED" ||
      entry.status === "FALLBACK" ||
      (entry.scoringDurationMs ?? 0) > 0,
  ).length;

export const collectRequestObservations = async <T>(
  buffer: ShadowObservation[],
  run: () => Promise<T>,
): Promise<{ result: T; observations: ShadowObservation[] }> => {
  const start = buffer.length;
  const result = await run();
  return { result, observations: buffer.slice(start) };
};

export const createBaselineRequestProof = (
  observations: ShadowObservation[],
  artifactStatsBefore: ArtifactCacheStats,
  artifactStatsAfter: ArtifactCacheStats,
): BaselineRequestProof => ({
  shadowObservations: observations.length,
  scorerInvocations: countScorerInvocations(observations),
  requestFallbackCount: countRequestFallbacks(observations),
  artifactLoadsAttributed: Math.max(
    0,
    artifactStatsAfter.artifactLoadCount -
      artifactStatsBefore.artifactLoadCount,
  ),
  deterministicMode:
    observations.length === 0 ||
    observations.every((entry) => entry.status === "DISABLED"),
});

export type ComponentConceptInput = {
  isRequired: boolean;
  taxonomyConcepts: Array<{ concept: { canonicalKey: string } }>;
};

export const requiredComponentConceptKeys = (
  components: ComponentConceptInput[],
) =>
  components
    .filter((component) => component.isRequired)
    .flatMap((component) =>
      component.taxonomyConcepts.map((row) => row.concept.canonicalKey),
    );

export const projectComponentCoverageKeys = (
  components: ComponentConceptInput[],
) => requiredComponentConceptKeys(components);

const hasRecentMaterialEvidence = (diagnostics?: ShadowDiagnostics) =>
  Boolean(
    diagnostics &&
    ((diagnostics.recentEvidenceCount ?? 0) > 0 ||
      diagnostics.recentChannelApplied ||
      (diagnostics.recentEventInputCount ?? 0) > 0),
  );

const hasRecentProjectEvidence = (diagnostics?: ShadowDiagnostics) =>
  Boolean(
    diagnostics &&
    ((diagnostics.recentEvidenceCount ?? 0) > 0 ||
      diagnostics.recentChannelApplied ||
      (diagnostics.recentHistoryDistinctProjectCount ?? 0) > 0 ||
      (diagnostics.burstDistinctProjectCount ?? 0) > 0),
  );

export const evaluateArchetypeBehavior = (
  archetypeKey: ArchetypeKey,
  learner: LearnerFixtureRow,
  materialDiagnostics?: ShadowDiagnostics,
  projectDiagnostics?: ShadowDiagnostics,
): { behavioralCriteriaMatched: boolean } => {
  const interests = learner.learnerProfile?.interests.length ?? 0;
  const categories = materialCategoryIds(learner);
  const projects = projectIdsForLearner(learner);
  const materialConfidence = String(
    materialDiagnostics?.recentConfidence ?? "NONE",
  );
  const projectConfidence = String(
    projectDiagnostics?.recentConfidence ?? "NONE",
  );
  const candidateCount = Math.min(
    materialDiagnostics?.candidateCount ?? Number.MAX_SAFE_INTEGER,
    projectDiagnostics?.runtimeCandidateCount ??
      projectDiagnostics?.candidateCount ??
      Number.MAX_SAFE_INTEGER,
  );

  switch (archetypeKey) {
    case "cold_start":
      return {
        behavioralCriteriaMatched:
          interests === 0 &&
          engagementScore(learner) === 0 &&
          materialConfidence === "NONE" &&
          projectConfidence === "NONE" &&
          !hasRecentMaterialEvidence(materialDiagnostics) &&
          !hasRecentProjectEvidence(projectDiagnostics),
      };
    case "profile_only":
      return {
        behavioralCriteriaMatched:
          interests > 0 &&
          engagementScore(learner) === 0 &&
          !hasRecentMaterialEvidence(materialDiagnostics) &&
          !hasRecentProjectEvidence(projectDiagnostics),
      };
    case "material_coherent":
      return {
        behavioralCriteriaMatched:
          materialActionCount(learner) >= 3 &&
          categories.size > 0 &&
          categories.size <= 2 &&
          (materialConfidence === "MEDIUM" || materialConfidence === "HIGH") &&
          hasRecentMaterialEvidence(materialDiagnostics) &&
          ((materialDiagnostics?.candidateCount ?? 0) <= 0 ||
            (materialDiagnostics?.recentSlotsUsedTop5 ?? 0) > 0),
      };
    case "material_scattered":
      return {
        behavioralCriteriaMatched:
          categories.size >= 4 &&
          (materialConfidence === "LOW" ||
            hasRecentMaterialEvidence(materialDiagnostics)),
      };
    case "project_coherent":
      return {
        behavioralCriteriaMatched:
          projects.size >= 2 &&
          projectActionCount(learner) >= 3 &&
          hasRecentProjectEvidence(projectDiagnostics),
      };
    case "project_scattered":
      return {
        behavioralCriteriaMatched:
          engagementScore(learner) > 8 &&
          projects.size >= 4 &&
          projectConfidence === "LOW" &&
          (projectDiagnostics?.burstDistinctProjectCount ?? projects.size) >=
            3 &&
          (projectDiagnostics?.recentSlotsUsedTop5 ?? 0) === 0 &&
          String(projectDiagnostics?.projectReadinessStatus ?? "") === "READY",
      };
    case "mixed":
      return {
        behavioralCriteriaMatched:
          learner._count.materialViews > 0 &&
          learner._count.projectSaves + learner._count.projectBuilds > 0 &&
          hasRecentMaterialEvidence(materialDiagnostics) &&
          hasRecentProjectEvidence(projectDiagnostics),
      };
    case "sparse_candidates":
      return {
        behavioralCriteriaMatched: candidateCount < 80,
      };
    default:
      return { behavioralCriteriaMatched: false };
  }
};

export const resolveEvaluatedArchetype = (
  selection: ArchetypeSelection,
  learner: LearnerFixtureRow | undefined,
  materialDiagnostics?: ShadowDiagnostics,
  projectDiagnostics?: ShadowDiagnostics,
): EvaluatedArchetype => {
  if (!selection.learnerId || !learner) {
    return {
      archetypeKey: selection.archetypeKey,
      archetypeStatus: "UNRESOLVED",
      archetypeResolution: "UNRESOLVED",
      accountCriteriaMatched: false,
      behavioralCriteriaMatched: false,
    };
  }

  const behavior = evaluateArchetypeBehavior(
    selection.archetypeKey,
    learner,
    materialDiagnostics,
    projectDiagnostics,
  );

  return {
    archetypeKey: selection.archetypeKey,
    archetypeStatus: "RESOLVED",
    archetypeResolution: behavior.behavioralCriteriaMatched
      ? "RESOLVED_CONFIRMED"
      : "RESOLVED_UNCONFIRMED",
    accountCriteriaMatched: true,
    behavioralCriteriaMatched: behavior.behavioralCriteriaMatched,
    observedMaterialConfidence: String(
      materialDiagnostics?.recentConfidence ?? "NONE",
    ),
    observedProjectConfidence: String(
      projectDiagnostics?.recentConfidence ?? "NONE",
    ),
  };
};

const hashLabel = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 12);

export const overlapRatio = (
  left: string[],
  right: string[],
  limit: number,
) => {
  const leftSlice = left.slice(0, limit);
  const rightSet = new Set(right.slice(0, limit));
  if (!leftSlice.length) return 1;
  const matches = leftSlice.filter((value) => rightSet.has(value)).length;
  return matches / leftSlice.length;
};

export const computeTopKOverlap = (
  deterministicIds: string[],
  servedIds: string[],
  limit: 5 | 10,
) => {
  const left = deterministicIds.slice(0, limit).map(hashLabel);
  const right = servedIds.slice(0, limit).map(hashLabel);
  return overlapRatio(left, right, limit);
};

type MaterialResponseShape = {
  id?: string;
  status?: string;
  availableQuantity?: number;
  quantity?: number;
  isLiked?: boolean;
  isFree?: boolean;
  deliveryAvailable?: boolean;
  deliveryAllowed?: boolean;
  pickupAllowed?: boolean;
  city?: string;
  ownerId?: string;
  category?: { id?: string };
  categoryId?: string;
  title?: string;
};

type ProjectResponseShape = {
  id?: string;
  isSaved?: boolean;
  isLiked?: boolean;
  category?: { id?: string };
  title?: string;
};

export const extractSectionMaterialIds = (
  response: LearnerHomeResponse,
  sectionKey: string,
) =>
  response.sections
    .find((section) => section.key === sectionKey)
    ?.items.filter((item) => item.type === "material")
    .map((item) => (item.material as MaterialResponseShape).id ?? "") ?? [];

export const extractSectionProjectIds = (
  response: LearnerHomeResponse,
  sectionKey: string,
) =>
  response.sections
    .find((section) => section.key === sectionKey)
    ?.items.filter((item) => item.type === "project")
    .map((item) => (item.project as ProjectResponseShape).id ?? "") ?? [];

export const extractSectionMaterials = (
  response: LearnerHomeResponse | LearnerHomeSectionDetails,
  sectionKey = "suggested_materials",
) => {
  const items =
    "sections" in response
      ? (response.sections.find((section) => section.key === sectionKey)
          ?.items ?? [])
      : response.key === sectionKey
        ? response.items
        : [];
  return items
    .filter((item) => item.type === "material")
    .map((item) => item.material as MaterialResponseShape);
};

export const extractSectionProjects = (
  response: LearnerHomeResponse | LearnerHomeSectionDetails,
  sectionKey = "suggested_projects",
) => {
  const items =
    "sections" in response
      ? (response.sections.find((section) => section.key === sectionKey)
          ?.items ?? [])
      : response.key === sectionKey
        ? response.items
        : [];
  return items
    .filter((item) => item.type === "project")
    .map((item) => item.project as ProjectResponseShape);
};

export const responseSchemaKeys = (response: LearnerHomeResponse) => ({
  topLevel: Object.keys(response).sort(),
  sectionKeys: response.sections.map((section) => section.key).sort(),
  profileCompletionKeys: Object.keys(response.profileCompletion).sort(),
});

export const schemasCompatible = (
  baseline: LearnerHomeResponse,
  candidate: LearnerHomeResponse,
) => {
  const left = responseSchemaKeys(baseline);
  const right = responseSchemaKeys(candidate);
  return (
    JSON.stringify(left.topLevel) === JSON.stringify(right.topLevel) &&
    JSON.stringify(left.sectionKeys) === JSON.stringify(right.sectionKeys) &&
    JSON.stringify(left.profileCompletionKeys) ===
      JSON.stringify(right.profileCompletionKeys)
  );
};

export const countDuplicates = (values: string[]) =>
  values.length - new Set(values.filter(Boolean)).size;

export const analyzeMaterialEligibility = (
  materials: MaterialResponseShape[],
  unpublishedProjectIds: Set<string>,
) => {
  let ineligibleCandidateCount = 0;
  let unavailableMaterialCount = 0;
  let unpublishedProjectCount = 0;
  for (const material of materials) {
    const quantity = material.availableQuantity ?? material.quantity ?? 0;
    if (material.status !== "AVAILABLE" || quantity <= 0) {
      unavailableMaterialCount += 1;
    }
    if (material.status && material.status !== "AVAILABLE") {
      ineligibleCandidateCount += 1;
    }
    if (material.id && unpublishedProjectIds.has(material.id)) {
      unpublishedProjectCount += 1;
    }
  }
  return {
    ineligibleCandidateCount,
    unavailableMaterialCount,
    unpublishedProjectCount,
  };
};

export const fallbackReasonCategory = (reason?: string) => {
  if (!reason) return null;
  if (reason.includes("artifact") || reason.includes("missing"))
    return "artifact";
  if (reason.includes("timeout")) return "timeout";
  if (reason.includes("candidate")) return "candidate";
  if (reason.includes("fusion")) return "fusion";
  if (reason.includes("readiness") || reason.includes("mapping"))
    return "readiness";
  return "other";
};

const isPrefixSubsequence = (prefix: string[], sequence: string[]) =>
  prefix.every((id, index) => sequence[index] === id);

export const buildCaseMetrics = (input: {
  archetypeKey: ArchetypeKey;
  modeKey: EvaluationModeKey;
  httpStatus: number;
  requestDurationMs: number;
  home: LearnerHomeResponse;
  materialsSection: LearnerHomeSectionDetails;
  projectsSection: LearnerHomeSectionDetails;
  materialDiagnostics?: ShadowDiagnostics;
  projectDiagnostics?: ShadowDiagnostics;
  baselineHome?: LearnerHomeResponse;
  deterministicEquivalent: boolean;
  unpublishedProjectIds: Set<string>;
}): CaseMetrics => {
  const homeMaterialIds = extractSectionMaterialIds(
    input.home,
    "suggested_materials",
  );
  const homeProjectIds = extractSectionProjectIds(
    input.home,
    "suggested_projects",
  );
  const sectionMaterialIds = extractSectionMaterials(
    input.materialsSection,
  ).map((material) => material.id ?? "");
  const sectionProjectIds = extractSectionProjects(input.projectsSection).map(
    (project) => project.id ?? "",
  );
  const materials = extractSectionMaterials(input.home);
  const projects = extractSectionProjects(input.home);
  const eligibility = analyzeMaterialEligibility(
    materials,
    input.unpublishedProjectIds,
  );
  const projectEligibility = projects.filter((project) =>
    project.id ? input.unpublishedProjectIds.has(project.id) : false,
  ).length;

  const served =
    input.modeKey === "C_material" ||
    input.modeKey === "E_both" ||
    input.modeKey === "D_project";
  const baseline = input.baselineHome;
  const overlapTop5 =
    served && baseline
      ? computeTopKOverlap(
          extractSectionMaterialIds(baseline, "suggested_materials").concat(
            extractSectionProjectIds(baseline, "suggested_projects"),
          ),
          homeMaterialIds.concat(homeProjectIds),
          5,
        )
      : null;
  const overlapTop10 =
    served && baseline
      ? computeTopKOverlap(
          extractSectionMaterialIds(baseline, "suggested_materials").concat(
            extractSectionProjectIds(baseline, "suggested_projects"),
          ),
          homeMaterialIds.concat(homeProjectIds),
          10,
        )
      : null;

  const materialFallback = input.materialDiagnostics?.status === "FALLBACK";
  const projectFallback =
    input.projectDiagnostics?.status === "FALLBACK" ||
    input.projectDiagnostics?.projectReadinessStatus === "FALLBACK";

  return {
    archetypeKey: input.archetypeKey,
    modeKey: input.modeKey,
    httpStatus: input.httpStatus,
    requestDurationMs: Math.round(input.requestDurationMs),
    materialRecommendationStatus:
      input.materialDiagnostics?.status ?? "UNKNOWN",
    projectReadinessStatus:
      input.projectDiagnostics?.projectReadinessStatus ??
      input.projectDiagnostics?.status ??
      "UNKNOWN",
    materialConfidence: String(
      input.materialDiagnostics?.recentConfidence ?? "NONE",
    ),
    projectConfidence: String(
      input.projectDiagnostics?.recentConfidence ?? "NONE",
    ),
    materialRecentSlotsUsedTop5:
      input.materialDiagnostics?.recentSlotsUsedTop5 ?? 0,
    materialRecentSlotsUsedTop10:
      input.materialDiagnostics?.recentSlotsUsedTop10 ?? 0,
    projectRecentSlotsUsedTop5:
      input.projectDiagnostics?.recentSlotsUsedTop5 ?? 0,
    projectRecentSlotsUsedTop10:
      input.projectDiagnostics?.recentSlotsUsedTop10 ?? 0,
    deterministicVsServedTop5Overlap: overlapTop5,
    deterministicVsServedTop10Overlap: overlapTop10,
    duplicateCount:
      countDuplicates(homeMaterialIds) + countDuplicates(homeProjectIds),
    ineligibleCandidateCount: eligibility.ineligibleCandidateCount,
    unavailableMaterialCount: eligibility.unavailableMaterialCount,
    unpublishedProjectCount:
      eligibility.unpublishedProjectCount + projectEligibility,
    hydrationMappingFailureCount:
      (input.materialDiagnostics?.hydratedMappingFailureCount ?? 0) +
      (input.projectDiagnostics?.hydratedMappingFailureCount ?? 0),
    fallbackOccurred: materialFallback || projectFallback,
    fallbackReasonCategory: fallbackReasonCategory(
      input.materialDiagnostics?.fallbackReason ??
        input.projectDiagnostics?.fallbackReason,
    ),
    homeBrowseMaterialsConsistent: isPrefixSubsequence(
      homeMaterialIds.slice(0, 4),
      sectionMaterialIds,
    ),
    homeBrowseProjectsConsistent:
      JSON.stringify(homeProjectIds.slice(0, 4)) ===
      JSON.stringify(sectionProjectIds.slice(0, 4)),
    responseSchemaCompatible: baseline
      ? schemasCompatible(baseline, input.home)
      : true,
    deterministicEquivalent: input.deterministicEquivalent,
    candidateCountMax: Math.max(
      input.materialDiagnostics?.candidateCount ?? 0,
      input.projectDiagnostics?.candidateCount ?? 0,
      input.projectDiagnostics?.runtimeCandidateCount ?? 0,
    ),
  };
};

const uniqueRate = (values: string[]) => {
  const filtered = values.filter(Boolean);
  return filtered.length ? new Set(filtered).size / filtered.length : 0;
};

const matchedRate = (flags: boolean[]) =>
  flags.length ? flags.filter(Boolean).length / flags.length : 0;

export const computeMaterialQualityProxies = (input: {
  materials: MaterialResponseShape[];
  interests: string[];
  savedCity: string | null;
  prefersDelivery: boolean;
  prefersFree: boolean;
  recentDomainRepresentation: number;
  longTermRecentOverlap: number;
  recentSlotsUsed: number;
}): QualityProxyBlock => {
  const build = (limit: number) => {
    const slice = input.materials.slice(0, limit);
    const interestFlags = slice.map((material) =>
      Boolean(
        matchLearnerInterestsAgainstMaterial(
          {
            title: material.title ?? "",
            description: "",
            materialType: "",
            categoryNameEn: material.category?.id ?? material.categoryId ?? "",
            tags: [],
          },
          input.interests,
        ),
      ),
    );
    const locationFlags = slice.map(
      (material) =>
        Boolean(input.savedCity) &&
        Boolean(material.city) &&
        material.city!.toLowerCase() === input.savedCity!.toLowerCase(),
    );
    const preferenceFlags = slice.map((material) => {
      if (input.prefersFree && material.isFree) return true;
      if (
        input.prefersDelivery &&
        (material.deliveryAvailable ?? material.deliveryAllowed)
      )
        return true;
      return false;
    });
    const likedFlags = slice.map((material) => Boolean(material.isLiked));
    const categories = slice.map(
      (material) => material.category?.id ?? material.categoryId ?? "unknown",
    );
    const suppliers = slice.map((material) => material.ownerId ?? "unknown");
    return {
      interestCategoryRelevanceRate: matchedRate(interestFlags),
      savedProjectComponentRelevanceRate: 0,
      locationMatchRate: matchedRate(locationFlags),
      freeDeliveryPreferenceMatchRate: matchedRate(preferenceFlags),
      recentDomainRepresentationRate:
        slice.length > 0 ? input.recentDomainRepresentation / slice.length : 0,
      categoryDiversityRate: uniqueRate(categories),
      supplierDiversityRate: uniqueRate(suppliers),
      repeatedAlreadyLikedItemRate: matchedRate(likedFlags),
      longTermVsRecentBalance:
        input.recentSlotsUsed > 0
          ? input.longTermRecentOverlap / input.recentSlotsUsed
          : input.longTermRecentOverlap > 0
            ? 1
            : 0,
    };
  };

  return {
    offlineDiagnosticProxy: true,
    disclaimer:
      "Offline diagnostic proxies only; they do not prove recommendation quality or user satisfaction.",
    top5: build(5),
    top10: build(10),
  };
};

export const computeProjectQualityProxies = (input: {
  projects: ProjectResponseShape[];
  interests: string[];
  recentDomainRepresentation: number;
  longTermRecentOverlap: number;
  recentSlotsUsed: number;
  hasContinueProjects: boolean;
}): QualityProxyBlock => {
  const build = (limit: number) => {
    const slice = input.projects.slice(0, limit);
    const interestFlags = slice.map((project) =>
      Boolean(
        project.category?.id &&
        input.interests.some((interest) =>
          (project.title ?? "")
            .toLowerCase()
            .includes(interest.replace(/_/g, " ")),
        ),
      ),
    );
    const savedFlags = slice.map((project) => Boolean(project.isSaved));
    const likedFlags = slice.map((project) => Boolean(project.isLiked));
    const categories = slice.map(
      (project) => project.category?.id ?? "unknown",
    );
    return {
      learnerInterestConceptRelevanceRate: matchedRate(interestFlags),
      availableMaterialComponentRelevanceRate: 0,
      recentProjectDomainRepresentationRate:
        slice.length > 0 ? input.recentDomainRepresentation / slice.length : 0,
      categoryConceptDiversityRate: uniqueRate(categories),
      alreadySavedOrLikedProjectRate: matchedRate([
        ...savedFlags,
        ...likedFlags,
      ]),
      buildContinuationRelevanceRate: input.hasContinueProjects ? 1 : 0,
      longTermVsRecentBalance:
        input.recentSlotsUsed > 0
          ? input.longTermRecentOverlap / input.recentSlotsUsed
          : input.longTermRecentOverlap > 0
            ? 1
            : 0,
    };
  };

  return {
    offlineDiagnosticProxy: true,
    disclaimer:
      "Offline diagnostic proxies only; they do not prove recommendation quality or user satisfaction.",
    top5: build(5),
    top10: build(10),
  };
};

export const aggregateConfidenceDistribution = (
  cases: CaseMetrics[],
  diagnostics: Array<ShadowDiagnostics & { domain: "material" | "project" }>,
) => {
  const countConfidence = (domain: "material" | "project") => {
    const levels = { NONE: 0, LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const entry of diagnostics.filter(
      (value) => value.domain === domain,
    )) {
      const level = String(
        entry.recentConfidence ?? "NONE",
      ) as keyof typeof levels;
      if (level in levels) levels[level] += 1;
    }
    return levels;
  };

  const domainDiagnostics = (domain: "material" | "project") =>
    diagnostics.filter((value) => value.domain === domain);

  const burstDominanceAverage = (domain: "material" | "project") => {
    const values = domainDiagnostics(domain).map((entry) =>
      domain === "material"
        ? (entry.dominantCategoryShare ?? entry.burstDominantConceptShare ?? 0)
        : (entry.burstDominantConceptShare ?? entry.dominantConceptShare ?? 0),
    );
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  };

  const recentSlotsAverage = (domain: "material" | "project") => {
    const values = domainDiagnostics(domain).map(
      (entry) => entry.recentSlotsUsedTop5 ?? 0,
    );
    return values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
  };

  const mediumHighZeroSlots = (domain: "material" | "project") =>
    domainDiagnostics(domain).filter(
      (entry) =>
        (entry.recentConfidence === "MEDIUM" ||
          entry.recentConfidence === "HIGH") &&
        (entry.recentSlotsUsedTop5 ?? 0) === 0 &&
        (entry.recentSlotsUsedTop10 ?? 0) === 0,
    ).length;

  const recentAlreadyInLongTerm = (domain: "material" | "project") =>
    domainDiagnostics(domain).filter(
      (entry) => (entry.longTermRecentTop5OverlapCount ?? 0) > 0,
    ).length;

  return {
    byMode: Object.fromEntries(
      [...new Set(cases.map((entry) => entry.modeKey))].map((modeKey) => [
        modeKey,
        {
          material: countConfidence("material"),
          project: countConfidence("project"),
        },
      ]),
    ),
    aggregate: {
      material: countConfidence("material"),
      project: countConfidence("project"),
      averageBurstDominance: {
        material: burstDominanceAverage("material"),
        project: burstDominanceAverage("project"),
      },
      averageRecentSlotsUsed: {
        material: recentSlotsAverage("material"),
        project: recentSlotsAverage("project"),
      },
      mediumHighZeroSlotsBecauseUnqualified: {
        material: mediumHighZeroSlots("material"),
        project: mediumHighZeroSlots("project"),
      },
      recentAlreadyRepresentedInLongTermTopK: {
        material: recentAlreadyInLongTerm("material"),
        project: recentAlreadyInLongTerm("project"),
      },
    },
  };
};

export const evaluateSafetyInvariants = (input: {
  cases: CaseMetrics[];
  fallbackIndependence: {
    materialFallbackProjectUnchanged: boolean;
    projectFallbackMaterialUnchanged: boolean;
    materialFallbackHttp200: boolean;
    projectFallbackHttp200: boolean;
  };
  reportSerialized: string;
  latencyHangCount: number;
}): Record<string, boolean> => ({
  noDuplicatesInServedSections: input.cases
    .filter(
      (entry) => entry.modeKey !== "A_baseline" && entry.modeKey !== "B_shadow",
    )
    .every((entry) => entry.duplicateCount === 0),
  noIneligibleMaterials: input.cases.every(
    (entry) => entry.ineligibleCandidateCount === 0,
  ),
  noUnavailableMaterials: input.cases.every(
    (entry) => entry.unavailableMaterialCount === 0,
  ),
  noUnpublishedProjects: input.cases.every(
    (entry) => entry.unpublishedProjectCount === 0,
  ),
  materialProjectServingIndependent: input.cases
    .filter(
      (entry) =>
        entry.modeKey === "C_material" || entry.modeKey === "D_project",
    )
    .every((entry) => entry.httpStatus === 200),
  materialFallbackDoesNotChangeProjectServing:
    input.fallbackIndependence.materialFallbackProjectUnchanged,
  projectFallbackDoesNotAlterMaterialServing:
    input.fallbackIndependence.projectFallbackMaterialUnchanged,
  fallbackCasesReturnHttp200:
    input.fallbackIndependence.materialFallbackHttp200 &&
    input.fallbackIndependence.projectFallbackHttp200,
  homeBrowseAllConsistent: input.cases.every(
    (entry) => entry.homeBrowseProjectsConsistent,
  ),
  servingDisabledReturnsDeterministic: input.cases
    .filter(
      (entry) => entry.modeKey === "A_baseline" || entry.modeKey === "B_shadow",
    )
    .every((entry) => entry.deterministicEquivalent),
  responseJsonShapeUnchanged: input.cases.every(
    (entry) => entry.responseSchemaCompatible,
  ),
  noRequestHangs: input.latencyHangCount === 0,
  noCpuBoundLoop: input.cases.every(
    (entry) => entry.candidateCountMax <= MAX_CANDIDATE_BOUND,
  ),
  diagnosticFailureCannotAffectResponse:
    input.fallbackIndependence.materialFallbackHttp200 &&
    input.fallbackIndependence.projectFallbackHttp200,
  noPrivateIdentifiersInReportOrLogs: !PRIVACY_PATTERN.test(
    input.reportSerialized,
  ),
});

export const serializeReportForPrivacyScan = (value: unknown) => {
  const clone = structuredClone(value) as Record<string, unknown>;
  if (clone.determinism && typeof clone.determinism === "object") {
    (clone.determinism as Record<string, unknown>).stableHash =
      "[redacted-hash]";
  }
  if (clone.runMetadata && typeof clone.runMetadata === "object") {
    const metadata = clone.runMetadata as Record<string, unknown>;
    if (typeof metadata.gitHead === "string")
      metadata.gitHead = "[redacted-git-head]";
    if (typeof metadata.gitHeadPrefix === "string")
      metadata.gitHeadPrefix = "[redacted-git-head]";
    if (metadata.restoredFlags && typeof metadata.restoredFlags === "object") {
      const flags = metadata.restoredFlags as Record<string, unknown>;
      delete flags.materialPath;
      delete flags.projectPath;
    }
  }
  return JSON.stringify(clone);
};

export const redactReport = <T>(value: T): T => {
  if (PRIVACY_PATTERN.test(serializeReportForPrivacyScan(value))) {
    throw new Error("report_contains_private_identifiers");
  }
  return value;
};

export const buildStableHash = (report: RecommendationEvaluationReport) => {
  const stablePayload = {
    evaluatedArchetypes: report.evaluatedArchetypes,
    modeComparisons: report.modeComparisons.map((entry) => ({
      archetypeKey: entry.archetypeKey,
      modeKey: entry.modeKey,
      httpStatus: entry.httpStatus,
      materialRecommendationStatus: entry.materialRecommendationStatus,
      projectReadinessStatus: entry.projectReadinessStatus,
      duplicateCount: entry.duplicateCount,
      ineligibleCandidateCount: entry.ineligibleCandidateCount,
      unavailableMaterialCount: entry.unavailableMaterialCount,
      unpublishedProjectCount: entry.unpublishedProjectCount,
      fallbackOccurred: entry.fallbackOccurred,
      deterministicEquivalent: entry.deterministicEquivalent,
      responseSchemaCompatible: entry.responseSchemaCompatible,
    })),
    correctnessInvariants: report.correctnessInvariants,
    finalRecommendation: report.finalRecommendation,
    releaseBlockers: report.releaseBlockers,
  };
  return createHash("sha256")
    .update(JSON.stringify(stablePayload))
    .digest("hex");
};

export const classifyReleaseReadiness = (input: {
  invariants: Record<string, boolean>;
  warnings: string[];
  releaseBlockers: string[];
  unresolvedArchetypes: number;
  unconfirmedArchetypes?: number;
  cleanupVerified?: boolean;
  cleanupBlockers?: string[];
}): ReleaseClassification => {
  if (
    (input.cleanupBlockers?.length ?? 0) > 0 ||
    input.cleanupVerified === false
  ) {
    return "NOT_READY";
  }
  if (input.releaseBlockers.length > 0) return "NOT_READY";
  const invariantFailures = Object.entries(input.invariants).filter(
    ([, passed]) => !passed,
  );
  if (invariantFailures.length > 0) return "NOT_READY";
  if (
    input.unresolvedArchetypes > 0 ||
    (input.unconfirmedArchetypes ?? 0) > 0 ||
    input.warnings.length > 0
  ) {
    return "READY_WITH_WARNINGS";
  }
  return "READY_FOR_CONTROLLED_LOCAL_DEMO";
};

export const buildMarkdownSummary = (report: RecommendationEvaluationReport) => {
  const lines = [
    "# Slice 4J-A Evaluation Summary",
    "",
    `**Classification:** ${report.finalRecommendation}`,
    "",
    "## Run metadata",
    `- Generated at: ${report.runMetadata.generatedAt}`,
    `- Node: ${report.runMetadata.nodeVersion}`,
    `- Evaluated archetypes: ${report.evaluatedArchetypes.filter((entry) => entry.archetypeStatus === "RESOLVED").length}/${report.evaluatedArchetypes.length} (${report.evaluatedArchetypes.filter((entry) => entry.archetypeResolution === "RESOLVED_CONFIRMED").length} confirmed)`,
    ...(report.runMetadata.fixtureSummary
      ? [
          `- Fixture mode: ${(report.runMetadata.fixtureSummary as { fixtureMode?: string }).fixtureMode ?? "unknown"}`,
          `- Fixture cleanup: ${(report.runMetadata.fixtureSummary as { cleanupStatus?: string }).cleanupStatus ?? "unknown"}`,
          `- Post-run fixture records: ${(report.runMetadata.fixtureSummary as { postRunFixtureRecordCount?: number }).postRunFixtureRecordCount ?? "unknown"}`,
        ]
      : []),
    "",
    "## Correctness invariants",
    ...Object.entries(report.correctnessInvariants).map(
      ([key, passed]) => `- ${key}: ${passed ? "PASS" : "FAIL"}`,
    ),
    "",
    "## Quality proxies",
    "Offline diagnostic proxies only; not user satisfaction metrics.",
    "",
    "## Confidence distributions",
    `- Material NONE/LOW/MEDIUM/HIGH: ${JSON.stringify(report.confidenceDistributions.aggregate ? (report.confidenceDistributions as any).aggregate.material : {})}`,
    `- Project NONE/LOW/MEDIUM/HIGH: ${JSON.stringify(report.confidenceDistributions.aggregate ? (report.confidenceDistributions as any).aggregate.project : {})}`,
    "",
    "## Latency summary",
    `- Modes measured: ${Object.keys(report.latencySummary).length}`,
    "",
    "## Fallback summary",
    `- Total fallback cases: ${(report.fallbackSummary as { totalFallbackCases?: number }).totalFallbackCases ?? 0}`,
    "",
  ];

  if (report.releaseBlockers.length) {
    lines.push(
      "## Release blockers",
      ...report.releaseBlockers.map((entry) => `- ${entry}`),
      "",
    );
  }
  if (report.warnings.length) {
    lines.push(
      "## Warnings",
      ...report.warnings.map((entry) => `- ${entry}`),
      "",
    );
  }

  lines.push(
    "## Note",
    "This classification is for controlled academic/demo use only, not production rollout.",
  );

  return `${lines.join("\n")}\n`;
};

export const homeSectionsEqualExcept = (
  left: LearnerHomeResponse,
  right: LearnerHomeResponse,
  excludedKeys: string[],
) => {
  const filterSections = (response: LearnerHomeResponse) =>
    response.sections.filter((section) => !excludedKeys.includes(section.key));
  return (
    JSON.stringify(filterSections(left)) ===
    JSON.stringify(filterSections(right))
  );
};
