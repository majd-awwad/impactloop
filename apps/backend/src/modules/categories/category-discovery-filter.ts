const INTERNAL_CATEGORY_NAME_PATTERN =
  /\[|\]|test-admin|admin-approvals|\blive-conv\b|\blive-debug\b|\btemp-|\btest\b|\badmin\b|\bapprovals\b/i;

export const isPublicDiscoveryCategoryName = (name: string): boolean => {
  const normalized = name.trim();

  if (!normalized) {
    return false;
  }

  return !INTERNAL_CATEGORY_NAME_PATTERN.test(normalized);
};

export const normalizeDiscoveryCategoryLabel = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, ' ');

export const filterPublicDiscoveryCategories = <
  T extends { nameEn: string },
>(
  categories: T[],
): T[] => {
  const seen = new Set<string>();
  const filtered: T[] = [];

  for (const category of categories) {
    if (!isPublicDiscoveryCategoryName(category.nameEn)) {
      continue;
    }

    const key = normalizeDiscoveryCategoryLabel(category.nameEn);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    filtered.push(category);
  }

  return filtered;
};
