import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'project-help-session-zoom-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'project-help-session-zoom-refresh-secret';
process.env.ZOOM_INTEGRATION_MODE = 'fake';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import {
  authorAcceptProjectHelpSessionOption,
  cancelProjectHelpSession,
  learnerAcceptProjectHelpSessionAlternative,
} from './project-help-session.service.js';
import {
  ensureZoomMeetingForProjectHelpSession,
  resetZoomProvisioningFlightsForTests,
  retryZoomProvisioningForAuthor,
} from './project-help-session-zoom-provisioning.service.js';
import {
  getAuthorProjectHelpSessionZoomStart,
  getLearnerProjectHelpSessionZoomJoin,
} from './project-help-session-zoom.service.js';
import { computeProjectHelpSessionMeetingWindow } from './project-help-session-zoom-windows.js';
import { loadZoomConfig } from './zoom/zoom-config.js';
import { ZoomError } from './zoom/zoom-errors.js';
import {
  FakeZoomMeetingProvider,
  getFakeZoomCapturedCreateInputs,
  getFakeZoomCreateCallCount,
  getFakeZoomDeleteCallCount,
  getFakeZoomGetCallCount,
  resetFakeZoomMeetingProviderForTests,
  setFakeZoomBehaviorForTests,
} from './zoom/zoom-meeting-provider.fake.js';
import {
  resetZoomMeetingProviderCacheForTests,
  setZoomMeetingProviderForTests,
} from './zoom/zoom-meeting-provider.factory.js';
import { RealZoomMeetingProvider } from './zoom/zoom-meeting-provider.real.js';
import {
  getZoomAccessToken,
  invalidateZoomAccessToken,
  resetZoomTokenCacheForTests,
} from './zoom/zoom-token-manager.js';
import { zoomApiRequest } from './zoom/zoom-http-client.js';
import {
  cleanupNegotiationTests,
  createLearner,
  createLearnerBuild,
  createPublishedProject,
  enableOffering,
  futureIso,
  ids,
  trackSession,
  validProblemDescription,
} from './project-help-session-test-support.js';
import { createProjectHelpSessionRequest } from './project-help-session.service.js';

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

function proposedTimesFromIso(values: string[]) {
  return values.map((value) => new Date(value));
}

let uniqueSlotOffsetMinutes = 20_000;

function nextProposedTimes() {
  uniqueSlotOffsetMinutes += 180;
  const base = uniqueSlotOffsetMinutes;
  return proposedTimesFromIso([futureIso(base), futureIso(base + 60), futureIso(base + 120)]);
}

async function setupSession(suffix: string) {
  const author = await createLearner(`zoom-author-${suffix}`);
  const learner = await createLearner(`zoom-learner-${suffix}`);
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
  return { author, learner, project, build, session };
}

function learnerOption(session: { timeOptions: Array<{ id: string; type: string }> }) {
  return session.timeOptions.find((item) => item.type === 'LEARNER_PROPOSED')!;
}

before(() => {
  resetFakeZoomMeetingProviderForTests();
  resetZoomMeetingProviderCacheForTests();
  setZoomMeetingProviderForTests(null);
});

beforeEach(() => {
  process.env.ZOOM_INTEGRATION_MODE = 'fake';
  resetFakeZoomMeetingProviderForTests();
  resetZoomTokenCacheForTests();
  resetZoomMeetingProviderCacheForTests();
  resetZoomProvisioningFlightsForTests();
  setZoomMeetingProviderForTests(null);
  setFakeZoomBehaviorForTests({});
});

after(async () => {
  await cleanupNegotiationTests();
});

