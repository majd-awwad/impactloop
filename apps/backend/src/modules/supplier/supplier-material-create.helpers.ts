import { AppError } from "../../utils/app-error.js";
import { decimalToNumber } from "../../utils/decimal.js";
import type { Prisma } from "../../generated/prisma/client.js";
import * as categoriesRepository from "../categories/categories.repository.js";
import * as categoryRequestsRepository from "../category-requests/category-requests.repository.js";
import * as priceRuleRequestsRepository from "../price-rule-requests/price-rule-requests.repository.js";
import { evaluateApprovedPriceRuleRequest } from "../price-rule-requests/price-rule-request-pricing.js";
import {
  calculateMaxAllowedPrice,
  resolveMaterialReferenceForCreate,
} from "../materials/materials.service.js";
import * as materialTypesRepository from "../material-types/material-types.repository.js";
import { matchMaterialReference } from "../../services/material-reference-matching.service.js";
import * as supplierRepository from "./supplier.repository.js";
import { TaxonomyFoundationRepository } from "../taxonomy/taxonomy-foundation.repository.js";
import {
  projectLoadedConceptsForAssignment,
  resolveFreeMaterialConceptIds,
} from "../taxonomy/material-concept-assignment-publish.js";
import { applyConditionPriceMultiplier } from "../../constants/material-condition-factors.js";
import type { CreateSupplierMaterialInput } from "./supplier.validation.js";

export const MISSING_PROFILE_MESSAGE =
  "Complete your supplier profile to start listing materials.";

export const MISSING_PICKUP_LOCATION_MESSAGE =
  "Add a default pickup location before listing materials.";

export const ORG_PICKUP_OVERRIDE_MESSAGE =
  "Organization suppliers must use the profile pickup location for all listings.";

export const SOURCE_REQUEST_CONSUMED_MESSAGE =
  "This listing was already completed.";

type SupplierProfileForMaterialCreate = NonNullable<
  Awaited<
    ReturnType<typeof supplierRepository.findSupplierProfileForMaterialCreate>
  >
>;

export const assertOrganizationPickupPolicy = (
  input: CreateSupplierMaterialInput,
  supplierType: string | null,
) => {
  if (!supplierRepository.isOrganizationSupplierType(supplierType ?? "")) {
    return;
  }

  const useDefaultPickupLocation = input.useDefaultPickupLocation ?? true;

  if (!useDefaultPickupLocation || input.pickupLocation != null) {
    throw new AppError(ORG_PICKUP_OVERRIDE_MESSAGE, 400, "VALIDATION_ERROR", {
      reason: "ORG_PICKUP_OVERRIDE_NOT_ALLOWED",
    });
  }
};

export const resolveMaterialPickupLocationId = async (
  supplierProfile: SupplierProfileForMaterialCreate,
  input: CreateSupplierMaterialInput,
  tx?: Prisma.TransactionClient,
): Promise<string> => {
  const defaultLocation = supplierProfile.defaultPickupLocation;
  const useDefaultPickupLocation = input.useDefaultPickupLocation ?? true;

  if (!defaultLocation || !supplierProfile.defaultPickupLocationId) {
    throw new AppError(
      MISSING_PICKUP_LOCATION_MESSAGE,
      400,
      "VALIDATION_ERROR",
    );
  }

  assertOrganizationPickupPolicy(input, supplierProfile.supplierType);

  if (
    supplierRepository.isOrganizationSupplierType(
      supplierProfile.supplierType ?? "",
    )
  ) {
    return supplierRepository.copyLocationRow(
      defaultLocation,
      "MATERIAL_PICKUP",
      tx,
    );
  }

  if (useDefaultPickupLocation || !input.pickupLocation) {
    return supplierRepository.copyLocationRow(
      defaultLocation,
      "MATERIAL_PICKUP",
      tx,
    );
  }

  return supplierRepository.createMaterialPickupLocation(
    input.pickupLocation,
    tx,
  );
};

