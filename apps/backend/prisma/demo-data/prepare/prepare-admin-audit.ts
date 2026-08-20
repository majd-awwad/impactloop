import type { Prisma } from '../../../src/generated/prisma/client.js';
import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import {
  ADMIN_ACTIVITY_ACTIONS,
  listAdminActivityLogs,
} from '../../../src/modules/admin/admin-activity-log.js';
import { logAdminDataExport } from '../../../src/modules/admin-export/admin-export.audit.js';
import {
  createEmailInvitation,
  revokeInvitation,
} from '../../../src/modules/invitations/invitations.service.js';
import {
  hideAdminMaterial,
  restoreAdminMaterial,
  resolveAdminMaterialReport,
  submitMaterialReport,
} from '../../../src/modules/admin-materials/admin-materials.service.js';
import {
  reactivateAdminPerson,
  suspendAdminPerson,
} from '../../../src/modules/admin-people/admin-people.service.js';
import { submitCategoryRequest } from '../../../src/modules/category-requests/category-requests.service.js';
import { rejectCategoryRequest } from '../../../src/modules/admin-approvals/admin-approvals.service.js';
import {
  hideAdminLearningProject,
  restoreAdminLearningProject,
} from '../../../src/modules/admin-learning-projects/admin-learning-projects.service.js';
import { COMMUNITY_MATERIAL_BULK_TAG } from '../materials/load-canonical-materials.js';
import {
  ADMIN_EMAIL,
  ISRAA_LEARNER_EMAIL,
  redact,
} from './local-demo-accounts.js';
import {
  adminAuditDemoKey,
  CASH_HANDOVER_PREFERRED_TITLES,
  DRIVER_ON_THE_WAY_PREFERRED_TITLES,
} from './local-demo-keys.js';
import {
  hasDemoAuditScenario,
  readLocalDemoKey,
} from './admin-audit-idempotency.js';

const INVITE_EMAIL = 'local-demo-audit-moderator@impactloop.demo';
const CATEGORY_REQUEST_NAME = '[local-demo-admin-audit] Training capacitance foam';
const SUSPEND_TARGET_EMAIL = 'user4@impactloop.demo';
const PROJECT_HIDE_TITLE_INCLUDES = 'RootRise';
const REPORT_NOTE = 'localDemoKey:admin-audit-v1:material-report';

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60_000);

const DEMO_AUDIT_AGES_HOURS: Record<string, number> = {
  [adminAuditDemoKey('project-restored')]: 0.04,
  [adminAuditDemoKey('project-hidden')]: 0.08,
  [adminAuditDemoKey('user-reactivated')]: 0.12,
  [adminAuditDemoKey('user-suspended')]: 0.16,
  [adminAuditDemoKey('category-rejected')]: 0.2,
  [adminAuditDemoKey('material-report')]: 0.24,
  [adminAuditDemoKey('material-restored')]: 0.28,
  [adminAuditDemoKey('material-hidden')]: 0.32,
  [adminAuditDemoKey('invite-revoke')]: 0.36,
  [adminAuditDemoKey('invite-create')]: 0.4,
  [adminAuditDemoKey('export-materials')]: 0.44,
  [adminAuditDemoKey('export-users')]: 0.48,
};

const asMetadata = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

type AuditRow = {
  id: string;
  action: string;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
};

