import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import { env } from '../../config/env.js';
import { prisma } from '../../database/prisma.js';
import {
  checkRateLimit,
  resetRateLimitersForTests,
} from '../../middlewares/rate-limit.middleware.js';
import { AppError } from '../../utils/app-error.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { generateOpaqueToken, hashToken } from '../../utils/token.js';

import type {
  AuthEmailProvider,
  EmailSendResult,
  EmailVerificationEmailPayload,
  PasswordChangedEmailPayload,
  PasswordResetEmailPayload,
} from './email/auth-email-provider.js';
import {
  resetAuthEmailProviderForTests,
  setAuthEmailProviderForTests,
} from './email/index.js';
import {
  assertEmailVerifiedForMarketplaceCommitment,
  EMAIL_VERIFICATION_REQUIRED_CODE,
} from './email-verification.policy.js';
import { createReservation } from '../reservations/reservations.service.js';
import { createSupplierMaterial } from '../supplier/supplier-material-create.service.js';
import * as authRepository from './auth.repository.js';
import {
  confirmEmailVerification,
  getAuthenticatedUser,
  loginUser,
  refreshAuthSession,
  registerUser,
  requestPasswordReset,
  resendEmailVerification,
  resetPasswordWithToken,
  sendEmailVerificationAfterRegistration,
} from './auth.service.js';
import { cancelReservation } from '../reservations/reservations.service.js';

const TEST_MARKER = 'test-email-verification';

const ids = {
  users: [] as string[],
  materials: [] as string[],
  categories: [] as string[],
  locations: [] as string[],
};

class RecordingAuthEmailProvider implements AuthEmailProvider {
  passwordResetEmails: PasswordResetEmailPayload[] = [];
  passwordChangedEmails: PasswordChangedEmailPayload[] = [];
  emailVerificationEmails: EmailVerificationEmailPayload[] = [];
  mode: 'success' | 'failure' = 'success';

  async sendPasswordResetEmail(
    payload: PasswordResetEmailPayload,
  ): Promise<EmailSendResult> {
    this.passwordResetEmails.push(payload);
    return { status: 'SENT' };
  }

  async sendPasswordChangedEmail(
    payload: PasswordChangedEmailPayload,
  ): Promise<EmailSendResult> {
    this.passwordChangedEmails.push(payload);
    return { status: 'SENT' };
  }

  async sendEmailVerificationEmail(
    payload: EmailVerificationEmailPayload,
  ): Promise<EmailSendResult> {
    this.emailVerificationEmails.push(payload);
    if (this.mode === 'failure') {
      return { status: 'FAILED', sendError: 'SMTP unavailable' };
    }
    return { status: 'SENT' };
  }
}

function testEmail(suffix: string): string {
  return `${TEST_MARKER}-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`;
}

function latestVerificationToken(provider: RecordingAuthEmailProvider): string {
  const latest = provider.emailVerificationEmails.at(-1);
  assert.ok(latest);
  const token = new URL(latest.verificationLink).searchParams.get('token');
  assert.ok(token);
  return token;
}

async function cleanup() {
  if (ids.materials.length > 0) {
    await prisma.material.deleteMany({ where: { id: { in: ids.materials } } });
    ids.materials.length = 0;
  }

  if (ids.users.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    ids.users.length = 0;
  }

  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({
      where: { id: { in: ids.categories } },
    });
    ids.categories.length = 0;
  }

  if (ids.locations.length > 0) {
    await prisma.location.deleteMany({
      where: { id: { in: ids.locations } },
    });
    ids.locations.length = 0;
  }
}

