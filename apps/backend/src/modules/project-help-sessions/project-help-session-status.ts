import type { ProjectHelpSessionStatus } from '../../generated/prisma/client.js';

export const PROJECT_HELP_SESSION_ACTIVE_STATUSES = [
  'PENDING',
  'ALTERNATIVE_PROPOSED',
  'ZOOM_PENDING',
  'SCHEDULING_FAILED',
  'SCHEDULED',
] as const satisfies readonly ProjectHelpSessionStatus[];

export const PROJECT_HELP_SESSION_TERMINAL_STATUSES = [
  'DECLINED',
  'CANCELLED',
  'COMPLETED',
] as const satisfies readonly ProjectHelpSessionStatus[];

export type ProjectHelpSessionActiveStatus =
  (typeof PROJECT_HELP_SESSION_ACTIVE_STATUSES)[number];

export type ProjectHelpSessionTerminalStatus =
  (typeof PROJECT_HELP_SESSION_TERMINAL_STATUSES)[number];

export const isProjectHelpSessionActiveStatus = (
  status: ProjectHelpSessionStatus,
): status is ProjectHelpSessionActiveStatus =>
  PROJECT_HELP_SESSION_ACTIVE_STATUSES.includes(
    status as ProjectHelpSessionActiveStatus,
  );

export const isProjectHelpSessionTerminalStatus = (
  status: ProjectHelpSessionStatus,
): status is ProjectHelpSessionTerminalStatus =>
  PROJECT_HELP_SESSION_TERMINAL_STATUSES.includes(
    status as ProjectHelpSessionTerminalStatus,
  );

export const buildProjectHelpSessionActiveKey = (buildId: string) =>
  `build:${buildId}`;

export const PROJECT_HELP_SESSION_CANCELLABLE_STATUSES = [
  'PENDING',
  'ALTERNATIVE_PROPOSED',
  'ZOOM_PENDING',
  'SCHEDULING_FAILED',
  'SCHEDULED',
] as const satisfies readonly ProjectHelpSessionStatus[];

export const PROJECT_HELP_SESSION_CAPACITY_STATUSES = [
  'ZOOM_PENDING',
  'SCHEDULING_FAILED',
  'SCHEDULED',
  'COMPLETED',
] as const satisfies readonly ProjectHelpSessionStatus[];

export const PROJECT_HELP_SESSION_HOST_SLOT_STATUSES = [
  'ZOOM_PENDING',
  'SCHEDULING_FAILED',
  'SCHEDULED',
] as const satisfies readonly ProjectHelpSessionStatus[];

export type ProjectHelpSessionCancellableStatus =
  (typeof PROJECT_HELP_SESSION_CANCELLABLE_STATUSES)[number];

export const isProjectHelpSessionCancellableStatus = (
  status: ProjectHelpSessionStatus,
): status is ProjectHelpSessionCancellableStatus =>
  PROJECT_HELP_SESSION_CANCELLABLE_STATUSES.includes(
    status as ProjectHelpSessionCancellableStatus,
  );
