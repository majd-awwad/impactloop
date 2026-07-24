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
  markSupplierMaterialUnavailable,
  restoreSupplierMaterialAvailable,
  updateSupplierMaterial,
} from "./supplier.service.js";
import * as supplierRepository from "./supplier.repository.js";
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
import { matchMaterialReference } from "../../services/material-reference-matching.service.js";
import * as priceRuleRequestsRepository from "../price-rule-requests/price-rule-requests.repository.js";
import * as categoryRequestsRepository from "../category-requests/category-requests.repository.js";

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
      where: {
        categoryType: { in: ["MATERIAL", "BOTH"] },
        isActive: true,
        materialFamilyConceptId: { not: null },
        materialFamilyConcept: {
          status: "ACTIVE",
          conceptType: "MATERIAL_FAMILY",
        },
      },
      select: {
        id: true,
        materialFamilyConcept: {
          select: { id: true, canonicalKey: true },
        },
      },
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
    assert.ok(category.materialFamilyConcept);
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
    const materialIds = ctx.createdMaterialIds.filter(
      (id): id is string => typeof id === "string" && id.length > 0,
    );
    const materials = materialIds.length
      ? await prisma.material.findMany({
          where: { id: { in: materialIds } },
          select: { locationId: true },
        })
      : [];
    const materialLocationIds = materials.map(
      (material) => material.locationId,
    );

    ctx.createdMaterialIds = materialIds;
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
    const payload = buildCreatePayload(`idempotent-same-key-${Date.now()}`);

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
    const payload = buildCreatePayload(`idempotent-rapid-${Date.now()}`);

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
    const title = `${TEST_MARKER} idempotent-post-insert-failure-${Date.now()}`;

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

  test("free create with unknown materialType persists family-only MaterialConcept", async () => {
    const material = await createSupplierMaterial(
      ctx.supplierId,
      buildCreatePayload("rp022-family-only"),
    );
    ctx.createdMaterialIds.push(material.id);

    const concepts = await prisma.materialConcept.findMany({
      where: { materialId: material.id },
      include: {
        concept: {
          select: { conceptType: true, status: true, canonicalKey: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.concept.conceptType, "MATERIAL_FAMILY");
    assert.equal(concepts[0]?.concept.status, "ACTIVE");
    assert.equal(material.isFree, true);
    assert.equal(material.images.length, 1);
  });

  test("free create with reviewed materialType persists family and form concepts", async () => {
    const material = await createSupplierMaterial(
      ctx.supplierId,
      buildCreatePayload("rp022-family-form", {
        materialName: "Arduino Uno",
        title: `${TEST_MARKER} rp022 arduino form`,
      }),
    );
    ctx.createdMaterialIds.push(material.id);

    const concepts = await prisma.materialConcept.findMany({
      where: { materialId: material.id },
      include: {
        concept: {
          select: { conceptType: true, canonicalKey: true },
        },
      },
    });

    assert.equal(material.materialType, "Arduino Uno");
    assert.equal(concepts.length, 2);
    const types = concepts.map((row) => row.concept.conceptType).sort();
    assert.deepEqual(types, ["MATERIAL_FAMILY", "MATERIAL_FORM"]);
    assert.ok(
      concepts.some(
        (row) => row.concept.canonicalKey === "material-form:arduino-uno",
      ),
    );
  });

  test("free create uses final category ownership for family concept", async () => {
    const owned = await prisma.category.findUnique({
      where: { id: ctx.categoryId },
      select: {
        materialFamilyConceptId: true,
        materialFamilyConcept: { select: { canonicalKey: true } },
      },
    });
    assert.ok(owned?.materialFamilyConceptId);

    const material = await createSupplierMaterial(
      ctx.supplierId,
      buildCreatePayload("rp022-final-category"),
    );
    ctx.createdMaterialIds.push(material.id);

    assert.equal(material.category.id, ctx.categoryId);

    const concepts = await prisma.materialConcept.findMany({
      where: { materialId: material.id },
      select: { conceptId: true },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.conceptId, owned.materialFamilyConceptId);
  });

  test("free create rejects category without taxonomy ownership", async () => {
    const orphan = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} orphan category ${Date.now()}`,
        nameAr: `${TEST_MARKER} orphan ar`,
        categoryType: "MATERIAL",
        isActive: true,
        materialFamilyConceptId: null,
      },
      select: { id: true },
    });

    try {
      await assert.rejects(
        () =>
          createSupplierMaterial(
            ctx.supplierId,
            buildCreatePayload("rp022-orphan-category", {
              categoryId: orphan.id,
            }),
          ),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.code, "CATEGORY_TAXONOMY_NOT_READY");
          assert.equal(error.statusCode, 409);
          return true;
        },
      );

      assert.equal(
        await prisma.material.count({
          where: { title: `${TEST_MARKER} rp022-orphan-category` },
        }),
        0,
      );
    } finally {
      await prisma.category.delete({ where: { id: orphan.id } });
    }
  });

  test("free taxonomy failure without injected tx does not leave orphan pickup Location", async () => {
    const locationMarker = `${TEST_MARKER}-rp022-orphan-loc-${Date.now()}`;
    const title = `${TEST_MARKER} rp022-location-atomicity`;
    const temporaryCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} loc atomicity ${Date.now()}`,
        nameAr: `${TEST_MARKER} loc atomicity ar`,
        categoryType: "MATERIAL",
        isActive: true,
        materialFamilyConceptId: null,
      },
      select: { id: true },
    });

    await prisma.supplierProfile.update({
      where: { userId: ctx.supplierId },
      data: { supplierType: "INDIVIDUAL_SUPPLIER" },
    });

    try {
      await assert.rejects(
        () =>
          createSupplierMaterial(ctx.supplierId, {
            materialName: "Unmatched create material",
            title,
            description: `${title} description`,
            categoryId: temporaryCategory.id,
            quantity: 1,
            unit: "piece",
            condition: "GOOD",
            isFree: true,
            price: null,
            currency: "NIS",
            pickupAllowed: true,
            deliveryAllowed: false,
            imageUrls: ["/uploads/materials/rp022-location-atomicity.jpg"],
            useDefaultPickupLocation: false,
            pickupLocation: {
              country: "Palestine",
              city: "Nablus",
              area: locationMarker,
              addressLine: `${locationMarker} address`,
              visibility: "ORDER_ONLY",
              isApproximate: true,
            },
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.code, "CATEGORY_TAXONOMY_NOT_READY");
          return true;
        },
      );

      assert.equal(await prisma.material.count({ where: { title } }), 0);
      assert.equal(
        await prisma.materialImage.count({
          where: { material: { title } },
        }),
        0,
      );
      assert.equal(
        await prisma.materialConcept.count({
          where: { material: { title } },
        }),
        0,
      );
      assert.equal(
        await prisma.location.count({
          where: {
            OR: [
              { area: locationMarker },
              { addressLine: `${locationMarker} address` },
            ],
          },
        }),
        0,
      );
    } finally {
      await prisma.supplierProfile.update({
        where: { userId: ctx.supplierId },
        data: { supplierType: "WORKSHOP" },
      });
      await prisma.category.delete({ where: { id: temporaryCategory.id } });
    }
  });

  test("idempotent free create replay keeps concept row count stable", async () => {
    const key = `test-create-${Date.now()}-rp022-concepts`;
    const payload = buildCreatePayload("rp022-idempotent-concepts");

    const first = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    ctx.createdMaterialIds.push(first.response.id);

    const before = await prisma.materialConcept.count({
      where: { materialId: first.response.id },
    });
    assert.equal(before, 1);

    const second = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    assert.equal(second.replayed, true);
    assert.equal(second.response.id, first.response.id);

    const after = await prisma.materialConcept.count({
      where: { materialId: first.response.id },
    });
    assert.equal(after, 1);
  });

  test("repository free create without conceptIds fails before Material write", async () => {
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: ctx.supplierId },
      select: { id: true },
    });
    assert.ok(profile);

    const title = `${TEST_MARKER} rp022-repo-no-concepts`;
    await assert.rejects(
      () =>
        supplierRepository.createSupplierMaterial({
          ownerId: ctx.supplierId,
          supplierProfileId: profile.id,
          categoryId: ctx.categoryId,
          locationId: ctx.locationId,
          title,
          description: `${title} description`,
          materialType: "Unmatched",
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          sourceType: "WORKSHOP_SURPLUS",
          isFree: true,
          price: null,
          currency: "NIS",
          pickupAllowed: true,
          deliveryAllowed: false,
          imageUrls: ["/uploads/materials/rp022-no-concepts.jpg"],
          conceptIds: undefined as unknown as string[],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "INTERNAL_ERROR");
        return true;
      },
    );

    assert.equal(await prisma.material.count({ where: { title } }), 0);
  });

  test("repository free create rejects duplicate conceptIds before Material write", async () => {
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: ctx.supplierId },
      select: { id: true },
    });
    const family = await prisma.taxonomyConcept.findFirst({
      where: { conceptType: "MATERIAL_FAMILY", status: "ACTIVE" },
      select: { id: true },
    });
    assert.ok(profile);
    assert.ok(family);

    const title = `${TEST_MARKER} rp022-repo-dup-concepts`;
    await assert.rejects(
      () =>
        supplierRepository.createSupplierMaterial({
          ownerId: ctx.supplierId,
          supplierProfileId: profile.id,
          categoryId: ctx.categoryId,
          locationId: ctx.locationId,
          title,
          description: `${title} description`,
          materialType: "Unmatched",
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          sourceType: "WORKSHOP_SURPLUS",
          isFree: true,
          price: null,
          currency: "NIS",
          pickupAllowed: true,
          deliveryAllowed: false,
          imageUrls: ["/uploads/materials/rp022-dup.jpg"],
          conceptIds: [family.id, family.id],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "INTERNAL_ERROR");
        return true;
      },
    );

    assert.equal(await prisma.material.count({ where: { title } }), 0);
  });

  test("repository paid create without conceptIds fails before Material write", async () => {
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: ctx.supplierId },
      select: { id: true },
    });
    assert.ok(profile);

    const title = `${TEST_MARKER} rp023-paid-repo-no-concepts`;
    await assert.rejects(
      () =>
        supplierRepository.createSupplierMaterial({
          ownerId: ctx.supplierId,
          supplierProfileId: profile.id,
          categoryId: ctx.categoryId,
          locationId: ctx.locationId,
          title,
          description: `${title} description`,
          materialType: "Paid widget",
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          sourceType: "WORKSHOP_SURPLUS",
          isFree: false,
          price: 10,
          currency: "NIS",
          pickupAllowed: true,
          deliveryAllowed: false,
          imageUrls: ["/uploads/materials/rp023-paid-no-concepts.jpg"],
          conceptIds: undefined as unknown as string[],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "INTERNAL_ERROR");
        assert.equal(
          (error.details as { reason?: string } | undefined)?.reason,
          "CONCEPT_IDS_CARDINALITY",
        );
        return true;
      },
    );

    assert.equal(await prisma.material.count({ where: { title } }), 0);
  });

  test("repository paid create rejects empty conceptIds array before Material write", async () => {
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: ctx.supplierId },
      select: { id: true },
    });
    assert.ok(profile);

    const title = `${TEST_MARKER} rp023-paid-empty-concepts`;
    await assert.rejects(
      () =>
        supplierRepository.createSupplierMaterial({
          ownerId: ctx.supplierId,
          supplierProfileId: profile.id,
          categoryId: ctx.categoryId,
          locationId: ctx.locationId,
          title,
          description: `${title} description`,
          materialType: "Paid widget",
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          sourceType: "WORKSHOP_SURPLUS",
          isFree: false,
          price: 10,
          currency: "NIS",
          pickupAllowed: true,
          deliveryAllowed: false,
          imageUrls: ["/uploads/materials/rp023-paid-empty.jpg"],
          conceptIds: [],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "INTERNAL_ERROR");
        assert.equal(
          (error.details as { reason?: string } | undefined)?.reason,
          "CONCEPT_IDS_CARDINALITY",
        );
        return true;
      },
    );

    assert.equal(await prisma.material.count({ where: { title } }), 0);
  });

  test("repository paid create with family conceptIds succeeds", async () => {
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: ctx.supplierId },
      select: { id: true },
    });
    const family = await prisma.taxonomyConcept.findFirst({
      where: { conceptType: "MATERIAL_FAMILY", status: "ACTIVE" },
      select: { id: true },
    });
    assert.ok(profile);
    assert.ok(family);

    const title = `${TEST_MARKER} rp023-paid-repo-family`;
    const material = await supplierRepository.createSupplierMaterial({
      ownerId: ctx.supplierId,
      supplierProfileId: profile.id,
      categoryId: ctx.categoryId,
      locationId: ctx.locationId,
      title,
      description: `${title} description`,
      materialType: "Paid widget",
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      sourceType: "WORKSHOP_SURPLUS",
      isFree: false,
      price: 10,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/rp023-paid-repo-family.jpg"],
      conceptIds: [family.id],
    });
    ctx.createdMaterialIds.push(material.id);

    assert.equal(
      await prisma.materialConcept.count({ where: { materialId: material.id } }),
      1,
    );
  });

  test("repository free create rejects blank concept IDs before Material write", async () => {
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: ctx.supplierId },
      select: { id: true },
    });
    assert.ok(profile);

    const title = `${TEST_MARKER} rp022-repo-blank-concepts`;
    await assert.rejects(
      () =>
        supplierRepository.createSupplierMaterial({
          ownerId: ctx.supplierId,
          supplierProfileId: profile.id,
          categoryId: ctx.categoryId,
          locationId: ctx.locationId,
          title,
          description: `${title} description`,
          materialType: "Unmatched",
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          sourceType: "WORKSHOP_SURPLUS",
          isFree: true,
          price: null,
          currency: "NIS",
          pickupAllowed: true,
          deliveryAllowed: false,
          imageUrls: ["/uploads/materials/rp022-blank.jpg"],
          conceptIds: ["   "],
        }),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "INTERNAL_ERROR");
        assert.equal(
          (error.details as { reason?: string } | undefined)?.reason,
          "CONCEPT_IDS_BLANK",
        );
        return true;
      },
    );

    assert.equal(await prisma.material.count({ where: { title } }), 0);
  });

  test("S3 paid PRR custom unmatched persists family-only MaterialConcept", async () => {
    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} rp023 s3 custom`,
        normalizedMaterialName: "rp023-s3-custom",
        unit: "piece",
        supplierPriceNis: 12,
        categoryId: ctx.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        aiSuggestedMaxUnitPriceNis: 20,
      },
    });

    const material = await createSupplierMaterial(ctx.supplierId, {
      materialName: `${TEST_MARKER} rp023 s3 custom`,
      title: `${TEST_MARKER} rp023 s3 custom`,
      description: `${TEST_MARKER} rp023 s3 custom description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD",
      isFree: false,
      price: 10,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/rp023-s3.jpg"],
      useDefaultPickupLocation: true,
      sourcePriceRuleRequestId: priceRuleRequest.id,
    });
    ctx.createdMaterialIds.push(material.id);

    assert.equal(material.category.id, ctx.categoryId);
    assert.equal(material.materialType, `${TEST_MARKER} rp023 s3 custom`);
    assert.equal(material.customMaterialType, `${TEST_MARKER} rp023 s3 custom`);
    assert.equal(material.price, 10);
    assert.equal(material.priceRuleId, null);

    const concepts = await prisma.materialConcept.findMany({
      where: { materialId: material.id },
      include: {
        concept: { select: { conceptType: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.concept.conceptType, "MATERIAL_FAMILY");

    const updatedRequest = await prisma.priceRuleRequest.findUnique({
      where: { id: priceRuleRequest.id },
      select: { publishedMaterialId: true },
    });
    assert.equal(updatedRequest?.publishedMaterialId, material.id);

    await prisma.priceRuleRequest.delete({
      where: { id: priceRuleRequest.id },
    });
  });

  test("repository free create rolls back Material and images when concept write fails", async () => {
    const profile = await prisma.supplierProfile.findUnique({
      where: { userId: ctx.supplierId },
      select: { id: true },
    });
    const family = await prisma.taxonomyConcept.findFirst({
      where: { conceptType: "MATERIAL_FAMILY", status: "ACTIVE" },
      select: { id: true },
    });
    assert.ok(profile);
    assert.ok(family);

    const title = `${TEST_MARKER} rp022-repo-concept-rollback`;
    await assert.rejects(
      () =>
        supplierRepository.createSupplierMaterial({
          ownerId: ctx.supplierId,
          supplierProfileId: profile.id,
          categoryId: ctx.categoryId,
          locationId: ctx.locationId,
          title,
          description: `${title} description`,
          materialType: "Unmatched",
          quantity: 1,
          unit: "piece",
          condition: "GOOD",
          sourceType: "WORKSHOP_SURPLUS",
          isFree: true,
          price: null,
          currency: "NIS",
          pickupAllowed: true,
          deliveryAllowed: false,
          imageUrls: ["/uploads/materials/rp022-repo-rollback.jpg"],
          conceptIds: [family.id, "missing-concept-id-for-repo-rollback"],
        }),
      () => true,
    );

    assert.equal(await prisma.material.count({ where: { title } }), 0);
    assert.equal(
      await prisma.materialImage.count({
        where: { material: { title } },
      }),
      0,
    );
    assert.equal(
      await prisma.materialConcept.count({
        where: { material: { title } },
      }),
      0,
    );
  });

  test("failed taxonomy assignment leaves key free for corrected same-key retry", async () => {
    const key = `test-create-${Date.now()}-rp022-taxonomy-retry`;
    const temporaryCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} temp taxonomy ${Date.now()}`,
        nameAr: `${TEST_MARKER} temp taxonomy ar`,
        categoryType: "MATERIAL",
        isActive: true,
        materialFamilyConceptId: null,
      },
      select: { id: true },
    });
    const payload = buildCreatePayload("rp022-taxonomy-retry", {
      categoryId: temporaryCategory.id,
    });

    try {
      await assert.rejects(
        () => createSupplierMaterialIdempotent(ctx.supplierId, payload, key),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.code, "CATEGORY_TAXONOMY_NOT_READY");
          return true;
        },
      );

      assert.equal(
        await prisma.material.count({
          where: { title: payload.title },
        }),
        0,
      );
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

      const family = await prisma.taxonomyConcept.findFirst({
        where: { conceptType: "MATERIAL_FAMILY", status: "ACTIVE" },
        select: { id: true },
      });
      assert.ok(family);

      await prisma.category.update({
        where: { id: temporaryCategory.id },
        data: { materialFamilyConceptId: family.id },
      });

      const created = await createSupplierMaterialIdempotent(
        ctx.supplierId,
        payload,
        key,
      );
      const createdMaterialId = created.response.id;

      assert.equal(created.replayed, false);
      assert.equal(
        await prisma.material.count({ where: { title: payload.title } }),
        1,
      );
      assert.equal(
        await prisma.materialConcept.count({
          where: { materialId: createdMaterialId },
        }),
        1,
      );

      const replay = await createSupplierMaterialIdempotent(
        ctx.supplierId,
        payload,
        key,
      );
      assert.equal(replay.replayed, true);
      assert.equal(replay.response.id, createdMaterialId);
      assert.equal(
        await prisma.material.count({ where: { title: payload.title } }),
        1,
      );
      assert.equal(
        await prisma.materialConcept.count({
          where: { materialId: createdMaterialId },
        }),
        1,
      );
    } finally {
      const leftoverMaterials = await prisma.material.findMany({
        where: { categoryId: temporaryCategory.id },
        select: { id: true, locationId: true },
      });
      const leftoverMaterialIds = leftoverMaterials.map((row) => row.id);
      const leftoverLocationIds = [
        ...new Set(leftoverMaterials.map((row) => row.locationId)),
      ];

      if (leftoverMaterialIds.length > 0) {
        await prisma.materialConcept.deleteMany({
          where: { materialId: { in: leftoverMaterialIds } },
        });
        await prisma.materialImage.deleteMany({
          where: { materialId: { in: leftoverMaterialIds } },
        });
        await prisma.material.deleteMany({
          where: { id: { in: leftoverMaterialIds } },
        });
      }
      if (leftoverLocationIds.length > 0) {
        await prisma.location.deleteMany({
          where: { id: { in: leftoverLocationIds } },
        });
      }
      await prisma.idempotencyRecord.deleteMany({
        where: {
          userId: ctx.supplierId,
          scope: SUPPLIER_CREATE_MATERIAL_SCOPE,
          key,
        },
      });
      await prisma.category.delete({ where: { id: temporaryCategory.id } });
    }
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
      price: 13,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/test-approved-price-rule.jpg"],
      useDefaultPickupLocation: true,
      sourcePriceRuleRequestId: priceRuleRequest.id,
    });
    ctx.createdMaterialIds.push(material.id);

    assert.equal(material.price, 13);
    assert.equal(material.maxAllowedPriceAtCheck, 13.65);

    const concepts = await prisma.materialConcept.findMany({
      where: { materialId: material.id },
      include: { concept: { select: { conceptType: true } } },
      orderBy: { createdAt: "asc" },
    });
    assert.equal(concepts.length, 1);
    assert.equal(concepts[0]?.concept.conceptType, "MATERIAL_FAMILY");

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
        supplierPriceNis: 13.65,
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
      price: 13.65,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/test-boundary-price.jpg"],
      useDefaultPickupLocation: true,
      sourcePriceRuleRequestId: priceRuleRequest.id,
    });
    ctx.createdMaterialIds.push(material.id);

    assert.equal(material.price, 13.65);
    assert.equal(material.maxAllowedPriceAtCheck, 13.65);

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
          /Maximum allowed price is 13\.65 NIS per piece/,
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

  test("S1 paid PRR with active linked MaterialType persists family and form concepts", async () => {
    const arduino = await prisma.materialType.findFirst({
      where: { nameEn: "Arduino Uno", isActive: true },
      select: { id: true, nameEn: true, categoryId: true, defaultUnit: true },
    });
    assert.ok(arduino, "Expected seeded Arduino Uno MaterialType");

    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: "Arduino Uno",
        normalizedMaterialName: "arduino-uno",
        materialTypeId: arduino.id,
        unit: arduino.defaultUnit || "piece",
        supplierPriceNis: 10,
        categoryId: arduino.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        aiSuggestedMaxUnitPriceNis: 50,
      },
    });

    const key = `test-create-${Date.now()}-rp023-s1`;
    const payload: CreateSupplierMaterialInput = {
      materialName: "Arduino Uno",
      title: `${TEST_MARKER} rp023 s1 arduino`,
      description: `${TEST_MARKER} rp023 s1 description`,
      categoryId: arduino.categoryId,
      quantity: 1,
      unit: arduino.defaultUnit || "piece",
      condition: "GOOD",
      isFree: false,
      price: 10,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/rp023-s1.jpg"],
      useDefaultPickupLocation: true,
      sourcePriceRuleRequestId: priceRuleRequest.id,
    };

    const created = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    const material = created.response;
    ctx.createdMaterialIds.push(material.id);

    assert.equal(material.materialType, "Arduino Uno");
    assert.equal(material.category.id, arduino.categoryId);
    assert.equal(material.customMaterialType, null);
    assert.equal(material.price, 10);
    assert.equal(material.priceRuleId, null);
    assert.ok(material.maxAllowedPriceAtCheck != null);

    const concepts = await prisma.materialConcept.findMany({
      where: { materialId: material.id },
      include: {
        concept: { select: { conceptType: true, canonicalKey: true } },
      },
    });
    assert.equal(concepts.length, 2);
    assert.deepEqual(
      concepts.map((row) => row.concept.conceptType).sort(),
      ["MATERIAL_FAMILY", "MATERIAL_FORM"],
    );
    assert.ok(
      concepts.some(
        (row) => row.concept.canonicalKey === "material-form:arduino-uno",
      ),
    );

    const beforeCount = await prisma.materialConcept.count({
      where: { materialId: material.id },
    });
    const replay = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    assert.equal(replay.response.id, material.id);
    assert.equal(
      await prisma.materialConcept.count({ where: { materialId: material.id } }),
      beforeCount,
    );

    await prisma.priceRuleRequest.delete({
      where: { id: priceRuleRequest.id },
    });
  });

  test("S2 paid PRR inactive linked MaterialType falls back to matched active type", async () => {
    const arduino = await prisma.materialType.findFirst({
      where: { nameEn: "Arduino Uno", isActive: true },
      select: { id: true, nameEn: true, categoryId: true, defaultUnit: true },
    });
    assert.ok(arduino);

    const inactiveType = await prisma.materialType.create({
      data: {
        categoryId: arduino.categoryId,
        nameEn: `${TEST_MARKER} inactive s2 type ${Date.now()}`,
        normalizedName: `inactive-s2-${Date.now()}`,
        defaultUnit: "piece",
        isActive: false,
      },
      select: { id: true },
    });

    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: "Arduino Uno",
        normalizedMaterialName: "arduino-uno-s2",
        materialTypeId: inactiveType.id,
        unit: "piece",
        supplierPriceNis: 10,
        categoryId: arduino.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        aiSuggestedMaxUnitPriceNis: 50,
      },
    });

    try {
      const material = await createSupplierMaterial(ctx.supplierId, {
        materialName: "Arduino Uno",
        title: `${TEST_MARKER} rp023 s2 fallback`,
        description: `${TEST_MARKER} rp023 s2 description`,
        categoryId: arduino.categoryId,
        quantity: 1,
        unit: "piece",
        condition: "GOOD",
        isFree: false,
        price: 10,
        currency: "NIS",
        pickupAllowed: true,
        deliveryAllowed: false,
        imageUrls: ["/uploads/materials/rp023-s2.jpg"],
        useDefaultPickupLocation: true,
        sourcePriceRuleRequestId: priceRuleRequest.id,
      });
      ctx.createdMaterialIds.push(material.id);

      assert.equal(material.materialType, "Arduino Uno");
      assert.equal(material.materialTypeId, arduino.id);
      assert.equal(material.category.id, arduino.categoryId);
      assert.equal(material.customMaterialType, null);
      assert.equal(material.priceRuleId, null);

      const concepts = await prisma.materialConcept.findMany({
        where: { materialId: material.id },
        include: {
          concept: { select: { conceptType: true, canonicalKey: true } },
        },
      });
      assert.equal(concepts.length, 2);
      assert.ok(
        concepts.some(
          (row) => row.concept.canonicalKey === "material-form:arduino-uno",
        ),
      );

      const published = await prisma.priceRuleRequest.findUnique({
        where: { id: priceRuleRequest.id },
        select: { publishedMaterialId: true },
      });
      assert.equal(published?.publishedMaterialId, material.id);
    } finally {
      await prisma.priceRuleRequest.delete({
        where: { id: priceRuleRequest.id },
      });
      await prisma.materialType.delete({ where: { id: inactiveType.id } });
    }
  });

  test("S4 ordinary paid create through active price rule persists concepts", async () => {
    const arduino = await prisma.materialType.findFirst({
      where: { nameEn: "Arduino Uno", isActive: true },
      select: { id: true, nameEn: true, categoryId: true, defaultUnit: true },
    });
    assert.ok(arduino);

    const rule = await prisma.materialPriceRule.findFirst({
      where: {
        materialTypeId: arduino.id,
        isActive: true,
        status: "ACTIVE",
        currency: "NIS",
      },
      orderBy: { updatedAt: "desc" },
    });
    assert.ok(rule, "Expected active price rule for Arduino Uno");
    assert.ok(rule.maxAllowedUnitPriceNis != null);

    const baseMax = Number(rule.maxAllowedUnitPriceNis);
    const adjustedMax = Math.round(baseMax * 0.65 * 100) / 100;
    const price = Math.min(adjustedMax, baseMax * 0.5);

    const key = `test-create-${Date.now()}-rp023-s4`;
    const payload: CreateSupplierMaterialInput = {
      materialName: "Arduino Uno",
      title: `${TEST_MARKER} rp023 s4 ordinary`,
      description: `${TEST_MARKER} rp023 s4 description`,
      categoryId: arduino.categoryId,
      quantity: 1,
      unit: rule.unit,
      condition: "GOOD",
      isFree: false,
      price,
      currency: "NIS",
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/rp023-s4.jpg"],
      useDefaultPickupLocation: true,
    };

    const created = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    const material = created.response;
    ctx.createdMaterialIds.push(material.id);

    assert.equal(material.materialType, "Arduino Uno");
    assert.equal(material.materialTypeId, arduino.id);
    assert.equal(material.category.id, arduino.categoryId);
    assert.equal(material.price, price);
    assert.equal(material.priceRuleId, rule.id);
    assert.ok(material.maxAllowedPriceAtCheck != null);

    const concepts = await prisma.materialConcept.findMany({
      where: { materialId: material.id },
      include: {
        concept: { select: { conceptType: true, canonicalKey: true } },
      },
    });
    assert.equal(concepts.length, 2);
    assert.ok(
      concepts.some(
        (row) => row.concept.canonicalKey === "material-form:arduino-uno",
      ),
    );

    const beforeCount = await prisma.materialConcept.count({
      where: { materialId: material.id },
    });
    const replay = await createSupplierMaterialIdempotent(
      ctx.supplierId,
      payload,
      key,
    );
    assert.equal(replay.response.id, material.id);
    assert.equal(
      await prisma.materialConcept.count({ where: { materialId: material.id } }),
      beforeCount,
    );
  });

  test("two different idempotency keys cannot both consume one approved PRR", async () => {
    const stamp = Date.now();
    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} rp023 race prr ${stamp}`,
        normalizedMaterialName: `rp023-race-${stamp}`,
        unit: "piece",
        supplierPriceNis: 12,
        categoryId: ctx.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        aiSuggestedMaxUnitPriceNis: 30,
      },
    });

    const basePayload = {
      materialName: `${TEST_MARKER} rp023 race prr ${stamp}`,
      description: `${TEST_MARKER} rp023 race description`,
      categoryId: ctx.categoryId,
      quantity: 1,
      unit: "piece",
      condition: "GOOD" as const,
      isFree: false as const,
      price: 10,
      currency: "NIS" as const,
      pickupAllowed: true,
      deliveryAllowed: false,
      imageUrls: ["/uploads/materials/rp023-race.jpg"],
      useDefaultPickupLocation: true,
      sourcePriceRuleRequestId: priceRuleRequest.id,
    };

    const keyA = `test-create-${stamp}-rp023-race-a`;
    const keyB = `test-create-${stamp}-rp023-race-b`;
    const titleA = `${TEST_MARKER} rp023 race a ${stamp}`;
    const titleB = `${TEST_MARKER} rp023 race b ${stamp}`;

    const results = await Promise.allSettled([
      createSupplierMaterialIdempotent(
        ctx.supplierId,
        { ...basePayload, title: titleA },
        keyA,
      ),
      createSupplierMaterialIdempotent(
        ctx.supplierId,
        { ...basePayload, title: titleB },
        keyB,
      ),
    ]);

    const fulfilled = results.filter(
      (
        result,
      ): result is PromiseFulfilledResult<
        Awaited<ReturnType<typeof createSupplierMaterialIdempotent>>
      > => result.status === "fulfilled",
    );
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(
      fulfilled.length,
      1,
      `expected one winner, got fulfilled=${fulfilled.length} rejected=${rejected.length} reasons=${rejected
        .map((r) =>
          r.status === "rejected" && r.reason instanceof AppError
            ? `${r.reason.code}:${r.reason.message}`
            : String(r.reason),
        )
        .join(" | ")}`,
    );
    assert.equal(rejected.length, 1);

    const winner = fulfilled[0]!.value.response;
    ctx.createdMaterialIds.push(winner.id);

    const loserError = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(loserError instanceof AppError);
    assert.ok(
      loserError.code === "CONFLICT" ||
        (loserError.details as { reason?: string } | undefined)?.reason ===
          "PRICE_TOO_HIGH" ||
        loserError.statusCode === 409,
      `loser code=${loserError.code}`,
    );

    assert.equal(
      await prisma.material.count({
        where: { title: { in: [titleA, titleB] } },
      }),
      1,
    );
    assert.equal(
      await prisma.materialConcept.count({
        where: { materialId: winner.id },
      }),
      1,
    );

    const published = await prisma.priceRuleRequest.findUnique({
      where: { id: priceRuleRequest.id },
      select: { publishedMaterialId: true },
    });
    assert.equal(published?.publishedMaterialId, winner.id);

    const loserKey = results[0]?.status === "rejected" ? keyA : keyB;
    const loserRecord = await prisma.idempotencyRecord.findUnique({
      where: {
        userId_scope_key: {
          userId: ctx.supplierId,
          scope: SUPPLIER_CREATE_MATERIAL_SCOPE,
          key: loserKey,
        },
      },
    });
    assert.notEqual(loserRecord?.status, "SUCCEEDED");

    await prisma.priceRuleRequest.delete({
      where: { id: priceRuleRequest.id },
    });
  });

  test("paid taxonomy failure with custom pickup leaves no orphan Location", async () => {
    const locationMarker = `${TEST_MARKER}-rp023-orphan-loc-${Date.now()}`;
    const title = `${TEST_MARKER} rp023 paid location atomicity`;
    const temporaryCategory = await prisma.category.create({
      data: {
        nameEn: `${TEST_MARKER} paid loc atomicity ${Date.now()}`,
        nameAr: `${TEST_MARKER} paid loc atomicity ar`,
        categoryType: "MATERIAL",
        isActive: true,
        materialFamilyConceptId: null,
      },
      select: { id: true },
    });

    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} paid loc widget`,
        normalizedMaterialName: `paid-loc-${Date.now()}`,
        unit: "piece",
        supplierPriceNis: 10,
        categoryId: temporaryCategory.id,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        aiSuggestedMaxUnitPriceNis: 20,
      },
    });

    await prisma.supplierProfile.update({
      where: { userId: ctx.supplierId },
      data: { supplierType: "INDIVIDUAL_SUPPLIER" },
    });

    try {
      await assert.rejects(
        () =>
          createSupplierMaterial(ctx.supplierId, {
            materialName: `${TEST_MARKER} paid loc widget`,
            title,
            description: `${title} description`,
            categoryId: temporaryCategory.id,
            quantity: 1,
            unit: "piece",
            condition: "GOOD",
            isFree: false,
            price: 10,
            currency: "NIS",
            pickupAllowed: true,
            deliveryAllowed: false,
            imageUrls: ["/uploads/materials/rp023-location-atomicity.jpg"],
            useDefaultPickupLocation: false,
            pickupLocation: {
              country: "Palestine",
              city: "Nablus",
              area: locationMarker,
              addressLine: `${locationMarker} address`,
              visibility: "PRIVATE" as const,
              isApproximate: true,
            },
            sourcePriceRuleRequestId: priceRuleRequest.id,
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.code, "CATEGORY_TAXONOMY_NOT_READY");
          return true;
        },
      );

      assert.equal(await prisma.material.count({ where: { title } }), 0);
      assert.equal(
        await prisma.location.count({ where: { area: locationMarker } }),
        0,
      );
      assert.equal(
        await prisma.materialConcept.count({
          where: { material: { title } },
        }),
        0,
      );
      const request = await prisma.priceRuleRequest.findUnique({
        where: { id: priceRuleRequest.id },
        select: { publishedMaterialId: true },
      });
      assert.equal(request?.publishedMaterialId, null);
    } finally {
      await prisma.supplierProfile.update({
        where: { userId: ctx.supplierId },
        data: { supplierType: "WORKSHOP" },
      });
      await prisma.priceRuleRequest.delete({
        where: { id: priceRuleRequest.id },
      });
      await prisma.category.delete({ where: { id: temporaryCategory.id } });
    }
  });

  test("matchMaterialReference respects uncommitted MaterialType state on transaction client", async () => {
    const arduino = await prisma.materialType.findFirst({
      where: { nameEn: "Arduino Uno", isActive: true },
      select: { id: true, categoryId: true },
    });
    assert.ok(arduino);

    await prisma.$transaction(async (tx) => {
      await tx.materialType.update({
        where: { id: arduino.id },
        data: { isActive: false },
      });

      const inTx = await matchMaterialReference({
        materialName: "Arduino Uno",
        categoryId: arduino.categoryId,
        client: tx,
      });
      assert.notEqual(inTx.status, "MATCHED");

      throw new Error("rollback-fixture");
    }).catch((error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "rollback-fixture");
    });

    const after = await matchMaterialReference({
      materialName: "Arduino Uno",
      categoryId: arduino.categoryId,
    });
    assert.equal(after.status, "MATCHED");
    if (after.status === "MATCHED") {
      assert.equal(after.materialType.id, arduino.id);
    }
  });

  test("PRR NO_APPROVED_MAX falls through to ordinary branch inside transaction", async () => {
    const arduino = await prisma.materialType.findFirst({
      where: { nameEn: "Arduino Uno", isActive: true },
      select: { id: true, nameEn: true, categoryId: true, defaultUnit: true },
    });
    assert.ok(arduino);

    const rule = await prisma.materialPriceRule.findFirst({
      where: {
        materialTypeId: arduino.id,
        isActive: true,
        status: "ACTIVE",
        currency: "NIS",
      },
      orderBy: { updatedAt: "desc" },
    });
    assert.ok(rule);
    assert.ok(rule.maxAllowedUnitPriceNis != null);

    const baseMax = Number(rule.maxAllowedUnitPriceNis);
    const price = Math.round(baseMax * 0.5 * 100) / 100;

    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: "Arduino Uno",
        normalizedMaterialName: `arduino-no-max-${Date.now()}`,
        materialTypeId: arduino.id,
        unit: rule.unit,
        supplierPriceNis: price,
        categoryId: arduino.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "PENDING",
        aiSuggestedMaxUnitPriceNis: null,
        adminApprovedMaxUnitPriceNis: null,
      },
    });

    try {
      const material = await createSupplierMaterial(ctx.supplierId, {
        materialName: "Arduino Uno",
        title: `${TEST_MARKER} rp023 no-approved-max`,
        description: `${TEST_MARKER} rp023 no-approved-max description`,
        categoryId: arduino.categoryId,
        quantity: 1,
        unit: rule.unit,
        condition: "GOOD",
        isFree: false,
        price,
        currency: "NIS",
        pickupAllowed: true,
        deliveryAllowed: false,
        imageUrls: ["/uploads/materials/rp023-no-max.jpg"],
        useDefaultPickupLocation: true,
        sourcePriceRuleRequestId: priceRuleRequest.id,
      });
      ctx.createdMaterialIds.push(material.id);

      assert.equal(material.materialType, "Arduino Uno");
      assert.equal(material.materialTypeId, arduino.id);
      assert.equal(material.priceRuleId, rule.id);
      assert.ok(material.maxAllowedPriceAtCheck != null);

      const concepts = await prisma.materialConcept.findMany({
        where: { materialId: material.id },
        include: {
          concept: { select: { conceptType: true, canonicalKey: true } },
        },
      });
      assert.equal(concepts.length, 2);
      assert.ok(
        concepts.some(
          (row) => row.concept.canonicalKey === "material-form:arduino-uno",
        ),
      );

      const published = await prisma.priceRuleRequest.findUnique({
        where: { id: priceRuleRequest.id },
        select: { publishedMaterialId: true },
      });
      assert.equal(published?.publishedMaterialId, material.id);
    } finally {
      await prisma.priceRuleRequest.delete({
        where: { id: priceRuleRequest.id },
      });
    }
  });

  test("markPriceRuleRequestPublished rejects stale expectedUpdatedAt", async () => {
    const request = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} stale prr`,
        normalizedMaterialName: `stale-prr-${Date.now()}`,
        unit: "piece",
        supplierPriceNis: 10,
        categoryId: ctx.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        aiSuggestedMaxUnitPriceNis: 20,
      },
    });

    const snapshot = await prisma.priceRuleRequest.findUniqueOrThrow({
      where: { id: request.id },
      select: { id: true, updatedAt: true },
    });

    await prisma.priceRuleRequest.update({
      where: { id: request.id },
      data: { moderatorNote: `changed-${Date.now()}` },
    });

    const result = await priceRuleRequestsRepository.markPriceRuleRequestPublished({
      id: snapshot.id,
      materialId: "00000000-0000-0000-0000-000000000001",
      requestedByUserId: ctx.supplierId,
      expectedUpdatedAt: snapshot.updatedAt,
    });
    assert.equal(result.count, 0);

    const after = await prisma.priceRuleRequest.findUniqueOrThrow({
      where: { id: request.id },
      select: { publishedMaterialId: true },
    });
    assert.equal(after.publishedMaterialId, null);

    await prisma.priceRuleRequest.delete({ where: { id: request.id } });
  });

  test("markCategoryRequestPublished rejects stale expectedUpdatedAt", async () => {
    const request = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} stale category`,
        normalizedRequestedName: `stale-cat-${Date.now()}`,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        approvedCategoryId: ctx.categoryId,
      },
    });

    const snapshot = await prisma.categoryRequest.findUniqueOrThrow({
      where: { id: request.id },
      select: { id: true, updatedAt: true, approvedCategoryId: true },
    });

    await prisma.categoryRequest.update({
      where: { id: request.id },
      data: { moderatorNote: `changed-${Date.now()}` },
    });

    const result = await categoryRequestsRepository.markCategoryRequestPublished({
      id: snapshot.id,
      materialId: "00000000-0000-0000-0000-000000000001",
      requestedByUserId: ctx.supplierId,
      expectedUpdatedAt: snapshot.updatedAt,
      expectedApprovedCategoryId: snapshot.approvedCategoryId!,
    });
    assert.equal(result.count, 0);

    const after = await prisma.categoryRequest.findUniqueOrThrow({
      where: { id: request.id },
      select: { publishedMaterialId: true },
    });
    assert.equal(after.publishedMaterialId, null);

    await prisma.categoryRequest.delete({ where: { id: request.id } });
  });

  test("PENDING category request with null approvedCategoryId rejects free create", async () => {
    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} pending null approved`,
        normalizedRequestedName: `pending-null-${Date.now()}`,
        requestedByUserId: ctx.supplierId,
        status: "PENDING",
        approvedCategoryId: null,
      },
    });

    const title = `${TEST_MARKER} rp023 pending category request`;
    const locationMarker = `${TEST_MARKER}-pending-cat-${Date.now()}`;
    await prisma.supplierProfile.update({
      where: { userId: ctx.supplierId },
      data: { supplierType: "INDIVIDUAL_SUPPLIER" },
    });

    try {
      await assert.rejects(
        () =>
          createSupplierMaterial(ctx.supplierId, {
            materialName: `${TEST_MARKER} pending cat material`,
            title,
            description: `${title} description`,
            categoryId: ctx.categoryId,
            quantity: 1,
            unit: "piece",
            condition: "GOOD",
            isFree: true,
            price: null,
            currency: "NIS",
            pickupAllowed: true,
            deliveryAllowed: false,
            imageUrls: ["/uploads/materials/rp023-pending-cat.jpg"],
            useDefaultPickupLocation: false,
            pickupLocation: {
              country: "Palestine",
              city: "Nablus",
              area: locationMarker,
              addressLine: `${locationMarker} address`,
              visibility: "PRIVATE",
              isApproximate: true,
            },
            sourceCategoryRequestId: categoryRequest.id,
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, "CONFLICT");
          assert.equal(
            (error.details as { reason?: string } | undefined)?.reason,
            "CATEGORY_REQUEST_NOT_APPROVED",
          );
          return true;
        },
      );

      assert.equal(await prisma.material.count({ where: { title } }), 0);
      assert.equal(
        await prisma.location.count({ where: { area: locationMarker } }),
        0,
      );
      assert.equal(
        await prisma.materialConcept.count({
          where: { material: { title } },
        }),
        0,
      );
      const request = await prisma.categoryRequest.findUnique({
        where: { id: categoryRequest.id },
        select: { publishedMaterialId: true },
      });
      assert.equal(request?.publishedMaterialId, null);
    } finally {
      await prisma.supplierProfile.update({
        where: { userId: ctx.supplierId },
        data: { supplierType: "WORKSHOP" },
      });
      await prisma.categoryRequest.delete({
        where: { id: categoryRequest.id },
      });
    }
  });

  test("APPROVED category request with null approvedCategoryId rejects before persistence", async () => {
    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} approved null category`,
        normalizedRequestedName: `approved-null-${Date.now()}`,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        approvedCategoryId: null,
      },
    });

    const title = `${TEST_MARKER} rp023 approved null category`;
    try {
      await assert.rejects(
        () =>
          createSupplierMaterial(ctx.supplierId, {
            materialName: `${TEST_MARKER} approved null material`,
            title,
            description: `${title} description`,
            categoryId: ctx.categoryId,
            quantity: 1,
            unit: "piece",
            condition: "GOOD",
            isFree: true,
            price: null,
            currency: "NIS",
            pickupAllowed: true,
            deliveryAllowed: false,
            imageUrls: ["/uploads/materials/rp023-approved-null.jpg"],
            useDefaultPickupLocation: true,
            sourceCategoryRequestId: categoryRequest.id,
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, "CONFLICT");
          assert.equal(
            (error.details as { reason?: string } | undefined)?.reason,
            "CATEGORY_REQUEST_MISSING_APPROVED_CATEGORY",
          );
          return true;
        },
      );

      assert.equal(await prisma.material.count({ where: { title } }), 0);
      const request = await prisma.categoryRequest.findUnique({
        where: { id: categoryRequest.id },
        select: { publishedMaterialId: true },
      });
      assert.equal(request?.publishedMaterialId, null);
    } finally {
      await prisma.categoryRequest.delete({
        where: { id: categoryRequest.id },
      });
    }
  });

  test("REJECTED category request rejects paid create before persistence", async () => {
    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} rejected category`,
        normalizedRequestedName: `rejected-cat-${Date.now()}`,
        requestedByUserId: ctx.supplierId,
        status: "REJECTED",
        approvedCategoryId: ctx.categoryId,
      },
    });

    const priceRuleRequest = await prisma.priceRuleRequest.create({
      data: {
        materialName: `${TEST_MARKER} rejected-cat paid`,
        normalizedMaterialName: `rejected-cat-paid-${Date.now()}`,
        unit: "piece",
        supplierPriceNis: 10,
        categoryId: ctx.categoryId,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        aiSuggestedMaxUnitPriceNis: 20,
      },
    });

    const title = `${TEST_MARKER} rp023 rejected category paid`;
    try {
      await assert.rejects(
        () =>
          createSupplierMaterial(ctx.supplierId, {
            materialName: `${TEST_MARKER} rejected-cat paid`,
            title,
            description: `${title} description`,
            categoryId: ctx.categoryId,
            quantity: 1,
            unit: "piece",
            condition: "GOOD",
            isFree: false,
            price: 10,
            currency: "NIS",
            pickupAllowed: true,
            deliveryAllowed: false,
            imageUrls: ["/uploads/materials/rp023-rejected-cat.jpg"],
            useDefaultPickupLocation: true,
            sourceCategoryRequestId: categoryRequest.id,
            sourcePriceRuleRequestId: priceRuleRequest.id,
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, "CONFLICT");
          assert.equal(
            (error.details as { reason?: string } | undefined)?.reason,
            "CATEGORY_REQUEST_NOT_APPROVED",
          );
          return true;
        },
      );

      assert.equal(await prisma.material.count({ where: { title } }), 0);
      assert.equal(
        await prisma.materialConcept.count({
          where: { material: { title } },
        }),
        0,
      );
      const cat = await prisma.categoryRequest.findUnique({
        where: { id: categoryRequest.id },
        select: { publishedMaterialId: true },
      });
      assert.equal(cat?.publishedMaterialId, null);
      const prr = await prisma.priceRuleRequest.findUnique({
        where: { id: priceRuleRequest.id },
        select: { publishedMaterialId: true },
      });
      assert.equal(prr?.publishedMaterialId, null);
    } finally {
      await prisma.priceRuleRequest.delete({
        where: { id: priceRuleRequest.id },
      });
      await prisma.categoryRequest.delete({
        where: { id: categoryRequest.id },
      });
    }
  });

  test("markCategoryRequestPublished conditional consume binds status and approved category", async () => {
    const pending = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} consume pending`,
        normalizedRequestedName: `consume-pending-${Date.now()}`,
        requestedByUserId: ctx.supplierId,
        status: "PENDING",
        approvedCategoryId: null,
      },
    });
    const approved = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} consume approved`,
        normalizedRequestedName: `consume-approved-${Date.now()}`,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        approvedCategoryId: ctx.categoryId,
      },
    });
    const profile = await prisma.supplierProfile.findUniqueOrThrow({
      where: { userId: ctx.supplierId },
      select: { id: true },
    });
    const consumeMaterial = await prisma.material.create({
      data: {
        ownerId: ctx.supplierId,
        supplierProfileId: profile.id,
        categoryId: ctx.categoryId,
        locationId: ctx.locationId,
        title: `${TEST_MARKER} consume mark material`,
        description: `${TEST_MARKER} consume mark description`,
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
    ctx.createdMaterialIds.push(consumeMaterial.id);

    try {
      const pendingSnapshot = await prisma.categoryRequest.findUniqueOrThrow({
        where: { id: pending.id },
        select: { updatedAt: true },
      });
      const pendingResult =
        await categoryRequestsRepository.markCategoryRequestPublished({
          id: pending.id,
          materialId: consumeMaterial.id,
          requestedByUserId: ctx.supplierId,
          expectedUpdatedAt: pendingSnapshot.updatedAt,
          expectedApprovedCategoryId: ctx.categoryId,
        });
      assert.equal(pendingResult.count, 0);

      const approvedSnapshot = await prisma.categoryRequest.findUniqueOrThrow({
        where: { id: approved.id },
        select: { updatedAt: true, approvedCategoryId: true },
      });
      const wrongCategory =
        await categoryRequestsRepository.markCategoryRequestPublished({
          id: approved.id,
          materialId: consumeMaterial.id,
          requestedByUserId: ctx.supplierId,
          expectedUpdatedAt: approvedSnapshot.updatedAt,
          expectedApprovedCategoryId: "00000000-0000-0000-0000-000000000099",
        });
      assert.equal(wrongCategory.count, 0);

      const success = await categoryRequestsRepository.markCategoryRequestPublished(
        {
          id: approved.id,
          materialId: consumeMaterial.id,
          requestedByUserId: ctx.supplierId,
          expectedUpdatedAt: approvedSnapshot.updatedAt,
          expectedApprovedCategoryId: approvedSnapshot.approvedCategoryId!,
        },
      );
      assert.equal(success.count, 1);

      const after = await prisma.categoryRequest.findUniqueOrThrow({
        where: { id: approved.id },
        select: { publishedMaterialId: true },
      });
      assert.equal(after.publishedMaterialId, consumeMaterial.id);
    } finally {
      await prisma.categoryRequest.updateMany({
        where: { id: { in: [pending.id, approved.id] } },
        data: { publishedMaterialId: null },
      });
      await prisma.categoryRequest.deleteMany({
        where: { id: { in: [pending.id, approved.id] } },
      });
    }
  });

  test("category request authority mismatch rejects before persistence", async () => {
    const otherCategory = await prisma.category.findFirst({
      where: {
        id: { not: ctx.categoryId },
        categoryType: { in: ["MATERIAL", "BOTH"] },
        isActive: true,
        materialFamilyConceptId: { not: null },
      },
      select: { id: true },
    });
    assert.ok(otherCategory);

    const categoryRequest = await prisma.categoryRequest.create({
      data: {
        requestedName: `${TEST_MARKER} authority mismatch`,
        normalizedRequestedName: `authority-mismatch-${Date.now()}`,
        requestedByUserId: ctx.supplierId,
        status: "APPROVED",
        approvedCategoryId: otherCategory.id,
      },
    });

    const title = `${TEST_MARKER} rp023 category authority mismatch`;
    try {
      await assert.rejects(
        () =>
          createSupplierMaterial(ctx.supplierId, {
            materialName: `${TEST_MARKER} authority mismatch material`,
            title,
            description: `${title} description`,
            categoryId: ctx.categoryId,
            quantity: 1,
            unit: "piece",
            condition: "GOOD",
            isFree: true,
            price: null,
            currency: "NIS",
            pickupAllowed: true,
            deliveryAllowed: false,
            imageUrls: ["/uploads/materials/rp023-cat-auth.jpg"],
            useDefaultPickupLocation: true,
            sourceCategoryRequestId: categoryRequest.id,
          }),
        (error: unknown) => {
          assert.ok(error instanceof AppError);
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, "CONFLICT");
          assert.equal(
            (error.details as { reason?: string } | undefined)?.reason,
            "CATEGORY_REQUEST_AUTHORITY_MISMATCH",
          );
          return true;
        },
      );

      assert.equal(await prisma.material.count({ where: { title } }), 0);
      assert.equal(
        await prisma.materialConcept.count({
          where: { material: { title } },
        }),
        0,
      );
      const request = await prisma.categoryRequest.findUnique({
        where: { id: categoryRequest.id },
        select: { publishedMaterialId: true },
      });
      assert.equal(request?.publishedMaterialId, null);
    } finally {
      await prisma.categoryRequest.delete({
        where: { id: categoryRequest.id },
      });
    }
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
      where: {
        categoryType: { in: ["MATERIAL", "BOTH"] },
        isActive: true,
        materialFamilyConceptId: { not: null },
        materialFamilyConcept: {
          status: "ACTIVE",
          conceptType: "MATERIAL_FAMILY",
        },
      },
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
      where: {
        categoryType: { in: ["MATERIAL", "BOTH"] },
        isActive: true,
        materialFamilyConceptId: { not: null },
        materialFamilyConcept: {
          status: "ACTIVE",
          conceptType: "MATERIAL_FAMILY",
        },
      },
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

describe("supplier material status and detail", () => {
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
        area: `${TEST_MARKER}-status`,
        visibility: "PUBLIC_APPROXIMATE",
        isApproximate: true,
      },
      select: { id: true },
    });
    const supplier = await createSupplierUser("status");
    const learner = await prisma.user.findFirst({
      where: { roles: { some: { role: "LEARNER" } } },
      select: { id: true },
    });
    assert.ok(learner, "Expected at least one learner user");
    ctx.categoryId = category!.id;
    ctx.locationId = location.id;
    ctx.supplierId = supplier.id;
    ctx.learnerId = learner.id;
    ctx.createdUserIds.push(supplier.id);
  });

  after(async () => {
    await cleanup(ctx);
  });

  test("mark unavailable and restore available for owned material", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "status-toggle",
      "AVAILABLE",
    );

    const unavailable = await markSupplierMaterialUnavailable(
      ctx.supplierId,
      material.id,
    );
    assert.equal(unavailable.status, "UNAVAILABLE");
    assert.equal(unavailable.canRestoreAvailable, true);
    assert.equal(unavailable.canMarkUnavailable, false);

    const restored = await restoreSupplierMaterialAvailable(
      ctx.supplierId,
      material.id,
    );
    assert.equal(restored.status, "AVAILABLE");
    assert.equal(restored.canMarkUnavailable, true);
  });

  test("detail includes active and lifetime demand metrics from reservations", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "status-demand",
      "AVAILABLE",
    );

    const pending = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: "PENDING",
      },
    });
    const accepted = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: "ACCEPTED",
      },
    });
    ctx.createdReservationIds.push(pending.id, accepted.id);

    const detail = await getSupplierMaterial(ctx.supplierId, material.id);

    assert.equal(detail.pendingReservationsCount, 1);
    assert.equal(detail.reservedReservationsCount, 1);
    assert.equal(detail.activeRequestsCount, 2);
    assert.equal(detail.activeDemandScore, 50);
    assert.equal(detail.demandScore, 50);
    assert.equal(detail.demandScorePercent, 50);
    assert.equal(detail.reservations.length, 2);
    assert.equal(detail.canMarkUnavailable, false);
  });

  test("detail includes lifetime demand from completed reservation without active demand", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "status-completed-demand",
      "REUSED",
    );

    await prisma.materialView.create({
      data: {
        materialId: material.id,
        viewerUserId: ctx.learnerId,
      },
    });
    await prisma.materialLike.create({
      data: {
        materialId: material.id,
        userId: ctx.learnerId,
      },
    });

    const completedAt = new Date("2026-01-15T10:00:00.000Z");
    const completed = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: "COMPLETED",
        completedAt,
      },
    });
    await prisma.material.update({
      where: { id: material.id },
      data: {
        reusedAt: completedAt,
        reusedByReservationId: completed.id,
      },
    });
    ctx.createdReservationIds.push(completed.id);

    const detail = await getSupplierMaterial(ctx.supplierId, material.id);

    assert.equal(detail.viewsCount, 1);
    assert.equal(detail.likesCount, 1);
    assert.equal(detail.activeRequestsCount, 0);
    assert.equal(detail.completedReservationsCount, 1);
    assert.equal(detail.reusedCount, 1);
    assert.equal(detail.demandScorePercent, 46);
    assert.equal(detail.activeDemandScore, 0);
    assert.equal(detail.lastCompletedAt, completedAt.toISOString());
  });

  test("rejected reservation does not contribute to demand metrics", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "status-rejected-demand",
      "AVAILABLE",
    );

    const rejected = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId: ctx.learnerId,
        ownerId: ctx.supplierId,
        quantityRequested: 1,
        status: "REJECTED",
      },
    });
    ctx.createdReservationIds.push(rejected.id);

    const detail = await getSupplierMaterial(ctx.supplierId, material.id);

    assert.equal(detail.activeRequestsCount, 0);
    assert.equal(detail.completedReservationsCount, 0);
    assert.equal(detail.demandScorePercent, 0);
  });

  test("list uses MaterialView-based views count", async () => {
    const material = await createMaterial(
      ctx,
      ctx.supplierId,
      "status-views",
      "AVAILABLE",
    );

    await prisma.materialView.create({
      data: {
        materialId: material.id,
        viewerUserId: ctx.learnerId,
      },
    });

    const list = await getSupplierMaterials(ctx.supplierId, {
      page: 1,
      limit: 50,
      search: material.title,
      isFree: undefined,
    });
    const item = list.items.find((entry) => entry.id === material.id);

    assert.ok(item);
    assert.equal(item.viewsCount, 1);
  });

});
