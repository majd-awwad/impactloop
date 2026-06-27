import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { hashPassword } from '../../src/utils/password.js';

const SEED_PASSWORD = 'SupplierPassword123!';

export type SeedSupplierVerificationsResult = {
  seeded: string[];
  mode: 'created' | 'updated' | 'skipped';
};

type VerificationSeed = {
  email: string;
  displayName: string;
  supplierType: 'WORKSHOP' | 'FACTORY' | 'EDUCATIONAL_INSTITUTION';
  organizationName: string;
  city: string;
  area: string;
  verificationStatus: string;
  verificationDocumentStatus:
    | 'PENDING'
    | 'VERIFIED'
    | 'REJECTED'
    | 'CHANGES_REQUESTED';
  adminNote?: string;
  documentUrl?: string;
  documentName?: string;
};

const VERIFICATION_SEEDS: VerificationSeed[] = [
  {
    email: 'workshop.verify.pending@impactloop.test',
    displayName: 'Pending Workshop Owner',
    supplierType: 'WORKSHOP',
    organizationName: 'Nablus Makers Workshop',
    city: 'Nablus',
    area: 'Old City',
    verificationStatus: 'PENDING',
    verificationDocumentStatus: 'PENDING',
    documentUrl: 'https://example.com/docs/workshop-license.pdf',
    documentName: 'workshop-license.pdf',
  },
  {
    email: 'factory.verify.pending@impactloop.test',
    displayName: 'Pending Factory Owner',
    supplierType: 'FACTORY',
    organizationName: 'Ramallah Industrial Factory',
    city: 'Ramallah',
    area: 'Industrial Zone',
    verificationStatus: 'PENDING',
    verificationDocumentStatus: 'PENDING',
    documentUrl: 'https://example.com/docs/factory-registration.pdf',
    documentName: 'factory-registration.pdf',
  },
  {
    email: 'university.verify.approved@impactloop.test',
    displayName: 'Approved University Owner',
    supplierType: 'EDUCATIONAL_INSTITUTION',
    organizationName: 'Birzeit University Lab',
    city: 'Birzeit',
    area: 'Campus',
    verificationStatus: 'APPROVED',
    verificationDocumentStatus: 'VERIFIED',
    documentUrl: 'https://example.com/docs/university-charter.pdf',
    documentName: 'university-charter.pdf',
  },
  {
    email: 'workshop.verify.changes@impactloop.test',
    displayName: 'Changes Requested Workshop Owner',
    supplierType: 'WORKSHOP',
    organizationName: 'Hebron Community Workshop',
    city: 'Hebron',
    area: 'Downtown',
    verificationStatus: 'CHANGES_REQUESTED',
    verificationDocumentStatus: 'CHANGES_REQUESTED',
    adminNote: 'Please upload a clearer business registration document.',
    documentUrl: 'https://example.com/docs/workshop-id-blurry.pdf',
    documentName: 'workshop-id-blurry.pdf',
  },
];

