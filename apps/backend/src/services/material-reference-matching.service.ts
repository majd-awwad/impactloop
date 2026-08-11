import {
  compactMaterialReferenceText,
  normalizeMaterialReferenceText,
  tokenizeMaterialReferenceText,
} from '../utils/normalize-material-reference-text.js';
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
  matchDetail?: string;
};

type MaterialTypeForMatching = Awaited<
  ReturnType<typeof materialTypesRepository.findActiveMaterialTypesForMatching>
>[number];

const collectTypeTexts = (materialType: MaterialTypeForMatching): string[] => {
  const values = [
    materialType.normalizedName,
    materialType.nameEn,
    materialType.nameAr ?? '',
    ...materialType.aliases.flatMap((alias) => [alias.normalizedAlias, alias.alias]),
  ];
  return values
    .map((value) => normalizeMaterialReferenceText(value))
    .filter((value) => value.length > 0);
};

const collectPrimaryTypeTexts = (
  materialType: MaterialTypeForMatching,
): string[] => {
  const values = [
    materialType.normalizedName,
    materialType.nameEn,
    materialType.nameAr ?? '',
  ];
  return values
    .map((value) => normalizeMaterialReferenceText(value))
    .filter((value) => value.length > 0);
};

const overlapBonus = (
  inputTokens: string[],
  typeTexts: string[],
): number => {
  let hits = 0;
  for (const token of inputTokens) {
    const compactToken = compactMaterialReferenceText(token);
    const matched = typeTexts.some((typeText) => {
      const compactType = compactMaterialReferenceText(typeText);
      return (
        typeText === token ||
        compactType === compactToken ||
        typeText.split(/[\s./-]+/u).includes(token) ||
        (compactToken.length >= 4 && compactType.includes(compactToken))
      );
    });
    if (matched) {
      hits += 1;
    }
  }
  // Prefer types that explain more of the title (Uno+arduino > Mega+arduino).
  return Math.min(10, Math.max(0, hits - 1) * 5);
};

const withOverlapScore = (
  candidate: ScoredCandidate,
  inputTokens: string[],
  typeTexts: string[],
): ScoredCandidate => ({
  ...candidate,
  score: Math.min(100, candidate.score + overlapBonus(inputTokens, typeTexts)),
});

const scoreCandidate = (
  normalizedInput: string,
  compactInput: string,
  inputTokens: string[],
  materialType: MaterialTypeForMatching,
): ScoredCandidate | null => {
  const typeTexts = collectTypeTexts(materialType);
  const primaryTexts = collectPrimaryTypeTexts(materialType);
  const compactTypeTexts = typeTexts.map((text) => compactMaterialReferenceText(text));

  if (
    typeTexts.includes(normalizedInput) ||
    compactTypeTexts.includes(compactInput)
  ) {
    return withOverlapScore(
      {
        id: materialType.id,
        nameEn: materialType.nameEn,
        nameAr: materialType.nameAr,
        defaultUnit: materialType.defaultUnit,
        categoryId: materialType.categoryId,
        confidence: 'EXACT',
        score: 100,
        matchDetail: 'exact_or_compact_equality',
      },
      inputTokens,
      typeTexts,
    );
  }

  // Alias / model-token hit inside mixed-language titles.
  // Prefer longer / model-like tokens (HC-SR04, MG996R) over accessory words
  // ("bridge", "channel") that appear in bundles as secondary components.
  const rankedTokens = [...inputTokens].sort((a, b) => b.length - a.length);
  for (const token of rankedTokens) {
    const compactToken = compactMaterialReferenceText(token);
    const modelLike =
      /\d/.test(token) ||
      token.length >= 7 ||
      /^[a-z]{0,4}\d+[a-z0-9]*$/u.test(token);

    for (const typeText of typeTexts) {
      const compactType = compactMaterialReferenceText(typeText);
      if (typeText === token || compactType === compactToken) {
        return withOverlapScore(
          {
            id: materialType.id,
            nameEn: materialType.nameEn,
            nameAr: materialType.nameAr,
            defaultUnit: materialType.defaultUnit,
            categoryId: materialType.categoryId,
            confidence: 'ALIAS',
            score: 92,
            matchDetail: `token:${token}`,
          },
          inputTokens,
          typeTexts,
        );
      }

      // Word-boundary inclusion only for model-like tokens — avoids picking
      // H-Bridge from "مكبس 12V مع H bridge" via the weak "bridge" token.
      if (
        modelLike &&
        token.length >= 4 &&
        (typeText.split(/[\s./-]+/u).includes(token) ||
          (compactToken.length >= 5 && compactType.includes(compactToken)))
      ) {
        return withOverlapScore(
          {
            id: materialType.id,
            nameEn: materialType.nameEn,
            nameAr: materialType.nameAr,
            defaultUnit: materialType.defaultUnit,
            categoryId: materialType.categoryId,
            confidence: 'ALIAS',
            score: 92,
            matchDetail: `model_token:${token}`,
          },
          inputTokens,
          typeTexts,
        );
      }
    }
  }

  // Partial phrase matching uses primary names only (not short aliases), so a
  // bundle title mentioning an accessory does not inherit that accessory's type.
  const substantialPhrase = primaryTexts.some((typeText) => {
    if (typeText.length < 5 || normalizedInput.length < 3) {
      return false;
    }
    const compactType = compactMaterialReferenceText(typeText);
    const hit =
      normalizedInput.includes(typeText) ||
      (compactType.length >= 5 && compactInput.includes(compactType));
    if (!hit) {
      return false;
    }
    const ratio = compactType.length / Math.max(compactInput.length, 1);
    return ratio >= 0.5 || compactType.length >= 12;
  });

  if (substantialPhrase) {
    return withOverlapScore(
      {
        id: materialType.id,
        nameEn: materialType.nameEn,
        nameAr: materialType.nameAr,
        defaultUnit: materialType.defaultUnit,
        categoryId: materialType.categoryId,
        confidence: 'PARTIAL',
        score: 70,
        matchDetail: 'contained_phrase',
      },
      inputTokens,
      typeTexts,
    );
  }

  const reverseContainment = primaryTexts.some((typeText) => {
    if (typeText.length < 5 || normalizedInput.length < 5) {
      return false;
    }
    return (
      typeText.includes(normalizedInput) ||
      compactMaterialReferenceText(typeText).includes(compactInput)
    );
  });

  if (!reverseContainment) {
    return null;
  }

  return withOverlapScore(
    {
      id: materialType.id,
      nameEn: materialType.nameEn,
      nameAr: materialType.nameAr,
      defaultUnit: materialType.defaultUnit,
      categoryId: materialType.categoryId,
      confidence: 'PARTIAL',
      score: 50,
      matchDetail: 'partial',
    },
    inputTokens,
    typeTexts,
  );
};

