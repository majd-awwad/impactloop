/**
 * Idempotent An-Najah Arabic Learning Projects seeder (historical PROJECT-DATA-03).
 *
 * Identity: ProjectTag `demo-project-key:<key>`
 * Creates/updates the 7 curated Arabic Learning Projects without touching
 * the existing 30 demo projects' content.
 *
 * Usage:
 *   npm run demo:seed:projects:najah -w apps/backend
 */
import fs from 'node:fs';
import { prisma } from '../../../src/database/prisma.js';
import { communityDemoProjectImageDiskPath } from '../../../src/constants/community-demo-projects.js';
import { seedTaxonomyFoundation } from '../../../src/modules/taxonomy/taxonomy-foundation.repository.js';
import { seedTaxonomyCompatibilityRelations } from '../../../src/modules/taxonomy/taxonomy-compatibility-relations.seed.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import {
  DEMO_PROJECT_KEY_PREFIX,
  PROJECT_DATA_03_BATCH_TAG,
  PROJECT_DATA_03_IMAGE_MANIFEST,
  PROJECT_DATA_03_PROJECTS,
  type ProjectData03Project,
} from './najah-projects.data.js';

const assertProjectCoverAssetsExist = () => {
  const missing: string[] = [];
  for (const entry of PROJECT_DATA_03_IMAGE_MANIFEST) {
    const diskPath = communityDemoProjectImageDiskPath(entry.coverFile);
    if (!fs.existsSync(diskPath)) {
      missing.push(`${entry.key} → ${entry.coverFile} (expected at ${diskPath})`);
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `PROJECT-DATA-03 cover assets missing (${missing.length}):\n- ${missing.join('\n- ')}`,
    );
  }
};

const resolveCategoryId = async (
  cache: Map<string, string>,
  categoryKey: string,
) => {
  const cached = cache.get(categoryKey);
  if (cached) return cached;

  const nameEnByKey: Record<string, string> = {
    'electronics-components': 'Electronics & Components',
    'motors-mechanical': 'Motors & Mechanical Parts',
    'power-batteries': 'Power & Batteries',
    'wood-boards': 'Wood & Boards',
    'plastics-acrylic': 'Plastics & Acrylic',
    'metal-fasteners': 'Metal & Fasteners',
    'fabric-textiles': 'Fabric & Textiles',
    'paper-cardboard': 'Paper & Cardboard',
    'tools-hardware': 'Tools & Hardware',
    'art-craft-supplies': 'Art & Craft Supplies',
    'packaging-containers': 'Packaging & Containers',
    'lab-education': 'Lab & Education Supplies',
    'other-reusable': 'Other Reusable Materials',
    robotics: 'Robotics',
    'electronics-learning': 'Electronics',
    'recycling-crafts': 'Recycling Crafts',
    woodworking: 'Woodworking',
    'home-experiments': 'Home Experiments',
    'textile-crafts': 'Textile Crafts',
  };

  const nameEn = nameEnByKey[categoryKey];
  if (!nameEn) {
    throw new Error(`Unknown category key: ${categoryKey}`);
  }
  const category = await prisma.category.findFirst({
    where: { nameEn },
    select: { id: true },
  });
  if (!category) {
    throw new Error(`Category not found for key=${categoryKey} nameEn=${nameEn}`);
  }
  cache.set(categoryKey, category.id);
  return category.id;
};

const fingerprint = (project: ProjectData03Project) =>
  JSON.stringify({
    title: project.title,
    shortDescription: project.shortDescription,
    description: project.description,
    difficulty: project.difficulty,
    estimatedDurationMinutes: project.estimatedDurationMinutes,
    coverImageUrl: project.coverImageUrl,
    status: project.status,
    components: project.components,
    steps: project.steps,
    links: project.links,
    tags: [...project.tags].sort(),
  });

