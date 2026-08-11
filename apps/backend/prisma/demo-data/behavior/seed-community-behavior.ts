/**
 * BEHAVIOR-DATA-01 — seed realistic community learner engagement + builds.
 *
 * Run: npm run seed:community-behavior
 * Safe to re-run: unique upserts + deterministic MaterialView operationKeys.
 * Does NOT create reservations, deliveries, payments, or rewrite catalog content.
 */

import { prisma } from "../../../src/database/prisma.js";
import { invalidateLearnerHomeCache } from "../../../src/modules/learner-home/learner-home.service.js";
import type {
  ProjectBuildItemStatus,
  ProjectBuildStatus,
} from "../../../src/generated/prisma/client.js";
import {
  BEHAVIOR_EPOCH_END,
  BEHAVIOR_NOTE_PREFIX,
  BEHAVIOR_OP_PREFIX,
  BEHAVIOR_SOURCE,
  BEHAVIOR_WINDOW_DAYS,
  BUILD_PLANS,
  CORE_PROJECT_KEYS_BY_PERSONA,
  INTEREST_CATEGORY_AFFINITY,
  INTEREST_PD03_KEYS,
  INTEREST_PROJECT_CATEGORIES,
  INTEREST_TITLE_KEYWORDS,
  LEARNER_ACTIVITY_TIERS,
  TIER_QUOTAS,
  materialPopularityWeight,
  makeRng,
  recentBiasedDaysAgo,
  timestampDaysAgo,
  viewOperationKey,
  type ActivityTier,
  type BuildPlan,
} from "./community-behavior.data.js";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEMO_PROJECT_KEY_PREFIX = "demo-project-key:";
const COMMUNITY_MAT_PREFIX = "il-demo-mat:";

type MaterialCandidate = {
  id: string;
  title: string;
  materialType: string;
  categoryName: string;
  seedKey: string | null;
  isCommunity: boolean;
  supplierProfileId: string | null;
  city: string | null;
  area: string | null;
  status: string;
  popularity: number;
};

type ProjectCandidate = {
  id: string;
  title: string;
  status: string;
  difficulty: string;
  categoryName: string;
  projectKey: string;
  isPd03: boolean;
};

type LearnerRow = {
  id: string;
  email: string;
  interests: string[];
  skillLevel: string | null;
  learnerType: string | null;
  city: string | null;
  area: string | null;
  tier: ActivityTier;
};

type SeedCounts = {
  materialViewsCreated: number;
  materialViewsSkipped: number;
  materialLikesCreated: number;
  materialLikesSkipped: number;
  projectLikesCreated: number;
  projectLikesSkipped: number;
  projectSavesCreated: number;
  projectSavesSkipped: number;
  projectFollowsCreated: number;
  projectFollowsSkipped: number;
  supplierFollowsCreated: number;
  supplierFollowsSkipped: number;
  buildsCreated: number;
  buildsSkipped: number;
  buildsCompleted: number;
  cachesInvalidated: number;
};