const loadDemoAuditRows = async (): Promise<AuditRow[]> =>
  prisma.adminActivityLog.findMany({
    select: {
      id: true,
      action: true,
      targetId: true,
      metadata: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

const stampAudit = async (input: {
  action: string;
  key: string;
  createdAt: Date;
  since: Date;
  targetId?: string;
  actorUserId: string;
}) => {
  let row = await prisma.adminActivityLog.findFirst({
    where: {
      actorUserId: input.actorUserId,
      action: input.action,
      createdAt: { gte: input.since },
      ...(input.targetId ? { targetId: input.targetId } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!row && input.targetId) {
    row = await prisma.adminActivityLog.findFirst({
      where: {
        actorUserId: input.actorUserId,
        action: input.action,
        targetId: input.targetId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (!row) {
    throw new Error(`Production logger did not create ${input.action} for ${input.key}.`);
  }
  await prisma.adminActivityLog.update({
    where: { id: row.id },
    data: {
      createdAt: input.createdAt,
      metadata: {
        ...asMetadata(row.metadata),
        localDemoKey: input.key,
      } as Prisma.InputJsonValue,
    },
  });
};

type ScenarioResult = {
  key: string;
  status: 'created' | 'skipped';
  action: string;
};

export async function prepareAdminAuditDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'admin audit demo prep');

  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, displayName: true, email: true },
  });
  if (!admin) {
    throw new Error(`Demo admin ${ADMIN_EMAIL} was not found.`);
  }

  const existing = await loadDemoAuditRows();
  const results: ScenarioResult[] = [];

  const skipIfPresent = (key: string, action: string): boolean => {
    if (hasDemoAuditScenario(existing, key)) {
      results.push({ key, status: 'skipped', action });
      return true;
    }
    return false;
  };

  const run = async (
    key: string,
    action: string,
    createdAt: Date,
    execute: () => Promise<{ targetId?: string } | void>,
  ) => {
    if (skipIfPresent(key, action)) {
      return;
    }
    const since = new Date();
    const outcome = (await execute()) ?? {};
    await stampAudit({
      action,
      key,
      createdAt,
      since,
      targetId: outcome.targetId,
      actorUserId: admin.id,
    });
    existing.push({
      id: key,
      action,
      targetId: outcome.targetId ?? null,
      metadata: { localDemoKey: key },
      createdAt,
    });
    results.push({ key, status: 'created', action });
  };

  await run(adminAuditDemoKey('export-users'), ADMIN_ACTIVITY_ACTIONS.DATA_EXPORTED, hoursAgo(96), async () => {
    await logAdminDataExport({
      actorUserId: admin.id,
      domain: 'users',
      format: 'xlsx',
      filters: { tab: 'ALL' },
      expectedCount: 0,
      exportedCount: 0,
      success: true,
    });
  });

  await run(
    adminAuditDemoKey('export-materials'),
    ADMIN_ACTIVITY_ACTIONS.DATA_EXPORTED,
    hoursAgo(72),
    async () => {
      await logAdminDataExport({
        actorUserId: admin.id,
        domain: 'materials',
        format: 'csv',
        filters: { status: 'AVAILABLE' },
        expectedCount: 0,
        exportedCount: 0,
        success: true,
      });
    },
  );

  const inviteCreateKey = adminAuditDemoKey('invite-create');
  const inviteRevokeKey = adminAuditDemoKey('invite-revoke');
  if (!hasDemoAuditScenario(existing, inviteCreateKey)) {
    const since = new Date();
    let invitation = await prisma.roleInvitation.findFirst({
      where: {
        targetEmail: INVITE_EMAIL,
        notes: { contains: inviteCreateKey },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!invitation) {
      const created = await createEmailInvitation(admin.id, {
        recipientEmail: INVITE_EMAIL,
        role: 'MODERATOR',
        expiresInMinutes: 1440,
        note: inviteCreateKey,
      });
      invitation = await prisma.roleInvitation.findUniqueOrThrow({
        where: { id: created.id },
      });
    }
    await stampAudit({
      action: ADMIN_ACTIVITY_ACTIONS.INVITATION_CREATED,
      key: inviteCreateKey,
      createdAt: hoursAgo(60),
      since,
      targetId: invitation.id,
      actorUserId: admin.id,
    });
    existing.push({
      id: invitation.id,
      action: ADMIN_ACTIVITY_ACTIONS.INVITATION_CREATED,
      targetId: invitation.id,
      metadata: { localDemoKey: inviteCreateKey },
      createdAt: hoursAgo(60),
    });
    results.push({
      key: inviteCreateKey,
      status: 'created',
      action: ADMIN_ACTIVITY_ACTIONS.INVITATION_CREATED,
    });

    if (!hasDemoAuditScenario(existing, inviteRevokeKey)) {
      const revokeSince = new Date();
      await revokeInvitation(invitation.id, admin.id);
      await stampAudit({
        action: ADMIN_ACTIVITY_ACTIONS.INVITATION_REVOKED,
        key: inviteRevokeKey,
        createdAt: hoursAgo(54),
        since: revokeSince,
        targetId: invitation.id,
        actorUserId: admin.id,
      });
      existing.push({
        id: `${invitation.id}-revoked`,
        action: ADMIN_ACTIVITY_ACTIONS.INVITATION_REVOKED,
        targetId: invitation.id,
        metadata: { localDemoKey: inviteRevokeKey },
        createdAt: hoursAgo(54),
      });
      results.push({
        key: inviteRevokeKey,
        status: 'created',
        action: ADMIN_ACTIVITY_ACTIONS.INVITATION_REVOKED,
      });
    }
  } else {
    results.push({
      key: inviteCreateKey,
      status: 'skipped',
      action: ADMIN_ACTIVITY_ACTIONS.INVITATION_CREATED,
    });
    if (hasDemoAuditScenario(existing, inviteRevokeKey)) {
      results.push({
        key: inviteRevokeKey,
        status: 'skipped',
        action: ADMIN_ACTIVITY_ACTIONS.INVITATION_REVOKED,
      });
    } else {
      const pending = await prisma.roleInvitation.findFirst({
        where: {
          targetEmail: INVITE_EMAIL,
          notes: { contains: inviteCreateKey },
          revokedAt: null,
          usedAt: null,
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
      });
      if (pending) {
        const revokeSince = new Date();
        await revokeInvitation(pending.id, admin.id);
        await stampAudit({
          action: ADMIN_ACTIVITY_ACTIONS.INVITATION_REVOKED,
          key: inviteRevokeKey,
          createdAt: hoursAgo(54),
          since: revokeSince,
          targetId: pending.id,
          actorUserId: admin.id,
        });
        results.push({
          key: inviteRevokeKey,
          status: 'created',
          action: ADMIN_ACTIVITY_ACTIONS.INVITATION_REVOKED,
        });
      }
    }
  }

  const hideKey = adminAuditDemoKey('material-hidden');
  const restoreKey = adminAuditDemoKey('material-restored');
  if (!hasDemoAuditScenario(existing, hideKey) || !hasDemoAuditScenario(existing, restoreKey)) {
    const forbiddenTitles = new Set<string>([
      ...CASH_HANDOVER_PREFERRED_TITLES,
      ...DRIVER_ON_THE_WAY_PREFERRED_TITLES,
    ]);
    const previousHide = existing.find((row) => readLocalDemoKey(row.metadata) === hideKey);
    const material = previousHide?.targetId
      ? await prisma.material.findUnique({
          where: { id: previousHide.targetId },
          select: { id: true, title: true, status: true },
        })
      : await prisma.material.findFirst({
          where: {
            status: 'AVAILABLE',
            title: { notIn: [...forbiddenTitles] },
            owner: { email: { not: 'majd@supplier.com' } },
            tags: { some: { tag: COMMUNITY_MATERIAL_BULK_TAG } },
            reservations: {
              none: {
                status: {
                  in: [
                    'PENDING',
                    'ACCEPTED',
                    'AWAITING_LEARNER_CONFIRMATION',
                    'AWAITING_SUPPLIER_CONFIRMATION',
                    'AWAITING_RESOLUTION',
                  ],
                },
              },
            },
          },
          select: { id: true, title: true, status: true },
          orderBy: { createdAt: 'asc' },
        });
    if (!material) {
      console.log('Skipping material hide/restore: no isolated community material.');
    } else {
      if (!hasDemoAuditScenario(existing, hideKey) && material.status === 'AVAILABLE') {
        const since = new Date();
        await hideAdminMaterial(admin.id, material.id, {
          reason: 'Local demo audit: temporary hide of an unused community listing.',
        });
        await stampAudit({
          action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_HIDDEN,
          key: hideKey,
          createdAt: hoursAgo(40),
          since,
          targetId: material.id,
          actorUserId: admin.id,
        });
        existing.push({
          id: material.id,
          action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_HIDDEN,
          targetId: material.id,
          metadata: { localDemoKey: hideKey },
          createdAt: hoursAgo(40),
        });
        results.push({
          key: hideKey,
          status: 'created',
          action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_HIDDEN,
        });
      }
      const current = await prisma.material.findUniqueOrThrow({
        where: { id: material.id },
        select: { status: true },
      });
      if (!hasDemoAuditScenario(existing, restoreKey) && current.status === 'UNAVAILABLE') {
        const since = new Date();
        await restoreAdminMaterial(admin.id, material.id);
        await stampAudit({
          action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_RESTORED,
          key: restoreKey,
          createdAt: hoursAgo(36),
          since,
          targetId: material.id,
          actorUserId: admin.id,
        });
        results.push({
          key: restoreKey,
          status: 'created',
          action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_RESTORED,
        });
      }
    }
  } else {
    results.push(
      { key: hideKey, status: 'skipped', action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_HIDDEN },
      { key: restoreKey, status: 'skipped', action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_RESTORED },
    );
  }

  const reportKey = adminAuditDemoKey('material-report');
  if (!skipIfPresent(reportKey, ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_RESOLVED)) {
    const israa = await prisma.user.findUnique({
      where: { email: ISRAA_LEARNER_EMAIL },
      select: { id: true },
    });
    const reportMaterial = await prisma.material.findFirst({
      where: {
        status: 'AVAILABLE',
        owner: { email: { not: ISRAA_LEARNER_EMAIL } },
        title: { notIn: [...CASH_HANDOVER_PREFERRED_TITLES, ...DRIVER_ON_THE_WAY_PREFERRED_TITLES] },
      },
      select: { id: true, title: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!israa || !reportMaterial) {
      console.log('Skipping material-report resolve: missing reporter or material.');
    } else {
      let report = await prisma.materialReport.findFirst({
        where: {
          reporterId: israa.id,
          materialId: reportMaterial.id,
          note: REPORT_NOTE,
        },
        select: { id: true, status: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!report) {
        const submitted = await submitMaterialReport(israa.id, reportMaterial.id, {
          reason: 'MISLEADING_INFORMATION',
          note: REPORT_NOTE,
        });
        report = { id: submitted.id, status: 'PENDING' };
      }
      if (report.status === 'PENDING') {
        const since = new Date();
        await resolveAdminMaterialReport(admin.id, report.id, {
          adminNote: 'Local demo audit: report reviewed, no listing action required.',
        });
        await stampAudit({
          action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_RESOLVED,
          key: reportKey,
          createdAt: hoursAgo(30),
          since,
          targetId: report.id,
          actorUserId: admin.id,
        });
        results.push({
          key: reportKey,
          status: 'created',
          action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_RESOLVED,
        });
      } else {
        results.push({
          key: reportKey,
          status: 'skipped',
          action: ADMIN_ACTIVITY_ACTIONS.MATERIAL_REPORT_RESOLVED,
        });
      }
    }
  }

  const categoryKey = adminAuditDemoKey('category-rejected');
  if (!skipIfPresent(categoryKey, ADMIN_ACTIVITY_ACTIONS.CATEGORY_REQUEST_REJECTED)) {
    const supplier = await prisma.user.findFirst({
      where: {
        email: { endsWith: '@impactloop.demo' },
        roles: { some: { role: 'SUPPLIER' } },
        accountStatus: 'ACTIVE',
      },
      select: { id: true, email: true },
      orderBy: { createdAt: 'asc' },
    });
    const suggestedCategory = await prisma.category.findFirst({
      where: { isActive: true, categoryType: { in: ['MATERIAL', 'BOTH'] } },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: 'asc' },
    });
    if (!supplier || !suggestedCategory) {
      console.log('Skipping category-request reject: missing supplier or category.');
    } else {
      let request = await prisma.categoryRequest.findFirst({
        where: { requestedName: CATEGORY_REQUEST_NAME },
        select: { id: true, status: true, requestedByUserId: true },
        orderBy: { createdAt: 'desc' },
      });
      if (!request) {
        const created = await submitCategoryRequest(supplier.id, {
          requestedName: CATEGORY_REQUEST_NAME,
          listingDraftJson: {
            materialName: 'Training capacitance foam offcuts',
            title: 'Training capacitance foam offcuts',
            description:
              'Soft foam offcuts used only as a stand-in for a capacitance sensing pad in classroom demos.',
            categoryRequestReason:
              'Existing electronics categories describe components, not this training foam consumable.',
            requestedCategoryName: CATEGORY_REQUEST_NAME,
            condition: 'GOOD',
            sourceType: 'WORKSHOP_SURPLUS',
            quantity: 1,
            unit: 'set',
            isFree: true,
            pickupAllowed: true,
            deliveryAllowed: false,
            currency: 'NIS',
            imageUrls: [],
          },
        });
        request = { id: created.id, status: created.status, requestedByUserId: supplier.id };
      }
      if (request.status === 'PENDING') {
        const since = new Date();
        await rejectCategoryRequest(admin.id, request.id, {
          adminNote: 'Use an existing electronics-components category for this training foam.',
          suggestedCategoryId: suggestedCategory.id,
        });
        await stampAudit({
          action: ADMIN_ACTIVITY_ACTIONS.CATEGORY_REQUEST_REJECTED,
          key: categoryKey,
          createdAt: hoursAgo(22),
          since,
          targetId: request.id,
          actorUserId: admin.id,
        });
        results.push({
          key: categoryKey,
          status: 'created',
          action: ADMIN_ACTIVITY_ACTIONS.CATEGORY_REQUEST_REJECTED,
        });
      } else {
        results.push({
          key: categoryKey,
          status: 'skipped',
          action: ADMIN_ACTIVITY_ACTIONS.CATEGORY_REQUEST_REJECTED,
        });
      }
    }
  }

  const suspendKey = adminAuditDemoKey('user-suspended');
  const reactivateKey = adminAuditDemoKey('user-reactivated');
  if (!hasDemoAuditScenario(existing, suspendKey) || !hasDemoAuditScenario(existing, reactivateKey)) {
    const target = await prisma.user.findUnique({
      where: { email: SUSPEND_TARGET_EMAIL },
      select: {
        id: true,
        displayName: true,
        accountStatus: true,
        roles: { select: { role: true } },
      },
    });
    if (!target || target.roles.some((row) => row.role === 'ADMIN')) {
      console.log(`Skipping suspend/reactivate: ${SUSPEND_TARGET_EMAIL} is missing or protected.`);
    } else {
      if (!hasDemoAuditScenario(existing, suspendKey) && target.accountStatus !== 'SUSPENDED') {
        const since = new Date();
        await suspendAdminPerson(admin.id, target.id, {
          reason: 'Local demo audit: temporary review of an unused community learner account.',
        });
        await stampAudit({
          action: ADMIN_ACTIVITY_ACTIONS.USER_SUSPENDED,
          key: suspendKey,
          createdAt: hoursAgo(14),
          since,
          targetId: target.id,
          actorUserId: admin.id,
        });
        results.push({
          key: suspendKey,
          status: 'created',
          action: ADMIN_ACTIVITY_ACTIONS.USER_SUSPENDED,
        });
      } else if (hasDemoAuditScenario(existing, suspendKey)) {
        results.push({
          key: suspendKey,
          status: 'skipped',
          action: ADMIN_ACTIVITY_ACTIONS.USER_SUSPENDED,
        });
      }
      const current = await prisma.user.findUniqueOrThrow({
        where: { id: target.id },
        select: { accountStatus: true },
      });
      if (!hasDemoAuditScenario(existing, reactivateKey) && current.accountStatus === 'SUSPENDED') {
        const since = new Date();
        await reactivateAdminPerson(admin.id, target.id);
        await stampAudit({
          action: ADMIN_ACTIVITY_ACTIONS.USER_REACTIVATED,
          key: reactivateKey,
          createdAt: hoursAgo(12),
          since,
          targetId: target.id,
          actorUserId: admin.id,
        });
        results.push({
          key: reactivateKey,
          status: 'created',
          action: ADMIN_ACTIVITY_ACTIONS.USER_REACTIVATED,
        });
      } else if (hasDemoAuditScenario(existing, reactivateKey)) {
        results.push({
          key: reactivateKey,
          status: 'skipped',
          action: ADMIN_ACTIVITY_ACTIONS.USER_REACTIVATED,
        });
      }
    }
  } else {
    results.push(
      { key: suspendKey, status: 'skipped', action: ADMIN_ACTIVITY_ACTIONS.USER_SUSPENDED },
      { key: reactivateKey, status: 'skipped', action: ADMIN_ACTIVITY_ACTIONS.USER_REACTIVATED },
    );
  }

  const projectHideKey = adminAuditDemoKey('project-hidden');
  const projectRestoreKey = adminAuditDemoKey('project-restored');
  if (
    !hasDemoAuditScenario(existing, projectHideKey) ||
    !hasDemoAuditScenario(existing, projectRestoreKey)
  ) {
    const project = await prisma.learningProject.findFirst({
      where: {
        title: { contains: PROJECT_HIDE_TITLE_INCLUDES, mode: 'insensitive' },
        createdByUser: { email: 'learner@learner.com' },
        status: { in: ['PUBLISHED', 'HIDDEN'] },
      },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!project) {
      console.log('Skipping learning-project hide/restore: RootRise project not found.');
    } else {
      if (!hasDemoAuditScenario(existing, projectHideKey) && project.status === 'PUBLISHED') {
        const since = new Date();
        await hideAdminLearningProject(admin.id, project.id, {
          reason: 'Local demo audit: temporary unpublish of a non-featured project.',
        });
        await stampAudit({
          action: ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_HIDDEN,
          key: projectHideKey,
          createdAt: hoursAgo(8),
          since,
          targetId: project.id,
          actorUserId: admin.id,
        });
        results.push({
          key: projectHideKey,
          status: 'created',
          action: ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_HIDDEN,
        });
      }
      const current = await prisma.learningProject.findUniqueOrThrow({
        where: { id: project.id },
        select: { status: true },
      });
      if (!hasDemoAuditScenario(existing, projectRestoreKey) && current.status === 'HIDDEN') {
        const since = new Date();
        await restoreAdminLearningProject(admin.id, project.id);
        await stampAudit({
          action: ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_RESTORED,
          key: projectRestoreKey,
          createdAt: hoursAgo(6),
          since,
          targetId: project.id,
          actorUserId: admin.id,
        });
        results.push({
          key: projectRestoreKey,
          status: 'created',
          action: ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_RESTORED,
        });
      }
    }
  } else {
    results.push(
      {
        key: projectHideKey,
        status: 'skipped',
        action: ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_HIDDEN,
      },
      {
        key: projectRestoreKey,
        status: 'skipped',
        action: ADMIN_ACTIVITY_ACTIONS.LEARNING_PROJECT_RESTORED,
      },
    );
  }

  const stamped = await loadDemoAuditRows();
  for (const [key, hours] of Object.entries(DEMO_AUDIT_AGES_HOURS)) {
    const row = stamped.find((item) => readLocalDemoKey(item.metadata) === key);
    if (!row) {
      continue;
    }
    await prisma.adminActivityLog.update({
      where: { id: row.id },
      data: { createdAt: hoursAgo(hours) },
    });
  }

  const listed = await listAdminActivityLogs({ page: 1, limit: 20 });
  const demoKeys = listed.items
    .map((item) => readLocalDemoKey(item.metadata))
    .filter((key): key is string => Boolean(key));
  const actions = [...new Set(listed.items.map((item) => item.action))];

  console.log('\nAdmin audit demo prep complete.');
  console.log(`Actor: ${admin.displayName} <${admin.email}> (${redact(admin.id)})`);
  console.log(
    JSON.stringify(
      {
        scenarios: results,
        visible: {
          total: listed.pagination.total,
          pageCount: listed.items.length,
          actions,
          actorNames: [...new Set(listed.items.map((item) => item.actorName))],
          demoKeysOnPage: demoKeys,
          mostRecentAt: listed.summary.mostRecentAt,
        },
      },
      null,
      2,
    ),
  );

  return {
    results,
    visibleTotal: listed.pagination.total,
    visibleActions: actions,
    items: listed.items,
  };
}
