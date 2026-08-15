import { assertEmailVerifiedForMarketplaceCommitment } from "../auth/email-verification.policy.js";
import { AppError } from "../../utils/app-error.js";
import { prisma } from "../../database/prisma.js";
import { createNotification } from "../notifications/notifications.repository.js";
import type { Prisma } from "../../generated/prisma/client.js";
import * as categoriesRepository from "../categories/categories.repository.js";
import * as categoryRequestsRepository from "../category-requests/category-requests.repository.js";
import * as priceRuleRequestsRepository from "../price-rule-requests/price-rule-requests.repository.js";
import { evaluateApprovedPriceRuleRequest } from "../price-rule-requests/price-rule-request-pricing.js";
import {
  checkMaterialPrice,
  resolveMaterialReferenceForCreate,
} from "../materials/materials.service.js";
import {
  runIdempotentOperation,
  SUPPLIER_CREATE_MATERIAL_SCOPE,
} from "../../services/idempotency.service.js";
import * as supplierRepository from "./supplier.repository.js";
import { assertSupplierCanPublishMaterials } from "../supplier-verification/supplier-verification.service.js";
import type { CreateSupplierMaterialInput } from "./supplier.validation.js";
import {
  MISSING_PROFILE_MESSAGE,
  MISSING_PICKUP_LOCATION_MESSAGE,
  SOURCE_REQUEST_CONSUMED_MESSAGE,
  mapCreatedMaterial,
  type CreatedSupplierMaterialDto,
  type SourceRequestSnapshots,
} from "./supplier-material-create.helpers.js";
import {
  assertCategoryRequestPublishableInTx,
  assertOrdinaryPaidPriceAllowedInTx,
  assertSourceRequestPublishable,
  deriveMaterialSourceType,
  loadMaterialConceptIdsForPersistence,
  markSourceRequestPublished,
  resolveMaterialPickupLocationId,
  resolveOrdinaryPaidMaterialTypeInTx,
  resolvePaidMaterialTypeFromPrr,
} from "./supplier-material-create.helpers.js";

