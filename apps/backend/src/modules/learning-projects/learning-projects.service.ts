import { AppError } from '../../utils/app-error.js';

import * as learningProjectsRepository from './learning-projects.repository.js';
import type { LearningProjectsQuery } from './learning-projects.validation.js';

const decimalToSerializable = (value: { toNumber(): number } | number): number => {
  if (typeof value === 'number') {
    return value;
  }

  return value.toNumber();
};

const resolveAuthorName = (
  project: {
    createdByUser: {
      displayName: string;
      email: string;
    };
  },
) => project.createdByUser.displayName || project.createdByUser.email;

const mapCategory = (category: {
  id: string;
  nameEn: string;
  nameAr: string;
}) => ({
  id: category.id,
  nameEn: category.nameEn,
  nameAr: category.nameAr,
});

const mapLearningProjectListItem = (
  project: Awaited<
    ReturnType<typeof learningProjectsRepository.findLearningProjects>
  >['items'][number],
) => ({
  id: project.id,
  title: project.title,
  shortDescription: project.shortDescription,
  category: mapCategory(project.category),
  difficulty: project.difficulty,
  estimatedDurationMinutes: project.estimatedDurationMinutes,
  coverImageUrl: project.coverImageUrl,
  authorName: resolveAuthorName(project),
  tags: project.tags.map((tag) => tag.tag),
  ratingSummary: null,
  createdAt: project.createdAt.toISOString(),
});

const mapLearningProjectDetail = (
  project: NonNullable<
    Awaited<ReturnType<typeof learningProjectsRepository.findLearningProjectById>>
  >,
) => ({
  id: project.id,
  title: project.title,
  shortDescription: project.shortDescription,
  description: project.description,
  category: mapCategory(project.category),
  difficulty: project.difficulty,
  estimatedDurationMinutes: project.estimatedDurationMinutes,
  coverImageUrl: project.coverImageUrl,
  authorName: resolveAuthorName(project),
  images: project.images.map((image) => ({
    id: image.id,
    imageUrl: image.imageUrl,
    sortOrder: image.sortOrder,
  })),
  requiredComponents: project.requiredComponents.map((component) => ({
    id: component.id,
    categoryId: component.categoryId,
    componentName: component.componentName,
    materialType: component.materialType,
    quantity: decimalToSerializable(component.quantity),
    unit: component.unit,
    componentRole: component.componentRole,
    isRequired: component.isRequired,
    canBeSubstituted: component.canBeSubstituted,
    notes: component.notes,
  })),
  steps: project.steps.map((step) => ({
    id: step.id,
    stepNumber: step.stepNumber,
    title: step.title,
    description: step.description,
    imageUrl: step.imageUrl,
  })),
  links: project.links.map((link) => ({
    id: link.id,
    linkType: link.linkType,
    url: link.url,
    title: link.title,
    sourceName: link.sourceName,
  })),
  tags: project.tags.map((tag) => tag.tag),
  ratingSummary: null,
  createdAt: project.createdAt.toISOString(),
});

export const getLearningProjects = async (query: LearningProjectsQuery) => {
  const result = await learningProjectsRepository.findLearningProjects(query);

  return {
    items: result.items.map(mapLearningProjectListItem),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
    },
  };
};

export const getLearningProjectById = async (id: string) => {
  const project = await learningProjectsRepository.findLearningProjectById(id);

  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  return mapLearningProjectDetail(project);
};
