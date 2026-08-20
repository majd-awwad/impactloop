import { prisma } from '../../../src/database/prisma.js';
import { env } from '../../../src/config/env.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import { COMMUNITY_MATERIAL_BULK_TAG } from '../materials/load-canonical-materials.js';
import { redact } from './local-demo-accounts.js';

export const LANDING_PREFERRED_PROJECT_TITLES = [
  'Mini Wooden Phone Stand',
  'Recycled Cardboard Desk Organizer',
  'PVC Plant Stand',
  'Small Reclaimed Wood Wall Shelf',
  'Mini Greenhouse Prototype',
  'Fabric Pencil Case',
] as const;

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60_000);

export async function prepareLandingDemo() {
  assertLocalDemoDatabaseUrl(env.databaseUrl, 'figure 3.44 landing demo prep');

  const publicMaterials = await prisma.material.findMany({
    where: {
      status: 'AVAILABLE',
      tags: { some: { tag: COMMUNITY_MATERIAL_BULK_TAG } },
      images: { some: {} },
      category: { isActive: true, categoryType: { in: ['MATERIAL', 'BOTH'] } },
    },
    select: {
      id: true,
      title: true,
      isFree: true,
      price: true,
      category: { select: { nameEn: true } },
      images: { select: { imageUrl: true }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });

  const preferredProjects = await prisma.learningProject.findMany({
    where: {
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
      title: { in: [...LANDING_PREFERRED_PROJECT_TITLES] },
      coverImageUrl: { not: null },
    },
    select: {
      id: true,
      title: true,
      difficulty: true,
      coverImageUrl: true,
      category: { select: { nameEn: true } },
    },
  });

  preferredProjects.sort((left, right) => {
    const rank = (title: string) => {
      const index = (LANDING_PREFERRED_PROJECT_TITLES as readonly string[]).indexOf(
        title,
      );
      return index === -1 ? LANDING_PREFERRED_PROJECT_TITLES.length : index;
    };
    return rank(left.title) - rank(right.title);
  });

  const fallbackProjects =
    preferredProjects.length >= 4
      ? []
      : await prisma.learningProject.findMany({
          where: {
            status: 'PUBLISHED',
            hiddenAt: null,
            archivedAt: null,
            coverImageUrl: { not: null },
            id: { notIn: preferredProjects.map((project) => project.id) },
          },
          select: {
            id: true,
            title: true,
            difficulty: true,
            coverImageUrl: true,
            category: { select: { nameEn: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 6 - preferredProjects.length,
        });

  const featuredProjects = [...preferredProjects, ...fallbackProjects].slice(0, 6);

  const byCategory = new Map<string, typeof publicMaterials>();
  for (const material of publicMaterials) {
    const category = material.category.nameEn;
    const list = byCategory.get(category) ?? [];
    list.push(material);
    byCategory.set(category, list);
  }

  const uniqueMaterials: typeof publicMaterials = [];
  const categories = [...byCategory.keys()];
  let cursor = 0;
  while (uniqueMaterials.length < 6 && categories.length > 0) {
    const categoryIndex = cursor % categories.length;
    const category = categories[categoryIndex]!;
    const list = byCategory.get(category)!;
    const next = list.shift();
    if (next) {
      uniqueMaterials.push(next);
    }
    if (list.length === 0) {
      categories.splice(categoryIndex, 1);
    } else {
      cursor += 1;
    }
  }

  if (uniqueMaterials.length < 4) {
    throw new Error(
      `Need at least 4 AVAILABLE community-demo materials with images. Found ${uniqueMaterials.length}.`,
    );
  }
  if (featuredProjects.length < 4) {
    throw new Error(
      `Need at least 4 PUBLISHED learning projects with covers. Found ${featuredProjects.length}.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    for (const [index, material] of uniqueMaterials.entries()) {
      await tx.material.update({
        where: { id: material.id },
        data: { createdAt: hoursAgo(index) },
      });
    }
    for (const [index, project] of featuredProjects.entries()) {
      await tx.learningProject.update({
        where: { id: project.id },
        data: { createdAt: hoursAgo(index) },
      });
    }
  });

  const [availableCount, publishedCount, reusedCount] = await Promise.all([
    prisma.material.count({
      where: {
        status: 'AVAILABLE',
        category: { isActive: true, categoryType: { in: ['MATERIAL', 'BOTH'] } },
      },
    }),
    prisma.learningProject.count({
      where: { status: 'PUBLISHED', hiddenAt: null, archivedAt: null },
    }),
    prisma.material.count({ where: { status: 'REUSED' } }),
  ]);

  console.log('Figure 3.44 landing demo records promoted (logged-out screenshot).');
  console.log(`Available materials: ${availableCount}`);
  console.log(`Published projects: ${publishedCount}`);
  console.log(`Reused materials: ${reusedCount}`);
  console.log('Featured materials (newest first):');
  for (const material of uniqueMaterials) {
    const price = material.isFree
      ? 'Free'
      : `${material.price?.toString() ?? '0'} NIS`;
    console.log(
      `- ${material.title} [${material.category.nameEn}] ${price} (${redact(material.id)})`,
    );
  }
  console.log('Featured projects (newest first):');
  for (const project of featuredProjects) {
    console.log(
      `- ${project.title} [${project.category.nameEn} / ${project.difficulty}] (${redact(project.id)})`,
    );
  }

  return {
    featuredMaterialIds: uniqueMaterials.map((row) => row.id),
    featuredProjectIds: featuredProjects.map((row) => row.id),
  };
}
