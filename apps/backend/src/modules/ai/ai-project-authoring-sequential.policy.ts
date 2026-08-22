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
  searchKeywords?: string[];
  notes?: string | null;
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
      consistencyIssues: StepComponentConsistencyIssue[];
    };

export type ComponentReferenceResolution =
  | 'CANONICAL_ID'
  | 'EXACT_NAME'
  | 'NORMALIZED_NAME'
  | 'ALIAS'
  | 'AMBIGUOUS'
  | 'UNKNOWN';

export type StepComponentConsistencyIssue = {
  code:
    | 'DUPLICATE_COMPONENT_NAME'
    | 'UNKNOWN_COMPONENT_REFERENCE'
    | 'AMBIGUOUS_COMPONENT_REFERENCE'
    | 'FORBIDDEN_COMPONENT_MENTION'
    | 'COMPONENT_CONSTRAINT_VIOLATION'
    | 'EMPTY_STEP_PLAN'
    | 'EMPTY_STEP';
  message: string;
  stepIndex: number | null;
  stepOrder: number | null;
  stepTitle: string | null;
  componentRef: string | null;
  canonicalComponentId: string | null;
  canonicalComponentName: string | null;
  resolution: ComponentReferenceResolution | null;
};

export const normalizeComponentIdentity = (value: string) =>
  value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[Ωω]/g, 'ohm')
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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
  const normalized = normalizeComponentIdentity(componentName);
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
  const normalizedTerm = normalizeComponentIdentity(term);
  return components.some((component) =>
    expandComponentAliases(component.componentName).some(
      (alias) =>
        normalizedTerm.includes(alias) ||
        alias.includes(normalizedTerm) ||
        normalizeComponentIdentity(component.componentName).includes(normalizedTerm),
    ),
  );
};

const stepUsesStructuredRefs = (steps: SequentialStep[]) =>
  steps.some((step) => (step.componentRefs?.length ?? 0) > 0);

export const resolveComponentReference = (
  componentRef: string,
  components: SequentialComponent[],
): {
  resolution: ComponentReferenceResolution;
  component: SequentialComponent | null;
} => {
  const canonicalIdMatches = components.filter(
    (component) => component.id?.trim() === componentRef.trim(),
  );
  if (canonicalIdMatches.length === 1) {
    return { resolution: 'CANONICAL_ID', component: canonicalIdMatches[0]! };
  }
  const exactNameMatches = components.filter(
    (component) => component.componentName.trim() === componentRef.trim(),
  );
  if (exactNameMatches.length === 1) {
    return { resolution: 'EXACT_NAME', component: exactNameMatches[0]! };
  }
  const normalizedRef = normalizeComponentIdentity(componentRef);
  const normalizedNameMatches = components.filter(
    (component) => normalizeComponentIdentity(component.componentName) === normalizedRef,
  );
  if (normalizedNameMatches.length === 1) {
    return { resolution: 'NORMALIZED_NAME', component: normalizedNameMatches[0]! };
  }
  if (normalizedNameMatches.length > 1) {
    return { resolution: 'AMBIGUOUS', component: null };
  }
  const aliasMatches = components.filter((component) =>
    expandComponentAliases(component.componentName).some(
      (alias) =>
        normalizedRef === alias ||
        normalizedRef.includes(alias) ||
        alias.includes(normalizedRef),
    ),
  );
  if (aliasMatches.length === 1) {
    return { resolution: 'ALIAS', component: aliasMatches[0]! };
  }
  return {
    resolution: aliasMatches.length > 1 ? 'AMBIGUOUS' : 'UNKNOWN',
    component: null,
  };
};

const collectForbiddenProseIssues = (
  steps: SequentialStep[],
  components: SequentialComponent[],
): StepComponentConsistencyIssue[] => {
  const issues: StepComponentConsistencyIssue[] = [];
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex]!;
    const stepText = `${step.title} ${step.description}`.toLowerCase();
    for (const forbidden of FORBIDDEN_PROSE_TERMS) {
      if (!forbidden.pattern.test(stepText)) {
        continue;
      }
      if (!catalogAllowsProseTerm(forbidden.label, components)) {
        issues.push({
          code: 'FORBIDDEN_COMPONENT_MENTION',
          message: `Step plan references "${forbidden.label}" which is not in the saved component list.`,
          stepIndex,
          stepOrder: stepIndex + 1,
          stepTitle: step.title,
          componentRef: forbidden.label,
          canonicalComponentId: null,
          canonicalComponentName: null,
          resolution: 'UNKNOWN',
        });
      }
    }
  }
  return issues;
};

