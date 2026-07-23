import type {
  PortableFeature,
  PortableModelArtifact,
} from "./ml-model-artifact.js";

export type WeightedFeature = readonly [name: string, weight: number];
export type ScoredCandidate = { candidateKey: string; score: number };

const representation = (
  features: WeightedFeature[],
  entries: PortableFeature[],
  dimension: number,
) => {
  const lookup = new Map(entries.map((entry) => [entry.name, entry]));

  const embedding = Array<number>(dimension).fill(0);

  let bias = 0;
  const missing: string[] = [];

  for (const [name, weight] of features) {
    const entry = lookup.get(name);

    if (!entry) {
      if (missing.length < 8) missing.push(name);
      continue;
    }

    bias += Number(entry.bias) * weight;

    for (let index = 0; index < dimension; index += 1)
      embedding[index] += Number(entry.embedding[index]!) * weight;
  }

  return { embedding, bias, missing };
};

export const scorePortableLightFm = (
  artifact: PortableModelArtifact,
  userFeatures: WeightedFeature[],
  candidates: Array<{ candidateKey: string; features: WeightedFeature[] }>,
) => {
  const user = representation(
    userFeatures,
    artifact.user_features,
    artifact.latent_dimension,
  );

  const missing = new Set(user.missing);

  const scored = candidates
    .map((candidate) => {
      const item = representation(
        candidate.features,
        artifact.item_features,
        artifact.latent_dimension,
      );

      item.missing.forEach((name) => missing.add(name));

      let score = user.bias + item.bias;

      for (let index = 0; index < artifact.latent_dimension; index += 1)
        score += user.embedding[index]! * item.embedding[index]!;
      return { candidateKey: candidate.candidateKey, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.candidateKey.localeCompare(b.candidateKey),
    );

  return { scored, missingFeatures: [...missing].slice(0, 8) };
};

export const normalizeScores = (scores: ScoredCandidate[]) => {
  const values = scores.map((value) => value.score);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);

  return new Map(
    scores.map((value) => [
      value.candidateKey,
      maximum > minimum ? (value.score - minimum) / (maximum - minimum) : 0,
    ]),
  );
};

export const combineNormalizedScores = (
  longTerm: ScoredCandidate[],
  recent: Map<string, number>,
  blend = 0.35,
) => {
  const normalized = normalizeScores(longTerm);

  return longTerm
    .map(({ candidateKey }) => ({
      candidateKey,
      score:
        (1 - blend) * (normalized.get(candidateKey) ?? 0) +
        blend * (recent.get(candidateKey) ?? 0),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || a.candidateKey.localeCompare(b.candidateKey),
    );
};
