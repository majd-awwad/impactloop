import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, beforeEach, describe, test } from 'node:test';

process.env.JWT_ACCESS_SECRET ??= 'project-help-session-zoom-access-secret';
process.env.JWT_REFRESH_SECRET ??= 'project-help-session-zoom-refresh-secret';
process.env.ZOOM_INTEGRATION_MODE = 'fake';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { signAccessToken } from '../../utils/jwt.js';
import { mapProjectHelpSessionPrivateDto } from './project-help-session.dto.js';
import { findProjectHelpSessionDetail } from './project-help-session.repository.js';
import { setProjectHelpSessionNowForTests } from './project-help-session-clock.js';
import { authorAcceptProjectHelpSessionOption } from './project-help-session.service.js';
import {
  ensureZoomMeetingForProjectHelpSession,
  resetZoomProvisioningFlightsForTests,
} from './project-help-session-zoom-provisioning.service.js';
import {
  getAuthorProjectHelpSessionZoomJoin,
  getLearnerProjectHelpSessionZoomJoin,
} from './project-help-session-zoom.service.js';
import { RealZoomMeetingProvider } from './zoom/zoom-meeting-provider.real.js';
import {
  getFakeZoomCreateCallCount,
  resetFakeZoomMeetingProviderForTests,
  setFakeZoomBehaviorForTests,
} from './zoom/zoom-meeting-provider.fake.js';
import {
  resetZoomMeetingProviderCacheForTests,
  setZoomMeetingProviderForTests,
} from './zoom/zoom-meeting-provider.factory.js';
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

let uniqueSlotOffsetMinutes = 30_000;
let baseUrl = '';
let server: Server | null = null;

const nextProposedTimes = () => {
  uniqueSlotOffsetMinutes += 180;
  return [
    futureIso(uniqueSlotOffsetMinutes),
    futureIso(uniqueSlotOffsetMinutes + 60),
    futureIso(uniqueSlotOffsetMinutes + 120),
  ].map((value) => new Date(value));
};

const setupSession = async (suffix: string) => {
  const author = await createLearner(`zoom-author-${suffix}`);
  const learner = await createLearner(`zoom-learner-${suffix}`);
  const outsider = await createLearner(`zoom-outsider-${suffix}`);
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
  const insideWindow = new Date(
    stored.selectedTimeOption!.startsAt.getTime() - 10 * 60_000,
  );
  return { author, learner, outsider, session, stored, insideWindow };
};

