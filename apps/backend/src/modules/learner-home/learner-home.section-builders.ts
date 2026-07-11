import type {
  LearnerHomeProjectItem,
  LearnerHomeSectionItem,
} from './learner-home.types.js';

export const selectSuggestedProjectItems = (
  unsavedItems: LearnerHomeProjectItem[],
  savedItems: LearnerHomeProjectItem[],
  limit: number,
): LearnerHomeProjectItem[] => {
  if (unsavedItems.length >= limit) {
    return unsavedItems.slice(0, limit);
  }

  const selectedIds = new Set(
    unsavedItems.map((item) => String(item.project.id ?? '')),
  );

  const fallback = savedItems.filter((item) => {
    const id = String(item.project.id ?? '');
    return id.length > 0 && !selectedIds.has(id);
  });

  return [...unsavedItems, ...fallback].slice(0, limit);
};

export const dedupeProjectSectionItems = (
  items: LearnerHomeSectionItem[],
  limit: number,
): LearnerHomeSectionItem[] => {
  const selected: LearnerHomeSectionItem[] = [];
  const seenIds = new Set<string>();

  for (const item of items) {
    if (selected.length >= limit) {
      break;
    }

    if (item.type !== 'project') {
      selected.push(item);
      continue;
    }

    const id = String(item.project.id ?? '').trim();
    if (id.length === 0 || seenIds.has(id)) {
      continue;
    }

    seenIds.add(id);
    selected.push(item);
  }

  return selected;
};

export const resolveFreeMaterialsSectionTitle = (input: {
  hasSavedLocation: boolean;
  hasNearItems: boolean;
  defaultTitle: string;
}) => {
  if (input.hasSavedLocation && input.hasNearItems) {
    return input.defaultTitle;
  }

  return 'Free materials you may like';
};