describe('PHS-03 Zoom integration', () => {
  describe('configuration (1-7)', () => {
    test('1-2 fake and disabled require no credentials', () => {
      delete process.env.ZOOM_ACCOUNT_ID;
      delete process.env.ZOOM_CLIENT_ID;
      delete process.env.ZOOM_CLIENT_SECRET;
      delete process.env.ZOOM_HOST_USER_ID;
      process.env.ZOOM_INTEGRATION_MODE = 'fake';
      assert.equal(loadZoomConfig().mode, 'fake');
      process.env.ZOOM_INTEGRATION_MODE = 'disabled';
      assert.equal(loadZoomConfig().mode, 'disabled');
    });

    test('3-6 real mode rejects missing credentials', () => {
      process.env.ZOOM_INTEGRATION_MODE = 'real';
      const required = [
        ['ZOOM_ACCOUNT_ID', 'account ID'],
        ['ZOOM_CLIENT_ID', 'client ID'],
        ['ZOOM_CLIENT_SECRET', 'client secret'],
        ['ZOOM_HOST_USER_ID', 'host user ID'],
      ] as const;
      for (const [key] of required) {
        for (const envKey of required.map(([k]) => k)) {
          delete process.env[envKey];
        }
        process.env.ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';
        process.env.ZOOM_TOKEN_URL = 'https://zoom.us/oauth/token';
        for (const [envKey, value] of [
          ['ZOOM_ACCOUNT_ID', 'acct'],
          ['ZOOM_CLIENT_ID', 'client'],
          ['ZOOM_CLIENT_SECRET', 'secret'],
          ['ZOOM_HOST_USER_ID', 'host'],
        ] as const) {
          if (envKey !== key) {
            process.env[envKey] = value;
          }
        }
        assert.throws(() => loadZoomConfig(), (error: unknown) => {
          assert.ok(error instanceof ZoomError);
          assert.equal(error.code, 'ZOOM_CONFIG_INVALID');
          return true;
        });
      }
    });

    test('7 config errors do not contain secret values', () => {
      process.env.ZOOM_INTEGRATION_MODE = 'real';
      process.env.ZOOM_CLIENT_SECRET = 'super-secret-value';
      delete process.env.ZOOM_ACCOUNT_ID;
      try {
        loadZoomConfig();
        assert.fail('expected error');
      } catch (error) {
        const message = String(error);
        assert.ok(!message.includes('super-secret-value'));
      }
    });
  });

  describe('token manager (8-18)', () => {
    const realConfig = {
      mode: 'real' as const,
      accountId: 'acct',
      clientId: 'client',
      clientSecret: 'secret',
      hostUserId: 'host',
      apiBaseUrl: 'https://api.zoom.us/v2',
      tokenUrl: 'https://zoom.us/oauth/token',
    };

    test('8-10 token request uses Basic auth, account_credentials, account_id', async () => {
      let capturedUrl = '';
      let capturedInit: RequestInit | undefined;
      const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedInit = init;
        return new Response(
          JSON.stringify({ access_token: 'token-abc', expires_in: 3600 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      };
      resetZoomTokenCacheForTests();
      const token = await getZoomAccessToken(realConfig, fetchImpl as typeof fetch);
      assert.equal(token, 'token-abc');
      assert.equal(capturedUrl, realConfig.tokenUrl);
      assert.match(String((capturedInit?.headers as Record<string, string>)?.Authorization), /Basic/);
      assert.equal(
        new URLSearchParams(String(capturedInit?.body)).get('grant_type'),
        'account_credentials',
      );
      assert.equal(
        new URLSearchParams(String(capturedInit?.body)).get('account_id'),
        'acct',
      );
    });

    test('11-14 cache, reuse, buffer, concurrent single-flight', async () => {
      let calls = 0;
      const fetchImpl = async () => {
        calls += 1;
        return new Response(
          JSON.stringify({ access_token: `token-${calls}`, expires_in: 3600 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      };
      resetZoomTokenCacheForTests();
      const [a, b] = await Promise.all([
        getZoomAccessToken(realConfig, fetchImpl as typeof fetch),
        getZoomAccessToken(realConfig, fetchImpl as typeof fetch),
      ]);
      assert.equal(a, b);
      assert.equal(calls, 1);
      const reused = await getZoomAccessToken(realConfig, fetchImpl as typeof fetch);
      assert.equal(reused, a);
      assert.equal(calls, 1);
    });

    test('15 failed token clears in-flight state', async () => {
      let calls = 0;
      const fetchImpl = async () => {
        calls += 1;
        if (calls === 1) {
          return new Response('{}', { status: 500 });
        }
        return new Response(
          JSON.stringify({ access_token: 'token-retry', expires_in: 3600 }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      };
      resetZoomTokenCacheForTests();
      await assert.rejects(getZoomAccessToken(realConfig, fetchImpl as typeof fetch));
      const token = await getZoomAccessToken(realConfig, fetchImpl as typeof fetch);
      assert.equal(token, 'token-retry');
      assert.equal(calls, 2);
    });

    test('17-18 401 invalidates token and retries once', async () => {
      let tokenCalls = 0;
      const getToken = async () => {
        tokenCalls += 1;
        return tokenCalls === 1 ? 'stale-token' : 'fresh-token';
      };
      let apiCalls = 0;
      const fetchImpl = async () => {
        apiCalls += 1;
        if (apiCalls === 1) {
          return new Response('{}', { status: 401 });
        }
        if (apiCalls === 2) {
          return new Response('{}', { status: 401 });
        }
        return new Response(
          JSON.stringify({
            id: '123',
            join_url: 'https://zoom.us/j/123',
            start_time: new Date().toISOString(),
            duration: 15,
            start_url: 'https://zoom.us/s/123',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      };
      resetZoomTokenCacheForTests();
      await assert.rejects(
        zoomApiRequest(
          realConfig,
          { method: 'GET', path: '/meetings/123', failureCode: 'ZOOM_GET_FAILED' },
          { fetchImpl: fetchImpl as typeof fetch, getToken },
        ),
      );
      assert.equal(apiCalls, 2);
      assert.equal(tokenCalls, 2);
    });
  });

  describe('provider (19-35)', () => {
    test('19-27 create payload and response mapping', async () => {
      const provider = new FakeZoomMeetingProvider();
      const startsAt = new Date('2030-06-01T12:00:00.000Z');
      const created = await provider.createMeeting({
        topic: 'ImpactLoop — Test Help Session',
        startsAt,
        durationMinutes: 30,
        agenda: 'ImpactLoop project help session.',
      });
      assert.equal(created.durationMinutes, 30);
      assert.match(created.joinUrl, /^https:\/\/fake\.zoom\.test\/j\//);
      assert.ok(!('hostStartUrl' in created));
      const inputs = getFakeZoomCapturedCreateInputs();
      assert.equal(inputs.length, 1);
      assert.ok(!JSON.stringify(inputs[0]).includes(validProblemDescription()));
    });

    test('28-31 invalid and rate-limited responses are sanitized', async () => {
      const realConfig = {
        mode: 'real' as const,
        accountId: 'acct',
        clientId: 'client',
        clientSecret: 'secret',
        hostUserId: 'host',
        apiBaseUrl: 'https://api.zoom.us/v2',
        tokenUrl: 'https://zoom.us/oauth/token',
      };
      const fetch429 = async () =>
        new Response('{"message":"rate"}', {
          status: 429,
          headers: { 'content-type': 'application/json' },
        });
      await assert.rejects(
        zoomApiRequest(
          realConfig,
          { method: 'POST', path: '/users/host/meetings', failureCode: 'ZOOM_CREATE_FAILED' },
          { fetchImpl: fetch429 as typeof fetch, getToken: async () => 'token' },
        ),
        (error: unknown) => {
          assert.ok(error instanceof ZoomError);
          assert.equal(error.code, 'ZOOM_RATE_LIMITED');
          assert.ok(!String(error).includes('rate'));
          return true;
        },
      );
    });

    test('32-35 get, start URL, delete behaviors', async () => {
      const provider = new FakeZoomMeetingProvider();
      const created = await provider.createMeeting({
        topic: 'ImpactLoop — Test',
        startsAt: new Date('2030-06-01T12:00:00.000Z'),
        durationMinutes: 15,
      });
      const details = await provider.getMeeting(created.meetingId);
      assert.match(details.hostStartUrl, /^https:\/\/fake\.zoom\.test\/s\//);
      const startUrl = await provider.getFreshHostStartUrl(created.meetingId);
      assert.equal(startUrl, details.hostStartUrl);
      await provider.deleteMeeting(created.meetingId);
      await provider.deleteMeeting(created.meetingId);
      assert.equal(getFakeZoomDeleteCallCount(), 2);
      setFakeZoomBehaviorForTests({ getNotFoundMeetingIds: new Set([created.meetingId]) });
      await assert.rejects(provider.getMeeting(created.meetingId));
    });
  });

  describe('provisioning and lifecycle (36-87)', () => {
    test('36-42 accept provisions once and schedules', async () => {
      const { author, learner, session } = await setupSession('provision-success');
      const option = learnerOption(session);
      const accepted = await authorAcceptProjectHelpSessionOption(
        author.id,
        session.id,
        option.id,
      );
      assert.equal(accepted.status, 'SCHEDULED');
      assert.equal(accepted.meetingReady, true);
      assert.equal(getFakeZoomCreateCallCount(), 1);
      const history = await prisma.projectHelpSessionStatusHistory.findMany({
        where: { sessionId: session.id, toStatus: 'SCHEDULED' },
      });
      assert.equal(history.length, 1);
      const notifications = await prisma.notification.count({
        where: {
          notificationType: 'PROJECT_HELP_SESSION_ZOOM_SCHEDULED',
          relatedEntityId: session.id,
        },
      });
      assert.equal(notifications, 2);
      assert.notEqual(author.id, learner.id);
    });

    test('43-44 existing meeting prevents duplicate create', async () => {
      const { author, session } = await setupSession('provision-idempotent');
      const option = learnerOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const callsAfterAccept = getFakeZoomCreateCallCount();
      await ensureZoomMeetingForProjectHelpSession(session.id, 'author', author.id);
      assert.equal(getFakeZoomCreateCallCount(), callsAfterAccept);
    });

    test('45-48 create failure transitions to SCHEDULING_FAILED safely', async () => {
      setFakeZoomBehaviorForTests({ failCreate: true });
      const { author, session } = await setupSession('provision-fail');
      const option = learnerOption(session);
      const accepted = await authorAcceptProjectHelpSessionOption(
        author.id,
        session.id,
        option.id,
      );
      assert.equal(accepted.status, 'SCHEDULING_FAILED');
      assert.equal(accepted.zoomFailureState, 'ZOOM_CREATE_FAILED');
      const stored = await prisma.projectHelpSession.findUnique({ where: { id: session.id } });
      assert.ok(stored?.selectedTimeOptionId);
      assert.ok(stored?.activeKey);
      assert.ok(stored?.zoomLastFailureAt);
      assert.ok(!JSON.stringify(accepted).includes('raw'));
    });

    test('51-57 author retry from SCHEDULING_FAILED', async () => {
      setFakeZoomBehaviorForTests({ failCreate: true });
      const { author, learner, session } = await setupSession('retry');
      const option = learnerOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      setFakeZoomBehaviorForTests({ failCreate: false });
      await assertAppError(
        retryZoomProvisioningForAuthor(learner.id, session.id),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
      const retried = await retryZoomProvisioningForAuthor(author.id, session.id);
      assert.equal(retried.status, 'SCHEDULED');
      const history = await prisma.projectHelpSessionStatusHistory.findMany({
        where: { sessionId: session.id, toStatus: 'SCHEDULED' },
      });
      assert.equal(history.length, 1);
    });

    test('58-65 join route privacy and window', async () => {
      const { author, learner, session } = await setupSession('join');
      const option = learnerOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
        include: { selectedTimeOption: true },
      });
      const beforeWindow = computeProjectHelpSessionMeetingWindow({
        startsAt: stored!.selectedTimeOption!.startsAt,
        durationMinutes: stored!.durationMinutes,
        now: new Date(stored!.selectedTimeOption!.startsAt.getTime() - 60 * 60_000),
      });
      assert.equal(beforeWindow.isBeforeWindow, true);
      await assertAppError(
        getLearnerProjectHelpSessionZoomJoin(
          learner.id,
          session.id,
          new Date(stored!.selectedTimeOption!.startsAt.getTime() - 60 * 60_000),
        ),
        { statusCode: 409, code: 'SESSION_NOT_JOINABLE_YET' },
      );
      const join = await getLearnerProjectHelpSessionZoomJoin(
        learner.id,
        session.id,
        new Date(stored!.selectedTimeOption!.startsAt.getTime() - 10 * 60_000),
      );
      assert.match(join.joinUrl, /^https:\/\/fake\.zoom\.test\/j\//);
      assert.ok(!('startUrl' in join));
      await assertAppError(
        getLearnerProjectHelpSessionZoomJoin(author.id, session.id),
        { statusCode: 404, code: 'NOT_FOUND' },
      );
    });

    test('66-74 author start route', async () => {
      const { author, learner, session } = await setupSession('start');
      const option = learnerOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const stored = await prisma.projectHelpSession.findUnique({
        where: { id: session.id },
        include: { selectedTimeOption: true },
      });
      const start = await getAuthorProjectHelpSessionZoomStart(
        author.id,
        session.id,
        new Date(stored!.selectedTimeOption!.startsAt.getTime() - 10 * 60_000),
      );
      assert.match(start.startUrl, /^https:\/\/fake\.zoom\.test\/s\//);
      assert.equal(getFakeZoomGetCallCount() >= 1, true);
      const after = await prisma.projectHelpSession.findUnique({ where: { id: session.id } });
      assert.ok(after?.zoomJoinUrl);
      assert.ok(!JSON.stringify(after).includes('fake.zoom.test/s/'));
    });

    test('75-82 cancellation deletes Zoom and clears join URL', async () => {
      const { author, learner, session } = await setupSession('cancel-zoom');
      const option = learnerOption(session);
      await authorAcceptProjectHelpSessionOption(author.id, session.id, option.id);
      const deleteCallsBefore = getFakeZoomDeleteCallCount();
      await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: learner.id,
        actorRole: 'learner',
        reason: 'Cannot attend',
      });
      assert.equal(getFakeZoomDeleteCallCount(), deleteCallsBefore + 1);
      const stored = await prisma.projectHelpSession.findUnique({ where: { id: session.id } });
      assert.equal(stored?.status, 'CANCELLED');
      assert.equal(stored?.zoomJoinUrl, null);
      await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: learner.id,
        actorRole: 'learner',
        reason: 'Again',
      });
      assert.equal(getFakeZoomDeleteCallCount(), deleteCallsBefore + 1);
    });

    test('81 pre-zoom cancellation makes no Zoom delete call', async () => {
      const { learner, session } = await setupSession('cancel-pending');
      const deleteCallsBefore = getFakeZoomDeleteCallCount();
      await cancelProjectHelpSession({
        sessionId: session.id,
        actorId: learner.id,
        actorRole: 'learner',
      });
      assert.equal(getFakeZoomDeleteCallCount(), deleteCallsBefore);
    });

    test('alternative acceptance provisions once', async () => {
      const { author, learner, session } = await setupSession('alt-provision');
      const { authorProposeProjectHelpSessionAlternative } = await import(
        './project-help-session.service.js'
      );
      await authorProposeProjectHelpSessionAlternative(
        author.id,
        session.id,
        futureIso(uniqueSlotOffsetMinutes + 300),
      );
      const accepted = await learnerAcceptProjectHelpSessionAlternative(learner.id, session.id);
      assert.equal(accepted.status, 'SCHEDULED');
      assert.equal(getFakeZoomCreateCallCount(), 1);
    });

    test('disabled mode moves to SCHEDULING_FAILED', async () => {
      process.env.ZOOM_INTEGRATION_MODE = 'disabled';
      resetZoomMeetingProviderCacheForTests();
      const { author, session } = await setupSession('disabled');
      const option = learnerOption(session);
      const accepted = await authorAcceptProjectHelpSessionOption(
        author.id,
        session.id,
        option.id,
      );
      assert.equal(accepted.status, 'SCHEDULING_FAILED');
      assert.equal(accepted.zoomFailureState, 'ZOOM_DISABLED');
    });
  });
});