async function findExistingAvailableMaterial() {
  const material = await prisma.material.findFirst({
    where: {
      status: 'AVAILABLE',
      quantity: { gte: 1 },
    },
    select: { id: true, categoryId: true },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(material);
  return material;
}

async function findExistingCategoryId() {
  const material = await findExistingAvailableMaterial();
  return material.categoryId;
}

async function createSupplierFixture(input?: {
  emailVerificationRequired?: boolean;
  emailVerifiedAt?: Date | null;
  accountStatus?: 'ACTIVE' | 'PENDING_VERIFICATION' | 'SUSPENDED' | 'DISABLED';
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} supplier`,
      email: testEmail('supplier'),
      passwordHash,
      accountStatus: input?.accountStatus ?? 'ACTIVE',
      emailVerifiedAt:
        input?.emailVerifiedAt === undefined ? new Date() : input.emailVerifiedAt,
      emailVerificationRequired: input?.emailVerificationRequired ?? false,
      roles: {
        create: [{ role: 'SUPPLIER', isPrimary: true }],
      },
      supplierProfile: {
        create: {
          supplierType: 'WORKSHOP',
          publicName: `${TEST_MARKER} supplier`,
          verificationStatus: 'VERIFIED',
        },
      },
    },
    include: { supplierProfile: true },
  });
  ids.users.push(user.id);

  await prisma.supplierProfile.update({
    where: { id: user.supplierProfile!.id },
    data: {
      defaultPickupLocation: {
        create: {
          country: 'Palestine',
          city: 'Nablus',
          area: 'Downtown',
          isApproximate: true,
          visibility: 'PRIVATE',
        },
      },
    },
  });

  return { user };
}

async function createLearnerFixture(input?: {
  emailVerificationRequired?: boolean;
  emailVerifiedAt?: Date | null;
}) {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} learner`,
      email: testEmail('learner'),
      passwordHash,
      accountStatus: 'ACTIVE',
      emailVerifiedAt:
        input?.emailVerifiedAt === undefined ? new Date() : input.emailVerifiedAt,
      emailVerificationRequired: input?.emailVerificationRequired ?? false,
      roles: {
        create: [{ role: 'LEARNER', isPrimary: true }],
      },
      learnerProfile: {
        create: {
          learnerType: 'STUDENT',
          skillLevel: 'BEGINNER',
        },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

async function createPublishedMaterial(supplierId: string) {
  const supplier = await prisma.supplierProfile.findUnique({
    where: { userId: supplierId },
    include: { defaultPickupLocation: true },
  });
  assert.ok(supplier?.defaultPickupLocationId);

  const categoryId = await findExistingCategoryId();
  const material = await prisma.material.create({
    data: {
      ownerId: supplierId,
      supplierProfileId: supplier.id,
      categoryId,
      locationId: supplier.defaultPickupLocationId,
      title: `${TEST_MARKER} material`,
      description: `${TEST_MARKER} description`,
      materialType: 'Test',
      quantity: 5,
      unit: 'piece',
      condition: 'GOOD',
      status: 'AVAILABLE',
      sourceType: 'WORKSHOP_SURPLUS',
      isFree: true,
      pickupAllowed: true,
      deliveryAllowed: false,
    },
  });
  ids.materials.push(material.id);
  return material;
}

function futurePickupWindow() {
  const start = new Date(Date.now() + 24 * 3_600_000);
  const end = new Date(start.getTime() + 2 * 3_600_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

before(() => {
  env.appPublicBaseUrl = 'http://localhost:53077';
});

beforeEach(async () => {
  resetRateLimitersForTests();
  resetAuthEmailProviderForTests();
  setAuthEmailProviderForTests(new RecordingAuthEmailProvider());
  await cleanup();
});

after(async () => {
  await cleanup();
});

describe('email verification MVP', () => {
  test('new public registration sets emailVerificationRequired and null emailVerifiedAt', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);

    const session = await registerUser({
      displayName: 'Verification Registration',
      email: testEmail('register'),
      password: 'TestPassword123!',
      roles: ['LEARNER'],
      learnerProfile: {
        learnerType: 'University student',
        skillLevel: 'Beginner',
        interests: ['recycling'],
      },
    });
    ids.users.push(session.user.id);

    assert.equal(session.user.emailVerificationRequired, true);
    assert.equal(session.user.emailVerifiedAt, null);
    assert.ok(session.accessToken);
    assert.ok(session.refreshToken);

    const stored = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerificationRequired: true, emailVerifiedAt: true },
    });
    assert.equal(stored?.emailVerificationRequired, true);
    assert.equal(stored?.emailVerifiedAt, null);
  });

  test('registration generates verification email token and email failure does not roll back', async () => {
    const provider = new RecordingAuthEmailProvider();
    provider.mode = 'failure';
    setAuthEmailProviderForTests(provider);

    const session = await registerUser({
      displayName: 'Verification Email Failure',
      email: testEmail('register-email-fail'),
      password: 'TestPassword123!',
      roles: ['LEARNER'],
      learnerProfile: {
        learnerType: 'University student',
        skillLevel: 'Beginner',
        interests: ['recycling'],
      },
    });
    ids.users.push(session.user.id);
    await sendEmailVerificationAfterRegistration(session.user.id);

    assert.ok(session.accessToken);
    const token = await prisma.authToken.findFirst({
      where: {
        userId: session.user.id,
        tokenType: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
    });
    assert.ok(token);
    assert.ok(provider.emailVerificationEmails.length >= 1);
  });

  test('invitation-style verified user keeps emailVerificationRequired false', async () => {
    const user = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} invited`,
        email: testEmail('invited'),
        passwordHash: await hashPassword('TestPassword123!'),
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        emailVerificationRequired: false,
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      },
    });
    ids.users.push(user.id);

    assert.equal(user.emailVerificationRequired, false);
    assert.ok(user.emailVerifiedAt);
  });

  test('authenticated unverified user can resend and rotates previous token', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });

    await resendEmailVerification(user.id);
    const firstToken = latestVerificationToken(provider);

    await resendEmailVerification(user.id);
    assert.equal(provider.emailVerificationEmails.length, 2);
    const secondToken = latestVerificationToken(provider);
    assert.notEqual(firstToken, secondToken);

    const firstHash = hashToken(firstToken);
    const secondHash = hashToken(secondToken);
    const tokens = await prisma.authToken.findMany({
      where: { userId: user.id, tokenType: 'EMAIL_VERIFICATION' },
      orderBy: { createdAt: 'asc' },
    });
    assert.equal(tokens.length, 2);
    assert.ok(tokens[0]!.usedAt);
    assert.equal(tokens[1]!.tokenHash, secondHash);
    assert.equal(tokens[0]!.tokenHash, firstHash);
  });

  test('already verified user gets safe idempotent resend response', async () => {
    const user = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: new Date(),
    });
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);

    const result = await resendEmailVerification(user.id);
    assert.match(result.message, /already verified/i);
    assert.equal(provider.emailVerificationEmails.length, 0);
  });

  test('resend is rate limited per account', async () => {
    const user = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await resendEmailVerification(user.id);
    }

    await assert.rejects(
      () => resendEmailVerification(user.id),
      (error: unknown) => error instanceof AppError && error.statusCode === 429,
    );
  });

  test('valid token verifies email and activates pending account', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} pending`,
        email: testEmail('pending'),
        passwordHash: await hashPassword('TestPassword123!'),
        accountStatus: 'PENDING_VERIFICATION',
        emailVerifiedAt: null,
        emailVerificationRequired: true,
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      },
    });
    ids.users.push(user.id);

    await resendEmailVerification(user.id);
    const token = latestVerificationToken(provider);
    const result = await confirmEmailVerification(token);
    assert.match(result.message, /verified/i);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerifiedAt: true, accountStatus: true },
    });
    assert.ok(updated?.emailVerifiedAt);
    assert.equal(updated?.accountStatus, 'ACTIVE');
  });

  test('suspended and disabled accounts are not reactivated by verification', async () => {
    for (const status of ['SUSPENDED', 'DISABLED'] as const) {
      const provider = new RecordingAuthEmailProvider();
      setAuthEmailProviderForTests(provider);
      const user = await prisma.user.create({
        data: {
          displayName: `${TEST_MARKER} ${status}`,
          email: testEmail(status.toLowerCase()),
          passwordHash: await hashPassword('TestPassword123!'),
          accountStatus: status,
          emailVerifiedAt: null,
          emailVerificationRequired: true,
          roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        },
      });
      ids.users.push(user.id);

      await sendEmailVerificationAfterRegistration(user.id);
      const token = latestVerificationToken(provider);
      await confirmEmailVerification(token);

      const updated = await prisma.user.findUnique({
        where: { id: user.id },
        select: { emailVerifiedAt: true, accountStatus: true },
      });
      assert.ok(updated?.emailVerifiedAt);
      assert.equal(updated?.accountStatus, status);
    }
  });

  test('token is one-time use and expired or invalid tokens are rejected', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });

    await resendEmailVerification(user.id);
    const token = latestVerificationToken(provider);
    await confirmEmailVerification(token);

    await assert.rejects(
      () => confirmEmailVerification(token),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'EMAIL_VERIFICATION_TOKEN_USED');
        return true;
      },
    );

    const expiredToken = generateOpaqueToken();
    await prisma.authToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(expiredToken),
        tokenType: 'EMAIL_VERIFICATION',
        target: user.email,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    await assert.rejects(
      () => confirmEmailVerification(expiredToken),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'EMAIL_VERIFICATION_TOKEN_EXPIRED');
        return true;
      },
    );

    await assert.rejects(
      () => confirmEmailVerification('not-a-real-token'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, 'EMAIL_VERIFICATION_TOKEN_INVALID');
        return true;
      },
    );
  });

  test('concurrent confirm cannot produce inconsistent state', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });
    await resendEmailVerification(user.id);
    const token = latestVerificationToken(provider);

    const results = await Promise.allSettled([
      confirmEmailVerification(token),
      confirmEmailVerification(token),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    assert.equal(fulfilled.length + rejected.length, 2);
    assert.ok(fulfilled.length >= 1);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerifiedAt: true },
    });
    assert.ok(updated?.emailVerifiedAt);
  });

  test('legacy grandfathered users can create reservations and supplier materials', async () => {
    const learner = await createLearnerFixture({
      emailVerificationRequired: false,
      emailVerifiedAt: null,
    });
    const supplier = await createSupplierFixture({
      emailVerificationRequired: false,
      emailVerifiedAt: null,
    });
    const material = await findExistingAvailableMaterial();

    const reservation = await createReservation(learner.id, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [futurePickupWindow()],
    });
    assert.ok(reservation.id);

    await assertEmailVerifiedForMarketplaceCommitment(supplier.user.id);
  });

  test('legacy unverified users can voluntarily resend verification email', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerFixture({
      emailVerificationRequired: false,
      emailVerifiedAt: null,
    });

    const result = await resendEmailVerification(user.id);
    assert.match(result.message, /sent/i);
    assert.equal(provider.emailVerificationEmails.length, 1);
  });

  test('ACTIVE account stays ACTIVE after successful email confirmation', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await prisma.user.create({
      data: {
        displayName: `${TEST_MARKER} active`,
        email: testEmail('active'),
        passwordHash: await hashPassword('TestPassword123!'),
        accountStatus: 'ACTIVE',
        emailVerifiedAt: null,
        emailVerificationRequired: true,
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      },
    });
    ids.users.push(user.id);

    await resendEmailVerification(user.id);
    await confirmEmailVerification(latestVerificationToken(provider));

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerifiedAt: true, accountStatus: true },
    });
    assert.ok(updated?.emailVerifiedAt);
    assert.equal(updated?.accountStatus, 'ACTIVE');
  });

  test('failed token claim does not consume verification token', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });
    await resendEmailVerification(user.id);

    const stored = await prisma.authToken.findFirst({
      where: {
        userId: user.id,
        tokenType: 'EMAIL_VERIFICATION',
        usedAt: null,
      },
    });
    assert.ok(stored);

    const completed = await authRepository.completeEmailVerification({
      tokenId: stored!.id,
      userId: 'non-existent-user-id',
    });
    assert.equal(completed, false);

    const afterFailedClaim = await prisma.authToken.findUnique({
      where: { id: stored!.id },
      select: { usedAt: true },
    });
    assert.equal(afterFailedClaim?.usedAt, null);

    const userAfter = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerifiedAt: true },
    });
    assert.equal(userAfter?.emailVerifiedAt, null);
  });

  test('resend invalidates only EMAIL_VERIFICATION tokens', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });

    const passwordResetToken = generateOpaqueToken();
    const refreshToken = generateOpaqueToken();
    await prisma.authToken.createMany({
      data: [
        {
          userId: user.id,
          tokenHash: hashToken(passwordResetToken),
          tokenType: 'PASSWORD_RESET',
          target: user.email,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
        {
          userId: user.id,
          tokenHash: hashToken(refreshToken),
          tokenType: 'REFRESH_TOKEN',
          target: user.email,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      ],
    });

    await resendEmailVerification(user.id);

    const tokens = await prisma.authToken.findMany({
      where: { userId: user.id },
      select: { tokenType: true, usedAt: true },
    });
    const passwordReset = tokens.find(
      (token) => token.tokenType === 'PASSWORD_RESET',
    );
    const refresh = tokens.find((token) => token.tokenType === 'REFRESH_TOKEN');
    assert.equal(passwordReset?.usedAt, null);
    assert.equal(refresh?.usedAt, null);
  });

  test('unverified users retain existing workflow access while new commitments stay gated', async () => {
    const learner = await createLearnerFixture({
      emailVerificationRequired: false,
      emailVerifiedAt: null,
    });
    const material = await findExistingAvailableMaterial();
    const reservation = await createReservation(learner.id, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [futurePickupWindow()],
    });

    await prisma.user.update({
      where: { id: learner.id },
      data: { emailVerificationRequired: true },
    });

    const login = await loginUser({
      email: learner.email,
      password: 'TestPassword123!',
    });
    assert.ok(login.accessToken);
    assert.equal(login.user.emailVerifiedAt, null);

    const me = await getAuthenticatedUser(learner.id);
    assert.equal(me.emailVerificationRequired, true);
    assert.equal(me.emailVerifiedAt, null);

    const refreshed = await refreshAuthSession(login.refreshToken);
    assert.ok(refreshed.accessToken);

    const cancelled = await cancelReservation(learner.id, reservation.id);
    assert.equal(cancelled.status, 'CANCELLED');

    await assert.rejects(
      () =>
        createReservation(learner.id, {
          materialId: material.id,
          quantityRequested: 1,
          fulfillmentMethod: 'PICKUP',
          learnerPreferredPickupWindows: [futurePickupWindow()],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, EMAIL_VERIFICATION_REQUIRED_CODE);
        return true;
      },
    );
  });

  test('verification-required unverified users are gated for new commitments', async () => {
    const learner = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });
    const supplier = await createSupplierFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });
    const material = await findExistingAvailableMaterial();

    await assert.rejects(
      () =>
        createReservation(learner.id, {
          materialId: material.id,
          quantityRequested: 1,
          fulfillmentMethod: 'PICKUP',
          learnerPreferredPickupWindows: [futurePickupWindow()],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, EMAIL_VERIFICATION_REQUIRED_CODE);
        return true;
      },
    );

    const categoryId = await findExistingCategoryId();
    await assert.rejects(
      () =>
        createSupplierMaterial(supplier.user.id, {
          materialName: 'Blocked material',
          title: `${TEST_MARKER} blocked`,
          description: 'Blocked',
          categoryId,
          quantity: 1,
          unit: 'piece',
          condition: 'GOOD',
          isFree: true,
          pickupAllowed: true,
          deliveryAllowed: false,
          useDefaultPickupLocation: true,
          imageUrls: [],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, EMAIL_VERIFICATION_REQUIRED_CODE);
        return true;
      },
    );
  });

  test('verification unlocks new reservation and material creation', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const learner = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });
    const supplier = await createSupplierFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });
    const material = await findExistingAvailableMaterial();

    await sendEmailVerificationAfterRegistration(learner.id);
    await confirmEmailVerification(latestVerificationToken(provider));

    const reservation = await createReservation(learner.id, {
      materialId: material.id,
      quantityRequested: 1,
      fulfillmentMethod: 'PICKUP',
      learnerPreferredPickupWindows: [futurePickupWindow()],
    });
    assert.ok(reservation.id);

    await sendEmailVerificationAfterRegistration(supplier.user.id);
    await confirmEmailVerification(latestVerificationToken(provider));

    await assertEmailVerifiedForMarketplaceCommitment(supplier.user.id);
  });

  test('security: only token hash stored and password reset does not verify email', async () => {
    const provider = new RecordingAuthEmailProvider();
    setAuthEmailProviderForTests(provider);
    const user = await createLearnerFixture({
      emailVerificationRequired: true,
      emailVerifiedAt: null,
    });

    await resendEmailVerification(user.id);
    const rawToken = latestVerificationToken(provider);
    const stored = await prisma.authToken.findFirst({
      where: { userId: user.id, tokenType: 'EMAIL_VERIFICATION' },
    });
    assert.ok(stored);
    assert.notEqual(stored!.tokenHash, rawToken);
    assert.equal(stored!.tokenHash, hashToken(rawToken));

    await requestPasswordReset(user.email);
    const resetToken = new URL(
      provider.passwordResetEmails.at(-1)!.resetLink,
    ).searchParams.get('token')!;
    await resetPasswordWithToken(resetToken, 'NewPassword123!');

    const afterReset = await prisma.user.findUnique({
      where: { id: user.id },
      select: { emailVerifiedAt: true, passwordHash: true },
    });
    assert.equal(afterReset?.emailVerifiedAt, null);
    assert.ok(await comparePassword('NewPassword123!', afterReset!.passwordHash));
  });
});
