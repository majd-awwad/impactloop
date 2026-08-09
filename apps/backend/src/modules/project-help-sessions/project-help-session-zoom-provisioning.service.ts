import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

import {
  findProjectHelpSessionDetail,
  type ProjectHelpSessionDetailRecord,
} from './project-help-session.repository.js';
import { mapProjectHelpSessionPrivateDto } from './project-help-session.dto.js';
import type { ProjectHelpSessionViewerRole } from './project-help-session-actions.js';
import { getEffectiveOfferingForProject } from './project-help-session-offering.js';
import {
  countAuthorWeeklyCapacityUsage,
  findHostSlotConflicts,
} from './project-help-session.repository.js';
import { transitionProjectHelpSessionStatus } from './project-help-session-transition.service.js';
import { validateFutureUtcInstant } from './project-help-session-time.js';
import { getUtcIsoWeekStart } from './project-help-session-weekly-capacity.js';
import {
  notifyProjectHelpSessionZoomScheduled,
  notifyProjectHelpSessionZoomSchedulingFailed,
} from './project-help-session-notifications.js';
import { buildProjectHelpSessionZoomTopic } from './zoom/zoom-topic.js';
import { getZoomMeetingProvider } from './zoom/zoom-meeting-provider.factory.js';
import { isZoomError, type ZoomErrorCode } from './zoom/zoom-errors.js';
import { logZoomCleanupFailure } from './zoom/zoom-http-client.js';

const provisioningFlights = new Map<string, Promise<ProjectHelpSessionDetailRecord>>();

const notFoundHelpSession = () =>
  new AppError(
    'Help session not found.',
    404,
    COMMON_ERROR_CODES.notFound,
  );

const mapFailureCode = (error: unknown): ZoomErrorCode => {
  if (isZoomError(error)) {
    return error.code as ZoomErrorCode;
  }
  return 'ZOOM_CREATE_FAILED';
};

const persistSchedulingFailure = async (
  session: ProjectHelpSessionDetailRecord,
  failureCode: ZoomErrorCode,
) => {
  await runSerializableTransaction(async (tx) => {
    const current = await tx.projectHelpSession.findUnique({
      where: { id: session.id },
      select: { status: true },
    });
    if (!current || current.status !== 'ZOOM_PENDING') {
      return;
    }
    await transitionProjectHelpSessionStatus(tx, {
      sessionId: session.id,
      expectedStatuses: ['ZOOM_PENDING'],
      toStatus: 'SCHEDULING_FAILED',
      actorId: null,
      data: {
        zoomLastFailureCode: failureCode,
        zoomLastFailureAt: new Date(),
      },
      buildId: session.buildId,
    });
  });

  const failed = await findProjectHelpSessionDetail(session.id);
  if (failed?.status === 'SCHEDULING_FAILED') {
    await notifyProjectHelpSessionZoomSchedulingFailed(failed);
  }
  return failed;
};

const persistSchedulingSuccess = async (
  session: ProjectHelpSessionDetailRecord,
  input: {
    meetingId: string;
    joinUrl: string;
    zoomCreatedAt: Date;
  },
) => {
  let transitioned = false;
  await runSerializableTransaction(async (tx) => {
    const current = await tx.projectHelpSession.findUnique({
      where: { id: session.id },
      select: { status: true },
    });
    if (!current) {
      throw notFoundHelpSession();
    }
    if (current.status === 'SCHEDULED') {
      return;
    }
    if (current.status !== 'ZOOM_PENDING') {
      return;
    }
    await transitionProjectHelpSessionStatus(tx, {
      sessionId: session.id,
      expectedStatuses: ['ZOOM_PENDING'],
      toStatus: 'SCHEDULED',
      actorId: null,
      data: {
        zoomMeetingId: input.meetingId,
        zoomJoinUrl: input.joinUrl,
        zoomCreatedAt: input.zoomCreatedAt,
        zoomLastFailureCode: null,
        zoomLastFailureAt: null,
      },
      buildId: session.buildId,
    });
    transitioned = true;
  });

  const scheduled = await findProjectHelpSessionDetail(session.id);
  if (!scheduled) {
    throw new AppError(
      'Help session not found.',
      500,
      COMMON_ERROR_CODES.internalError,
    );
  }
  if (transitioned && scheduled.status === 'SCHEDULED') {
    await notifyProjectHelpSessionZoomScheduled(scheduled);
  }
  return scheduled;
};

const reconcileExistingMeeting = async (session: ProjectHelpSessionDetailRecord) => {
  if (!session.zoomMeetingId || !session.zoomJoinUrl) {
    return session;
  }
  if (session.status === 'SCHEDULED') {
    return session;
  }
  if (session.status !== 'ZOOM_PENDING') {
    return session;
  }
  return persistSchedulingSuccess(session, {
    meetingId: session.zoomMeetingId,
    joinUrl: session.zoomJoinUrl,
    zoomCreatedAt: session.zoomCreatedAt ?? new Date(),
  });
};

