import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  OrganizationType,
  PrismaClient,
} from "../../src/generated/prisma/client.js";
import { prisma } from "../../src/database/prisma.js";
import { assertLocalDemoDatabaseUrl } from "../../scripts/lib/local-database-guard.mjs";
import { hashPassword } from "../../src/utils/password.js";
import {
  COMMUNITY_DEMO_PEOPLE,
  type CommunityDemoPerson,
} from "./community-demo-people.data.js";
import {
  resolveCommunityDemoProfileImageUrl,
  resolveCommunityDemoSupplierCoverImageUrl,
} from "./visual-assets/manifests/demo-people-images.data.js";

const SEED_PASSWORD = "password";
const ORGANIZATION_TYPES = new Set<OrganizationType>([
  "WORKSHOP",
  "FACTORY",
  "EDUCATIONAL_INSTITUTION",
]);

export type SeedCommunityDemoPeopleResult = {
  dataset: "community-demo-people";
  passwordForCreatedAccounts: string;
  sourceRows: number;
  created: number;
  skippedExistingEmails: number;
  skippedExistingPhones: number;
  createdSuppliers: number;
  createdOrganizations: number;
  createdIndividualSuppliers: number;
  createdLearners: number;
  note: string;
};

const resolveOrganizationType = (
  person: CommunityDemoPerson,
): OrganizationType => {
  if (!ORGANIZATION_TYPES.has(person.organizationType as OrganizationType)) {
    throw new Error(
      `Invalid organizationType "${person.organizationType}" for ${person.email}.`,
    );
  }

  return person.organizationType as OrganizationType;
};

const seedLearner = async (
  db: PrismaClient,
  person: CommunityDemoPerson,
  passwordHash: string,
) => {
  const createdAt = new Date(`${person.createdAt}T10:00:00.000Z`);

  const user = await db.user.create({
    data: {
      displayName: person.displayName,
      email: person.email,
      phone: person.phone,
      passwordHash,
      accountStatus: "ACTIVE",
      activeRole: "LEARNER",
      emailVerifiedAt: createdAt,
      recommendationEvidenceEligibility: "EXCLUDED_DEMO",
      profileImageUrl: resolveCommunityDemoProfileImageUrl(person.email),
      createdAt,
      roles: {
        create: [{ role: "LEARNER", isPrimary: true, createdAt }],
      },
      learnerProfile: {
        create: {
          learnerType: person.learnerType || null,
          bio: person.learnerBio || null,
          interests: [...person.interests],
          skillLevel: person.skillLevel || null,
          createdAt,
        },
      },
    },
    select: { id: true },
  });

  const location = await db.location.create({
    data: {
      country: "Palestine",
      city: person.city,
      area: person.area,
      addressLine: `${person.area} - موقع تقريبي للديمو`,
      latitude: person.latitude,
      longitude: person.longitude,
      locationType: "DROPOFF",
      visibility: "PRIVATE",
      isApproximate: true,
      createdAt,
    },
    select: { id: true },
  });

  await db.userSavedLocation.create({
    data: {
      userId: user.id,
      locationId: location.id,
      label: "الموقع الافتراضي",
      isDefault: true,
      createdAt,
    },
  });
};

