import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { AppError } from '../../utils/app-error.js';

import {
  findAuthorProjectHelpSessionDetail,
  findLearnerProjectHelpSessionDetail,
} from './project-help-session.repository.js';
import { computeProjectHelpSessionMeetingWindow } from './project-help-session-zoom-windows.js';
import { getZoomMeetingProvider } from './zoom/zoom-meeting-provider.factory.js';

const notFoundHelpSession = () =>
  new AppError('Help session not found.', 404, COMMON_ERROR_CODES.notFound);

const invalidSessionState = () =>
  new AppError(
    'Help session is not in a valid state for this action.',
    409,
    'HELP_SESSION_INVALID_STATE',
  );

const zoomNotReady = () =>
  new AppError('Zoom meeting is not ready.', 409, 'ZOOM_NOT_READY');

const loadScheduledSessionForLearner = async (
  learnerId: string,
  sessionId: string,
) => {
  const session = await findLearnerProjectHelpSessionDetail(sessionId, learnerId);
  if (!session) {
    throw notFoundHelpSession();
  }
  if (session.status !== 'SCHEDULED' || !session.selectedTimeOption) {
    throw invalidSessionState();
  }
  if (!session.zoomJoinUrl) {
    throw zoomNotReady();
  }
  return session;
};

const loadScheduledSessionForAuthor = async (
  authorId: string,
  sessionId: string,
) => {
  const session = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!session) {
    throw notFoundHelpSession();
  }
  if (session.status !== 'SCHEDULED' || !session.selectedTimeOption) {
    throw invalidSessionState();
  }
  if (!session.zoomJoinUrl) {
    throw zoomNotReady();
  }
  return session;
};

const assertMeetingWindow = (
  session: {
    selectedTimeOption: { startsAt: Date } | null;
    durationMinutes: number;
  },
  now?: Date,
) => {
  if (!session.selectedTimeOption) {
    throw invalidSessionState();
  }
  const window = computeProjectHelpSessionMeetingWindow({
    startsAt: session.selectedTimeOption.startsAt,
    durationMinutes: session.durationMinutes,
    now,
  });
  if (window.isBeforeWindow) {
    throw new AppError(
      'Help session is not open yet.',
      409,
      'SESSION_NOT_JOINABLE_YET',
    );
  }
  if (window.isAfterWindow) {
    throw new AppError(
      'Help session window has closed.',
      409,
      'SESSION_JOIN_WINDOW_CLOSED',
    );
  }
};

const mapPrivateJoinCapability = (session: {
  zoomJoinUrl: string | null;
  selectedTimeOption: { startsAt: Date } | null;
  durationMinutes: number;
}) => ({
  joinUrl: session.zoomJoinUrl!,
  startsAt: session.selectedTimeOption!.startsAt.toISOString(),
  durationMinutes: session.durationMinutes,
});

export const getLearnerProjectHelpSessionZoomJoin = async (
  learnerId: string,
  sessionId: string,
  now?: Date,
) => {
  const session = await loadScheduledSessionForLearner(learnerId, sessionId);
  assertMeetingWindow(session, now);
  return mapPrivateJoinCapability(session);
};

export const getAuthorProjectHelpSessionZoomJoin = async (
  authorId: string,
  sessionId: string,
  now?: Date,
) => {
  const session = await loadScheduledSessionForAuthor(authorId, sessionId);
  assertMeetingWindow(session, now);
  return mapPrivateJoinCapability(session);
};

export const deleteZoomMeetingForSession = async (meetingId: string) => {
  await getZoomMeetingProvider().deleteMeeting(meetingId);
};
