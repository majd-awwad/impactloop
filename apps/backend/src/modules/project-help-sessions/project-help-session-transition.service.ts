import type { Prisma, ProjectHelpSessionStatus } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';

import {
  buildProjectHelpSessionActiveKey,
  isProjectHelpSessionTerminalStatus,
} from './project-help-session-status.js';

export const HELP_SESSION_INVALID_STATE = 'HELP_SESSION_INVALID_STATE';

export const transitionProjectHelpSessionStatus = async (
  tx: Prisma.TransactionClient,
  input: {
    sessionId: string;
    expectedStatuses: ProjectHelpSessionStatus[];
    toStatus: ProjectHelpSessionStatus;
    actorId: string | null;
    reason?: string | null;
    data?: Prisma.ProjectHelpSessionUpdateInput;
    buildId?: string;
  },
) => {
  const session = await tx.projectHelpSession.findUnique({
    where: { id: input.sessionId },
    select: {
      id: true,
      status: true,
      buildId: true,
      activeKey: true,
    },
  });

  if (!session) {
    throw new AppError('Help session not found.', 404, 'NOT_FOUND');
  }

  if (!input.expectedStatuses.includes(session.status)) {
    throw new AppError(
      'Help session is not in a valid state for this action.',
      409,
      HELP_SESSION_INVALID_STATE,
      { currentStatus: session.status },
    );
  }

  const fromStatus = session.status;
  const activeKey = isProjectHelpSessionTerminalStatus(input.toStatus)
    ? null
    : buildProjectHelpSessionActiveKey(input.buildId ?? session.buildId);

  const updated = await tx.projectHelpSession.update({
    where: { id: input.sessionId },
    data: {
      status: input.toStatus,
      activeKey,
      ...(input.data ?? {}),
    },
  });

  await tx.projectHelpSessionStatusHistory.create({
    data: {
      sessionId: input.sessionId,
      fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId,
      reason: input.reason ?? null,
    },
  });

  return updated;
};
