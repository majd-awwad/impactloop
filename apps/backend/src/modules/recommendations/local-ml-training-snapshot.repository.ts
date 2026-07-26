import type {
  AccountStatus,
  CategoryType,
  LearningProjectStatus,
  MaterialCondition,
  MaterialStatus,
  Prisma,
  ProjectBuildStatus,
  ProjectDifficulty,
  RecommendationEvidenceEligibility,
  TaxonomyConceptStatus,
  TaxonomyConceptType,
} from '../../generated/prisma/client.js';
import type { LearnerInterestRegistryConcept } from '../taxonomy/learner-interest-resolver.js';
import { MAX_TAXONOMY_BATCH_SIZE } from '../taxonomy/taxonomy-foundation.repository.js';

export const LOCAL_ML_SNAPSHOT_PAGE_SIZE = 1_000;
export const LOCAL_ML_SNAPSHOT_CONCEPT_CHUNK_SIZE = 200;

export type LocalMlActorEvidence = {
  id: string;
  accountStatus: AccountStatus;
  recommendationEvidenceEligibility: RecommendationEvidenceEligibility;
};

export type LocalMlSourceBucket<T> = {
  total: number;
  rows: T[];
  futureCount: number;
  futureSampleIds: string[];
};

export type LocalMlUserSourceRow = LocalMlActorEvidence & {
  createdAt: Date;
  learnerProfile: { interests: string[] } | null;
};

export type LocalMlMaterialSourceRow = {
  id: string;
  createdAt: Date;
  status: MaterialStatus;
  condition: MaterialCondition;
  isFree: boolean;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
  category: { isActive: boolean; categoryType: CategoryType };
};

export type LocalMlProjectSourceRow = {
  id: string;
  createdAt: Date;
  reviewedAt: Date | null;
  status: LearningProjectStatus;
  difficulty: ProjectDifficulty;
  category: { isActive: boolean; categoryType: CategoryType };
};

export type LocalMlMaterialConceptRow = {
  materialId: string;
  canonicalKey: string;
  conceptType: TaxonomyConceptType;
  status: TaxonomyConceptStatus;
};

export type LocalMlProjectConceptRow = {
  projectId: string;
  canonicalKey: string;
  conceptType: TaxonomyConceptType;
  status: TaxonomyConceptStatus;
};

export type LocalMlProjectComponentConceptRow = LocalMlProjectConceptRow & {
  isRequired: boolean;
};

export type LocalMlMaterialLikeSourceRow = {
  id: string;
  materialId: string;
  userId: string;
  createdAt: Date;
  actor: LocalMlActorEvidence;
};

export type LocalMlMaterialViewSourceRow = {
  id: string;
  materialId: string;
  viewerUserId: string | null;
  viewSource: string | null;
  createdAt: Date;
  actor: LocalMlActorEvidence | null;
};

export type LocalMlProjectToggleSourceRow = {
  id: string;
  projectId: string;
  userId: string;
  createdAt: Date;
  actor: LocalMlActorEvidence;
};

export type LocalMlProjectBuildSourceRow = {
  id: string;
  projectId: string;
  learnerId: string;
  status: ProjectBuildStatus;
  startedAt: Date;
  completedAt: Date | null;
  actor: LocalMlActorEvidence;
};

export type LocalMlSnapshotQueryStats = {
  counts: Record<string, number>;
  pages: Record<string, number>;
  conceptChunks: Record<string, number>;
};

export type LocalMlSnapshotSource = {
  interestRegistry: LearnerInterestRegistryConcept[];
  users: LocalMlSourceBucket<LocalMlUserSourceRow>;
  materials: LocalMlSourceBucket<LocalMlMaterialSourceRow>;
  projects: LocalMlSourceBucket<LocalMlProjectSourceRow>;
  materialConcepts: LocalMlMaterialConceptRow[];
  projectConcepts: LocalMlProjectConceptRow[];
  projectComponentConcepts: LocalMlProjectComponentConceptRow[];
  materialLikes: LocalMlSourceBucket<LocalMlMaterialLikeSourceRow>;
  materialViews: LocalMlSourceBucket<LocalMlMaterialViewSourceRow>;
  projectSaves: LocalMlSourceBucket<LocalMlProjectToggleSourceRow>;
  projectLikes: LocalMlSourceBucket<LocalMlProjectToggleSourceRow>;
  projectFollows: LocalMlSourceBucket<LocalMlProjectToggleSourceRow>;
  projectBuilds: LocalMlSourceBucket<LocalMlProjectBuildSourceRow>;
  queryStats: LocalMlSnapshotQueryStats;
};

