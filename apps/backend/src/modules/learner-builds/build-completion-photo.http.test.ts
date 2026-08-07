import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';

import type { Express } from 'express';

import { prisma } from '../../database/prisma.js';
import {
  BUILD_COMPLETION_UPLOADS_DIR,
  buildCompletionPhotoContentPath,
  ensureBuildCompletionUploadsDir,
  publicBuildCompletionImageUrl,
} from '../learning-projects/build-completion-uploads.storage.js';
import { hashPassword } from '../../utils/password.js';
import { signAccessToken } from '../../utils/jwt.js';

const TEST_MARKER = '[test-build-completion-photo-http]';
const IMAGE_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
]);

let app: Express;
let ownerToken = '';
let otherLearnerToken = '';
let ownerUserId = '';
let otherLearnerUserId = '';
let authorUserId = '';
let projectId = '';
let buildId = '';
let photoId = '';
let imageFilename = '';
let staticImageUrl = '';

before(async () => {
  const { createApp } = await import('../../app.js');
  app = createApp({ recommendationEventOrigin: 'TEST' });

  ensureBuildCompletionUploadsDir();
  imageFilename = `build_completion_test_${Date.now()}_deadbeef.jpg`;
  staticImageUrl = publicBuildCompletionImageUrl(imageFilename);
  fs.writeFileSync(
    path.join(BUILD_COMPLETION_UPLOADS_DIR, imageFilename),
    IMAGE_BYTES,
  );

  const passwordHash = await hashPassword('TestPassword123!');

  const author = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Author`,
      email: `${TEST_MARKER}-author-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
    },
  });
  authorUserId = author.id;

  const owner = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Owner`,
      email: `${TEST_MARKER}-owner-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
    },
  });
  ownerUserId = owner.id;
  ownerToken = signAccessToken({ sub: owner.id, roles: ['LEARNER'] });

  const otherLearner = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Other`,
      email: `${TEST_MARKER}-other-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
    },
  });
  otherLearnerUserId = otherLearner.id;
  otherLearnerToken = signAccessToken({
    sub: otherLearner.id,
    roles: ['LEARNER'],
  });

  const project = await prisma.learningProject.create({
    data: {
      title: `${TEST_MARKER} Project`,
      shortDescription: 'Completion photo privacy test',
      status: 'PUBLISHED',
      authorId: authorUserId,
      publishedAt: new Date(),
    },
  });
  projectId = project.id;

  const build = await prisma.projectBuild.create({
    data: {
      projectId,
      learnerId: ownerUserId,
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });
  buildId = build.id;

  const story = await prisma.projectBuildCompletionStory.create({
    data: { buildId },
  });

  const photo = await prisma.projectBuildCompletionPhoto.create({
    data: {
      storyId: story.id,
      imageUrl: staticImageUrl,
      sortOrder: 0,
    },
  });
  photoId = photo.id;
});

after(async () => {
  await prisma.projectBuildCompletionPhoto.deleteMany({
    where: { story: { build: { project: { title: { contains: TEST_MARKER } } } } },
  });
  await prisma.projectBuildCompletionStory.deleteMany({
    where: { build: { project: { title: { contains: TEST_MARKER } } } },
  });
  await prisma.projectBuild.deleteMany({
    where: { project: { title: { contains: TEST_MARKER } } },
  });
  await prisma.learningProject.deleteMany({
    where: { title: { contains: TEST_MARKER } },
  });
  await prisma.user.deleteMany({
    where: { displayName: { contains: TEST_MARKER } },
  });

  try {
    fs.unlinkSync(path.join(BUILD_COMPLETION_UPLOADS_DIR, imageFilename));
  } catch {
    // ignore
  }
});

const request = async (
  requestPath: string,
  options: { method?: string; token?: string } = {},
) => {
  const { createServer } = await import('node:http');
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));

  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object');
    const response = await fetch(
      `http://127.0.0.1:${address.port}${requestPath}`,
      {
        method: options.method ?? 'GET',
        headers: options.token
          ? { Authorization: `Bearer ${options.token}` }
          : undefined,
      },
    );
    const contentType = response.headers.get('content-type') ?? '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : Buffer.from(await response.arrayBuffer());
    return {
      status: response.status,
      body,
      contentType,
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
};

describe('build completion photo access', () => {
  test('anonymous static path no longer serves completion photos', async () => {
    const result = await request(staticImageUrl);
    assert.notEqual(result.status, 200);
    assert.ok(
      result.status === 401 || result.status === 403 || result.status === 404,
    );
  });

  test('authenticated download requires authentication', async () => {
    const result = await request(
      buildCompletionPhotoContentPath(buildId, photoId),
    );
    assert.equal(result.status, 401);
  });

  test('owner can download completion photo', async () => {
    const result = await request(
      buildCompletionPhotoContentPath(buildId, photoId),
      { token: ownerToken },
    );
    assert.equal(result.status, 200);
    assert.match(result.contentType, /image\/jpeg/);
    assert.ok(Buffer.isBuffer(result.body));
    assert.equal((result.body as Buffer).compare(IMAGE_BYTES), 0);
  });

  test('other learner cannot download another build completion photo', async () => {
    const result = await request(
      buildCompletionPhotoContentPath(buildId, photoId),
      { token: otherLearnerToken },
    );
    assert.equal(result.status, 404);
  });
});
