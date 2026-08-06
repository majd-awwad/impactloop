import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { isPrismaCode, runSerializableTransaction } from '../../utils/transaction-retry.js';

import { resolveProjectHelpSessionAuthor } from './project-help-session-author.js';
import { getEffectiveOfferingForProject } from './project-help-session-offering.js';
import {
  notifyProjectHelpSessionAcceptedByAuthor,
  notifyProjectHelpSessionAlternativeAccepted,
  notifyProjectHelpSessionAlternativeProposed,
  notifyProjectHelpSessionAlternativeRejected,
  notifyProjectHelpSessionCancelled,
  notifyProjectHelpSessionCompleted,
  notifyProjectHelpSessionDeclined,
  notifyProjectHelpSessionRequested,
} from './project-help-session-notifications.js';
import { getProjectHelpSessionNow, setProjectHelpSessionNowForTests } from './project-help-session-clock.js';
import { deriveProjectHelpSessionCompletionState } from './project-help-session-completion.js';
import {
  HELP_SESSION_INVALID_STATE,
  transitionProjectHelpSessionStatus,
} from './project-help-session-transition.service.js';
import {
  countAuthorWeeklyCapacityUsage,
  findAuthorProjectHelpSessionDetail,
  findHostSlotConflicts,
  findLearnerProjectHelpSessionDetail,
  findProjectHelpSessionDetail,
  getAuthorAlternativeOption,
  hasAuthorAlternativeOption,
  listAuthorProjectHelpSessions,
  listLearnerProjectHelpSessions,
} from './project-help-session.repository.js';
import { mapProjectHelpSessionListResponse, mapProjectHelpSessionPrivateDto } from './project-help-session.dto.js';
import { buildProjectHelpSessionActiveKey } from './project-help-session-status.js';
import { ensureZoomMeetingForProjectHelpSession } from './project-help-session-zoom-provisioning.service.js';
import { deleteZoomMeetingForSession } from './project-help-session-zoom.service.js';
import { isZoomError } from './zoom/zoom-errors.js';
import {
  parseUtcInstant,
  PROJECT_HELP_SESSION_ALLOWED_DURATIONS,
  PROJECT_HELP_SESSION_MAX_REASON_LENGTH,
  validateFutureUtcInstant,
  validateProblemDescription,
} from './project-help-session-time.js';
import { getUtcIsoWeekStart } from './project-help-session-weekly-capacity.js';
import type { ProjectHelpSessionStatus } from '../../generated/prisma/client.js';
import type { CreateProjectHelpSessionRequestInput } from './project-help-session.validation.js';

const ELIGIBLE_BUILD_STATUSES = ['IN_PROGRESS', 'PAUSED'] as const;

const notFoundHelpSession = () =>
  new AppError('Help session not found.', 404, 'NOT_FOUND');

export const PROJECT_HELP_SESSION_NOT_FOUND = 'PROJECT_HELP_SESSION_NOT_FOUND';
export const SESSION_NOT_COMPLETABLE_YET = 'SESSION_NOT_COMPLETABLE_YET';
export const INVALID_SESSION_STATE = 'INVALID_SESSION_STATE';

const notFoundHelpSessionForCompletion = () =>
  new AppError('Help session not found.', 404, PROJECT_HELP_SESSION_NOT_FOUND);

export { setProjectHelpSessionNowForTests };

const notFoundBuild = () =>
  new AppError('Project build not found.', 404, 'NOT_FOUND');

const loadEnabledOffering = async (projectId: string) => {
  const stored = await prisma.projectHelpSessionOffering.findUnique({
    where: { projectId },
  });
  if (!stored?.isEnabled) {
    throw new AppError(
      'Help sessions are not enabled for this project.',
      409,
      'HELP_SESSIONS_DISABLED',
    );
  }
  return stored;
};

const assertDurationAllowed = (
  durationMinutes: number,
  offering: { allow15Minutes: boolean; allow30Minutes: boolean },
) => {
  if (
    !PROJECT_HELP_SESSION_ALLOWED_DURATIONS.includes(
      durationMinutes as (typeof PROJECT_HELP_SESSION_ALLOWED_DURATIONS)[number],
    )
  ) {
    throw new AppError('Invalid session duration.', 400, 'DURATION_NOT_ALLOWED');
  }
  if (durationMinutes === 15 && !offering.allow15Minutes) {
    throw new AppError('15-minute sessions are not enabled.', 409, 'DURATION_NOT_ALLOWED');
  }
  if (durationMinutes === 30 && !offering.allow30Minutes) {
    throw new AppError('30-minute sessions are not enabled.', 409, 'DURATION_NOT_ALLOWED');
  }
};

