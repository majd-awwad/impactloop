import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { SEED_ADMIN_EMAIL } from "./seed-admin.js";

export const SEED_ADMIN_DASHBOARD_MARKER = "[seed-admin-dashboard]";

const shouldForceReseed = (): boolean =>
  process.env.SEED_FORCE_ADMIN_DASHBOARD === "true";

export type SeedAdminDashboardResult = {
  skipped: boolean;
  forceApplied: boolean;
  categoryRequests: number;
  priceRequests: number;
  invitations: number;
  reusedMaterials: number;
};

export async function seedAdminDashboard(
  prisma: PrismaClient,
): Promise<SeedAdminDashboardResult> {
  const force = shouldForceReseed();

  const existing = await prisma.categoryRequest.findFirst({
    where: { requestedName: { startsWith: SEED_ADMIN_DASHBOARD_MARKER } },
    select: { id: true },
  });

  if (existing && !force) {
    return {
      skipped: true,
      forceApplied: false,
      categoryRequests: 0,
      priceRequests: 0,
      invitations: 0,
      reusedMaterials: 0,
    };
  }

  if (force) {
    await prisma.categoryRequest.deleteMany({
      where: { requestedName: { startsWith: SEED_ADMIN_DASHBOARD_MARKER } },
    });
    await prisma.priceRuleRequest.deleteMany({
      where: { materialName: { startsWith: SEED_ADMIN_DASHBOARD_MARKER } },
    });
    await prisma.roleInvitation.deleteMany({
      where: { targetEmail: { contains: "seed-admin-dashboard" } },
    });
    await prisma.material.deleteMany({
      where: { title: { startsWith: SEED_ADMIN_DASHBOARD_MARKER } },
    });
  }

  const admin = await prisma.user.findUnique({
    where: { email: SEED_ADMIN_EMAIL },
    select: { id: true },
  });

  const supplier = await prisma.user.findFirst({
    where: {
      roles: { some: { role: "SUPPLIER" } },
      supplierProfile: { isNot: null },
    },
    select: { id: true, supplierProfile: { select: { id: true } } },
    orderBy: { createdAt: "asc" },
  });

  if (!supplier?.supplierProfile) {
    console.log("[seed] Skipping admin dashboard seed: no supplier found.");
    return {
      skipped: true,
      forceApplied: force,
      categoryRequests: 0,
      priceRequests: 0,
      invitations: 0,
      reusedMaterials: 0,
    };
  }

  const categories = await prisma.category.findMany({
    where: {
      categoryType: { in: ["MATERIAL", "BOTH"] },
      isActive: true,
    },
    select: { id: true, nameEn: true },
    take: 6,
  });

  const location = await prisma.location.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!location || categories.length === 0) {
    console.log(
      "[seed] Skipping admin dashboard seed: missing category/location.",
    );
    return {
      skipped: true,
      forceApplied: force,
      categoryRequests: 0,
      priceRequests: 0,
      invitations: 0,
      reusedMaterials: 0,
    };
  }

  let categoryRequests = 0;
  let priceRequests = 0;
  let invitations = 0;
  let reusedMaterials = 0;

  await prisma.categoryRequest.create({
    data: {
      requestedName: `${SEED_ADMIN_DASHBOARD_MARKER} Lab Glassware`,
      normalizedRequestedName: `${SEED_ADMIN_DASHBOARD_MARKER} lab glassware`,
      requestedByUserId: supplier.id,
      status: "PENDING",
    },
  });
  categoryRequests += 1;

  await prisma.priceRuleRequest.create({
    data: {
      materialName: `${SEED_ADMIN_DASHBOARD_MARKER} Acrylic Sheets`,
      normalizedMaterialName: `${SEED_ADMIN_DASHBOARD_MARKER} acrylic sheets`,
      requestedByUserId: supplier.id,
      status: "PENDING",
    },
  });
  priceRequests += 1;

  if (admin) {
    const tokenHash = `${SEED_ADMIN_DASHBOARD_MARKER}-moderator-${Date.now()}`;
    await prisma.roleInvitation.create({
      data: {
        targetEmail: `moderator.${SEED_ADMIN_DASHBOARD_MARKER}@impactloop.test`,
        targetRole: "MODERATOR",
        tokenHash,
        invitedBy: admin.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        notes: SEED_ADMIN_DASHBOARD_MARKER,
      },
    });
    invitations += 1;
  }

  const reusedSeeds = [
    {
      categoryIndex: 0,
      title: "Reused Arduino boards",
      quantity: 2,
      unit: "piece",
    },
    {
      categoryIndex: 1 % categories.length,
      title: "Reused wood panels",
      quantity: 4,
      unit: "sheet",
    },
    {
      categoryIndex: 2 % categories.length,
      title: "Reused acrylic offcuts",
      quantity: 3,
      unit: "piece",
    },
    {
      categoryIndex: 3 % categories.length,
      title: "Reused fabric bundles",
      quantity: 2,
      unit: "kg",
    },
  ];

  for (const item of reusedSeeds) {
    const category = categories[item.categoryIndex];
    if (!category) continue;

    await prisma.material.create({
      data: {
        ownerId: supplier.id,
        supplierProfileId: supplier.supplierProfile.id,
        categoryId: category.id,
        locationId: location.id,
        title: `${SEED_ADMIN_DASHBOARD_MARKER} ${item.title}`,
        description: "Admin dashboard seed reused material for impact metrics.",
        materialType: "Seed material",
        quantity: item.quantity,
        unit: item.unit,
        condition: "GOOD",
        sourceType: "WORKSHOP_SURPLUS",
        status: "REUSED",
        isFree: true,
        reusedAt: new Date(),
      },
    });
    reusedMaterials += 1;
  }

  return {
    skipped: false,
    forceApplied: force,
    categoryRequests,
    priceRequests,
    invitations,
    reusedMaterials,
  };
}
