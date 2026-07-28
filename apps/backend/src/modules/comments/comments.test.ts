import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { AppError } from '../../utils/app-error.js';
import { hashPassword } from '../../utils/password.js';
import type { AccessTokenPayload } from '../../utils/jwt.js';

import {
  createComment,
  deleteOwnComment,
  listCommentReplies,
  listRootComments,
  moderateComment,
  updateComment,
} from './comments.service.js';

const TEST_MARKER = '[test-comments]';

type TestContext = {
  learnerId: string;
  otherLearnerId: string;
  adminId: string;
  materialId: string;
  projectId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdProjectIds: string[];
  createdCommentIds: string[];
  createdLocationIds: string[];
};

const ctx: TestContext = {
  learnerId: '',
  otherLearnerId: '',
  adminId: '',
  materialId: '',
  projectId: '',
  categoryId: '',
  locationId: '',
  createdUserIds: [],
  createdMaterialIds: [],
  createdProjectIds: [],
  createdCommentIds: [],
  createdLocationIds: [],
};

const learnerViewer = (userId: string): AccessTokenPayload => ({
  sub: userId,
  roles: ['LEARNER'],
});

const adminViewer = (userId: string): AccessTokenPayload => ({
  sub: userId,
  roles: ['ADMIN'],
});

async function createLearner(emailSuffix: string) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} learner ${emailSuffix}`,
      email: `${TEST_MARKER}-learner-${emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      profileImageUrl: '/uploads/profiles/test-avatar.jpg',
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
    },
  });
  ctx.createdUserIds.push(user.id);
  return user;
}

async function createAdmin() {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} admin`,
      email: `${TEST_MARKER}-admin-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
    },
  });
  ctx.createdUserIds.push(user.id);
  return user;
}

