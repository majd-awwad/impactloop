import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

import { COMMON_ERROR_CODES } from '../../contracts/errors/common-error-codes.js';
import { prisma } from '../../database/prisma.js';
import {
  ProjectHelpSessionStatus,
  UserRole,
} from '../../generated/prisma/client.js';
import { NOTIFICATION_ENTITY_TYPES } from '../notifications/notification-identifiers.js';
import { signAccessToken } from '../../utils/jwt.js';
import { getAuthorProjectHelpSession } from './project-help-session.service.js';
import {
  TEST_MARKER,
  cleanupNegotiationTests,
  createLearner,
  createLearnerBuild,
  createPublishedProject,
  deleteProjectHelpSessionNotifications,
  enableOffering,
  trackSession,
} from './project-help-session-test-support.js';

const SEED_LEARNER_EMAILS = ['majd@learner.com', 'israa@learner.com'] as const;

let httpServer: Server | null = null;
let baseUrl = '';

const tokenFor = (userId: string) =>
  signAccessToken({ sub: userId, roles: [UserRole.LEARNER] });

function futureTimes() {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + 6);
  return [10, 14, 18].map((hour) =>
    new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, 0),
    ).toISOString(),
  );
}

async function countSeedOrphanMarkerNotifications() {
  const seedUsers = await prisma.user.findMany({
    where: { email: { in: [...SEED_LEARNER_EMAILS] } },
    select: { id: true },
  });
  if (seedUsers.length === 0) {
    return 0;
  }
  return prisma.notification.count({
    where: {
      userId: { in: seedUsers.map((user) => user.id) },
      OR: [
        {
          relatedEntityType: NOTIFICATION_ENTITY_TYPES.PROJECT_HELP_SESSION,
        },
        { entityType: NOTIFICATION_ENTITY_TYPES.PROJECT_HELP_SESSION },
      ],
      body: { contains: TEST_MARKER },
    },
  });
}

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
  const leftover = await countSeedOrphanMarkerNotifications();
  assert.equal(
    leftover,
    0,
    'PHS request-creation tests must not leave marker notifications on seed learners',
  );
  await prisma.$disconnect();
});

describe('PHS-08 request creation live HTTP', () => {
  test('regression: projectStepId accepts ProjectStep uuid (not cuid)', async () => {
    const author = await createLearner('uuid-step-author');
    const learner = await createLearner('uuid-step-learner');
    const project = await createPublishedProject(author.id);
    await enableOffering(project.id, author.id);
    const build = await createLearnerBuild(project.id, learner.id);
    const step = await prisma.projectStep.findFirst({
      where: { projectId: project.id },
      orderBy: { stepNumber: 'asc' },
    });
    assert.ok(step);
    assert.match(step.id, /^[0-9a-f-]{36}$/i);

    const token = tokenFor(learner.id);
    const body = {
      problemDescription:
        'Need help with step one wiring and component inspection before assembly.',
      projectStepId: step.id,
      durationMinutes: 30,
      learnerTimeZone: 'Asia/Hebron',
      proposedTimes: futureTimes(),
    };

    const response = await fetch(
      `${baseUrl}/api/project-help-sessions/learner/builds/${build.id}/request`,
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
    assert.equal(payload.data?.status, ProjectHelpSessionStatus.PENDING);
    assert.equal(payload.data?.projectStep?.id, step.id);
    assert.equal(payload.data?.timeOptions?.length, 3);
    assert.ok(payload.data?.id);
    await trackSession(payload.data.id);

    const session = await prisma.projectHelpSession.findUnique({
      where: { id: payload.data.id },
      include: {
        _count: { select: { timeOptions: true, statusHistory: true } },
      },
    });
    assert.equal(session?.status, ProjectHelpSessionStatus.PENDING);
    assert.equal(session?.buildId, build.id);
    assert.equal(session?.projectId, project.id);
    assert.equal(session?.activeKey, `build:${build.id}`);
    assert.equal(session?._count.timeOptions, 3);
    assert.equal(session?._count.statusHistory, 1);

    const duplicate = await fetch(
      `${baseUrl}/api/project-help-sessions/learner/builds/${build.id}/request`,
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
    const author = await createLearner('request-creation-author');
    const learner = await createLearner('request-creation-learner');
    const project = await createPublishedProject(author.id);
    await enableOffering(project.id, author.id);
    const build = await createLearnerBuild(project.id, learner.id);
    const step = await prisma.projectStep.findFirst({
      where: { projectId: project.id },
      orderBy: { stepNumber: 'asc' },
    });
    assert.ok(step);

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

  test('author notification opens living creator session via GET /author/:sessionId', async () => {
    const author = await createLearner('notify-open-author');
    const learner = await createLearner('notify-open-learner');
    const project = await createPublishedProject(author.id);
    await enableOffering(project.id, author.id);
    const build = await createLearnerBuild(project.id, learner.id);

    const response = await fetch(
      `${baseUrl}/api/project-help-sessions/learner/builds/${build.id}/request`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenFor(learner.id)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemDescription: 'Need help understanding this step before continuing.',
          projectStepId: null,
          durationMinutes: 15,
          learnerTimeZone: 'Asia/Hebron',
          proposedTimes: futureTimes(),
        }),
      },
    );
    assert.equal(response.status, 201);
    const payload = (await response.json()) as { data?: { id?: string } };
    assert.ok(payload.data?.id);
    const sessionId = payload.data.id;
    await trackSession(sessionId);

    const notification = await prisma.notification.findFirst({
      where: {
        userId: author.id,
        relatedEntityType: NOTIFICATION_ENTITY_TYPES.PROJECT_HELP_SESSION,
        relatedEntityId: sessionId,
      },
    });
    assert.ok(notification);
    assert.equal(
      (notification.metadata as { sessionId?: string } | null)?.sessionId,
      sessionId,
    );
    assert.equal(
      (notification.metadata as { recipientRole?: string } | null)?.recipientRole,
      'AUTHOR',
    );

    const detail = await getAuthorProjectHelpSession(author.id, sessionId);
    assert.equal(detail.id, sessionId);
    assert.equal(detail.status, ProjectHelpSessionStatus.PENDING);
    assert.equal(detail.author.id, author.id);

    const authorHttp = await fetch(
      `${baseUrl}/api/project-help-sessions/author/${sessionId}`,
      {
        headers: { Authorization: `Bearer ${tokenFor(author.id)}` },
      },
    );
    assert.equal(authorHttp.status, 200);

    await deleteProjectHelpSessionNotifications([sessionId]);
    await prisma.projectHelpSessionTimeOption.deleteMany({
      where: { sessionId },
    });
    await prisma.projectHelpSessionStatusHistory.deleteMany({
      where: { sessionId },
    });
    await prisma.projectHelpSession.delete({ where: { id: sessionId } });

    const missing = await fetch(
      `${baseUrl}/api/project-help-sessions/author/${sessionId}`,
      {
        headers: { Authorization: `Bearer ${tokenFor(author.id)}` },
      },
    );
    assert.equal(missing.status, 404);
    const missingBody = (await missing.json()) as { error?: { code?: string } };
    assert.equal(missingBody.error?.code, COMMON_ERROR_CODES.notFound);
  });
});
