import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'project-help-session-completion-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'project-help-session-completion-refresh-secret';
process.env.ZOOM_INTEGRATION_MODE = 'fake';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  authorAcceptProjectHelpSessionOption,
  authorCompleteProjectHelpSession,
  cancelProjectHelpSession,
  createProjectHelpSessionRequest,
  getAuthorProjectHelpSession,
  getLearnerProjectHelpSession,
  INVALID_SESSION_STATE,
  PROJECT_HELP_SESSION_NOT_FOUND,
  SESSION_NOT_COMPLETABLE_YET,
  setProjectHelpSessionNowForTests,
} from './project-help-session.service.js';
import { computeProjectHelpSessionScheduledEnd } from './project-help-session-completion.js';
import { ensureProjectHelpSessionNotebookPage } from './project-help-session-notebook-handoff.service.js';
import {
  getAuthorProjectHelpSessionZoomStart,
  getLearnerProjectHelpSessionZoomJoin,
} from './project-help-session-zoom.service.js';
import {
  getFakeZoomDeleteCallCount,
  resetFakeZoomMeetingProviderForTests,
  setFakeZoomBehaviorForTests,
} from './zoom/zoom-meeting-provider.fake.js';
import {
  resetZoomMeetingProviderCacheForTests,
  setZoomMeetingProviderForTests,
} from './zoom/zoom-meeting-provider.factory.js';
import {
  cleanupNegotiationTests,
  createAdmin,
  createLearner,
  createLearnerBuild,
  createPublishedProject,
  enableOffering,
  futureIso,
  trackSession,
  validProblemDescription,
} from './project-help-session-test-support.js';

const assertAppError = async (
  promise: Promise<unknown>,
  expected: { statusCode: number; code: string },
) => {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, expected.statusCode);
    assert.equal(error.code, expected.code);
    return true;
  });
};

let uniqueSlotOffsetMinutes = 30_000;

function nextProposedTimes() {
  uniqueSlotOffsetMinutes += 180;
  const base = uniqueSlotOffsetMinutes;
  return [futureIso(base), futureIso(base + 60), futureIso(base + 120)].map(
    (value) => new Date(value),
  );
}

async function setupScheduledSession(suffix: string) {
  const author = await createLearner(`completion-author-${suffix}`);
  const learner = await createLearner(`completion-learner-${suffix}`);
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
  const option = session.timeOptions.find((item) => item.type === 'LEARNER_PROPOSED')!;
  await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
  return { author, learner, project, build, session };
}

async function scheduledEndFor(sessionId: string) {
  const stored = await prisma.projectHelpSession.findUnique({
    where: { id: sessionId },
    include: { selectedTimeOption: true },
  });
  assert.ok(stored?.selectedTimeOption);
  return computeProjectHelpSessionScheduledEnd({
    startsAt: stored.selectedTimeOption.startsAt,
    durationMinutes: stored.durationMinutes,
  });
}

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
  setFakeZoomBehaviorForTests({});
  setProjectHelpSessionNowForTests(null);
});

afterEach(() => {
  setProjectHelpSessionNowForTests(null);
});

after(async () => {
  await cleanupNegotiationTests();
});

