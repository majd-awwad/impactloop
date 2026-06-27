import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { prisma } from "../../database/prisma.js";
import { hashPassword } from "../../utils/password.js";

import {
  createSupplierMaterial,
  createSupplierMaterialIdempotent,
  deleteSupplierMaterial,
  getSupplierMaterial,
  getSupplierMaterials,
  updateSupplierMaterial,
} from "./supplier.service.js";
import { AppError } from "../../utils/app-error.js";
import {
  SUPPLIER_CREATE_MATERIAL_SCOPE,
  runIdempotentOperation,
  validateIdempotencyKey,
} from "../../services/idempotency.service.js";
import { postMaterial } from "./supplier.controller.js";
import {
  type CreateSupplierMaterialInput,
  createSupplierMaterialSchema,
  updateSupplierMaterialSchema,
} from "./supplier.validation.js";

const TEST_MARKER = "[test-supplier-materials]";

type TestContext = {
  supplierId: string;
  otherSupplierId: string;
  categoryId: string;
  locationId: string;
  createdMaterialIds: string[];
  createdUserIds: string[];
  createdReservationIds: string[];
  learnerId: string;
};

async function createSupplierUser(emailSuffix: string) {
  const passwordHash = await hashPassword("TestPassword123!");

  return prisma.user.create({
    data: {
      displayName: `${TEST_MARKER} supplier ${emailSuffix}`,
      email: `${TEST_MARKER}-${emailSuffix}-${Date.now()}@impactloop.test`,
      passwordHash,
      accountStatus: "ACTIVE",
      emailVerifiedAt: new Date(),
      roles: {
        create: [{ role: "SUPPLIER", isPrimary: true }],
      },
      supplierProfile: {
        create: {
          supplierType: "INDIVIDUAL_SUPPLIER",
          publicName: `${TEST_MARKER} Workshop ${emailSuffix}`,
          verificationStatus: "VERIFIED",
        },
      },
    },
    include: { supplierProfile: true },
  });
}

async function createMaterial(
  ctx: TestContext,
  ownerId: string,
  title: string,
  status:
    | "AVAILABLE"
    | "PENDING_RESERVATION"
    | "RESERVED"
    | "REUSED"
    | "UNAVAILABLE" = "AVAILABLE",
  isFree = false,
) {
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
      title: `${TEST_MARKER} ${title}`,
      description: `${TEST_MARKER} ${title} description`,
      materialType: "Test material",
      quantity: 2,
      unit: "piece",
      condition: "GOOD",
      sourceType: "WORKSHOP_SURPLUS",
      status,
      isFree,
      price: isFree ? null : 15,
    },
  });

  ctx.createdMaterialIds.push(material.id);
  return material;
}

async function cleanup(ctx: TestContext) {
  if (ctx.createdReservationIds.length) {
    await prisma.reservationStatusHistory.deleteMany({
      where: { reservationId: { in: ctx.createdReservationIds } },
    });
    await prisma.reservation.deleteMany({
      where: { id: { in: ctx.createdReservationIds } },
    });
  }

  if (ctx.createdMaterialIds.length) {
    await prisma.materialImage.deleteMany({
      where: { materialId: { in: ctx.createdMaterialIds } },
    });
    await prisma.material.deleteMany({
      where: { id: { in: ctx.createdMaterialIds } },
    });
  }

  if (ctx.createdUserIds.length) {
    await prisma.idempotencyRecord.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.userRoleAssignment.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.supplierProfile.deleteMany({
      where: { userId: { in: ctx.createdUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ctx.createdUserIds } },
    });
  }
}

