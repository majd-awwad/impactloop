import { prisma } from '../../database/prisma.js';
import { logger } from '../../observability/logger.js';
import { runSerializableTransaction } from '../../utils/transaction-retry.js';

import { notifyProjectHelpSessionCompleted } from './project-help-session-notifications.js';
import { findProjectHelpSessionDetail } from './project-help-session.repository.js';

export const PROJECT_HELP_SESSION_AUTO_COMPLETION_REASON =
  'AUTO_COMPLETED_AFTER_RESOLUTION_WINDOW';

export type ProjectHelpSessionAutoFinalizationBatchResult = {
  dueCount: number;
  processedCount: number;
  transitionCount: number;
  completedSessionIds: string[];
};

export const findDueProjectHelpSessionAutoFinalizationCandidates = async (
  batchSize: number,
  now: Date = new Date(),
) =>
  prisma.projectHelpSession.findMany({
    where: {
      status: 'SCHEDULED',
      autoFinalizeAt: { lte: now },
      learnerReportedAuthorNoShowAt: null,
      authorReportedLearnerNoShowAt: null,
    },
    select: {
      id: true,
      autoFinalizeAt: true,
    },
    orderBy: [{ autoFinalizeAt: 'asc' }, { id: 'asc' }],
    take: batchSize,
  });

const notifyAutoCompletedSession = async (sessionId: string) => {
  const session = await findProjectHelpSessionDetail(sessionId);
  if (!session || session.status !== 'COMPLETED') {
    return;
  }
  try {
    await notifyProjectHelpSessionCompleted(session, { actorId: null });
  } catch (error) {
    logger.warn(
      {
        operation: 'project-help-session.auto-finalization.notify',
        sessionId,
        err: error instanceof Error ? error.message : String(error),
      },
      'Project help session auto-completion notification failed after commit',
    );
  }
};

export const autoFinalizeDueProjectHelpSessionsBatch = async (
  batchSize: number,
  now: Date = new Date(),
): Promise<ProjectHelpSessionAutoFinalizationBatchResult> => {
  const candidates =
    await findDueProjectHelpSessionAutoFinalizationCandidates(batchSize, now);
  const completedSessionIds: string[] = [];

  for (const candidate of candidates) {
    const transitioned = await runSerializableTransaction(async (tx) => {
      const update = await tx.projectHelpSession.updateMany({
        where: {
          id: candidate.id,
          status: 'SCHEDULED',
          autoFinalizeAt: { lte: now },
          learnerReportedAuthorNoShowAt: null,
          authorReportedLearnerNoShowAt: null,
        },
        data: {
          status: 'COMPLETED',
          activeKey: null,
          completedAt: now,
          zoomJoinUrl: null,
        },
      });
      if (update.count !== 1) {
        return false;
      }

      await tx.projectHelpSessionStatusHistory.create({
        data: {
          sessionId: candidate.id,
          fromStatus: 'SCHEDULED',
          toStatus: 'COMPLETED',
          actorId: null,
          reason: PROJECT_HELP_SESSION_AUTO_COMPLETION_REASON,
        },
      });
      return true;
    });

    if (transitioned) {
      completedSessionIds.push(candidate.id);
    }
  }

  await Promise.all(completedSessionIds.map(notifyAutoCompletedSession));

  return {
    dueCount: candidates.length,
    processedCount: candidates.length,
    transitionCount: completedSessionIds.length,
    completedSessionIds,
  };
};