before(async () => {
  const { app } = await import('../../app.js');
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

beforeEach(() => {
  process.env.ZOOM_INTEGRATION_MODE = 'fake';
  resetFakeZoomMeetingProviderForTests();
  resetZoomMeetingProviderCacheForTests();
  resetZoomProvisioningFlightsForTests();
  setProjectHelpSessionNowForTests(null);
  setZoomMeetingProviderForTests(null);
  setFakeZoomBehaviorForTests({});
});

after(async () => {
  await cleanupNegotiationTests();
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
});

describe('PHS Zoom simplified participant architecture', () => {
  test('real provider creates a normal scheduled meeting that works without the service host', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;
    const startsAt = new Date('2030-06-01T12:00:00.000Z');
    const fetchImpl = async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          id: 123456789,
          join_url: 'https://zoom.us/j/123456789',
          start_time: startsAt.toISOString(),
          duration: 30,
        }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      );
    };
    const provider = new RealZoomMeetingProvider(
      {
        mode: 'real',
        accountId: 'acct',
        clientId: 'client',
        clientSecret: 'secret',
        hostUserId: 'service@example.com',
        apiBaseUrl: 'https://api.zoom.us/v2',
        tokenUrl: 'https://zoom.us/oauth/token',
      },
      { fetchImpl: fetchImpl as typeof fetch, getToken: async () => 'token' },
    );

    const created = await provider.createMeeting({
      topic: 'ImpactLoop — Help Session',
      startsAt,
      durationMinutes: 30,
    });

    assert.equal(
      capturedUrl,
      'https://api.zoom.us/v2/users/service%40example.com/meetings',
    );
    const body = JSON.parse(String(capturedInit?.body)) as {
      type: number;
      settings: Record<string, unknown>;
    };
    assert.equal(body.type, 2);
    assert.equal(body.settings.join_before_host, true);
    assert.equal(body.settings.jbh_time, 0);
    assert.equal(body.settings.waiting_room, false);
    assert.equal('approval_type' in body.settings, false);
    assert.equal('registration_type' in body.settings, false);
    assert.equal(created.joinUrl, 'https://zoom.us/j/123456789');
    assert.equal('startUrl' in created, false);
  });

  test('provisioning remains single-flight and persists only meeting state', async () => {
    const { author, session, stored } = await setupSession('provision');
    assert.equal(stored.status, 'SCHEDULED');
    assert.ok(stored.zoomMeetingId);
    assert.ok(stored.zoomJoinUrl);
    assert.ok(stored.zoomCreatedAt);
    assert.equal(getFakeZoomCreateCallCount(), 1);
    await ensureZoomMeetingForProjectHelpSession(session.id, 'author', author.id);
    assert.equal(getFakeZoomCreateCallCount(), 1);
  });

  test('learner and author private Join return the same persisted normal URL', async () => {
    const { author, learner, session, stored, insideWindow } =
      await setupSession('both-join');
    const learnerJoin = await getLearnerProjectHelpSessionZoomJoin(
      learner.id,
      session.id,
      insideWindow,
    );
    const authorJoin = await getAuthorProjectHelpSessionZoomJoin(
      author.id,
      session.id,
      insideWindow,
    );
    assert.equal(learnerJoin.joinUrl, stored.zoomJoinUrl);
    assert.equal(authorJoin.joinUrl, stored.zoomJoinUrl);
    assert.deepEqual(authorJoin, learnerJoin);
    assert.equal('startUrl' in authorJoin, false);
  });

  test('learner and author HTTP Join routes release the same private capability', async () => {
    const { author, learner, session, stored } =
      await setupSession('http-join');
    await prisma.projectHelpSessionTimeOption.update({
      where: { id: stored.selectedTimeOptionId! },
      data: { startsAt: new Date(Date.now() + 5 * 60_000) },
    });
    const learnerToken = signAccessToken({
      sub: learner.id,
      roles: ['LEARNER'],
    });
    const authorToken = signAccessToken({
      sub: author.id,
      roles: ['LEARNER'],
    });
    const join = (actor: 'learner' | 'author', token: string) =>
      fetch(
        `${baseUrl}/api/project-help-sessions/${actor}/${session.id}/zoom/join`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
      );

    const [learnerResponse, authorResponse] = await Promise.all([
      join('learner', learnerToken),
      join('author', authorToken),
    ]);
    assert.equal(learnerResponse.status, 200);
    assert.equal(authorResponse.status, 200);
    assert.match(learnerResponse.headers.get('cache-control') ?? '', /no-store/);
    assert.match(authorResponse.headers.get('cache-control') ?? '', /no-store/);
    const learnerBody = (await learnerResponse.json()) as {
      data: Record<string, unknown>;
    };
    const authorBody = (await authorResponse.json()) as {
      data: Record<string, unknown>;
    };
    assert.equal(learnerBody.data.joinUrl, stored.zoomJoinUrl);
    assert.equal(authorBody.data.joinUrl, stored.zoomJoinUrl);
    assert.equal('startUrl' in learnerBody.data, false);
    assert.equal('startUrl' in authorBody.data, false);

    assert.equal((await join('author', learnerToken)).status, 404);
    assert.equal((await join('learner', authorToken)).status, 404);
  });

  test('private Join enforces canonical learner/author ownership', async () => {
    const { author, learner, outsider, session, insideWindow } =
      await setupSession('ownership');
    await assertAppError(
      getLearnerProjectHelpSessionZoomJoin(author.id, session.id, insideWindow),
      { statusCode: 404, code: 'NOT_FOUND' },
    );
    await assertAppError(
      getAuthorProjectHelpSessionZoomJoin(learner.id, session.id, insideWindow),
      { statusCode: 404, code: 'NOT_FOUND' },
    );
    await assertAppError(
      getLearnerProjectHelpSessionZoomJoin(outsider.id, session.id, insideWindow),
      { statusCode: 404, code: 'NOT_FOUND' },
    );
    await assertAppError(
      getAuthorProjectHelpSessionZoomJoin(outsider.id, session.id, insideWindow),
      { statusCode: 404, code: 'NOT_FOUND' },
    );
  });

  test('both private Join actions enforce the application join window', async () => {
    const { author, learner, session, stored } = await setupSession('window');
    const tooEarly = new Date(
      stored.selectedTimeOption!.startsAt.getTime() - 60 * 60_000,
    );
    const tooLate = new Date(
      stored.selectedTimeOption!.startsAt.getTime() + 2 * 60 * 60_000,
    );
    await assertAppError(
      getLearnerProjectHelpSessionZoomJoin(learner.id, session.id, tooEarly),
      { statusCode: 409, code: 'SESSION_NOT_JOINABLE_YET' },
    );
    await assertAppError(
      getAuthorProjectHelpSessionZoomJoin(author.id, session.id, tooLate),
      { statusCode: 409, code: 'SESSION_JOIN_WINDOW_CLOSED' },
    );
  });

  test('missing persisted Zoom link returns a safe not-ready error', async () => {
    const { learner, session, insideWindow } = await setupSession('not-ready');
    await prisma.projectHelpSession.update({
      where: { id: session.id },
      data: { zoomJoinUrl: null },
    });
    await assertAppError(
      getLearnerProjectHelpSessionZoomJoin(learner.id, session.id, insideWindow),
      { statusCode: 409, code: 'ZOOM_NOT_READY' },
    );
  });

  test('normal learner and author DTOs never expose a Zoom capability URL', async () => {
    const { session, stored, insideWindow } = await setupSession('dto');
    const detail = await findProjectHelpSessionDetail(session.id);
    assert.ok(detail);
    setProjectHelpSessionNowForTests(insideWindow);
    for (const role of ['learner', 'author'] as const) {
      const dto = mapProjectHelpSessionPrivateDto(detail, role);
      const serialized = JSON.stringify(dto);
      assert.equal('joinUrl' in dto, false);
      assert.equal('startUrl' in dto, false);
      assert.ok(!serialized.includes(stored.zoomJoinUrl!));
      assert.equal(dto.allowedActions.canJoin, true);
    }
  });
});