describe("getSupplierMaterials", () => {
  const defaultQuery = {
    page: 1,
    limit: 100,
    isFree: undefined,
  } as const;

  const ctx: TestContext = {
    supplierId: "",
    otherSupplierId: "",
    categoryId: "",
    locationId: "",
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: "",
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ["MATERIAL", "BOTH"] } },
      select: { id: true },
    });

    assert.ok(category, "Expected at least one material category");

    const location = await prisma.location.create({
      data: {
        country: "Palestine",
        city: "Nablus",
        area: TEST_MARKER,
        visibility: "PUBLIC_APPROXIMATE",
        isApproximate: true,
      },
      select: { id: true },
    });

    const supplier = await createSupplierUser("primary");
    const otherSupplier = await createSupplierUser("other");
    const learner = await prisma.user.findFirst({
      where: { roles: { some: { role: "LEARNER" } } },
      select: { id: true },
    });

    assert.ok(learner, "Expected at least one learner user");

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.learnerId = learner.id;
    ctx.createdUserIds.push(supplier.id, otherSupplier.id);

    for (let index = 0; index < 11; index += 1) {
      await createMaterial(ctx, ctx.supplierId, `owned-${index}`);
    }

    await createMaterial(ctx, ctx.otherSupplierId, "other-supplier");
  });

  after(async () => {
    await cleanup(ctx);
    await prisma.location.deleteMany({ where: { id: ctx.locationId } });
  });

  test("returns only materials owned by the supplier", async () => {
    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
    });

    assert.ok(result.items.length >= 11);
    assert.ok(result.items.every((item) => item.title.includes(TEST_MARKER)));
    assert.ok(
      result.items.every((item) => !item.title.includes("other-supplier")),
    );
  });

  test("paginates results", async () => {
    const page1 = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      limit: 5,
    });
    const page2 = await getSupplierMaterials(ctx.supplierId, {
      page: 2,
      limit: 5,
      isFree: undefined,
    });

    assert.equal(page1.pagination.page, 1);
    assert.equal(page1.pagination.limit, 5);
    assert.ok(page1.pagination.totalItems >= 11);
    assert.ok(page1.pagination.totalPages >= 3);
    assert.equal(page1.items.length, 5);
    assert.equal(page2.items.length, 5);
    assert.notEqual(page1.items[0]?.id, page2.items[0]?.id);
  });

  test("filters by status", async () => {
    await createMaterial(ctx, ctx.supplierId, "reserved-item", "RESERVED");

    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      status: "RESERVED",
    });

    assert.ok(result.items.length >= 1);
    assert.ok(result.items.every((item) => item.status === "RESERVED"));
  });

  test("searches by title", async () => {
    await createMaterial(ctx, ctx.supplierId, "unique-search-term");

    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      search: "unique-search-term",
    });

    assert.equal(result.items.length, 1);
    assert.match(result.items[0]!.title, /unique-search-term/);
  });

  test("filters by categoryId", async () => {
    const secondCategory = await prisma.category.findFirst({
      where: {
        categoryType: { in: ["MATERIAL", "BOTH"] },
        id: { not: ctx.categoryId },
      },
      select: { id: true },
    });

    assert.ok(secondCategory, "Expected a second material category");

    await createMaterial(ctx, ctx.supplierId, "category-a");
    const categorized = await createMaterial(ctx, ctx.supplierId, "category-b");
    await prisma.material.update({
      where: { id: categorized.id },
      data: { categoryId: secondCategory.id },
    });

    const filtered = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      categoryId: secondCategory.id,
    });

    assert.ok(filtered.items.length >= 1);
    assert.ok(
      filtered.items.every((item) => item.category?.id === secondCategory.id),
    );
    assert.ok(filtered.categories.some((category) => category.count > 0));
    assert.ok(filtered.categoryFacets.some((category) => category.count > 0));
  });

  test("categoryFacets reflect supplier-owned materials only", async () => {
    const secondCategory = await prisma.category.findFirst({
      where: {
        categoryType: { in: ["MATERIAL", "BOTH"] },
        id: { not: ctx.categoryId },
      },
      select: { id: true },
    });

    assert.ok(secondCategory, "Expected a second material category");

    const otherMaterial = await createMaterial(
      ctx,
      ctx.otherSupplierId,
      "other-supplier-only",
    );
    await prisma.material.update({
      where: { id: otherMaterial.id },
      data: { categoryId: secondCategory.id },
    });

    const supplierCountInSecondCategory = await prisma.material.count({
      where: {
        ownerId: ctx.supplierId,
        categoryId: secondCategory.id,
      },
    });

    const result = await getSupplierMaterials(ctx.supplierId, defaultQuery);
    const facet = result.categoryFacets.find(
      (entry) => entry.id === secondCategory.id,
    );

    if (supplierCountInSecondCategory === 0) {
      assert.equal(facet, undefined);
    } else {
      assert.ok(facet);
      assert.equal(facet.count, supplierCountInSecondCategory);
    }
  });

  test("filters by isFree", async () => {
    await createMaterial(ctx, ctx.supplierId, "paid-item", "AVAILABLE", false);
    await createMaterial(ctx, ctx.supplierId, "free-item", "AVAILABLE", true);

    const freeResult = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      isFree: true,
    });

    assert.ok(freeResult.items.length >= 1);
    assert.ok(freeResult.items.every((item) => item.isFree));
  });

  test("includes images in list items", async () => {
    const material = await createMaterial(ctx, ctx.supplierId, "with-image");

    await prisma.materialImage.create({
      data: {
        materialId: material.id,
        imageUrl:
          "https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=1200&q=80",
        sortOrder: 0,
        isCover: true,
      },
    });

    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      search: "with-image",
    });

    assert.equal(result.items.length, 1);
    assert.ok(result.items[0]!.images.length >= 1);
    assert.ok(result.items[0]!.images[0]!.imageUrl.length > 0);
  });

  test("includes delete eligibility in list items", async () => {
    const available = await createMaterial(
      ctx,
      ctx.supplierId,
      "delete-eligible",
      "AVAILABLE",
    );
    const reused = await createMaterial(
      ctx,
      ctx.supplierId,
      "delete-blocked-reused",
      "REUSED",
    );

    const result = await getSupplierMaterials(ctx.supplierId, {
      ...defaultQuery,
      search: "delete-",
    });

    const availableItem = result.items.find((item) => item.id === available.id);
    const reusedItem = result.items.find((item) => item.id === reused.id);

    assert.ok(availableItem);
    assert.equal(availableItem.canDelete, true);
    assert.equal(availableItem.deleteBlockedReason, null);
    assert.equal(availableItem.canEdit, true);
    assert.equal(availableItem.editBlockedReason, null);

    assert.ok(reusedItem);
    assert.equal(reusedItem.canDelete, false);
    assert.equal(reusedItem.deleteBlockedReason, "REUSED_HISTORY");
    assert.equal(reusedItem.canEdit, false);
    assert.equal(reusedItem.editBlockedReason, "REUSED_HISTORY");
  });
});

