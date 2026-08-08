import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import type { EmailInvitationProvider } from './email/email-invitation-provider.js';
import {
  getEmailInvitationProviderName,
  resetEmailInvitationProviderForTests,
  setEmailInvitationProviderForTests,
} from './email/index.js';
import * as invitationsRepository from './invitations.repository.js';
import {
  acceptInvitation,
  createEmailInvitation,
  getInvitationForAdmin,
  issueInvitationLinkForAdmin,
  resendEmailInvitation,
  revokeInvitation,
  validateInvitationToken,
} from './invitations.service.js';
import { adminCreateInvitationSchema } from './invitations.validation.js';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { hashToken } from '../../utils/token.js';
import { AppError } from '../../utils/app-error.js';

const TEST_MARKER = '[test-invitations]';

type CreatedIds = {
  users: string[];
  invitations: string[];
};

const ids: CreatedIds = { users: [], invitations: [] };

async function createAdminUser() {
  const passwordHash = await hashPassword('TestPassword123!');
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Admin`,
      email: `${TEST_MARKER}-admin-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

class RecordingEmailProvider implements EmailInvitationProvider {
  public lastPayload: {
    recipientEmail: string;
    role: string;
    inviteLink: string;
  } | null = null;

  public mode: 'success' | 'failure' = 'success';

  async sendInvitationEmail(payload: {
    recipientEmail: string;
    role: string;
    inviteLink: string;
    expiresAt: Date;
  }) {
    this.lastPayload = payload;

    if (this.mode === 'failure') {
      return {
        sendStatus: 'FAILED' as const,
        sendError: 'SMTP connection failed',
      };
    }

    return {
      sendStatus: 'SENT' as const,
      providerMessageId: `test-message-${Date.now()}`,
    };
  }
}

before(() => {
  process.env.EMAIL_PROVIDER = 'mock';
  process.env.APP_PUBLIC_BASE_URL = 'http://localhost:53077';
});

after(async () => {
  if (ids.invitations.length > 0) {
    await prisma.roleInvitation.deleteMany({
      where: { id: { in: ids.invitations } },
    });
  }

  if (ids.users.length > 0) {
    await prisma.driverProfile.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ids.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }

  resetEmailInvitationProviderForTests();
});

describe('admin email invitations', () => {
  test('admin can create email invitation', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: `${TEST_MARKER}-driver@impactloop.test`,
      expiresInMinutes: 60,
    });

    ids.invitations.push(created.id);

    assert.equal(created.sendStatus, 'SENT');
    assert.match(created.inviteLink, /\/invite\/accept\?token=/);
    assert.equal(provider.lastPayload?.recipientEmail, `${TEST_MARKER}-driver@impactloop.test`);

    const stored = await prisma.roleInvitation.findUnique({ where: { id: created.id } });
    assert.ok(stored?.tokenHash);
    assert.notEqual(stored?.tokenHash, created.inviteLink);
  });

  test('create fails when APP_PUBLIC_BASE_URL is not configured', async () => {
    const previous = process.env.APP_PUBLIC_BASE_URL;
    delete process.env.APP_PUBLIC_BASE_URL;

    try {
      const provider = new RecordingEmailProvider();
      setEmailInvitationProviderForTests(provider);
      const admin = await createAdminUser();

      await assert.rejects(
        () =>
          createEmailInvitation(admin.id, {
            role: 'DRIVER',
            recipientEmail: `${TEST_MARKER}-missing-base-${Date.now()}@impactloop.test`,
            expiresInMinutes: 60,
          }),
        /APP_PUBLIC_BASE_URL is not configured/,
      );
    } finally {
      process.env.APP_PUBLIC_BASE_URL = previous ?? 'http://localhost:53077';
    }
  });

  test('smtp mode selects smtp provider name', () => {
    const previous = process.env.EMAIL_PROVIDER;
    process.env.EMAIL_PROVIDER = 'smtp';
    resetEmailInvitationProviderForTests();

    try {
      assert.equal(getEmailInvitationProviderName(), 'smtp');
    } finally {
      process.env.EMAIL_PROVIDER = previous ?? 'mock';
      resetEmailInvitationProviderForTests();
    }
  });

  test('mock provider sets SENT and providerMessageId', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'MODERATOR',
      recipientEmail: `${TEST_MARKER}-moderator@impactloop.test`,
      expiresInMinutes: 30,
    });
    ids.invitations.push(created.id);

    const stored = await prisma.roleInvitation.findUnique({ where: { id: created.id } });
    assert.equal(stored?.sendStatus, 'SENT');
    assert.ok(stored?.providerMessageId);
    assert.ok(stored?.sentAt);
  });

  test('provider failure sets FAILED and sendError', async () => {
    const provider = new RecordingEmailProvider();
    provider.mode = 'failure';
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'ADMIN',
      recipientEmail: `${TEST_MARKER}-failed@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    assert.equal(created.sendStatus, 'FAILED');
    assert.equal(created.sendError, 'SMTP connection failed');

    const stored = await prisma.roleInvitation.findUnique({ where: { id: created.id } });
    assert.equal(stored?.sendStatus, 'FAILED');
    assert.equal(stored?.sendError, 'SMTP connection failed');
  });

  test('tokenHash stored and raw token not stored', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: `${TEST_MARKER}-hash@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token');
    assert.ok(token);

    const stored = await prisma.roleInvitation.findUnique({ where: { id: created.id } });
    assert.equal(stored?.tokenHash, hashToken(token!));
    assert.notEqual(stored?.tokenHash, token);
  });

  test('resend works for unused invitation', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: `${TEST_MARKER}-resend@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const oldToken = new URL(created.inviteLink).searchParams.get('token');
    const resent = await resendEmailInvitation(created.id);
    const newToken = new URL(resent.inviteLink).searchParams.get('token');

    assert.notEqual(oldToken, newToken);
    assert.equal(resent.sendStatus, 'SENT');
  });

  test('revoke works for unused invitation', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'MODERATOR',
      recipientEmail: `${TEST_MARKER}-revoke@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const revoked = await revokeInvitation(created.id);
    assert.equal(revoked.status, 'REVOKED');
  });

  test('used invitation cannot be revoked', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'MODERATOR',
      recipientEmail: `${TEST_MARKER}-used-revoke@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token')!;
    const accepted = await acceptInvitation({
      token,
      fullName: 'Used Moderator',
      email: `${TEST_MARKER}-used-revoke@impactloop.test`,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    ids.users.push(accepted.userId);

    await assert.rejects(() => revokeInvitation(created.id), /cannot be revoked/);
  });

  test('validate valid token works', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'ADMIN',
      recipientEmail: `${TEST_MARKER}-validate@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token')!;
    const result = await validateInvitationToken(token);

    assert.equal(result.valid, true);
    assert.equal(result.role, 'ADMIN');
    assert.equal(result.recipientEmail, `${TEST_MARKER}-validate@impactloop.test`);
  });

  test('expired token rejected', async () => {
    const admin = await createAdminUser();
    const rawToken = 'expired-token-value';
    const invitation = await invitationsRepository.createInvitationRecord({
      targetEmail: `${TEST_MARKER}-expired@impactloop.test`,
      targetRole: 'DRIVER',
      tokenHash: hashToken(rawToken),
      invitedBy: admin.id,
      expiresAt: new Date(Date.now() - 60_000),
    });
    ids.invitations.push(invitation.id);

    const result = await validateInvitationToken(rawToken);
    assert.equal(result.valid, false);
  });

  test('revoked token rejected', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: `${TEST_MARKER}-revoked-token@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);
    await revokeInvitation(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token')!;
    const result = await validateInvitationToken(token);
    assert.equal(result.valid, false);
  });

  test('used token rejected', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'ADMIN',
      recipientEmail: `${TEST_MARKER}-used-token@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token')!;
    const accepted = await acceptInvitation({
      token,
      fullName: 'Accepted Admin',
      email: `${TEST_MARKER}-used-token@impactloop.test`,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    ids.users.push(accepted.userId);

    const result = await validateInvitationToken(token);
    assert.equal(result.valid, false);
  });

  test('accept DRIVER creates user, role, and driver profile', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const email = `${TEST_MARKER}-driver-accept@impactloop.test`;
    const created = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token')!;
    const accepted = await acceptInvitation({
      token,
      fullName: 'Driver User',
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
      phone: '+970599000111',
      city: 'Nablus',
      area: 'Rafidia',
      transportationType: 'CAR',
      addressLine: 'Street 1',
      availabilityNote: 'Weekdays',
    });
    ids.users.push(accepted.userId);

    const roles = await prisma.userRoleAssignment.findMany({
      where: { userId: accepted.userId },
    });
    assert.deepEqual(roles.map((role) => role.role), ['DRIVER']);

    const profile = await prisma.driverProfile.findUnique({
      where: { userId: accepted.userId },
    });
    assert.equal(profile?.city, 'Nablus');
    assert.equal(profile?.transportationType, 'CAR');
    assert.equal(profile?.acceptingNewJobs, false);
    assert.equal(profile?.availability, 'OFFLINE');
  });

  test('accept MODERATOR creates user and MODERATOR role', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const email = `${TEST_MARKER}-moderator-accept@impactloop.test`;
    const created = await createEmailInvitation(admin.id, {
      role: 'MODERATOR',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token')!;
    const accepted = await acceptInvitation({
      token,
      fullName: 'Moderator User',
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    ids.users.push(accepted.userId);

    const roles = await prisma.userRoleAssignment.findMany({
      where: { userId: accepted.userId },
    });
    assert.deepEqual(roles.map((role) => role.role), ['MODERATOR']);
  });

  test('accept ADMIN creates user and ADMIN role', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const email = `${TEST_MARKER}-admin-accept@impactloop.test`;
    const created = await createEmailInvitation(admin.id, {
      role: 'ADMIN',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token')!;
    const accepted = await acceptInvitation({
      token,
      fullName: 'Admin User',
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    ids.users.push(accepted.userId);

    const roles = await prisma.userRoleAssignment.findMany({
      where: { userId: accepted.userId },
    });
    assert.deepEqual(roles.map((role) => role.role), ['ADMIN']);
  });

  test('token cannot be accepted twice', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const email = `${TEST_MARKER}-double-accept@impactloop.test`;
    const created = await createEmailInvitation(admin.id, {
      role: 'MODERATOR',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token')!;
    const accepted = await acceptInvitation({
      token,
      fullName: 'Once Only',
      email,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
    ids.users.push(accepted.userId);

    await assert.rejects(
      () =>
        acceptInvitation({
          token,
          fullName: 'Twice',
          email,
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      /Invitation already used|already registered/,
    );
  });

  test('email from invitation cannot be changed during accept', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'ADMIN',
      recipientEmail: `${TEST_MARKER}-locked-email@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const token = new URL(created.inviteLink).searchParams.get('token')!;

    await assert.rejects(
      () =>
        acceptInvitation({
          token,
          fullName: 'Wrong Email',
          email: 'other@impactloop.test',
          password: 'Password123!',
          confirmPassword: 'Password123!',
        }),
      /does not match/,
    );
  });
});

describe('admin invitation duplicate prevention', () => {
  test('creating invite succeeds when no active pending duplicate exists', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'MODERATOR',
      recipientEmail: `${TEST_MARKER}-unique-${Date.now()}@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    assert.equal(created.canCopyLink, true);
    assert.equal(provider.lastPayload != null, true);
  });

  test('duplicate active pending invite for same email and role returns 409', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();
    const email = `${TEST_MARKER}-dup-${Date.now()}@impactloop.test`;

    const created = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);
    assert.equal(provider.lastPayload != null, true);
    provider.lastPayload = null;

    await assert.rejects(
      () =>
        createEmailInvitation(admin.id, {
          role: 'DRIVER',
          recipientEmail: email,
          expiresInMinutes: 60,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, 'DUPLICATE_PENDING_INVITATION');
        assert.match(
          error.message,
          /active pending invitation already exists/i,
        );
        return true;
      },
    );

    assert.equal(provider.lastPayload, null);
    const count = await prisma.roleInvitation.count({
      where: {
        targetEmail: email.toLowerCase(),
        targetRole: 'DRIVER',
      },
    });
    assert.equal(count, 1);
  });

  test('duplicate check is case-insensitive and trims email', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();
    const email = `${TEST_MARKER}-case-${Date.now()}@impactloop.test`;

    const created = await createEmailInvitation(admin.id, {
      role: 'ADMIN',
      recipientEmail: `  ${email.toUpperCase()}  `,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);
    provider.lastPayload = null;

    await assert.rejects(
      () =>
        createEmailInvitation(admin.id, {
          role: 'ADMIN',
          recipientEmail: email.toLowerCase(),
          expiresInMinutes: 60,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        return true;
      },
    );
  });

  test('expired invite does not block creating a new invite', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();
    const email = `${TEST_MARKER}-expired-${Date.now()}@impactloop.test`;

    const created = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    await prisma.roleInvitation.update({
      where: { id: created.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const second = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(second.id);
    assert.notEqual(second.id, created.id);
  });

  test('revoked invite does not block creating a new invite', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();
    const email = `${TEST_MARKER}-revoked-${Date.now()}@impactloop.test`;

    const created = await createEmailInvitation(admin.id, {
      role: 'MODERATOR',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);
    await revokeInvitation(created.id);

    const second = await createEmailInvitation(admin.id, {
      role: 'MODERATOR',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(second.id);
    assert.equal(second.canCopyLink, true);
  });

  test('concurrent duplicate active pending invites are blocked by activeKey', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();
    const email = `${TEST_MARKER}-concurrent-${Date.now()}@impactloop.test`;

    const [first, second] = await Promise.allSettled([
      createEmailInvitation(admin.id, {
        role: 'DRIVER',
        recipientEmail: email,
        expiresInMinutes: 60,
      }),
      createEmailInvitation(admin.id, {
        role: 'DRIVER',
        recipientEmail: email,
        expiresInMinutes: 60,
      }),
    ]);

    const successes = [first, second].filter(
      (result) => result.status === 'fulfilled',
    );
    const failures = [first, second].filter(
      (result) => result.status === 'rejected',
    );

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);
    const failure = failures[0];
    assert.equal(failure.status, 'rejected');
    assert.ok(failure.reason instanceof AppError);
    assert.equal(failure.reason.code, 'DUPLICATE_PENDING_INVITATION');

    const success = successes[0] as PromiseFulfilledResult<{ id: string }>;
    ids.invitations.push(success.value.id);

    const count = await prisma.roleInvitation.count({
      where: {
        targetEmail: email.toLowerCase(),
        targetRole: 'DRIVER',
      },
    });
    assert.equal(count, 1);
  });

  test('different role for same email is allowed', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();
    const email = `${TEST_MARKER}-multirole-${Date.now()}@impactloop.test`;

    const driverInvite = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(driverInvite.id);

    const adminInvite = await createEmailInvitation(admin.id, {
      role: 'ADMIN',
      recipientEmail: email,
      expiresInMinutes: 60,
    });
    ids.invitations.push(adminInvite.id);

    assert.notEqual(driverInvite.id, adminInvite.id);
  });

  test('issue link returns url only for active pending invitations', async () => {
    const provider = new RecordingEmailProvider();
    setEmailInvitationProviderForTests(provider);
    const admin = await createAdminUser();

    const created = await createEmailInvitation(admin.id, {
      role: 'DRIVER',
      recipientEmail: `${TEST_MARKER}-link-${Date.now()}@impactloop.test`,
      expiresInMinutes: 60,
    });
    ids.invitations.push(created.id);

    const issued = await issueInvitationLinkForAdmin(created.id);
    assert.match(issued.invitationUrl, /\/invite\/accept\?token=/);

    const detail = await getInvitationForAdmin(created.id);
    assert.equal(detail.canCopyLink, true);

    await revokeInvitation(created.id);

    await assert.rejects(
      () => issueInvitationLinkForAdmin(created.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /no longer active/i);
        return true;
      },
    );
  });
});

describe('admin invitation validation', () => {
  test('email is required', () => {
    const result = adminCreateInvitationSchema.safeParse({
      role: 'DRIVER',
      expiresInMinutes: 60,
    });
    assert.equal(result.success, false);
  });

  test('invalid email rejected', () => {
    const result = adminCreateInvitationSchema.safeParse({
      role: 'DRIVER',
      recipientEmail: 'not-an-email',
      expiresInMinutes: 60,
    });
    assert.equal(result.success, false);
  });
});