const syncOne = async (input: {
  project: ProjectData03Project;
  authorId: string;
  adminId: string | null;
  categoryCache: Map<string, string>;
  conceptIdByKey: Map<string, string>;
}) => {
  const { project, authorId, adminId, categoryCache, conceptIdByKey } = input;
  const identityTag = `${DEMO_PROJECT_KEY_PREFIX}${project.key}`;
  const projectCategoryId = await resolveCategoryId(
    categoryCache,
    project.categoryKey,
  );

  const existing = await prisma.learningProject.findFirst({
    where: { tags: { some: { tag: identityTag } } },
    include: {
      tags: true,
      images: true,
      requiredComponents: { include: { taxonomyConcepts: true } },
      steps: true,
      links: true,
    },
  });

  const reviewedBy = project.status === 'PUBLISHED' ? adminId : null;
  const reviewedAt = project.status === 'PUBLISHED' ? new Date() : null;

  if (!existing) {
    const created = await prisma.learningProject.create({
      data: {
        categoryId: projectCategoryId,
        createdBy: authorId,
        title: project.title,
        shortDescription: project.shortDescription,
        description: project.description,
        difficulty: project.difficulty,
        estimatedDurationMinutes: project.estimatedDurationMinutes,
        coverImageUrl: project.coverImageUrl,
        status: project.status,
        submittedAt: new Date(),
        reviewedBy,
        reviewedAt,
        reviewNote:
          project.status === 'PUBLISHED'
            ? 'PROJECT-DATA-03 curated Arabic Learning Project (An-Najah inspired).'
            : null,
        stepsGeneratedByAi: false,
        images: {
          create: [
            { imageUrl: project.coverImageUrl, sortOrder: 0 },
            { imageUrl: project.coverImageUrl, sortOrder: 1 },
          ],
        },
        requiredComponents: {
          create: await Promise.all(
            project.components.map(async (component) => ({
              categoryId: await resolveCategoryId(
                categoryCache,
                component.categoryKey,
              ),
              componentName: component.name,
              materialType: component.materialType,
              quantity: component.quantity,
              unit: component.unit,
              componentRole: component.role,
              isRequired: component.required,
              canBeSubstituted: component.substitute,
              searchKeywords: component.keywords,
              alternativeKeywords: component.alternatives ?? [],
              providedByUser: true,
              confirmedByUser: true,
              generatedOrSuggestedByAi: false,
              reviewStatus:
                project.status === 'PUBLISHED' ? 'ACCEPTED' : 'PENDING_REVIEW',
              notes: component.notes ?? null,
            })),
          ),
        },
        steps: {
          create: project.steps.map((step, index) => ({
            stepNumber: index + 1,
            title: step.title,
            description: step.description,
            generatedByAi: false,
            approvedBy: reviewedBy,
            reviewStatus:
              project.status === 'PUBLISHED' ? 'ACCEPTED' : 'PENDING_REVIEW',
          })),
        },
        links: {
          create: project.links.map((link) => ({
            linkType: link.linkType,
            url: link.url,
            title: link.title,
            sourceName: link.sourceName,
          })),
        },
        tags: {
          create: [
            { tag: identityTag },
            { tag: PROJECT_DATA_03_BATCH_TAG },
            ...project.tags
              .filter((tag) => tag !== PROJECT_DATA_03_BATCH_TAG)
              .map((tag) => ({ tag })),
          ],
        },
      },
      include: { requiredComponents: true },
    });

    for (const component of project.components) {
      if (!component.conceptKey) continue;
      const conceptId = conceptIdByKey.get(component.conceptKey);
      const row = created.requiredComponents.find(
        (c) =>
          c.componentName === component.name &&
          c.materialType === component.materialType,
      );
      if (!conceptId || !row) continue;
      await prisma.projectComponentConcept.createMany({
        data: [{ componentId: row.id, conceptId }],
        skipDuplicates: true,
      });
    }

    return { key: project.key, action: 'created' as const, id: created.id };
  }

  // Update managed content in place (preserve id / engagement / builds).
  await prisma.$transaction(async (tx) => {
    await tx.learningProject.update({
      where: { id: existing.id },
      data: {
        categoryId: projectCategoryId,
        title: project.title,
        shortDescription: project.shortDescription,
        description: project.description,
        difficulty: project.difficulty,
        estimatedDurationMinutes: project.estimatedDurationMinutes,
        coverImageUrl: project.coverImageUrl,
        status: project.status,
        reviewedBy,
        reviewedAt,
        reviewNote:
          project.status === 'PUBLISHED'
            ? 'PROJECT-DATA-03 curated Arabic Learning Project (An-Najah inspired).'
            : existing.reviewNote,
      },
    });

    await tx.projectImage.deleteMany({ where: { projectId: existing.id } });
    await tx.projectImage.createMany({
      data: [
        {
          projectId: existing.id,
          imageUrl: project.coverImageUrl,
          sortOrder: 0,
        },
        {
          projectId: existing.id,
          imageUrl: project.coverImageUrl,
          sortOrder: 1,
        },
      ],
    });

    await tx.projectComponentConcept.deleteMany({
      where: { component: { projectId: existing.id } },
    });
    await tx.projectRequiredComponent.deleteMany({
      where: { projectId: existing.id },
    });
    for (const component of project.components) {
      const createdComponent = await tx.projectRequiredComponent.create({
        data: {
          projectId: existing.id,
          categoryId: await resolveCategoryId(
            categoryCache,
            component.categoryKey,
          ),
          componentName: component.name,
          materialType: component.materialType,
          quantity: component.quantity,
          unit: component.unit,
          componentRole: component.role,
          isRequired: component.required,
          canBeSubstituted: component.substitute,
          searchKeywords: component.keywords,
          alternativeKeywords: component.alternatives ?? [],
          providedByUser: true,
          confirmedByUser: true,
          generatedOrSuggestedByAi: false,
          reviewStatus:
            project.status === 'PUBLISHED' ? 'ACCEPTED' : 'PENDING_REVIEW',
          notes: component.notes ?? null,
        },
      });
      if (component.conceptKey) {
        const conceptId = conceptIdByKey.get(component.conceptKey);
        if (conceptId) {
          await tx.projectComponentConcept.create({
            data: { componentId: createdComponent.id, conceptId },
          });
        }
      }
    }

    await tx.projectStep.deleteMany({ where: { projectId: existing.id } });
    await tx.projectStep.createMany({
      data: project.steps.map((step, index) => ({
        projectId: existing.id,
        stepNumber: index + 1,
        title: step.title,
        description: step.description,
        generatedByAi: false,
        approvedBy: reviewedBy,
        reviewStatus:
          project.status === 'PUBLISHED' ? 'ACCEPTED' : 'PENDING_REVIEW',
      })),
    });

    await tx.projectLink.deleteMany({ where: { projectId: existing.id } });
    await tx.projectLink.createMany({
      data: project.links.map((link) => ({
        projectId: existing.id,
        linkType: link.linkType,
        url: link.url,
        title: link.title,
        sourceName: link.sourceName,
      })),
    });

    const desiredTags = new Set([
      identityTag,
      PROJECT_DATA_03_BATCH_TAG,
      ...project.tags,
    ]);
    await tx.projectTag.deleteMany({
      where: {
        projectId: existing.id,
        OR: [
          { tag: identityTag },
          { tag: PROJECT_DATA_03_BATCH_TAG },
          { tag: { in: project.tags } },
        ],
      },
    });
    await tx.projectTag.createMany({
      data: [...desiredTags].map((tag) => ({
        projectId: existing.id,
        tag,
      })),
      skipDuplicates: true,
    });
  });

  // Cheap change detection for reporting
  const beforeFp = JSON.stringify({
    title: existing.title,
    shortDescription: existing.shortDescription,
    description: existing.description,
    difficulty: existing.difficulty,
    estimatedDurationMinutes: existing.estimatedDurationMinutes,
    coverImageUrl: existing.coverImageUrl,
    status: existing.status,
    componentCount: existing.requiredComponents.length,
    stepCount: existing.steps.length,
    linkCount: existing.links.length,
  });
  const after = await prisma.learningProject.findUniqueOrThrow({
    where: { id: existing.id },
    include: {
      _count: {
        select: { requiredComponents: true, steps: true, links: true },
      },
    },
  });
  const afterFp = JSON.stringify({
    title: after.title,
    shortDescription: after.shortDescription,
    description: after.description,
    difficulty: after.difficulty,
    estimatedDurationMinutes: after.estimatedDurationMinutes,
    coverImageUrl: after.coverImageUrl,
    status: after.status,
    componentCount: after._count.requiredComponents,
    stepCount: after._count.steps,
    linkCount: after._count.links,
  });

  return {
    key: project.key,
    action: beforeFp === afterFp ? ('unchanged' as const) : ('updated' as const),
    id: existing.id,
    fingerprint: fingerprint(project).length,
  };
};