export interface LocalMlSnapshotReader {
  read(evaluationTime: Date): Promise<LocalMlSnapshotSource>;
}

const emptyStats = (): LocalMlSnapshotQueryStats => ({
  counts: {},
  pages: {},
  conceptChunks: {},
});

const increment = (target: Record<string, number>, key: string): void => {
  target[key] = (target[key] ?? 0) + 1;
};

const chunks = <T>(values: readonly T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let offset = 0; offset < values.length; offset += size) {
    result.push(values.slice(offset, offset + size));
  }
  return result;
};

const actorSelect = {
  id: true,
  accountStatus: true,
  recommendationEvidenceEligibility: true,
} as const;

export class PrismaLocalMlSnapshotReader implements LocalMlSnapshotReader {
  constructor(private readonly client: Prisma.TransactionClient) {}

  async read(evaluationTime: Date): Promise<LocalMlSnapshotSource> {
    const stats = emptyStats();
    const [
      interestRegistry,
      users,
      materials,
      projects,
      materialLikes,
      materialViews,
      projectSaves,
      projectLikes,
      projectFollows,
      projectBuilds,
    ] = await Promise.all([
      this.loadInterestRegistry(evaluationTime, stats),
      this.loadUsers(evaluationTime, stats),
      this.loadMaterials(evaluationTime, stats),
      this.loadProjects(evaluationTime, stats),
      this.loadMaterialLikes(evaluationTime, stats),
      this.loadMaterialViews(evaluationTime, stats),
      this.loadProjectToggles('projectSaves', evaluationTime, stats),
      this.loadProjectToggles('projectLikes', evaluationTime, stats),
      this.loadProjectToggles('projectFollows', evaluationTime, stats),
      this.loadProjectBuilds(evaluationTime, stats),
    ]);

    const preliminaryMaterialIds = materials.rows
      .filter(
        (row) =>
          row.status === 'AVAILABLE' &&
          row.category.isActive &&
          (row.category.categoryType === 'MATERIAL' ||
            row.category.categoryType === 'BOTH'),
      )
      .map((row) => row.id);
    const preliminaryProjectIds = projects.rows
      .filter(
        (row) =>
          row.status === 'PUBLISHED' &&
          row.reviewedAt !== null &&
          row.reviewedAt <= evaluationTime &&
          row.category.isActive &&
          (row.category.categoryType === 'PROJECT' ||
            row.category.categoryType === 'BOTH'),
      )
      .map((row) => row.id);

    const [materialConcepts, projectConcepts, projectComponentConcepts] =
      await Promise.all([
        this.loadMaterialConcepts(preliminaryMaterialIds, evaluationTime, stats),
        this.loadProjectConcepts(preliminaryProjectIds, evaluationTime, stats),
        this.loadProjectComponentConcepts(
          preliminaryProjectIds,
          evaluationTime,
          stats,
        ),
      ]);

    return {
      interestRegistry,
      users,
      materials,
      projects,
      materialConcepts,
      projectConcepts,
      projectComponentConcepts,
      materialLikes,
      materialViews,
      projectSaves,
      projectLikes,
      projectFollows,
      projectBuilds,
      queryStats: stats,
    };
  }

  private async loadPaged<T extends { id: string }>(input: {
    name: string;
    stats: LocalMlSnapshotQueryStats;
    total: () => Promise<number>;
    page: (cursorId: string | undefined) => Promise<T[]>;
    futureSample: () => Promise<Array<{ id: string }>>;
  }): Promise<LocalMlSourceBucket<T>> {
    increment(input.stats.counts, input.name);
    const total = await input.total();
    const rows: T[] = [];
    let cursorId: string | undefined;
    while (true) {
      increment(input.stats.pages, input.name);
      const page = await input.page(cursorId);
      rows.push(...page);
      if (page.length < LOCAL_ML_SNAPSHOT_PAGE_SIZE) break;
      cursorId = page[page.length - 1]!.id;
    }
    const futureCount = total - rows.length;
    if (futureCount > 0) increment(input.stats.counts, `${input.name}.futureSample`);
    const futureSampleIds =
      futureCount > 0 ? (await input.futureSample()).map((row) => row.id) : [];
    return { total, rows, futureCount, futureSampleIds };
  }

