import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { prisma } from '../../database/prisma.js';
import { signAccessToken } from '../../utils/jwt.js';
import {
  cleanupNegotiationTests,
  createLearnerBuild,
  createPublishedProject,
  enableOffering,
  ids,
  trackSession,
} from './project-help-session-test-support.js';

const PROJECT_ID = 'e445e3b7-6fe2-49db-a695-1d3a47bf8e5c';
const BUILD_ID = 'cmshf6ugs000724vg3rfvnr1d';
const STEP_ID = '3b5a9309-8039-4f69-802b-61ec1bde2902';
const LEARNER_ID = 'cms5qrobg000oxovgiy2nsfyp';

let httpServer: Server | null = null;
let baseUrl = '';

const tokenFor = (userId: string) =>
  signAccessToken({ sub: userId, roles: ['LEARNER'] });

function futureTimes() {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 6);
  return [10, 14, 18].map((hour) =>
    new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, 0),
    ).toISOString(),
  );
}

before(async () => {
  await prisma.$connect();
  const { createApp } = await import('../../app.js');
  const app = createApp({ recommendationEventOrigin: 'TEST' });
  httpServer = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => httpServer!.once('listening', resolve));
  const address = httpServer.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;

  await prisma.projectHelpSessionTimeOption.deleteMany({
    where: { session: { buildId: BUILD_ID } },
  });
  await prisma.projectHelpSessionStatusHistory.deleteMany({
    where: { session: { buildId: BUILD_ID } },
  });
  await prisma.projectHelpSession.deleteMany({ where: { buildId: BUILD_ID } });
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

describe('PHS-08 request creation live HTTP', () => {
  test('regression: projectStepId accepts ProjectStep uuid (not cuid)', async () => {
    const token = tokenFor(LEARNER_ID);
    const body = {
      problemDescription:
        'Need help with step one wiring and component inspection before assembly.',
      projectStepId: STEP_ID,
      durationMinutes: 30,
      learnerTimeZone: 'Asia/Hebron',
      proposedTimes: futureTimes(),
    };

    const response = await fetch(
      `${baseUrl}/api/project-help-sessions/learner/builds/${BUILD_ID}/request`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );

    assert.equal(response.status, 201);
    const payload = (await response.json()) as {
      data?: {
        id?: string;
        status?: string;
        projectStep?: { id?: string } | null;
        timeOptions?: unknown[];
      };
    };
    assert.equal(payload.data?.status, 'PENDING');
    assert.equal(payload.data?.projectStep?.id, STEP_ID);
    assert.equal(payload.data?.timeOptions?.length, 3);
    assert.ok(payload.data?.id);
    await trackSession(payload.data.id);

    const session = await prisma.projectHelpSession.findUnique({
      where: { id: payload.data.id },
      include: {
        _count: { select: { timeOptions: true, statusHistory: true } },
      },
    });
    assert.equal(session?.status, 'PENDING');
    assert.equal(session?.buildId, BUILD_ID);
    assert.equal(session?.projectId, PROJECT_ID);
    assert.equal(session?.activeKey, `build:${BUILD_ID}`);
    assert.equal(session?._count.timeOptions, 3);
    assert.equal(session?._count.statusHistory, 1);

    const duplicate = await fetch(
      `${baseUrl}/api/project-help-sessions/learner/builds/${BUILD_ID}/request`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    assert.equal(duplicate.status, 409);
    const duplicateBody = (await duplicate.json()) as {
      error?: { code?: string };
    };
    assert.equal(duplicateBody.error?.code, 'ACTIVE_SESSION_EXISTS');
  });

  test('fallback setup project still accepts uuid step ids', async () => {
    const author = await prisma.user.findFirst({
      where: { email: 'majd@learner.com' },
      select: { id: true },
    });
    assert.ok(author);
    const project = await createPublishedProject(author.id);
    await enableOffering(project.id, author.id);
    const learner = await prisma.user.findFirst({
      where: { email: 'israa@learner.com' },
      select: { id: true },
    });
    assert.ok(learner);
    const build = await createLearnerBuild(project.id, learner.id);
    const step = await prisma.projectStep.findFirst({
      where: { projectId: project.id },
      orderBy: { stepNumber: 'asc' },
    });
    assert.ok(step);
    ids.projects.push(project.id);
    ids.builds.push(build.id);

    const token = tokenFor(learner.id);
    const response = await fetch(
      `${baseUrl}/api/project-help-sessions/learner/builds/${build.id}/request`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemDescription: 'Need help understanding this step before continuing.',
          projectStepId: step.id,
          durationMinutes: 15,
          learnerTimeZone: 'Asia/Hebron',
          proposedTimes: futureTimes(),
        }),
      },
    );
    assert.equal(response.status, 201);
    const payload = (await response.json()) as { data?: { id?: string } };
    assert.ok(payload.data?.id);
    await trackSession(payload.data.id);
  });
});
