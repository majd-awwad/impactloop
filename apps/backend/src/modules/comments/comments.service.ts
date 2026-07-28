import { AppError } from '../../utils/app-error.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';

import * as commentsRepository from './comments.repository.js';
import type { CommentRecord } from './comments.repository.js';
import type {
  CommentsListQuery,
  CreateCommentInput,
  UpdateCommentInput,
} from './comments.validation.js';

export type CommentTargetKind = 'material' | 'learningProject';

type PublicAuthor = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

type ReplyToProjection = {
  id: string;
  author: PublicAuthor;
} | null;

export type CommentDto = {
  id: string;
  materialId: string | null;
  learningProjectId: string | null;
  parentCommentId: string | null;
  rootCommentId: string | null;
  replyToCommentId: string | null;
  body: string | null;
  status: 'VISIBLE' | 'DELETED' | 'MODERATED';
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  author: PublicAuthor;
  replyTo: ReplyToProjection;
  repliesCount?: number;
  canEdit: boolean;
  canDelete: boolean;
};

const mapAuthor = (author: {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
}): PublicAuthor => ({
  id: author.id,
  displayName: author.displayName,
  avatarUrl: author.profileImageUrl,
});

const isPlaceholderStatus = (status: CommentRecord['status']) =>
  status === 'DELETED' || status === 'MODERATED';

const mapComment = (
  comment: CommentRecord,
  viewer: AccessTokenPayload | undefined,
  repliesCount?: number,
): CommentDto => {
  const placeholder = isPlaceholderStatus(comment.status);
  const isOwner = Boolean(viewer?.sub && viewer.sub === comment.authorId);

  return {
    id: comment.id,
    materialId: comment.materialId,
    learningProjectId: comment.learningProjectId,
    parentCommentId: comment.parentCommentId,
    rootCommentId: comment.rootCommentId,
    replyToCommentId: comment.replyToCommentId,
    body: placeholder ? null : comment.body,
    status: comment.status,
    isDeleted: placeholder,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    editedAt: comment.editedAt?.toISOString() ?? null,
    deletedAt: comment.deletedAt?.toISOString() ?? null,
    author: mapAuthor(comment.author),
    replyTo: comment.replyTo
      ? {
          id: comment.replyTo.id,
          author: mapAuthor(comment.replyTo.author),
        }
      : null,
    ...(repliesCount === undefined ? {} : { repliesCount }),
    canEdit: isOwner && !placeholder,
    canDelete: isOwner && !placeholder,
  };
};

const paginationMeta = (total: number, page: number, limit: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

const resolveTarget = async (kind: CommentTargetKind, targetId: string) => {
  if (kind === 'material') {
    const material =
      await commentsRepository.findPublicMaterialTarget(targetId);
    if (!material) {
      throw new AppError('Material not found', 404, 'NOT_FOUND');
    }

    return { materialId: material.id } as const;
  }

  const project =
    await commentsRepository.findPublicLearningProjectTarget(targetId);
  if (!project) {
    throw new AppError('Learning project not found', 404, 'NOT_FOUND');
  }

  return { learningProjectId: project.id } as const;
};

const requireAuth = (viewer?: AccessTokenPayload) => {
  if (!viewer?.sub) {
    throw new AppError('Authentication required', 401, 'UNAUTHENTICATED');
  }

  return viewer;
};

export const listRootComments = async (
  kind: CommentTargetKind,
  targetId: string,
  query: CommentsListQuery,
  viewer?: AccessTokenPayload,
) => {
  const target = await resolveTarget(kind, targetId);
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, roots] = await Promise.all([
    commentsRepository.countRootComments(target),
    commentsRepository.findRootComments(target, { skip, take: limit }),
  ]);

  const replyCounts = await commentsRepository.countRepliesForRoots(
    roots.map((root) => root.id),
    target,
  );

  return {
    items: roots.map((root) =>
      mapComment(root, viewer, replyCounts.get(root.id) ?? 0),
    ),
    pagination: paginationMeta(total, page, limit),
  };
};