describe("createSupplierMaterial", () => {
  const ctx: TestContext = {
    supplierId: "",
    otherSupplierId: "",
    categoryId: "",
    locationId: "",
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: "",
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ["MATERIAL", "BOTH"] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: "Palestine",
        city: "Nablus",
        area: `${TEST_MARKER}-create`,
        visibility: "PRIVATE",
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser("create");
    const otherSupplier = await createSupplierUser("create-other");

    assert.ok(category);
    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.createdUserIds.push(supplier.id);
    ctx.createdUserIds.push(otherSupplier.id);

    await prisma.supplierProfile.update({
      where: { userId: supplier.id },
      data: {
        supplierType: "WORKSHOP",
        defaultPickupLocationId: location.id,
      },
    });
    await prisma.supplierProfile.update({
      where: { userId: otherSupplier.id },
      data: {
        supplierType: "WORKSHOP",
        defaultPickupLocationId: location.id,
      },
    });
  });

  const buildCreatePayload = (
    title: string,
    overrides: Partial<CreateSupplierMaterialInput> = {},
  ): CreateSupplierMaterialInput => ({
    materialName: "Unmatched create material",
    title: `${TEST_MARKER} ${title}`,
    description: `${TEST_MARKER} ${title} description`,
    categoryId: ctx.categoryId,
    quantity: 1,
    unit: "piece",
    condition: "GOOD",
    isFree: true,
    price: null,
    currency: "NIS",
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [`/uploads/materials/${title}.jpg`],
    useDefaultPickupLocation: true,
    ...overrides,
  });

  after(async () => {
    const materials = await prisma.material.findMany({
      where: { id: { in: ctx.createdMaterialIds } },
      select: { locationId: true },
    });
    const materialLocationIds = materials.map(
      (material) => material.locationId,
    );

    await cleanup(ctx);
    await prisma.location.deleteMany({
      where: {
        id: {
          in: [...new Set([ctx.locationId, ...materialLocationIds])],
        },
      },
    });
  });

  test("requires at least one material image in create schema", () => {
    const basePayload = {
      materialName: "Test material",
      title: "Reusable test material",
      description: "Reusable test material description.",
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      isFree: true,
      price: null,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
    };

    assert.equal(
      createSupplierMaterialSchema.safeParse(basePayload).success,
      false,
    );
    assert.equal(
      createSupplierMaterialSchema.safeParse({
        ...basePayload,
        imageUrls: [],
      }).success,
      false,
    );
    assert.equal(
      createSupplierMaterialSchema.safeParse({
        ...basePayload,
        imageUrls: ["/uploads/materials/test-create.jpg"],
      }).success,
      true,
    );
  });

  test("requires a valid idempotency key for supplier material create requests", () => {
    assert.throws(
      () => validateIdempotencyKey(undefined),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "VALIDATION_ERROR");
        return true;
      },
    );

    assert.throws(
      () => validateIdempotencyKey("unsafe key with spaces"),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "VALIDATION_ERROR");
        return true;
      },
    );
  });

  test("post material controller rejects missing idempotency key before create", async () => {
    await assert.rejects(
      () =>
        postMaterial(
          {
            get: () => undefined,
            auth: { sub: ctx.supplierId },
            body: buildCreatePayload("missing-key-controller"),
          } as never,
          {} as never,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "VALIDATION_ERROR");
        return true;
      },
    );
  });

  test("creates one material and reuses the same response for repeated idempotency key", async () => {
    const key = `test-create-${Date.now()}-same-key`;
    const payload = buildCreatePayload("idempotent-same-key");

    const first = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    const second = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    ctx.createdMaterialIds.push(first.response.id);

    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true);
    assert.equal(second.response.id, first.response.id);

    const count = await prisma.material.count({
      where: { title: payload.title },
    });
    assert.equal(count, 1);
  });

  test("two rapid same-key creates do not create duplicate materials", async () => {
    const key = `test-create-${Date.now()}-rapid`;
    const payload = buildCreatePayload("idempotent-rapid");

    const results = await Promise.allSettled([
      createSupplierMaterialIdempotent(ctx.supplierId, payload, key),
      createSupplierMaterialIdempotent(ctx.supplierId, payload, key),
    ]);

    const fulfilled = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof createSupplierMaterialIdempotent>>
      > => result.status === "fulfilled",
    );

    for (const result of fulfilled) {
      if (!ctx.createdMaterialIds.includes(result.value.response.id)) {
        ctx.createdMaterialIds.push(result.value.response.id);
      }
    }

    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    for (const result of rejected) {
      assert.ok(result.reason instanceof AppError);
      assert.equal(result.reason.statusCode, 409);
    }

    const materialIds = new Set(
      fulfilled.map((result) => result.value.response.id),
    );
    assert.ok(fulfilled.length >= 1);
    assert.ok(materialIds.size <= 1);

    const count = await prisma.material.count({
      where: { title: payload.title },
    });
    assert.equal(count, 1);
  });

  test("rejects the same idempotency key with a different payload", async () => {
    const key = `test-create-${Date.now()}-different-payload`;
    const payload = buildCreatePayload("idempotent-original");
    const first = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    ctx.createdMaterialIds.push(first.response.id);

    await assert.rejects(
      () =>
        createSupplierMaterialIdempotent(
          ctx.supplierId,
          buildCreatePayload("idempotent-changed"),
          key,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.equal(error.code, "IDEMPOTENCY_KEY_REUSED");
        return true;
      },
    );
  });

  test("failed create rolls back idempotency success and allows a corrected retry with same key", async () => {
    const key = `test-create-${Date.now()}-failed`;
    const payload = buildCreatePayload("idempotent-failed", {
      categoryId: "missing-category",
    });

    await assert.rejects(
      () => createSupplierMaterialIdempotent(ctx.supplierId, payload, key),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );

    await assert.rejects(
      () => createSupplierMaterialIdempotent(ctx.supplierId, payload, key),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );

    const record = await prisma.idempotencyRecord.findUnique({
      where: {
        userId_scope_key: {
          userId: ctx.supplierId,
          scope: SUPPLIER_CREATE_MATERIAL_SCOPE,
          key,
        },
      },
    });
    assert.equal(record, null);

    const corrected = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      buildCreatePayload("idempotent-failed-corrected"),
      key,
    );
    ctx.createdMaterialIds.push(corrected.response.id);

    assert.equal(corrected.replayed, false);
  });

  test("post-insert failure rolls back material and idempotency record before retry", async () => {
    const key = `test-create-${Date.now()}-post-insert-failure`;
    const title = `${TEST_MARKER} idempotent-post-insert-failure`;

    await assert.rejects(
      () =>
        runIdempotentOperation<{ id: string }>({
          userId: ctx.supplierId,
          scope: SUPPLIER_CREATE_MATERIAL_SCOPE,
          key,
          payload: { title },
          resourceType: "MATERIAL",
          getResourceId: (material: { id: string }) => material.id,
          handler: async (tx) => {
            const material = await tx.material.create({
              data: {
                ownerId: ctx.supplierId,
                categoryId: ctx.categoryId,
                locationId: ctx.locationId,
                title,
                description: `${title} description`,
                materialType: "Test material",
                quantity: 1,
                unit: "piece",
                condition: "GOOD",
                sourceType: "WORKSHOP_SURPLUS",
                status: "AVAILABLE",
                isFree: true,
                price: null,
              },
              select: { id: true },
            });
            throw new AppError(
              `Simulated failure after ${material.id}`,
              500,
              "TEST_FAILURE",
            );
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "TEST_FAILURE");
        return true;
      },
    );

    assert.equal(await prisma.material.count({ where: { title } }), 0);
    assert.equal(
      await prisma.idempotencyRecord.findUnique({
        where: {
          userId_scope_key: {
            userId: ctx.supplierId,
            scope: SUPPLIER_CREATE_MATERIAL_SCOPE,
            key,
          },
        },
      }),
      null,
    );

    const created = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      buildCreatePayload("idempotent-post-insert-failure"),
      key,
    );
    ctx.createdMaterialIds.push(created.response.id);
    assert.equal(created.replayed, false);
  });

  test("image urls are part of the idempotency request hash", async () => {
    const key = `test-create-${Date.now()}-images`;
    const payload = buildCreatePayload("idempotent-images");
    const first = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    ctx.createdMaterialIds.push(first.response.id);

    await assert.rejects(
      () =>
        createSupplierMaterialIdempotent(
          ctx.supplierId,
          {
            ...payload,
            imageUrls: ["/uploads/materials/idempotent-images-other.jpg"],
          },
          key,
        ),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "IDEMPOTENCY_KEY_REUSED");
        return true;
      },
    );
  });

  test("different users can use the same idempotency key independently", async () => {
    const key = `test-create-${Date.now()}-multi-user`;
    const first = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      buildCreatePayload("idempotent-user-a"),
      key,
    );
    const second = await createSupplierMaterialIdempotent(
      ctx.otherSupplierId,
      buildCreatePayload("idempotent-user-b"),
      key,
    );
    ctx.createdMaterialIds.push(first.response.id, second.response.id);

    assert.notEqual(first.response.id, second.response.id);
  });

  test("same user can reuse a key in a different idempotency scope", async () => {
    const key = `test-create-${Date.now()}-scope`;
    await prisma.idempotencyRecord.create({
      data: {
        userId: ctx.supplierId,
        scope: "OTHER_TEST_SCOPE",
        key,
        requestHash: "test-hash",
        status: "SUCCEEDED",
        responseJson: { ok: true },
      },
    });

    const created = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      buildCreatePayload("idempotent-scope"),
      key,
    );
    ctx.createdMaterialIds.push(created.response.id);

    assert.equal(created.replayed, false);
  });

  test("derives source type from supplier profile and ignores client value", async () => {
    const material = await createSupplierMaterial(ctx.supplierId, {
      materialName: "Unmatched create material",
      title: `${TEST_MARKER} create source derivation`,
      description: `${TEST_MARKER} create source derivation description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      sourceType: "FACTORY_SURPLUS",
      isFree: true,
      price: null,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/test-create-source.jpg"],
      useDefaultPickupLocation: true,
    });
    ctx.createdMaterialIds.push(material.id);

    const persisted = await prisma.material.findUnique({
      where: { id: material.id },
      select: { sourceType: true, images: true, locationId: true },
    });

    assert.equal(persisted?.sourceType, "WORKSHOP_SURPLUS");
    assert.equal(persisted?.images.length, 1);
    assert.notEqual(persisted?.locationId, ctx.locationId);
  });

  test("rejects organization pickup override attempts", async () => {
    await assert.rejects(
      () =>
        createSupplierMaterial(ctx.supplierId, {
          materialName: "Org override material",
          title: `${TEST_MARKER} org pickup override`,
          description: `${TEST_MARKER} org pickup override description`,
          categoryId: ctx.categoryId,
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          isFree: true,
          price: null,
          currency: "NIS",
          pickupAllowed: true,
          deliveryAllowed: false,
          imageUrls: ["/uploads/materials/test-org-override.jpg"],
          useDefaultPickupLocation: false,
          pickupLocation: {
            country: "Palestine",
            city: "Ramallah",
            area: "Downtown",
            visibility: "ORDER_ONLY",
            isApproximate: true,
          },
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.equal(
          (error.details as { reason?: string } | undefined)?.reason,
          "ORG_PICKUP_OVERRIDE_NOT_ALLOWED",
        );
        return true;
      },
    );
  });

  test("copies profile pickup into a new material location row for organization suppliers", async () => {
    const material = await createSupplierMaterial(ctx.supplierId, {
      materialName: "Org copied pickup material",
      title: `${TEST_MARKER} org copied pickup`,
      description: `${TEST_MARKER} org copied pickup description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      isFree: true,
      price: null,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/test-org-copy.jpg"],
      useDefaultPickupLocation: true,
    });
    ctx.createdMaterialIds.push(material.id);

    const persisted = await prisma.material.findUnique({
      where: { id: material.id },
      select: { locationId: true },
    });
    const profileLocation = await prisma.location.findUnique({
      where: { id: ctx.locationId },
    });
    const materialLocation = await prisma.location.findUnique({
      where: { id: persisted?.locationId },
    });

    assert.ok(persisted?.locationId);
    assert.notEqual(persisted?.locationId, ctx.locationId);
    assert.equal(materialLocation?.city, profileLocation?.city);
    assert.equal(materialLocation?.area, profileLocation?.area);
    assert.equal(materialLocation?.locationType, "MATERIAL_PICKUP");
  });

  test("publishes paid material with approved price rule request when price is within max", async () => {
    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} custom paid widget`,
        normalizedMaterialName: "custom-paid-widget",
        unit: "piece",
        supplierPriceNis: 15,
        categoryId: ctx.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "REJECTED",
        aiSuggestedMaxUnitPriceNis: 21,
      },
    });

    const material = await createSupplierMaterial(ctx.supplierId, {
      materialName: `${TEST_MARKER} custom paid widget`,
      title: `${TEST_MARKER} approved price rule publish`,
      description: `${TEST_MARKER} approved price rule publish description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      isFree: false,
      price: 15,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/test-approved-price-rule.jpg"],
      useDefaultPickupLocation: true,
      sourcePriceRuleRequestId: priceRuleRequest.id,
    });
    ctx.createdMaterialIds.push(material.id);

    assert.equal(material.price, 15);
    assert.equal(material.maxAllowedPriceAtCheck, 21);

    const updatedRequest = await prisma.priceRuleRequest.findUnique({
      where: { id: priceRuleRequest.id },
      select: { publishedMaterialId: true },
    });
    assert.equal(updatedRequest?.publishedMaterialId, material.id);

    await prisma.priceRuleRequest.delete({
      where: { id: priceRuleRequest.id },
    });
  });

  test("publishes paid material at exact approved max price", async () => {
    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} boundary price widget`,
        normalizedMaterialName: "boundary-price-widget",
        unit: "piece",
        supplierPriceNis: 21,
        categoryId: ctx.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        aiSuggestedMaxUnitPriceNis: 21,
      },
    });

    const material = await createSupplierMaterial(ctx.supplierId, {
      materialName: `${TEST_MARKER} boundary price widget`,
      title: `${TEST_MARKER} boundary price publish`,
      description: `${TEST_MARKER} boundary price publish description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      isFree: false,
      price: 21,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/test-boundary-price.jpg"],
      useDefaultPickupLocation: true,
      sourcePriceRuleRequestId: priceRuleRequest.id,
    });
    ctx.createdMaterialIds.push(material.id);

    assert.equal(material.price, 21);
    assert.equal(material.maxAllowedPriceAtCheck, 21);

    await prisma.priceRuleRequest.delete({
      where: { id: priceRuleRequest.id },
    });
  });

  test("rejects paid material above approved max price with clear message", async () => {
    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} over max widget`,
        normalizedMaterialName: "over-max-widget",
        unit: "piece",
        supplierPriceNis: 22,
        categoryId: ctx.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "REJECTED",
        aiSuggestedMaxUnitPriceNis: 21,
      },
    });

    await assert.rejects(
      () =>
        createSupplierMaterial(ctx.supplierId, {
          materialName: `${TEST_MARKER} over max widget`,
          title: `${TEST_MARKER} over max publish`,
          description: `${TEST_MARKER} over max publish description`,
          categoryId: ctx.categoryId,
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          isFree: false,
          price: 22,
          currency: "NIS",
          pickupAllowed: true,
          deliveryAllowed: false,
          imageUrls: ["/uploads/materials/test-over-max.jpg"],
          useDefaultPickupLocation: true,
          sourcePriceRuleRequestId: priceRuleRequest.id,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.match(
          error.message,
          /Maximum allowed price is 21 NIS per piece/,
        );
        assert.equal(
          (error.details as { reason?: string } | undefined)?.reason,
          "PRICE_TOO_HIGH",
        );
        return true;
      },
    );

    await prisma.priceRuleRequest.delete({
      where: { id: priceRuleRequest.id },
    });
  });
});

describe("createSupplierMaterial pickup for individual suppliers", () => {
  const ctx: TestContext = {
    supplierId: "",
    otherSupplierId: "",
    categoryId: "",
    locationId: "",
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: "",
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ["MATERIAL", "BOTH"] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: "Palestine",
        city: "Nablus",
        area: `${TEST_MARKER}-individual-create`,
        addressLine: "Campus gate",
        latitude: 32.2211,
        longitude: 35.2544,
        visibility: "ORDER_ONLY",
        isApproximate: true,
        locationType: "PICKUP_POINT",
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser("individual-create");

    assert.ok(category);
    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.createdUserIds.push(supplier.id);

    await prisma.supplierProfile.update({
      where: { userId: supplier.id },
      data: {
        supplierType: "INDIVIDUAL_SUPPLIER",
        defaultPickupLocationId: location.id,
      },
    });
  });

  after(async () => {
    const materials = await prisma.material.findMany({
      where: { id: { in: ctx.createdMaterialIds } },
      select: { locationId: true },
    });
    const materialLocationIds = materials.map(
      (material) => material.locationId,
    );

    await cleanup(ctx);
    await prisma.location.deleteMany({
      where: {
        id: {
          in: [...new Set([ctx.locationId, ...materialLocationIds])],
        },
      },
    });
  });

  test("copies default pickup when useDefaultPickupLocation is true", async () => {
    const material = await createSupplierMaterial(ctx.supplierId, {
      materialName: "Individual default pickup material",
      title: `${TEST_MARKER} individual default pickup`,
      description: `${TEST_MARKER} individual default pickup description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      isFree: true,
      price: null,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/test-individual-default.jpg"],
      useDefaultPickupLocation: true,
    });
    ctx.createdMaterialIds.push(material.id);

    const persisted = await prisma.material.findUnique({
      where: { id: material.id },
      select: { locationId: true },
    });

    assert.ok(persisted?.locationId);
    assert.notEqual(persisted?.locationId, ctx.locationId);
  });

  test("creates a new material pickup location when override is provided", async () => {
    const material = await createSupplierMaterial(ctx.supplierId, {
      materialName: "Individual override pickup material",
      title: `${TEST_MARKER} individual override pickup`,
      description: `${TEST_MARKER} individual override pickup description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      isFree: true,
      price: null,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/test-individual-override.jpg"],
      useDefaultPickupLocation: false,
      pickupLocation: {
        country: "Palestine",
        city: "Jenin",
        area: "City center",
        addressLine: "Near library",
        latitude: 32.4607,
        longitude: 35.3006,
        visibility: "ORDER_ONLY",
        isApproximate: true,
        locationType: "MATERIAL_PICKUP",
      },
    });
    ctx.createdMaterialIds.push(material.id);

    const persisted = await prisma.material.findUnique({
      where: { id: material.id },
      select: { locationId: true },
    });
    const materialLocation = await prisma.location.findUnique({
      where: { id: persisted?.locationId },
    });

    assert.ok(persisted?.locationId);
    assert.notEqual(persisted?.locationId, ctx.locationId);
    assert.equal(materialLocation?.city, "Jenin");
    assert.equal(materialLocation?.area, "City center");
    assert.equal(materialLocation?.addressLine, "Near library");
  });
});

describe("createSupplierMaterial public location redaction", () => {
  const ctx: TestContext = {
    supplierId: "",
    otherSupplierId: "",
    categoryId: "",
    locationId: "",
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: "",
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ["MATERIAL", "BOTH"] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: "Palestine",
        city: "Nablus",
        area: `${TEST_MARKER}-public-redaction`,
        addressLine: "Secret address line",
        latitude: 32.2211,
        longitude: 35.2544,
        visibility: "PRIVATE",
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser("public-redaction");

    assert.ok(category);
    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.createdUserIds.push(supplier.id);

    await prisma.supplierProfile.update({
      where: { userId: supplier.id },
      data: {
        supplierType: "INDIVIDUAL_SUPPLIER",
        defaultPickupLocationId: location.id,
      },
    });
  });

  after(async () => {
    const materials = await prisma.material.findMany({
      where: { id: { in: ctx.createdMaterialIds } },
      select: { locationId: true },
    });
    const materialLocationIds = materials.map(
      (material) => material.locationId,
    );

    await cleanup(ctx);
    await prisma.location.deleteMany({
      where: {
        id: {
          in: [...new Set([ctx.locationId, ...materialLocationIds])],
        },
      },
    });
  });

  test("public material detail exposes city and area only", async () => {
    const { getMaterialById } =
      await import("../materials/materials.service.js");

    const material = await createSupplierMaterial(ctx.supplierId, {
      materialName: "Public redaction material",
      title: `${TEST_MARKER} public redaction`,
      description: `${TEST_MARKER} public redaction description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      isFree: true,
      price: null,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/test-public-redaction.jpg"],
      useDefaultPickupLocation: true,
    });
    ctx.createdMaterialIds.push(material.id);

    const publicMaterial = await getMaterialById(material.id);

    assert.equal(publicMaterial.city, "Nablus");
    assert.equal(publicMaterial.area, `${TEST_MARKER}-public-redaction`);
    assert.equal("latitude" in publicMaterial, false);
    assert.equal("longitude" in publicMaterial, false);
    assert.equal("addressLine" in publicMaterial, false);
  });
});