const assertLocalDatabaseHost = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for community behavior seeding.");
  }
  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error("DATABASE_URL must be a valid URL.");
  }
  if (!LOCAL_DATABASE_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to seed community behavior against non-local DB host "${hostname}".`,
    );
  }
};

const norm = (value: string) => value.trim().toLowerCase();

const interestAffinityCategories = (interests: string[]): Set<string> => {
  const set = new Set<string>();
  for (const interest of interests) {
    for (const cat of INTEREST_CATEGORY_AFFINITY[interest] ?? []) {
      set.add(norm(cat));
    }
  }
  return set;
};

const interestKeywords = (interests: string[]): string[] => {
  const words: string[] = [];
  for (const interest of interests) {
    words.push(...(INTEREST_TITLE_KEYWORDS[interest] ?? []));
  }
  return words.map(norm);
};

const materialAffinityScore = (
  material: MaterialCandidate,
  interests: string[],
  learnerCity: string | null,
): number => {
  const cats = interestAffinityCategories(interests);
  const keywords = interestKeywords(interests);
  let score = 0.15;
  if (cats.has(norm(material.categoryName))) score += 3;
  const hay = `${material.title} ${material.materialType}`.toLowerCase();
  for (const kw of keywords) {
    if (kw && hay.includes(kw)) score += 1.2;
  }
  if (learnerCity && material.city && material.city === learnerCity) score += 0.45;
  if (material.isCommunity) score += 0.25;
  score += material.popularity * 0.15;
  return score;
};

const projectAffinityScore = (
  project: ProjectCandidate,
  interests: string[],
): number => {
  let score = 0.2;
  const preferredCats = new Set<string>();
  const preferredKeys = new Set<string>();
  for (const interest of interests) {
    for (const cat of INTEREST_PROJECT_CATEGORIES[interest] ?? []) {
      preferredCats.add(norm(cat));
    }
    for (const key of INTEREST_PD03_KEYS[interest] ?? []) {
      preferredKeys.add(key);
    }
    for (const key of CORE_PROJECT_KEYS_BY_PERSONA[interest] ?? []) {
      preferredKeys.add(key);
    }
  }
  if (preferredCats.has(norm(project.categoryName))) score += 3;
  if (preferredKeys.has(project.projectKey)) score += 2.5;
  if (project.isPd03 && preferredKeys.has(project.projectKey)) score += 1;
  return score;
};

const skillAllowsBuildDifficulty = (
  skillLevel: string | null,
  difficulty: string,
): boolean => {
  const skill = (skillLevel ?? "BEGINNER").toUpperCase();
  const diff = difficulty.toUpperCase();
  if (diff === "BEGINNER") return true;
  if (diff === "INTERMEDIATE") return skill !== "BEGINNER";
  if (diff === "ADVANCED") return skill === "ADVANCED";
  return true;
};

const loadLearners = async (): Promise<LearnerRow[]> => {
  const users = await prisma.user.findMany({
    where: {
      email: { endsWith: "@impactloop.demo" },
      activeRole: "LEARNER",
    },
    include: {
      learnerProfile: true,
      savedLocations: {
        where: { isDefault: true },
        include: { location: true },
        take: 1,
      },
    },
    orderBy: { email: "asc" },
  });

  const missingTier: string[] = [];
  const rows: LearnerRow[] = [];
  for (const user of users) {
    const tier = LEARNER_ACTIVITY_TIERS[user.email];
    if (!tier) {
      missingTier.push(user.email);
      continue;
    }
    rows.push({
      id: user.id,
      email: user.email,
      interests: user.learnerProfile?.interests ?? [],
      skillLevel: user.learnerProfile?.skillLevel ?? null,
      learnerType: user.learnerProfile?.learnerType ?? null,
      city: user.savedLocations[0]?.location?.city ?? null,
      area: user.savedLocations[0]?.location?.area ?? null,
      tier,
    });
  }
  if (missingTier.length > 0) {
    throw new Error(
      `Missing activity tiers for community learners: ${missingTier.join(", ")}`,
    );
  }
  if (rows.length !== 35) {
    throw new Error(
      `Expected 35 community learners, found ${rows.length}. Run seed:community-people first.`,
    );
  }
  return rows;
};

const loadMaterials = async (): Promise<MaterialCandidate[]> => {
  const materials = await prisma.material.findMany({
    where: { status: "AVAILABLE" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      materialType: true,
      supplierProfileId: true,
      status: true,
      category: { select: { nameEn: true } },
      location: { select: { city: true, area: true } },
      tags: {
        where: { tag: { startsWith: COMMUNITY_MAT_PREFIX } },
        select: { tag: true },
      },
    },
  });

  return materials.map((m) => {
    const seedTag = m.tags[0]?.tag ?? null;
    const seedKey = seedTag?.startsWith(COMMUNITY_MAT_PREFIX)
      ? seedTag.slice(COMMUNITY_MAT_PREFIX.length)
      : null;
    return {
      id: m.id,
      title: m.title,
      materialType: m.materialType,
      categoryName: m.category.nameEn,
      seedKey,
      isCommunity: Boolean(seedKey),
      supplierProfileId: m.supplierProfileId,
      city: m.location?.city ?? null,
      area: m.location?.area ?? null,
      status: m.status,
      popularity: seedKey ? materialPopularityWeight(seedKey) : 2,
    };
  });
};

const loadProjects = async (): Promise<ProjectCandidate[]> => {
  const projects = await prisma.learningProject.findMany({
    where: {
      tags: { some: { tag: { startsWith: DEMO_PROJECT_KEY_PREFIX } } },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      title: true,
      status: true,
      difficulty: true,
      category: { select: { nameEn: true } },
      tags: { select: { tag: true } },
    },
  });

  return projects
    .map((p) => {
      const keyTag = p.tags.find((t) => t.tag.startsWith(DEMO_PROJECT_KEY_PREFIX));
      if (!keyTag) return null;
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        difficulty: p.difficulty,
        categoryName: p.category?.nameEn ?? "",
        projectKey: keyTag.tag.slice(DEMO_PROJECT_KEY_PREFIX.length),
        isPd03: p.tags.some((t) => t.tag === "project-data-03"),
      };
    })
    .filter((p): p is ProjectCandidate => Boolean(p))
    .sort((a, b) => a.projectKey.localeCompare(b.projectKey));
};

const byMaterialId = (a: MaterialCandidate, b: MaterialCandidate) =>
  a.id.localeCompare(b.id);

const pickMaterialsForLearner = (
  learner: LearnerRow,
  materials: MaterialCandidate[],
  count: number,
  purpose: string,
): MaterialCandidate[] => {
  if (count <= 0) return [];
  const rng = makeRng(learner.email, purpose);
  const quota = TIER_QUOTAS[learner.tier];
  const exploreCount = Math.round(count * quota.exploreRatio);
  const affinityCount = Math.max(0, count - exploreCount);

  const scored = [...materials]
    .sort(byMaterialId)
    .map((m) => ({
      m,
      score: materialAffinityScore(m, learner.interests, learner.city),
    }));

  const affinityPool = scored
    .filter((row) => row.score >= 1.2)
    .map((row) => row.m);
  const explorePool = scored.map((row) => row.m);

  const communityBoost = (m: MaterialCandidate) =>
    (m.isCommunity ? 1.35 : 1) *
    m.popularity *
    (0.5 + materialAffinityScore(m, learner.interests, learner.city));

  const affinityPicks = rng.sampleWeighted(
    affinityPool.length > 0 ? affinityPool : explorePool,
    affinityCount,
    communityBoost,
  );
  const affinityIds = new Set(affinityPicks.map((m) => m.id));
  const explorePicks = rng.sampleWeighted(
    explorePool.filter((m) => !affinityIds.has(m.id)),
    exploreCount,
    (m) => m.popularity,
  );

  // Stable output order for operationKey indices.
  return [...affinityPicks, ...explorePicks].sort(byMaterialId);
};

const pickProjectsForLearner = (
  learner: LearnerRow,
  projects: ProjectCandidate[],
  count: number,
  purpose: string,
): ProjectCandidate[] => {
  if (count <= 0) return [];
  const rng = makeRng(learner.email, purpose);
  const published = projects
    .filter((p) => p.status === "PUBLISHED")
    .sort((a, b) => a.projectKey.localeCompare(b.projectKey));
  return rng.sampleWeighted(published, count, (p) =>
    projectAffinityScore(p, learner.interests),
  );
};

const materialKeyFor = (material: MaterialCandidate): string =>
  material.seedKey ?? `core:${material.id}`;

/**
 * Reset only community-demo-owned engagement for the 35 community learners.
 * Safe because those accounts had zero engagement before BEHAVIOR-DATA-01.
 * Core scenario users (majd@/israa@/learner@) and non-demo views are untouched.
 */
const resetCommunityDemoEngagement = async (learnerIds: string[]) => {
  const demoViews = await prisma.materialView.findMany({
    where: {
      viewerUserId: { in: learnerIds },
      viewSource: BEHAVIOR_SOURCE,
    },
    select: { id: true, materialId: true },
  });

  if (demoViews.length > 0) {
    const perMaterial = new Map<string, number>();
    for (const view of demoViews) {
      perMaterial.set(view.materialId, (perMaterial.get(view.materialId) ?? 0) + 1);
    }
    await prisma.materialView.deleteMany({
      where: { id: { in: demoViews.map((v) => v.id) } },
    });
    for (const [materialId, count] of perMaterial) {
      await prisma.material.update({
        where: { id: materialId },
        data: {
          viewsCount: { decrement: count },
        },
      });
      // Clamp floor at 0 if historical seed inflation made viewsCount smaller.
      await prisma.material.updateMany({
        where: { id: materialId, viewsCount: { lt: 0 } },
        data: { viewsCount: 0 },
      });
    }
  }

  await prisma.materialLike.deleteMany({ where: { userId: { in: learnerIds } } });
  await prisma.projectLike.deleteMany({ where: { userId: { in: learnerIds } } });
  await prisma.projectSave.deleteMany({ where: { userId: { in: learnerIds } } });
  await prisma.projectFollow.deleteMany({
    where: { userId: { in: learnerIds } },
  });
  await prisma.supplierFollower.deleteMany({
    where: { followerUserId: { in: learnerIds } },
  });

  return {
    demoViewsRemoved: demoViews.length,
    note: "Community-learner engagement reset to owned demo graph before re-apply",
  };
};

const seedMaterialViews = async (
  learner: LearnerRow,
  materials: MaterialCandidate[],
  counts: SeedCounts,
): Promise<MaterialCandidate[]> => {
  const quota = TIER_QUOTAS[learner.tier];
  const rng = makeRng(learner.email, "view-count");
  const target = rng.int(quota.materialViews[0], quota.materialViews[1]);
  const picked = pickMaterialsForLearner(learner, materials, target, "views");

  for (let i = 0; i < picked.length; i += 1) {
    const material = picked[i]!;
    const materialKey = materialKeyFor(material);
    const opKey = viewOperationKey(learner.email, materialKey, i);
    const daysAgo = recentBiasedDaysAgo(
      makeRng(learner.email, `view-day-${i}`),
      BEHAVIOR_WINDOW_DAYS,
    );
    const hour = 8 + (fnvHour(learner.email, i) % 12);
    const createdAt = timestampDaysAgo(daysAgo, hour);

    const inserted = await prisma.materialView.createMany({
      data: [
        {
          materialId: material.id,
          viewerUserId: learner.id,
          operationKey: opKey,
          viewSource: BEHAVIOR_SOURCE,
          createdAt,
        },
      ],
      skipDuplicates: true,
    });

    if (inserted.count > 0) {
      await prisma.material.update({
        where: { id: material.id },
        data: { viewsCount: { increment: 1 } },
      });
      counts.materialViewsCreated += 1;
    } else {
      counts.materialViewsSkipped += 1;
    }
  }

  return picked;
};

const fnvHour = (email: string, index: number): number => {
  let hash = 2166136261;
  const input = `${email}|${index}`;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seedMaterialLikes = async (
  learner: LearnerRow,
  viewed: MaterialCandidate[],
  materials: MaterialCandidate[],
  counts: SeedCounts,
): Promise<MaterialCandidate[]> => {
  const quota = TIER_QUOTAS[learner.tier];
  const rng = makeRng(learner.email, "like-count");
  const target = rng.int(quota.materialLikes[0], quota.materialLikes[1]);
  if (target <= 0) return [];

  // Likes mostly from viewed affinity materials.
  const pool =
    viewed.length > 0
      ? viewed
      : pickMaterialsForLearner(learner, materials, target * 2, "like-pool");

  const liked = makeRng(learner.email, "likes").sampleWeighted(
    pool,
    target,
    (m) => materialAffinityScore(m, learner.interests, learner.city) ** 2,
  );

  for (let i = 0; i < liked.length; i += 1) {
    const material = liked[i]!;
    const viewDays = recentBiasedDaysAgo(
      makeRng(learner.email, `like-base-${i}`),
      BEHAVIOR_WINDOW_DAYS,
    );
    // Like after a view (1–5 days later, still within window).
    const likeDays = Math.max(0, viewDays - makeRng(learner.email, `like-lag-${i}`).int(1, 5));
    const createdAt = timestampDaysAgo(likeDays, 10 + (i % 8));

    try {
      await prisma.materialLike.create({
        data: {
          userId: learner.id,
          materialId: material.id,
          createdAt,
        },
      });
      counts.materialLikesCreated += 1;
    } catch {
      counts.materialLikesSkipped += 1;
    }
  }

  return liked;
};

type ProjectAction = "like" | "save" | "follow";

const seedProjectEngagement = async (
  learner: LearnerRow,
  projects: ProjectCandidate[],
  counts: SeedCounts,
): Promise<ProjectCandidate[]> => {
  const quota = TIER_QUOTAS[learner.tier];
  const likeTarget = makeRng(learner.email, "plike-n").int(
    quota.projectLikes[0],
    quota.projectLikes[1],
  );
  const saveTarget = makeRng(learner.email, "psave-n").int(
    quota.projectSaves[0],
    quota.projectSaves[1],
  );
  const followTarget = makeRng(learner.email, "pfollow-n").int(
    quota.projectFollows[0],
    quota.projectFollows[1],
  );

  const poolSize = Math.max(likeTarget, saveTarget, followTarget, 1) + 3;
  const pool = pickProjectsForLearner(learner, projects, poolSize, "project-pool");

  const assign = (action: ProjectAction, target: number): ProjectCandidate[] => {
    if (target <= 0) return [];
    const rng = makeRng(learner.email, `project-${action}`);
    // Do not force like+save+follow on the same project every time.
    const filtered =
      action === "follow"
        ? pool.filter(
            (p) =>
              p.difficulty !== "BEGINNER" ||
              learner.skillLevel === "BEGINNER",
          )
        : pool;
    return rng.sampleWeighted(
      filtered.length > 0 ? filtered : pool,
      target,
      (p) => projectAffinityScore(p, learner.interests),
    );
  };

  const liked = assign("like", likeTarget);
  const saved = assign("save", saveTarget);
  const followed = assign("follow", followTarget);

  const touch = async (
    action: ProjectAction,
    list: ProjectCandidate[],
    baseHour: number,
  ) => {
    for (let i = 0; i < list.length; i += 1) {
      const project = list[i]!;
      const daysAgo = recentBiasedDaysAgo(
        makeRng(learner.email, `${action}-day-${project.projectKey}`),
        BEHAVIOR_WINDOW_DAYS - 2,
      );
      // Chronology: like earlier than save earlier than follow when overlapping.
      const lag =
        action === "like" ? 0 : action === "save" ? 1 : 2;
      const createdAt = timestampDaysAgo(
        Math.max(0, daysAgo - lag),
        baseHour + i,
      );

      try {
        if (action === "like") {
          await prisma.projectLike.create({
            data: { userId: learner.id, projectId: project.id, createdAt },
          });
          counts.projectLikesCreated += 1;
        } else if (action === "save") {
          await prisma.projectSave.create({
            data: { userId: learner.id, projectId: project.id, createdAt },
          });
          counts.projectSavesCreated += 1;
        } else {
          await prisma.projectFollow.create({
            data: { userId: learner.id, projectId: project.id, createdAt },
          });
          counts.projectFollowsCreated += 1;
        }
      } catch {
        if (action === "like") counts.projectLikesSkipped += 1;
        else if (action === "save") counts.projectSavesSkipped += 1;
        else counts.projectFollowsSkipped += 1;
      }
    }
  };

  await touch("like", liked, 11);
  await touch("save", saved, 14);
  await touch("follow", followed, 16);

  // PD03 participation comes from normal affinity picks + BUILD_PLANS saves.
  // Avoid a blanket bonus that lets recycling-tagged PD03 projects dominate
  // popularity for nearly every learner (most personas include recycling).

  return [...liked, ...saved, ...followed];
};

const seedSupplierFollows = async (
  learner: LearnerRow,
  viewed: MaterialCandidate[],
  liked: MaterialCandidate[],
  counts: SeedCounts,
) => {
  const quota = TIER_QUOTAS[learner.tier];
  const target = makeRng(learner.email, "sfollow-n").int(
    quota.supplierFollows[0],
    quota.supplierFollows[1],
  );
  if (target <= 0) return;

  const likedIds = new Set(liked.map((m) => m.id));
  const scores = new Map<string, number>();
  for (const m of [...viewed, ...liked, ...liked]) {
    if (!m.supplierProfileId) continue;
    const communityBoost = m.isCommunity ? 1.8 : 1;
    scores.set(
      m.supplierProfileId,
      (scores.get(m.supplierProfileId) ?? 0) +
        (likedIds.has(m.id) ? 2 : 1) * communityBoost,
    );
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
    .slice(0, target);

  for (let i = 0; i < ranked.length; i += 1) {
    const supplierProfileId = ranked[i]!;
    const createdAt = timestampDaysAgo(
      recentBiasedDaysAgo(makeRng(learner.email, `sfollow-day-${i}`), 30),
      17,
    );
    try {
      await prisma.supplierFollower.create({
        data: {
          supplierProfileId,
          followerUserId: learner.id,
          createdAt,
        },
      });
      counts.supplierFollowsCreated += 1;
    } catch {
      counts.supplierFollowsSkipped += 1;
    }
  }
};

const findMaterialForBuild = (
  plan: BuildPlan["items"][number],
  materials: MaterialCandidate[],
): MaterialCandidate | null => {
  if (plan.materialSeedKey) {
    const byKey = materials.find((m) => m.seedKey === plan.materialSeedKey);
    if (byKey) return byKey;
  }
  if (plan.materialTitleIncludes) {
    const needle = norm(plan.materialTitleIncludes);
    const hit = materials.find(
      (m) =>
        norm(m.title).includes(needle) || norm(m.materialType).includes(needle),
    );
    if (hit) return hit;
  }
  return null;
};

const seedBuild = async (
  plan: BuildPlan,
  learnersByEmail: Map<string, LearnerRow>,
  projectsByKey: Map<string, ProjectCandidate>,
  materials: MaterialCandidate[],
  counts: SeedCounts,
) => {
  const learner = learnersByEmail.get(plan.learnerEmail);
  const project = projectsByKey.get(plan.projectKey);
  if (!learner || !project) {
    console.warn(
      `Skipping build plan: missing learner/project (${plan.learnerEmail} / ${plan.projectKey})`,
    );
    return;
  }
  if (project.status !== "PUBLISHED") {
    console.warn(`Skipping build on non-published project ${plan.projectKey}`);
    return;
  }
  if (!skillAllowsBuildDifficulty(learner.skillLevel, project.difficulty)) {
    console.warn(
      `Skipping build ${plan.projectKey} for ${learner.email}: skill ${learner.skillLevel} vs ${project.difficulty}`,
    );
    return;
  }

  const existing = await prisma.projectBuild.findFirst({
    where: {
      learnerId: learner.id,
      projectId: project.id,
      attemptNumber: 1,
    },
    include: { items: true },
  });

  if (existing) {
    counts.buildsSkipped += 1;
    return;
  }

  const components = await prisma.projectRequiredComponent.findMany({
    where: { projectId: project.id },
    select: { id: true, componentName: true },
    orderBy: { createdAt: "asc" },
  });

  const startedAt = timestampDaysAgo(plan.startedDaysAgo, 9);
  const completedAt =
    plan.status === "COMPLETED" && plan.completedDaysAgo != null
      ? timestampDaysAgo(plan.completedDaysAgo, 18)
      : null;

  const usedComponentIds = new Set<string>();
  const itemCreates: Array<{
    requiredComponentId: string;
    status: ProjectBuildItemStatus;
    learnerNote: string;
    linkedMaterialId: string | null;
    linkedMaterialAt: Date | null;
  }> = [];

  for (const itemPlan of plan.items) {
    const component = components.find((c) => {
      if (usedComponentIds.has(c.id)) return false;
      if (!itemPlan.componentIncludes) return true;
      return norm(c.componentName).includes(norm(itemPlan.componentIncludes));
    });
    if (!component) continue;
    usedComponentIds.add(component.id);

    const material =
      itemPlan.status === "AVAILABLE"
        ? findMaterialForBuild(itemPlan, materials)
        : null;

    itemCreates.push({
      requiredComponentId: component.id,
      status: itemPlan.status,
      learnerNote: `${BEHAVIOR_NOTE_PREFIX} ${plan.note}`,
      linkedMaterialId:
        itemPlan.status === "AVAILABLE" && material ? material.id : null,
      linkedMaterialAt:
        itemPlan.status === "AVAILABLE" && material ? startedAt : null,
    });
  }

  for (const component of components) {
    if (usedComponentIds.has(component.id)) continue;
    itemCreates.push({
      requiredComponentId: component.id,
      status: "MISSING",
      learnerNote: `${BEHAVIOR_NOTE_PREFIX} still missing`,
      linkedMaterialId: null,
      linkedMaterialAt: null,
    });
  }

  await prisma.projectBuild.create({
    data: {
      learnerId: learner.id,
      projectId: project.id,
      attemptNumber: 1,
      status: plan.status as ProjectBuildStatus,
      startedAt,
      completedAt,
      items: { create: itemCreates },
    },
  });

  counts.buildsCreated += 1;
  if (plan.status === "COMPLETED") counts.buildsCompleted += 1;
};

export const seedCommunityBehavior = async () => {
  assertLocalDatabaseHost();

  const counts: SeedCounts = {
    materialViewsCreated: 0,
    materialViewsSkipped: 0,
    materialLikesCreated: 0,
    materialLikesSkipped: 0,
    projectLikesCreated: 0,
    projectLikesSkipped: 0,
    projectSavesCreated: 0,
    projectSavesSkipped: 0,
    projectFollowsCreated: 0,
    projectFollowsSkipped: 0,
    supplierFollowsCreated: 0,
    supplierFollowsSkipped: 0,
    buildsCreated: 0,
    buildsSkipped: 0,
    buildsCompleted: 0,
    cachesInvalidated: 0,
  };

  const learners = await loadLearners();
  const materials = await loadMaterials();
  const projects = await loadProjects();

  const reset = await resetCommunityDemoEngagement(learners.map((l) => l.id));

  const communityMaterialCount = materials.filter((m) => m.isCommunity).length;
  if (communityMaterialCount < 200) {
    throw new Error(
      `Expected ~206 community materials, found ${communityMaterialCount}.`,
    );
  }
  if (projects.length < 37) {
    throw new Error(`Expected 37 demo projects, found ${projects.length}.`);
  }

  const tierSummary: Record<ActivityTier, number> = {
    HIGH: 0,
    MEDIUM: 0,
    LIGHT: 0,
    DORMANT: 0,
  };

  console.log(
    JSON.stringify(
      {
        phase: "BEHAVIOR-DATA-01",
        epochEnd: BEHAVIOR_EPOCH_END.toISOString(),
        windowDays: BEHAVIOR_WINDOW_DAYS,
        source: BEHAVIOR_SOURCE,
        opPrefix: BEHAVIOR_OP_PREFIX,
        learners: learners.length,
        materialsAvailable: materials.length,
        communityMaterials: communityMaterialCount,
        demoProjects: projects.length,
      },
      null,
      2,
    ),
  );

  for (const learner of learners) {
    tierSummary[learner.tier] += 1;
    const viewed = await seedMaterialViews(learner, materials, counts);
    const liked = await seedMaterialLikes(learner, viewed, materials, counts);
    await seedProjectEngagement(learner, projects, counts);
    await seedSupplierFollows(learner, viewed, liked, counts);

    invalidateLearnerHomeCache(learner.id);
    counts.cachesInvalidated += 1;
  }

  const learnersByEmail = new Map(learners.map((l) => [l.email, l]));
  const projectsByKey = new Map(projects.map((p) => [p.projectKey, p]));

  for (const plan of BUILD_PLANS) {
    await seedBuild(plan, learnersByEmail, projectsByKey, materials, counts);
  }

  // Ensure build learners also saved/followed the build project when missing.
  for (const plan of BUILD_PLANS) {
    const learner = learnersByEmail.get(plan.learnerEmail);
    const project = projectsByKey.get(plan.projectKey);
    if (!learner || !project || project.status !== "PUBLISHED") continue;
    const saveAt = timestampDaysAgo(plan.startedDaysAgo + 2, 13);
    try {
      await prisma.projectSave.create({
        data: {
          userId: learner.id,
          projectId: project.id,
          createdAt: saveAt,
        },
      });
      counts.projectSavesCreated += 1;
    } catch {
      counts.projectSavesSkipped += 1;
    }
  }

  const reservationCount = await prisma.reservation.count();

  return {
    dataset: "community-demo-behavior",
    mode: "sync",
    reset,
    tierSummary,
    counts,
    reservationsUnchanged: reservationCount,
    note:
      "Idempotent community engagement + limited builds. Owned engagement is reconciled each run; builds upsert by attempt. No reservation/delivery/payment workflows created.",
  };
};

const isMain = () => {
  const entry = process.argv[1]?.replace(/\\/g, "/");
  return Boolean(entry?.endsWith("/seed-community-behavior.ts"));
};

if (isMain()) {
  seedCommunityBehavior()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
