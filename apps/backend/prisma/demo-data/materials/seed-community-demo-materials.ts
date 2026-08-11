import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PrismaClient } from "../../../src/generated/prisma/client.js";
import { prisma } from "../../../src/database/prisma.js";
import { assertLocalDemoDatabaseUrl } from "../../../scripts/lib/local-database-guard.mjs";
import { normalizeSearchText } from "../../../src/utils/normalize-search-text.js";
import {
  COMMUNITY_DEMO_MATERIALS_PUBLIC_PREFIX,
  communityDemoMaterialImageUrl,
} from "../../../src/constants/community-demo-materials.js";
import {
  CATEGORY_KEY_TO_NAME_EN,
  COMMUNITY_MATERIAL_BULK_TAG,
  communityMaterialIdentityTag,
  loadAndValidateCanonicalMaterials,
  writeExpectedImageManifest,
} from "./load-canonical-materials.js";
import {
  applyCommunityMaterialQuality,
  summarizeQuality,
  type ResolvedCommunityMaterial,
} from "./community-materials-quality.js";
import { ensureProductionMaterialTypeAliases } from "../../../src/modules/material-types/ensure-production-material-type-aliases.js";

const CURRENCY = "NIS";
const COMMUNITY_PRICE_RULE_NOTE_PREFIX = "Community demo materials seed";

type OwnerRecord = {
  userId: string;
  supplierProfileId: string;
  pickupLocationId: string;
  email: string;
  publicName: string | null;
};

export type SeedCommunityDemoMaterialsResult = {
  dataset: "community-demo-materials";
  mode: "sync";
  sourceRows: number;
  created: number;
  updated: number;
  unchanged: number;
  ownersResolved: number;
  activeOwnersAssigned: number;
  materialTypesReused: number;
  materialTypesCreated: number;
  priceRulesReused: number;
  priceRulesCreated: number;
  priceRulesUpdated: number;
  aliasesCreated: number;
  productionAliasesEnsured: Awaited<
    ReturnType<typeof ensureProductionMaterialTypeAliases>
  >;
  orphanCommunityTypesDeleted: number;
  freeListings: number;
  paidListings: number;
  conditionDistribution: Record<string, number>;
  imagePublicPrefix: string;
  missingImages: string[];
  qualitySummary: ReturnType<typeof summarizeQuality>;
  sampleMaterialIds: string[];
  note: string;
};

const sameDecimal = (
  left: { toString(): string } | number | null | undefined,
  right: number | null,
): boolean => {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return Number(left) === Number(right);
};

