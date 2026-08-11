import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  communityDemoMaterialImageDiskPath,
} from "../../../src/constants/community-demo-materials.js";

export const COMMUNITY_MATERIAL_TAG_PREFIX = "il-demo-mat:";
export const COMMUNITY_MATERIAL_BULK_TAG = "community-demo";

export const communityMaterialIdentityTag = (seedKey: string): string =>
  `${COMMUNITY_MATERIAL_TAG_PREFIX}${seedKey}`;

const MATERIALS_DIR = path.dirname(fileURLToPath(import.meta.url));

export const CATEGORY_KEY_TO_NAME_EN = {
  "electronics-components": "Electronics & Components",
  "motors-mechanical": "Motors & Mechanical Parts",
  "power-batteries": "Power & Batteries",
  "wood-boards": "Wood & Boards",
  "plastics-acrylic": "Plastics & Acrylic",
  "metal-fasteners": "Metal & Fasteners",
  "fabric-textiles": "Fabric & Textiles",
  "paper-cardboard": "Paper & Cardboard",
  "tools-hardware": "Tools & Hardware",
  "art-craft-supplies": "Art & Craft Supplies",
  "packaging-containers": "Packaging & Containers",
  "lab-education": "Lab & Education Supplies",
  "other-reusable": "Other Reusable Materials",
} as const;

export type CommunityCategoryKey = keyof typeof CATEGORY_KEY_TO_NAME_EN;

const MATERIAL_CONDITIONS = new Set([
  "NEW",
  "LIKE_NEW",
  "GOOD",
  "USED",
  "NEEDS_REPAIR",
]);

const MATERIAL_SOURCE_TYPES = new Set([
  "STUDENT_LEFTOVER",
  "WORKSHOP_SURPLUS",
  "FACTORY_SURPLUS",
  "EDUCATIONAL_INSTITUTION",
]);

export type CanonicalCommunityMaterial = {
  canonicalId: string;
  seedKey: string;
  title: string;
  materialType: string;
  categoryKey: CommunityCategoryKey;
  quantity: number;
  unit: string;
  unitNormalized: string;
  condition: "NEW" | "LIKE_NEW" | "GOOD" | "USED" | "NEEDS_REPAIR";
  sourceType:
    | "STUDENT_LEFTOVER"
    | "WORKSHOP_SURPLUS"
    | "FACTORY_SURPLUS"
    | "EDUCATIONAL_INSTITUTION";
  isFree: boolean;
  priceNis: number;
  ownerEmail: string;
  ownerPublicName: string;
  ownerKind: string;
  ownerCity: string;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
  descriptionDraft: string;
  suggestedUses: string;
  tags: string[];
  aliases: string[];
  sourceFile: string;
  sourceRow: string;
  sourceAuditId: string;
  originalPriceRaw: string;
  pricingResolution: string;
  pricingBasis: string;
  conditionBasis: string;
  availabilitySource: string;
  sourceNote: string;
  imageStatus: string;
  sourceImageRef: string;
  extractedImageFiles: string[];
  imageMappedFromSource: boolean;
  imageGap: boolean;
  imageHostingRequired: boolean;
  canonicalizationConfidence: string;
  canonicalDataReady: boolean;
  ownerAssignmentBasis: string;
  generatedFields: string[];
};

export type CanonicalMaterialsValidationResult = {
  materials: CanonicalCommunityMaterial[];
  ownerEmails: string[];
  expectedImageRelativePaths: string[];
  missingImageRelativePaths: string[];
  issues: Array<{ seedKey: string; code: string; detail: string }>;
};

const parseCsv = (content: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i]!;
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((value) => value.trim().length > 0));
};

const parseBool = (value: string): boolean => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  throw new Error(`Invalid boolean: ${value}`);
};

