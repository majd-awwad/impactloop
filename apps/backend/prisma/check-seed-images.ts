import { prisma } from '../src/database/prisma.js';

type ImageRecord = {
  source: 'material' | 'project-cover' | 'project-image';
  owner: string;
  url: string;
};

const REQUEST_TIMEOUT_MS = 12_000;
const CONCURRENCY = 8;

const checkUrl = async (record: ImageRecord) => {
  if (!record.url.startsWith('https://')) {
    return { ...record, ok: false, status: null, error: 'URL is not HTTPS' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response = await fetch(record.url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
    });

    // Some image CDNs do not support HEAD consistently.
    if (response.status === 405 || response.status === 403) {
      response = await fetch(record.url, {
        method: 'GET',
        headers: { Range: 'bytes=0-1023' },
        redirect: 'follow',
        signal: controller.signal,
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    return {
      ...record,
      ok: response.ok && contentType.startsWith('image/'),
      status: response.status,
      contentType,
      finalUrl: response.url,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ...record,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const runPool = async <T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runner = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(concurrency, items.length) },
      () => runner(),
    ),
  );

  return results;
};

const main = async () => {
  const materials = await prisma.material.findMany({
    select: {
      title: true,
      images: {
        select: { imageUrl: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  const projects = await prisma.learningProject.findMany({
    select: {
      title: true,
      coverImageUrl: true,
      images: {
        select: { imageUrl: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  });

  const materialsWithoutImages = materials
    .filter((material) => material.images.length === 0)
    .map((material) => material.title);

  const projectsWithoutCovers = projects
    .filter((project) => !project.coverImageUrl)
    .map((project) => project.title);

  const records: ImageRecord[] = [
    ...materials.flatMap((material) =>
      material.images.map((image) => ({
        source: 'material' as const,
        owner: material.title,
        url: image.imageUrl,
      })),
    ),
    ...projects.flatMap((project) => [
      ...(project.coverImageUrl
        ? [{
            source: 'project-cover' as const,
            owner: project.title,
            url: project.coverImageUrl,
          }]
        : []),
      ...project.images.map((image) => ({
        source: 'project-image' as const,
        owner: project.title,
        url: image.imageUrl,
      })),
    ]),
  ];

  const uniqueRecords = [
    ...new Map(records.map((record) => [record.url, record])).values(),
  ];

  console.log(`Materials: ${materials.length}`);
  console.log(`Projects: ${projects.length}`);
  console.log(`Unique remote image URLs: ${uniqueRecords.length}`);

  if (materialsWithoutImages.length > 0) {
    console.error('\nMaterials missing MaterialImage rows:');
    for (const title of materialsWithoutImages) console.error(`- ${title}`);
  }

  if (projectsWithoutCovers.length > 0) {
    console.error('\nProjects missing coverImageUrl:');
    for (const title of projectsWithoutCovers) console.error(`- ${title}`);
  }

  const results = await runPool(
    uniqueRecords,
    checkUrl,
    CONCURRENCY,
  );

  const failed = results.filter((result) => !result.ok);

  if (failed.length === 0 &&
      materialsWithoutImages.length === 0 &&
      projectsWithoutCovers.length === 0) {
    console.log('\nAll seeded image records and remote URLs passed.');
    return;
  }

  if (failed.length > 0) {
    console.error(`\nBroken or non-image URLs (${failed.length}):`);
    for (const result of failed) {
      console.error(
        `- [${result.source}] ${result.owner}: ${result.url} (${result.error ?? result.status})`,
      );
    }
  }

  process.exitCode = 1;
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
