import type { ProjectHelpSessionStatus } from '../../generated/prisma/client.js';

import { PROJECT_HELP_SESSION_CAPACITY_STATUSES } from './project-help-session-status.js';

export const getUtcIsoWeekStart = (instant: Date) => {
  const date = new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );
  const weekday = date.getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - daysFromMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date;
};

export const getUtcIsoWeekEnd = (weekStart: Date) => {
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
  return weekEnd;
};

export const isInstantWithinUtcIsoWeek = (instant: Date, weekStart: Date) => {
  const weekEnd = getUtcIsoWeekEnd(weekStart);
  return instant >= weekStart && instant < weekEnd;
};

export const PROJECT_HELP_SESSION_CAPACITY_STATUS_LIST = [
  ...PROJECT_HELP_SESSION_CAPACITY_STATUSES,
] as ProjectHelpSessionStatus[];