export const validateComponentStepConsistency = (input: {
  components: SequentialComponent[];
  steps: SequentialStep[];
  constraints?: string[];
}): ComponentStepConsistencyResult => {
  const consistencyIssues: StepComponentConsistencyIssue[] = [];
  const componentNames = input.components.map((component) =>
    normalizeComponentIdentity(component.componentName),
  );
  const uniqueNames = new Set(componentNames);
  if (uniqueNames.size !== componentNames.length) {
    consistencyIssues.push({
      code: 'DUPLICATE_COMPONENT_NAME',
      message: 'Duplicate component names are not allowed.',
      stepIndex: null,
      stepOrder: null,
      stepTitle: null,
      componentRef: null,
      canonicalComponentId: null,
      canonicalComponentName: null,
      resolution: null,
    });
  }
  const stepText = input.steps
    .map((step) => `${step.title} ${step.description}`.toLowerCase())
    .join(' ');

  if (stepUsesStructuredRefs(input.steps)) {
    for (let stepIndex = 0; stepIndex < input.steps.length; stepIndex += 1) {
      const step = input.steps[stepIndex]!;
      for (const componentRef of step.componentRefs ?? []) {
        const resolved = resolveComponentReference(componentRef, input.components);
        if (resolved.resolution === 'UNKNOWN' || resolved.resolution === 'AMBIGUOUS') {
          consistencyIssues.push({
            code:
              resolved.resolution === 'AMBIGUOUS'
                ? 'AMBIGUOUS_COMPONENT_REFERENCE'
                : 'UNKNOWN_COMPONENT_REFERENCE',
            message: `Step "${step.title}" references ${resolved.resolution === 'AMBIGUOUS' ? 'ambiguous' : 'unknown'} component ID "${componentRef}".`,
            stepIndex,
            stepOrder: stepIndex + 1,
            stepTitle: step.title,
            componentRef,
            canonicalComponentId: null,
            canonicalComponentName: null,
            resolution: resolved.resolution,
          });
        }
      }
    }
    consistencyIssues.push(...collectForbiddenProseIssues(input.steps, input.components));
  } else {
    consistencyIssues.push(...collectForbiddenProseIssues(input.steps, input.components));
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
        consistencyIssues.push({
          code: 'COMPONENT_CONSTRAINT_VIOLATION',
          message: 'Steps or components still reference a pump despite the no-pump constraint.',
          stepIndex: null,
          stepOrder: null,
          stepTitle: null,
          componentRef: 'pump',
          canonicalComponentId: null,
          canonicalComponentName: null,
          resolution: null,
        });
      }
    }
  }

  if (input.steps.length === 0) {
    consistencyIssues.push({
      code: 'EMPTY_STEP_PLAN',
      message: 'At least one build step is required.',
      stepIndex: null,
      stepOrder: null,
      stepTitle: null,
      componentRef: null,
      canonicalComponentId: null,
      canonicalComponentName: null,
      resolution: null,
    });
  }

  const emptyStep = input.steps.find(
    (step) => step.title.trim().length === 0 || step.description.trim().length === 0,
  );
  if (emptyStep) {
    const stepIndex = input.steps.indexOf(emptyStep);
    consistencyIssues.push({
      code: 'EMPTY_STEP',
      message: 'Every step must have a title and description.',
      stepIndex,
      stepOrder: stepIndex + 1,
      stepTitle: emptyStep.title || null,
      componentRef: null,
      canonicalComponentId: null,
      canonicalComponentName: null,
      resolution: null,
    });
  }

  if (consistencyIssues.length > 0) {
    return {
      ok: false,
      code: 'AI_STEP_COMPONENT_INCONSISTENT',
      issues: consistencyIssues.map((issue) => issue.message),
      consistencyIssues,
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