const seedSupplier = async (
  db: PrismaClient,
  person: CommunityDemoPerson,
  passwordHash: string,
) => {
  const createdAt = new Date(`${person.createdAt}T10:00:00.000Z`);
  const isOrganization = person.supplierKind === "ORGANIZATION";

  await db.user.create({
    data: {
      displayName: person.displayName,
      email: person.email,
      phone: person.phone,
      passwordHash,
      accountStatus: "ACTIVE",
      activeRole: "SUPPLIER",
      emailVerifiedAt: createdAt,
      recommendationEvidenceEligibility: "EXCLUDED_DEMO",
      profileImageUrl: resolveCommunityDemoProfileImageUrl(person.email),
      createdAt,
      roles: {
        create: [{ role: "SUPPLIER", isPrimary: true, createdAt }],
      },
      supplierProfile: {
        create: {
          supplierType: person.supplierType || "INDIVIDUAL_SUPPLIER",
          publicName: person.publicName || person.displayName,
          description: person.description || null,
          avatarImageUrl: resolveCommunityDemoProfileImageUrl(person.email),
          coverImageUrl:
            person.supplierKind === "ORGANIZATION"
              ? resolveCommunityDemoSupplierCoverImageUrl(person.email)
              : null,
          verificationStatus: "APPROVED",
          verificationSubmittedAt: createdAt,
          verificationReviewedAt: createdAt,
          createdAt,
          defaultPickupLocation: {
            create: {
              country: "Palestine",
              city: person.city,
              area: person.area,
              addressLine: `${person.area} - نقطة استلام تقريبية للديمو`,
              latitude: person.latitude,
              longitude: person.longitude,
              locationType: "PICKUP_POINT",
              visibility: "PUBLIC_APPROXIMATE",
              isApproximate: true,
              createdAt,
            },
          },
          ...(isOrganization
            ? {
                organizationProfile: {
                  create: {
                    organizationName: person.organizationName,
                    organizationType: resolveOrganizationType(person),
                    contactPersonName:
                      person.contactPersonName.length > 0
                        ? person.contactPersonName
                        : person.displayName,
                    workingDays: [
                      "SUNDAY",
                      "MONDAY",
                      "TUESDAY",
                      "WEDNESDAY",
                      "THURSDAY",
                    ],
                    workingHours: { start: "09:00", end: "17:00" },
                    // Demo usability status only — no fake verification documents.
                    verificationDocumentStatus: "VERIFIED" as const,
                    verificationDocumentUrl: null,
                    verificationDocumentName: null,
                    createdAt,
                    businessLocation: {
                      create: {
                        country: "Palestine",
                        city: person.city,
                        area: person.area,
                        addressLine: `${person.area} - موقع عمل تقريبي للديمو`,
                        latitude: person.latitude,
                        longitude: person.longitude,
                        locationType: "BUSINESS_LOCATION",
                        visibility: "PRIVATE",
                        isApproximate: true,
                        createdAt,
                      },
                    },
                  },
                },
              }
            : {}),
        },
      },
    },
    select: { id: true },
  });
};

export const seedCommunityDemoPeople = async (
  db: PrismaClient = prisma,
): Promise<SeedCommunityDemoPeopleResult> => {
  assertLocalDemoDatabaseUrl(
    process.env.DATABASE_URL,
    "community demo people seeding",
  );

  if (COMMUNITY_DEMO_PEOPLE.length !== 100) {
    throw new Error(
      `Expected 100 community demo people, found ${COMMUNITY_DEMO_PEOPLE.length}.`,
    );
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);
  let created = 0;
  let skippedExistingEmails = 0;
  let skippedExistingPhones = 0;
  let suppliers = 0;
  let organizations = 0;
  let learners = 0;

  for (const person of COMMUNITY_DEMO_PEOPLE) {
    const existingByEmail = await db.user.findUnique({
      where: { email: person.email },
      select: { id: true },
    });

    if (existingByEmail) {
      skippedExistingEmails += 1;
      continue;
    }

    const existingByPhone = await db.user.findUnique({
      where: { phone: person.phone },
      select: { id: true },
    });

    if (existingByPhone) {
      skippedExistingPhones += 1;
      continue;
    }

    if (person.platformRole === "SUPPLIER") {
      await seedSupplier(db, person, passwordHash);
      suppliers += 1;
      if (person.supplierKind === "ORGANIZATION") {
        organizations += 1;
      }
    } else {
      // Dataset only contains SUPPLIER | LEARNER; volunteers map to individual suppliers.
      await seedLearner(db, person, passwordHash);
      learners += 1;
    }

    created += 1;
  }

  return {
    dataset: "community-demo-people",
    passwordForCreatedAccounts: SEED_PASSWORD,
    sourceRows: COMMUNITY_DEMO_PEOPLE.length,
    created,
    skippedExistingEmails,
    skippedExistingPhones,
    createdSuppliers: suppliers,
    createdOrganizations: organizations,
    createdIndividualSuppliers: suppliers - organizations,
    createdLearners: learners,
    note: "sourcePoints is preserved in the canonical CSV/data module only; the current Prisma schema has no user points field.",
  };
};

const isDirectRun = () => {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }

  try {
    return (
      path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url))
    );
  } catch {
    return false;
  }
};

if (isDirectRun()) {
  try {
    const result = await seedCommunityDemoPeople();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
