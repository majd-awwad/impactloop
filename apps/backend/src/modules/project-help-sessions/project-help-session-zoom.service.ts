import { AppError } from '../../utils/app-error.js';

import {
  findAuthorProjectHelpSessionDetail,
  findLearnerProjectHelpSessionDetail,
} from './project-help-session.repository.js';
import { computeProjectHelpSessionMeetingWindow } from './project-help-session-zoom-windows.js';
import { getZoomMeetingProvider } from './zoom/zoom-meeting-provider.factory.js';
import { isZoomError } from './zoom/zoom-errors.js';

const notFoundHelpSession = () =>
  new AppError('Help session not found.', 404, 'NOT_FOUND');

const loadScheduledSessionForLearner = async (learnerId: string, sessionId: string) => {
  const session = await findLearnerProjectHelpSessionDetail(sessionId, learnerId);
  if (!session) {
    throw notFoundHelpSession();
  }
  if (session.status !== 'SCHEDULED' || !session.zoomJoinUrl || !session.selectedTimeOption) {
    throw new AppError(
      'Help session is not in a valid state for this action.',
      409,
      'HELP_SESSION_INVALID_STATE',
    );
  }
  return session;
};

const loadScheduledSessionForAuthor = async (authorId: string, sessionId: string) => {
  const session = await findAuthorProjectHelpSessionDetail(sessionId, authorId);
  if (!session) {
    throw notFoundHelpSession();
  }
  if (session.status !== 'SCHEDULED' || !session.zoomMeetingId || !session.selectedTimeOption) {
    throw new AppError(
      'Help session is not in a valid state for this action.',
      409,
      'HELP_SESSION_INVALID_STATE',
    );
  }
  return session;
};

const assertMeetingWindow = (
  session: { selectedTimeOption: { startsAt: Date } | null; durationMinutes: number },
  input: { beforeCode: string; afterCode: string; now?: Date },
) => {
  if (!session.selectedTimeOption) {
    throw new AppError(
      'Help session is not in a valid state for this action.',
      409,
      'HELP_SESSION_INVALID_STATE',
    );
  }
  const window = computeProjectHelpSessionMeetingWindow({
    startsAt: session.selectedTimeOption.startsAt,
    durationMinutes: session.durationMinutes,
    now: input.now,
  });
  if (window.isBeforeWindow) {
    throw new AppError('Help session is not open yet.', 409, input.beforeCode);
  }
  if (window.isAfterWindow) {
    throw new AppError('Help session window has closed.', 409, input.afterCode);
  }
};

export const getLearnerProjectHelpSessionZoomJoin = async (
  learnerId: string,
  sessionId: string,
  now?: Date,
) => {
  const session = await loadScheduledSessionForLearner(learnerId, sessionId);
  assertMeetingWindow(session, {
    beforeCode: 'SESSION_NOT_JOINABLE_YET',
    afterCode: 'SESSION_JOIN_WINDOW_CLOSED',
    now,
  });

  return {
    joinUrl: session.zoomJoinUrl!,
    startsAt: session.selectedTimeOption!.startsAt.toISOString(),
    durationMinutes: session.durationMinutes,
  };
};

export const getAuthorProjectHelpSessionZoomStart = async (
  authorId: string,
  sessionId: string,
  now?: Date,
) => {
  const session = await loadScheduledSessionForAuthor(authorId, sessionId);
  assertMeetingWindow(session, {
    beforeCode: 'SESSION_NOT_STARTABLE_YET',
    afterCode: 'SESSION_START_WINDOW_CLOSED',
    now,
  });

  const provider = getZoomMeetingProvider();
  try {
    const startUrl = await provider.getFreshHostStartUrl(session.zoomMeetingId!);
    return {
      startUrl,
      startsAt: session.selectedTimeOption!.startsAt.toISOString(),
      durationMinutes: session.durationMinutes,
    };
  } catch (error) {
    if (isZoomError(error) && error.code === 'ZOOM_MEETING_NOT_FOUND') {
      throw new AppError('Zoom meeting was not found.', 404, 'ZOOM_MEETING_NOT_FOUND');
    }
    throw error;
  }
};

export const deleteZoomMeetingForSession = async (meetingId: string) => {
  const provider = getZoomMeetingProvider();
  await provider.deleteMeeting(meetingId);
};