const assertWeeklyCapacity = async (
  tx: Prisma.TransactionClient,
  input: {
    authorId: string;
    startsAt: Date;
    weeklyLimit: number;
    excludeSessionId?: string;
  },
) => {
  const weekStart = getUtcIsoWeekStart(input.startsAt);
  const usage = await countAuthorWeeklyCapacityUsage(
    {
      authorId: input.authorId,
      weekStart,
      excludeSessionId: input.excludeSessionId,
    },
    tx,
  );
  if (usage >= input.weeklyLimit) {
    throw new AppError(
      'Weekly help session limit reached for the selected week.',
      409,
      'WEEKLY_LIMIT_REACHED',
    );
  }
};

const assertHostSlotAvailable = async (
  tx: Prisma.TransactionClient,
  input: {
    startsAt: Date;
    durationMinutes: number;
    excludeSessionId?: string;
  },
) => {
  const conflicts = await findHostSlotConflicts(input, tx);
  if (conflicts.length > 0) {
    throw new AppError(
      'The selected time slot is no longer available.',
      409,
      'TIME_SLOT_UNAVAILABLE',
    );
  }
};

const confirmSessionTime = async (
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    expectedStatuses: Array<'PENDING' | 'ALTERNATIVE_PROPOSED'>;
    actorId: string;
    timeOptionId: string;
    weeklyLimit: number;
    authorId: string;
    durationMinutes: number;
  },
) => {
  const session = await tx.projectHelpSession.findUnique({
    where: { id: input.sessionId },
    include: {
      timeOptions: true,
    },
  });
  if (!session) {
    throw notFoundHelpSession();
  }

  if (session.status === 'ZOOM_PENDING') {
    if (session.selectedTimeOptionId === input.timeOptionId) {
      return session;
    }
    throw new AppError(
      'Help session is not in a valid state for this action.',
      409,
      'HELP_SESSION_INVALID_STATE',
    );
  }

  const option = session.timeOptions.find((item) => item.id === input.timeOptionId);
  if (!option || option.sessionId !== input.sessionId) {
    throw new AppError('Time option not found.', 404, 'NOT_FOUND');
  }

  if (!validateFutureUtcInstant(option.startsAt)) {
    throw new AppError('Selected time is no longer valid.', 409, 'INVALID_TIME_OPTIONS');
  }

  await assertWeeklyCapacity(tx, {
    authorId: input.authorId,
    startsAt: option.startsAt,
    weeklyLimit: input.weeklyLimit,
    excludeSessionId: input.sessionId,
  });
  await assertHostSlotAvailable(tx, {
    startsAt: option.startsAt,
    durationMinutes: input.durationMinutes,
    excludeSessionId: input.sessionId,
  });

  const confirmedAt = new Date();
  await transitionProjectHelpSessionStatus(tx, {
    sessionId: input.sessionId,
    expectedStatuses: input.expectedStatuses,
    toStatus: 'ZOOM_PENDING',
    actorId: input.actorId,
    data: {
      selectedTimeOption: { connect: { id: input.timeOptionId } },
      confirmedAt,
    },
    buildId: session.buildId,
  });

  return tx.projectHelpSession.findUniqueOrThrow({
    where: { id: input.sessionId },
  });
};