describe('project help session completion (PHS-06)', () => {
  test('authorization: only canonical author can complete', async () => {
    const { author, learner, session } = await setupScheduledSession('auth');
    const scheduledEnd = await scheduledEndFor(session.id);
    setProjectHelpSessionNowForTests(scheduledEnd);

    await assertAppError(authorCompleteProjectHelpSession('', session.id), {
      statusCode: 404,
      code: PROJECT_HELP_SESSION_NOT_FOUND,
    });

    await assertAppError(authorCompleteProjectHelpSession(learner.id, session.id), {
      statusCode: 404,
      code: PROJECT_HELP_SESSION_NOT_FOUND,
    });

    const stranger = await createLearner('completion-stranger');
    await assertAppError(authorCompleteProjectHelpSession(stranger.id, session.id), {
      statusCode: 404,
      code: PROJECT_HELP_SESSION_NOT_FOUND,
    });

    const completed = await authorCompleteProjectHelpSession(author.id, session.id);
    assert.equal(completed.status, 'COMPLETED');
  });

  test('timing: before end rejected, at/after end succeeds', async () => {
    const { author, session } = await setupScheduledSession('timing');
    const scheduledEnd = await scheduledEndFor(session.id);

    setProjectHelpSessionNowForTests(new Date(scheduledEnd.getTime() - 1_000));
    await assertAppError(authorCompleteProjectHelpSession(author.id, session.id), {
      statusCode: 409,
      code: SESSION_NOT_COMPLETABLE_YET,
    });

    setProjectHelpSessionNowForTests(scheduledEnd);
    const atEnd = await authorCompleteProjectHelpSession(author.id, session.id);
    assert.equal(atEnd.status, 'COMPLETED');
    assert.ok(atEnd.completedAt);

    const { author: author2, session: session2 } = await setupScheduledSession('timing-later');
    const end2 = await scheduledEndFor(session2.id);
    setProjectHelpSessionNowForTests(new Date(end2.getTime() + 60_000));
    const afterEnd = await authorCompleteProjectHelpSession(author2.id, session2.id);
    assert.equal(afterEnd.status, 'COMPLETED');
  });

  test('completion side effects and preserved fields', async () => {
    const { author, session } = await setupScheduledSession('effects');
    const scheduledEnd = await scheduledEndFor(session.id);
    setProjectHelpSessionNowForTests(scheduledEnd);
    const deleteCallsBefore = getFakeZoomDeleteCallCount();

    const before = await prisma.projectHelpSession.findUnique({
      where: { id: session.id },
    });
    await authorCompleteProjectHelpSession(author.id, session.id);
    const after = await prisma.projectHelpSession.findUnique({
      where: { id: session.id },
    });

    assert.equal(after?.status, 'COMPLETED');
    assert.ok(after?.completedAt);
    assert.equal(after?.activeKey, null);
    assert.equal(after?.zoomJoinUrl, null);
    assert.ok(after?.zoomMeetingId);
    assert.equal(after?.selectedTimeOptionId, before?.selectedTimeOptionId);
    assert.ok(after?.confirmedAt);
    assert.equal(getFakeZoomDeleteCallCount(), deleteCallsBefore);
  });

  test('notification idempotency and safe metadata', async () => {
    const { author, learner, session } = await setupScheduledSession('notify');
    const scheduledEnd = await scheduledEndFor(session.id);
    setProjectHelpSessionNowForTests(scheduledEnd);

    await authorCompleteProjectHelpSession(author.id, session.id);
    const notifications = await prisma.notification.findMany({
      where: {
        userId: learner.id,
        notificationType: 'PROJECT_HELP_SESSION_COMPLETED',
      },
    });
    assert.equal(notifications.length, 1);
    const metadata = notifications[0]!.metadata as Record<string, unknown>;
    assert.equal(metadata.recipientRole, 'LEARNER');
    assert.equal(metadata.status, 'COMPLETED');
    assert.ok(metadata.completedAt);
    const payload = JSON.stringify(notifications[0]);
    assert.ok(!payload.toLowerCase().includes('zoom'));
    assert.ok(!payload.includes('@'));

    const history = await prisma.projectHelpSessionStatusHistory.findMany({
      where: { sessionId: session.id, toStatus: 'COMPLETED' },
    });
    assert.equal(history.length, 1);

    await authorCompleteProjectHelpSession(author.id, session.id);
    const notificationsAgain = await prisma.notification.findMany({
      where: {
        userId: learner.id,
        notificationType: 'PROJECT_HELP_SESSION_COMPLETED',
      },
    });
    assert.equal(notificationsAgain.length, 1);
  });

  test('concurrency and terminal race safety', async () => {
    const { author, session } = await setupScheduledSession('race-complete');
    const scheduledEnd = await scheduledEndFor(session.id);
    setProjectHelpSessionNowForTests(scheduledEnd);

    const results = await Promise.allSettled([
      authorCompleteProjectHelpSession(author.id, session.id),
      authorCompleteProjectHelpSession(author.id, session.id),
    ]);
    assert.equal(
      results.filter((item) => item.status === 'fulfilled').length,
      2,
    );
    const history = await prisma.projectHelpSessionStatusHistory.findMany({
      where: { sessionId: session.id, toStatus: 'COMPLETED' },
    });
    assert.equal(history.length, 1);

    const { author: author2, learner: learner2, session: session2 } =
      await setupScheduledSession('race-cancel');
    const end2 = await scheduledEndFor(session2.id);
    setProjectHelpSessionNowForTests(end2);
    await Promise.allSettled([
      authorCompleteProjectHelpSession(author2.id, session2.id),
      cancelProjectHelpSession({
        sessionId: session2.id,
        actorId: learner2.id,
        actorRole: 'learner',
        reason: 'Cannot attend',
      }),
    ]);
    const stored = await prisma.projectHelpSession.findUnique({
      where: { id: session2.id },
    });
    assert.ok(stored?.status === 'COMPLETED' || stored?.status === 'CANCELLED');
  });

  test('completed blocks cancel/join/start', async () => {
    const { author, learner, session } = await setupScheduledSession('terminal');
    const scheduledEnd = await scheduledEndFor(session.id);
    setProjectHelpSessionNowForTests(scheduledEnd);
    await authorCompleteProjectHelpSession(author.id, session.id);

    await assertAppError(
      cancelProjectHelpSession({
        sessionId: session.id,
        actorId: author.id,
        actorRole: 'author',
        reason: 'Too late',
      }),
      { statusCode: 409, code: 'HELP_SESSION_INVALID_STATE' },
    );

    await assertAppError(
      getLearnerProjectHelpSessionZoomJoin(learner.id, session.id),
      { statusCode: 409, code: 'HELP_SESSION_INVALID_STATE' },
    );

    await assertAppError(
      getAuthorProjectHelpSessionZoomStart(author.id, session.id),
      { statusCode: 409, code: 'HELP_SESSION_INVALID_STATE' },
    );
  });

  test('DTO completion timing and canComplete', async () => {
    const { author, learner, session } = await setupScheduledSession('dto');
    const scheduledEnd = await scheduledEndFor(session.id);

    setProjectHelpSessionNowForTests(
      new Date(scheduledEnd.getTime() - 5 * 60_000),
    );
    const beforeDto = await getAuthorProjectHelpSession(author.id, session.id);
    assert.equal(beforeDto.allowedActions.canComplete, false);
    assert.ok(beforeDto.completionAvailableAt);
    assert.ok(beforeDto.scheduledEndsAt);

    setProjectHelpSessionNowForTests(scheduledEnd);
    const afterDto = await getAuthorProjectHelpSession(author.id, session.id);
    assert.equal(afterDto.allowedActions.canComplete, true);

    const learnerDto = await getLearnerProjectHelpSession(learner.id, session.id);
    assert.equal('canComplete' in learnerDto.allowedActions, false);
  });

  test('non-scheduled session cannot complete', async () => {
    const author = await createLearner('completion-pending-author');
    const learner = await createLearner('completion-pending-learner');
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

    await assertAppError(authorCompleteProjectHelpSession(author.id, session.id), {
      statusCode: 409,
      code: INVALID_SESSION_STATE,
    });
  });

  test('notebook handoff is learner-only, explicit, and idempotent', async () => {
    const { author, learner, session } = await setupScheduledSession('notebook');
    const scheduledEnd = await scheduledEndFor(session.id);
    setProjectHelpSessionNowForTests(scheduledEnd);
    await authorCompleteProjectHelpSession(author.id, session.id);

    await assertAppError(
      ensureProjectHelpSessionNotebookPage({
        learnerId: author.id,
        sessionId: session.id,
        locale: 'en',
      }),
      { statusCode: 404, code: PROJECT_HELP_SESSION_NOT_FOUND },
    );

    const first = await ensureProjectHelpSessionNotebookPage({
      learnerId: learner.id,
      sessionId: session.id,
      locale: 'en',
    });
    const second = await ensureProjectHelpSessionNotebookPage({
      learnerId: learner.id,
      sessionId: session.id,
      locale: 'en',
    });
    assert.equal(first.pageId, second.pageId);

    const notebook = await prisma.projectBuildNotebook.findUnique({
      where: { buildId: first.buildId },
    });
    const content = notebook!.content as {
      pages: Array<{ source?: { id: string }; text?: string }>;
    };
    const matching = content.pages.filter((page) => page.source?.id === session.id);
    assert.equal(matching.length, 1);
    assert.match(matching[0]!.text ?? '', /What I learned:/);
    assert.ok(!JSON.stringify(matching[0]).includes(validProblemDescription()));
  });
});
