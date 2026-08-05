import type { Prisma } from '../../generated/prisma/client.js';

import { sanitizeProjectLearningText } from './project-learning-text.js';

export type ProjectLearningComponentSnapshot = {
  componentName: string;
  materialType: string;
  quantity: string;
  unit: string;
  componentRole: string;
  isRequired: boolean;
  canBeSubstituted: boolean;
  notes: string | null;
  searchKeywords: string[] | null;
  alternativeKeywords: string[] | null;
};

export type ProjectLearningStepSnapshot = {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
};

export type ProjectLearningCanonicalSnapshot = {
  title: string;
  shortDescription: string;
  description: string;
  difficulty: string;
  estimatedDurationMinutes: number | null;
  components: ProjectLearningComponentSnapshot[];
  steps: ProjectLearningStepSnapshot[];
};

type LearningProjectForPackSnapshot = Prisma.LearningProjectGetPayload<{
  include: {
    requiredComponents: true;
    steps: true;
  };
}>;

const parseKeywordList = (value: Prisma.JsonValue | null): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const keywords = value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => sanitizeProjectLearningText(entry))
    .filter((entry) => entry.length > 0);

  return keywords.length > 0 ? keywords : null;
};

const canonicalizeDecimalQuantity = (value: Prisma.Decimal): string =>
  value.toFixed(3).replace(/\.?0+$/, '');

export const buildProjectLearningCanonicalSnapshot = (
  project: LearningProjectForPackSnapshot,
): ProjectLearningCanonicalSnapshot => {
  const components = [...project.requiredComponents]
    .sort((left, right) => {
      const byCreatedAt = left.createdAt.getTime() - right.createdAt.getTime();
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }
      return left.id.localeCompare(right.id);
    })
    .map((component) => ({
      componentName: sanitizeProjectLearningText(component.componentName),
      materialType: sanitizeProjectLearningText(component.materialType),
      quantity: canonicalizeDecimalQuantity(component.quantity),
      unit: sanitizeProjectLearningText(component.unit),
      componentRole: component.componentRole,
      isRequired: component.isRequired,
      canBeSubstituted: component.canBeSubstituted,
      notes: component.notes
        ? sanitizeProjectLearningText(component.notes)
        : null,
      searchKeywords: parseKeywordList(component.searchKeywords),
      alternativeKeywords: parseKeywordList(component.alternativeKeywords),
    }));

  const steps = [...project.steps]
    .sort((left, right) => {
      const byNumber = left.stepNumber - right.stepNumber;
      if (byNumber !== 0) {
        return byNumber;
      }
      return left.id.localeCompare(right.id);
    })
    .map((step) => ({
      id: step.id,
      stepNumber: step.stepNumber,
      title: sanitizeProjectLearningText(step.title),
      description: sanitizeProjectLearningText(step.description),
    }));

  return {
    title: sanitizeProjectLearningText(project.title),
    shortDescription: sanitizeProjectLearningText(project.shortDescription),
    description: sanitizeProjectLearningText(project.description),
    difficulty: project.difficulty,
    estimatedDurationMinutes: project.estimatedDurationMinutes,
    components,
    steps,
  };
};

export const buildProjectLearningHashPayload = (
  snapshot: ProjectLearningCanonicalSnapshot,
) => ({
  hashSchemaVersion: 1,
  title: snapshot.title,
  shortDescription: snapshot.shortDescription,
  description: snapshot.description,
  difficulty: snapshot.difficulty,
  estimatedDurationMinutes: snapshot.estimatedDurationMinutes,
  components: snapshot.components,
  steps: snapshot.steps.map((step) => ({
    stepNumber: step.stepNumber,
    title: step.title,
    description: step.description,
  })),
});