  private async loadInterestRegistry(
    evaluationTime: Date,
    stats: LocalMlSnapshotQueryStats,
  ): Promise<LearnerInterestRegistryConcept[]> {
    increment(stats.counts, 'interestRegistry');
    const concepts = await this.client.taxonomyConcept.findMany({
      where: { createdAt: { lte: evaluationTime } },
      select: {
        id: true,
        canonicalKey: true,
        conceptType: true,
        status: true,
        labelEn: true,
        labelAr: true,
        aliases: {
          where: { isActive: true, createdAt: { lte: evaluationTime } },
          select: {
            id: true,
            alias: true,
            normalizedAlias: true,
            language: true,
            aliasType: true,
            source: true,
            isActive: true,
          },
          orderBy: [{ normalizedAlias: 'asc' }, { language: 'asc' }, { id: 'asc' }],
          take: MAX_TAXONOMY_BATCH_SIZE + 1,
        },
        learnerInterests: {
          where: { createdAt: { lte: evaluationTime } },
          select: { id: true, learnerInterestKey: true },
          orderBy: [{ learnerInterestKey: 'asc' }, { id: 'asc' }],
          take: MAX_TAXONOMY_BATCH_SIZE + 1,
        },
      },
      orderBy: [{ canonicalKey: 'asc' }, { id: 'asc' }],
      take: MAX_TAXONOMY_BATCH_SIZE + 1,
    });
    if (
      concepts.length > MAX_TAXONOMY_BATCH_SIZE ||
      concepts.some(
        (concept) =>
          concept.aliases.length > MAX_TAXONOMY_BATCH_SIZE ||
          concept.learnerInterests.length > MAX_TAXONOMY_BATCH_SIZE,
      )
    ) {
      throw new Error('local_ml_snapshot_interest_registry_bound_exceeded');
    }
    return concepts;
  }

