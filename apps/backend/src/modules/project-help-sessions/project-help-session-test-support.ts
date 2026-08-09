import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { NOTIFICATION_ENTITY_TYPES } from '../notifications/notification-identifiers.js';
import { upsertAuthorHelpSessionSettings } from './project-help-session-offering.js';
import { startProjectBuildById } from '../learning-projects/learning-projects.service.js';

export const TEST_MARKER = '[test-project-help-session-negotiation]';

export const ids = {
  users: [] as string[],
  categories: [] as string[],
  materialCategories: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  offerings: [] as string[],
  sessions: [] as string[],
  notifications: [] as string[],
  steps: [] as string[],
};

export async function createLearner(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Learner ${suffix}`,
      email: `${TEST_MARKER}-learner-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
      learnerProfile: {
        create: { learnerType: 'STUDENT', skillLevel: 'BEGINNER' },
      },
    },
  });
  ids.users.push(user.id);
  return user;
}

export async function createAdmin(suffix: string) {
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} Admin ${suffix}`,
      email: `${TEST_MARKER}-admin-${suffix}-${Date.now()}-${Math.random()}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      phone: `+97059${Date.now().toString().slice(-7)}${Math.floor(Math.random() * 100)
        .toString()
        .padStart(2, '0')}`,
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
    },
  });
  ids.users.push(user.id);
  return user;
}

export async function createPublishedProject(authorId: string, reviewedById?: string) {
  const projectCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Projects`,
      nameAr: `${TEST_MARKER} مشاريع`,
      categoryType: 'PROJECT',
      isActive: true,
    },
  });
  ids.categories.push(projectCategory.id);

  const materialCategory = await prisma.category.create({
    data: {
      nameEn: `${TEST_MARKER} Electronics`,
      nameAr: `${TEST_MARKER} إلكترونيات`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });
  ids.materialCategories.push(materialCategory.id);

  const project = await prisma.learningProject.create({
    data: {
      categoryId: projectCategory.id,
      createdBy: authorId,
      reviewedBy: reviewedById ?? null,
      reviewedAt: reviewedById ? new Date() : null,
      title: `${TEST_MARKER} Project`,
      shortDescription: 'Short description for help sessions',
      description: 'Description for help sessions',
      difficulty: 'BEGINNER',
      status: 'PUBLISHED',
      submittedAt: new Date(),
      requiredComponents: {
        create: [
          {
            componentName: 'LED',
            materialType: 'LED',
            quantity: 1,
            unit: 'piece',
            componentRole: 'REQUIRED_MATERIAL',
            categoryId: materialCategory.id,
          },
        ],
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            title: 'Step one',
            description: 'Do step one',
            reviewStatus: 'ACCEPTED',
          },
        ],
      },
    },
    include: { steps: true },
  });
  ids.projects.push(project.id);
  ids.steps.push(...project.steps.map((step) => step.id));
  return project;
}

export async function enableOffering(projectId: string, authorId: string, weeklyLimit = 3) {
  await upsertAuthorHelpSessionSettings(projectId, authorId, {
    isEnabled: true,
    allow15Minutes: true,
    allow30Minutes: true,
    weeklyLimit,
  });
  const stored = await prisma.projectHelpSessionOffering.findUnique({
    where: { projectId },
  });
  if (stored) {
    ids.offerings.push(stored.id);
  }
  return stored;
}

export async function createLearnerBuild(projectId: string, learnerId: string) {
  const build = await startProjectBuildById(projectId, learnerId);
  ids.builds.push(build.id);
  return build;
}

export function futureIso(minutesFromNow: number) {
  return new Date(Date.now() + minutesFromNow * 60_000).toISOString();
}

export function defaultProposedTimes() {
  return [futureIso(120), futureIso(180), futureIso(240)];
}

export function validProblemDescription() {
  return 'I need help wiring the sensor circuit correctly for this project step.';
}

export async function deleteProjectHelpSessionNotifications(
  sessionIds: string[],
) {
  if (sessionIds.length === 0) {
    return;
  }
  await prisma.notification.deleteMany({
    where: {
      OR: [
        {
          relatedEntityType: NOTIFICATION_ENTITY_TYPES.PROJECT_HELP_SESSION,
          relatedEntityId: { in: sessionIds },
        },
        {
          entityType: NOTIFICATION_ENTITY_TYPES.PROJECT_HELP_SESSION,
          entityId: { in: sessionIds },
        },
      ],
    },
  });
}

export async function cleanupNegotiationTests() {
  const sessionIds = new Set<string>(ids.sessions);
  if (ids.projects.length > 0) {
    const projectSessions = await prisma.projectHelpSession.findMany({
      where: { projectId: { in: ids.projects } },
      select: { id: true },
    });
    for (const session of projectSessions) {
      sessionIds.add(session.id);
    }
  }

  await deleteProjectHelpSessionNotifications([...sessionIds]);

  if (ids.users.length > 0) {
    await prisma.notification.deleteMany({
      where: { userId: { in: ids.users } },
    });
  }

  if (ids.projects.length > 0) {
    await prisma.projectHelpSessionStatusHistory.deleteMany({
      where: { session: { projectId: { in: ids.projects } } },
    });
    await prisma.projectHelpSessionTimeOption.deleteMany({
      where: { session: { projectId: { in: ids.projects } } },
    });
    await prisma.projectHelpSession.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.projectHelpSessionOffering.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.projectBuildNotebook.deleteMany({
      where: { build: { projectId: { in: ids.projects } } },
    });
    await prisma.projectBuildLearningSession.deleteMany({
      where: { build: { projectId: { in: ids.projects } } },
    });
    await prisma.projectBuild.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.projectLearningPack.deleteMany({
      where: { projectId: { in: ids.projects } },
    });
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
    });
  }

  if (ids.materialCategories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.materialCategories } } });
  }
  if (ids.categories.length > 0) {
    await prisma.category.deleteMany({ where: { id: { in: ids.categories } } });
  }
  if (ids.users.length > 0) {
    await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.learnerProfile.deleteMany({ where: { userId: { in: ids.users } } });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
  }

  ids.users.length = 0;
  ids.categories.length = 0;
  ids.materialCategories.length = 0;
  ids.projects.length = 0;
  ids.builds.length = 0;
  ids.offerings.length = 0;
  ids.sessions.length = 0;
  ids.notifications.length = 0;
  ids.steps.length = 0;
}

export async function trackSession(sessionId: string) {
  ids.sessions.push(sessionId);
}