const executeEnsureZoomMeeting = async (
  sessionId: string,
): Promise<ProjectHelpSessionDetailRecord> => {
  const session = await findProjectHelpSessionDetail(sessionId);
  if (!session) {
    throw notFoundHelpSession();
  }

  if (session.status === 'SCHEDULED' && session.zoomMeetingId && session.zoomJoinUrl) {
    return session;
  }

  if (session.status === 'SCHEDULING_FAILED') {
    return session;
  }

  if (session.status !== 'ZOOM_PENDING') {
    return session;
  }

  if (!session.selectedTimeOptionId || !session.confirmedAt || !session.selectedTimeOption) {
    throw new AppError(
      'Help session is not ready for Zoom provisioning.',
      409,
      'HELP_SESSION_INVALID_STATE',
    );
  }

  if (!validateFutureUtcInstant(session.selectedTimeOption.startsAt)) {
    const failed = await persistSchedulingFailure(session, 'ZOOM_CREATE_FAILED');
    return failed ?? session;
  }

  if (session.zoomMeetingId && session.zoomJoinUrl) {
    return reconcileExistingMeeting(session);
  }

  const provider = getZoomMeetingProvider();
  let created;
  try {
    created = await provider.createMeeting({
      topic: buildProjectHelpSessionZoomTopic(session.project.title),
      startsAt: session.selectedTimeOption.startsAt,
      durationMinutes: session.durationMinutes as 15 | 30,
      agenda: 'ImpactLoop project help session.',
    });
  } catch (error) {
    const failed = await persistSchedulingFailure(session, mapFailureCode(error));
    return failed ?? session;
  }

  try {
    return await persistSchedulingSuccess(session, {
      meetingId: created.meetingId,
      joinUrl: created.joinUrl,
      zoomCreatedAt: new Date(),
    });
  } catch {
    try {
      await provider.deleteMeeting(created.meetingId);
    } catch (cleanupError) {
      logZoomCleanupFailure({
        sessionId: session.id,
        meetingId: created.meetingId,
        errorCode: mapFailureCode(cleanupError),
      });
    }
    const failed = await persistSchedulingFailure(session, 'ZOOM_PERSISTENCE_FAILED');
    return failed ?? session;
  }
};

export const resetZoomProvisioningFlightsForTests = () => {
  provisioningFlights.clear();
};

export const ensureZoomMeetingForProjectHelpSession = async (
  sessionId: string,
  viewerRole: ProjectHelpSessionViewerRole,
  userId: string,
) => {
  const authorized =
    viewerRole === 'learner'
      ? await prisma.projectHelpSession.findFirst({
          where: { id: sessionId, learnerId: userId },
          select: { id: true },
        })
      : await prisma.projectHelpSession.findFirst({
          where: { id: sessionId, authorId: userId },
          select: { id: true },
        });
  if (!authorized) {
    throw notFoundHelpSession();
  }

  if (!provisioningFlights.has(sessionId)) {
    provisioningFlights.set(
      sessionId,
      executeEnsureZoomMeeting(sessionId).finally(() => {
        provisioningFlights.delete(sessionId);
      }),
    );
  }

  const updated = await provisioningFlights.get(sessionId)!;
  return mapProjectHelpSessionPrivateDto(updated, viewerRole);
};

export const retryZoomProvisioningForAuthor = async (
  authorId: string,
  sessionId: string,
) => {
  const session = await findProjectHelpSessionDetail(sessionId);
  if (!session || session.authorId !== authorId) {
    throw notFoundHelpSession();
  }

  if (session.status === 'SCHEDULED') {
    return mapProjectHelpSessionPrivateDto(session, 'author');
  }

  if (session.status !== 'SCHEDULING_FAILED') {
    throw new AppError(
      'Help session is not in a valid state for this action.',
      409,
      'HELP_SESSION_INVALID_STATE',
    );
  }

  if (!session.selectedTimeOption || !session.confirmedAt) {
    throw new AppError(
      'Help session is not ready for Zoom retry.',
      409,
      'HELP_SESSION_INVALID_STATE',
    );
  }

  if (!validateFutureUtcInstant(session.selectedTimeOption.startsAt)) {
    throw new AppError('Selected time is no longer valid.', 409, 'INVALID_TIME_OPTIONS');
  }

  const offering = await getEffectiveOfferingForProject(session.projectId);
  await runSerializableTransaction(async (tx) => {
    const weekStart = getUtcIsoWeekStart(session.selectedTimeOption!.startsAt);
    const usage = await countAuthorWeeklyCapacityUsage(
      {
        authorId: session.authorId,
        weekStart,
        excludeSessionId: session.id,
      },
      tx,
    );
    if (usage >= offering.weeklyLimit) {
      throw new AppError(
        'Weekly help session limit reached for the selected week.',
        409,
        'WEEKLY_LIMIT_REACHED',
      );
    }
    const conflicts = await findHostSlotConflicts(
      {
        startsAt: session.selectedTimeOption!.startsAt,
        durationMinutes: session.durationMinutes,
        excludeSessionId: session.id,
      },
      tx,
    );
    if (conflicts.length > 0) {
      throw new AppError(
        'The selected time slot is no longer available.',
        409,
        'TIME_SLOT_UNAVAILABLE',
      );
    }

    if (session.zoomMeetingId && session.zoomJoinUrl) {
      await transitionProjectHelpSessionStatus(tx, {
        sessionId,
        expectedStatuses: ['SCHEDULING_FAILED'],
        toStatus: 'SCHEDULED',
        actorId: authorId,
        data: {
          zoomLastFailureCode: null,
          zoomLastFailureAt: null,
        },
        buildId: session.buildId,
      });
      return;
    }

    await transitionProjectHelpSessionStatus(tx, {
      sessionId,
      expectedStatuses: ['SCHEDULING_FAILED'],
      toStatus: 'ZOOM_PENDING',
      actorId: authorId,
      data: {
        zoomLastFailureCode: null,
        zoomLastFailureAt: null,
      },
      buildId: session.buildId,
    });
  });

  const refreshed = await findProjectHelpSessionDetail(sessionId);
  if (!refreshed) {
    throw notFoundHelpSession();
  }
  if (refreshed.status === 'SCHEDULED') {
    return mapProjectHelpSessionPrivateDto(refreshed, 'author');
  }

  return ensureZoomMeetingForProjectHelpSession(sessionId, 'author', authorId);
};
