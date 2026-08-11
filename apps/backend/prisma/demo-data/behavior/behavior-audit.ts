/**
 * BEHAVIOR-DATA-01 — audit current engagement/build counts.
 * Run: npx tsx prisma/demo-data/behavior/behavior-audit.ts
 */
import { prisma } from "../../../src/database/prisma.js";

const median = (nums: number[]): number => {
  if (nums.length === 0) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
};

const dist = (counts: number[]) => {
  if (counts.length === 0) return { min: 0, median: 0, max: 0, n: 0 };
  return {
    min: Math.min(...counts),
    median: median(counts),
    max: Math.max(...counts),
    n: counts.length,
  };
};

async function main() {
  const communityLearners = await prisma.user.findMany({
    where: { email: { endsWith: "@impactloop.demo" }, activeRole: "LEARNER" },
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

  const learnerIds = communityLearners.map((u) => u.id);

  const communityMaterialIds = (
    await prisma.materialTag.findMany({
      where: { tag: { startsWith: "il-demo-mat:" } },
      select: { materialId: true },
    })
  ).map((t) => t.materialId);

  const demoProjectIds = (
    await prisma.projectTag.findMany({
      where: { tag: { startsWith: "demo-project-key:" } },
      select: { projectId: true },
    })
  ).map((t) => t.projectId);

  const [
    people,
    materialsTotal,
    communityMats,
    demoProjects,
    published,
    pending,
    pd03,
    matViews,
    matLikes,
    projLikes,
    projSaves,
    projFollows,
    supplierFollows,
    builds,
    buildsCompleted,
    buildsInProgress,
    reservations,
    communityMatViews,
    communityMatLikes,
    materialsWithViews,
    materialsWithLikes,
    communityMatsWithViews,
    communityMatsWithLikes,
    projectsWithLikes,
    projectsWithSaves,
    projectsWithFollows,
    learnersWithAnyBehavior,
    learnerMaterialRequests,
  ] = await Promise.all([
    prisma.user.count({ where: { email: { endsWith: "@impactloop.demo" } } }),
    prisma.material.count(),
    communityMaterialIds.length,
    demoProjectIds.length,
    prisma.learningProject.count({
      where: {
        status: "PUBLISHED",
        tags: { some: { tag: { startsWith: "demo-project-key:" } } },
      },
    }),
    prisma.learningProject.count({
      where: {
        status: "PENDING_REVIEW",
        tags: { some: { tag: { startsWith: "demo-project-key:" } } },
      },
    }),
    prisma.projectTag.count({ where: { tag: "project-data-03" } }),
    prisma.materialView.count(),
    prisma.materialLike.count(),
    prisma.projectLike.count(),
    prisma.projectSave.count(),
    prisma.projectFollow.count(),
    prisma.supplierFollower.count(),
    prisma.projectBuild.count(),
    prisma.projectBuild.count({ where: { status: "COMPLETED" } }),
    prisma.projectBuild.count({ where: { status: "IN_PROGRESS" } }),
    prisma.reservation.count(),
    prisma.materialView.count({
      where: { materialId: { in: communityMaterialIds } },
    }),
    prisma.materialLike.count({
      where: { materialId: { in: communityMaterialIds } },
    }),
    prisma.material.count({ where: { viewsCount: { gt: 0 } } }),
    prisma.material.count({ where: { likes: { some: {} } } }),
    prisma.material.count({
      where: {
        id: { in: communityMaterialIds },
        OR: [{ viewsCount: { gt: 0 } }, { views: { some: {} } }],
      },
    }),
    prisma.material.count({
      where: { id: { in: communityMaterialIds }, likes: { some: {} } },
    }),
    prisma.learningProject.count({ where: { likes: { some: {} } } }),
    prisma.learningProject.count({ where: { saves: { some: {} } } }),
    prisma.learningProject.count({ where: { follows: { some: {} } } }),
    prisma.user.count({
      where: {
        id: { in: learnerIds },
        OR: [
          { materialLikes: { some: {} } },
          { materialViews: { some: {} } },
          { projectLikes: { some: {} } },
          { projectSaves: { some: {} } },
          { projectFollows: { some: {} } },
          { supplierFollows: { some: {} } },
          { projectBuilds: { some: {} } },
        ],
      },
    }),
    prisma.learnerMaterialRequest.count(),
  ]);

  // Per-learner activity for community learners
  const perLearner = [];
  for (const u of communityLearners) {
    const [v, l, pl, ps, pf, sf, b] = await Promise.all([
      prisma.materialView.count({ where: { viewerUserId: u.id } }),
      prisma.materialLike.count({ where: { userId: u.id } }),
      prisma.projectLike.count({ where: { userId: u.id } }),
      prisma.projectSave.count({ where: { userId: u.id } }),
      prisma.projectFollow.count({ where: { userId: u.id } }),
      prisma.supplierFollower.count({ where: { followerUserId: u.id } }),
      prisma.projectBuild.count({ where: { learnerId: u.id } }),
    ]);
    perLearner.push({
      email: u.email,
      interests: u.learnerProfile?.interests ?? [],
      skillLevel: u.learnerProfile?.skillLevel,
      learnerType: u.learnerProfile?.learnerType,
      city: u.savedLocations[0]?.location?.city ?? null,
      area: u.savedLocations[0]?.location?.area ?? null,
      views: v,
      likes: l,
      projectLikes: pl,
      projectSaves: ps,
      projectFollows: pf,
      supplierFollows: sf,
      builds: b,
      total: v + l + pl + ps + pf + sf + b,
    });
  }

  // View count consistency sample
  const viewAgg = await prisma.materialView.groupBy({
    by: ["materialId"],
    _count: { _all: true },
    where: { materialId: { in: communityMaterialIds.slice(0, 50) } },
  });
  const sampleMats = await prisma.material.findMany({
    where: { id: { in: viewAgg.map((g) => g.materialId) } },
    select: { id: true, viewsCount: true, title: true },
  });

  const report = {
    core: {
      people,
      materialsTotal,
      communityMats,
      demoProjects,
      published,
      pending,
      pd03,
      reservations,
      learnerMaterialRequests,
    },
    engagement: {
      matViews,
      matLikes,
      projLikes,
      projSaves,
      projFollows,
      supplierFollows,
      builds,
      buildsCompleted,
      buildsInProgress,
      communityMatViews,
      communityMatLikes,
      materialsWithViews,
      materialsWithLikes,
      communityMatsWithViews,
      communityMatsWithLikes,
      projectsWithLikes,
      projectsWithSaves,
      projectsWithFollows,
      learnersWithAnyBehavior,
      communityLearnerCount: communityLearners.length,
    },
    distributions: {
      viewsPerLearner: dist(perLearner.map((x) => x.views)),
      likesPerLearner: dist(perLearner.map((x) => x.likes)),
      activityPerLearner: dist(perLearner.map((x) => x.total)),
    },
    learners: perLearner,
    viewCountSample: sampleMats.map((m) => {
      const g = viewAgg.find((x) => x.materialId === m.id);
      return {
        title: m.title,
        viewsCount: m.viewsCount,
        viewRows: g?._count._all ?? 0,
      };
    }),
  };

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
