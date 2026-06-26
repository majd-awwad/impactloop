import type { Prisma } from '../../generated/prisma/index.js';

import { prisma } from '../../database/prisma.js';

const verificationInclude = {
  user: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phone: true,
    },
  },
  defaultPickupLocation: true,
  organizationProfile: {
    include: {
      businessLocation: true,
    },
  },
} satisfies Prisma.SupplierProfileInclude;

export const findSupplierVerificationContext = async (userId: string) => {
  return prisma.supplierProfile.findUnique({
    where: { userId },
    include: verificationInclude,
  });
};

export const upsertLocation = async (
  tx: Prisma.TransactionClient,
  existingLocationId: string | null | undefined,
  location: {
    country: string;
    city: string;
    area: string;
    addressLine?: string | null;
  },
  locationType: string,
) => {
  if (existingLocationId) {
    return tx.location.update({
      where: { id: existingLocationId },
      data: {
        country: location.country,
        city: location.city,
        area: location.area,
        addressLine: location.addressLine ?? null,
        locationType,
        visibility: 'PRIVATE',
        isApproximate: true,
      },
    });
  }

  return tx.location.create({
    data: {
      country: location.country,
      city: location.city,
      area: location.area,
      addressLine: location.addressLine ?? null,
      locationType,
      visibility: 'PRIVATE',
      isApproximate: true,
    },
  });
};

export const submitSupplierVerificationRecord = async (input: {
  userId: string;
  supplierType: string;
  publicName: string;
  description: string | null;
  phone: string | null;
  contactPersonName: string | null;
  defaultPickupLocation: {
    country: string;
    city: string;
    area: string;
    addressLine?: string | null;
  };
  businessLocation: {
    country: string;
    city: string;
    area: string;
    addressLine?: string | null;
  };
  verificationDocumentUrl: string;
  verificationDocumentName: string;
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplierProfile.findUnique({
      where: { userId: input.userId },
      include: {
        organizationProfile: true,
        defaultPickupLocation: true,
      },
    });

    const defaultPickupLocation = await upsertLocation(
      tx,
      existing?.defaultPickupLocationId,
      input.defaultPickupLocation,
      'PICKUP_POINT',
    );

    const supplierProfile = existing
      ? await tx.supplierProfile.update({
          where: { id: existing.id },
          data: {
            supplierType: input.supplierType,
            publicName: input.publicName,
            description: input.description,
            verificationStatus: 'PENDING',
            verificationSubmittedAt: new Date(),
            verificationReviewedAt: null,
            verificationReviewedById: null,
            verificationAdminNote: null,
            defaultPickupLocationId: defaultPickupLocation.id,
          },
        })
      : await tx.supplierProfile.create({
          data: {
            userId: input.userId,
            supplierType: input.supplierType,
            publicName: input.publicName,
            description: input.description,
            verificationStatus: 'PENDING',
            verificationSubmittedAt: new Date(),
            defaultPickupLocationId: defaultPickupLocation.id,
          },
        });

    const businessLocation = await upsertLocation(
      tx,
      existing?.organizationProfile?.businessLocationId,
      input.businessLocation,
      'BUSINESS_LOCATION',
    );

    await tx.organizationProfile.upsert({
      where: { supplierProfileId: supplierProfile.id },
      create: {
        supplierProfileId: supplierProfile.id,
        organizationName: input.publicName,
        organizationType: input.supplierType as
          | 'WORKSHOP'
          | 'FACTORY'
          | 'EDUCATIONAL_INSTITUTION',
        contactPersonName: input.contactPersonName,
        businessLocationId: businessLocation.id,
        verificationDocumentStatus: 'PENDING',
        verificationDocumentUrl: input.verificationDocumentUrl,
        verificationDocumentName: input.verificationDocumentName,
      },
      update: {
        organizationName: input.publicName,
        organizationType: input.supplierType as
          | 'WORKSHOP'
          | 'FACTORY'
          | 'EDUCATIONAL_INSTITUTION',
        contactPersonName: input.contactPersonName,
        businessLocationId: businessLocation.id,
        verificationDocumentStatus: 'PENDING',
        verificationDocumentUrl: input.verificationDocumentUrl,
        verificationDocumentName: input.verificationDocumentName,
      },
    });

    if (input.phone) {
      await tx.user.update({
        where: { id: input.userId },
        data: { phone: input.phone },
      });
    }

    return tx.supplierProfile.findUniqueOrThrow({
      where: { id: supplierProfile.id },
      include: verificationInclude,
    });
  });
};

export const resubmitSupplierVerificationRecord = async (input: {
  userId: string;
  verificationDocumentUrl: string;
  verificationDocumentName: string;
  organizationName?: string;
  description?: string | null;
  contactPersonName?: string | null;
  phone?: string | null;
  defaultPickupLocation?: {
    country: string;
    city: string;
    area: string;
    addressLine?: string | null;
  };
  businessLocation?: {
    country: string;
    city: string;
    area: string;
    addressLine?: string | null;
  };
}) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.supplierProfile.findUnique({
      where: { userId: input.userId },
      include: {
        organizationProfile: true,
        defaultPickupLocation: true,
      },
    });

    if (!existing?.organizationProfile) {
      throw new Error('Organization profile not found');
    }

    let defaultPickupLocationId = existing.defaultPickupLocationId;
    if (input.defaultPickupLocation) {
      const location = await upsertLocation(
        tx,
        existing.defaultPickupLocationId,
        input.defaultPickupLocation,
        'PICKUP_POINT',
      );
      defaultPickupLocationId = location.id;
    }

    let businessLocationId = existing.organizationProfile.businessLocationId;
    if (input.businessLocation) {
      const location = await upsertLocation(
        tx,
        existing.organizationProfile.businessLocationId,
        input.businessLocation,
        'BUSINESS_LOCATION',
      );
      businessLocationId = location.id;
    }

    await tx.supplierProfile.update({
      where: { id: existing.id },
      data: {
        publicName: input.organizationName ?? existing.publicName,
        description: input.description ?? existing.description,
        verificationStatus: 'PENDING',
        verificationSubmittedAt: new Date(),
        verificationReviewedAt: null,
        verificationReviewedById: null,
        verificationAdminNote: null,
        defaultPickupLocationId,
      },
    });

    await tx.organizationProfile.update({
      where: { id: existing.organizationProfile.id },
      data: {
        organizationName:
          input.organizationName ?? existing.organizationProfile.organizationName,
        contactPersonName:
          input.contactPersonName ??
          existing.organizationProfile.contactPersonName,
        businessLocationId,
        verificationDocumentStatus: 'PENDING',
        verificationDocumentUrl: input.verificationDocumentUrl,
        verificationDocumentName: input.verificationDocumentName,
      },
    });

    if (input.phone) {
      await tx.user.update({
        where: { id: input.userId },
        data: { phone: input.phone },
      });
    }

    return tx.supplierProfile.findUniqueOrThrow({
      where: { id: existing.id },
      include: verificationInclude,
    });
  });
};
