import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'project-help-session-auto-finalization-access';
process.env.JWT_REFRESH_SECRET ??= 'project-help-session-auto-finalization-refresh';
process.env.ZOOM_INTEGRATION_MODE = 'fake';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { ReservationLifecycleWorker } from '../reservations/reservation-lifecycle.worker.js';
import {
  autoFinalizeDueProjectHelpSessionsBatch,
  findDueProjectHelpSessionAutoFinalizationCandidates,
  PROJECT_HELP_SESSION_AUTO_COMPLETION_REASON,
} from './project-help-session-auto-finalization.service.js';
import {
  computeProjectHelpSessionAutoFinalizeAt,
  computeProjectHelpSessionScheduledEnd,
} from './project-help-session-completion.js';
import {
  authorAcceptProjectHelpSessionOption,
  authorCompleteProjectHelpSession,
  cancelProjectHelpSession,
  createProjectHelpSessionRequest,
  reportProjectHelpSessionNoShow,
  SESSION_NO_SHOW_NOT_AVAILABLE,
  SESSION_RESOLUTION_WINDOW_CLOSED,
  setProjectHelpSessionNowForTests,
} from './project-help-session.service.js';
import { computeProjectHelpSessionMeetingWindow } from './project-help-session-zoom-windows.js';
import {
  cleanupNegotiationTests,
  createLearner,
  createLearnerBuild,
  createPublishedProject,
  enableOffering,
  futureIso,
  trackSession,
  validProblemDescription,
} from './project-help-session-test-support.js';
import { resetFakeZoomMeetingProviderForTests } from './zoom/zoom-meeting-provider.fake.js';
import {
  resetZoomMeetingProviderCacheForTests,
  setZoomMeetingProviderForTests,
} from './zoom/zoom-meeting-provider.factory.js';

let slotOffsetMinutes = 45_000;

const nextProposedTimes = () => {
  slotOffsetMinutes += 180;
  return [0, 60, 120].map((offset) =>
    new Date(futureIso(slotOffsetMinutes + offset)),
  );
};

const setupScheduledSession = async (suffix: string) => {
  setProjectHelpSessionNowForTests(null);
  const author = await createLearner(`auto-final-author-${suffix}`);
  const learner = await createLearner(`auto-final-learner-${suffix}`);
  const project = await createPublishedProject(author.id);
  await enableOffering(project.id, author.id, 5);
  const build = await createLearnerBuild(project.id, learner.id);
  const session = await createProjectHelpSessionRequest(learner.id, build.id, {
    problemDescription: validProblemDescription(),
    projectStepId: null,
    durationMinutes: 15,
    learnerTimeZone: 'UTC',
    proposedTimes: nextProposedTimes(),
  });
  trackSession(session.id);
  const option = session.timeOptions.find(
    (item) => item.type === 'LEARNER_PROPOSED',
  )!;
  await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
  const stored = await prisma.projectHelpSession.findUniqueOrThrow({
    where: { id: session.id },
    include: { selectedTimeOption: true },
  });
  assert.ok(stored.selectedTimeOption);
  return { author, learner, session, stored };
};

before(() => {
  resetFakeZoomMeetingProviderForTests();
  resetZoomMeetingProviderCacheForTests();
  setZoomMeetingProviderForTests(null);
});

beforeEach(() => {
  process.env.ZOOM_INTEGRATION_MODE = 'fake';
  resetFakeZoomMeetingProviderForTests();
  resetZoomMeetingProviderCacheForTests();
  setZoomMeetingProviderForTests(null);
  setProjectHelpSessionNowForTests(null);
});

afterEach(() => setProjectHelpSessionNowForTests(null));
after(async () => cleanupNegotiationTests());

