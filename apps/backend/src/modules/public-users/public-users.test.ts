import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';

import { prisma } from '../../database/prisma.js';
import { hashPassword } from '../../utils/password.js';
import { getLearningProjectById, getLearningProjects } from '../learning-projects/learning-projects.service.js';
import { resolveProjectHelpSessionAuthor } from '../project-help-sessions/project-help-session-author.js';
import { listLearnerHelpSessionProjectOptions } from '../project-help-sessions/project-help-session-project-options.service.js';
import {
  getPublicUserProfile,
  getPublicUserProjects,
} from './public-users.service.js';

const marker = `[test-public-users-${Date.now()}]`;
const ids = {
  users: [] as string[],
  projects: [] as string[],
  builds: [] as string[],
  category: '',
};

const createUser = async (input: {
  displayName: string;
  roles: Array<'LEARNER' | 'SUPPLIER'>;
  supplierName?: string;
  learnerProfile?: {
    learnerType?: string;
    skillLevel?: string;
    bio?: string;
    interests?: string[];
  };
}) => {
  const user = await prisma.user.create({
    data: {
      displayName: input.displayName,
      email: `${marker}-${ids.users.length}@impactloop.test`,
      passwordHash: await hashPassword('TestPassword123!'),
      accountStatus: 'ACTIVE',
      profileImageUrl: '/uploads/profiles/public-user.png',
      roles: {
        create: input.roles.map((role, index) => ({
          role,
          isPrimary: index === 0,
        })),
      },
      ...(input.learnerProfile
        ? {
            learnerProfile: {
              create: {
                learnerType: input.learnerProfile.learnerType,
                skillLevel: input.learnerProfile.skillLevel,
                bio: input.learnerProfile.bio,
                interests: input.learnerProfile.interests ?? [],
              },
            },
          }
        : {}),
      ...(input.supplierName
        ? {
            supplierProfile: {
              create: {
                supplierType: 'INDIVIDUAL_SUPPLIER',
                publicName: input.supplierName,
                verificationStatus: 'VERIFIED',
              },
            },
          }
        : {}),
    },
  });
  ids.users.push(user.id);
  return user;
};

const createProject = async (input: {
  creatorId: string;
  title: string;
  status?: 'PUBLISHED' | 'DRAFT' | 'HIDDEN';
}) => {
  const project = await prisma.learningProject.create({
    data: {
      categoryId: ids.category,
      createdBy: input.creatorId,
      title: input.title,
      shortDescription: `${marker} summary`,
      description: `${marker} description`,
      difficulty: 'BEGINNER',
      status: input.status ?? 'PUBLISHED',
      ...(input.status === 'HIDDEN' ? { hiddenAt: new Date() } : {}),
    },
  });
  ids.projects.push(project.id);
  return project;
};

let creator: Awaited<ReturnType<typeof createUser>>;
let arabicCreator: Awaited<ReturnType<typeof createUser>>;
let requester: Awaited<ReturnType<typeof createUser>>;
let publishedProject: Awaited<ReturnType<typeof createProject>>;

