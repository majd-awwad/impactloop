import type {
  LearningProjectStatus,
  ProjectComponentRole,
} from '../../generated/prisma/client.js';

export type ComponentQualityIssue = {
  code: string;
  message: string;
  severity: 'hard' | 'soft';
  componentId?: string;
};

export type ComponentQualityInput = {
  id: string;
  componentName: string;
  quantity: number;
  componentRole: ProjectComponentRole | string;
  categoryId: string | null;
  categoryType: string | null;
  categoryActive: boolean | null;
  materialType: string;
  searchKeywords: string[];
};

const VAGUE_COMPONENT_NAMES = new Set([
  'stuff',
  'materials',
  'material',
  'parts',
  'part',
  'items',
  'item',
  'things',
  'thing',
  'components',
  'component',
  'misc',
  'miscellaneous',
]);

const VALID_COMPONENT_ROLES = new Set([
  'REQUIRED_MATERIAL',
  'OPTIONAL_MATERIAL',
  'TOOL',
  'CONSUMABLE',
  'ALTERNATIVE',
]);

const MATERIAL_MATCH_ROLES = new Set([
  'REQUIRED_MATERIAL',
  'OPTIONAL_MATERIAL',
  'CONSUMABLE',
  'ALTERNATIVE',
]);

const isWeakMaterialType = (value: string) => {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length === 0 ||
    normalized === 'general' ||
    normalized === 'unspecified'
  );
};

const parseKeywords = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

export const normalizeKeywordList = (
  keywords: string[] | undefined,
  componentName?: string,
) => {
  const normalized = new Set<string>();

  for (const keyword of keywords ?? []) {
    const cleaned = keyword.trim();
    if (cleaned.length > 0) {
      normalized.add(cleaned);
    }
  }

  const trimmedName = componentName?.trim();
  if (trimmedName && trimmedName.length > 0) {
    normalized.add(trimmedName);
  }

  return [...normalized].slice(0, 5);
};

export const assessComponentQuality = (
  components: ComponentQualityInput[],
): {
  hardIssues: ComponentQualityIssue[];
  softWarnings: ComponentQualityIssue[];
  byComponentId: Record<
    string,
    { hardIssues: ComponentQualityIssue[]; softWarnings: ComponentQualityIssue[] }
  >;
} => {
  const hardIssues: ComponentQualityIssue[] = [];
  const softWarnings: ComponentQualityIssue[] = [];
  const byComponentId: Record<
    string,
    { hardIssues: ComponentQualityIssue[]; softWarnings: ComponentQualityIssue[] }
  > = {};

  const pushIssue = (issue: ComponentQualityIssue) => {
    if (issue.severity === 'hard') {
      hardIssues.push(issue);
    } else {
      softWarnings.push(issue);
    }

    if (issue.componentId) {
      if (!byComponentId[issue.componentId]) {
        byComponentId[issue.componentId] = { hardIssues: [], softWarnings: [] };
      }

      if (issue.severity === 'hard') {
        byComponentId[issue.componentId]!.hardIssues.push(issue);
      } else {
        byComponentId[issue.componentId]!.softWarnings.push(issue);
      }
    }
  };

  if (components.length === 0) {
    pushIssue({
      code: 'NO_COMPONENTS',
      message: 'Project has no required components.',
      severity: 'hard',
    });
    return { hardIssues, softWarnings, byComponentId };
  }

  const seenNames = new Map<string, string>();

  for (const component of components) {
    const name = component.componentName.trim();
    const normalizedName = name.toLowerCase();

    if (name.length === 0) {
      pushIssue({
        code: 'EMPTY_COMPONENT_NAME',
        message: 'A component is missing a name.',
        severity: 'hard',
        componentId: component.id,
      });
    }

    if (component.quantity <= 0) {
      pushIssue({
        code: 'INVALID_QUANTITY',
        message: `"${name || 'Component'}" must have a positive quantity.`,
        severity: 'hard',
        componentId: component.id,
      });
    }

    if (!VALID_COMPONENT_ROLES.has(component.componentRole)) {
      pushIssue({
        code: 'INVALID_COMPONENT_ROLE',
        message: `"${name || 'Component'}" has an invalid role.`,
        severity: 'hard',
        componentId: component.id,
      });
    }

    if (name.length > 0) {
      const duplicateId = seenNames.get(normalizedName);
      if (duplicateId) {
        pushIssue({
          code: 'DUPLICATE_COMPONENT_NAME',
          message: `Duplicate component name "${name}".`,
          severity: 'hard',
          componentId: component.id,
        });
      } else {
        seenNames.set(normalizedName, component.id);
      }
    }

    if (component.categoryId) {
      if (component.categoryActive === false) {
        pushIssue({
          code: 'INACTIVE_CATEGORY',
          message: `"${name || 'Component'}" uses an inactive category.`,
          severity: 'hard',
          componentId: component.id,
        });
      } else if (
        component.categoryType &&
        component.categoryType !== 'MATERIAL' &&
        component.categoryType !== 'BOTH'
      ) {
        pushIssue({
          code: 'INVALID_CATEGORY_TYPE',
          message: `"${name || 'Component'}" must use a material category.`,
          severity: 'hard',
          componentId: component.id,
        });
      }

      if (component.componentRole === 'TOOL') {
        pushIssue({
          code: 'TOOL_WITH_CATEGORY',
          message: `"${name || 'Component'}" is a tool but has a material category.`,
          severity: 'soft',
          componentId: component.id,
        });
      }
    }

    if (VAGUE_COMPONENT_NAMES.has(normalizedName)) {
      pushIssue({
        code: 'VAGUE_COMPONENT_NAME',
        message: `"${name}" is too vague for material matching.`,
        severity: 'soft',
        componentId: component.id,
      });
    }
  }

  const materialComponents = components.filter((component) =>
    MATERIAL_MATCH_ROLES.has(component.componentRole),
  );

  if (!components.some((component) => component.componentRole === 'REQUIRED_MATERIAL')) {
    pushIssue({
      code: 'NO_REQUIRED_MATERIAL',
      message: 'Project has no required material components.',
      severity: 'soft',
    });
  }

  if (
    materialComponents.length > 0 &&
    materialComponents.every((component) => !component.categoryId)
  ) {
    pushIssue({
      code: 'ALL_MATERIAL_COMPONENTS_MISSING_CATEGORY',
      message: 'All material components are missing a category.',
      severity: 'soft',
    });
  }

  if (
    materialComponents.length > 0 &&
    materialComponents.every((component) => isWeakMaterialType(component.materialType))
  ) {
    pushIssue({
      code: 'ALL_WEAK_MATERIAL_TYPES',
      message:
        'All material components use General, Unspecified, or empty material types.',
      severity: 'soft',
    });
  }

  if (
    materialComponents.length > 0 &&
    materialComponents.every(
      (component) => parseKeywords(component.searchKeywords).length === 0,
    )
  ) {
    pushIssue({
      code: 'ALL_MATERIAL_COMPONENTS_MISSING_KEYWORDS',
      message: 'All material components are missing search keywords.',
      severity: 'soft',
    });
  }

  return { hardIssues, softWarnings, byComponentId };
};

export const COMPONENT_EDITABLE_STATUSES = new Set<LearningProjectStatus>([
  'PENDING_REVIEW',
  'CHANGES_REQUESTED',
]);