describe('project help session auto-finalization lifecycle', () => {
  test('persists the exact deadline as session end plus 24 hours', async () => {
    const { stored } = await setupScheduledSession('deadline');
    const expectedEnd = computeProjectHelpSessionScheduledEnd({
      startsAt: stored.selectedTimeOption!.startsAt,
      durationMinutes: stored.durationMinutes,
    });
    const expectedDeadline = computeProjectHelpSessionAutoFinalizeAt({
      startsAt: stored.selectedTimeOption!.startsAt,
      durationMinutes: stored.durationMinutes,
    });

    assert.equal(
      expectedDeadline.getTime() - expectedEnd.getTime(),
      24 * 60 * 60 * 1000,
    );
    assert.equal(stored.autoFinalizeAt?.getTime(), expectedDeadline.getTime());
    await prisma.projectHelpSession.update({
      where: { id: stored.id },
      data: { autoFinalizeAt: new Date('2040-01-01T00:00:00.000Z') },
    });
  });

  test('due-only batch honors before/exact/after boundaries and is idempotent', async () => {
    const before = await setupScheduledSession('before-boundary');
    const exact = await setupScheduledSession('exact-boundary');
    const after = await setupScheduledSession('after-boundary');
    const boundary = new Date('2027-01-15T12:00:00.000Z');

    await Promise.all([
      prisma.projectHelpSession.update({
        where: { id: before.session.id },
        data: { autoFinalizeAt: new Date(boundary.getTime() + 1) },
      }),
      prisma.projectHelpSession.update({
        where: { id: exact.session.id },
        data: { autoFinalizeAt: boundary },
      }),
      prisma.projectHelpSession.update({
        where: { id: after.session.id },
        data: { autoFinalizeAt: new Date(boundary.getTime() - 1) },
      }),
    ]);

    const dueAtBoundary = await findDueProjectHelpSessionAutoFinalizationCandidates(
      10,
      boundary,
    );
    assert.equal(dueAtBoundary.some((row) => row.id === before.session.id), false);
    assert.equal(dueAtBoundary.some((row) => row.id === exact.session.id), true);
    assert.equal(dueAtBoundary.some((row) => row.id === after.session.id), true);

    setProjectHelpSessionNowForTests(boundary);
    for (const [operation, expectedCode] of [
      [
        authorCompleteProjectHelpSession(exact.author.id, exact.session.id),
        SESSION_RESOLUTION_WINDOW_CLOSED,
      ],
      [
        reportProjectHelpSessionNoShow({
          sessionId: exact.session.id,
          actorId: exact.learner.id,
          actorRole: 'learner',
        }),
        SESSION_NO_SHOW_NOT_AVAILABLE,
      ],
    ] as const) {
      await assert.rejects(operation, (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, expectedCode);
        return true;
      });
    }

    const concurrentRuns = await Promise.all([
      autoFinalizeDueProjectHelpSessionsBatch(10, boundary),
      autoFinalizeDueProjectHelpSessionsBatch(10, boundary),
    ]);
    assert.equal(
      concurrentRuns.reduce((sum, result) => sum + result.transitionCount, 0),
      2,
    );
    assert.deepEqual(
      new Set(concurrentRuns.flatMap((result) => result.completedSessionIds)),
      new Set([exact.session.id, after.session.id]),
    );
    assert.equal(
      (await prisma.projectHelpSession.findUniqueOrThrow({
        where: { id: before.session.id },
      })).status,
      'SCHEDULED',
    );

    const workerNow = boundary.getTime() + 1;
    const worker = new ReservationLifecycleWorker(
      60_000,
      10,
      60_000,
      () => workerNow,
    );
    const second = await worker.runOnce();
    assert.ok(second);
    assert.equal(second.projectHelpSessionsAutoCompleted, 1);

    const rerun = await worker.runOnce();
    assert.ok(rerun);
    assert.equal(rerun.projectHelpSessionsAutoCompleted, 0);

    for (const sessionId of [
      before.session.id,
      exact.session.id,
      after.session.id,
    ]) {
      const history = await prisma.projectHelpSessionStatusHistory.findMany({
        where: { sessionId, toStatus: 'COMPLETED' },
      });
      assert.equal(history.length, 1);
      assert.equal(history[0]!.actorId, null);
      assert.equal(history[0]!.reason, PROJECT_HELP_SESSION_AUTO_COMPLETION_REASON);
    }
  });

  test('no-show, manual completion, and cancelled sessions are never auto-completed', async () => {
    const noShow = await setupScheduledSession('blocked-learner-no-show');
    const authorNoShow = await setupScheduledSession('blocked-author-no-show');
    const manual = await setupScheduledSession('blocked-manual');
    const cancelled = await setupScheduledSession('blocked-cancelled');

    const noShowWindow = computeProjectHelpSessionMeetingWindow({
      startsAt: noShow.stored.selectedTimeOption!.startsAt,
      durationMinutes: noShow.stored.durationMinutes,
    });
    setProjectHelpSessionNowForTests(
      new Date(noShowWindow.joinClosesAt.getTime() + 1),
    );
    await reportProjectHelpSessionNoShow({
      sessionId: noShow.session.id,
      actorId: noShow.learner.id,
      actorRole: 'learner',
    });

    const authorNoShowWindow = computeProjectHelpSessionMeetingWindow({
      startsAt: authorNoShow.stored.selectedTimeOption!.startsAt,
      durationMinutes: authorNoShow.stored.durationMinutes,
    });
    setProjectHelpSessionNowForTests(
      new Date(authorNoShowWindow.joinClosesAt.getTime() + 1),
    );
    await reportProjectHelpSessionNoShow({
      sessionId: authorNoShow.session.id,
      actorId: authorNoShow.author.id,
      actorRole: 'author',
    });

    const manualEnd = computeProjectHelpSessionScheduledEnd({
      startsAt: manual.stored.selectedTimeOption!.startsAt,
      durationMinutes: manual.stored.durationMinutes,
    });
    setProjectHelpSessionNowForTests(manualEnd);
    await authorCompleteProjectHelpSession(manual.author.id, manual.session.id);

    const cancelledWindow = computeProjectHelpSessionMeetingWindow({
      startsAt: cancelled.stored.selectedTimeOption!.startsAt,
      durationMinutes: cancelled.stored.durationMinutes,
    });
    setProjectHelpSessionNowForTests(
      new Date(cancelledWindow.joinAvailableAt.getTime() - 1),
    );
    await cancelProjectHelpSession({
      sessionId: cancelled.session.id,
      actorId: cancelled.learner.id,
      actorRole: 'learner',
      reason: 'Cannot attend',
    });

    const afterAllDeadlines = new Date('2035-01-01T00:00:00.000Z');
    const result = await autoFinalizeDueProjectHelpSessionsBatch(
      10,
      afterAllDeadlines,
    );
    assert.equal(
      result.completedSessionIds.some((id) =>
        [
          noShow.session.id,
          authorNoShow.session.id,
          manual.session.id,
          cancelled.session.id,
        ].includes(id),
      ),
      false,
    );

    const states = await prisma.projectHelpSession.findMany({
      where: {
        id: {
          in: [
            noShow.session.id,
            authorNoShow.session.id,
            manual.session.id,
            cancelled.session.id,
          ],
        },
      },
      select: { id: true, status: true },
    });
    assert.equal(states.find((row) => row.id === noShow.session.id)?.status, 'SCHEDULED');
    assert.equal(
      states.find((row) => row.id === authorNoShow.session.id)?.status,
      'SCHEDULED',
    );
    assert.equal(states.find((row) => row.id === manual.session.id)?.status, 'COMPLETED');
    assert.equal(states.find((row) => row.id === cancelled.session.id)?.status, 'CANCELLED');
  });
});
