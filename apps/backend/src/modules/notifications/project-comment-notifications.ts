import { prisma } from '../../database/prisma.js';

import { createNotification } from './notifications.repository.js';
import {
  safeActorDisplayName,
  sanitizeNotificationPreview,
} from './notification-preview.js';

type CommentTargetKind = 'material' | 'learningProject';

type ProjectCommentNotificationInput = {
  id: string;
  learningProjectId: string | null;
  parentCommentId: string | null;
  replyToCommentId: string | null;
  body: string | null;
  author: { id: string; displayName: string };
  replyTo: { author: { id: string } } | null;
};

export const PROJECT_COMMENT_RECEIVED_TYPE = 'PROJECT_COMMENT_RECEIVED';
export const PROJECT_COMMENT_REPLY_TYPE = 'PROJECT_COMMENT_REPLY';

const notifySafely = async (task: () => Promise<unknown>) => {
  try {
    await task();
  } catch (error) {
    console.error('[notifications] project comment notification failed', error);
  }
};

export const notifyProjectCommentCreated = async (input: {
  kind: CommentTargetKind;
  comment: ProjectCommentNotificationInput;
}) =>
  notifySafely(async () => {
    if (input.kind !== 'learningProject' || !input.comment.learningProjectId) {
      return;
    }

    const body = input.comment.body?.trim() ?? '';
    const preview = sanitizeNotificationPreview(body);
    if (!preview) {
      return;
    }

    const project = await prisma.learningProject.findUnique({
      where: { id: input.comment.learningProjectId },
      select: { id: true, createdBy: true, title: true },
    });

    if (!project) {
      return;
    }

    const commenterId = input.comment.author.id;
    const actorName = safeActorDisplayName(input.comment.author.displayName);
    const projectTitle = project.title.trim() || 'your project';
    const isReply = Boolean(
      input.comment.replyToCommentId || input.comment.parentCommentId,
    );
    const replyToAuthorId = input.comment.replyTo?.author.id ?? null;

    if (isReply) {
      if (!replyToAuthorId || replyToAuthorId === commenterId) {
        return;
      }

      await createNotification({
        userId: replyToAuthorId,
        notificationType: PROJECT_COMMENT_REPLY_TYPE,
        title: 'New reply to your comment',
        body: `${actorName}: ${preview}`,
        relatedEntityType: 'LEARNING_PROJECT',
        relatedEntityId: project.id,
        eventKey: `project-comment:${input.comment.id}:${replyToAuthorId}`,
        entityType: 'LEARNING_PROJECT',
        entityId: project.id,
        actionType: 'OPEN_ENTITY',
        actorId: commenterId,
        metadata: {
          projectTitle,
          actorDisplayName: actorName,
          commentPreview: preview,
          commentId: input.comment.id,
        },
      });
      return;
    }

    if (project.createdBy === commenterId) {
      return;
    }

    await createNotification({
      userId: project.createdBy,
      notificationType: PROJECT_COMMENT_RECEIVED_TYPE,
      title: 'New comment on your project',
      body: `${actorName}: ${preview}`,
      relatedEntityType: 'LEARNING_PROJECT',
      relatedEntityId: project.id,
      eventKey: `project-comment:${input.comment.id}:${project.createdBy}`,
      entityType: 'LEARNING_PROJECT',
      entityId: project.id,
      actionType: 'OPEN_ENTITY',
      actorId: commenterId,
      metadata: {
        projectTitle,
        actorDisplayName: actorName,
        commentPreview: preview,
        commentId: input.comment.id,
      },
    });
  });