describe('public user creator discoverability', () => {
  before(async () => {
    const category = await prisma.category.create({
      data: {
        nameEn: `${marker} projects`,
        nameAr: `${marker} مشاريع`,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
    ids.category = category.id;

    creator = await createUser({
      displayName: `${marker} Majd Awad`,
      roles: ['LEARNER', 'SUPPLIER'],
      supplierName: `${marker} Reuse Workshop`,
      learnerProfile: {
        learnerType: 'University student',
        skillLevel: 'Intermediate',
        bio: 'Builds CNC tools for community workshops.',
        interests: ['Arduino', ' robotics ', 'Arduino', ''],
      },
    });
    arabicCreator = await createUser({
      displayName: `${marker} إسراء حداد`,
      roles: ['LEARNER'],
      learnerProfile: {
        learnerType: 'Self learner',
        skillLevel: 'Beginner',
      },
    });
    requester = await createUser({
      displayName: `${marker} Requester`,
      roles: ['LEARNER'],
    });

    publishedProject = await createProject({
      creatorId: creator.id,
      title: `${marker} CNC project`,
    });
    const draftProject = await createProject({
      creatorId: creator.id,
      title: `${marker} private draft`,
      status: 'DRAFT',
    });
    await createProject({
      creatorId: creator.id,
      title: `${marker} hidden project`,
      status: 'HIDDEN',
    });
    await createProject({
      creatorId: arabicCreator.id,
      title: `${marker} Arabic project`,
    });

    await prisma.projectLike.createMany({
      data: [
        { projectId: publishedProject.id, userId: requester.id },
        { projectId: draftProject.id, userId: requester.id },
      ],
    });

    const build = await prisma.projectBuild.create({
      data: {
        projectId: publishedProject.id,
        learnerId: requester.id,
        status: 'IN_PROGRESS',
      },
    });
    ids.builds.push(build.id);
    await prisma.projectHelpSessionOffering.create({
      data: {
        projectId: publishedProject.id,
        authorId: creator.id,
        isEnabled: true,
        allow15Minutes: true,
        weeklyLimit: 3,
      },
    });
  });

  after(async () => {
    await prisma.projectBuild.deleteMany({ where: { id: { in: ids.builds } } });
    await prisma.learningProject.deleteMany({
      where: { id: { in: ids.projects } },
    });
    await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
    if (ids.category) {
      await prisma.category.delete({ where: { id: ids.category } });
    }
  });

  test('Learning list/detail exposes a bounded creator DTO', async () => {
    const list = await getLearningProjects({ page: 1, limit: 20, q: marker });
    const item = list.items.find((entry) => entry.id === publishedProject.id);
    assert.ok(item);
    assert.deepEqual(item.creator, {
      id: creator.id,
      displayName: creator.displayName,
      avatarUrl: '/uploads/profiles/public-user.png',
    });
    assert.equal('email' in item.creator, false);

    const detail = await getLearningProjectById(publishedProject.id);
    assert.equal(detail.creator.id, creator.id);
    assert.equal('roles' in detail.creator, false);
  });

  test('creator search supports English and Arabic and preserves visibility', async () => {
    const english = await getLearningProjects({
      page: 1,
      limit: 20,
      q: 'Majd Awad',
    });
    assert.deepEqual(english.items.map((item) => item.id), [publishedProject.id]);

    const arabic = await getLearningProjects({
      page: 1,
      limit: 20,
      q: 'إسراء حداد',
    });
    assert.equal(arabic.items.length, 1);
    assert.equal(arabic.items[0]?.creator.id, arabicCreator.id);

    const missing = await getLearningProjects({
      page: 1,
      limit: 20,
      q: `${marker} nobody`,
    });
    assert.equal(missing.items.length, 0);
    assert.equal(english.items.some((item) => item.title.includes('draft')), false);
  });

  test('multi-role public profile stays personal and exposes safe supplier link', async () => {
    const profile = await getPublicUserProfile(creator.id);
    assert.equal(profile.displayName, creator.displayName);
    assert.deepEqual(profile.publicRoles, ['LEARNER', 'SUPPLIER']);
    assert.equal(profile.supplier?.displayName, `${marker} Reuse Workshop`);
    assert.equal(profile.publishedProjectsCount, 1);
    assert.equal(profile.publishedProjectsLikesCount, 1);
    assert.equal(profile.learnerType, 'University student');
    assert.equal(profile.skillLevel, 'Intermediate');
    assert.equal(profile.bio, 'Builds CNC tools for community workshops.');
    assert.deepEqual(profile.interests, ['Arduino', 'robotics']);
    assert.deepEqual(
      Object.keys(profile).sort(),
      [
        'avatarUrl',
        'bio',
        'displayName',
        'id',
        'interests',
        'learnerType',
        'publicRoles',
        'publishedProjectsCount',
        'publishedProjectsLikesCount',
        'skillLevel',
        'supplier',
      ].sort(),
    );
    for (const forbidden of [
      'email',
      'phone',
      'accountStatus',
      'activeRole',
      'learnerProfile',
    ]) {
      assert.equal(forbidden in profile, false, `exposed ${forbidden}`);
    }
  });

  test('learner-only public profile omits supplier and empty optional fields', async () => {
    const profile = await getPublicUserProfile(arabicCreator.id);
    assert.equal(profile.displayName, arabicCreator.displayName);
    assert.deepEqual(profile.publicRoles, ['LEARNER']);
    assert.equal(profile.supplier, null);
    assert.equal(profile.learnerType, 'Self learner');
    assert.equal(profile.skillLevel, 'Beginner');
    assert.equal(profile.bio, null);
    assert.deepEqual(profile.interests, []);
    assert.equal(profile.publishedProjectsCount, 1);
    assert.equal(profile.publishedProjectsLikesCount, 0);
  });

  test('requester public profile does not leak private account fields', async () => {
    const profile = await getPublicUserProfile(requester.id);
    assert.equal(profile.bio, null);
    assert.equal(profile.learnerType, null);
    assert.equal(profile.skillLevel, null);
    assert.deepEqual(profile.interests, []);
    assert.equal(profile.supplier, null);
    assert.equal('email' in profile, false);
    assert.equal('phone' in profile, false);
    assert.equal('learnerProfile' in profile, false);
  });

  test('public projects include only the requested creator public projects', async () => {
    const projects = await getPublicUserProjects(creator.id, {
      page: 1,
      limit: 12,
    });
    assert.deepEqual(projects.items.map((item) => item.id), [publishedProject.id]);
  });

  test('PHS picker searches canonical creator and keeps canonical author', async () => {
    const options = await listLearnerHelpSessionProjectOptions({
      learnerId: requester.id,
      q: 'Majd Awad',
      page: 1,
      limit: 20,
    });
    assert.equal(options.items.length, 1);
    assert.equal(options.items[0]?.project.creator.id, creator.id);
    const author = await resolveProjectHelpSessionAuthor(publishedProject.id);
    assert.equal(author.available, true);
    assert.equal(author.available && author.authorId, creator.id);
  });
});