const splitPipeList = (value: string): string[] =>
  value
    .split(/[|;]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

const normalizeUnit = (unit: string): string => {
  const trimmed = unit.trim().toLowerCase();
  if (trimmed === "piece" || trimmed === "pieces") return "pieces";
  if (trimmed === "set" || trimmed === "sets") return "sets";
  if (trimmed === "pack" || trimmed === "packs") return "packs";
  return trimmed;
};

const resolveCanonicalCsvPath = (): string => {
  const preferred = path.join(MATERIALS_DIR, "canonical-materials.csv");
  if (!fs.existsSync(preferred)) {
    throw new Error(`Canonical materials CSV missing: ${preferred}`);
  }
  return preferred;
};

export const loadAndValidateCanonicalMaterials = (): CanonicalMaterialsValidationResult => {
  const csvPath = resolveCanonicalCsvPath();
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (rows.length < 2) {
    throw new Error(`Canonical materials CSV is empty: ${csvPath}`);
  }

  const header = rows[0]!;
  const index = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
  const get = (row: string[], key: string): string =>
    (row[index[key] ?? -1] ?? "").trim();

  const materials: CanonicalCommunityMaterial[] = [];
  const issues: CanonicalMaterialsValidationResult["issues"] = [];
  const seedKeys = new Set<string>();
  const canonicalIds = new Set<string>();
  const identityKeys = new Set<string>();

  for (const row of rows.slice(1)) {
    const seedKey = get(row, "Seed Key");
    const canonicalId = get(row, "Canonical ID");
    const title = get(row, "Title");
    const materialType = get(row, "Material Type");
    const categoryKeyRaw = get(row, "Category Key");
    const quantity = Number(get(row, "Quantity"));
    const unit = get(row, "Unit");
    const condition = get(row, "Condition");
    const sourceType = get(row, "Source Type");
    const isFree = parseBool(get(row, "Is Free"));
    const priceNis = Number(get(row, "Price NIS"));
    const ownerEmail = get(row, "Owner Email").toLowerCase();
    const extractedImageFiles = splitPipeList(get(row, "Extracted Image Files"));
    const tags = splitPipeList(get(row, "Tags"));
    const aliases = splitPipeList(get(row, "Aliases"));
    const descriptionDraft = get(row, "Description Draft");
    const suggestedUses = get(row, "Suggested Uses");
    const availabilitySource = get(row, "Availability Source");
    const canonicalDataReady = parseBool(get(row, "Canonical Data Ready"));
    const generatedFields: string[] = [];

    if (!seedKey) {
      issues.push({ seedKey: "", code: "missing_seed_key", detail: title });
      continue;
    }

    if (seedKeys.has(seedKey)) {
      issues.push({
        seedKey,
        code: "duplicate_seed_key",
        detail: seedKey,
      });
    }
    seedKeys.add(seedKey);

    if (!canonicalId) {
      issues.push({ seedKey, code: "missing_canonical_id", detail: title });
    } else if (canonicalIds.has(canonicalId)) {
      issues.push({
        seedKey,
        code: "duplicate_canonical_id",
        detail: canonicalId,
      });
    }
    canonicalIds.add(canonicalId);

    const ownerIdentity = `${ownerEmail}::${seedKey}`;
    if (identityKeys.has(ownerIdentity)) {
      issues.push({
        seedKey,
        code: "duplicate_owner_seed_identity",
        detail: ownerIdentity,
      });
    }
    identityKeys.add(ownerIdentity);

    if (!(categoryKeyRaw in CATEGORY_KEY_TO_NAME_EN)) {
      issues.push({
        seedKey,
        code: "unknown_category_key",
        detail: categoryKeyRaw,
      });
    }

    if (!(quantity > 0)) {
      issues.push({
        seedKey,
        code: "invalid_quantity",
        detail: String(quantity),
      });
    }

    if (Number.isNaN(priceNis) || priceNis < 0) {
      issues.push({
        seedKey,
        code: "invalid_price",
        detail: String(priceNis),
      });
    }

    if (isFree && priceNis !== 0) {
      issues.push({
        seedKey,
        code: "free_price_mismatch",
        detail: `isFree=true but price=${priceNis}`,
      });
    }

    if (!isFree && !(priceNis > 0)) {
      issues.push({
        seedKey,
        code: "paid_price_mismatch",
        detail: `isFree=false but price=${priceNis}`,
      });
    }

    if (!MATERIAL_CONDITIONS.has(condition)) {
      issues.push({
        seedKey,
        code: "invalid_condition",
        detail: condition,
      });
    }

    if (!MATERIAL_SOURCE_TYPES.has(sourceType)) {
      issues.push({
        seedKey,
        code: "invalid_source_type",
        detail: sourceType,
      });
    }

    if (!ownerEmail.endsWith("@impactloop.demo")) {
      issues.push({
        seedKey,
        code: "owner_not_community_demo",
        detail: ownerEmail,
      });
    }

    if (extractedImageFiles.length === 0) {
      issues.push({
        seedKey,
        code: "missing_extracted_image",
        detail: title,
      });
    }

    if (!canonicalDataReady) {
      issues.push({
        seedKey,
        code: "not_canonical_ready",
        detail: "Canonical Data Ready=false",
      });
    }

    const unavailable =
      availabilitySource === "SOLD" ||
      availabilitySource === "UNAVAILABLE" ||
      availabilitySource === "EXCLUDED";
    if (unavailable) {
      issues.push({
        seedKey,
        code: "excluded_unavailable",
        detail: availabilitySource,
      });
      continue;
    }

    if (!descriptionDraft) {
      generatedFields.push("description");
    }
    if (!suggestedUses) {
      generatedFields.push("suggestedUses");
    }
    if (tags.length === 0) {
      generatedFields.push("tags");
    }

    materials.push({
      canonicalId,
      seedKey,
      title,
      materialType,
      categoryKey: categoryKeyRaw as CommunityCategoryKey,
      quantity,
      unit,
      unitNormalized: normalizeUnit(unit),
      condition: condition as CanonicalCommunityMaterial["condition"],
      sourceType: sourceType as CanonicalCommunityMaterial["sourceType"],
      isFree,
      priceNis,
      ownerEmail,
      ownerPublicName: get(row, "Owner Public Name"),
      ownerKind: get(row, "Owner Kind"),
      ownerCity: get(row, "Owner City"),
      pickupAllowed: parseBool(get(row, "Pickup Allowed")),
      deliveryAllowed: parseBool(get(row, "Delivery Allowed")),
      descriptionDraft,
      suggestedUses,
      tags,
      aliases,
      sourceFile: get(row, "Source File"),
      sourceRow: get(row, "Source Row"),
      sourceAuditId: get(row, "Source Audit ID"),
      originalPriceRaw: get(row, "Original Price Raw"),
      pricingResolution: get(row, "Pricing Resolution"),
      pricingBasis: get(row, "Pricing Basis"),
      conditionBasis: get(row, "Condition Basis"),
      availabilitySource,
      sourceNote: get(row, "Source Note"),
      imageStatus: get(row, "Image Status"),
      sourceImageRef: get(row, "Source Image Ref"),
      extractedImageFiles,
      imageMappedFromSource: parseBool(get(row, "Image Mapped From Source")),
      imageGap: parseBool(get(row, "Image Gap")),
      imageHostingRequired: parseBool(get(row, "Image Hosting Required")),
      canonicalizationConfidence: get(row, "Canonicalization Confidence"),
      canonicalDataReady,
      ownerAssignmentBasis: get(row, "Owner Assignment Basis"),
      generatedFields,
    });
  }

  const expectedImageRelativePaths = [
    ...new Set(materials.flatMap((material) => material.extractedImageFiles)),
  ].sort();

  const missingImageRelativePaths = expectedImageRelativePaths.filter(
    (relativePath) => !fs.existsSync(communityDemoMaterialImageDiskPath(relativePath)),
  );

  for (const relativePath of missingImageRelativePaths) {
    issues.push({
      seedKey: "",
      code: "missing_source_image_file",
      detail: relativePath,
    });
  }

  return {
    materials,
    ownerEmails: [...new Set(materials.map((material) => material.ownerEmail))].sort(),
    expectedImageRelativePaths,
    missingImageRelativePaths,
    issues,
  };
};

export const writeExpectedImageManifest = (): string => {
  const validation = loadAndValidateCanonicalMaterials();
  const manifestDir = path.join(MATERIALS_DIR, "source-images");
  fs.mkdirSync(path.join(manifestDir, "materials"), { recursive: true });

  const lines = [
    "canonical_id,seed_key,extracted_image_file,source_image_ref,disk_relative_path,present",
    ...validation.materials.flatMap((material) =>
      material.extractedImageFiles.map((image) => {
        const present = fs.existsSync(communityDemoMaterialImageDiskPath(image))
          ? "true"
          : "false";
        return [
          material.canonicalId,
          material.seedKey,
          image,
          material.sourceImageRef,
          image,
          present,
        ]
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(",");
      }),
    ),
  ];

  const manifestPath = path.join(manifestDir, "manifest.csv");
  fs.writeFileSync(manifestPath, `${lines.join("\n")}\n`, "utf8");
  return manifestPath;
};
