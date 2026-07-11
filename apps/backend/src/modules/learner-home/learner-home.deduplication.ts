import type { LearnerHomeMaterialItem } from './learner-home.types.js';
import { normalizeText } from './learner-home.scoring.js';

export const getMaterialItemId = (item: LearnerHomeMaterialItem) =>
  String(item.material.id ?? '');

export const normalizeMaterialTitleKey = (title: unknown) => {
  const text = normalizeText(String(title ?? ''))
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length === 0) {
    return '';
  }

  return text
    .split(' ')
    .map((token) =>
      token.length > 3 && token.endsWith('s') ? token.slice(0, -1) : token,
    )
    .join(' ')
    .trim();
};

export const dedupeMaterialItems = (
  items: LearnerHomeMaterialItem[],
  limit: number,
): LearnerHomeMaterialItem[] => {
  const selected: LearnerHomeMaterialItem[] = [];
  const seenIds = new Set<string>();
  const seenTitleKeys = new Set<string>();

  for (const item of items) {
    if (selected.length >= limit) {
      break;
    }

    const materialId = getMaterialItemId(item);
    const titleKey = normalizeMaterialTitleKey(item.material.title);

    if (materialId.length === 0) {
      continue;
    }

    if (seenIds.has(materialId)) {
      continue;
    }

    if (titleKey.length > 0 && seenTitleKeys.has(titleKey)) {
      continue;
    }

    seenIds.add(materialId);
    if (titleKey.length > 0) {
      seenTitleKeys.add(titleKey);
    }
    selected.push(item);
  }

  return selected;
};

export const pickMaterialSectionItems = (
  ranked: LearnerHomeMaterialItem[],
  limit: number,
  usedMaterialIds: Set<string>,
): LearnerHomeMaterialItem[] => {
  const selected: LearnerHomeMaterialItem[] = [];
  const selectedInSection = new Set<string>();
  const selectedTitleKeys = new Set<string>();

  for (const item of ranked) {
    if (selected.length >= limit) {
      break;
    }

    const materialId = getMaterialItemId(item);
    const titleKey = normalizeMaterialTitleKey(item.material.title);

    if (materialId.length === 0 || usedMaterialIds.has(materialId)) {
      continue;
    }

    if (titleKey.length > 0 && selectedTitleKeys.has(titleKey)) {
      continue;
    }

    selected.push(item);
    selectedInSection.add(materialId);
    if (titleKey.length > 0) {
      selectedTitleKeys.add(titleKey);
    }
  }

  if (selected.length < limit) {
    for (const item of ranked) {
      if (selected.length >= limit) {
        break;
      }

      const materialId = getMaterialItemId(item);
      if (materialId.length === 0 || selectedInSection.has(materialId)) {
        continue;
      }

      selected.push(item);
      selectedInSection.add(materialId);
    }
  }

  for (const item of selected) {
    usedMaterialIds.add(getMaterialItemId(item));
  }

  return selected;
};

export const dedupeMaterialSections = (input: {
  materialsForSavedProjects: LearnerHomeMaterialItem[];
  suggestedMaterials: LearnerHomeMaterialItem[];
  freeMaterialsNearYou: LearnerHomeMaterialItem[];
  limits: {
    materialsForSavedProjects: number;
    suggestedMaterials: number;
    freeMaterialsNearYou: number;
  };
}) => {
  const usedMaterialIds = new Set<string>();

  const materialsForSavedProjects = pickMaterialSectionItems(
    input.materialsForSavedProjects,
    input.limits.materialsForSavedProjects,
    usedMaterialIds,
  );

  const suggestedMaterials = pickMaterialSectionItems(
    input.suggestedMaterials,
    input.limits.suggestedMaterials,
    usedMaterialIds,
  );

  const freeMaterialsNearYou = pickMaterialSectionItems(
    input.freeMaterialsNearYou,
    input.limits.freeMaterialsNearYou,
    usedMaterialIds,
  );

  return {
    materialsForSavedProjects,
    suggestedMaterials,
    freeMaterialsNearYou,
  };
};

export const dedupeSectionItemsById = <T>(
  items: T[],
  limit: number,
  getId: (item: T) => string,
): T[] => {
  const selected: T[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (selected.length >= limit) {
      break;
    }

    const id = getId(item).trim();
    if (id.length === 0 || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);
    selected.push(item);
  }

  return selected;
};

export const getProjectItemId = (item: { project: Record<string, unknown> }) =>
  String(item.project.id ?? '');