const main = async () => {
  assertLocalDemoDatabaseUrl(
    process.env.DATABASE_URL,
    'An-Najah learning projects seeding',
  );
  assertProjectCoverAssetsExist();
  await seedTaxonomyFoundation();
  await seedTaxonomyCompatibilityRelations();

  const authors = await prisma.user.findMany({
    where: {
      email: {
        in: [
          ...new Set(PROJECT_DATA_03_PROJECTS.map((p) => p.authorEmail)),
          'admin@admin.com',
        ],
      },
    },
    select: { id: true, email: true },
  });
  const authorByEmail = new Map(authors.map((u) => [u.email, u.id]));
  const adminId = authorByEmail.get('admin@admin.com') ?? null;

  const concepts = await prisma.taxonomyConcept.findMany({
    where: { status: 'ACTIVE', conceptType: 'COMPONENT' },
    select: { id: true, canonicalKey: true },
  });
  const conceptIdByKey = new Map(concepts.map((c) => [c.canonicalKey, c.id]));
  const categoryCache = new Map<string, string>();

  const results = [];
  for (const project of PROJECT_DATA_03_PROJECTS) {
    const authorId = authorByEmail.get(project.authorEmail);
    if (!authorId) {
      throw new Error(`Missing author user: ${project.authorEmail}`);
    }
    results.push(
      await syncOne({
        project,
        authorId,
        adminId,
        categoryCache,
        conceptIdByKey,
      }),
    );
  }

  const published = await prisma.learningProject.count({
    where: {
      status: 'PUBLISHED',
      archivedAt: null,
      hiddenAt: null,
      NOT: {
        title: { contains: '[test-learning-project-material-allocation]' },
      },
    },
  });
  const pending = await prisma.learningProject.count({
    where: {
      status: 'PENDING_REVIEW',
      NOT: {
        title: { contains: '[test-learning-project-material-allocation]' },
      },
    },
  });
  const tagged03 = await prisma.projectTag.count({
    where: { tag: PROJECT_DATA_03_BATCH_TAG },
  });
  const community = await prisma.material.count({
    where: { tags: { some: { tag: 'community-demo' } } },
  });

  console.log(
    JSON.stringify(
      {
        dataset: 'project-data-03',
        results,
        created: results.filter((r) => r.action === 'created').length,
        updated: results.filter((r) => r.action === 'updated').length,
        unchanged: results.filter((r) => r.action === 'unchanged').length,
        publishedRealProjects: published,
        pendingReviewReal: pending,
        projectData03Tagged: tagged03,
        communityMaterials: community,
        catalogSize: PROJECT_DATA_03_PROJECTS.length,
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