export const deriveMaterialSourceType = (supplierType: string | null) => {
  switch (supplierType) {
    case "WORKSHOP":
      return "WORKSHOP_SURPLUS" as const;
    case "FACTORY":
      return "FACTORY_SURPLUS" as const;
    case "EDUCATIONAL_INSTITUTION":
      return "EDUCATIONAL_INSTITUTION" as const;
    case "INDIVIDUAL_SUPPLIER":
      // TODO: MVP fallback. Revisit when the source enum can distinguish individual suppliers.
      return "STUDENT_LEFTOVER" as const;
    case "STUDENT_SUPPLIER":
    default:
      return "STUDENT_LEFTOVER" as const;
  }
};

export const assertSourceRequestPublishable = async (
  userId: string,
  input: CreateSupplierMaterialInput,
) => {
  if (input.sourceCategoryRequestId) {
    const request =
      await categoryRequestsRepository.findCategoryRequestByIdForOwner(
        input.sourceCategoryRequestId,
        userId,
      );

    if (!request) {
      throw new AppError("Category request not found", 404, "NOT_FOUND");
    }

    if (request.publishedMaterialId) {
      throw new AppError(
        "This listing was already completed.",
        409,
        "CONFLICT",
      );
    }
  }

  if (input.sourcePriceRuleRequestId) {
    const request =
      await priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner(
        input.sourcePriceRuleRequestId,
        userId,
      );

    if (!request) {
      throw new AppError("Price rule request not found", 404, "NOT_FOUND");
    }

    if (request.publishedMaterialId) {
      throw new AppError(
        "This listing was already completed.",
        409,
        "CONFLICT",
      );
    }

    if (!input.isFree && input.price != null) {
      const acceptance = evaluateApprovedPriceRuleRequest(
        request,
        input.price,
        input.condition,
      );
      if (acceptance.ok === false && acceptance.reason === "PRICE_TOO_HIGH") {
        const unit =
          request.unit ?? request.materialType?.defaultUnit ?? "unit";
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
    }
  }
};

export type SourceRequestSnapshots = {
  categoryRequest?: {
    id: string;
    expectedUpdatedAt: Date;
    approvedCategoryId: string;
  };
  priceRuleRequest?: {
    id: string;
    expectedUpdatedAt: Date;
  };
};

export const markSourceRequestPublished = async (
  userId: string,
  materialId: string,
  snapshots: SourceRequestSnapshots,
  tx: Prisma.TransactionClient,
) => {
  if (snapshots.categoryRequest) {
    const result = await categoryRequestsRepository.markCategoryRequestPublished(
      {
        id: snapshots.categoryRequest.id,
        materialId,
        requestedByUserId: userId,
        expectedUpdatedAt: snapshots.categoryRequest.expectedUpdatedAt,
        expectedApprovedCategoryId: snapshots.categoryRequest.approvedCategoryId,
        client: tx,
      },
    );
    if (result.count === 0) {
      throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
    }
  }

  if (snapshots.priceRuleRequest) {
    const result =
      await priceRuleRequestsRepository.markPriceRuleRequestPublished({
        id: snapshots.priceRuleRequest.id,
        materialId,
        requestedByUserId: userId,
        expectedUpdatedAt: snapshots.priceRuleRequest.expectedUpdatedAt,
        client: tx,
      });
    if (result.count === 0) {
      throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
    }
  }
};

/** Shared DB orchestration for create + semantic title update concept persistence. */
export const loadMaterialConceptIdsForPersistence = async (input: {
  client: Prisma.TransactionClient;
  finalCategoryId: string;
  finalMaterialType: string;
  finalTitle: string;
}): Promise<string[]> => {
  const taxonomyRepository = new TaxonomyFoundationRepository();
  const ownedCategory =
    await taxonomyRepository.findCategoryForMaterialConceptAssignment(
      input.finalCategoryId,
      input.client,
    );
  const loadedConcepts =
    await taxonomyRepository.loadMaterialConceptAssignmentConcepts(
      input.client,
    );

  if (!ownedCategory) {
    throw new AppError("Category not found", 404, "NOT_FOUND");
  }

  return resolveFreeMaterialConceptIds({
    category: {
      id: ownedCategory.id,
      categoryType: ownedCategory.categoryType,
      isActive: ownedCategory.isActive,
      materialFamilyConceptId: ownedCategory.materialFamilyConceptId,
      materialFamilyConcept: ownedCategory.materialFamilyConcept
        ? {
            id: ownedCategory.materialFamilyConcept.id,
            canonicalKey: ownedCategory.materialFamilyConcept.canonicalKey,
            conceptType: ownedCategory.materialFamilyConcept.conceptType,
            status: ownedCategory.materialFamilyConcept.status,
          }
        : null,
    },
    materialType: input.finalMaterialType,
    title: input.finalTitle,
    concepts: projectLoadedConceptsForAssignment(loadedConcepts),
  });
};

export const resolvePaidMaterialTypeFromPrr = async (
  priceRuleRequest: NonNullable<
    Awaited<
      ReturnType<typeof priceRuleRequestsRepository.findPriceRuleRequestByIdForOwner>
    >
  >,
  materialName: string,
  categoryId: string,
  client: Prisma.TransactionClient,
) => {
  let materialType = priceRuleRequest.materialType?.id
    ? await materialTypesRepository.findMaterialTypeById(
        priceRuleRequest.materialType.id,
        client,
      )
    : null;
  if (!materialType?.isActive) {
    const matchResult = await matchMaterialReference({
      materialName,
      categoryId,
      client,
    });
    if (matchResult.status === "MATCHED") {
      materialType = await materialTypesRepository.findMaterialTypeById(
        matchResult.materialType.id,
        client,
      );
      if (!materialType?.isActive) {
        materialType = null;
      }
    } else {
      materialType = null;
    }
  }
  return materialType;
};

export const resolveOrdinaryPaidMaterialTypeInTx = async (input: {
  client: Prisma.TransactionClient;
  materialName: string;
  categoryId: string;
}) => {
  const matchResult = await matchMaterialReference({
    materialName: input.materialName,
    categoryId: input.categoryId,
    client: input.client,
  });

  if (matchResult.status === "AMBIGUOUS") {
    throw new AppError(
      "This paid material needs admin price review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "MATERIAL_REVIEW_REQUIRED" },
    );
  }

  if (matchResult.status !== "MATCHED") {
    throw new AppError(
      "This paid material needs admin price review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "MATERIAL_REVIEW_REQUIRED" },
    );
  }

  const materialType = await materialTypesRepository.findMaterialTypeById(
    matchResult.materialType.id,
    input.client,
  );

  if (!materialType?.isActive) {
    throw new AppError(
      "This paid material needs admin price review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "MATERIAL_REVIEW_REQUIRED" },
    );
  }

  return materialType;
};

export const assertOrdinaryPaidPriceAllowedInTx = async (input: {
  client: Prisma.TransactionClient;
  materialType: NonNullable<
    Awaited<ReturnType<typeof materialTypesRepository.findMaterialTypeById>>
  >;
  unit: string;
  quantity: number;
  condition: CreateSupplierMaterialInput["condition"];
  price: number | null | undefined;
  currency: string | undefined;
}) => {
  if (input.currency !== "NIS") {
    throw new AppError("Paid listings must use NIS.", 400, "VALIDATION_ERROR", {
      reason: "INVALID_CURRENCY",
    });
  }

  if (input.price == null || input.price <= 0) {
    throw new AppError(
      "Paid listings must have a price greater than zero.",
      400,
      "VALIDATION_ERROR",
      { reason: "INVALID_PRICE" },
    );
  }

  const { materialType } = input;
  if (!materialType.isActive) {
    throw new AppError(
      "This paid material needs admin price review before publishing.",
      400,
      "VALIDATION_ERROR",
      { reason: "MATERIAL_REVIEW_REQUIRED" },
    );
  }

  const activeRule =
    await materialTypesRepository.findActivePriceRuleForMaterialType(
      materialType.id,
      input.unit,
      input.client,
    );

  if (!activeRule) {
    const activeRuleForDifferentUnit =
      await materialTypesRepository.findActivePriceRuleForMaterialType(
        materialType.id,
        undefined,
        input.client,
      );

    if (activeRuleForDifferentUnit) {
      throw new AppError(
        "Please use the approved unit for this material.",
        400,
        "VALIDATION_ERROR",
        {
          reason: "UNIT_MISMATCH",
          approvedUnit: activeRuleForDifferentUnit.unit,
        },
      );
    }

    throw new AppError(
      "This material needs an active price reference before paid listing.",
      400,
      "VALIDATION_ERROR",
      { reason: "PRICE_RULE_REQUIRED" },
    );
  }

  const baseMaxPrice = calculateMaxAllowedPrice({
    maxAllowedUnitPriceNis: decimalToNumber(activeRule.maxAllowedUnitPriceNis),
    maxAllowedTotalPriceNis: decimalToNumber(activeRule.maxAllowedTotalPriceNis),
    quantity: input.quantity,
    condition: "NEW",
  });

  const maxAllowedPrice =
    baseMaxPrice == null
      ? null
      : applyConditionPriceMultiplier(baseMaxPrice, input.condition);

  if (maxAllowedPrice == null || baseMaxPrice == null) {
    throw new AppError(
      "This material has an invalid active price reference.",
      400,
      "VALIDATION_ERROR",
      { reason: "PRICE_RULE_INVALID" },
    );
  }

  if (input.price > maxAllowedPrice) {
    throw new AppError(
      `The entered price is above the recommended maximum for this condition. Base max: ${baseMaxPrice} NIS, condition: ${input.condition}, adjusted max: ${maxAllowedPrice} NIS.`,
      400,
      "VALIDATION_ERROR",
      {
        reason: "PRICE_TOO_HIGH",
        maxAllowedPrice,
        approvedUnit: activeRule.unit,
      },
    );
  }

  return {
    materialType,
    priceRuleId: activeRule.id,
    maxAllowedPrice,
  };
};

export const assertCategoryRequestPublishableInTx = (
  request: {
    status: string;
    approvedCategoryId: string | null;
    publishedMaterialId: string | null;
  },
  finalCategoryId: string,
) => {
  if (request.publishedMaterialId) {
    throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT");
  }

  if (request.status !== "APPROVED") {
    throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT", {
      reason: "CATEGORY_REQUEST_NOT_APPROVED",
    });
  }

  if (request.approvedCategoryId == null) {
    throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT", {
      reason: "CATEGORY_REQUEST_MISSING_APPROVED_CATEGORY",
    });
  }

  if (request.approvedCategoryId !== finalCategoryId) {
    throw new AppError(SOURCE_REQUEST_CONSUMED_MESSAGE, 409, "CONFLICT", {
      reason: "CATEGORY_REQUEST_AUTHORITY_MISMATCH",
    });
  }
};

export const mapCreatedMaterial = (
  material: Awaited<
    ReturnType<typeof supplierRepository.createSupplierMaterial>
  >,
) => ({
  id: material.id,
  title: material.title,
  status: material.status,
  isFree: material.isFree,
  price: decimalToNumber(material.price),
  currency: material.currency,
  materialType: material.materialType,
  materialTypeId: material.materialTypeId,
  customMaterialType: material.customMaterialType,
  priceRuleId: material.priceRuleId,
  priceCheckedAt: material.priceCheckedAt?.toISOString() ?? null,
  maxAllowedPriceAtCheck: decimalToNumber(material.maxAllowedPriceAtCheck),
  category: {
    id: material.category.id,
    nameEn: material.category.nameEn,
    nameAr: material.category.nameAr,
  },
  images: material.images.map((image) => ({
    id: image.id,
    imageUrl: image.imageUrl,
    sortOrder: image.sortOrder,
    isCover: image.isCover,
  })),
  createdAt: material.createdAt.toISOString(),
});

export type CreatedSupplierMaterialDto = ReturnType<typeof mapCreatedMaterial>;