export const listCommentReplies = async (
  kind: CommentTargetKind,
  targetId: string,
  rootCommentId: string,
  query: CommentsListQuery,
  viewer?: AccessTokenPayload,
) => {
  const target = await resolveTarget(kind, targetId);
  const root = await commentsRepository.findCommentInTarget(
    rootCommentId,
    target,
  );

  if (!root || root.parentCommentId !== null || root.rootCommentId !== null) {
    throw new AppError('Comment not found', 404, 'NOT_FOUND');
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [total, replies] = await Promise.all([
    commentsRepository.countRepliesForRoot(root.id, target),
    commentsRepository.findRepliesForRoot(root.id, target, {
      skip,
      take: limit,
    }),
  ]);

  return {
    items: replies.map((reply) => mapComment(reply, viewer)),
    pagination: paginationMeta(total, page, limit),
  };
};

export const createComment = async (
  kind: CommentTargetKind,
  targetId: string,
  input: CreateCommentInput,
  viewer?: AccessTokenPayload,
) => {
  const auth = requireAuth(viewer);
  const target = await resolveTarget(kind, targetId);
  const body = input.body.trim();

  if (!body) {
    throw new AppError('Comment cannot be empty.', 400, 'VALIDATION_ERROR');
  }

  if (!input.parentCommentId && !input.replyToCommentId) {
    const created = await commentsRepository.createRootComment({
      authorId: auth.sub,
      body,
      ...target,
    });

    return mapComment(created, auth, 0);
  }

  const replyTargetId = input.replyToCommentId ?? input.parentCommentId!;
  const replyTarget = await commentsRepository.findCommentInTarget(
    replyTargetId,
    target,
  );

  if (!replyTarget) {
    throw new AppError(
      'Parent comment not found on this target',
      404,
      'NOT_FOUND',
    );
  }

  if (isPlaceholderStatus(replyTarget.status)) {
    throw new AppError(
      'Cannot reply to a deleted comment',
      400,
      'COMMENT_NOT_REPLYABLE',
    );
  }

  const rootCommentId =
    replyTarget.rootCommentId ??
    (replyTarget.parentCommentId === null ? replyTarget.id : null);

  if (!rootCommentId) {
    throw new AppError('Invalid comment thread', 400, 'INVALID_COMMENT_THREAD');
  }

  if (replyTarget.id === rootCommentId && replyTarget.rootCommentId !== null) {
    throw new AppError('Invalid comment thread', 400, 'INVALID_COMMENT_THREAD');
  }

  const root =
    replyTarget.id === rootCommentId
      ? replyTarget
      : await commentsRepository.findCommentInTarget(rootCommentId, target);

  if (!root || root.parentCommentId !== null || root.rootCommentId !== null) {
    throw new AppError('Invalid comment thread', 400, 'INVALID_COMMENT_THREAD');
  }

  if (input.parentCommentId && input.parentCommentId !== replyTarget.id) {
    const explicitParent = await commentsRepository.findCommentInTarget(
      input.parentCommentId,
      target,
    );
    if (!explicitParent) {
      throw new AppError(
        'Parent comment not found on this target',
        404,
        'NOT_FOUND',
      );
    }

    const explicitRootId =
      explicitParent.rootCommentId ??
      (explicitParent.parentCommentId === null ? explicitParent.id : null);

    if (explicitRootId !== rootCommentId) {
      throw new AppError(
        'Reply target must belong to the same thread',
        400,
        'INVALID_COMMENT_THREAD',
      );
    }
  }

  const created = await commentsRepository.createReplyComment({
    authorId: auth.sub,
    body,
    materialId: target.materialId ?? null,
    learningProjectId: target.learningProjectId ?? null,
    rootCommentId,
    replyToCommentId: replyTarget.id,
  });

  return mapComment(created, auth);
};

export const updateComment = async (
  kind: CommentTargetKind,
  targetId: string,
  commentId: string,
  input: UpdateCommentInput,
  viewer?: AccessTokenPayload,
) => {
  const auth = requireAuth(viewer);
  const target = await resolveTarget(kind, targetId);
  const existing = await commentsRepository.findCommentInTarget(
    commentId,
    target,
  );

  if (!existing) {
    throw new AppError('Comment not found', 404, 'NOT_FOUND');
  }

  if (existing.authorId !== auth.sub) {
    throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
  }

  if (isPlaceholderStatus(existing.status)) {
    throw new AppError('Comment is not editable', 400, 'COMMENT_NOT_EDITABLE');
  }

  const body = input.body.trim();
  if (!body) {
    throw new AppError('Comment cannot be empty.', 400, 'VALIDATION_ERROR');
  }

  const updated = await commentsRepository.updateCommentBody({
    id: existing.id,
    body,
    editedAt: new Date(),
  });

  const repliesCount =
    updated.parentCommentId === null
      ? await commentsRepository.countRepliesForRoot(updated.id, target)
      : undefined;

  return mapComment(updated, auth, repliesCount);
};

export const deleteOwnComment = async (
  kind: CommentTargetKind,
  targetId: string,
  commentId: string,
  viewer?: AccessTokenPayload,
) => {
  const auth = requireAuth(viewer);
  const target = await resolveTarget(kind, targetId);
  const existing = await commentsRepository.findCommentInTarget(
    commentId,
    target,
  );

  if (!existing) {
    throw new AppError('Comment not found', 404, 'NOT_FOUND');
  }

  if (existing.authorId !== auth.sub) {
    throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
  }

  if (isPlaceholderStatus(existing.status)) {
    return mapComment(existing, auth);
  }

  const deleted = await commentsRepository.softDeleteComment({
    id: existing.id,
    status: 'DELETED',
    deletedAt: new Date(),
    deletedById: auth.sub,
  });

  const repliesCount =
    deleted.parentCommentId === null
      ? await commentsRepository.countRepliesForRoot(deleted.id, target)
      : undefined;

  return mapComment(deleted, auth, repliesCount);
};

export const moderateComment = async (
  commentId: string,
  viewer?: AccessTokenPayload,
) => {
  const auth = requireAuth(viewer);
  const isModerator = auth.roles.some(
    (role) => role === 'ADMIN' || role === 'MODERATOR',
  );

  if (!isModerator) {
    throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
  }

  const existing = await commentsRepository.findCommentById(commentId);
  if (!existing) {
    throw new AppError('Comment not found', 404, 'NOT_FOUND');
  }

  if (isPlaceholderStatus(existing.status)) {
    return mapComment(existing, auth);
  }

  const moderated = await commentsRepository.softDeleteComment({
    id: existing.id,
    status: 'MODERATED',
    deletedAt: new Date(),
    deletedById: auth.sub,
  });

  return mapComment(moderated, auth);
};