const pickBestCandidates = (
  candidates: ScoredCandidate[],
): MaterialReferenceMatchResult => {
  if (candidates.length === 0) {
    return { status: 'NO_MATCH' };
  }

  const sorted = [...candidates].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    // Tie-break toward longer, more specific type names.
    return right.nameEn.length - left.nameEn.length;
  });
  const bestScore = sorted[0]!.score;
  const bestCandidates = sorted.filter((candidate) => candidate.score === bestScore);
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

  // Never auto-pick among equal-score distinct types.
  return {
    status: 'AMBIGUOUS',
    candidates: bestCandidates.map(({ score: _score, matchDetail: _detail, ...candidate }) => candidate),
  };
};

export const matchMaterialReferenceAgainstTypes = (input: {
  materialName: string;
  materialTypes: MaterialTypeForMatching[];
}): MaterialReferenceMatchResult => {
  const normalizedInput = normalizeMaterialReferenceText(input.materialName);
  const compactInput = compactMaterialReferenceText(input.materialName);
  const inputTokens = tokenizeMaterialReferenceText(input.materialName);

  if (!normalizedInput) {
    return { status: 'NO_MATCH' };
  }

  const scoredCandidates = input.materialTypes
    .map((materialType) =>
      scoreCandidate(normalizedInput, compactInput, inputTokens, materialType),
    )
    .filter((candidate): candidate is ScoredCandidate => candidate != null);

  return pickBestCandidates(scoredCandidates);
};

export const matchMaterialReference = async (input: {
  materialName: string;
  categoryId: string;
  client?: Parameters<
    typeof materialTypesRepository.findActiveMaterialTypesForMatching
  >[1];
}): Promise<MaterialReferenceMatchResult> => {
  const materialTypes =
    await materialTypesRepository.findActiveMaterialTypesForMatching(
      input.categoryId,
      input.client,
    );

  return matchMaterialReferenceAgainstTypes({
    materialName: input.materialName,
    materialTypes,
  });
};

export type CrossCategoryMaterialSuggestion = {
  materialType: MatchedMaterialReference;
  confidence: MaterialMatchConfidence;
  category: {
    id: string;
    nameEn: string;
    nameAr: string | null;
  };
};

/**
 * When same-category matching fails, surface at most one HIGH-confidence
 * match from another category. Never auto-switch category.
 */
export const suggestCrossCategoryMaterialReference = async (input: {
  materialName: string;
  selectedCategoryId: string;
  client?: Parameters<
    typeof materialTypesRepository.findActiveMaterialTypesForMatching
  >[1];
}): Promise<CrossCategoryMaterialSuggestion | null> => {
  const materialTypes =
    await materialTypesRepository.findActiveMaterialTypesForGlobalMatching(
      input.client,
    );
  const otherCategoryTypes = materialTypes.filter(
    (type) => type.categoryId !== input.selectedCategoryId,
  );
  const matchResult = matchMaterialReferenceAgainstTypes({
    materialName: input.materialName,
    materialTypes: otherCategoryTypes,
  });

  if (matchResult.status !== 'MATCHED') {
    return null;
  }

  if (
    matchResult.confidence !== 'EXACT' &&
    matchResult.confidence !== 'ALIAS'
  ) {
    return null;
  }

  const matched = otherCategoryTypes.find(
    (type) => type.id === matchResult.materialType.id,
  );
  if (!matched?.category) {
    return null;
  }

  return {
    materialType: matchResult.materialType,
    confidence: matchResult.confidence,
    category: {
      id: matched.category.id,
      nameEn: matched.category.nameEn,
      nameAr: matched.category.nameAr,
    },
  };
};

export const mapMatchedReferenceDto = (materialType: MatchedMaterialReference) => ({
  id: materialType.id,
  nameEn: materialType.nameEn,
  nameAr: materialType.nameAr,
  unit: materialType.defaultUnit,
});