export const createProjectHelpSessionRequest = async (
  learnerId: string,
  buildId: string,
  input: CreateProjectHelpSessionRequestInput,
) => {
  const problem = validateProblemDescription(input.problemDescription);
  if (!problem.valid) {
    throw new AppError(problem.message, 400, problem.code);
  }

  const build = await prisma.projectBuild.findUnique({
    where: { id: buildId },
    select: {
      id: true,
      projectId: true,
      learnerId: true,
      status: true,
    },
  });
  if (!build || build.learnerId !== learnerId) {
    throw notFoundBuild();
  }
  if (
    !ELIGIBLE_BUILD_STATUSES.includes(
      build.status as (typeof ELIGIBLE_BUILD_STATUSES)[number],
    )
  ) {
    throw new AppError(
      'This build is not eligible for help sessions.',
      409,
      'BUILD_NOT_ELIGIBLE',
    );
  }

  const author = await resolveProjectHelpSessionAuthor(build.projectId);
  if (!author.available) {
    throw new AppError(
      'Help session author is unavailable.',
      409,
      'AUTHOR_UNAVAILABLE',
    );
  }
  if (author.authorId === learnerId) {
    throw new AppError(
      'Project authors cannot request help sessions on their own projects.',
      409,
      'BUILD_NOT_ELIGIBLE',
    );
  }

  const offering = await loadEnabledOffering(build.projectId);
  assertDurationAllowed(input.durationMinutes, offering);

  if (input.projectStepId) {
    const step = await prisma.projectStep.findFirst({
      where: {
        id: input.projectStepId,
        projectId: build.projectId,
      },
      select: { id: true },
    });
    if (!step) {
      throw new AppError('Project step not found.', 404, 'NOT_FOUND');
    }
  }

  const activeKey = buildProjectHelpSessionActiveKey(build.id);

  try {
    const sessionId = await runSerializableTransaction(async (tx) => {
      const existing = await tx.projectHelpSession.findFirst({
        where: { buildId: build.id, activeKey },
        select: { id: true },
      });
      if (existing) {
        throw new AppError(
          'An active help session already exists for this build.',
          409,
          'ACTIVE_SESSION_EXISTS',
        );
      }

      const session = await tx.projectHelpSession.create({
        data: {
          projectId: build.projectId,
          buildId: build.id,
          learnerId,
          authorId: author.authorId,
          projectStepId: input.projectStepId ?? null,
          problemDescription: problem.value,
          durationMinutes: input.durationMinutes,
          learnerTimeZone: input.learnerTimeZone,
          status: 'PENDING',
          activeKey,
          timeOptions: {
            create: input.proposedTimes.map((startsAt) => ({
              proposedById: learnerId,
              startsAt,
              proposalType: 'LEARNER_PROPOSED',
            })),
          },
          statusHistory: {
            create: {
              fromStatus: null,
              toStatus: 'PENDING',
              actorId: learnerId,
            },
          },
        },
      });

      return session.id;
    });

    const session = await findProjectHelpSessionDetail(sessionId);
    if (!session) {
      throw new AppError('Help session not found.', 500, 'INTERNAL_ERROR');
    }
    await notifyProjectHelpSessionRequested(session);
    return mapProjectHelpSessionPrivateDto(session, 'learner');
  } catch (error) {
    if (isPrismaCode(error, 'P2002')) {
      throw new AppError(
        'An active help session already exists for this build.',
        409,
        'ACTIVE_SESSION_EXISTS',
      );
    }
    throw error;
  }
};

export const authorAcceptProjectHelpSessionOption = async (
  authorId: string,
  sessionId: string,
  timeOptionId: string,
) => {
  const session = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!session) {
    throw notFoundHelpSession();
  }

  if (
    (session.status === 'ZOOM_PENDING' || session.status === 'SCHEDULED') &&
    session.selectedTimeOptionId === timeOptionId
  ) {
    if (session.status === 'ZOOM_PENDING') {
      return ensureZoomMeetingForProjectHelpSession(sessionId, 'author', authorId);
    }
    return mapProjectHelpSessionPrivateDto(session, 'author');
  }

  const option = session.timeOptions.find((item) => item.id === timeOptionId);
  if (!option || option.proposalType !== 'LEARNER_PROPOSED') {
    throw new AppError('Time option not found.', 404, 'NOT_FOUND');
  }

  const offering = await getEffectiveOfferingForProject(session.projectId);
  const priorStatus = session.status;

  await runSerializableTransaction(async (tx) => {
    await confirmSessionTime(tx, {
      sessionId,
      expectedStatuses: ['PENDING'],
      actorId: authorId,
      timeOptionId,
      weeklyLimit: offering.weeklyLimit,
      authorId: session.authorId,
      durationMinutes: session.durationMinutes,
    });
  });

  const updated = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!updated) {
    throw notFoundHelpSession();
  }
  if (priorStatus !== 'ZOOM_PENDING' && updated.status === 'ZOOM_PENDING') {
    await notifyProjectHelpSessionAcceptedByAuthor(updated);
  }
  return ensureZoomMeetingForProjectHelpSession(sessionId, 'author', authorId);
};

