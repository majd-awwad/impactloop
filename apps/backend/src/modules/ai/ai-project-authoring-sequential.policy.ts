import type { AUTHORING_SEQUENTIAL_STAGES } from './ai.content-blocks.js';

export type SequentialStage = (typeof AUTHORING_SEQUENTIAL_STAGES)[number];

export type SequentialComponent = {
  id?: string;
  componentName: string;
  materialType: string;
  quantity: number;
  unit: string;
  componentRole: 'REQUIRED_MATERIAL' | 'TOOL' | 'CONSUMABLE';
  isRequired: boolean;
  canBeSubstituted: boolean;
  searchKeywords: string[];
  notes: string | null;
};

export type SequentialStep = {
  title: string;
  description: string;
  componentRefs?: string[];
};

const PLACEHOLDER_PATTERNS = [
  /^untitled project$/i,
  /^project title$/i,
  /^new project$/i,
  /^draft project$/i,
  /^short description$/i,
  /^project description$/i,
  /^tbd$/i,
  /^n\/a$/i,
];

export const isPlaceholderText = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? '';
  if (trimmed.length < 3) {
    return true;
  }
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
};

export const deriveNextAuthoringStageFromProject = (project: {
  title: string;
  shortDescription: string;
  description: string;
  difficulty: string | null;
  estimatedDurationMinutes: number | null;
  requiredComponents: Array<{ componentName: string }>;
  steps: Array<{ title: string }>;
}): SequentialStage => {
  if (isPlaceholderText(project.title)) {
    return 'TITLE';
  }
  if (isPlaceholderText(project.shortDescription)) {
    return 'SHORT_DESCRIPTION';
  }
  if (isPlaceholderText(project.description)) {
    return 'FULL_DESCRIPTION';
  }
  if (!project.difficulty) {
    return 'DIFFICULTY';
  }
  if (!project.estimatedDurationMinutes || project.estimatedDurationMinutes <= 0) {
    return 'ESTIMATED_DURATION';
  }
  if (project.requiredComponents.length === 0) {
    return 'COMPONENTS';
  }
  if (project.steps.length === 0) {
    return 'STEPS_OVERVIEW';
  }
  return 'FINAL_REVIEW';
};

export type ComponentStepConsistencyResult =
  | { ok: true }
  | {
      ok: false;
      code: 'AI_STEP_COMPONENT_INCONSISTENT';
      issues: string[];
    };

const normalizeName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[Ωω]/g, 'ohm')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ');

const COMPONENT_ALIAS_GROUPS: string[][] = [
  ['ldr', 'photoresistor', 'light dependent resistor', 'light-dependent resistor'],
  ['led', 'white led', 'red led'],
  ['reed switch', 'magnetic door sensor', 'door sensor'],
  ['jumper wire', 'jumper wires'],
  ['220 ohm resistor', '220ohm resistor', '220 ohm', '220ohm'],
  ['10k resistor', '10k ohm resistor', '10 k ohm resistor', '10kohm resistor'],
  ['arduino uno', 'arduino'],
  ['breadboard'],
  ['usb cable', 'usb'],
];

const FORBIDDEN_PROSE_TERMS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bsoil moisture\b/i, label: 'soil moisture sensor' },
  { pattern: /\bpump\b/i, label: 'pump' },
  { pattern: /\brelay\b/i, label: 'relay' },
  { pattern: /\bultrasonic\b/i, label: 'ultrasonic sensor' },
  { pattern: /\bpir\b/i, label: 'PIR sensor' },
  { pattern: /\bbuzzer\b/i, label: 'buzzer' },
  { pattern: /\blcd\b/i, label: 'LCD' },
  { pattern: /\bsewing machine\b/i, label: 'sewing machine' },
  { pattern: /\bzipper\b/i, label: 'zipper' },
  { pattern: /\bleather\b/i, label: 'leather' },
  { pattern: /\bwood(?:en)?\b/i, label: 'wood' },
  { pattern: /\belectronics?\b/i, label: 'electronics' },
  { pattern: /ماكين(?:ة|ه) خياط/i, label: 'sewing machine' },
  { pattern: /سحاب|سوستة/i, label: 'zipper' },
  { pattern: /جلد/i, label: 'leather' },
  { pattern: /خشب/i, label: 'wood' },
];

export const expandComponentAliases = (componentName: string): string[] => {
  const normalized = normalizeName(componentName);
  const aliases = new Set<string>([normalized]);
  for (const group of COMPONENT_ALIAS_GROUPS) {
    if (group.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
      for (const alias of group) {
        aliases.add(alias);
      }
    }
  }
  for (const token of normalized.split(/\s+/).filter((part) => part.length >= 3)) {
    aliases.add(token);
  }
  return [...aliases];
};

