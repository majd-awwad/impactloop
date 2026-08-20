/**
 * Resolve a Material Request journey needle against live Najah / demo
 * project-component identity. Matching is case-insensitive across
 * componentName, materialType, and searchKeywords.
 *
 * Multiple alternatives may be separated with `|` so a lookup stays valid
 * when canonical Arabic/English labels coexist (demo-data drift), without
 * changing the intended missing-part meaning.
 */

export type JourneyComponentIdentity = {
  componentName: string;
  materialType: string;
  searchKeywords?: unknown;
};

const asKeywordList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => (typeof item === 'string' ? item : String(item ?? '')))
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const parseJourneyComponentNeedles = (componentIncludes: string): string[] =>
  componentIncludes
    .split('|')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);

export const componentMatchesJourneyNeedle = (
  component: JourneyComponentIdentity,
  componentIncludes: string,
): boolean => {
  const needles = parseJourneyComponentNeedles(componentIncludes);
  if (needles.length === 0) {
    return false;
  }

  const haystacks = [
    component.componentName,
    component.materialType,
    ...asKeywordList(component.searchKeywords),
  ].map((value) => value.toLowerCase());

  return needles.some((needle) =>
    haystacks.some((haystack) => haystack.includes(needle)),
  );
};

export const findMatchingJourneyComponent = <T extends JourneyComponentIdentity>(
  items: T[],
  componentIncludes: string,
): T | null => {
  const matches = items.filter((item) =>
    componentMatchesJourneyNeedle(item, componentIncludes),
  );
  if (matches.length === 0) {
    return null;
  }

  return [...matches].sort((left, right) => {
    return right.componentName.length - left.componentName.length;
  })[0] ?? null;
};

export const formatComponentInventory = (
  items: JourneyComponentIdentity[],
): string => {
  if (items.length === 0) {
    return '(none)';
  }
  return items
    .map((item) => `${item.componentName} / ${item.materialType}`)
    .join('; ');
};