export const authorProposeProjectHelpSessionAlternative = async (
  authorId: string,
  sessionId: string,
  startsAtInput: string,
) => {
  const session = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!session) {
    throw notFoundHelpSession();
  }
  if (session.status === 'ALTERNATIVE_PROPOSED') {
    return mapProjectHelpSessionPrivateDto(session, 'author');
  }
  if (hasAuthorAlternativeOption(session)) {
    throw new AppError(
      'An alternative time was already proposed for this session.',
      409,
      'HELP_SESSION_ALTERNATIVE_ALREADY_PROPOSED',
    );
  }

  const startsAt = parseUtcInstant(startsAtInput);
  if (!startsAt || !validateFutureUtcInstant(startsAt)) {
    throw new AppError('Alternative time is invalid.', 400, 'INVALID_TIME_OPTIONS');
  }

  const priorStatus = session.status;

  await runSerializableTransaction(async (tx) => {
    const current = await tx.projectHelpSession.findUnique({
      where: { id: sessionId },
      include: { timeOptions: true },
    });
    if (!current) {
      throw notFoundHelpSession();
    }
    if (current.status === 'ALTERNATIVE_PROPOSED') {
      return;
    }
    if (hasAuthorAlternativeOption(current)) {
      throw new AppError(
        'An alternative time was already proposed for this session.',
        409,
        'HELP_SESSION_ALTERNATIVE_ALREADY_PROPOSED',
      );
    }

    await tx.projectHelpSessionTimeOption.create({
      data: {
        sessionId,
        proposedById: authorId,
        startsAt,
        proposalType: 'AUTHOR_ALTERNATIVE',
      },
    });

    await transitionProjectHelpSessionStatus(tx, {
      sessionId,
      expectedStatuses: ['PENDING'],
      toStatus: 'ALTERNATIVE_PROPOSED',
      actorId: authorId,
      data: {
        alternativeProposedAt: new Date(),
      },
      buildId: session.buildId,
    });
  });

  const updated = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!updated) {
    throw notFoundHelpSession();
  }
  if (priorStatus === 'PENDING' && updated.status === 'ALTERNATIVE_PROPOSED') {
    await notifyProjectHelpSessionAlternativeProposed(updated);
  }
  return mapProjectHelpSessionPrivateDto(updated, 'author');
};

export const authorDeclineProjectHelpSession = async (
  authorId: string,
  sessionId: string,
  reason?: string | null,
) => {
  const session = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!session) {
    throw notFoundHelpSession();
  }
  if (session.status === 'DECLINED') {
    return mapProjectHelpSessionPrivateDto(session, 'author');
  }

  const trimmedReason = reason?.trim() || null;
  if (trimmedReason && trimmedReason.length > PROJECT_HELP_SESSION_MAX_REASON_LENGTH) {
    throw new AppError('Decline reason is too long.', 400, 'VALIDATION_ERROR');
  }

  await runSerializableTransaction(async (tx) => {
    await transitionProjectHelpSessionStatus(tx, {
      sessionId,
      expectedStatuses: ['PENDING'],
      toStatus: 'DECLINED',
      actorId: authorId,
      reason: trimmedReason,
      data: {
        declinedAt: new Date(),
        declinedReason: trimmedReason,
      },
      buildId: session.buildId,
    });
  });

  const updated = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!updated) {
    throw notFoundHelpSession();
  }
  await notifyProjectHelpSessionDeclined(updated);
  return mapProjectHelpSessionPrivateDto(updated, 'author');
};

