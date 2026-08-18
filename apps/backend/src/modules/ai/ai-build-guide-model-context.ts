export type BuildGuideContextSource = {
  project: { title: string };
  status: string;
  materialReadiness: { ready: number; total: number };
  stepProgress: {
    completed: number;
    total: number;
    percent: number;
    currentStep: { stepNumber: number; title: string } | null;
    steps: Array<{
      stepNumber: number;
      title: string;
      description: string;
      state: string;
    }>;
  };
  items: Array<{
    component: { componentName: string };
  }>;
};

export type BuildGuideModelContext = {
  projectTitle: string;
  buildStatus: string;
  currentStepNumber: number | null;
  totalSteps: number;
  progressPercent: number;
  currentStepTitle: string | null;
  currentStepInstructions: string | null;
  completedSteps: Array<{ stepNumber: number; title: string }>;
  upcomingStep: { stepNumber: number; title: string } | null;
  materialsReady: number;
  materialsTotal: number;
  materialNames: string[];
};

const uniqueNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
};

export const buildBuildGuideModelContext = (
  build: BuildGuideContextSource,
): BuildGuideModelContext => {
  const steps = [...build.stepProgress.steps].sort(
    (left, right) => left.stepNumber - right.stepNumber,
  );
  const current =
    steps.find((step) => step.state === 'CURRENT') ??
    (build.stepProgress.currentStep
      ? steps.find(
          (step) => step.stepNumber === build.stepProgress.currentStep?.stepNumber,
        )
      : undefined);
  const completedSteps = steps
    .filter((step) => step.state === 'COMPLETED')
    .map((step) => ({ stepNumber: step.stepNumber, title: step.title }));
  const upcoming = steps.find((step) => step.state === 'LOCKED') ?? null;

  return {
    projectTitle: build.project.title,
    buildStatus: build.status,
    currentStepNumber:
      current?.stepNumber ?? build.stepProgress.currentStep?.stepNumber ?? null,
    totalSteps: build.stepProgress.total,
    progressPercent: build.stepProgress.percent,
    currentStepTitle: current?.title ?? build.stepProgress.currentStep?.title ?? null,
    currentStepInstructions: current?.description?.trim() || null,
    completedSteps,
    upcomingStep: upcoming
      ? { stepNumber: upcoming.stepNumber, title: upcoming.title }
      : null,
    materialsReady: build.materialReadiness.ready,
    materialsTotal: build.materialReadiness.total,
    materialNames: uniqueNames(
      build.items.map((item) => item.component.componentName),
    ),
  };
};

export const formatBuildGuideTrustedSystemContext = (
  context: BuildGuideModelContext,
  options?: { explanationLocale?: 'en' | 'ar' },
): string => {
  const lines = [
    'Trusted current-build context for this conversation:',
    `Project: ${context.projectTitle}`,
    `Build state: ${context.buildStatus}`,
  ];

  if (context.totalSteps > 0) {
    lines.push(
      `Completed ${context.completedSteps.length} of ${context.totalSteps} steps (${context.progressPercent}%).`,
    );
  }

  if (context.currentStepNumber != null && context.currentStepTitle) {
    lines.push(
      `Current step: ${context.currentStepNumber} of ${context.totalSteps} — ${context.currentStepTitle}`,
    );
  }

  if (context.currentStepInstructions) {
    lines.push(`Current step instructions: ${context.currentStepInstructions}`);
  }

  if (context.completedSteps.length > 0) {
    lines.push(
      `Completed steps: ${context.completedSteps
        .map((step) => `${step.stepNumber}. ${step.title}`)
        .join('; ')}`,
    );
  }

  if (context.upcomingStep) {
    lines.push(
      `Upcoming step: ${context.upcomingStep.stepNumber}. ${context.upcomingStep.title}`,
    );
  }

  if (context.materialsTotal > 0) {
    lines.push(
      `Materials readiness: ${context.materialsReady} of ${context.materialsTotal} ready`,
    );
  }

  if (context.materialNames.length > 0) {
    lines.push(
      `Known project materials (project-wide, not step-specific): ${context.materialNames
        .slice(0, 20)
        .join(', ')}`,
    );
  } else {
    lines.push(
      'Known project materials (project-wide, not step-specific): none listed.',
    );
  }

  lines.push(
    'Use this context when interpreting short or ambiguous learner questions.',
    'Do not ask which project or step they mean when this context already answers that.',
    'Use the official current-step instructions as the primary how-to source.',
    'There is no authoritative mapping from the current step to specific project materials.',
    'Do not claim that a material belongs to this step unless the official current-step instructions explicitly name it.',
    'When assisting with a build, do not invent project-specific components, dimensions, wiring, materials, or assembly facts that are not present in the live build context or official step instructions.',
    'Clearly distinguish general advice from project-provided instructions.',
    'General assembly guidance is allowed, but must not be phrased as "your project needs X" unless X is in this context.',
    'If the learner asks which parts to use for the current step, acknowledge the current step, state that the project does not map materials to steps, then list only the known project materials above.',
    'If the official instructions are not specific enough, say what is known and ask a focused next action.',
  );

  if (options?.explanationLocale === 'ar') {
    lines.push(
      'The learner is communicating in Arabic. Explain in Arabic. Official English project, step, and material names may be quoted as labels only. Do not mix long English paragraphs into the explanation.',
    );
  }

  return lines.join('\n');
};
