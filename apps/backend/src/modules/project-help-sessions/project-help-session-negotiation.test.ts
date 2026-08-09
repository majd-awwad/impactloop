import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'project-help-session-negotiation-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'project-help-session-negotiation-refresh-secret';
process.env.ZOOM_INTEGRATION_MODE = 'fake';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  signAccessToken,
  type AccessTokenPayload,
} from '../../utils/jwt.js';
import { pauseProjectBuild } from '../learning-projects/project-build-lifecycle.js';
import { upsertAuthorHelpSessionSettings } from './project-help-session-offering.js';
import {
  authorAcceptProjectHelpSessionOption,
  authorDeclineProjectHelpSession,
  authorProposeProjectHelpSessionAlternative,
  cancelProjectHelpSession,
  createProjectHelpSessionRequest,
  getAuthorProjectHelpSession,
  getLearnerProjectHelpSession,
  learnerAcceptProjectHelpSessionAlternative,
  learnerRejectProjectHelpSessionAlternative,
  listAuthorProjectHelpSessionViews,
  listLearnerProjectHelpSessionViews,
} from './project-help-session.service.js';
import type { ProjectHelpSessionTimeOptionType } from '../../generated/prisma/client.js';
import type { CreateProjectHelpSessionRequestInput } from './project-help-session.validation.js';
import type {
  ProjectHelpSessionAuthorAllowedActions,
  ProjectHelpSessionLearnerAllowedActions,
} from './project-help-session-actions.js';
import {
  cleanupNegotiationTests,
  createAdmin,
  createLearner,
  createLearnerBuild,
  createPublishedProject,
  enableOffering,
  futureIso,
  ids,
  TEST_MARKER,
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

let uniqueSlotOffsetMinutes = 10_000;

function nextSlotBase() {
  uniqueSlotOffsetMinutes += 180;
  return uniqueSlotOffsetMinutes;
}

function uniqueProposedTimes() {
  const base = nextSlotBase();
  return [futureIso(base), futureIso(base + 60), futureIso(base + 120)];
}

function uniqueFutureIso(extraMinutes = 0) {
  return futureIso(uniqueSlotOffsetMinutes + extraMinutes);
}

function sharedSlotTimes() {
  const base = nextSlotBase();
  const slot = futureIso(base);
  return {
    slot,
    times: proposedTimesFromIso([slot, futureIso(base + 60), futureIso(base + 120)]),
  };
}

function proposedTimesFromIso(values: string[]) {
  return values.map((iso) => new Date(iso));
}

const defaultRequestInput = (
  overrides: Partial<CreateProjectHelpSessionRequestInput> = {},
): CreateProjectHelpSessionRequestInput => ({
  problemDescription: validProblemDescription(),
  projectStepId: null,
  durationMinutes: 15,
  learnerTimeZone: 'Asia/Hebron',
  proposedTimes: uniqueProposedTimes().map((iso) => new Date(iso)),
  ...overrides,
});

async function setupAuthorLearnerProject(
  suffix: string,
  weeklyLimit = 3,
  reviewedById?: string,
) {
  const author = await createLearner(`author-${suffix}`);
  const learner = await createLearner(`learner-${suffix}`);
  const project = await createPublishedProject(author.id, reviewedById);
  await enableOffering(project.id, author.id, weeklyLimit);
  const build = await createLearnerBuild(project.id, learner.id);
  return { author, learner, project, build };
}

async function createTrackedRequest(
  learnerId: string,
  buildId: string,
  overrides: Partial<CreateProjectHelpSessionRequestInput> = {},
) {
  const session = await createProjectHelpSessionRequest(
    learnerId,
    buildId,
    defaultRequestInput(overrides),
  );
  await trackSession(session.id);
  return session;
}

function learnerProposedOption(session: { timeOptions: Array<{ id: string; type: string }> }) {
  const option = session.timeOptions.find((item) => item.type === 'LEARNER_PROPOSED');
  assert.ok(option);
  return option;
}

async function createSupplier(suffix: string) {
  const { hashPassword } = await import('../../utils/password.js');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Supplier ${suffix}`,
      email: `${TEST_MARKER}-supplier-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Math.floor(Math.random() * 1_000_000)
        .toString()
        .padStart(6, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function notificationCount(userId: string, notificationType: string) {
  return prisma.notification.count({
    where: { userId, notificationType },
  });
}

async function historyCount(sessionId: string) {
  return prisma.projectHelpSessionStatusHistory.count({
    where: { sessionId },
  });
}

async function timeOptionCount(
  sessionId: string,
  proposalType?: ProjectHelpSessionTimeOptionType,
) {
  return prisma.projectHelpSessionTimeOption.count({
    where: {
      sessionId,
      ...(proposalType ? { proposalType } : {}),
    },
  });
}

let httpServer: Server | null = null;
let baseUrl = '';

const tokenFor = (userId: string, roles: AccessTokenPayload['roles']) =>
  signAccessToken({ sub: userId, roles });

before(async () => {
  await prisma.$connect();
  const { createApp } = await import('../../app.js');
  const app = createApp({ recommendationEventOrigin: 'TEST' });
  httpServer = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => httpServer!.once('listening', resolve));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (httpServer) {
    await new Promise<void>((resolve, reject) => {
      httpServer!.close((error) => (error ? reject(error) : resolve()));
    });
    httpServer = null;
  }
  await cleanupNegotiationTests();
  await prisma.$disconnect();
});

async function postCreateRequestHttp(
  learnerId: string,
  buildId: string,
  body: Record<string, unknown> = defaultRequestInput(),
) {
  const token = tokenFor(learnerId, ['LEARNER']);
  return fetch(`${baseUrl}/api/project-help-sessions/learner/builds/${buildId}/request`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('PHS-02 project help session negotiation', { concurrency: 1 }, () => {
  describe('request creation (1-23)', () => {
    test('1 unauthenticated request creation is rejected with 401', async () => {
      const { build } = await setupAuthorLearnerProject('http-unauth');
      const response = await fetch(
        `${baseUrl}/api/project-help-sessions/learner/builds/${build.id}/request`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(defaultRequestInput()),
        },
      );
      assert.equal(response.status, 401);
    });

    test('2 wrong role request creation is rejected with 403', async () => {
      const { build } = await setupAuthorLearnerProject('http-role');
      const supplier = await createSupplier('no-learner');
      const token = tokenFor(supplier.id, ['SUPPLIER']);
      const response = await fetch(
        `${baseUrl}/api/project-help-sessions/learner/builds/${build.id}/request`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(defaultRequestInput()),
        },
      );
      assert.equal(response.status, 403);
    });

    test('3 non-owner build returns private 404', async () => {
      const { learner, build } = await setupAuthorLearnerProject('non-owner');
      const other = await createLearner('other-learner');
      await assertAppError(
        createProjectHelpSessionRequest(other.id, build.id, defaultRequestInput()),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
      assert.equal(learner.id !== other.id, true);
    });

    test('4 IN_PROGRESS build can create request', async () => {
      const { learner, build } = await setupAuthorLearnerProject('in-progress');
      const session = await createTrackedRequest(learner.id, build.id);
      assert.equal(session.status, 'PENDING');
    });

    test('5 PAUSED build can create request', async () => {
      const { learner, build } = await setupAuthorLearnerProject('paused');
      await pauseProjectBuild(build.id, learner.id);
      const session = await createTrackedRequest(learner.id, build.id);
      assert.equal(session.status, 'PENDING');
    });

    test('6 COMPLETED and ARCHIVED builds are rejected', async () => {
      const completedCtx = await setupAuthorLearnerProject('completed-build');
      await prisma.projectBuild.update({
        where: { id: completedCtx.build.id },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      await assertAppError(
        createProjectHelpSessionRequest(
          completedCtx.learner.id,
          completedCtx.build.id,
          defaultRequestInput(),
        ),
        { statusCode: 409, code: 'BUILD_NOT_ELIGIBLE' },
      );

      const archivedCtx = await setupAuthorLearnerProject('archived-build');
      await prisma.projectBuild.update({
        where: { id: archivedCtx.build.id },
        data: { status: 'ARCHIVED', archivedAt: new Date() },
      });
      await assertAppError(
        createProjectHelpSessionRequest(
          archivedCtx.learner.id,
          archivedCtx.build.id,
          defaultRequestInput(),
        ),
        { statusCode: 409, code: 'BUILD_NOT_ELIGIBLE' },
      );
    });

    test('7 disabled offering is rejected', async () => {
      const author = await createLearner('disabled-offering-author');
      const learner = await createLearner('disabled-offering-learner');
      const project = await createPublishedProject(author.id);
      await upsertAuthorHelpSessionSettings(project.id, author.id, {
        isEnabled: false,
        allow15Minutes: true,
        allow30Minutes: true,
        weeklyLimit: 3,
      });
      const offering = await prisma.projectHelpSessionOffering.findUnique({
        where: { projectId: project.id },
      });
      if (offering) {
        ids.offerings.push(offering.id);
      }
      const build = await createLearnerBuild(project.id, learner.id);
      await assertAppError(
        createProjectHelpSessionRequest(learner.id, build.id, defaultRequestInput()),
        { statusCode: 409, code: 'HELP_SESSIONS_DISABLED' },
      );
    });

    test('8 authorless project is rejected', async () => {
      const admin = await createAdmin('authorless-admin');
      const learner = await createLearner('authorless-learner');
      const project = await createPublishedProject(admin.id);
      const build = await createLearnerBuild(project.id, learner.id);
      await assertAppError(
        createProjectHelpSessionRequest(learner.id, build.id, defaultRequestInput()),
        { statusCode: 409, code: 'AUTHOR_UNAVAILABLE' },
      );
    });

    test('9 learner cannot request when they are the project author', async () => {
      const author = await createLearner('self-author');
      const project = await createPublishedProject(author.id);
      await enableOffering(project.id, author.id);
      const build = await createLearnerBuild(project.id, author.id);
      await assertAppError(
        createProjectHelpSessionRequest(author.id, build.id, defaultRequestInput()),
        { statusCode: 409, code: 'BUILD_NOT_ELIGIBLE' },
      );
    });

    test('10 invalid duration is rejected', async () => {
      const { learner, build } = await setupAuthorLearnerProject('invalid-duration');
      await assertAppError(
        createProjectHelpSessionRequest(
          learner.id,
          build.id,
          defaultRequestInput({ durationMinutes: 45 }),
        ),
        { statusCode: 400, code: 'DURATION_NOT_ALLOWED' },
      );
    });

    test('11 disabled duration in offering is rejected', async () => {
      const author = await createLearner('disabled-duration-author');
      const learner = await createLearner('disabled-duration-learner');
      const project = await createPublishedProject(author.id);
      await upsertAuthorHelpSessionSettings(project.id, author.id, {
        isEnabled: true,
        allow15Minutes: false,
        allow30Minutes: true,
        weeklyLimit: 3,
      });
      const offering = await prisma.projectHelpSessionOffering.findUnique({
        where: { projectId: project.id },
      });
      if (offering) {
        ids.offerings.push(offering.id);
      }
      const build = await createLearnerBuild(project.id, learner.id);
      await assertAppError(
        createProjectHelpSessionRequest(
          learner.id,
          build.id,
          defaultRequestInput({ durationMinutes: 15 }),
        ),
        { statusCode: 409, code: 'DURATION_NOT_ALLOWED' },
      );
    });

    test('12 problem description limits are enforced', async () => {
      const { learner, build } = await setupAuthorLearnerProject('description-limits');
      await assertAppError(
        createProjectHelpSessionRequest(
          learner.id,
          build.id,
          defaultRequestInput({ problemDescription: 'too short' }),
        ),
        { statusCode: 400, code: 'VALIDATION_ERROR' },
      );
      await assertAppError(
        createProjectHelpSessionRequest(
          learner.id,
          build.id,
          defaultRequestInput({
            problemDescription: `${'x'.repeat(501)} description overflow`,
          }),
        ),
        { statusCode: 400, code: 'VALIDATION_ERROR' },
      );
      await assertAppError(
        createProjectHelpSessionRequest(
          learner.id,
          build.id,
          defaultRequestInput({
            problemDescription: '<script>alert("x")</script> unsafe markup here',
          }),
        ),
        { statusCode: 400, code: 'VALIDATION_ERROR' },
      );
    });

    test('13 invalid timezone is rejected', async () => {
      const { learner, build } = await setupAuthorLearnerProject('invalid-timezone');
      const response = await postCreateRequestHttp(learner.id, build.id, {
        ...defaultRequestInput(),
        learnerTimeZone: 'Not/A/Timezone',
      });
      assert.equal(response.status, 400);
    });

    test('14 not exactly three proposed times is rejected', async () => {
      const { learner, build } = await setupAuthorLearnerProject('time-count');
      const response = await postCreateRequestHttp(learner.id, build.id, {
        ...defaultRequestInput(),
        proposedTimes: [futureIso(120), futureIso(180)],
      });
      assert.equal(response.status, 400);
    });

    test('15 duplicate normalized proposed times are rejected', async () => {
      const { learner, build } = await setupAuthorLearnerProject('duplicate-times');
      const duplicate = futureIso(120);
      const response = await postCreateRequestHttp(learner.id, build.id, {
        ...defaultRequestInput(),
        proposedTimes: [duplicate, duplicate, futureIso(180)],
      });
      assert.equal(response.status, 400);
    });

    test('16 past or too-soon proposed times are rejected', async () => {
      const { learner, build } = await setupAuthorLearnerProject('too-soon');
      const tooSoon = new Date(Date.now() + 30 * 60_000).toISOString();
      const response = await postCreateRequestHttp(learner.id, build.id, {
        ...defaultRequestInput(),
        proposedTimes: [tooSoon, futureIso(180), futureIso(240)],
      });
      assert.equal(response.status, 400);
    });

    test('17 beyond-horizon proposed times are rejected', async () => {
      const { learner, build } = await setupAuthorLearnerProject('beyond-horizon');
      const beyond = new Date(Date.now() + 61 * 24 * 60 * 60_000).toISOString();
      const response = await postCreateRequestHttp(learner.id, build.id, {
        ...defaultRequestInput(),
        proposedTimes: [beyond, futureIso(180), futureIso(240)],
      });
      assert.equal(response.status, 400);
    });

    test('17b project step uuid is accepted for same-project step', async () => {
      const { learner, build, project } = await setupAuthorLearnerProject('step-uuid');
      const step = await prisma.projectStep.findFirst({
        where: { projectId: project.id },
        orderBy: { stepNumber: 'asc' },
      });
      assert.ok(step);
      const response = await postCreateRequestHttp(learner.id, build.id, {
        ...defaultRequestInput(),
        projectStepId: step.id,
      });
      assert.equal(response.status, 201);
      const body = (await response.json()) as {
        data?: { id?: string; projectStep?: { id?: string } | null };
      };
      assert.equal(body.data?.projectStep?.id, step.id);
      assert.ok(body.data?.id);
      await trackSession(body.data!.id!);
    });

    test('17c project id cannot be used as build id in request path', async () => {
      const { learner, project } = await setupAuthorLearnerProject('project-as-build');
      const response = await postCreateRequestHttp(
        learner.id,
        project.id,
        defaultRequestInput(),
      );
      assert.equal(response.status, 400);
      const body = (await response.json()) as {
        error?: { code?: string; details?: { issues?: Array<{ path?: string }> } };
      };
      assert.equal(body.error?.code, 'VALIDATION_ERROR');
      assert.equal(body.error?.details?.issues?.[0]?.path, 'buildId');
    });

    test('18 cross-project step id is rejected', async () => {
      const { learner, build } = await setupAuthorLearnerProject('cross-step');
      const otherAuthor = await createLearner('other-step-author');
      const otherProject = await createPublishedProject(otherAuthor.id);
      const otherStep = await prisma.projectStep.create({
        data: {
          projectId: otherProject.id,
          stepNumber: 99,
          title: 'Other step',
          description: 'Other step description',
          reviewStatus: 'ACCEPTED',
        },
      });
      ids.steps.push(otherStep.id);
      await assertAppError(
        createProjectHelpSessionRequest(
          learner.id,
          build.id,
          defaultRequestInput({ projectStepId: otherStep.id }),
        ),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
    });

    test('19 successful request creates exactly three learner time options', async () => {
      const { learner, build } = await setupAuthorLearnerProject('three-options');
      const session = await createTrackedRequest(learner.id, build.id);
      const count = await timeOptionCount(session.id, 'LEARNER_PROPOSED');
      assert.equal(count, 3);
      assert.equal(session.timeOptions.length, 3);
    });

    test('20 successful request creates initial status history', async () => {
      const { learner, build } = await setupAuthorLearnerProject('status-history');
      const session = await createTrackedRequest(learner.id, build.id);
      const history = await prisma.projectHelpSessionStatusHistory.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
      });
      assert.equal(history.length, 1);
      assert.equal(history[0].fromStatus, null);
      assert.equal(history[0].toStatus, 'PENDING');
      assert.equal(history[0].actorId, learner.id);
    });

    test('21 successful request notifies author', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('notify-author');
      const before = await notificationCount(
        author.id,
        'PROJECT_HELP_SESSION_REQUESTED',
      );
      await createTrackedRequest(learner.id, build.id);
      const after = await notificationCount(
        author.id,
        'PROJECT_HELP_SESSION_REQUESTED',
      );
      assert.equal(after, before + 1);
    });

    test('22 active duplicate request is blocked', async () => {
      const { learner, build } = await setupAuthorLearnerProject('active-duplicate');
      await createTrackedRequest(learner.id, build.id);
      await assertAppError(
        createProjectHelpSessionRequest(learner.id, build.id, defaultRequestInput()),
        { statusCode: 409, code: 'ACTIVE_SESSION_EXISTS' },
      );
    });

    test('23 concurrent duplicate requests are blocked by activeKey', async () => {
      const { learner, build } = await setupAuthorLearnerProject('concurrent-duplicate');
      const results = await Promise.allSettled([
        createProjectHelpSessionRequest(learner.id, build.id, defaultRequestInput()),
        createProjectHelpSessionRequest(learner.id, build.id, defaultRequestInput()),
      ]);
      const successes = results.filter((result) => result.status === 'fulfilled');
      const failures = results.filter((result) => result.status === 'rejected');
      assert.equal(successes.length, 1);
      assert.equal(failures.length, 1);
      const failure = failures[0];
      assert.equal(failure.status, 'rejected');
      assert.ok(failure.reason instanceof AppError);
      assert.equal(failure.reason.code, 'ACTIVE_SESSION_EXISTS');
      await trackSession((successes[0] as PromiseFulfilledResult<{ id: string }>).value.id);
    });
  });

  describe('author response (24-38)', () => {
    test('24 unrelated author cannot read or action session', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('unrelated-author');
      const session = await createTrackedRequest(learner.id, build.id);
      const otherAuthor = await createLearner('other-author');
      await assertAppError(
        getAuthorProjectHelpSession(otherAuthor.id, session.id),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
      const option = learnerProposedOption(session);
      await assertAppError(
        authorAcceptProjectHelpSessionOption(otherAuthor.id, session.id, option.id),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
      assert.notEqual(otherAuthor.id, author.id);
    });

    test('25 approving admin cannot action session', async () => {
      const admin = await createAdmin('approving-admin');
      const { author, learner, build } = await setupAuthorLearnerProject(
        'admin-not-author',
        3,
        admin.id,
      );
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      await assertAppError(
        authorAcceptProjectHelpSessionOption(admin.id, session.id, option.id),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
      assert.notEqual(admin.id, author.id);
    });

    test('26 canonical author can accept one valid learner option', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('author-accept');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      const accepted = await authorAcceptProjectHelpSessionOption(
        author.id,
        session.id,
        option.id,
      );
      assert.equal(accepted.status, 'SCHEDULED');
      assert.equal(accepted.selectedTimeOptionId, option.id);
    });

    test('27 invalid option id is rejected', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('invalid-option');
      const session = await createTrackedRequest(learner.id, build.id);
      await assertAppError(
        authorAcceptProjectHelpSessionOption(author.id, session.id, 'clxxxxxxxxxxxxxxxxxxxxxxxxx'),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
    });

    test('28 option from another session is rejected', async () => {
      const ctxA = await setupAuthorLearnerProject('option-session-a');
      const ctxB = await setupAuthorLearnerProject('option-session-b');
      const sessionA = await createTrackedRequest(ctxA.learner.id, ctxA.build.id);
      const sessionB = await createTrackedRequest(ctxB.learner.id, ctxB.build.id);
      const foreignOption = learnerProposedOption(sessionB);
      await assertAppError(
        authorAcceptProjectHelpSessionOption(
          ctxA.author.id,
          sessionA.id,
          foreignOption.id,
        ),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
    });

    test('29 expired learner option is rejected on accept', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('expired-option');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      await prisma.projectHelpSessionTimeOption.update({
        where: { id: option.id },
        data: { startsAt: new Date(Date.now() - 2 * 60 * 60_000) },
      });
      await assertAppError(
        authorAcceptProjectHelpSessionOption(author.id, session.id, option.id),
        { statusCode: 409, code: 'INVALID_TIME_OPTIONS' },
      );
    });

    test('30 accept transitions session to SCHEDULED', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('accept-status');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      const accepted = await authorAcceptProjectHelpSessionOption(
        author.id,
        session.id,
        option.id,
      );
      assert.equal(accepted.status, 'SCHEDULED');
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(stored?.status, 'SCHEDULED');
    });

    test('31 accept sets selected option and confirmedAt', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('accept-fields');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(stored?.selectedTimeOptionId, option.id);
      assert.ok(stored?.confirmedAt);
    });

    test('32 accept populates zoom in DB but not in DTO', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('no-zoom');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      const accepted = await authorAcceptProjectHelpSessionOption(
        author.id,
        session.id,
        option.id,
      );
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.ok(stored?.zoomMeetingId);
      assert.ok(stored?.zoomJoinUrl);
      const serialized = JSON.stringify(accepted);
      assert.ok(!serialized.includes('zoomJoinUrl'));
      assert.ok(!serialized.includes('zoomMeetingId'));
    });

    test('33 author can propose one alternative', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('propose-alt');
      const session = await createTrackedRequest(learner.id, build.id);
      const proposed = await authorProposeProjectHelpSessionAlternative(
        author.id,
        session.id,
        uniqueFutureIso(300),
      );
      assert.equal(proposed.status, 'ALTERNATIVE_PROPOSED');
      assert.ok(proposed.alternativeProposedAt);
    });

    test('34 second alternative proposal does not create another option', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('second-alt');
      const session = await createTrackedRequest(learner.id, build.id);
      await authorProposeProjectHelpSessionAlternative(author.id, session.id, uniqueFutureIso(300));
      const before = await timeOptionCount(session.id, 'AUTHOR_ALTERNATIVE');
      assert.equal(before, 1);
      const again = await authorProposeProjectHelpSessionAlternative(
        author.id,
        session.id,
        uniqueFutureIso(360),
      );
      assert.equal(again.status, 'ALTERNATIVE_PROPOSED');
      const after = await timeOptionCount(session.id, 'AUTHOR_ALTERNATIVE');
      assert.equal(after, 1);
    });

    test('35 alternative creates one AUTHOR_ALTERNATIVE option', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('alt-option');
      const session = await createTrackedRequest(learner.id, build.id);
      await authorProposeProjectHelpSessionAlternative(author.id, session.id, uniqueFutureIso(300));
      const count = await timeOptionCount(session.id, 'AUTHOR_ALTERNATIVE');
      assert.equal(count, 1);
    });

    test('36 author can decline pending session', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('decline');
      const session = await createTrackedRequest(learner.id, build.id);
      const declined = await authorDeclineProjectHelpSession(
        author.id,
        session.id,
        'Not available this week',
      );
      assert.equal(declined.status, 'DECLINED');
      assert.equal(declined.declinedReason, 'Not available this week');
    });

    test('37 decline clears activeKey', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('decline-active-key');
      const session = await createTrackedRequest(learner.id, build.id);
      await authorDeclineProjectHelpSession(author.id, session.id);
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(stored?.activeKey, null);
    });

    test('38 decline notifies learner', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('decline-notify');
      const session = await createTrackedRequest(learner.id, build.id);
      const before = await notificationCount(learner.id, 'PROJECT_HELP_SESSION_DECLINED');
      await authorDeclineProjectHelpSession(author.id, session.id);
      const after = await notificationCount(learner.id, 'PROJECT_HELP_SESSION_DECLINED');
      assert.equal(after, before + 1);
    });
  });

  describe('learner alternative (39-45)', () => {
    async function setupAlternativeSession(suffix: string) {
      const ctx = await setupAuthorLearnerProject(suffix);
      const session = await createTrackedRequest(ctx.learner.id, ctx.build.id);
      await authorProposeProjectHelpSessionAlternative(
        ctx.author.id,
        session.id,
        uniqueFutureIso(300),
      );
      return { ...ctx, session };
    }

    test('39 owner can accept valid alternative', async () => {
      const { learner, author, session } = await setupAlternativeSession('accept-alt');
      const accepted = await learnerAcceptProjectHelpSessionAlternative(
        learner.id,
        session.id,
      );
      assert.equal(accepted.status, 'SCHEDULED');
      assert.ok(accepted.selectedTimeOptionId);
      assert.notEqual(author.id, learner.id);
    });

    test('40 alternative acceptance transitions to SCHEDULED', async () => {
      const { learner, session } = await setupAlternativeSession('alt-zoom-pending');
      const accepted = await learnerAcceptProjectHelpSessionAlternative(
        learner.id,
        session.id,
      );
      assert.equal(accepted.status, 'SCHEDULED');
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(stored?.status, 'SCHEDULED');
    });

    test('41 alternative acceptance notifies author', async () => {
      const { author, learner, session } = await setupAlternativeSession('alt-notify-author');
      const before = await notificationCount(
        author.id,
        'PROJECT_HELP_SESSION_ALTERNATIVE_ACCEPTED',
      );
      await learnerAcceptProjectHelpSessionAlternative(learner.id, session.id);
      const after = await notificationCount(
        author.id,
        'PROJECT_HELP_SESSION_ALTERNATIVE_ACCEPTED',
      );
      assert.equal(after, before + 1);
    });

    test('42 owner can reject alternative', async () => {
      const { learner, session } = await setupAlternativeSession('reject-alt');
      const rejected = await learnerRejectProjectHelpSessionAlternative(
        learner.id,
        session.id,
      );
      assert.equal(rejected.status, 'CANCELLED');
      assert.equal(rejected.cancellationReason, 'ALTERNATIVE_REJECTED');
    });

    test('43 rejection transitions to CANCELLED', async () => {
      const { learner, session } = await setupAlternativeSession('reject-status');
      await learnerRejectProjectHelpSessionAlternative(learner.id, session.id);
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(stored?.status, 'CANCELLED');
    });

    test('44 rejection clears activeKey', async () => {
      const { learner, session } = await setupAlternativeSession('reject-active-key');
      await learnerRejectProjectHelpSessionAlternative(learner.id, session.id);
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(stored?.activeKey, null);
    });

    test('45 unrelated learner gets private 404', async () => {
      const { learner, session } = await setupAlternativeSession('alt-private');
      const other = await createLearner('alt-other-learner');
      await assertAppError(
        learnerAcceptProjectHelpSessionAlternative(other.id, session.id),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
      await assertAppError(
        getLearnerProjectHelpSession(other.id, session.id),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
      assert.notEqual(other.id, learner.id);
    });
  });

  describe('capacity and overlap (46-50)', () => {
    test('46 weekly limit enforced at confirmation', async () => {
      const author = await createLearner('weekly-author');
      const learner1 = await createLearner('weekly-learner-1');
      const learner2 = await createLearner('weekly-learner-2');
      const project = await createPublishedProject(author.id);
      await enableOffering(project.id, author.id, 1);
      const build1 = await createLearnerBuild(project.id, learner1.id);
      const build2 = await createLearnerBuild(project.id, learner2.id);
      const slot = uniqueFutureIso();
      const session1 = await createTrackedRequest(learner1.id, build1.id, {
        proposedTimes: proposedTimesFromIso([
          slot,
          uniqueFutureIso(60),
          uniqueFutureIso(120),
        ]),
      });
      const option1 = learnerProposedOption(session1);
      const accepted1 = await authorAcceptProjectHelpSessionOption(
        author.id,
        session1.id,
        option1.id,
      );
      assert.equal(accepted1.status, 'SCHEDULED');

      const session2 = await createTrackedRequest(learner2.id, build2.id, {
        proposedTimes: proposedTimesFromIso([
          uniqueFutureIso(60),
          uniqueFutureIso(120),
          uniqueFutureIso(180),
        ]),
        durationMinutes: 30,
      });
      const option2 = learnerProposedOption(session2);
      await assertAppError(
        authorAcceptProjectHelpSessionOption(author.id, session2.id, option2.id),
        { statusCode: 409, code: 'WEEKLY_LIMIT_REACHED' },
      );
    });

    test('47 non-confirmed requests do not consume weekly capacity', async () => {
      const author = await createLearner('pending-capacity-author');
      const learner1 = await createLearner('pending-capacity-learner-1');
      const learner2 = await createLearner('pending-capacity-learner-2');
      const project = await createPublishedProject(author.id);
      await enableOffering(project.id, author.id, 1);
      const build1 = await createLearnerBuild(project.id, learner1.id);
      const build2 = await createLearnerBuild(project.id, learner2.id);
      await createTrackedRequest(learner1.id, build1.id);
      const session2 = await createTrackedRequest(learner2.id, build2.id);
      const option2 = learnerProposedOption(session2);
      const accepted = await authorAcceptProjectHelpSessionOption(
        author.id,
        session2.id,
        option2.id,
      );
      assert.equal(accepted.status, 'SCHEDULED');
    });

    test('48 overlapping confirmed slot is rejected', async () => {
      const author = await createLearner('overlap-author');
      const learner1 = await createLearner('overlap-learner-1');
      const learner2 = await createLearner('overlap-learner-2');
      const project = await createPublishedProject(author.id);
      await enableOffering(project.id, author.id, 5);
      const build1 = await createLearnerBuild(project.id, learner1.id);
      const build2 = await createLearnerBuild(project.id, learner2.id);
      const { times } = sharedSlotTimes();
      const session1 = await createTrackedRequest(learner1.id, build1.id, {
        proposedTimes: times,
        durationMinutes: 30,
      });
      const option1 = learnerProposedOption(session1);
      await authorAcceptProjectHelpSessionOption(author.id, session1.id, option1.id);

      const session2 = await createTrackedRequest(learner2.id, build2.id, {
        proposedTimes: times,
        durationMinutes: 30,
      });
      const option2 = learnerProposedOption(session2);
      await assertAppError(
        authorAcceptProjectHelpSessionOption(author.id, session2.id, option2.id),
        { statusCode: 409, code: 'TIME_SLOT_UNAVAILABLE' },
      );
    });

    test('49 adjacent non-overlapping slot is allowed', async () => {
      const author = await createLearner('adjacent-author');
      const learner1 = await createLearner('adjacent-learner-1');
      const learner2 = await createLearner('adjacent-learner-2');
      const project = await createPublishedProject(author.id);
      await enableOffering(project.id, author.id, 5);
      const build1 = await createLearnerBuild(project.id, learner1.id);
      const build2 = await createLearnerBuild(project.id, learner2.id);
      const base = nextSlotBase();
      const firstSlot = futureIso(base);
      const secondSlot = futureIso(base + 30);
      const session1 = await createTrackedRequest(learner1.id, build1.id, {
        proposedTimes: proposedTimesFromIso([
          firstSlot,
          futureIso(base + 60),
          futureIso(base + 120),
        ]),
        durationMinutes: 30,
      });
      const option1 = learnerProposedOption(session1);
      const accepted1 = await authorAcceptProjectHelpSessionOption(
        author.id,
        session1.id,
        option1.id,
      );
      assert.equal(accepted1.status, 'SCHEDULED');

      const session2 = await createTrackedRequest(learner2.id, build2.id, {
        proposedTimes: proposedTimesFromIso([
          secondSlot,
          futureIso(base + 90),
          futureIso(base + 150),
        ]),
        durationMinutes: 30,
      });
      const option2 = learnerProposedOption(session2);
      const accepted = await authorAcceptProjectHelpSessionOption(
        author.id,
        session2.id,
        option2.id,
      );
      assert.equal(accepted.status, 'SCHEDULED');
    });

    test('50 simultaneous overlap confirmations allow only one success', async () => {
      const author = await createLearner('simul-author');
      const learner1 = await createLearner('simul-learner-1');
      const learner2 = await createLearner('simul-learner-2');
      const project = await createPublishedProject(author.id);
      await enableOffering(project.id, author.id, 5);
      const build1 = await createLearnerBuild(project.id, learner1.id);
      const build2 = await createLearnerBuild(project.id, learner2.id);
      const { times } = sharedSlotTimes();
      const session1 = await createTrackedRequest(learner1.id, build1.id, {
        proposedTimes: times,
        durationMinutes: 30,
      });
      const session2 = await createTrackedRequest(learner2.id, build2.id, {
        proposedTimes: times,
        durationMinutes: 30,
      });
      const option1 = learnerProposedOption(session1);
      const option2 = learnerProposedOption(session2);
      const results = await Promise.allSettled([
        authorAcceptProjectHelpSessionOption(author.id, session1.id, option1.id),
        authorAcceptProjectHelpSessionOption(author.id, session2.id, option2.id),
      ]);
      const successes = results.filter((result) => result.status === 'fulfilled');
      const failures = results.filter((result) => result.status === 'rejected');
      assert.equal(successes.length, 1);
      assert.equal(failures.length, 1);
      const failure = failures[0];
      assert.equal(failure.status, 'rejected');
      assert.ok(failure.reason instanceof AppError);
      assert.equal(failure.reason.code, 'TIME_SLOT_UNAVAILABLE');
    });
  });

  describe('cancellation (51-58)', () => {
    test('51 learner can cancel active session', async () => {
      const { learner, build } = await setupAuthorLearnerProject('learner-cancel');
      const session = await createTrackedRequest(learner.id, build.id);
      const cancelled = await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: learner.id,
        actorRole: 'learner',
      });
      assert.equal(cancelled.status, 'CANCELLED');
      assert.equal(cancelled.cancelledByRole, 'LEARNER');
    });

    test('52 author can cancel active session', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('author-cancel');
      const session = await createTrackedRequest(learner.id, build.id);
      const cancelled = await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: author.id,
        actorRole: 'author',
      });
      assert.equal(cancelled.status, 'CANCELLED');
      assert.equal(cancelled.cancelledByRole, 'AUTHOR');
    });

    test('53 unrelated user cannot cancel session', async () => {
      const { learner, build } = await setupAuthorLearnerProject('cancel-unrelated');
      const session = await createTrackedRequest(learner.id, build.id);
      const other = await createLearner('cancel-other');
      await assertAppError(
        cancelProjectHelpSession({
          sessionId: session.id,
          actorId: other.id,
          actorRole: 'learner',
        }),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
    });

    test('54 terminal session cannot be cancelled again from invalid state', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('terminal-cancel');
      const session = await createTrackedRequest(learner.id, build.id);
      await authorDeclineProjectHelpSession(author.id, session.id);
      await assertAppError(
        cancelProjectHelpSession({
          sessionId: session.id,
          actorId: learner.id,
          actorRole: 'learner',
        }),
        { statusCode: 409, code: 'HELP_SESSION_INVALID_STATE' },
      );
      const cancelledSession = await createTrackedRequest(learner.id, build.id);
      await cancelProjectHelpSession({
        sessionId: cancelledSession.id,
        actorId: learner.id,
        actorRole: 'learner',
      });
      const again = await cancelProjectHelpSession({
        sessionId: cancelledSession.id,
        actorId: learner.id,
        actorRole: 'learner',
      });
      assert.equal(again.status, 'CANCELLED');
    });

    test('55 cancellation sets actor reason and time', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('cancel-fields');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: author.id,
        actorRole: 'author',
        reason: 'Schedule changed',
      });
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(stored?.cancelledById, author.id);
      assert.equal(stored?.cancellationReason, 'Schedule changed');
      assert.ok(stored?.cancelledAt);
      const learnerView = await getLearnerProjectHelpSession(learner.id, session.id);
      assert.equal(learnerView?.cancelledByRole, 'AUTHOR');
      const authorView = await getAuthorProjectHelpSession(author.id, session.id);
      assert.equal(authorView?.cancelledByRole, 'AUTHOR');
    });

    test('56 cancellation clears activeKey', async () => {
      const { learner, build } = await setupAuthorLearnerProject('cancel-active-key');
      const session = await createTrackedRequest(learner.id, build.id);
      await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: learner.id,
        actorRole: 'learner',
      });
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(stored?.activeKey, null);
    });

    test('57 cancellation notifies other party', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('cancel-notify');
      const session = await createTrackedRequest(learner.id, build.id);
      const before = await notificationCount(author.id, 'PROJECT_HELP_SESSION_CANCELLED');
      await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: learner.id,
        actorRole: 'learner',
      });
      const after = await notificationCount(author.id, 'PROJECT_HELP_SESSION_CANCELLED');
      assert.equal(after, before + 1);
    });

    test('58 scheduled cancellation clears join URL after Zoom delete', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('cancel-zoom');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const before = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.ok(before?.zoomMeetingId);
      assert.ok(before?.zoomJoinUrl);
      await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: learner.id,
        actorRole: 'learner',
        reason: 'Cannot attend',
      });
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
      });
      assert.equal(stored?.status, 'CANCELLED');
      assert.ok(stored?.zoomMeetingId);
      assert.equal(stored?.zoomJoinUrl, null);
    });
  });

  describe('queries and privacy (59-67)', () => {
    test('59 learner list returns only own sessions', async () => {
      const ctxA = await setupAuthorLearnerProject('list-learner-a');
      const ctxB = await setupAuthorLearnerProject('list-learner-b');
      const sessionA = await createTrackedRequest(ctxA.learner.id, ctxA.build.id);
      await createTrackedRequest(ctxB.learner.id, ctxB.build.id);
      const list = await listLearnerProjectHelpSessionViews({
        learnerId: ctxA.learner.id,
        page: 1,
        limit: 20,
      });
      assert.ok(list.items.every((item) => item.id === sessionA.id));
      assert.equal(list.items.length, 1);
    });

    test('59b learner list can filter by buildId', async () => {
      const ctx = await setupAuthorLearnerProject('list-build-filter');
      const session = await createTrackedRequest(ctx.learner.id, ctx.build.id);
      const other = await setupAuthorLearnerProject('list-build-filter-other');
      await createTrackedRequest(other.learner.id, other.build.id);
      const list = await listLearnerProjectHelpSessionViews({
        learnerId: ctx.learner.id,
        buildId: ctx.build.id,
        page: 1,
        limit: 20,
      });
      assert.equal(list.items.length, 1);
      assert.equal(list.items[0]?.id, session.id);
    });

    test('60 author list returns only authored sessions', async () => {
      const ctxA = await setupAuthorLearnerProject('list-author-a');
      const ctxB = await setupAuthorLearnerProject('list-author-b');
      const sessionA = await createTrackedRequest(ctxA.learner.id, ctxA.build.id);
      await createTrackedRequest(ctxB.learner.id, ctxB.build.id);
      const list = await listAuthorProjectHelpSessionViews({
        authorId: ctxA.author.id,
        page: 1,
        limit: 20,
      });
      assert.ok(list.items.every((item) => item.id === sessionA.id));
      assert.equal(list.items.length, 1);
    });

    test('61 private detail returns allowedActions', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('allowed-actions');
      const session = await createTrackedRequest(learner.id, build.id);
      const learnerView = await getLearnerProjectHelpSession(learner.id, session.id);
      const authorView = await getAuthorProjectHelpSession(author.id, session.id);
      const learnerActions =
        learnerView.allowedActions as ProjectHelpSessionLearnerAllowedActions;
      const authorActions =
        authorView.allowedActions as ProjectHelpSessionAuthorAllowedActions;
      assert.equal(learnerActions.canCancel, true);
      assert.equal(learnerActions.canAcceptAlternative, false);
      assert.equal(authorActions.canAcceptOption, true);
      assert.equal(authorActions.canProposeAlternative, true);
    });

    test('62 public project API exposes no session data', async () => {
      const { author, learner, build, project } = await setupAuthorLearnerProject('public-api');
      await createTrackedRequest(learner.id, build.id);
      const response = await fetch(`${baseUrl}/api/learning-projects/${project.id}`);
      assert.equal(response.status, 200);
      const body = await response.json();
      const serialized = JSON.stringify(body);
      assert.ok(!serialized.includes('problemDescription'));
      assert.ok(!serialized.includes('helpSession'));
      assert.ok(!serialized.includes('timeOptions'));
      assert.notEqual(learner.email, serialized);
    });

    test('63 DTO exposes no email or phone', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('dto-privacy');
      const session = await createTrackedRequest(learner.id, build.id);
      const learnerView = await getLearnerProjectHelpSession(learner.id, session.id);
      const serialized = JSON.stringify(learnerView);
      assert.ok(!serialized.includes('@impactloop.test'));
      assert.ok(!serialized.includes('+970'));
      const authorRecord = await prisma.user.findUnique({ where: { id: author.id } });
      assert.ok(authorRecord?.email);
      assert.ok(!serialized.includes(authorRecord!.email));
    });

    test('64 DTO exposes no activeKey', async () => {
      const { learner, build } = await setupAuthorLearnerProject('dto-active-key');
      const session = await createTrackedRequest(learner.id, build.id);
      const view = await getLearnerProjectHelpSession(learner.id, session.id);
      const serialized = JSON.stringify(view);
      assert.ok(!serialized.includes('activeKey'));
      assert.ok(!serialized.includes('build:'));
    });

    test('65 DTO exposes no zoom start URL or token fields', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('dto-zoom');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      const accepted = await authorAcceptProjectHelpSessionOption(
        author.id,
        session.id,
        option.id,
      );
      const serialized = JSON.stringify(accepted);
      assert.ok(!serialized.includes('zoomJoinUrl'));
      assert.ok(!serialized.includes('zoom_start_url'));
      assert.ok(!serialized.includes('access_token'));
      assert.equal(accepted.meetingReady, true);
      assert.equal(accepted.provider, 'ZOOM');
      assert.ok(accepted.joinAvailableAt);
      assert.ok(accepted.joinClosesAt);
      assert.ok(!serialized.includes('startUrl'));
    });

    test('66 private session endpoints set Cache-Control no-store', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('cache-control');
      const session = await createTrackedRequest(learner.id, build.id);
      const learnerToken = tokenFor(learner.id, ['LEARNER']);
      const authorToken = tokenFor(author.id, ['LEARNER']);
      const routes = [
        {
          url: `${baseUrl}/api/project-help-sessions/learner`,
          headers: { Authorization: `Bearer ${learnerToken}` },
        },
        {
          url: `${baseUrl}/api/project-help-sessions/learner/${session.id}`,
          headers: { Authorization: `Bearer ${learnerToken}` },
        },
        {
          url: `${baseUrl}/api/project-help-sessions/author`,
          headers: { Authorization: `Bearer ${authorToken}` },
        },
        {
          url: `${baseUrl}/api/project-help-sessions/author/${session.id}`,
          headers: { Authorization: `Bearer ${authorToken}` },
        },
      ];
      for (const route of routes) {
        const response = await fetch(route.url, { headers: route.headers });
        assert.equal(response.status, 200);
        assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      }
    });

    test('67 pagination and status filtering work', async () => {
      const { author, learner, build, project } = await setupAuthorLearnerProject('pagination');
      const pending = await createTrackedRequest(learner.id, build.id);
      const learner2 = await createLearner('pagination-learner-2');
      const build2 = await createLearnerBuild(project.id, learner2.id);
      const declinedSession = await createTrackedRequest(learner2.id, build2.id);
      await authorDeclineProjectHelpSession(author.id, declinedSession.id);
      const pendingList = await listLearnerProjectHelpSessionViews({
        learnerId: learner.id,
        status: 'PENDING',
        page: 1,
        limit: 10,
      });
      assert.equal(pendingList.items.length, 1);
      assert.equal(pendingList.items[0].id, pending.id);
      const authorFiltered = await listAuthorProjectHelpSessionViews({
        authorId: author.id,
        projectId: project.id,
        page: 1,
        limit: 1,
      });
      assert.equal(authorFiltered.pagination.limit, 1);
      assert.equal(authorFiltered.items.length, 1);
    });
  });

  describe('idempotency and history (68-70)', () => {
    test('68 invalid repeated transition creates no duplicate history', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('history-dup');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const before = await historyCount(session.id);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const after = await historyCount(session.id);
      assert.equal(after, before);
    });

    test('69 invalid repeated transition creates no duplicate notification', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('notify-dup');
      const session = await createTrackedRequest(learner.id, build.id);
      const option = learnerProposedOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const before = await notificationCount(learner.id, 'PROJECT_HELP_SESSION_ACCEPTED');
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const after = await notificationCount(learner.id, 'PROJECT_HELP_SESSION_ACCEPTED');
      assert.equal(after, before);
    });

    test('70 every successful transition creates one history record', async () => {
      const { author, learner, build } = await setupAuthorLearnerProject('history-per-transition');
      const session = await createTrackedRequest(learner.id, build.id);
      assert.equal(await historyCount(session.id), 1);

      await authorProposeProjectHelpSessionAlternative(author.id, session.id, uniqueFutureIso(300));
      assert.equal(await historyCount(session.id), 2);

      await learnerAcceptProjectHelpSessionAlternative(learner.id, session.id);
      assert.equal(await historyCount(session.id), 4);

      await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: learner.id,
        actorRole: 'learner',
        reason: 'Done testing',
      });
      assert.equal(await historyCount(session.id), 5);

      const history = await prisma.projectHelpSessionStatusHistory.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
      });
      assert.deepEqual(
        history.map((row) => row.toStatus),
        ['PENDING', 'ALTERNATIVE_PROPOSED', 'ZOOM_PENDING', 'SCHEDULED', 'CANCELLED'],
      );
    });
  });
});
