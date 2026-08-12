import type { ProjectHelpSessionDetailRecord } from './project-help-session.repository.js';
import { PROJECT_HELP_SESSION_ALLOWED_DURATIONS } from './project-help-session-time.js';

export const computeProjectHelpSessionScheduledEnd = (input: {
  startsAt: Date;
  durationMinutes: number;
}) =>
  new Date(input.startsAt.getTime() + input.durationMinutes * 60 * 1000);

export const PROJECT_HELP_SESSION_RESOLUTION_WINDOW_HOURS = 24;

export const computeProjectHelpSessionAutoFinalizeAt = (input: {
  startsAt: Date;
  durationMinutes: number;
}) =>
  new Date(
    computeProjectHelpSessionScheduledEnd(input).getTime() +
      PROJECT_HELP_SESSION_RESOLUTION_WINDOW_HOURS * 60 * 60 * 1000,
  );

export const deriveProjectHelpSessionCompletionState = (
  session: ProjectHelpSessionDetailRecord,
  now: Date,
) => {
  const startsAt = session.selectedTimeOption?.startsAt;
  const durationMinutes = session.durationMinutes;

  if (
    !startsAt ||
    !PROJECT_HELP_SESSION_ALLOWED_DURATIONS.includes(
      durationMinutes as (typeof PROJECT_HELP_SESSION_ALLOWED_DURATIONS)[number],
    )
  ) {
    return {
      scheduledEndsAt: null as Date | null,
      completionAvailableAt: null as Date | null,
      isCompletable: false,
    };
  }

  const scheduledEndsAt = computeProjectHelpSessionScheduledEnd({
    startsAt,
    durationMinutes,
  });

  return {
    scheduledEndsAt,
    completionAvailableAt: scheduledEndsAt,
    isCompletable:
      session.status === 'SCHEDULED' &&
      now.getTime() >= scheduledEndsAt.getTime() &&
      (session.autoFinalizeAt === null ||
        now.getTime() < session.autoFinalizeAt.getTime()),
  };
};
