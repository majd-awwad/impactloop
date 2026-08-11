/**
 * Additive Project Budget demo preparation.
 *
 * Ensures core-seed Majd materials needed for Obstacle Avoidance Robot budget
 * estimation remain AVAILABLE. Requires a prior `prisma:seed` (supplier + project
 * + catalog materials). Does not truncate the database.
 *
 * Usage:
 *   npm run demo:seed:project-budget -w apps/backend
 */
import { prisma } from '../../src/database/prisma.js';
import { assertLocalDemoDatabaseUrl } from '../../scripts/lib/local-database-guard.mjs';

const PROJECT_TITLE = 'Obstacle Avoidance Robot';
const SUPPLIER_EMAIL = 'majd@supplier.com';

/** Titles created by core prisma/seed for the project-budget demo set. */
const PROJECT_BUDGET_MATERIAL_TITLES = [
  'Salvaged Arduino Uno Boards',
  'Arduino Uno R3 Boards',
  'Free Workshop Ultrasonic Sensors',
  'HC-SR04 Ultrasonic Sensors',
  'Surplus DC Gear Motors',
  'Small DC Gear Motors Pair',
  'Community Jumper Wire Pieces',
  'Assorted Jumper Wires Bundle',
] as const;

const main = async () => {
  assertLocalDemoDatabaseUrl(
    process.env.DATABASE_URL,
    'project budget demo seeding',
  );

  const supplierUser = await prisma.user.findUnique({
    where: { email: SUPPLIER_EMAIL },
    select: { id: true },
  });
  if (!supplierUser) {
    throw new Error(
      `Missing ${SUPPLIER_EMAIL}. Run npm run prisma:seed first, then retry demo:seed:project-budget.`,
    );
  }

  const project = await prisma.learningProject.findFirst({
    where: {
      title: PROJECT_TITLE,
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
    },
    select: { id: true, title: true },
  });
  if (!project) {
    throw new Error(
      `Missing published project "${PROJECT_TITLE}". Run npm run prisma:seed first.`,
    );
  }

  const results: Array<{ title: string; id: string; status: string }> = [];
  for (const title of PROJECT_BUDGET_MATERIAL_TITLES) {
    const material = await prisma.material.findFirst({
      where: { ownerId: supplierUser.id, title },
      select: { id: true, status: true },
    });
    if (!material) {
      throw new Error(
        `Missing Majd material "${title}". Run npm run prisma:seed first.`,
      );
    }
    if (material.status !== 'AVAILABLE') {
      await prisma.material.update({
        where: { id: material.id },
        data: { status: 'AVAILABLE' },
      });
    }
    results.push({ title, id: material.id, status: 'AVAILABLE' });
  }

  console.log(
    JSON.stringify(
      {
        mode: 'demo:seed:project-budget',
        projectId: project.id,
        projectTitle: project.title,
        supplierEmail: SUPPLIER_EMAIL,
        materialsEnsured: results.length,
        materialIds: results.map((row) => row.id),
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
