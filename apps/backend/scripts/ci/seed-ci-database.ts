import { prisma } from '../../src/database/prisma.js';
import { seedCategoryTaxonomyOwnership } from '../../src/modules/taxonomy/category-taxonomy-ownership.seed.js';
import { seedTaxonomyCompatibilityRelations } from '../../src/modules/taxonomy/taxonomy-compatibility-relations.seed.js';
import { seedTaxonomyFoundation } from '../../src/modules/taxonomy/taxonomy-foundation.repository.js';
import { hashPassword } from '../../src/utils/password.js';

const CI_MARKER = '[ci-database-seed]';

/** Must match `MATERIAL_CATEGORIES` / `PROJECT_CATEGORIES` in `prisma/seed.ts`. */
const MATERIAL_CATEGORIES = [
  { nameEn: 'Electronics & Components', nameAr: 'إلكترونيات وقطع إلكترونية' },
  { nameEn: 'Motors & Mechanical Parts', nameAr: 'محركات وقطع ميكانيكية' },
  { nameEn: 'Power & Batteries', nameAr: 'طاقة وبطاريات' },
  { nameEn: 'Wood & Boards', nameAr: 'خشب وألواح' },
  { nameEn: 'Plastics & Acrylic', nameAr: 'بلاستيك وأكريليك' },
  { nameEn: 'Metal & Fasteners', nameAr: 'معادن ومثبتات' },
  { nameEn: 'Fabric & Textiles', nameAr: 'أقمشة ومنسوجات' },
  { nameEn: 'Paper & Cardboard', nameAr: 'ورق وكرتون' },
  { nameEn: 'Tools & Hardware', nameAr: 'أدوات وعدد' },
  { nameEn: 'Art & Craft Supplies', nameAr: 'مستلزمات فن وحرف' },
  { nameEn: 'Packaging & Containers', nameAr: 'تغليف وحاويات' },
  { nameEn: 'Lab & Education Supplies', nameAr: 'مستلزمات مختبر وتعليم' },
  { nameEn: 'Other Reusable Materials', nameAr: 'مواد أخرى قابلة لإعادة الاستخدام' },
] as const;

const PROJECT_CATEGORIES = [
  { nameEn: 'Robotics', nameAr: 'روبوتات' },
  { nameEn: 'Electronics', nameAr: 'إلكترونيات' },
  { nameEn: 'Recycling Crafts', nameAr: 'حرف إعادة التدوير' },
  { nameEn: 'Woodworking', nameAr: 'أعمال خشبية' },
  { nameEn: 'Home Experiments', nameAr: 'تجارب منزلية' },
  { nameEn: 'Textile Crafts', nameAr: 'حرف نسيجية' },
] as const;

const fail = (message: string): never => {
  console.error(`seed-ci-database: ${message}`);
  process.exit(1);
};

const assertCiDatabaseMode = () => {
  if (process.env.NODE_ENV !== 'test') {
    fail('NODE_ENV must be exactly "test" for CI database seeding.');
  }
  const authorized =
    process.env.IMPACTLOOP_CI_DATABASE === '1'
    || process.env.IMPACTLOOP_TEST_DATABASE_SEED === '1';
  if (!authorized) {
    fail(
      'Set IMPACTLOOP_CI_DATABASE=1 (CI) or IMPACTLOOP_TEST_DATABASE_SEED=1 (local test DB) to authorize taxonomy seeding.',
    );
  }
  if (!process.env.DATABASE_URL?.trim()) {
    fail('DATABASE_URL is required for CI database seeding.');
  }
};