  private loadUsers(evaluationTime: Date, stats: LocalMlSnapshotQueryStats) {
    const learnerWhere = { roles: { some: { role: 'LEARNER' as const } } };
    return this.loadPaged<LocalMlUserSourceRow>({
      name: 'users',
      stats,
      total: () => this.client.user.count({ where: learnerWhere }),
      page: (cursorId) =>
        this.client.user.findMany({
          where: {
            ...learnerWhere,
            createdAt: { lte: evaluationTime },
            ...(cursorId ? { id: { gt: cursorId } } : {}),
          },
          select: {
            ...actorSelect,
            createdAt: true,
            learnerProfile: { select: { interests: true } },
          },
          orderBy: { id: 'asc' },
          take: LOCAL_ML_SNAPSHOT_PAGE_SIZE,
        }),
      futureSample: () =>
        this.client.user.findMany({
          where: { ...learnerWhere, createdAt: { gt: evaluationTime } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 8,
        }),
    });
  }

  private loadMaterials(evaluationTime: Date, stats: LocalMlSnapshotQueryStats) {
    return this.loadPaged<LocalMlMaterialSourceRow>({
      name: 'materials',
      stats,
      total: () => this.client.material.count(),
      page: (cursorId) =>
        this.client.material.findMany({
          where: {
            createdAt: { lte: evaluationTime },
            ...(cursorId ? { id: { gt: cursorId } } : {}),
          },
          select: {
            id: true,
            createdAt: true,
            status: true,
            condition: true,
            isFree: true,
            pickupAllowed: true,
            deliveryAllowed: true,
            category: { select: { isActive: true, categoryType: true } },
          },
          orderBy: { id: 'asc' },
          take: LOCAL_ML_SNAPSHOT_PAGE_SIZE,
        }),
      futureSample: () =>
        this.client.material.findMany({
          where: { createdAt: { gt: evaluationTime } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 8,
        }),
    });
  }

  private loadProjects(evaluationTime: Date, stats: LocalMlSnapshotQueryStats) {
    return this.loadPaged<LocalMlProjectSourceRow>({
      name: 'projects',
      stats,
      total: () => this.client.learningProject.count(),
      page: (cursorId) =>
        this.client.learningProject.findMany({
          where: {
            createdAt: { lte: evaluationTime },
            ...(cursorId ? { id: { gt: cursorId } } : {}),
          },
          select: {
            id: true,
            createdAt: true,
            reviewedAt: true,
            status: true,
            difficulty: true,
            category: { select: { isActive: true, categoryType: true } },
          },
          orderBy: { id: 'asc' },
          take: LOCAL_ML_SNAPSHOT_PAGE_SIZE,
        }),
      futureSample: () =>
        this.client.learningProject.findMany({
          where: { createdAt: { gt: evaluationTime } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 8,
        }),
    });
  }

  private loadMaterialLikes(
    evaluationTime: Date,
    stats: LocalMlSnapshotQueryStats,
  ) {
    return this.loadPaged<LocalMlMaterialLikeSourceRow>({
      name: 'materialLikes',
      stats,
      total: () => this.client.materialLike.count(),
      page: (cursorId) =>
        this.client.materialLike
          .findMany({
            where: {
              createdAt: { lte: evaluationTime },
              ...(cursorId ? { id: { gt: cursorId } } : {}),
            },
            select: {
              id: true,
              materialId: true,
              userId: true,
              createdAt: true,
              user: { select: actorSelect },
            },
            orderBy: { id: 'asc' },
            take: LOCAL_ML_SNAPSHOT_PAGE_SIZE,
          })
          .then((rows) => rows.map(({ user, ...row }) => ({ ...row, actor: user }))),
      futureSample: () =>
        this.client.materialLike.findMany({
          where: { createdAt: { gt: evaluationTime } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 8,
        }),
    });
  }

  private loadMaterialViews(
    evaluationTime: Date,
    stats: LocalMlSnapshotQueryStats,
  ) {
    return this.loadPaged<LocalMlMaterialViewSourceRow>({
      name: 'materialViews',
      stats,
      total: () => this.client.materialView.count(),
      page: (cursorId) =>
        this.client.materialView
          .findMany({
            where: {
              createdAt: { lte: evaluationTime },
              ...(cursorId ? { id: { gt: cursorId } } : {}),
            },
            select: {
              id: true,
              materialId: true,
              viewerUserId: true,
              viewSource: true,
              createdAt: true,
              viewerUser: { select: actorSelect },
            },
            orderBy: { id: 'asc' },
            take: LOCAL_ML_SNAPSHOT_PAGE_SIZE,
          })
          .then((rows) =>
            rows.map(({ viewerUser, ...row }) => ({ ...row, actor: viewerUser })),
          ),
      futureSample: () =>
        this.client.materialView.findMany({
          where: { createdAt: { gt: evaluationTime } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 8,
        }),
    });
  }

  private loadProjectToggles(
    source: 'projectSaves' | 'projectLikes' | 'projectFollows',
    evaluationTime: Date,
    stats: LocalMlSnapshotQueryStats,
  ): Promise<LocalMlSourceBucket<LocalMlProjectToggleSourceRow>> {
    type ProjectToggleDatabaseRow = Omit<LocalMlProjectToggleSourceRow, 'actor'> & {
      user: LocalMlActorEvidence;
    };
    type ProjectToggleDelegate = {
      count(args?: unknown): PromiseLike<unknown>;
      findMany(args: unknown): PromiseLike<unknown>;
    };
    const delegate = (
      source === 'projectSaves'
        ? this.client.projectSave
        : source === 'projectLikes'
          ? this.client.projectLike
          : this.client.projectFollow
    ) as unknown as ProjectToggleDelegate;
    return this.loadPaged<LocalMlProjectToggleSourceRow>({
      name: source,
      stats,
      total: async () => (await delegate.count()) as number,
      page: async (cursorId) => {
        const rows = (await delegate.findMany({
            where: {
              createdAt: { lte: evaluationTime },
              ...(cursorId ? { id: { gt: cursorId } } : {}),
            },
            select: {
              id: true,
              projectId: true,
              userId: true,
              createdAt: true,
              user: { select: actorSelect },
            },
            orderBy: { id: 'asc' },
            take: LOCAL_ML_SNAPSHOT_PAGE_SIZE,
          })) as ProjectToggleDatabaseRow[];
        return rows.map(({ user, ...row }) => ({ ...row, actor: user }));
      },
      futureSample: async () =>
        (await delegate.findMany({
          where: { createdAt: { gt: evaluationTime } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 8,
        })) as Array<{ id: string }>,
    });
  }

  private loadProjectBuilds(
    evaluationTime: Date,
    stats: LocalMlSnapshotQueryStats,
  ) {
    return this.loadPaged<LocalMlProjectBuildSourceRow>({
      name: 'projectBuilds',
      stats,
      total: () => this.client.projectBuild.count(),
      page: (cursorId) =>
        this.client.projectBuild
          .findMany({
            where: {
              startedAt: { lte: evaluationTime },
              ...(cursorId ? { id: { gt: cursorId } } : {}),
            },
            select: {
              id: true,
              projectId: true,
              learnerId: true,
              status: true,
              startedAt: true,
              completedAt: true,
              learner: { select: actorSelect },
            },
            orderBy: { id: 'asc' },
            take: LOCAL_ML_SNAPSHOT_PAGE_SIZE,
          })
          .then((rows) =>
            rows.map(({ learner, ...row }) => ({ ...row, actor: learner })),
          ),
      futureSample: () =>
        this.client.projectBuild.findMany({
          where: { startedAt: { gt: evaluationTime } },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 8,
        }),
    });
  }

  private async loadMaterialConcepts(
    materialIds: readonly string[],
    evaluationTime: Date,
    stats: LocalMlSnapshotQueryStats,
  ): Promise<LocalMlMaterialConceptRow[]> {
    const output: LocalMlMaterialConceptRow[] = [];
    for (const materialIdChunk of chunks(
      [...new Set(materialIds)].sort(),
      LOCAL_ML_SNAPSHOT_CONCEPT_CHUNK_SIZE,
    )) {
      increment(stats.conceptChunks, 'materialConcepts');
      const rows = await this.client.materialConcept.findMany({
        where: {
          materialId: { in: materialIdChunk },
          createdAt: { lte: evaluationTime },
          concept: { createdAt: { lte: evaluationTime } },
        },
        select: {
          materialId: true,
          concept: {
            select: { canonicalKey: true, conceptType: true, status: true },
          },
        },
        orderBy: { id: 'asc' },
      });
      output.push(
        ...rows.map(({ materialId, concept }) => ({ materialId, ...concept })),
      );
    }
    return output;
  }

  private async loadProjectConcepts(
    projectIds: readonly string[],
    evaluationTime: Date,
    stats: LocalMlSnapshotQueryStats,
  ): Promise<LocalMlProjectConceptRow[]> {
    const output: LocalMlProjectConceptRow[] = [];
    for (const projectIdChunk of chunks(
      [...new Set(projectIds)].sort(),
      LOCAL_ML_SNAPSHOT_CONCEPT_CHUNK_SIZE,
    )) {
      increment(stats.conceptChunks, 'projectConcepts');
      const rows = await this.client.learningProjectConcept.findMany({
        where: {
          projectId: { in: projectIdChunk },
          createdAt: { lte: evaluationTime },
          concept: { createdAt: { lte: evaluationTime } },
        },
        select: {
          projectId: true,
          concept: {
            select: { canonicalKey: true, conceptType: true, status: true },
          },
        },
        orderBy: { id: 'asc' },
      });
      output.push(
        ...rows.map(({ projectId, concept }) => ({ projectId, ...concept })),
      );
    }
    return output;
  }

  private async loadProjectComponentConcepts(
    projectIds: readonly string[],
    evaluationTime: Date,
    stats: LocalMlSnapshotQueryStats,
  ): Promise<LocalMlProjectComponentConceptRow[]> {
    const output: LocalMlProjectComponentConceptRow[] = [];
    for (const projectIdChunk of chunks(
      [...new Set(projectIds)].sort(),
      LOCAL_ML_SNAPSHOT_CONCEPT_CHUNK_SIZE,
    )) {
      increment(stats.conceptChunks, 'projectComponentConcepts');
      const rows = await this.client.projectComponentConcept.findMany({
        where: {
          createdAt: { lte: evaluationTime },
          component: {
            projectId: { in: projectIdChunk },
            isRequired: true,
          },
          concept: { createdAt: { lte: evaluationTime } },
        },
        select: {
          component: { select: { projectId: true, isRequired: true } },
          concept: {
            select: { canonicalKey: true, conceptType: true, status: true },
          },
        },
        orderBy: { id: 'asc' },
      });
      output.push(
        ...rows.map(({ component, concept }) => ({
          projectId: component.projectId,
          isRequired: component.isRequired,
          ...concept,
        })),
      );
    }
    return output;
  }
}
