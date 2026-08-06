export const PROJECT_HELP_SESSION_JOIN_OPEN_MINUTES_BEFORE = 15;
export const PROJECT_HELP_SESSION_JOIN_CLOSE_MINUTES_AFTER_END = 30;

export const computeProjectHelpSessionMeetingWindow = (input: {
  startsAt: Date;
  durationMinutes: number;
  now?: Date;
}) => {
  const now = input.now ?? new Date();
  const joinAvailableAt = new Date(
    input.startsAt.getTime() - PROJECT_HELP_SESSION_JOIN_OPEN_MINUTES_BEFORE * 60 * 1000,
  );
  const scheduledEnd = new Date(
    input.startsAt.getTime() + input.durationMinutes * 60 * 1000,
  );
  const joinClosesAt = new Date(
    scheduledEnd.getTime() + PROJECT_HELP_SESSION_JOIN_CLOSE_MINUTES_AFTER_END * 60 * 1000,
  );

  return {
    joinAvailableAt,
    joinClosesAt,
    isJoinable: now >= joinAvailableAt && now <= joinClosesAt,
    isStartable: now >= joinAvailableAt && now <= joinClosesAt,
    isBeforeWindow: now < joinAvailableAt,
    isAfterWindow: now > joinClosesAt,
  };
};
