import { createNotification } from '../notifications/notifications.repository.js';

import type { ProjectHelpSessionDetailRecord } from './project-help-session.repository.js';

const projectTitle = (session: ProjectHelpSessionDetailRecord) =>
  session.project.title.trim() || 'your project';

const learnerName = (session: ProjectHelpSessionDetailRecord) =>
  session.learner.displayName.trim() || 'A learner';

const authorName = (session: ProjectHelpSessionDetailRecord) =>
  session.author.displayName.trim() || 'The project author';

const baseMetadata = (session: ProjectHelpSessionDetailRecord) => ({
  sessionId: session.id,
  projectId: session.projectId,
  buildId: session.buildId,
  projectTitle: projectTitle(session),
});

const scheduledStartsAt = (session: ProjectHelpSessionDetailRecord) =>
  session.selectedTimeOption?.startsAt?.toISOString() ?? null;

export const notifyProjectHelpSessionRequested = async (
  session: ProjectHelpSessionDetailRecord,
) =>
  createNotification({
    userId: session.authorId,
    notificationType: 'PROJECT_HELP_SESSION_REQUESTED',
    title: 'New help session request',
    body: `${learnerName(session)} requested a help session for ${projectTitle(session)}.`,
    relatedEntityType: 'PROJECT_HELP_SESSION',
    relatedEntityId: session.id,
    eventKey: `help-session:requested:${session.id}:${session.authorId}`,
    entityType: 'PROJECT_HELP_SESSION',
    entityId: session.id,
    actionType: 'OPEN_PROJECT_HELP_SESSION',
    actorId: session.learnerId,
    metadata: {
      ...baseMetadata(session),
      actorDisplayName: learnerName(session),
      recipientRole: 'AUTHOR',
    },
  });

export const notifyProjectHelpSessionAlternativeProposed = async (
  session: ProjectHelpSessionDetailRecord,
) =>
  createNotification({
    userId: session.learnerId,
    notificationType: 'PROJECT_HELP_SESSION_ALTERNATIVE_PROPOSED',
    title: 'Alternative help session time proposed',
    body: `${authorName(session)} proposed a new time for your help session.`,
    relatedEntityType: 'PROJECT_HELP_SESSION',
    relatedEntityId: session.id,
    eventKey: `help-session:alternative-proposed:${session.id}:${session.learnerId}`,
    entityType: 'PROJECT_HELP_SESSION',
    entityId: session.id,
    actionType: 'OPEN_PROJECT_HELP_SESSION',
    actorId: session.authorId,
    metadata: {
      ...baseMetadata(session),
      actorDisplayName: authorName(session),
      recipientRole: 'LEARNER',
    },
  });

export const notifyProjectHelpSessionAcceptedByAuthor = async (
  session: ProjectHelpSessionDetailRecord,
) =>
  createNotification({
    userId: session.learnerId,
    notificationType: 'PROJECT_HELP_SESSION_ACCEPTED',
    title: 'Help session time accepted',
    body: `${authorName(session)} accepted your proposed help session time.`,
    relatedEntityType: 'PROJECT_HELP_SESSION',
    relatedEntityId: session.id,
    eventKey: `help-session:accepted:${session.id}:${session.learnerId}`,
    entityType: 'PROJECT_HELP_SESSION',
    entityId: session.id,
    actionType: 'OPEN_PROJECT_HELP_SESSION',
    actorId: session.authorId,
    metadata: {
      ...baseMetadata(session),
      actorDisplayName: authorName(session),
      recipientRole: 'LEARNER',
    },
  });

export const notifyProjectHelpSessionAlternativeAccepted = async (
  session: ProjectHelpSessionDetailRecord,
) =>
  createNotification({
    userId: session.authorId,
    notificationType: 'PROJECT_HELP_SESSION_ALTERNATIVE_ACCEPTED',
    title: 'Alternative help session time accepted',
    body: `${learnerName(session)} accepted your proposed help session time.`,
    relatedEntityType: 'PROJECT_HELP_SESSION',
    relatedEntityId: session.id,
    eventKey: `help-session:alternative-accepted:${session.id}:${session.authorId}`,
    entityType: 'PROJECT_HELP_SESSION',
    entityId: session.id,
    actionType: 'OPEN_PROJECT_HELP_SESSION',
    actorId: session.learnerId,
    metadata: {
      ...baseMetadata(session),
      actorDisplayName: learnerName(session),
      recipientRole: 'AUTHOR',
    },
  });

