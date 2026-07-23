import { createHash } from "node:crypto";
import path from "node:path";

import { prisma } from "../src/database/prisma.js";
import {
  loadMlShadowConcepts,
  loadProjectPool,
} from "../src/modules/learner-home/learner-home.repository.js";
import { loadPortableModelArtifact } from "../src/modules/recommendations/ml-model-artifact.js";
import { scorePortableLightFm } from "../src/modules/recommendations/ml-lightfm-scorer.js";

const root = path.resolve(process.cwd(), "../..");
const categoryKey = (id: string) =>
  createHash("sha256").update(`impactloop-category:${id}`).digest("hex");

const itemFeatures = (candidate: {
  categoryId: string;
  difficulty: string;
  conceptKeys: string[];
  componentConceptKeys: string[];
}) => {
  const features: Array<[string, number]> = [
    [`category:${categoryKey(candidate.categoryId)}`, 1],
  ];
  for (const value of candidate.conceptKeys)
    features.push([`concept:${value}`, 1]);
  if (candidate.difficulty)
    features.push([`difficulty:${candidate.difficulty}`, 1]);
  for (const value of candidate.componentConceptKeys)
    features.push([`component:${value}`, 1]);
  return features;
};

const projects = await loadProjectPool(120);
const concepts = await loadMlShadowConcepts(
  [],
  projects.map((project) => project.id),
);
const candidates = projects.map((project) => ({
  candidateKey: project.id,
  categoryId: project.category.id,
  difficulty: project.difficulty,
  conceptKeys: concepts.projectConcepts.get(project.id) ?? [],
  componentConceptKeys: concepts.projectComponentConcepts.get(project.id) ?? [],
}));

const artifactPath = path.join(
  root,
  "ml/recommendation/generated/portable-model/project-hybrid-runtime-v2.json",
);
const artifact = await loadPortableModelArtifact(artifactPath, "project");
const artifactNames = new Set(
  artifact.item_features.map((feature) => feature.name),
);

let artifactMappedCandidateCount = 0;
const missingSamples: Array<{
  missingFeatures: string[];
  missingCount: number;
}> = [];
const missingByKind = new Map<string, number>();

for (const candidate of candidates) {
  const names = itemFeatures(candidate).map(([name]) => name);
  const missing = names.filter((name) => !artifactNames.has(name));
  if (missing.length === 0) {
    artifactMappedCandidateCount += 1;
  } else {
    missingSamples.push({
      missingFeatures: missing.slice(0, 6),
      missingCount: missing.length,
    });
    for (const feature of missing) {
      const kind = feature.split(":")[0] ?? "unknown";
      missingByKind.set(kind, (missingByKind.get(kind) ?? 0) + 1);
    }
  }
}

const scored = scorePortableLightFm(
  artifact,
  [],
  candidates.map((candidate) => ({
    candidateKey: candidate.candidateKey,
    features: itemFeatures(candidate),
  })),
);

const runtimeKeys = candidates.map((candidate) => candidate.candidateKey);
const scoredKeys = scored.scored.map((candidate) => candidate.candidateKey);
const duplicateRuntime = runtimeKeys.length - new Set(runtimeKeys).size;
const duplicateScored = scoredKeys.length - new Set(scoredKeys).size;
const nonFinite = scored.scored.filter(
  (candidate) => !Number.isFinite(candidate.score),
).length;

console.log(
  JSON.stringify({
    status: "SCORED",
    projectReadinessStatus:
      nonFinite > 0 ||
      duplicateRuntime > 0 ||
      duplicateScored > 0 ||
      candidates.length - artifactMappedCandidateCount > 0
        ? "NOT_READY"
        : "READY",
    runtimeCandidateCount: candidates.length,
    artifactCatalogCount: artifact.item_features.length,
    artifactMappedCandidateCount,
    missingArtifactCandidateCount:
      candidates.length - artifactMappedCandidateCount,
    outsideRuntimeArtifactCount: artifact.item_features.filter(
      (feature) =>
        !feature.name.startsWith("category:") &&
        !feature.name.startsWith("concept:") &&
        !feature.name.startsWith("difficulty:") &&
        !feature.name.startsWith("component:"),
    ).length,
    scoredCandidateCount: scored.scored.length,
    nonFiniteScoreCount: nonFinite,
    duplicateRuntimeCandidateCount: duplicateRuntime,
    duplicateScoredCandidateCount: duplicateScored,
    hydrationFailureCount:
      duplicateRuntime +
      scoredKeys.filter((key) => !new Set(runtimeKeys).has(key)).length,
    artifactVersion: artifact.model_version,
    featureSchemaVersion: artifact.feature_schema_version,
    missingByKind: Object.fromEntries(missingByKind),
    sampleMissing: missingSamples.slice(0, 3),
    unmappedProjects: candidates
      .map((candidate) => {
        const names = itemFeatures(candidate).map(([name]) => name);
        const missing = names.filter((name) => !artifactNames.has(name));
        return missing.length > 0
          ? {
              componentConceptKeys: candidate.componentConceptKeys,
              missingFeatures: missing,
            }
          : null;
      })
      .filter(Boolean),
  }),
);

await prisma.$disconnect();