export const learnerAcceptProjectHelpSessionAlternative = async (
  learnerId: string,
  sessionId: string,
) => {
  const session = await findLearnerProjectHelpSessionDetail(sessionId, learnerId);
  if (!session) {
    throw notFoundHelpSession();
  }

  const alternative = getAuthorAlternativeOption(session);
  if (!alternative) {
    throw new AppError('Alternative time not found.', 404, 'NOT_FOUND');
  }

  if (
    (session.status === 'ZOOM_PENDING' || session.status === 'SCHEDULED') &&
    session.selectedTimeOptionId === alternative.id
  ) {
    if (session.status === 'ZOOM_PENDING') {
      return ensureZoomMeetingForProjectHelpSession(sessionId, 'learner', learnerId);
    }
    return mapProjectHelpSessionPrivateDto(session, 'learner');
  }

  const offering = await getEffectiveOfferingForProject(session.projectId);

  const priorStatus = session.status;

  await runSerializableTransaction(async (tx) => {
    await confirmSessionTime(tx, {
      sessionId,
      expectedStatuses: ['ALTERNATIVE_PROPOSED'],
      actorId: learnerId,
      timeOptionId: alternative.id,
      weeklyLimit: offering.weeklyLimit,
      authorId: session.authorId,
      durationMinutes: session.durationMinutes,
    });
  });

  const updated = await findLearnerProjectHelpSessionDetail(sessionId, learnerId);
  if (!updated) {
    throw notFoundHelpSession();
  }
  if (
    priorStatus !== 'ZOOM_PENDING' &&
    updated.status === 'ZOOM_PENDING' &&
    updated.selectedTimeOptionId === alternative.id
  ) {
    await notifyProjectHelpSessionAlternativeAccepted(updated);
  }
  return ensureZoomMeetingForProjectHelpSession(sessionId, 'learner', learnerId);
};

export const learnerRejectProjectHelpSessionAlternative = async (
  learnerId: string,
  sessionId: string,
) => {
  const session = await findLearnerProjectHelpSessionDetail(sessionId, learnerId);
  if (!session) {
    throw notFoundHelpSession();
  }
  if (session.status === 'CANCELLED') {
    return mapProjectHelpSessionPrivateDto(session, 'learner');
  }

  await runSerializableTransaction(async (tx) => {
    await transitionProjectHelpSessionStatus(tx, {
      sessionId,
      expectedStatuses: ['ALTERNATIVE_PROPOSED'],
      toStatus: 'CANCELLED',
      actorId: learnerId,
      reason: 'ALTERNATIVE_REJECTED',
      data: {
        cancelledBy: { connect: { id: learnerId } },
        cancellationReason: 'ALTERNATIVE_REJECTED',
        cancelledAt: new Date(),
      },
      buildId: session.buildId,
    });
  });

  const updated = await findLearnerProjectHelpSessionDetail(sessionId, learnerId);
  if (!updated) {
    throw notFoundHelpSession();
  }
  await notifyProjectHelpSessionAlternativeRejected(updated);
  return mapProjectHelpSessionPrivateDto(updated, 'learner');
};

export const cancelProjectHelpSession = async (input: {
  sessionId: string;
  actorId: string;
  actorRole: 'learner' | 'author';
  reason?: string | null;
}) => {
  const session =
    input.actorRole === 'learner'
      ? await findLearnerProjectHelpSessionDetail(input.sessionId, input.actorId)
      : await findAuthorProjectHelpSessionDetail(input.sessionId, input.actorId);
  if (!session) {
    throw notFoundHelpSession();
  }
  if (session.status === 'CANCELLED') {
    return mapProjectHelpSessionPrivateDto(
      session,
      input.actorRole === 'learner' ? 'learner' : 'author',
    );
  }

  const trimmedReason = input.reason?.trim() || null;
  const requiresReason =
    session.status === 'ZOOM_PENDING' ||
    session.status === 'SCHEDULING_FAILED' ||
    session.status === 'SCHEDULED';
  if (requiresReason && !trimmedReason) {
    throw new AppError('Cancellation reason is required.', 400, 'VALIDATION_ERROR');
  }
  if (trimmedReason && trimmedReason.length > PROJECT_HELP_SESSION_MAX_REASON_LENGTH) {
    throw new AppError('Cancellation reason is too long.', 400, 'VALIDATION_ERROR');
  }

  if (session.status === 'SCHEDULED' && session.zoomMeetingId) {
    try {
      await deleteZoomMeetingForSession(session.zoomMeetingId);
    } catch (error) {
      if (isZoomError(error) && error.code === 'ZOOM_MEETING_NOT_FOUND') {
        // idempotent delete success
      } else {
        throw new AppError(
          'Unable to delete Zoom meeting for this session.',
          isZoomError(error) && error.code === 'ZOOM_RATE_LIMITED' ? 429 : 502,
          'ZOOM_DELETE_FAILED',
        );
      }
    }
  }

  await runSerializableTransaction(async (tx) => {
    await transitionProjectHelpSessionStatus(tx, {
      sessionId: input.sessionId,
      expectedStatuses: [
        'PENDING',
        'ALTERNATIVE_PROPOSED',
        'ZOOM_PENDING',
        'SCHEDULING_FAILED',
        'SCHEDULED',
      ],
      toStatus: 'CANCELLED',
      actorId: input.actorId,
      reason: trimmedReason,
      data: {
        cancelledBy: { connect: { id: input.actorId } },
        cancellationReason: trimmedReason,
        cancelledAt: new Date(),
        ...(session.status === 'SCHEDULED' ? { zoomJoinUrl: null } : {}),
      },
      buildId: session.buildId,
    });
  });

  const updated = await findProjectHelpSessionDetail(input.sessionId);
  if (!updated) {
    throw notFoundHelpSession();
  }
  await notifyProjectHelpSessionCancelled({
    session: updated,
    cancelledById: input.actorId,
  });
  return mapProjectHelpSessionPrivateDto(
    updated,
    input.actorRole === 'learner' ? 'learner' : 'author',
  );
};