export const notifyProjectHelpSessionDeclined = async (
  session: ProjectHelpSessionDetailRecord,
) =>
  createNotification({
    userId: session.learnerId,
    notificationType: 'PROJECT_HELP_SESSION_DECLINED',
    title: 'Help session request declined',
    body: `${authorName(session)} declined your help session request.`,
    relatedEntityType: 'PROJECT_HELP_SESSION',
    relatedEntityId: session.id,
    eventKey: `help-session:declined:${session.id}:${session.learnerId}`,
    entityType: 'PROJECT_HELP_SESSION',
    entityId: session.id,
    actionType: 'OPEN_PROJECT_HELP_SESSION',
    actorId: session.authorId,
    metadata: {
      ...baseMetadata(session),
      actorDisplayName: authorName(session),
      recipientRole: 'LEARNER',
    },
  });

export const notifyProjectHelpSessionAlternativeRejected = async (
  session: ProjectHelpSessionDetailRecord,
) =>
  createNotification({
    userId: session.authorId,
    notificationType: 'PROJECT_HELP_SESSION_ALTERNATIVE_REJECTED',
    title: 'Alternative help session time rejected',
    body: `${learnerName(session)} rejected your proposed help session time.`,
    relatedEntityType: 'PROJECT_HELP_SESSION',
    relatedEntityId: session.id,
    eventKey: `help-session:alternative-rejected:${session.id}:${session.authorId}`,
    entityType: 'PROJECT_HELP_SESSION',
    entityId: session.id,
    actionType: 'OPEN_PROJECT_HELP_SESSION',
    actorId: session.learnerId,
    metadata: {
      ...baseMetadata(session),
      actorDisplayName: learnerName(session),
      recipientRole: 'AUTHOR',
    },
  });

export const notifyProjectHelpSessionZoomScheduled = async (
  session: ProjectHelpSessionDetailRecord,
) => {
  const startsAt = scheduledStartsAt(session);
  await Promise.all([
    createNotification({
      userId: session.learnerId,
      notificationType: 'PROJECT_HELP_SESSION_ZOOM_SCHEDULED',
      title: 'Help session scheduled',
      body: `Your help session for ${projectTitle(session)} is scheduled.`,
      relatedEntityType: 'PROJECT_HELP_SESSION',
      relatedEntityId: session.id,
      eventKey: `help-session:zoom-scheduled:${session.id}:${session.learnerId}`,
      entityType: 'PROJECT_HELP_SESSION',
      entityId: session.id,
      actionType: 'OPEN_PROJECT_HELP_SESSION',
      actorId: session.authorId,
      metadata: {
        ...baseMetadata(session),
        status: session.status,
        startsAt,
        recipientRole: 'LEARNER',
      },
    }),
    createNotification({
      userId: session.authorId,
      notificationType: 'PROJECT_HELP_SESSION_ZOOM_SCHEDULED',
      title: 'Help session scheduled',
      body: `Your help session for ${projectTitle(session)} is scheduled.`,
      relatedEntityType: 'PROJECT_HELP_SESSION',
      relatedEntityId: session.id,
      eventKey: `help-session:zoom-scheduled:${session.id}:${session.authorId}`,
      entityType: 'PROJECT_HELP_SESSION',
      entityId: session.id,
      actionType: 'OPEN_PROJECT_HELP_SESSION',
      actorId: session.learnerId,
      metadata: {
        ...baseMetadata(session),
        status: session.status,
        startsAt,
        recipientRole: 'AUTHOR',
      },
    }),
  ]);
};