async function ensureVerificationSupplier(
  prisma: PrismaClient,
  seed: VerificationSeed,
) {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const submittedAt = new Date('2026-06-01T10:00:00.000Z');
  const reviewedAt =
    seed.verificationStatus === 'VERIFIED' ||
    seed.verificationStatus === 'REJECTED'
      ? new Date('2026-06-10T12:00:00.000Z')
      : null;

  let user = await prisma.user.findUnique({
    where: { email: seed.email },
    include: {
      supplierProfile: {
        include: {
          organizationProfile: true,
        },
      },
      roles: true,
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        displayName: seed.displayName,
        email: seed.email,
        passwordHash,
        accountStatus: 'ACTIVE',
        emailVerifiedAt: new Date(),
        roles: {
          create: [{ role: 'SUPPLIER', isPrimary: true }],
        },
        supplierProfile: {
          create: {
            supplierType: seed.supplierType,
            publicName: seed.organizationName,
            description: `${seed.organizationName} official supplier profile.`,
            verificationStatus: seed.verificationStatus,
            verificationSubmittedAt: submittedAt,
            verificationReviewedAt: reviewedAt,
            verificationAdminNote: seed.adminNote ?? null,
            defaultPickupLocation: {
              create: {
                country: 'Palestine',
                city: seed.city,
                area: seed.area,
                addressLine: `${seed.area} Street`,
                visibility: 'PRIVATE',
                isApproximate: true,
                locationType: 'PICKUP_POINT',
              },
            },
            organizationProfile: {
              create: {
                organizationName: seed.organizationName,
                organizationType: seed.supplierType,
                contactPersonName: seed.displayName,
                verificationDocumentStatus: seed.verificationDocumentStatus,
                verificationDocumentUrl: seed.documentUrl ?? null,
                verificationDocumentName: seed.documentName ?? null,
                businessLocation: {
                  create: {
                    country: 'Palestine',
                    city: seed.city,
                    area: seed.area,
                    addressLine: `${seed.area} Business Address`,
                    visibility: 'PRIVATE',
                    isApproximate: true,
                    locationType: 'BUSINESS_LOCATION',
                  },
                },
              },
            },
          },
        },
      },
      include: {
        supplierProfile: {
          include: {
            organizationProfile: true,
          },
        },
        roles: true,
      },
    });

    return 'created';
  }

  const hasSupplierRole = user.roles.some((role) => role.role === 'SUPPLIER');
  if (!hasSupplierRole) {
    await prisma.userRoleAssignment.create({
      data: {
        userId: user.id,
        role: 'SUPPLIER',
        isPrimary: user.roles.length === 0,
      },
    });
  }

  if (!user.supplierProfile) {
    await prisma.supplierProfile.create({
      data: {
        userId: user.id,
        supplierType: seed.supplierType,
        publicName: seed.organizationName,
        description: `${seed.organizationName} official supplier profile.`,
        verificationStatus: seed.verificationStatus,
        verificationSubmittedAt: submittedAt,
        verificationReviewedAt: reviewedAt,
        verificationAdminNote: seed.adminNote ?? null,
      },
    });
    return 'updated';
  }

  await prisma.supplierProfile.update({
    where: { id: user.supplierProfile.id },
    data: {
      supplierType: seed.supplierType,
      publicName: seed.organizationName,
      verificationStatus: seed.verificationStatus,
      verificationSubmittedAt: submittedAt,
      verificationReviewedAt: reviewedAt,
      verificationAdminNote: seed.adminNote ?? null,
    },
  });

  const organization = user.supplierProfile.organizationProfile;
  if (organization) {
    await prisma.organizationProfile.update({
      where: { id: organization.id },
      data: {
        organizationName: seed.organizationName,
        organizationType: seed.supplierType,
        verificationDocumentStatus: seed.verificationDocumentStatus,
        verificationDocumentUrl: seed.documentUrl ?? null,
        verificationDocumentName: seed.documentName ?? null,
      },
    });
  } else {
    await prisma.organizationProfile.create({
      data: {
        supplierProfileId: user.supplierProfile.id,
        organizationName: seed.organizationName,
        organizationType: seed.supplierType,
        contactPersonName: seed.displayName,
        verificationDocumentStatus: seed.verificationDocumentStatus,
        verificationDocumentUrl: seed.documentUrl ?? null,
        verificationDocumentName: seed.documentName ?? null,
        businessLocation: {
          create: {
            country: 'Palestine',
            city: seed.city,
            area: seed.area,
            addressLine: `${seed.area} Business Address`,
            visibility: 'PRIVATE',
            isApproximate: true,
            locationType: 'BUSINESS_LOCATION',
          },
        },
      },
    });
  }

  return 'updated';
}

export async function seedSupplierVerifications(
  prisma: PrismaClient,
): Promise<SeedSupplierVerificationsResult> {
  const seeded: string[] = [];

  for (const seed of VERIFICATION_SEEDS) {
    const mode = await ensureVerificationSupplier(prisma, seed);
    seeded.push(`${seed.email}:${mode}`);
  }

  return {
    seeded,
    mode: seeded.length > 0 ? 'created' : 'skipped',
  };
}
