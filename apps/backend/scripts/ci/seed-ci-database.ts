import { prisma } from '../../database/prisma.js';
import { seedCategoryTaxonomyOwnership } from '../../modules/taxonomy/category-taxonomy-ownership.seed.js';
import { seedTaxonomyCompatibilityRelations } from '../../modules/taxonomy/taxonomy-compatibility-relations.seed.js';
import { seedTaxonomyFoundation } from '../../modules/taxonomy/taxonomy-foundation.repository.js';
import { hashPassword } from '../../utils/password.js';

const CI_MARKER = '[ci-database-seed]';

const fail = (message: string): never => {
  console.error(`seed-ci-database: ${message}`);
  process.exit(1);
};

const assertCiDatabaseMode = () => {
  if (process.env.NODE_ENV !== 'test') {
    fail('NODE_ENV must be exactly "test" for CI database seeding.');
  }
  if (process.env.IMPACTLOOP_CI_DATABASE !== '1') {
    fail('IMPACTLOOP_CI_DATABASE must be exactly "1" to authorize CI database seeding.');
  }
  if (!process.env.DATABASE_URL?.trim()) {
    fail('DATABASE_URL is required for CI database seeding.');
  }
};

const ensureMaterialCategories = async () => {
  const existing = await prisma.category.count({
    where: { categoryType: { in: ['MATERIAL', 'BOTH'] }, isActive: true },
  });
  if (existing > 0) {
    return existing;
  }

  await prisma.category.create({
    data: {
      nameEn: `${CI_MARKER} Electronics`,
      nameAr: `${CI_MARKER} إلكترونيات`,
      categoryType: 'BOTH',
      isActive: true,
    },
  });

  return 1;
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

const main = async () => {
  assertCiDatabaseMode();

  await seedTaxonomyFoundation();
  await seedCategoryTaxonomyOwnership();
  await seedTaxonomyCompatibilityRelations();

  const materialCategories = await ensureMaterialCategories();
  const learnersCreated = await ensureLearners();
  const driverCreated = await ensureEligibleDriver();

  console.log(
    JSON.stringify(
      {
        seed: 'ci-database',
        status: 'ok',
        materialCategories,
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
