import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { prisma } from "../../database/prisma.js";
import { hashPassword } from "../../utils/password.js";
import { AppError } from "../../utils/app-error.js";

import { getSupplierProfile, getSupplierProfileFollowers } from "./supplier.service.js";

const TEST_MARKER = "[test-supplier-profile-engagement]";

type TestContext = {
  supplierId: string;
  supplierProfileId: string;
  followerId: string;
  categoryId: string;
  locationId: string;
  createdUserIds: string[];
  createdMaterialIds: string[];
  createdFollowerIds: string[];
  createdLikeIds: string[];
  createdViewIds: string[];
};

const ctx: TestContext = {
  supplierId: "",
  supplierProfileId: "",
  followerId: "",
  categoryId: "",
  locationId: "",
  createdUserIds: [],
  createdMaterialIds: [],
  createdFollowerIds: [],
  createdLikeIds: [],
  createdViewIds: [],
};

async function createSupplierUser(emailSuffix: string) {
  const passwordHash = await hashPassword("TestPassword123!");

  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} supplier ${emailSuffix}`,
      email: `${TEST_MARKER}-${emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: "ACTIVE",
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: "SUPPLIER", isPrimary: true }] },
      supplierProfile: {
        create: {
          supplierType: "INDIVIDUAL_SUPPLIER",
          publicName: `${TEST_MARKER} Supplier ${emailSuffix}`,
          verificationStatus: "VERIFIED",
        },
      },
    },
    include: { supplierProfile: true },
  });

  ctx.createdUserIds.push(user.id);
  assert.ok(user.supplierProfile);
  ctx.supplierProfileId = user.supplierProfile!.id;
  return user;
}

async function createFollowerUser(emailSuffix: string) {
  const passwordHash = await hashPassword("TestPassword123!");
  const user = await prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} follower ${emailSuffix}`,
      email: `${TEST_MARKER}-follower-${emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: "ACTIVE",
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: "LEARNER", isPrimary: true }] },
      learnerProfile: {
        create: { learnerType: "STUDENT", skillLevel: "BEGINNER" },
      },
    },
  });
  ctx.createdUserIds.push(user.id);
  return user;
}

async function ensureCategoryAndLocation() {
  const category = await prisma.category.findFirst({
    where: { categoryType: { in: ["MATERIAL", "BOTH"] } },
    select: { id: true },
  });
  assert.ok(category);
  ctx.categoryId = category.id;

  const location = await prisma.location.create({
    data: {
      country: "Palestine",
      city: "Nablus",
      area: `${TEST_MARKER}-area`,
      visibility: "ORDER_ONLY",
      isApproximate: true,
      locationType: "MATERIAL_PICKUP",
    },
    select: { id: true },
  });
  ctx.locationId = location.id;
}

async function createMaterial(ownerId: string) {
  const profile = await prisma.supplierProfile.findUnique({
    where: { userId: ownerId },
    select: { id: true },
  });
  const material = await prisma.material.create({
    data: {
      ownerId,
      supplierProfileId: profile?.id,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title: `${TEST_MARKER} Material`,
      description: `${TEST_MARKER} description`,
      materialType: "Test",
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      sourceType: "WORKSHOP_SURPLUS",
      status: "AVAILABLE",
      isFree: true,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      images: { create: [{ imageUrl: "/uploads/materials/test.jpg", isCover: true }] },
    },
  });
  ctx.createdMaterialIds.push(material.id);
  return material;
}

before(async () => {
  process.env.NODE_ENV = "test";
  await ensureCategoryAndLocation();
  const supplier = await createSupplierUser("a");
  ctx.supplierId = supplier.id;
  const follower = await createFollowerUser("b");
  ctx.followerId = follower.id;
});

after(async () => {
  if (ctx.createdViewIds.length) {
    await prisma.materialView.deleteMany({ where: { id: { in: ctx.createdViewIds } } });
  }
  if (ctx.createdLikeIds.length) {
    await prisma.materialLike.deleteMany({ where: { id: { in: ctx.createdLikeIds } } });
  }
  if (ctx.createdFollowerIds.length) {
    await prisma.supplierFollower.deleteMany({
      where: { id: { in: ctx.createdFollowerIds } },
    });
  }
  if (ctx.createdMaterialIds.length) {
    await prisma.materialImage.deleteMany({
      where: { materialId: { in: ctx.createdMaterialIds } },
    });
    await prisma.material.deleteMany({ where: { id: { in: ctx.createdMaterialIds } } });
  }
  if (ctx.locationId) {
    await prisma.location.delete({ where: { id: ctx.locationId } });
  }
  if (ctx.createdUserIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: ctx.createdUserIds } } });
  }
});

describe("supplier profile engagement", () => {
  test("supplier profile returns zero counts when no followers/likes/views exist", async () => {
    const material = await createMaterial(ctx.supplierId);

    const profile = await getSupplierProfile(ctx.supplierId);
    assert.equal(profile.stats.followersCount, 0);
    assert.equal(profile.stats.totalLikes, 0);
    assert.equal(profile.stats.totalViews, 0);
    assert.ok(profile.materialsPreview.length <= 4);

    const preview = profile.materialsPreview.find((m) => m.id === material.id);
    assert.ok(preview);
    assert.equal(preview?.likesCount, 0);
    assert.equal(preview?.viewsCount, 0);
  });

  test("followers endpoint returns empty list safely", async () => {
    const result = await getSupplierProfileFollowers(ctx.supplierId, {
      page: 1,
      limit: 20,
    });
    assert.deepEqual(result.items, []);
    assert.equal(result.pagination.total, 0);
  });

  test("SupplierFollower unique constraint prevents duplicates", async () => {
    const follower = await prisma.supplierFollower.create({
      data: {
        supplierProfileId: ctx.supplierProfileId,
        followerUserId: ctx.followerId,
      },
    });
    ctx.createdFollowerIds.push(follower.id);

    await assert.rejects(
      () =>
        prisma.supplierFollower.create({
          data: {
            supplierProfileId: ctx.supplierProfileId,
            followerUserId: ctx.followerId,
          },
        }),
      (error: unknown) => {
        // Prisma unique constraint
        assert.ok(error);
        return true;
      },
    );
  });

  test("MaterialLike unique constraint prevents duplicate likes", async () => {
    const material = await createMaterial(ctx.supplierId);
    const like = await prisma.materialLike.create({
      data: { materialId: material.id, userId: ctx.followerId },
    });
    ctx.createdLikeIds.push(like.id);

    await assert.rejects(
      () =>
        prisma.materialLike.create({
          data: { materialId: material.id, userId: ctx.followerId },
        }),
      (error: unknown) => {
        assert.ok(error);
        return true;
      },
    );
  });
});

