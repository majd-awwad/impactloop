/**
 * Community behavior — personalization smoke against Learner Home sections.
 * Run after demo:seed:behavior:
 *   npm run demo:smoke:personalization -w apps/backend
 */
import { prisma } from "../../../src/database/prisma.js";
import {
  getLearnerHome,
  invalidateLearnerHomeCache,
} from "../../../src/modules/learner-home/learner-home.service.js";

const PERSONAS = [
  {
    email: "user14@impactloop.demo",
    label: "electronics/robotics",
    expectMaterialHints: ["arduino", "esp", "sensor", "motor", "led", "wire"],
    avoidDominate: ["fabric", "felt", "denim", "cardboard"],
  },
  {
    email: "user43@impactloop.demo",
    label: "crafts/textiles/recycling",
    expectMaterialHints: ["fabric", "felt", "cardboard", "denim", "paint", "bottle"],
    avoidDominate: ["arduino", "esp32", "lidar"],
  },
  {
    email: "user23@impactloop.demo",
    label: "woodworking/home DIY",
    expectMaterialHints: ["wood", "plywood", "mdf", "pine", "screw", "acrylic", "pvc"],
    avoidDominate: ["fabric", "felt"],
  },
  {
    email: "user52@impactloop.demo",
    label: "education/lab (mixed)",
    expectMaterialHints: [
      // Recycling half of the mixed persona (often free-nearby / browse).
      "cardboard",
      "tin",
      "bottle",
      "foam",
      "plastic",
      // Lab & Education catalog vocabulary when interest ranking surfaces it.
      "lab",
      "multimeter",
      "probe",
      "alligator",
      "soldering",
      "trainer",
      "sample",
      "kit",
      "beaker",
      "pipette",
      "syringe",
    ],
    avoidDominate: ["fabric", "denim", "lidar"],
  },
  {
    email: "user58@impactloop.demo",
    label: "recycling/home DIY",
    expectMaterialHints: ["bottle", "plastic", "cardboard", "jar", "recycle"],
    avoidDominate: ["lidar"],
  },
  {
    email: "user99@impactloop.demo",
    label: "dormant/low-activity",
    expectMaterialHints: [],
    avoidDominate: [],
  },
] as const;

const sectionItems = (
  home: Awaited<ReturnType<typeof getLearnerHome>>,
  key: string,
): string[] => {
  const section = home.sections.find((s) => s.key === key);
  if (!section) return [];
  return section.items.map((item) => {
    if (item.type === "material") {
      const material = item.material as { title?: string };
      return (material.title ?? "").toLowerCase();
    }
    if (item.type === "project") {
      const project = item.project as { title?: string };
      return (project.title ?? "").toLowerCase();
    }
    if (item.type === "continue_project") {
      const build = item.build as {
        project?: { title?: string };
        projectTitle?: string;
      };
      return (
        build.project?.title ??
        build.projectTitle ??
        ""
      ).toLowerCase();
    }
    return "";
  });
};

const countHits = (titles: string[], hints: readonly string[]) =>
  titles.filter((t) => hints.some((h) => t.includes(h))).length;

async function main() {
  const report: unknown[] = [];

  for (const persona of PERSONAS) {
    const user = await prisma.user.findUnique({
      where: { email: persona.email },
      include: { learnerProfile: true },
    });
    if (!user) {
      report.push({ email: persona.email, error: "user not found" });
      continue;
    }

    invalidateLearnerHomeCache(user.id);
    const home = await getLearnerHome(user.id);

    const suggestedMaterials = sectionItems(home, "suggested_materials");
    const freeNearby = sectionItems(home, "free_materials_near_you");
    const suggestedProjects = sectionItems(home, "suggested_projects");
    const savedProjects = sectionItems(home, "saved_projects");
    const continueProjects = sectionItems(home, "continue_projects");
    const popularProjects = sectionItems(home, "popular_projects");
    const materialsForSaved = sectionItems(home, "materials_for_saved_projects");

    const materialPool = [...suggestedMaterials, ...freeNearby].slice(0, 20);
    const expectHits = countHits(materialPool, persona.expectMaterialHints);
    const avoidHits = countHits(materialPool, persona.avoidDominate);

    report.push({
      email: persona.email,
      label: persona.label,
      interests: user.learnerProfile?.interests ?? [],
      skillLevel: user.learnerProfile?.skillLevel,
      sectionCounts: {
        suggested_materials: suggestedMaterials.length,
        materials_for_saved_projects: materialsForSaved.length,
        free_materials_near_you: freeNearby.length,
        suggested_projects: suggestedProjects.length,
        saved_projects: savedProjects.length,
        continue_projects: continueProjects.length,
        popular_projects: popularProjects.length,
      },
      topSuggestedMaterials: suggestedMaterials.slice(0, 8),
      topSuggestedProjects: suggestedProjects.slice(0, 6),
      savedProjects: savedProjects.slice(0, 6),
      continueProjects: continueProjects.slice(0, 4),
      topPopularProjects: popularProjects.slice(0, 6),
      affinityProbe: {
        expectHits,
        avoidHits,
        note:
          persona.label === "dormant/low-activity"
            ? "Expect fallback/popularity-driven sections still useful"
            : expectHits >= avoidHits
              ? "persona-aligned signal looks stronger than avoided category"
              : "WARNING: avoided category competing strongly",
      },
    });
  }

  // Popularity snapshot
  const topMaterials = await prisma.material.findMany({
    orderBy: [{ viewsCount: "desc" }, { id: "asc" }],
    take: 12,
    select: {
      title: true,
      viewsCount: true,
      category: { select: { nameEn: true } },
      tags: {
        where: { tag: { startsWith: "il-demo-mat:" } },
        select: { tag: true },
      },
      _count: { select: { likes: true } },
    },
  });

  const topProjects = await prisma.learningProject.findMany({
    where: { status: "PUBLISHED" },
    take: 40,
    select: {
      title: true,
      category: { select: { nameEn: true } },
      tags: { select: { tag: true } },
      _count: { select: { likes: true, saves: true, follows: true } },
    },
  });

  const rankedProjects = topProjects
    .map((p) => ({
      title: p.title,
      category: p.category?.nameEn,
      pd03: p.tags.some((t) => t.tag === "project-data-03"),
      score: p._count.likes + p._count.saves * 2 + p._count.follows,
      likes: p._count.likes,
      saves: p._count.saves,
      follows: p._count.follows,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  console.log(
    JSON.stringify(
      {
        personas: report,
        popularity: {
          topMaterialsByViews: topMaterials.map((m) => ({
            title: m.title,
            category: m.category.nameEn,
            viewsCount: m.viewsCount,
            likes: m._count.likes,
            community: m.tags.length > 0,
          })),
          topProjectsByEngagement: rankedProjects,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
