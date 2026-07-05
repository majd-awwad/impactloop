import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';
import type { LearningProjectsQuery } from './learning-projects.validation.js';

const clientOrPrisma = (client?: Prisma.TransactionClient) => client ?? prisma;

const publicProjectWhere: Prisma.LearningProjectWhereInput = {
  status: 'PUBLISHED',
  category: {
    isActive: true,
    categoryType: {
      in: ['PROJECT', 'BOTH'],
    },
  },
};

const buildSearchClauses = (q: string): Prisma.LearningProjectWhereInput[] => [
  {
    title: {
      contains: q,
      mode: 'insensitive',
    },
  },
  {
    shortDescription: {
      contains: q,
      mode: 'insensitive',
    },
  },
  {
    description: {
      contains: q,
      mode: 'insensitive',
    },
  },
  {
    tags: {
      some: {
        tag: {
          contains: q,
          mode: 'insensitive',
        },
      },
    },
  },
  {
    category: {
      nameEn: {
        contains: q,
        mode: 'insensitive',
      },
    },
  },
  {
    category: {
      nameAr: {
        contains: q,
        mode: 'insensitive',
      },
    },
  },
];

const buildLearningProjectsWhere = (
  query: LearningProjectsQuery,
): Prisma.LearningProjectWhereInput => {
  const where: Prisma.LearningProjectWhereInput = {
    ...publicProjectWhere,
  };

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  if (query.difficulty) {
    where.difficulty = query.difficulty;
  }

  if (query.tag) {
    where.tags = {
      some: {
        tag: {
          equals: query.tag,
          mode: 'insensitive',
        },
      },
    };
  }

  if (query.q) {
    where.OR = buildSearchClauses(query.q);
  }

  return where;
};

const learningProjectListInclude = {
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      isActive: true,
      categoryType: true,
    },
  },
  createdByUser: {
    select: {
      displayName: true,
      email: true,
    },
  },
  tags: {
    select: {
      tag: true,
    },
    orderBy: {
      tag: 'asc' as const,
    },
  },
} satisfies Prisma.LearningProjectInclude;

const learningProjectDetailInclude = {
  category: {
    select: {
      id: true,
      nameEn: true,
      nameAr: true,
      isActive: true,
      categoryType: true,
    },
  },
  createdByUser: {
    select: {
      displayName: true,
      email: true,
    },
  },
  images: {
    select: {
      id: true,
      imageUrl: true,
      sortOrder: true,
    },
    orderBy: {
      sortOrder: 'asc' as const,
    },
  },
  requiredComponents: {
    select: {
      id: true,
      categoryId: true,
      componentName: true,
      materialType: true,
      quantity: true,
      unit: true,
      componentRole: true,
      isRequired: true,
      canBeSubstituted: true,
      notes: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  steps: {
    select: {
      id: true,
      stepNumber: true,
      title: true,
      description: true,
      imageUrl: true,
    },
    orderBy: {
      stepNumber: 'asc' as const,
    },
  },
  links: {
    select: {
      id: true,
      linkType: true,
      url: true,
      title: true,
      sourceName: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
  tags: {
    select: {
      tag: true,
    },
    orderBy: {
      tag: 'asc' as const,
    },
  },
} satisfies Prisma.LearningProjectInclude;

export const findLearningProjects = async (query: LearningProjectsQuery) => {
  const where = buildLearningProjectsWhere(query);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    prisma.learningProject.findMany({
      where,
      include: learningProjectListInclude,
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: query.limit,
    }),
    prisma.learningProject.count({ where }),
  ]);

  return { items, total };
};

export const findLearningProjectById = async (id: string) => {
  return prisma.learningProject.findFirst({
    where: {
      id,
      ...publicProjectWhere,
    },
    include: learningProjectDetailInclude,
  });
};

export const createLearningProjectForReview = async (input: {
  createdBy: string;
  categoryId: string;
  title: string;
  shortDescription: string;
  description: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDurationMinutes?: number;
  coverImageUrl?: string | null;
  requiredComponents?: {
    name: string;
    quantity?: number;
    unit?: string;
    notes?: string;
    isRequired?: boolean;
  }[];
  steps?: { title: string; description: string }[];
  links?: { url: string; title?: string }[];
  client?: Prisma.TransactionClient;
}) => {
  const now = new Date();
  const client = clientOrPrisma(input.client);

  return client.learningProject.create({
    data: {
      categoryId: input.categoryId,
      createdBy: input.createdBy,
      title: input.title,
      shortDescription: input.shortDescription,
      description: input.description,
      difficulty: input.difficulty,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      coverImageUrl: input.coverImageUrl ?? null,
      status: 'PENDING_REVIEW',
      submittedAt: now,
      requiredComponents: input.requiredComponents?.length
        ? {
            create: input.requiredComponents.map((component) => ({
              componentName: component.name,
              materialType: 'General',
              quantity: component.quantity ?? 1,
              unit: component.unit ?? 'piece',
              componentRole: 'REQUIRED_MATERIAL',
              isRequired: component.isRequired ?? true,
              notes: component.notes,
            })),
          }
        : undefined,
      steps: input.steps?.length
        ? {
            create: input.steps.map((step, index) => ({
              stepNumber: index + 1,
              title: step.title,
              description: step.description,
            })),
          }
        : undefined,
      links: input.links?.length
        ? {
            create: input.links.map((link) => ({
              linkType: 'OTHER',
              url: link.url,
              title: link.title,
            })),
          }
        : undefined,
    },
    select: {
      id: true,
      title: true,
      status: true,
      submittedAt: true,
    },
  });
};

export const findProjectCategoryForSubmit = async (categoryId: string) =>
  prisma.category.findFirst({
    where: {
      id: categoryId,
      isActive: true,
      categoryType: { in: ['PROJECT', 'BOTH'] },
    },
    select: { id: true },
  });