describe("getSupplierMaterial", () => {
  const ctx: TestContext = {
    supplierId: "",
    otherSupplierId: "",
    categoryId: "",
    locationId: "",
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: "",
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ["MATERIAL", "BOTH"] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: "Palestine",
        city: "Nablus",
        area: `${TEST_MARKER}-single`,
        visibility: "PUBLIC_APPROXIMATE",
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser("single");
    const otherSupplier = await createSupplierUser("single-other");

    assert.ok(category);
    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.createdUserIds.push(supplier.id, otherSupplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test("returns owned material by id", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "single-owned",
      "AVAILABLE",
    );

    const result = await getSupplierMaterial(ctx.supplierId, material.id);

    assert.equal(result.id, material.id);
    assert.match(result.title, /single-owned/);
    assert.ok(result.category);
    assert.ok(Array.isArray(result.images));
  });

  test("rejects another supplier material", async () => {
    const material = await createMaterial(
      ctx,
      ctx.otherSupplierId,
      "single-other",
      "AVAILABLE",
    );

    await assert.rejects(
      () => getSupplierMaterial(ctx.supplierId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });
});

describe("updateSupplierMaterial", () => {
  const ctx: TestContext = {
    supplierId: "",
    otherSupplierId: "",
    categoryId: "",
    locationId: "",
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: "",
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ["MATERIAL", "BOTH"] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: "Palestine",
        city: "Nablus",
        area: `${TEST_MARKER}-update`,
        visibility: "PUBLIC_APPROXIMATE",
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser("update");
    const otherSupplier = await createSupplierUser("update-other");
    const learner = await prisma.user.findFirst({
      where: { roles: { some: { role: "LEARNER" } } },
      select: { id: true },
    });

    assert.ok(category);
    assert.ok(learner);
    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.learnerId = learner.id;
    ctx.createdUserIds.push(supplier.id, otherSupplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test("updates safe editable fields for owned material", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "editable-item",
      "AVAILABLE",
    );

    const before = await prisma.material.findUnique({
      where: { id: material.id },
      select: { categoryId: true, isFree: true, price: true },
    });

    const updated = await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: `${TEST_MARKER} Updated title`,
      description: `${TEST_MARKER} Updated description`,
      quantity: 7,
      unit: "packs",
      condition: "LIKE_NEW",
      pickupAllowed: false,
      deliveryAllowed: false,
      pickupNotes: "Ring bell on arrival",
      suggestedUses: "Student robotics kits",
    });

    assert.equal(updated.title, `${TEST_MARKER} Updated title`);
    assert.equal(updated.quantity, 7);
    assert.equal(updated.unit, "packs");
    assert.equal(updated.condition, "LIKE_NEW");
    assert.equal(updated.pickupNotes, "Ring bell on arrival");

    const after = await prisma.material.findUnique({
      where: { id: material.id },
      select: { categoryId: true, isFree: true, price: true },
    });

    assert.deepEqual(after, before);
  });

  test("rejects editing another supplier material", async () => {
    const material = await createMaterial(
      ctx,
      ctx.otherSupplierId,
      "not-editable",
      "AVAILABLE",
    );

    await assert.rejects(
      () =>
        updateSupplierMaterial(ctx.supplierId, material.id, {
          title: "Hacked",
          description: "Hacked",
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          pickupAllowed: true,
          deliveryAllowed: false,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });

  test("rejects invalid quantity in request schema", () => {
    const result = updateSupplierMaterialSchema.safeParse({
      title: "Valid title",
      description: "Valid description",
      quantity: 0,
      unit: "piece",
      condition: "GOOD",
      pickupAllowed: true,
      deliveryAllowed: false,
    });

    assert.equal(result.success, false);
  });

  test("does not create duplicate material on update", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "no-duplicate",
      "AVAILABLE",
    );

    const countBefore = await prisma.material.count({
      where: { ownerId: ctx.supplierId },
    });

    await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: `${TEST_MARKER} no-duplicate-updated`,
      description: `${TEST_MARKER} no-duplicate description`,
      quantity: 4,
      unit: "pack",
      condition: "GOOD",
      pickupAllowed: true,
      deliveryAllowed: false,
    });

    const countAfter = await prisma.material.count({
      where: { ownerId: ctx.supplierId },
    });

    assert.equal(countBefore, countAfter);
  });

  test("read-only fields remain unchanged after update", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "readonly-check",
      "AVAILABLE",
      false,
    );

    const before = await prisma.material.findUnique({
      where: { id: material.id },
      select: {
        ownerId: true,
        categoryId: true,
        isFree: true,
        price: true,
        locationId: true,
      },
    });

    await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: `${TEST_MARKER} readonly-updated`,
      description: `${TEST_MARKER} readonly description`,
      quantity: 9,
      unit: "kit",
      condition: "USED",
      pickupAllowed: false,
      deliveryAllowed: true,
      pickupNotes: "Updated notes",
      suggestedUses: "Updated uses",
    });

    const after = await prisma.material.findUnique({
      where: { id: material.id },
      select: {
        ownerId: true,
        categoryId: true,
        isFree: true,
        price: true,
        locationId: true,
        deliveryAllowed: true,
      },
    });

    assert.deepEqual(
      {
        ownerId: after?.ownerId,
        categoryId: after?.categoryId,
        isFree: after?.isFree,
        price: after?.price,
        locationId: after?.locationId,
      },
      before,
    );
    assert.equal(after?.deliveryAllowed, true);
  });

  test("updates UNAVAILABLE material with no blocking reservations", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "edit-unavailable",
      "UNAVAILABLE",
    );

    const updated = await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: `${TEST_MARKER} unavailable-updated`,
      description: `${TEST_MARKER} unavailable description`,
      quantity: 3,
      unit: "piece",
      condition: "GOOD",
      pickupAllowed: true,
      deliveryAllowed: false,
    });

    assert.equal(updated.title, `${TEST_MARKER} unavailable-updated`);
    assert.equal(updated.status, "UNAVAILABLE");
    assert.equal(updated.canEdit, true);
  });

  test("allows edit for PENDING_RESERVATION when quantity is not below held amount", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "edit-pending",
      "PENDING_RESERVATION",
    );

    const updated = await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: `${TEST_MARKER} pending-updated`,
      description: "Updated while partially held",
      quantity: 5,
      unit: "piece",
      condition: "GOOD",
      pickupAllowed: true,
      deliveryAllowed: false,
    });

    assert.equal(updated.title, `${TEST_MARKER} pending-updated`);
    assert.equal(updated.status, "PENDING_RESERVATION");
    assert.equal(updated.canEdit, true);
  });

  test("allows edit for RESERVED when quantity is not below held amount", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "edit-reserved",
      "RESERVED",
    );

    const updated = await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: `${TEST_MARKER} reserved-updated`,
      description: "Updated while reserved",
      quantity: 5,
      unit: "piece",
      condition: "GOOD",
      pickupAllowed: true,
      deliveryAllowed: false,
    });

    assert.equal(updated.title, `${TEST_MARKER} reserved-updated`);
    assert.equal(updated.status, "RESERVED");
    assert.equal(updated.canEdit, true);
  });

  test("rejects edit when quantity is below active held amount", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "edit-below-held",
      "AVAILABLE",
    );

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 3,
        status: "PENDING",
      },
    });
    ctx.createdReservationIds.push(reservation.id);

    await assert.rejects(
      () =>
        updateSupplierMaterial(ctx.supplierId, material.id, {
          title: "Blocked",
          description: "Quantity too low",
          quantity: 2,
          unit: "piece",
          condition: "GOOD",
          pickupAllowed: true,
          deliveryAllowed: false,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 400);
        assert.match(error.message, /held by active reservations/i);
        return true;
      },
    );
  });

  test("rejects edit for REUSED status", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "edit-reused",
      "REUSED",
    );

    await assert.rejects(
      () =>
        updateSupplierMaterial(ctx.supplierId, material.id, {
          title: "Blocked",
          description: "Blocked description",
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          pickupAllowed: true,
          deliveryAllowed: false,
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /reused material history/i);
        return true;
      },
    );
  });

  test('rejects edit when completed reservation history exists but allows valid quantity', async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      'edit-with-completed',
      'AVAILABLE',
    );

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    ctx.createdReservationIds.push(reservation.id);

    const updated = await updateSupplierMaterial(ctx.supplierId, material.id, {
      title: 'Updated after completed reservation',
      description: 'Updated description',
      quantity: 1,
      unit: 'piece',
      condition: 'GOOD',
      pickupAllowed: true,
      deliveryAllowed: false,
    });
    assert.equal(updated.title, 'Updated after completed reservation');
  });
});