export const createSupplierMaterial = async (
  userId: string,
  input: CreateSupplierMaterialInput,
  tx?: Prisma.TransactionClient,
) => {
  await assertEmailVerifiedForMarketplaceCommitment(userId);

  const supplierProfile =
    await supplierRepository.findSupplierProfileForMaterialCreate(userId);

  if (!supplierProfile) {
    throw new AppError(MISSING_PROFILE_MESSAGE, 400, "VALIDATION_ERROR");
  }

  assertSupplierCanPublishMaterials({
    supplierType: supplierProfile.supplierType,
    verificationStatus: supplierProfile.verificationStatus,
  });

  if (!supplierProfile.defaultPickupLocationId) {
    throw new AppError(
      MISSING_PICKUP_LOCATION_MESSAGE,
      400,
      "VALIDATION_ERROR",
    );
  }

  await assertSourceRequestPublishable(userId, input);
  const sourceType = deriveMaterialSourceType(supplierProfile.supplierType);

  const requestedCategory = await categoriesRepository.findCategoryById(
    input.categoryId,
  );

  if (!requestedCategory) {
    throw new AppError("Category not found", 404, "NOT_FOUND");
  }

  const requestedOtherCategory = categoriesRepository.isOtherCategory(
    requestedCategory.nameEn,
  );
  const materialName = input.materialName.trim();

  if (input.isFree) {
    if (input.price != null && input.price > 0) {
      throw new AppError(
        "Free listings cannot include a price.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const resolved = await resolveMaterialReferenceForCreate({
      materialName,
      categoryId: input.categoryId,
      isFree: true,
    });

    const matchedType = resolved.materialType;
    const displayMaterialType = matchedType?.nameEn ?? materialName;
    const finalCategoryId = matchedType?.categoryId ?? input.categoryId;
    const finalTitle = input.title;

    const persistFreeMaterial = async (client: Prisma.TransactionClient) => {
      const materialLocationId = await resolveMaterialPickupLocationId(
        supplierProfile,
        input,
        client,
      );

      const conceptIds = await loadMaterialConceptIdsForPersistence({
        client,
        finalCategoryId,
        finalMaterialType: displayMaterialType,
        finalTitle,
      });

      const snapshots: SourceRequestSnapshots = {};
      if (input.sourceCategoryRequestId) {
        const categoryRequest =
          await categoryRequestsRepository.findCategoryRequestByIdForOwner(
            input.sourceCategoryRequestId,
            userId,
            client,
          );
        if (!categoryRequest) {
          throw new AppError("Category request not found", 404, "NOT_FOUND");
        }
        assertCategoryRequestPublishableInTx(categoryRequest, finalCategoryId);
        snapshots.categoryRequest = {
          id: categoryRequest.id,
          expectedUpdatedAt: categoryRequest.updatedAt,
          approvedCategoryId: categoryRequest.approvedCategoryId!,
        };
      }
      if (input.sourcePriceRuleRequestId) {
        const priceRuleRequest =
          await priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner(
            input.sourcePriceRuleRequestId,
            userId,
            client,
          );
        if (!priceRuleRequest) {
          throw new AppError("Price rule request not found", 404, "NOT_FOUND");
        }
        if (priceRuleRequest.publishedMaterialId) {
          throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
        }
        snapshots.priceRuleRequest = {
          id: priceRuleRequest.id,
          expectedUpdatedAt: priceRuleRequest.updatedAt,
        };
      }

      const material = await supplierRepository.createSupplierMaterial({
        ownerId: userId,
        supplierProfileId: supplierProfile.id,
        categoryId: finalCategoryId,
        locationId: materialLocationId,
        title: finalTitle,
        description: input.description,
        materialType: displayMaterialType,
        materialTypeId: matchedType?.id ?? null,
        customMaterialType: matchedType ? null : materialName,
        quantity: input.quantity,
        unit: input.unit,
        condition: input.condition,
        sourceType,
        isFree: true,
        price: null,
        currency: "NIS",
        pickupAllowed: input.pickupAllowed,
        deliveryAllowed: input.deliveryAllowed,
        pickupNotes: input.pickupNotes ?? null,
        suggestedUses: input.suggestedUses ?? null,
        imageUrls: input.imageUrls,
        conceptIds,
        client,
      });

      await markSourceRequestPublished(userId, material.id, snapshots, client);

      return mapCreatedMaterial(material);
    };

    if (tx) {
      return persistFreeMaterial(tx);
    }

    return prisma.$transaction((client) => persistFreeMaterial(client));
  }

  if (requestedOtherCategory) {
    throw new AppError(
      "Paid listings need a reviewed category/material. Submit this material for review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "PAID_OTHER_NOT_ALLOWED" },
    );
  }

  // Fail-fast only: not the transaction-authoritative branch decision.
  if (input.sourcePriceRuleRequestId && input.price != null) {
    const priceRuleRequest =
      await priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner(
        input.sourcePriceRuleRequestId,
        userId,
      );

    if (!priceRuleRequest) {
      throw new AppError("Price rule request not found", 404, "NOT_FOUND");
    }

    const acceptance = evaluateApprovedPriceRuleRequest(
      priceRuleRequest,
      input.price,
      input.condition,
    );

    if (acceptance.ok) {
      const approvedUnit =
        priceRuleRequest.unit ??
        priceRuleRequest.materialType?.defaultUnit ??
        null;
      if (
        approvedUnit &&
        input.unit.trim().toLowerCase() !== approvedUnit.trim().toLowerCase()
      ) {
        throw new AppError(
          `Please use the approved unit (${approvedUnit}) for this material.`,
          400,
          "VALIDATION_ERROR",
          { reason: "UNIT_MISMATCH", approvedUnit },
        );
      }
    } else if (acceptance.reason === "PRICE_TOO_HIGH") {
      const unit =
        priceRuleRequest.unit ??
        priceRuleRequest.materialType?.defaultUnit ??
        "unit";
      throw new AppError(
        `Maximum allowed price is ${acceptance.maxAllowed} NIS per ${unit}.`,
        400,
        "VALIDATION_ERROR",
        {
          maxAllowedPrice: acceptance.maxAllowed,
          approvedUnit: unit,
          reason: "PRICE_TOO_HIGH",
        },
      );
    } else if (acceptance.reason === "NO_APPROVED_MAX") {
      const resolved = await resolveMaterialReferenceForCreate({
        materialName,
        categoryId: input.categoryId,
        isFree: false,
      });
      const materialType = resolved.materialType;
      if (!materialType) {
        throw new AppError(
          "This paid material needs admin price review before publishing.",
          400,
          "VALIDATION_ERROR",
          { reason: "MATERIAL_REVIEW_REQUIRED" },
        );
      }
      const priceCheck = await checkMaterialPrice({
        isFree: false,
        categoryId: materialType.categoryId,
        materialName,
        condition: input.condition,
        quantity: input.quantity,
        unit: input.unit,
        price: input.price,
        currency: input.currency,
      });
      if (!priceCheck.allowed) {
        throw new AppError(priceCheck.message, 400, "VALIDATION_ERROR", {
          reason: priceCheck.reason,
          maxAllowedPrice: priceCheck.maxAllowedPrice,
          matchedReference: priceCheck.matchedReference,
          candidates: priceCheck.candidates,
          approvedUnit: priceCheck.approvedUnit,
        });
      }
    }
  } else {
    const resolved = await resolveMaterialReferenceForCreate({
      materialName,
      categoryId: input.categoryId,
      isFree: false,
    });

    const materialType = resolved.materialType;

    if (!materialType) {
      throw new AppError(
        "This paid material needs admin price review before publishing.",
        400,
        "VALIDATION_ERROR",
        { reason: "MATERIAL_REVIEW_REQUIRED" },
      );
    }

    const priceCheck = await checkMaterialPrice({
      isFree: false,
      categoryId: materialType.categoryId,
      materialName,
      condition: input.condition,
      quantity: input.quantity,
      unit: input.unit,
      price: input.price,
      currency: input.currency,
    });

    if (!priceCheck.allowed) {
      throw new AppError(priceCheck.message, 400, "VALIDATION_ERROR", {
        reason: priceCheck.reason,
        maxAllowedPrice: priceCheck.maxAllowedPrice,
        matchedReference: priceCheck.matchedReference,
        candidates: priceCheck.candidates,
        approvedUnit: priceCheck.approvedUnit,
      });
    }
  }

  const persistPaidMaterial = async (client: Prisma.TransactionClient) => {
    const snapshots: SourceRequestSnapshots = {};
    let loadedCategoryRequest: NonNullable<
      Awaited<
        ReturnType<typeof categoryRequestsRepository.findCategoryRequestByIdForOwner>
      >
    > | null = null;

    if (input.sourceCategoryRequestId) {
      loadedCategoryRequest =
        await categoryRequestsRepository.findCategoryRequestByIdForOwner(
          input.sourceCategoryRequestId,
          userId,
          client,
        );
      if (!loadedCategoryRequest) {
        throw new AppError("Category request not found", 404, "NOT_FOUND");
      }
    }

    let finalized: {
      finalCategoryId: string;
      finalMaterialType: string;
      materialTypeId: string | null;
      customMaterialType: string | null;
      priceRuleId: string | null;
      maxAllowedPriceAtCheck: number | null;
    } | null = null;

    if (input.sourcePriceRuleRequestId && input.price != null) {
      const priceRuleRequest =
        await priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner(
          input.sourcePriceRuleRequestId,
          userId,
          client,
        );

      if (!priceRuleRequest) {
        throw new AppError("Price rule request not found", 404, "NOT_FOUND");
      }

      if (priceRuleRequest.publishedMaterialId) {
        throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
      }

      snapshots.priceRuleRequest = {
        id: priceRuleRequest.id,
        expectedUpdatedAt: priceRuleRequest.updatedAt,
      };

      const acceptance = evaluateApprovedPriceRuleRequest(
        priceRuleRequest,
        input.price,
        input.condition,
      );

      if (acceptance.ok) {
        const approvedUnit =
          priceRuleRequest.unit ??
          priceRuleRequest.materialType?.defaultUnit ??
          null;
        if (
          approvedUnit &&
          input.unit.trim().toLowerCase() !== approvedUnit.trim().toLowerCase()
        ) {
          throw new AppError(
            `Please use the approved unit (${approvedUnit}) for this material.`,
            400,
            "VALIDATION_ERROR",
            { reason: "UNIT_MISMATCH", approvedUnit },
          );
        }

        const materialType = await resolvePaidMaterialTypeFromPrr(
          priceRuleRequest,
          materialName,
          input.categoryId,
          client,
        );

        finalized = {
          finalCategoryId: materialType?.categoryId ?? input.categoryId,
          finalMaterialType: materialType?.nameEn ?? materialName,
          materialTypeId:
            materialType?.id ?? priceRuleRequest.materialTypeId ?? null,
          customMaterialType: materialType ? null : materialName,
          priceRuleId: null,
          maxAllowedPriceAtCheck: acceptance.maxAllowed,
        };
      } else if (acceptance.reason === "PRICE_TOO_HIGH") {
        const unit =
          priceRuleRequest.unit ??
          priceRuleRequest.materialType?.defaultUnit ??
          "unit";
        throw new AppError(
          `Maximum allowed price is ${acceptance.maxAllowed} NIS per ${unit}.`,
          400,
          "VALIDATION_ERROR",
          {
            maxAllowedPrice: acceptance.maxAllowed,
            approvedUnit: unit,
            reason: "PRICE_TOO_HIGH",
          },
        );
      }
      // NO_APPROVED_MAX falls through to ordinary branch below.
    }

    if (!finalized) {
      const materialType = await resolveOrdinaryPaidMaterialTypeInTx({
        client,
        materialName,
        categoryId: input.categoryId,
      });

      const authorized = await assertOrdinaryPaidPriceAllowedInTx({
        client,
        materialType,
        unit: input.unit,
        quantity: input.quantity,
        condition: input.condition,
        price: input.price,
        currency: input.currency,
      });

      finalized = {
        finalCategoryId: authorized.materialType.categoryId,
        finalMaterialType: authorized.materialType.nameEn,
        materialTypeId: authorized.materialType.id,
        customMaterialType: null,
        priceRuleId: authorized.priceRuleId,
        maxAllowedPriceAtCheck: authorized.maxAllowedPrice,
      };
    }

    const {
      finalCategoryId,
      finalMaterialType,
      materialTypeId,
      customMaterialType,
      priceRuleId,
      maxAllowedPriceAtCheck,
    } = finalized;

    if (loadedCategoryRequest) {
      assertCategoryRequestPublishableInTx(
        loadedCategoryRequest,
        finalCategoryId,
      );
      snapshots.categoryRequest = {
        id: loadedCategoryRequest.id,
        expectedUpdatedAt: loadedCategoryRequest.updatedAt,
        approvedCategoryId: loadedCategoryRequest.approvedCategoryId!,
      };
    }

    const materialLocationId = await resolveMaterialPickupLocationId(
      supplierProfile,
      input,
      client,
    );

    const conceptIds = await loadMaterialConceptIdsForPersistence({
      client,
      finalCategoryId,
      finalMaterialType,
      finalTitle: input.title,
    });

    const material = await supplierRepository.createSupplierMaterial({
      ownerId: userId,
      supplierProfileId: supplierProfile.id,
      categoryId: finalCategoryId,
      locationId: materialLocationId,
      title: input.title,
      description: input.description,
      materialType: finalMaterialType,
      materialTypeId,
      customMaterialType,
      quantity: input.quantity,
      unit: input.unit,
      condition: input.condition,
      sourceType,
      isFree: false,
      price: input.price,
      currency: "NIS",
      pickupAllowed: input.pickupAllowed,
      deliveryAllowed: input.deliveryAllowed,
      pickupNotes: input.pickupNotes ?? null,
      suggestedUses: input.suggestedUses ?? null,
      priceRuleId,
      priceCheckedAt: new Date(),
      maxAllowedPriceAtCheck,
      imageUrls: input.imageUrls,
      conceptIds,
      client,
    });

    await markSourceRequestPublished(userId, material.id, snapshots, client);

    return mapCreatedMaterial(material);
  };

  if (tx) {
    return persistPaidMaterial(tx);
  }

  return prisma.$transaction((client) => persistPaidMaterial(client));
};

