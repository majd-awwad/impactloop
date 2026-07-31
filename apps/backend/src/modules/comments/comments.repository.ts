import type { CommentStatus, Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

const authorSelect = {
  id: true,
  displayName: true,
  profileImageUrl: true,
} satisfies Prisma.UserSelect;

export const commentInclude = {
  author: { select: authorSelect },
  replyTo: {
    select: {
      id: true,
      authorId: true,
      status: true,
      author: { select: authorSelect },
    },
  },
} satisfies Prisma.CommentInclude;

export type CommentRecord = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

export type CommentTarget = {
  materialId?: string;
  learningProjectId?: string;
};

const targetWhere = (target: CommentTarget): Prisma.CommentWhereInput => {
  if (target.materialId) {
    return { materialId: target.materialId, learningProjectId: null };
  }

  return {
    learningProjectId: target.learningProjectId!,
    materialId: null,
  };
};

export const findPublicMaterialTarget = async (materialId: string) => {
  return prisma.material.findFirst({
    where: {
      id: materialId,
      status: {
        in: ['AVAILABLE', 'PENDING_RESERVATION', 'RESERVED'],
      },
      category: {
        isActive: true,
        categoryType: { in: ['MATERIAL', 'BOTH'] },
      },
    },
    select: { id: true },
  });
};

export const findPublicLearningProjectTarget = async (
  learningProjectId: string,
) => {
  return prisma.learningProject.findFirst({
    where: {
      id: learningProjectId,
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
    },
    select: { id: true },
  });
};

export const findCommentById = async (id: string) => {
  return prisma.comment.findUnique({
    where: { id },
    include: commentInclude,
  });
};

export const findCommentInTarget = async (
  id: string,
  target: CommentTarget,
) => {
  return prisma.comment.findFirst({
    where: {
      id,
      ...targetWhere(target),
    },
    include: commentInclude,
  });
};

export const countRootComments = async (target: CommentTarget) => {
  return prisma.comment.count({
    where: {
      ...targetWhere(target),
      parentCommentId: null,
      rootCommentId: null,
    },
  });
};

export const findRootComments = async (
  target: CommentTarget,
  input: { skip: number; take: number },
) => {
  return prisma.comment.findMany({
    where: {
      ...targetWhere(target),
      parentCommentId: null,
      rootCommentId: null,
    },
    include: commentInclude,
    orderBy: { createdAt: 'desc' },
    skip: input.skip,
    take: input.take,
  });
};

export const countRepliesForRoot = async (
  rootCommentId: string,
  target: CommentTarget,
) => {
  return prisma.comment.count({
    where: {
      ...targetWhere(target),
      rootCommentId,
    },
  });
};

export const countRepliesForRoots = async (
  rootCommentIds: string[],
  target: CommentTarget,
) => {
  if (rootCommentIds.length === 0) {
    return new Map<string, number>();
  }

  const rows = await prisma.comment.groupBy({
    by: ['rootCommentId'],
    where: {
      ...targetWhere(target),
      rootCommentId: { in: rootCommentIds },
    },
    _count: { _all: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.rootCommentId) {
      counts.set(row.rootCommentId, row._count._all);
    }
  }

  return counts;
};

export const findRepliesForRoot = async (
  rootCommentId: string,
  target: CommentTarget,
  input: { skip: number; take: number },
) => {
  return prisma.comment.findMany({
    where: {
      ...targetWhere(target),
      rootCommentId,
    },
    include: commentInclude,
    orderBy: { createdAt: 'asc' },
    skip: input.skip,
    take: input.take,
  });
};

export const createRootComment = async (input: {
  authorId: string;
  body: string;
  materialId?: string;
  learningProjectId?: string;
}) => {
  return prisma.comment.create({
    data: {
      authorId: input.authorId,
      body: input.body,
      materialId: input.materialId ?? null,
      learningProjectId: input.learningProjectId ?? null,
      parentCommentId: null,
      rootCommentId: null,
      replyToCommentId: null,
      status: 'VISIBLE',
    },
    include: commentInclude,
  });
};

export const createReplyComment = async (input: {
  authorId: string;
  body: string;
  materialId?: string | null;
  learningProjectId?: string | null;
  rootCommentId: string;
  replyToCommentId: string;
}) => {
  return prisma.comment.create({
    data: {
      authorId: input.authorId,
      body: input.body,
      materialId: input.materialId ?? null,
      learningProjectId: input.learningProjectId ?? null,
      parentCommentId: input.rootCommentId,
      rootCommentId: input.rootCommentId,
      replyToCommentId: input.replyToCommentId,
      status: 'VISIBLE',
    },
    include: commentInclude,
  });
};

export const updateCommentBody = async (input: {
  id: string;
  body: string;
  editedAt: Date;
}) => {
  return prisma.comment.update({
    where: { id: input.id },
    data: {
      body: input.body,
      editedAt: input.editedAt,
    },
    include: commentInclude,
  });
};

export const softDeleteComment = async (input: {
  id: string;
  status: CommentStatus;
  deletedAt: Date;
  deletedById: string;
}) => {
  return prisma.comment.update({
    where: { id: input.id },
    data: {
      status: input.status,
      deletedAt: input.deletedAt,
      deletedById: input.deletedById,
      body: '',
    },
    include: commentInclude,
  });
};
