import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../../database/prisma.js';

import {
  PROJECT_HELP_SESSION_CAPACITY_STATUS_LIST,
} from './project-help-session-weekly-capacity.js';
import {
  PROJECT_HELP_SESSION_HOST_SLOT_STATUSES,
} from './project-help-session-status.js';
import { getUtcIsoWeekEnd, getUtcIsoWeekStart } from './project-help-session-weekly-capacity.js';
import { intervalsOverlap } from './project-help-session-time.js';

export const projectHelpSessionDetailInclude = {
  project: {
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
    },
  },
  build: {
    select: {
      id: true,
      attemptNumber: true,
    },
  },
  learner: {
    select: {
      id: true,
      displayName: true,
      profileImageUrl: true,
    },
  },
  author: {
    select: {
      id: true,
      displayName: true,
      profileImageUrl: true,
    },
  },
  projectStep: {
    select: {
      id: true,
      title: true,
      stepNumber: true,
    },
  },
  timeOptions: {
    orderBy: { startsAt: 'asc' as const },
    include: {
      proposedBy: {
        select: {
          id: true,
          displayName: true,
        },
      },
    },
  },
  selectedTimeOption: true,
} satisfies Prisma.ProjectHelpSessionInclude;

export type ProjectHelpSessionDetailRecord = Prisma.ProjectHelpSessionGetPayload<{
  include: typeof projectHelpSessionDetailInclude;
}>;

export const findProjectHelpSessionDetail = async (
  sessionId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) =>
  client.projectHelpSession.findUnique({
    where: { id: sessionId },
    include: projectHelpSessionDetailInclude,
  });

export const findLearnerProjectHelpSessionDetail = async (
  sessionId: string,
  learnerId: string,
) => {
  const session = await findProjectHelpSessionDetail(sessionId);
  if (!session || session.learnerId !== learnerId) {
    return null;
  }
  return session;
};

export const findAuthorProjectHelpSessionDetail = async (
  sessionId: string,
  authorId: string,
) => {
  const session = await findProjectHelpSessionDetail(sessionId);
  if (!session || session.authorId !== authorId) {
    return null;
  }
  return session;
};

export const countAuthorWeeklyCapacityUsage = async (
  input: {
    authorId: string;
    weekStart: Date;
    excludeSessionId?: string;
  },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  const weekEnd = getUtcIsoWeekEnd(input.weekStart);
  return client.projectHelpSession.count({
    where: {
      authorId: input.authorId,
      status: { in: PROJECT_HELP_SESSION_CAPACITY_STATUS_LIST },
      ...(input.excludeSessionId
        ? { id: { not: input.excludeSessionId } }
        : {}),
      selectedTimeOption: {
        startsAt: {
          gte: input.weekStart,
          lt: weekEnd,
        },
      },
    },
  });
};

export const findHostSlotConflicts = async (
  input: {
    startsAt: Date;
    durationMinutes: number;
    excludeSessionId?: string;
    now?: Date;
  },
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  const now = input.now ?? new Date();
  const sessions = await client.projectHelpSession.findMany({
    where: {
      status: { in: [...PROJECT_HELP_SESSION_HOST_SLOT_STATUSES] },
      selectedTimeOptionId: { not: null },
      ...(input.excludeSessionId
        ? { id: { not: input.excludeSessionId } }
        : {}),
    },
    select: {
      id: true,
      durationMinutes: true,
      status: true,
      selectedTimeOption: {
        select: {
          startsAt: true,
        },
      },
    },
  });

  return sessions.filter((session) => {
    const selectedStart = session.selectedTimeOption?.startsAt;
    if (!selectedStart) {
      return false;
    }

    if (
      session.status === 'COMPLETED' &&
      selectedStart.getTime() + session.durationMinutes * 60_000 <= now.getTime()
    ) {
      return false;
    }

    return intervalsOverlap({
      existingStart: selectedStart,
      existingDurationMinutes: session.durationMinutes,
      newStart: input.startsAt,
      newDurationMinutes: input.durationMinutes,
    });
  });
};

export const hasAuthorAlternativeOption = (
  session: {
    timeOptions: Array<{ proposalType: string }>;
  },
) =>
  session.timeOptions.some((option) => option.proposalType === 'AUTHOR_ALTERNATIVE');

export const getAuthorAlternativeOption = (
  session: Pick<ProjectHelpSessionDetailRecord, 'timeOptions'>,
) =>
  session.timeOptions.find((option) => option.proposalType === 'AUTHOR_ALTERNATIVE') ??
  null;

export const listLearnerProjectHelpSessions = async (input: {
  learnerId: string;
  status?: Prisma.EnumProjectHelpSessionStatusFilter['equals'];
  page: number;
  limit: number;
}) => {
  const where: Prisma.ProjectHelpSessionWhereInput = {
    learnerId: input.learnerId,
    ...(input.status ? { status: input.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.projectHelpSession.findMany({
      where,
      include: projectHelpSessionDetailInclude,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.projectHelpSession.count({ where }),
  ]);

  items.sort((left, right) => {
    const leftActive = left.activeKey ? 0 : 1;
    const rightActive = right.activeKey ? 0 : 1;
    if (leftActive !== rightActive) {
      return leftActive - rightActive;
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  return { items, total, page: input.page, limit: input.limit };
};

export const listAuthorProjectHelpSessions = async (input: {
  authorId: string;
  status?: Prisma.EnumProjectHelpSessionStatusFilter['equals'];
  projectId?: string;
  page: number;
  limit: number;
}) => {
  const where: Prisma.ProjectHelpSessionWhereInput = {
    authorId: input.authorId,
    ...(input.status ? { status: input.status } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.projectHelpSession.findMany({
      where,
      include: projectHelpSessionDetailInclude,
      orderBy: { createdAt: 'desc' },
      skip: (input.page - 1) * input.limit,
      take: input.limit,
    }),
    prisma.projectHelpSession.count({ where }),
  ]);

  items.sort((left, right) => {
    const leftActive = left.activeKey ? 0 : 1;
    const rightActive = right.activeKey ? 0 : 1;
    if (leftActive !== rightActive) {
      return leftActive - rightActive;
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  return { items, total, page: input.page, limit: input.limit };
};

export const getWeekStartForInstant = (instant: Date) => getUtcIsoWeekStart(instant);
