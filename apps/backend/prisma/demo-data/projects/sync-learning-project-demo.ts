/**
 * PROJECT-DATA-01 — idempotent Learning Project demo sync.
 *
 * Stable identity: ProjectTag `demo-project-key:<key>` (e.g. demo-project-key:simple-led-circuit).
 *
 * Usage:
 *   npm run demo:seed:projects -w apps/backend
 *   npm run demo:seed:projects -w apps/backend -- --stamp-keys --archive-tests
 *   npm run demo:seed:projects -w apps/backend -- --sync-covers
 */
import { prisma } from '../../../src/database/prisma.js';
import { assertLocalDemoDatabaseUrl } from '../../../scripts/lib/local-database-guard.mjs';
import { LEGACY_PROJECT_COVERS } from './legacy-project-covers.data.js';
import { validateLegacyProjectCovers } from './validate-legacy-project-covers.js';

const DEMO_KEY_PREFIX = 'demo-project-key:';
const TEST = '[test-learning-project-material-allocation]';
const PROJECT_DATA_03_BATCH_TAG = 'project-data-03';

/** Catalog keys matching prisma/seed.ts PROJECTS[].key + title. */
export const DEMO_PROJECT_CATALOG: ReadonlyArray<{ key: string; title: string }> = [
  { key: 'obstacle-avoidance-robot', title: 'Obstacle Avoidance Robot' },
  { key: 'simple-led-circuit', title: 'Simple LED Circuit' },
  { key: 'recycled-desk-organizer', title: 'Recycled Cardboard Desk Organizer' },
  { key: 'mini-wooden-phone-stand', title: 'Mini Wooden Phone Stand' },
  { key: 'mini-greenhouse-prototype', title: 'Mini Greenhouse Prototype' },
  { key: 'fabric-pencil-case', title: 'Fabric Pencil Case' },
  { key: 'rubber-band-powered-car', title: 'Rubber Band Powered Car' },
  { key: 'line-follower-robot', title: 'Line Follower Robot' },
  { key: 'smart-plant-monitor', title: 'Smart Plant Moisture Monitor' },
  { key: 'automatic-night-light', title: 'Automatic Night Light' },
  { key: 'temperature-humidity-station', title: 'Temperature and Humidity Station' },
  { key: 'servo-distance-scanner', title: 'Servo Distance Scanner' },
  { key: 'electronic-dice', title: 'Electronic LED Dice' },
  { key: 'water-level-alarm', title: 'Water Level Alarm' },
  { key: 'portable-usb-fan', title: 'Portable USB Cooling Fan' },
  { key: 'patchwork-tote-bag', title: 'Patchwork Tote Bag' },
  { key: 'bottle-cap-mosaic', title: 'Bottle Cap Mosaic Board' },
  { key: 'glass-jar-herb-planter', title: 'Glass Jar Herb Planter' },
  { key: 'cardboard-marble-run', title: 'Cardboard Marble Run' },
  { key: 'tin-can-lantern', title: 'Decorated Tin Can Lantern' },
  { key: 'felt-phone-sleeve', title: 'Felt Phone Sleeve' },
  { key: 'yarn-wall-hanging', title: 'Reused Yarn Wall Hanging' },
  { key: 'egg-carton-seed-starter', title: 'Egg Carton Seed Starter' },
  { key: 'small-wall-shelf', title: 'Small Reclaimed Wood Wall Shelf' },
  { key: 'reclaimed-wood-birdhouse', title: 'Reclaimed Wood Birdhouse' },
  { key: 'plywood-laptop-stand', title: 'Plywood Laptop Stand' },
  { key: 'wooden-tool-caddy', title: 'Wooden Tool Caddy' },
  { key: 'pvc-plant-stand', title: 'PVC Plant Stand' },
  { key: 'acrylic-display-box', title: 'Acrylic Display Box' },
  { key: 'rolling-storage-crate', title: 'Rolling Workshop Storage Crate' },
];

const stampKeys = async () => {
  let stamped = 0;
  let missing = 0;
  for (const entry of DEMO_PROJECT_CATALOG) {
    const project = await prisma.learningProject.findFirst({
      where: {
        title: entry.title,
        NOT: { title: { contains: TEST } },
      },
      select: {
        id: true,
        tags: { select: { tag: true } },
      },
    });
    if (!project) {
      missing += 1;
      continue;
    }
    const tag = `${DEMO_KEY_PREFIX}${entry.key}`;
    if (project.tags.some((t) => t.tag === tag)) continue;
    await prisma.projectTag.create({
      data: { projectId: project.id, tag },
    });
    stamped += 1;
  }
  return { stamped, missing, catalog: DEMO_PROJECT_CATALOG.length };
};

const softArchiveTestPollution = async () => {
  const result = await prisma.learningProject.updateMany({
    where: {
      OR: [
        { title: { contains: TEST } },
        { category: { nameEn: { contains: TEST } } },
      ],
      archivedAt: null,
    },
    data: {
      status: 'ARCHIVED',
      archivedAt: new Date(),
      hiddenAt: new Date(),
      archivedReason: 'PROJECT-DATA-01: archive leftover test pollution',
    },
  });
  await prisma.category.updateMany({
    where: { nameEn: { contains: TEST } },
    data: { isActive: false },
  });
  return result.count;
};

/**
 * Cover-only upsert for the original 30 catalog projects.
 * Does not create projects, rewrite content, or touch PROJECT-DATA-03.
 */
