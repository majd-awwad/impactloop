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
  resendEmailInvitation,
  revokeInvitation,
  validateInvitationToken,
} from './invitations.service.js';
import { adminCreateInvitationSchema } from './invitations.validation.js';
import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { hashToken } from '../../utils/token.js';

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
            recipientEmail: `${TEST_MARKER}-missing-base@impactloop.test`,
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
