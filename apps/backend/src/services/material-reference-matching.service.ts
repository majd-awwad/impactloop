import { normalizeSearchText } from '../utils/normalize-search-text.js';
import * as materialTypesRepository from '../modules/material-types/material-types.repository.js';

export type MaterialMatchConfidence = 'EXACT' | 'ALIAS' | 'PARTIAL';

export type MatchedMaterialReference = {
  id: string;
  nameEn: string;
  nameAr: string | null;
  defaultUnit: string;
  categoryId: string;
};

export type MaterialReferenceCandidate = MatchedMaterialReference & {
  confidence: MaterialMatchConfidence;
};

export type MaterialReferenceMatchResult =
  | {
      status: 'MATCHED';
      materialType: MatchedMaterialReference;
      confidence: MaterialMatchConfidence;
    }
  | {
      status: 'NO_MATCH';
    }
  | {
      status: 'AMBIGUOUS';
      candidates: MaterialReferenceCandidate[];
    };

type ScoredCandidate = MaterialReferenceCandidate & {
  score: number;
};

const scoreCandidate = (
  normalizedInput: string,
  materialType: Awaited<
    ReturnType<typeof materialTypesRepository.findActiveMaterialTypesForMatching>
  >[number],
): ScoredCandidate | null => {
  const typeNormalizedName = normalizeSearchText(materialType.normalizedName);
  const typeNameEn = normalizeSearchText(materialType.nameEn);
  const typeNameAr = materialType.nameAr
    ? normalizeSearchText(materialType.nameAr)
    : null;

  if (
    normalizedInput === typeNormalizedName ||
    normalizedInput === typeNameEn ||
    (typeNameAr != null && normalizedInput === typeNameAr)
  ) {
    return {
      id: materialType.id,
      nameEn: materialType.nameEn,
      nameAr: materialType.nameAr,
      defaultUnit: materialType.defaultUnit,
      categoryId: materialType.categoryId,
      confidence: 'EXACT',
      score: 100,
    };
  }

  for (const alias of materialType.aliases) {
    const aliasNormalized = normalizeSearchText(alias.normalizedAlias);
    const aliasRaw = normalizeSearchText(alias.alias);

    if (normalizedInput === aliasNormalized || normalizedInput === aliasRaw) {
      return {
        id: materialType.id,
        nameEn: materialType.nameEn,
        nameAr: materialType.nameAr,
        defaultUnit: materialType.defaultUnit,
        categoryId: materialType.categoryId,
        confidence: 'ALIAS',
        score: 90,
      };
    }
  }

  const partialMatches = [
    typeNormalizedName.includes(normalizedInput) ||
      normalizedInput.includes(typeNormalizedName),
    typeNameEn.includes(normalizedInput) || normalizedInput.includes(typeNameEn),
    typeNameAr != null &&
      (typeNameAr.includes(normalizedInput) ||
        normalizedInput.includes(typeNameAr)),
    ...materialType.aliases.map((alias) => {
      const aliasNormalized = normalizeSearchText(alias.normalizedAlias);
      const aliasRaw = normalizeSearchText(alias.alias);
      return (
        aliasNormalized.includes(normalizedInput) ||
        normalizedInput.includes(aliasNormalized) ||
        aliasRaw.includes(normalizedInput) ||
        normalizedInput.includes(aliasRaw)
      );
    }),
  ].some(Boolean);

  if (!partialMatches || normalizedInput.length < 3) {
    return null;
  }

  return {
    id: materialType.id,
    nameEn: materialType.nameEn,
    nameAr: materialType.nameAr,
    defaultUnit: materialType.defaultUnit,
    categoryId: materialType.categoryId,
    confidence: 'PARTIAL',
    score: 50,
  };
};

const pickBestCandidates = (
  candidates: ScoredCandidate[],
): MaterialReferenceMatchResult => {
  if (candidates.length === 0) {
    return { status: 'NO_MATCH' };
  }

  const sorted = [...candidates].sort((left, right) => right.score - left.score);
  const bestScore = sorted[0]!.score;
  const bestCandidates = sorted.filter((candidate) => candidate.score === bestScore);

  if (bestCandidates.length === 1) {
    const best = bestCandidates[0]!;
    return {
      status: 'MATCHED',
      materialType: {
        id: best.id,
        nameEn: best.nameEn,
        nameAr: best.nameAr,
        defaultUnit: best.defaultUnit,
        categoryId: best.categoryId,
      },
      confidence: best.confidence,
    };
  }

  if (bestScore >= 90) {
    const uniqueIds = new Set(bestCandidates.map((candidate) => candidate.id));
    if (uniqueIds.size === 1) {
      const best = bestCandidates[0]!;
      return {
        status: 'MATCHED',
        materialType: {
          id: best.id,
          nameEn: best.nameEn,
          nameAr: best.nameAr,
          defaultUnit: best.defaultUnit,
          categoryId: best.categoryId,
        },
        confidence: best.confidence,
      };
    }
  }

  if (bestScore === 50 && bestCandidates.length === 1) {
    const best = bestCandidates[0]!;
    return {
      status: 'MATCHED',
      materialType: {
        id: best.id,
        nameEn: best.nameEn,
        nameAr: best.nameAr,
        defaultUnit: best.defaultUnit,
        categoryId: best.categoryId,
      },
      confidence: 'PARTIAL',
    };
  }

  return {
    status: 'AMBIGUOUS',
    candidates: bestCandidates.map(({ score: _score, ...candidate }) => candidate),
  };
};

export const matchMaterialReference = async (input: {
  materialName: string;
  categoryId: string;
  client?: Parameters<
    typeof materialTypesRepository.findActiveMaterialTypesForMatching
  >[1];
}): Promise<MaterialReferenceMatchResult> => {
  const normalizedInput = normalizeSearchText(input.materialName);

  if (!normalizedInput) {
    return { status: 'NO_MATCH' };
  }

  const materialTypes =
    await materialTypesRepository.findActiveMaterialTypesForMatching(
      input.categoryId,
      input.client,
    );

  const scoredCandidates = materialTypes
    .map((materialType) => scoreCandidate(normalizedInput, materialType))
    .filter((candidate): candidate is ScoredCandidate => candidate != null);

  return pickBestCandidates(scoredCandidates);
};

export const mapMatchedReferenceDto = (materialType: MatchedMaterialReference) => ({
  id: materialType.id,
  nameEn: materialType.nameEn,
  nameAr: materialType.nameAr,
  unit: materialType.defaultUnit,
});