export const authorCompleteProjectHelpSession = async (
  authorId: string,
  sessionId: string,
) => {
  const session = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!session) {
    throw notFoundHelpSessionForCompletion();
  }

  if (session.status === 'COMPLETED') {
    return mapProjectHelpSessionPrivateDto(session, 'author');
  }

  const now = getProjectHelpSessionNow();
  const completionState = deriveProjectHelpSessionCompletionState(session, now);

  if (session.status !== 'SCHEDULED') {
    throw new AppError(
      'Help session is not in a valid state for this action.',
      409,
      INVALID_SESSION_STATE,
      { currentStatus: session.status },
    );
  }

  if (!completionState.isCompletable) {
    throw new AppError(
      'The session can be completed after its scheduled end time.',
      409,
      SESSION_NOT_COMPLETABLE_YET,
    );
  }

  let transitioned = false;

  try {
    await runSerializableTransaction(async (tx) => {
      const current = await tx.projectHelpSession.findUnique({
        where: { id: sessionId },
        select: { status: true },
      });
      if (current?.status === 'COMPLETED') {
        return;
      }

      await transitionProjectHelpSessionStatus(tx, {
        sessionId,
        expectedStatuses: ['SCHEDULED'],
        toStatus: 'COMPLETED',
        actorId: authorId,
        reason: null,
        data: {
          completedAt: now,
          zoomJoinUrl: null,
        },
        buildId: session.buildId,
      });
      transitioned = true;
    });
  } catch (error) {
    if (error instanceof AppError && error.code === HELP_SESSION_INVALID_STATE) {
      const refreshed = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
      if (refreshed?.status === 'COMPLETED') {
        return mapProjectHelpSessionPrivateDto(refreshed, 'author');
      }
      throw new AppError(
        'Help session is not in a valid state for this action.',
        409,
        INVALID_SESSION_STATE,
      );
    }
    throw error;
  }

  const updated = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!updated) {
    throw notFoundHelpSessionForCompletion();
  }

  if (transitioned) {
    await notifyProjectHelpSessionCompleted(updated);
  }

  return mapProjectHelpSessionPrivateDto(updated, 'author');
};

export const getLearnerProjectHelpSession = async (
  learnerId: string,
  sessionId: string,
) => {
  const session = await findLearnerProjectHelpSessionDetail(sessionId, learnerId);
  if (!session) {
    throw notFoundHelpSession();
  }
  return mapProjectHelpSessionPrivateDto(session, 'learner');
};

export const getAuthorProjectHelpSession = async (
  authorId: string,
  sessionId: string,
) => {
  const session = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!session) {
    throw notFoundHelpSession();
  }
  return mapProjectHelpSessionPrivateDto(session, 'author');
};

export const listLearnerProjectHelpSessionViews = async (input: {
  learnerId: string;
  status?: ProjectHelpSessionStatus;
  page: number;
  limit: number;
}) =>
  mapProjectHelpSessionListResponse({
    ...(await listLearnerProjectHelpSessions(input)),
    viewerRole: 'learner',
  });

export const listAuthorProjectHelpSessionViews = async (input: {
  authorId: string;
  status?: ProjectHelpSessionStatus;
  projectId?: string;
  page: number;
  limit: number;
}) =>
  mapProjectHelpSessionListResponse({
    ...(await listAuthorProjectHelpSessions(input)),
    viewerRole: 'author',
  });