describe('CM-01 comments', () => {
  before(async () => {
    const category = await prisma.category.findFirst({
      where: { isActive: true, categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true },
    });
    assert.ok(category);
    ctx.categoryId = category.id;

    const projectCategory = await prisma.category.findFirst({
      where: { isActive: true, categoryType: { in: ['PROJECT', 'BOTH'] } },
      select: { id: true },
    });
    assert.ok(projectCategory);

    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: `${TEST_MARKER}-Ramallah`,
        area: `${TEST_MARKER}-Center`,
        addressLine: `${TEST_MARKER} street`,
        visibility: 'ORDER_ONLY',
        isApproximate: true,
        locationType: 'MATERIAL_PICKUP',
      },
    });
    ctx.createdLocationIds.push(location.id);
    ctx.locationId = location.id;

    const learner = await createLearner('a');
    const other = await createLearner('b');
    const admin = await createAdmin();
    ctx.learnerId = learner.id;
    ctx.otherLearnerId = other.id;
    ctx.adminId = admin.id;

    const supplier = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} supplier`,
        email: `${TEST_MARKER}-supplier-${Date.now()}@impactloop.test`,
        passwordHash: await hashPassword('TestPassword123!'),
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: 'INDIVIDUAL_SUPPLIER',
            publicName: `${TEST_MARKER} Supplier`,
            verificationStatus: 'VERIFIED',
          },
        },
      },
      include: { supplierProfile: true },
    });
    ctx.createdUserIds.push(supplier.id);

    const material = await prisma.material.create({
      data: {
        ownerId: supplier.id,
        supplierProfileId: supplier.supplierProfile!.id,
        categoryId: ctx.categoryId,
        title: `${TEST_MARKER} material`,
        description: `${TEST_MARKER} material description`,
        materialType: 'Plastic',
        quantity: 5,
        unit: 'pcs',
        condition: 'GOOD',
        sourceType: 'WORKSHOP_SURPLUS',
        status: 'AVAILABLE',
        isFree: true,
        locationId: ctx.locationId,
        pickupAllowed: true,
        deliveryAllowed: false,
      },
    });
    ctx.createdMaterialIds.push(material.id);
    ctx.materialId = material.id;

    const project = await prisma.learningProject.create({
      data: {
        categoryId: projectCategory.id,
        createdBy: learner.id,
        title: `${TEST_MARKER} project`,
        shortDescription: `${TEST_MARKER} short`,
        description: `${TEST_MARKER} full description`,
        difficulty: 'BEGINNER',
        status: 'PUBLISHED',
      },
    });
    ctx.createdProjectIds.push(project.id);
    ctx.projectId = project.id;
  });

  after(async () => {
    if (ctx.createdCommentIds.length > 0) {
      await prisma.comment.deleteMany({
        where: { id: { in: ctx.createdCommentIds } },
      });
    }
    await prisma.comment.deleteMany({
      where: {
        OR: [
          { materialId: { in: ctx.createdMaterialIds } },
          { learningProjectId: { in: ctx.createdProjectIds } },
        ],
      },
    });
    if (ctx.createdMaterialIds.length > 0) {
      await prisma.material.deleteMany({
        where: { id: { in: ctx.createdMaterialIds } },
      });
    }
    if (ctx.createdProjectIds.length > 0) {
      await prisma.learningProject.deleteMany({
        where: { id: { in: ctx.createdProjectIds } },
      });
    }
    if (ctx.createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: ctx.createdUserIds } },
      });
    }
    if (ctx.createdLocationIds.length > 0) {
      await prisma.location.deleteMany({
        where: { id: { in: ctx.createdLocationIds } },
      });
    }
  });

  test('creates root comment and reply under same root with author projection', async () => {
    const root = await createComment(
      'material',
      ctx.materialId,
      { body: '  Great material for beginners.  ' },
      learnerViewer(ctx.learnerId),
    );
    ctx.createdCommentIds.push(root.id);

    assert.equal(root.body, 'Great material for beginners.');
    assert.equal(root.parentCommentId, null);
    assert.equal(root.rootCommentId, null);
    assert.equal(root.author.id, ctx.learnerId);
    assert.equal(root.author.displayName.includes('learner a'), true);
    assert.equal(root.author.avatarUrl, '/uploads/profiles/test-avatar.jpg');
    assert.equal(root.repliesCount, 0);
    assert.equal(root.canEdit, true);

    const reply = await createComment(
      'material',
      ctx.materialId,
      {
        body: 'Agreed!',
        parentCommentId: root.id,
      },
      learnerViewer(ctx.otherLearnerId),
    );
    ctx.createdCommentIds.push(reply.id);

    assert.equal(reply.rootCommentId, root.id);
    assert.equal(reply.parentCommentId, root.id);
    assert.equal(reply.replyToCommentId, root.id);

    const nested = await createComment(
      'material',
      ctx.materialId,
      {
        body: 'Thanks @other',
        replyToCommentId: reply.id,
      },
      learnerViewer(ctx.learnerId),
    );
    ctx.createdCommentIds.push(nested.id);

    assert.equal(nested.rootCommentId, root.id);
    assert.equal(nested.parentCommentId, root.id);
    assert.equal(nested.replyToCommentId, reply.id);
    assert.equal(nested.replyTo?.author.id, ctx.otherLearnerId);

    const roots = await listRootComments(
      'material',
      ctx.materialId,
      { page: 1, limit: 20 },
      learnerViewer(ctx.learnerId),
    );
    const listedRoot = roots.items.find((item) => item.id === root.id);
    assert.ok(listedRoot);
    assert.equal(listedRoot.repliesCount, 2);

    const replies = await listCommentReplies(
      'material',
      ctx.materialId,
      root.id,
      { page: 1, limit: 20 },
      learnerViewer(ctx.learnerId),
    );
    assert.equal(replies.items.length, 2);
    assert.equal(replies.items[0]?.id, reply.id);
    assert.equal(replies.items[1]?.id, nested.id);
  });

  test('rejects empty body and cross-target replies', async () => {
    await assert.rejects(
      () =>
        createComment(
          'material',
          ctx.materialId,
          { body: '   ' },
          learnerViewer(ctx.learnerId),
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === 'VALIDATION_ERROR',
    );

    const projectRoot = await createComment(
      'learningProject',
      ctx.projectId,
      { body: 'Project comment' },
      learnerViewer(ctx.learnerId),
    );
    ctx.createdCommentIds.push(projectRoot.id);

    await assert.rejects(
      () =>
        createComment(
          'material',
          ctx.materialId,
          {
            body: 'Cross target',
            parentCommentId: projectRoot.id,
          },
          learnerViewer(ctx.learnerId),
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === 'NOT_FOUND',
    );
  });

  test('owner can edit and soft-delete; admin can moderate', async () => {
    const root = await createComment(
      'learningProject',
      ctx.projectId,
      { body: 'Original body' },
      learnerViewer(ctx.learnerId),
    );
    ctx.createdCommentIds.push(root.id);

    const updated = await updateComment(
      'learningProject',
      ctx.projectId,
      root.id,
      { body: 'Edited body' },
      learnerViewer(ctx.learnerId),
    );
    assert.equal(updated.body, 'Edited body');
    assert.ok(updated.editedAt);

    await assert.rejects(
      () =>
        updateComment(
          'learningProject',
          ctx.projectId,
          root.id,
          { body: 'Nope' },
          learnerViewer(ctx.otherLearnerId),
        ),
      (error: unknown) =>
        error instanceof AppError && error.code === 'FORBIDDEN',
    );

    const deleted = await deleteOwnComment(
      'learningProject',
      ctx.projectId,
      root.id,
      learnerViewer(ctx.learnerId),
    );
    assert.equal(deleted.isDeleted, true);
    assert.equal(deleted.body, null);
    assert.equal(deleted.status, 'DELETED');

    const moderatedRoot = await createComment(
      'learningProject',
      ctx.projectId,
      { body: 'Will be moderated' },
      learnerViewer(ctx.otherLearnerId),
    );
    ctx.createdCommentIds.push(moderatedRoot.id);

    const moderated = await moderateComment(
      moderatedRoot.id,
      adminViewer(ctx.adminId),
    );
    assert.equal(moderated.status, 'MODERATED');
    assert.equal(moderated.isDeleted, true);
    assert.equal(moderated.body, null);
  });
});