const resolveCategories = async (db: PrismaClient) => {
  const categories = await db.category.findMany({
    where: {
      isActive: true,
      categoryType: { in: ["MATERIAL", "BOTH"] },
    },
    select: { id: true, nameEn: true },
  });

  const byName = new Map(
    categories.map((category) => [category.nameEn.toLowerCase(), category.id]),
  );
  const map = new Map<string, string>();
  const missing: string[] = [];

  for (const [key, nameEn] of Object.entries(CATEGORY_KEY_TO_NAME_EN)) {
    const id = byName.get(nameEn.toLowerCase());
    if (!id) {
      missing.push(`${key} (${nameEn})`);
      continue;
    }
    map.set(key, id);
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing MATERIAL categories required by community materials seed: ${missing.join(", ")}.`,
    );
  }

  return map;
};

const resolveOwners = async (
  db: PrismaClient,
  ownerEmails: string[],
): Promise<Map<string, OwnerRecord>> => {
  const users = await db.user.findMany({
    where: { email: { in: ownerEmails } },
    select: {
      id: true,
      email: true,
      roles: { select: { role: true } },
      supplierProfile: {
        select: {
          id: true,
          publicName: true,
          defaultPickupLocationId: true,
        },
      },
    },
  });

  const byEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));
  const resolved = new Map<string, OwnerRecord>();
  const failures: string[] = [];

  for (const email of ownerEmails) {
    const user = byEmail.get(email);
    if (!user) {
      failures.push(`${email}: user not found`);
      continue;
    }
    if (!user.roles.some((role) => role.role === "SUPPLIER")) {
      failures.push(`${email}: missing SUPPLIER role`);
    }
    if (!user.supplierProfile?.defaultPickupLocationId) {
      failures.push(`${email}: missing SupplierProfile/default pickup`);
      continue;
    }

    resolved.set(email, {
      userId: user.id,
      supplierProfileId: user.supplierProfile.id,
      pickupLocationId: user.supplierProfile.defaultPickupLocationId,
      email,
      publicName: user.supplierProfile.publicName,
    });
  }

  if (failures.length > 0) {
    throw new Error(
      `Owner resolution failed:\n- ${failures.join("\n- ")}`,
    );
  }

  return resolved;
};

const ensureMaterialTypeAndPriceRule = async (
  db: PrismaClient,
  categoryId: string,
  material: ResolvedCommunityMaterial,
  stats: {
    materialTypesReused: number;
    materialTypesCreated: number;
    priceRulesReused: number;
    priceRulesCreated: number;
    priceRulesUpdated: number;
    aliasesCreated: number;
  },
  cache: Map<string, { materialTypeId: string; priceRuleId: string | null }>,
  typeMaxPrice: Map<string, number>,
) => {
  const normalizedName = normalizeSearchText(material.resolvedMaterialType);
  const cacheKey = `${categoryId}:${normalizedName}:${material.unitNormalized}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let materialType = await db.materialType.findUnique({
    where: {
      categoryId_normalizedName: {
        categoryId,
        normalizedName,
      },
    },
    select: { id: true },
  });

  if (materialType) {
    stats.materialTypesReused += 1;
  } else {
    materialType = await db.materialType.create({
      data: {
        categoryId,
        nameEn: material.resolvedMaterialType,
        nameAr: null,
        normalizedName,
        defaultUnit: material.unitNormalized,
        isActive: true,
      },
      select: { id: true },
    });
    stats.materialTypesCreated += 1;
  }

  // Only promote the resolved canonical type + curated aliases.
  // Never use displayTitle / raw CSV materialType — those can attach accessory
  // labels (e.g. "Heatsink") onto a kit primary type and corrupt matching.
  const aliasValues = [
    material.resolvedMaterialType,
    ...material.aliases,
  ]
    .map((alias) => alias.trim())
    .filter(Boolean)
    .map((alias) => ({
      alias,
      normalizedAlias: normalizeSearchText(alias),
    }));

  const uniqueAliases = aliasValues.filter(
    (alias, index, all) =>
      all.findIndex((other) => other.normalizedAlias === alias.normalizedAlias) ===
      index,
  );

  for (const alias of uniqueAliases) {
    const existingAlias = await db.materialTypeAlias.findFirst({
      where: {
        materialTypeId: materialType.id,
        normalizedAlias: alias.normalizedAlias,
      },
      select: { id: true },
    });
    if (existingAlias) continue;
    await db.materialTypeAlias.create({
      data: {
        materialTypeId: materialType.id,
        alias: alias.alias,
        normalizedAlias: alias.normalizedAlias,
        language: "en",
      },
    });
    stats.aliasesCreated += 1;
  }

  const observedMax = typeMaxPrice.get(cacheKey) ?? 0;
  const desiredMax = Math.max(
    10,
    Math.ceil(Math.max(observedMax, material.isFree ? 0 : material.priceNis) * 1.25),
  );

  let priceRule = await db.materialPriceRule.findFirst({
    where: {
      materialTypeId: materialType.id,
      currency: CURRENCY,
      unit: material.unitNormalized,
      status: "ACTIVE",
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      maxAllowedUnitPriceNis: true,
      sourceNote: true,
    },
  });

  if (!priceRule) {
    priceRule = await db.materialPriceRule.create({
      data: {
        materialTypeId: materialType.id,
        currency: CURRENCY,
        unit: material.unitNormalized,
        maxAllowedUnitPriceNis: desiredMax,
        maxAllowedTotalPriceNis: desiredMax * 20,
        sourceType: "MANUAL",
        status: "ACTIVE",
        sourceNote: `${COMMUNITY_PRICE_RULE_NOTE_PREFIX} — type-level conservative max (QA sync).`,
        confidence: 0.8,
        isActive: true,
      },
      select: { id: true, maxAllowedUnitPriceNis: true, sourceNote: true },
    });
    stats.priceRulesCreated += 1;
  } else {
    stats.priceRulesReused += 1;
    const currentMax = Number(priceRule.maxAllowedUnitPriceNis ?? 0);
    const isCommunityRule = (priceRule.sourceNote ?? "").includes(
      COMMUNITY_PRICE_RULE_NOTE_PREFIX,
    );
    if (isCommunityRule && desiredMax > currentMax) {
      priceRule = await db.materialPriceRule.update({
        where: { id: priceRule.id },
        data: {
          maxAllowedUnitPriceNis: desiredMax,
          maxAllowedTotalPriceNis: desiredMax * 20,
          sourceNote: `${COMMUNITY_PRICE_RULE_NOTE_PREFIX} — raised for QA sync listing range.`,
        },
        select: { id: true, maxAllowedUnitPriceNis: true, sourceNote: true },
      });
      stats.priceRulesUpdated += 1;
    }
  }

  const saved = { materialTypeId: materialType.id, priceRuleId: priceRule.id };
  cache.set(cacheKey, saved);
  return saved;
};

const findByIdentityTag = async (db: PrismaClient, seedKey: string) => {
  const tag = communityMaterialIdentityTag(seedKey);
  return db.material.findFirst({
    where: { tags: { some: { tag } } },
    include: {
      images: { select: { id: true, imageUrl: true, sortOrder: true, isCover: true } },
      tags: { select: { id: true, tag: true } },
      reservations: { select: { id: true }, take: 1 },
    },
  });
};

const syncImages = async (
  db: PrismaClient,
  materialId: string,
  imageUrls: string[],
  hasReservations: boolean,
) => {
  const existing = await db.materialImage.findMany({
    where: { materialId },
    select: { id: true, imageUrl: true, sortOrder: true, isCover: true },
    orderBy: { sortOrder: "asc" },
  });

  const existingUrls = existing.map((image) => image.imageUrl);
  const same =
    existingUrls.length === imageUrls.length &&
    existingUrls.every((url, index) => url === imageUrls[index]);
  if (same) return false;

  // Safe replace for demo gallery; reservations do not depend on image rows.
  void hasReservations;
  await db.materialImage.deleteMany({ where: { materialId } });
  await db.materialImage.createMany({
    data: imageUrls.map((imageUrl, index) => ({
      materialId,
      imageUrl,
      sortOrder: index,
      isCover: index === 0,
    })),
  });
  return true;
};

const syncManagedTags = async (
  db: PrismaClient,
  materialId: string,
  seedKey: string,
  managedTags: string[],
) => {
  const identity = communityMaterialIdentityTag(seedKey);
  const desired = new Set([COMMUNITY_MATERIAL_BULK_TAG, identity, ...managedTags]);
  const existing = await db.materialTag.findMany({
    where: { materialId },
    select: { id: true, tag: true },
  });

  const existingSet = new Set(existing.map((tag) => tag.tag));
  const toCreate = [...desired].filter((tag) => !existingSet.has(tag));
  const toDelete = existing.filter((tag) => {
    if (desired.has(tag.tag)) return false;
    // Keep unknown/manual tags that are not community-managed prefixes.
    if (tag.tag === COMMUNITY_MATERIAL_BULK_TAG) return true;
    if (tag.tag.startsWith("il-demo-mat:")) return true;
    if (managedTags.includes(tag.tag)) return true;
    // Only remove previously managed taxonomy helper tags we control.
    return false;
  });

  // Remove stale identity/bulk only if wrong; keep other tags.
  const staleManaged = existing.filter(
    (tag) =>
      (tag.tag.startsWith("il-demo-mat:") && tag.tag !== identity) ||
      (managedTags.length > 0 &&
        existingSet.has(tag.tag) &&
        !desired.has(tag.tag) &&
        /^[a-z0-9_]+$/.test(tag.tag) &&
        tag.tag !== COMMUNITY_MATERIAL_BULK_TAG),
  );

  if (staleManaged.length > 0) {
    await db.materialTag.deleteMany({
      where: { id: { in: staleManaged.map((tag) => tag.id) } },
    });
  }

  if (toCreate.length > 0) {
    await db.materialTag.createMany({
      data: toCreate.map((tag) => ({ materialId, tag })),
      skipDuplicates: true,
    });
  }

  return toCreate.length > 0 || staleManaged.length > 0 || toDelete.length > 0;
};

const cleanupOrphanCommunityTypes = async (
  _db: PrismaClient,
): Promise<number> => {
  // Intentionally conservative: do not auto-delete MaterialTypes in sync.
  // Orphans from remaps are reported via QA; deletion requires explicit review
  // because types may be referenced by future project components.
  void _db;
  return 0;
};

export const seedCommunityDemoMaterials = async (
  db: PrismaClient = prisma,
): Promise<SeedCommunityDemoMaterialsResult> => {
  assertLocalDemoDatabaseUrl(
    process.env.DATABASE_URL,
    "community demo materials seeding",
  );

  const validation = loadAndValidateCanonicalMaterials();
  writeExpectedImageManifest();

  const hardIssues = validation.issues.filter((issue) =>
    [
      "duplicate_seed_key",
      "duplicate_canonical_id",
      "unknown_category_key",
      "invalid_quantity",
      "invalid_price",
      "free_price_mismatch",
      "paid_price_mismatch",
      "invalid_condition",
      "invalid_source_type",
      "missing_extracted_image",
      "not_canonical_ready",
      "excluded_unavailable",
      "missing_source_image_file",
    ].includes(issue.code),
  );

  if (hardIssues.length > 0) {
    throw new Error(
      `Community materials validation failed (${hardIssues.length}).\n- ${hardIssues
        .slice(0, 30)
        .map((issue) => `${issue.code}: ${issue.seedKey} ${issue.detail}`)
        .join("\n- ")}`,
    );
  }

  const resolved = applyCommunityMaterialQuality(validation.materials);
  const qualitySummary = summarizeQuality(resolved);
  const productionAliasesEnsured = await ensureProductionMaterialTypeAliases(db);

  // Strip known-bad accessory aliases that older syncs may have attached to kits.
  const piKit = await db.materialType.findFirst({
    where: { nameEn: "Raspberry Pi Kit", isActive: true },
    select: { id: true },
  });
  if (piKit) {
    await db.materialTypeAlias.deleteMany({
      where: {
        materialTypeId: piKit.id,
        normalizedAlias: normalizeSearchText("Heatsink"),
      },
    });
  }

  const categories = await resolveCategories(db);
  const ownerEmails = [
    ...new Set(resolved.map((material) => material.resolvedOwnerEmail)),
  ];
  const owners = await resolveOwners(db, ownerEmails);

  const typeMaxPrice = new Map<string, number>();
  for (const material of resolved) {
    const categoryId = categories.get(material.categoryKey)!;
    const key = `${categoryId}:${normalizeSearchText(material.resolvedMaterialType)}:${material.unitNormalized}`;
    const price = material.isFree ? 0 : material.priceNis;
    typeMaxPrice.set(key, Math.max(typeMaxPrice.get(key) ?? 0, price));
  }

  const typeCache = new Map<
    string,
    { materialTypeId: string; priceRuleId: string | null }
  >();
  const stats = {
    materialTypesReused: 0,
    materialTypesCreated: 0,
    priceRulesReused: 0,
    priceRulesCreated: 0,
    priceRulesUpdated: 0,
    aliasesCreated: 0,
  };

  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let freeListings = 0;
  let paidListings = 0;
  const sampleMaterialIds: string[] = [];
  const conditionDistribution: Record<string, number> = {};

  for (const material of resolved) {
    conditionDistribution[material.resolvedCondition] =
      (conditionDistribution[material.resolvedCondition] ?? 0) + 1;
    if (material.isFree) freeListings += 1;
    else paidListings += 1;

    const owner = owners.get(material.resolvedOwnerEmail);
    if (!owner) {
      throw new Error(`Owner missing after resolution: ${material.resolvedOwnerEmail}`);
    }

    const categoryId = categories.get(material.categoryKey)!;
    const { materialTypeId, priceRuleId } = await ensureMaterialTypeAndPriceRule(
      db,
      categoryId,
      material,
      stats,
      typeCache,
      typeMaxPrice,
    );

    const imageUrls = material.extractedImageFiles.map((relativePath) =>
      communityDemoMaterialImageUrl(relativePath),
    );

    const existing = await findByIdentityTag(db, material.seedKey);
    const desired = {
      ownerId: owner.userId,
      supplierProfileId: owner.supplierProfileId,
      categoryId,
      title: material.displayTitle,
      description: material.resolvedDescription,
      materialType: material.resolvedMaterialType,
      materialTypeId,
      priceRuleId,
      quantity: material.quantity,
      unit: material.unitNormalized,
      condition: material.resolvedCondition,
      sourceType: material.sourceType,
      status: "AVAILABLE" as const,
      isFree: material.isFree,
      price: material.isFree ? null : material.priceNis,
      currency: CURRENCY,
      locationId: owner.pickupLocationId,
      pickupAllowed: material.pickupAllowed,
      deliveryAllowed: material.deliveryAllowed,
      suggestedUses: material.resolvedSuggestedUses,
      createdAt: material.createdAt,
      maxAllowedPriceAtCheck: material.isFree ? null : material.priceNis,
      priceCheckedAt: new Date(),
    };

    if (!existing) {
      const createdMaterial = await db.material.create({
        data: {
          ...desired,
          images: {
            create: imageUrls.map((imageUrl, index) => ({
              imageUrl,
              sortOrder: index,
              isCover: index === 0,
            })),
          },
          tags: {
            create: [
              COMMUNITY_MATERIAL_BULK_TAG,
              communityMaterialIdentityTag(material.seedKey),
              ...material.managedTags,
            ].map((tag) => ({ tag })),
          },
        },
        select: { id: true },
      });
      created += 1;
      if (sampleMaterialIds.length < 12) sampleMaterialIds.push(createdMaterial.id);
      continue;
    }

    const needsUpdate =
      existing.ownerId !== desired.ownerId ||
      existing.supplierProfileId !== desired.supplierProfileId ||
      existing.categoryId !== desired.categoryId ||
      existing.title !== desired.title ||
      existing.description !== desired.description ||
      existing.materialType !== desired.materialType ||
      existing.materialTypeId !== desired.materialTypeId ||
      existing.priceRuleId !== desired.priceRuleId ||
      !sameDecimal(existing.quantity, desired.quantity) ||
      existing.unit !== desired.unit ||
      existing.condition !== desired.condition ||
      existing.sourceType !== desired.sourceType ||
      existing.isFree !== desired.isFree ||
      !sameDecimal(existing.price, desired.price) ||
      existing.locationId !== desired.locationId ||
      existing.pickupAllowed !== desired.pickupAllowed ||
      existing.deliveryAllowed !== desired.deliveryAllowed ||
      existing.suggestedUses !== desired.suggestedUses ||
      existing.createdAt.getTime() !== desired.createdAt.getTime();

    let changed = needsUpdate;
    if (needsUpdate) {
      await db.material.update({
        where: { id: existing.id },
        data: {
          ownerId: desired.ownerId,
          supplierProfileId: desired.supplierProfileId,
          categoryId: desired.categoryId,
          title: desired.title,
          description: desired.description,
          materialType: desired.materialType,
          materialTypeId: desired.materialTypeId,
          priceRuleId: desired.priceRuleId,
          quantity: desired.quantity,
          unit: desired.unit,
          condition: desired.condition,
          sourceType: desired.sourceType,
          status: desired.status,
          isFree: desired.isFree,
          price: desired.price,
          currency: desired.currency,
          locationId: desired.locationId,
          pickupAllowed: desired.pickupAllowed,
          deliveryAllowed: desired.deliveryAllowed,
          suggestedUses: desired.suggestedUses,
          createdAt: desired.createdAt,
          maxAllowedPriceAtCheck: desired.maxAllowedPriceAtCheck,
          priceCheckedAt: desired.priceCheckedAt,
        },
      });
    }

    const imagesChanged = await syncImages(
      db,
      existing.id,
      imageUrls,
      existing.reservations.length > 0,
    );
    const tagsChanged = await syncManagedTags(
      db,
      existing.id,
      material.seedKey,
      material.managedTags,
    );
    changed = changed || imagesChanged || tagsChanged;

    if (changed) {
      updated += 1;
      if (sampleMaterialIds.length < 12) sampleMaterialIds.push(existing.id);
    } else {
      unchanged += 1;
    }
  }

  const orphanCommunityTypesDeleted = await cleanupOrphanCommunityTypes(db);

  return {
    dataset: "community-demo-materials",
    mode: "sync",
    sourceRows: resolved.length,
    created,
    updated,
    unchanged,
    ownersResolved: owners.size,
    activeOwnersAssigned: qualitySummary.activeOwners,
    materialTypesReused: stats.materialTypesReused,
    materialTypesCreated: stats.materialTypesCreated,
    priceRulesReused: stats.priceRulesReused,
    priceRulesCreated: stats.priceRulesCreated,
    priceRulesUpdated: stats.priceRulesUpdated,
    aliasesCreated: stats.aliasesCreated,
    productionAliasesEnsured,
    orphanCommunityTypesDeleted,
    freeListings,
    paidListings,
    conditionDistribution,
    imagePublicPrefix: COMMUNITY_DEMO_MATERIALS_PUBLIC_PREFIX,
    missingImages: validation.missingImageRelativePaths,
    qualitySummary,
    sampleMaterialIds,
    note:
      "Sync identity is il-demo-mat:<seedKey> (owner-independent). Provenance owners remain in CSV; resolved owners may be redistributed for demo realism.",
  };
};

const isDirectRun = () => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(entry) === path.resolve(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};

if (isDirectRun()) {
  try {
    const result = await seedCommunityDemoMaterials();
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