describe("deleteSupplierMaterial", () => {
  const ctx: TestContext = {
    supplierId: "",
    otherSupplierId: "",
    categoryId: "",
    locationId: "",
    createdMaterialIds: [],
    createdUserIds: [],
    createdReservationIds: [],
    learnerId: "",
  };

  before(async () => {
    const category = await prisma.category.findFirst({
      where: { categoryType: { in: ["MATERIAL", "BOTH"] } },
      select: { id: true },
    });
    const location = await prisma.location.create({
      data: {
        country: "Palestine",
        city: "Nablus",
        area: `${TEST_MARKER}-delete`,
        visibility: "PUBLIC_APPROXIMATE",
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser("delete");
    const otherSupplier = await createSupplierUser("delete-other");
    const learner = await prisma.user.findFirst({
      where: { roles: { some: { role: "LEARNER" } } },
      select: { id: true },
    });

    assert.ok(category);
    assert.ok(learner);

    ctx.categoryId = category.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.otherSupplierId = otherSupplier.id;
    ctx.learnerId = learner.id;
    ctx.createdUserIds.push(supplier.id, otherSupplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test("deletes AVAILABLE material without reservation history", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "delete-available",
      "AVAILABLE",
    );

    await deleteSupplierMaterial(ctx.supplierId, material.id);

    const deleted = await prisma.material.findUnique({
      where: { id: material.id },
    });

    assert.equal(deleted, null);
    ctx.createdMaterialIds = ctx.createdMaterialIds.filter(
      (id) => id !== material.id,
    );
  });

  test("rejects REUSED material", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "delete-reused",
      "REUSED",
    );

    await assert.rejects(
      () => deleteSupplierMaterial(ctx.supplierId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /reused material history/i);
        return true;
      },
    );
  });

  test("rejects material with completed reservation history", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "delete-with-completed",
      "AVAILABLE",
    );

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: "COMPLETED",
        completedAt: new Date(),
      },
    });
    ctx.createdReservationIds.push(reservation.id);

    await assert.rejects(
      () => deleteSupplierMaterial(ctx.supplierId, material.id),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /active requests/i);
        return true;
      },
    );
  });
});