const syncCatalogCovers = async () => {
  const validation = await validateLegacyProjectCovers();
  if (validation.failed.length > 0) {
    throw new Error(
      `Cover validation failed for ${validation.failed.length} URL(s): ${validation.failed
        .map((f) => `${f.key} (${f.error})`)
        .join('; ')}`,
    );
  }

  let updated = 0;
  let unchanged = 0;
  let missing = 0;
  let duplicateImagesRemoved = 0;
  const results: Array<{
    key: string;
    action: 'updated' | 'unchanged' | 'missing';
    coverImageUrl: string;
    imagesBefore: number;
    imagesAfter: number;
  }> = [];

  for (const entry of DEMO_PROJECT_CATALOG) {
    const coverImageUrl = LEGACY_PROJECT_COVERS[entry.key];
    if (!coverImageUrl) {
      throw new Error(`Missing LEGACY_PROJECT_COVERS entry for ${entry.key}`);
    }

    const identityTag = `${DEMO_KEY_PREFIX}${entry.key}`;
    const existing = await prisma.learningProject.findFirst({
      where: {
        tags: { some: { tag: identityTag } },
        NOT: { tags: { some: { tag: PROJECT_DATA_03_BATCH_TAG } } },
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        tags: { select: { tag: true } },
      },
    });

    if (!existing) {
      missing += 1;
      results.push({
        key: entry.key,
        action: 'missing',
        coverImageUrl,
        imagesBefore: 0,
        imagesAfter: 0,
      });
      continue;
    }

    const imagesBefore = existing.images.length;
    const coverUnchanged = existing.coverImageUrl === coverImageUrl;
    const uniqueOtherUrls = [
      ...new Set(
        existing.images
          .map((img) => img.imageUrl.trim())
          .filter((url) => url.length > 0 && url !== coverImageUrl),
      ),
    ];
    // Drop exact duplicates of the (new) cover; keep distinct secondary gallery URLs.
    const desiredGallery = [
      coverImageUrl,
      ...uniqueOtherUrls.filter((url) => url !== existing.coverImageUrl),
    ];
    // If the only "other" URLs were the previous cover (possibly duplicated), gallery is just primary.
    const desiredNormalized = desiredGallery.length > 0 ? desiredGallery : [coverImageUrl];
    const currentGallery = existing.images.map((img) => img.imageUrl);
    const galleryUnchanged =
      currentGallery.length === desiredNormalized.length &&
      currentGallery.every((url, index) => url === desiredNormalized[index]);

    if (coverUnchanged && galleryUnchanged) {
      unchanged += 1;
      results.push({
        key: entry.key,
        action: 'unchanged',
        coverImageUrl,
        imagesBefore,
        imagesAfter: imagesBefore,
      });
      continue;
    }

    await prisma.$transaction(async (tx) => {
      await tx.learningProject.update({
        where: { id: existing.id },
        data: { coverImageUrl },
      });

      await tx.projectImage.deleteMany({ where: { projectId: existing.id } });
      await tx.projectImage.createMany({
        data: desiredNormalized.map((imageUrl, sortOrder) => ({
          projectId: existing.id,
          imageUrl,
          sortOrder,
        })),
      });
    });

    duplicateImagesRemoved += Math.max(0, imagesBefore - desiredNormalized.length);
    updated += 1;
    results.push({
      key: entry.key,
      action: 'updated',
      coverImageUrl,
      imagesBefore,
      imagesAfter: desiredNormalized.length,
    });
  }

  return {
    validated: validation.okCount,
    validationFailed: validation.failed.length,
    catalog: DEMO_PROJECT_CATALOG.length,
    updated,
    unchanged,
    missing,
    duplicateImagesRemoved,
    results,
  };
};

const main = async () => {
  // Fail-closed before stamp/archive/cover mutations (same local-host policy as
  // other additive demo seeders).
  assertLocalDemoDatabaseUrl(
    process.env.DATABASE_URL,
    'learning project demo sync',
  );

  const args = new Set(process.argv.slice(2));
  const syncCoversOnly = args.has('--sync-covers');
  const doStamp =
    args.has('--stamp-keys') || (!syncCoversOnly && args.size === 0);
  const doArchive =
    args.has('--archive-tests') || (!syncCoversOnly && args.size === 0);
  const doCovers = syncCoversOnly || args.has('--sync-covers');

  const report: Record<string, unknown> = {
    mode: 'sync-learning-project-demo',
    identity: `${DEMO_KEY_PREFIX}<key>`,
  };

  if (doArchive) {
    report.archivedTestProjects = await softArchiveTestPollution();
  }
  if (doStamp) {
    report.stamp = await stampKeys();
  }
  if (doCovers) {
    report.covers = await syncCatalogCovers();
  }

  const published = await prisma.learningProject.count({
    where: {
      status: 'PUBLISHED',
      archivedAt: null,
      hiddenAt: null,
      NOT: { title: { contains: TEST } },
    },
  });
  const tagged = await prisma.projectTag.count({
    where: { tag: { startsWith: DEMO_KEY_PREFIX } },
  });
  const community = await prisma.material.count({
    where: { tags: { some: { tag: 'community-demo' } } },
  });

  report.publishedRealProjects = published;
  report.demoProjectKeysTagged = tagged;
  report.communityMaterials = community;

  console.log(JSON.stringify(report, null, 2));
};

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