export const catalogAllowsProseTerm = (
  term: string,
  components: SequentialComponent[],
): boolean => {
  const normalizedTerm = normalizeName(term);
  return components.some((component) =>
    expandComponentAliases(component.componentName).some(
      (alias) =>
        normalizedTerm.includes(alias) ||
        alias.includes(normalizedTerm) ||
        normalizeName(component.componentName).includes(normalizedTerm),
    ),
  );
};

const stepUsesStructuredRefs = (steps: SequentialStep[]) =>
  steps.some((step) => (step.componentRefs?.length ?? 0) > 0);

const componentRefMatchesCatalog = (
  componentRef: string,
  components: SequentialComponent[],
  catalogIds: Set<string>,
) => {
  if (catalogIds.has(componentRef)) {
    return true;
  }
  const normalizedRef = normalizeName(componentRef);
  return components.some((component) => {
    const normalizedName = normalizeName(component.componentName);
    if (normalizedRef === normalizedName) {
      return true;
    }
    const aliases = expandComponentAliases(component.componentName);
    return aliases.some(
      (alias) =>
        normalizedRef === alias ||
        normalizedRef.includes(alias) ||
        alias.includes(normalizedRef),
    );
  });
};

const collectForbiddenProseIssues = (
  stepText: string,
  components: SequentialComponent[],
): string[] => {
  const issues: string[] = [];
  for (const forbidden of FORBIDDEN_PROSE_TERMS) {
    if (!forbidden.pattern.test(stepText)) {
      continue;
    }
    if (!catalogAllowsProseTerm(forbidden.label, components)) {
      issues.push(
        `Step plan references "${forbidden.label}" which is not in the saved component list.`,
      );
    }
  }
  return issues;
};

export const validateComponentStepConsistency = (input: {
  components: SequentialComponent[];
  steps: SequentialStep[];
  constraints?: string[];
}): ComponentStepConsistencyResult => {
  const issues: string[] = [];
  const componentNames = input.components.map((component) =>
    normalizeName(component.componentName),
  );
  const uniqueNames = new Set(componentNames);
  if (uniqueNames.size !== componentNames.length) {
    issues.push('Duplicate component names are not allowed.');
  }

  const catalogIds = new Set(
    input.components
      .map((component) => component.id?.trim())
      .filter((id): id is string => Boolean(id)),
  );
  const stepText = input.steps
    .map((step) => `${step.title} ${step.description}`.toLowerCase())
    .join(' ');

  if (stepUsesStructuredRefs(input.steps)) {
    for (const step of input.steps) {
      for (const componentRef of step.componentRefs ?? []) {
        if (!componentRefMatchesCatalog(componentRef, input.components, catalogIds)) {
          issues.push(
            `Step "${step.title}" references unknown component ID "${componentRef}".`,
          );
        }
      }
    }
    issues.push(...collectForbiddenProseIssues(stepText, input.components));
  } else {
    issues.push(...collectForbiddenProseIssues(stepText, input.components));
  }

  for (const constraint of input.constraints ?? []) {
    const normalized = constraint.trim().toLowerCase();
    if (!normalized) {
      continue;
    }
    if (normalized.includes('no pump') || normalized.includes('without pump')) {
      const mentionsPump =
        input.components.some((component) =>
          component.componentName.toLowerCase().includes('pump'),
        ) || stepText.includes('pump');
      if (mentionsPump) {
        issues.push('Steps or components still reference a pump despite the no-pump constraint.');
      }
    }
  }

  if (input.steps.length === 0) {
    issues.push('At least one build step is required.');
  }

  const emptyStep = input.steps.find(
    (step) => step.title.trim().length === 0 || step.description.trim().length === 0,
  );
  if (emptyStep) {
    issues.push('Every step must have a title and description.');
  }

  if (issues.length > 0) {
    return {
      ok: false,
      code: 'AI_STEP_COMPONENT_INCONSISTENT',
      issues,
    };
  }

  return { ok: true };
};

export const reindexWorkingSteps = (steps: SequentialStep[]) =>
  steps
    .map((step) => ({
      title: step.title.trim(),
      description: step.description.trim(),
      ...(step.componentRefs?.length ? { componentRefs: [...step.componentRefs] } : {}),
    }))
    .filter((step) => step.title.length > 0 && step.description.length > 0);

export const removeWorkingComponentAt = (
  components: SequentialComponent[],
  index: number,
): SequentialComponent[] => components.filter((_, itemIndex) => itemIndex !== index);

export const removeWorkingStepAt = (steps: SequentialStep[], index: number): SequentialStep[] =>
  steps.filter((_, itemIndex) => itemIndex !== index);
