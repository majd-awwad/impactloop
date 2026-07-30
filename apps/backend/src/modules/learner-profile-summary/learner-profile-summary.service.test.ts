import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AppError } from '../../utils/app-error.js';
import {
  calculateProfileCompletion,
  createLearnerProfileSummaryService,
  type LearnerProfileSummaryRepository,
} from './learner-profile-summary.service.js';

const completeContext = {
  displayName: 'Majd Learner',
  phone: '+970599000000',
  learnerProfile: {
    learnerType: 'Student',
    skillLevel: 'Intermediate',
    interests: ['Robotics'],
    bio: 'I build useful things.',
  },
};

describe('learner profile completion', () => {
  test('returns 100 when all six ordered steps are complete', () => {
    assert.deepEqual(calculateProfileCompletion(completeContext, true), {
      completedSteps: 6,
      totalSteps: 6,
      percentage: 100,
      missingSteps: [],
    });
  });

  test('returns zero and stable ordering for a missing learner profile', () => {
    assert.deepEqual(
      calculateProfileCompletion(
        { displayName: '   ', phone: '\t', learnerProfile: null },
        false,
      ),
      {
        completedSteps: 0,
        totalSteps: 6,
        percentage: 0,
        missingSteps: [
          'display_name',
          'phone',
          'learning_basics',
          'interests',
          'bio',
          'saved_location',
        ],
      },
    );
  });

  test('returns 67 for four completed steps and removes blank interests', () => {
    const result = calculateProfileCompletion(
      {
        displayName: 'Majd',
        phone: null,
        learnerProfile: {
          learnerType: 'Student',
          skillLevel: 'Beginner',
          interests: [' ', '\n', 'Sensors'],
          bio: ' ',
        },
      },
      true,
    );

    assert.deepEqual(result, {
      completedSteps: 4,
      totalSteps: 6,
      percentage: 67,
      missingSteps: ['phone', 'bio'],
    });
  });
});

describe('learner profile summary service', () => {
  test('loads one bounded repository operation per summary source', async () => {
    const calls: string[] = [];
    const repository = createRepository({ calls });
    const load = createLearnerProfileSummaryService(repository);

    const summary = await load('learner-1');

    assert.deepEqual(calls, [
      'profile:learner-1',
      'location:learner-1',
      'reservations:learner-1',
      'likes:learner-1',
      'saves:learner-1',
      'follows:learner-1',
      'active-builds:learner-1',
      'completed-builds:learner-1',
      'continue:learner-1',
    ]);
    assert.deepEqual(summary.journey, {
      activeReservationsCount: 3,
      completedReservationsCount: 9,
      likedMaterialsCount: 8,
      savedProjectsCount: 7,
      followedProjectsCount: 2,
      activeBuildsCount: 1,
      completedBuildsCount: 4,
    });
    assert.deepEqual(summary.continueProject, {
      projectId: 'project-1',
      buildId: 'build-1',
      title: 'Smart irrigation device',
      imageUrl: null,
      lastActivityAt: '2026-07-29T00:00:00.000Z',
      progress: { completedSteps: 2, totalSteps: 5, percentage: 40 },
    });
  });

  test('returns zero-step progress and null continuation without invention', async () => {
    const repository = createRepository({
      continueBuild: {
        id: 'build-empty',
        projectId: 'project-empty',
        updatedAt: new Date('2026-07-29T01:00:00.000Z'),
        _count: { stepProgress: 0 },
        project: {
          title: 'Legacy project',
          coverImageUrl: '/legacy.webp',
          _count: { steps: 0 },
        },
      },
    });
    const load = createLearnerProfileSummaryService(repository);

    const withLegacyBuild = await load('learner-1');
    assert.deepEqual(withLegacyBuild.continueProject?.progress, {
      completedSteps: 0,
      totalSteps: 0,
      percentage: 0,
    });

    const withoutBuild = await createLearnerProfileSummaryService(
      createRepository({ continueBuild: null }),
    )('learner-1');
    assert.equal(withoutBuild.continueProject, null);
  });

  test('stops after the profile gate when the authenticated user is missing', async () => {
    const calls: string[] = [];
    const repository = createRepository({ calls, context: null });

    await assert.rejects(
      () => createLearnerProfileSummaryService(repository)('missing-user'),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
    assert.deepEqual(calls, ['profile:missing-user']);
  });
});

type ContinueBuild = Awaited<
  ReturnType<LearnerProfileSummaryRepository['findLatestContinueProject']>
>;

const defaultContinueBuild: NonNullable<ContinueBuild> = {
  id: 'build-1',
  projectId: 'project-1',
  updatedAt: new Date('2026-07-29T00:00:00.000Z'),
  _count: { stepProgress: 2 },
  project: {
    title: 'Smart irrigation device',
    coverImageUrl: null,
    _count: { steps: 5 },
  },
};

const createRepository = (options: {
  calls?: string[];
  context?: typeof completeContext | null;
  continueBuild?: ContinueBuild;
} = {}): LearnerProfileSummaryRepository => {
  const calls = options.calls ?? [];
  const record = (name: string, userId: string) => calls.push(`${name}:${userId}`);

  return {
    async findProfileCompletionContext(userId) {
      record('profile', userId);
      return options.context === undefined ? completeContext : options.context;
    },
    async hasUsableSavedLocation(userId) {
      record('location', userId);
      return true;
    },
    async summarizeLearnerReservationCounts(userId) {
      record('reservations', userId);
      return { activeReservationsCount: 3, completedReservationsCount: 9 };
    },
    async countVisibleLikedMaterials(userId) {
      record('likes', userId);
      return 8;
    },
    async countVisibleSavedProjects(userId) {
      record('saves', userId);
      return 7;
    },
    async countVisibleFollowedProjects(userId) {
      record('follows', userId);
      return 2;
    },
    async countActiveBuilds(userId) {
      record('active-builds', userId);
      return 1;
    },
    async countCompletedBuilds(userId) {
      record('completed-builds', userId);
      return 4;
    },
    async findLatestContinueProject(userId) {
      record('continue', userId);
      return options.continueBuild === undefined
        ? defaultContinueBuild
        : options.continueBuild;
    },
  };
};