export const createSupplierMaterialIdempotent = async (
  userId: string,
  input: CreateSupplierMaterialInput,
  idempotencyKey: string,
) => {
  const created = await runIdempotentOperation<CreatedSupplierMaterialDto>({
    userId,
    scope: SUPPLIER_CREATE_MATERIAL_SCOPE,
    key: idempotencyKey,
    payload: input,
    resourceType: "MATERIAL",
    getResourceId: (material) => material.id,
    handler: (tx) => createSupplierMaterial(userId, input, tx),
  });
  const createdMaterial = created.response;

  if (input.suggestToMaterialRequestId && !created.replayed) {
    const { suggestMaterialForRequest } = await import(
      "../supplier-material-requests/supplier-material-requests.service.js"
    );
    try {
      await suggestMaterialForRequest(userId, input.suggestToMaterialRequestId, {
        materialId: createdMaterial.id,
        confirmWeakMatch: true,
      });
    } catch {
      // Listing succeeds even if suggestion fails; supplier can suggest manually.
    }
  }

  const publishNotifications: Promise<unknown>[] = [];
  if (input.sourceCategoryRequestId) {
    publishNotifications.push(
      createNotification({
          userId,
          notificationType: "CATEGORY_REQUEST_UPDATE",
          title: "Listing published",
          body: `${createdMaterial.title} was published from the approved category review.`,
          relatedEntityType: "CATEGORY_REQUEST",
          relatedEntityId: input.sourceCategoryRequestId,
          eventKey: `listing-published:category:${input.sourceCategoryRequestId}:${createdMaterial.id}`,
          entityType: "CATEGORY_REQUEST",
          entityId: input.sourceCategoryRequestId,
          actionType: "NONE",
          resolvedAt: new Date(),
          metadata: { publishedMaterialId: createdMaterial.id },
        }),
    );
  }
  if (input.sourcePriceRuleRequestId) {
    publishNotifications.push(
      createNotification({
          userId,
          notificationType: "PRICE_REQUEST_UPDATE",
          title: "Listing published",
          body: `${createdMaterial.title} was published from the approved price review.`,
          relatedEntityType: "PRICE_RULE_REQUEST",
          relatedEntityId: input.sourcePriceRuleRequestId,
          eventKey: `listing-published:price:${input.sourcePriceRuleRequestId}:${createdMaterial.id}`,
          entityType: "PRICE_RULE_REQUEST",
          entityId: input.sourcePriceRuleRequestId,
          actionType: "NONE",
          resolvedAt: new Date(),
          metadata: { publishedMaterialId: createdMaterial.id },
        }),
    );
  }

  await Promise.all(publishNotifications);
  return created;
};