const ensureLegacyCategories = async () => {
  const testMode = process.env.IMPACTLOOP_TEST_DATABASE_SEED === '1';
  const materialCount = await prisma.category.count({
    where: { categoryType: 'MATERIAL', isActive: true, parentId: null },
  });
  const projectCount = await prisma.category.count({
    where: { categoryType: 'PROJECT', isActive: true, parentId: null },
  });

  if (
    materialCount === MATERIAL_CATEGORIES.length
    && projectCount === PROJECT_CATEGORIES.length
  ) {
    return { materialCount, projectCount, created: 0 };
  }

  if (testMode) {
    let created = 0;

    for (const category of MATERIAL_CATEGORIES) {
      const existing = await prisma.category.findFirst({
        where: {
          nameEn: category.nameEn,
          categoryType: 'MATERIAL',
          parentId: null,
        },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      await prisma.category.create({
        data: {
          nameEn: category.nameEn,
          nameAr: category.nameAr,
          categoryType: 'MATERIAL',
          isActive: true,
        },
      });
      created += 1;
    }

    for (const category of PROJECT_CATEGORIES) {
      const existing = await prisma.category.findFirst({
        where: {
          nameEn: category.nameEn,
          categoryType: 'PROJECT',
          parentId: null,
        },
        select: { id: true },
      });
      if (existing) {
        continue;
      }
      await prisma.category.create({
        data: {
          nameEn: category.nameEn,
          nameAr: category.nameAr,
          categoryType: 'PROJECT',
          isActive: true,
        },
      });
      created += 1;
    }

    return {
      materialCount: await prisma.category.count({
        where: { categoryType: 'MATERIAL', isActive: true, parentId: null },
      }),
      projectCount: await prisma.category.count({
        where: { categoryType: 'PROJECT', isActive: true, parentId: null },
      }),
      created,
    };
  }

  if (materialCount > 0 || projectCount > 0) {
    fail(
      `expected ${MATERIAL_CATEGORIES.length} material and ${PROJECT_CATEGORIES.length} project categories, found material=${materialCount}, project=${projectCount}`,
    );
  }

  for (const category of MATERIAL_CATEGORIES) {
    await prisma.category.create({
      data: {
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        categoryType: 'MATERIAL',
        isActive: true,
      },
    });
  }

  for (const category of PROJECT_CATEGORIES) {
    await prisma.category.create({
      data: {
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        categoryType: 'PROJECT',
        isActive: true,
      },
    });
  }

  return {
    materialCount: MATERIAL_CATEGORIES.length,
    projectCount: PROJECT_CATEGORIES.length,
    created: MATERIAL_CATEGORIES.length + PROJECT_CATEGORIES.length,
  };
};

const ensureLearners = async () => {
  const passwordHash = await hashPassword('CiTestPassword123!');
  let created = 0;

  for (let index = 1; index <= 3; index += 1) {
    const email = `ci-learner-${index}@impactloop.test`;
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    await prisma.user.create({
      data: {
        email,
        displayName: `${CI_MARKER} learner ${index}`,
        passwordHash,
        phone: `+9705900000${index}`,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: {
          create: [{ role: 'LEARNER', isPrimary: true }],
        },
        learnerProfile: {
          create: {
            learnerType: 'STUDENT',
            skillLevel: 'BEGINNER',
          },
        },
      },
    });
    created += 1;
  }

  return created;
};

const ensureEligibleDriver = async () => {
  const email = 'ci-driver@impactloop.test';
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return false;
  }

  const passwordHash = await hashPassword('CiTestPassword123!');
  await prisma.user.create({
    data: {
      email,
      displayName: `${CI_MARKER} driver`,
      passwordHash,
      phone: '+97059000099',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: 'DRIVER', isPrimary: true }],
      },
      driverProfile: {
        create: {
          displayName: `${CI_MARKER} driver`,
          phone: '+97059000099',
          city: 'Ramallah',
          area: 'Downtown',
          transportationType: 'BICYCLE',
          vehicleType: 'BICYCLE',
          status: 'ACTIVE',
          availability: 'AVAILABLE',
          acceptingNewJobs: true,
        },
      },
    },
  });

  return true;
};

const authoritativeLegacyCategoryNames = () => [
  ...MATERIAL_CATEGORIES.map((category) => category.nameEn),
  ...PROJECT_CATEGORIES.map((category) => category.nameEn),
];

const main = async () => {
  assertCiDatabaseMode();
  const testMode = process.env.IMPACTLOOP_TEST_DATABASE_SEED === '1';

  await seedTaxonomyFoundation();
  const legacyCategories = await ensureLegacyCategories();
  const categoryOwnership = await seedCategoryTaxonomyOwnership(
    testMode
      ? { onlyCategoryNamesEn: authoritativeLegacyCategoryNames() }
      : undefined,
  );
  await seedTaxonomyCompatibilityRelations();
  const learnersCreated = await ensureLearners();
  const driverCreated = await ensureEligibleDriver();

  console.log(
    JSON.stringify(
      {
        seed: 'ci-database',
        status: 'ok',
        legacyCategories,
        categoryOwnership,
        learnersCreated,
        driverCreated,
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