export const notifyProjectHelpSessionZoomSchedulingFailed = async (
  session: ProjectHelpSessionDetailRecord,
) => {
  const startsAt = scheduledStartsAt(session);
  await Promise.all([
    createNotification({
      userId: session.authorId,
      notificationType: 'PROJECT_HELP_SESSION_ZOOM_SCHEDULING_FAILED',
      title: 'Help session meeting setup failed',
      body: `Meeting setup failed for ${projectTitle(session)}. Please retry scheduling.`,
      relatedEntityType: 'PROJECT_HELP_SESSION',
      relatedEntityId: session.id,
      eventKey: `help-session:zoom-scheduling-failed:${session.id}:${session.authorId}`,
      entityType: 'PROJECT_HELP_SESSION',
      entityId: session.id,
      actionType: 'OPEN_PROJECT_HELP_SESSION',
      actorId: null,
      metadata: {
        ...baseMetadata(session),
        status: session.status,
        startsAt,
        recipientRole: 'AUTHOR',
      },
    }),
    createNotification({
      userId: session.learnerId,
      notificationType: 'PROJECT_HELP_SESSION_ZOOM_SCHEDULING_DELAYED',
      title: 'Help session meeting setup delayed',
      body: `Meeting setup for your help session on ${projectTitle(session)} is delayed.`,
      relatedEntityType: 'PROJECT_HELP_SESSION',
      relatedEntityId: session.id,
      eventKey: `help-session:zoom-scheduling-delayed:${session.id}:${session.learnerId}`,
      entityType: 'PROJECT_HELP_SESSION',
      entityId: session.id,
      actionType: 'OPEN_PROJECT_HELP_SESSION',
      actorId: null,
      metadata: {
        ...baseMetadata(session),
        status: session.status,
        startsAt,
        recipientRole: 'LEARNER',
      },
    }),
  ]);
};

export const notifyProjectHelpSessionCompleted = async (
  session: ProjectHelpSessionDetailRecord,
) =>
  createNotification({
    userId: session.learnerId,
    notificationType: 'PROJECT_HELP_SESSION_COMPLETED',
    title: 'Help session completed',
    body: `Your help session for ${projectTitle(session)} is complete.`,
    relatedEntityType: 'PROJECT_HELP_SESSION',
    relatedEntityId: session.id,
    eventKey: `help-session:completed:${session.id}:${session.learnerId}`,
    entityType: 'PROJECT_HELP_SESSION',
    entityId: session.id,
    actionType: 'OPEN_PROJECT_HELP_SESSION',
    actorId: session.authorId,
    metadata: {
      ...baseMetadata(session),
      status: 'COMPLETED',
      completedAt: session.completedAt?.toISOString() ?? null,
      recipientRole: 'LEARNER',
    },
  });

export const notifyProjectHelpSessionCancelled = async (input: {
  session: ProjectHelpSessionDetailRecord;
  cancelledById: string;
}) => {
  const recipientId =
    input.cancelledById === input.session.learnerId
      ? input.session.authorId
      : input.session.learnerId;
  const actorName =
    input.cancelledById === input.session.learnerId
      ? learnerName(input.session)
      : authorName(input.session);

  const recipientRole =
    recipientId === input.session.authorId ? 'AUTHOR' : 'LEARNER';

  return createNotification({
    userId: recipientId,
    notificationType: 'PROJECT_HELP_SESSION_CANCELLED',
    title: 'Help session cancelled',
    body: `${actorName} cancelled the help session for ${projectTitle(input.session)}.`,
    relatedEntityType: 'PROJECT_HELP_SESSION',
    relatedEntityId: input.session.id,
    eventKey: `help-session:cancelled:${input.session.id}:${recipientId}:${input.cancelledById}`,
    entityType: 'PROJECT_HELP_SESSION',
    entityId: input.session.id,
    actionType: 'OPEN_PROJECT_HELP_SESSION',
    actorId: input.cancelledById,
    metadata: {
      ...baseMetadata(input.session),
      actorDisplayName: actorName,
      recipientRole,
    },
  });
};
