import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  communityDemoMaterialImageDiskPath,
  communityDemoMaterialImageUrl,
} from "../../../../src/constants/community-demo-materials.js";
import {
  resolveMaterialImageDiskPath,
  resolveMaterialImagePublicUrl,
} from "./resolve-core-material-images.js";
import { SEED_CATALOG_REAL_IMAGE_PATHS } from "../../materials/seed-catalog-images.data.js";
import { CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS } from "./core-material-supplement.data.js";
import { resolveCoreMaterialImageRelativePaths } from "./resolve-core-material-images.js";

type Verdict =
  | "GOOD"
  | "ACCEPTABLE_REUSE"
  | "REPLACE_WRONG_SUBJECT"
  | "REPLACE_TOO_GENERIC"
  | "REPLACE_WATERMARK"
  | "REPLACE_DUPLICATE_VISUAL"
  | "MISSING";

type MaterialAuditRow = {
  key: string;
  title: string;
  materialType: string;
  categoryKey: string;
  supplierEmail: string;
  relativePaths: string[];
  publicUrls: string[];
  diskPaths: string[];
  sharedCount: number;
  sharedWith: string[];
  verdict: Verdict;
  reason: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "../../../..");
const seedSource = fs.readFileSync(
  path.join(backendRoot, "prisma/seed.ts"),
  "utf8",
);

const KNOWN_WRONG: Record<string, { verdict: Verdict; reason: string }> = {
  "supplier-measuring-tapes": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-043 drill motor photo, not measuring tapes.",
  },
  "supplier-hand-saws": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-241 CNC/wood frame photo, not hand saws.",
  },
  "supplier-paint-rollers": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to paint brushes seed-catalog image, not roller sets.",
  },
  "supplier-clamps": {
    verdict: "GOOD",
    reason: "Patch v1 dedicated clamp product photo.",
  },
  "supplier-spirit-levels": {
    verdict: "GOOD",
    reason: "Patch v1 dedicated spirit level product photo.",
  },
  "supplier-hammers": {
    verdict: "GOOD",
    reason: "Patch v1 dedicated claw hammer product photo.",
  },
  "supplier-pliers": {
    verdict: "GOOD",
    reason: "Patch v1 dedicated pliers product photo.",
  },
  "supplier-ceramic-tiles": {
    verdict: "GOOD",
    reason: "Patch v1 dedicated ceramic tile offcuts photo.",
  },
  "supplier-nylon-rope": {
    verdict: "GOOD",
    reason: "Patch v1 dedicated nylon rope bundle photo.",
  },
  "supplier-screwdrivers": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-043 drill motor photo, not screwdrivers.",
  },
  "supplier-pulleys": {
    verdict: "REPLACE_WATERMARK",
    reason: "Mapped to MAT-136 pulley photo with visible source watermark risk.",
  },
  "supplier-springs-assortment": {
    verdict: "REPLACE_WATERMARK",
    reason: "Mapped to MAT-136 photo; questionable/watermarked mechanical parts.",
  },
  "supplier-chain-links": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-136 belt/pulley photo, not roller chain sections.",
  },
  "supplier-rubber-belts": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-136 belt photo; weak match for mixed drive belts assortment.",
  },
  "supplier-drawer-slides": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-168 linear rail photo, not drawer slide pairs.",
  },
  "supplier-bearings": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-168 linear rail photo, not ball bearing assortments.",
  },
  "supplier-metal-rods": {
    verdict: "REPLACE_DUPLICATE_VISUAL",
    reason: "Same MAT-114 threaded/screw photo reused for unrelated metal stock.",
  },
  "supplier-wire-mesh": {
    verdict: "REPLACE_DUPLICATE_VISUAL",
    reason: "Same MAT-114 photo reused; does not show wire mesh.",
  },
  "supplier-bolts-washers": {
    verdict: "REPLACE_DUPLICATE_VISUAL",
    reason: "Same MAT-114 photo reused; weak bolt/washer representation.",
  },
  "supplier-aluminum-sheets": {
    verdict: "REPLACE_DUPLICATE_VISUAL",
    reason: "Same MAT-114 photo reused; does not show aluminum sheet offcuts.",
  },
  "supplier-steel-plates": {
    verdict: "REPLACE_DUPLICATE_VISUAL",
    reason: "Same MAT-114 photo reused; does not show steel plate offcuts.",
  },
  "supplier-colored-acrylic-sheets": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-161 3D printed dispenser photo, not acrylic sheet offcuts.",
  },
  "supplier-polycarbonate-sheets": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-160 molded 3D part photo, not polycarbonate sheets.",
  },
  "supplier-hdpe-sheets": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-160 molded 3D part photo, not HDPE sheet offcuts.",
  },
  "supplier-sandpaper-sheets": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-043 drill motor photo, not sandpaper sheets.",
  },
  "supplier-wood-glue-bottles": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to MAT-165 cup holder photo, not wood glue bottles.",
  },
  "supplier-wooden-dowels": {
    verdict: "REPLACE_TOO_GENERIC",
    reason: "Mapped to MAT-241 CNC/wood frame photo; not dowel bundles.",
  },
  "supplier-wood-blocks": {
    verdict: "REPLACE_TOO_GENERIC",
    reason: "Mapped to MAT-241 CNC/wood frame photo; not mixed wood blocks.",
  },
  "supplier-reclaimed-pallet-boards": {
    verdict: "REPLACE_TOO_GENERIC",
    reason: "Mapped to MAT-241 CNC/wood frame photo; not pallet boards.",
  },
  "supplier-timber-beams": {
    verdict: "REPLACE_TOO_GENERIC",
    reason: "Mapped to MAT-241 CNC/wood frame photo; not timber beams.",
  },
  "supplier-particleboard-offcuts": {
    verdict: "REPLACE_TOO_GENERIC",
    reason: "Mapped to MAT-241 CNC/wood frame photo; not particleboard offcuts.",
  },
  "supplier-veneer-sheets": {
    verdict: "REPLACE_TOO_GENERIC",
    reason: "Mapped to MAT-241 CNC/wood frame photo; not veneer sheets.",
  },
  "supplier-plywood-panels": {
    verdict: "REPLACE_TOO_GENERIC",
    reason: "Mapped to MAT-241 CNC/wood frame photo; weak plywood panel match.",
  },
  "supplier-mdf-offcuts": {
    verdict: "REPLACE_TOO_GENERIC",
    reason: "Mapped to MAT-241 CNC/wood frame photo; not MDF offcuts.",
  },
  "supplier-pine-strips": {
    verdict: "REPLACE_TOO_GENERIC",
    reason: "Mapped to MAT-241 CNC/wood frame photo; not pine strips.",
  },
  "israa-glass-jars": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to tin cans seed-catalog image, not glass jars.",
  },
  "israa-bottle-caps": {
    verdict: "REPLACE_WRONG_SUBJECT",
    reason: "Mapped to plastic containers photo, not sorted bottle caps.",
  },
};

const SEED_CATALOG_GOOD = new Set(Object.keys(SEED_CATALOG_REAL_IMAGE_PATHS));

const parseMaterials = () => {
  const sections = [
    seedSource.slice(
      seedSource.indexOf("const CORE_MATERIALS"),
      seedSource.indexOf("const ADDITIONAL_MATERIALS"),
    ),
    seedSource.slice(
      seedSource.indexOf("const ADDITIONAL_MATERIALS"),
      seedSource.indexOf("const MATERIALS:"),
    ),
  ];

  const materials: Array<{
    key: string;
    title: string;
    materialType: string;
    categoryKey: string;
    supplierEmail: string;
  }> = [];

  for (const section of sections) {
    const keys = [...section.matchAll(/key:\s*['"]([^'"]+)['"]/g)].map(
      (match) => match[1],
    );

    for (const key of keys) {
      const blockMatch = section.match(
        new RegExp(
          `key:\\s*['"]${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"][\\s\\S]*?title:\\s*['"]([^'"]+)['"][\\s\\S]*?categoryKey:\\s*['"]([^'"]+)['"][\\s\\S]*?materialType:\\s*['"]([^'"]+)['"][\\s\\S]*?supplierEmail:\\s*['"]([^'"]+)['"]`,
        ),
      );

      if (!blockMatch) continue;

      materials.push({
        key,
        title: blockMatch[1],
        categoryKey: blockMatch[2],
        materialType: blockMatch[3],
        supplierEmail: blockMatch[4],
      });
    }
  }

  return materials;
};

const BATCH1_ENTITY_KEYS = new Set([
  "supplier-measuring-tapes",
  "supplier-screwdrivers",
  "supplier-hand-saws",
  "supplier-paint-rollers",
  "supplier-pulleys",
  "supplier-springs-assortment",
  "supplier-chain-links",
  "supplier-rubber-belts",
  "supplier-drawer-slides",
  "supplier-bearings",
  "supplier-metal-rods",
  "supplier-wire-mesh",
  "supplier-bolts-washers",
  "supplier-aluminum-sheets",
  "supplier-steel-plates",
  "supplier-colored-acrylic-sheets",
  "supplier-polycarbonate-sheets",
  "supplier-hdpe-sheets",
  "supplier-sandpaper-sheets",
  "supplier-wood-glue-bottles",
]);

const BATCH2_ENTITY_KEYS = new Set([
  "supplier-plywood-panels",
  "supplier-mdf-offcuts",
  "supplier-pine-strips",
  "supplier-reclaimed-pallet-boards",
  "supplier-timber-beams",
  "supplier-particleboard-offcuts",
  "supplier-veneer-sheets",
  "supplier-wooden-dowels",
  "supplier-wood-blocks",
  "israa-bottle-caps",
  "israa-glass-jars",
  "supplier-acrylic-sheets",
  "supplier-aluminum-angles",
  "supplier-screws-nuts",
  "supplier-drill-bits",
  "supplier-pvc-pipes",
]);

const BATCH3_ENTITY_KEYS = new Set([
  "israa-wax-molds",
  "israa-fabric-scraps",
  "israa-denim-offcuts",
  "israa-foam-board",
  "israa-cotton-offcuts",
  "israa-canvas-offcuts",
  "israa-leather-offcuts",
  "israa-foam-sheets",
  "israa-plastic-bottles",
  "israa-resin-molds",
  "supplier-plastic-crates",
  "supplier-storage-baskets",
  "supplier-plastic-trays",
  "supplier-insulation-foam",
  "supplier-hinges-set",
  "supplier-pvc-conduits",
]);

const INTEGRATED_BATCH_ENTITY_KEYS = new Set([
  ...BATCH1_ENTITY_KEYS,
  ...BATCH2_ENTITY_KEYS,
  ...BATCH3_ENTITY_KEYS,
]);

const inferVerdict = (
  material: (ReturnType<typeof parseMaterials>[number]),
  relativePaths: readonly string[],
  sharedCount: number,
  sharedWith: string[],
): { verdict: Verdict; reason: string } => {
  if (INTEGRATED_BATCH_ENTITY_KEYS.has(material.key)) {
    return {
      verdict: "GOOD",
      reason: "Integrated visual batch dedicated product photo.",
    };
  }

  const known = KNOWN_WRONG[material.key];
  if (known) return known;

  if (SEED_CATALOG_GOOD.has(material.key)) {
    return {
      verdict: "GOOD",
      reason: "Dedicated seed-catalog product photo mapped to this key.",
    };
  }

  if (sharedCount >= 8) {
    return {
      verdict: "REPLACE_DUPLICATE_VISUAL",
      reason: `Same image reused by ${sharedCount} materials including ${sharedWith.slice(0, 3).join(", ")}.`,
    };
  }

  if (sharedCount >= 3) {
    return {
      verdict: "REPLACE_TOO_GENERIC",
      reason: `Shared image used by ${sharedCount} materials; likely category fallback.`,
    };
  }

  if (CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS[material.key]) {
    return {
      verdict: "ACCEPTABLE_REUSE",
      reason: "Supplement mapping to related community hardware photo; manual review recommended.",
    };
  }

  return {
    verdict: "MISSING",
    reason: "No local mapping found.",
  };
};

const main = () => {
  const materials = parseMaterials();
  const imageToKeys = new Map<string, string[]>();

  for (const material of materials) {
    const relativePaths = resolveCoreMaterialImageRelativePaths(material.key);
    if (!relativePaths?.length) continue;
    for (const relativePath of relativePaths) {
      const keys = imageToKeys.get(relativePath) ?? [];
      keys.push(material.key);
      imageToKeys.set(relativePath, keys);
    }
  }

  const rows: MaterialAuditRow[] = materials.map((material) => {
    const relativePaths =
      resolveCoreMaterialImageRelativePaths(material.key) ?? [];
    const primary = relativePaths[0] ?? "";
    const sharedWith = (imageToKeys.get(primary) ?? []).filter(
      (key) => key !== material.key,
    );
    const sharedCount = (imageToKeys.get(primary) ?? []).length;
    const { verdict, reason } = inferVerdict(
      material,
      relativePaths,
      sharedCount,
      [material.key, ...sharedWith],
    );

    return {
      key: material.key,
      title: material.title,
      materialType: material.materialType,
      categoryKey: material.categoryKey,
      supplierEmail: material.supplierEmail,
      relativePaths,
      publicUrls: relativePaths.map((p) => resolveMaterialImagePublicUrl(p)),
      diskPaths: relativePaths.map((p) => resolveMaterialImageDiskPath(p)),
      sharedCount,
      sharedWith,
      verdict,
      reason,
    };
  });

  const counts = rows.reduce<Record<Verdict, number>>(
    (acc, row) => {
      acc[row.verdict] += 1;
      return acc;
    },
    {
      GOOD: 0,
      ACCEPTABLE_REUSE: 0,
      REPLACE_WRONG_SUBJECT: 0,
      REPLACE_TOO_GENERIC: 0,
      REPLACE_WATERMARK: 0,
      REPLACE_DUPLICATE_VISUAL: 0,
      MISSING: 0,
    },
  );

  const duplicateReport = [...imageToKeys.entries()]
    .filter(([, keys]) => keys.length >= 3)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([relativePath, keys]) => ({
      relativePath,
      count: keys.length,
      keys,
      classification:
        keys.every((key) => SEED_CATALOG_GOOD.has(key))
          ? "semantic duplicate acceptable"
          : keys.length >= 8
            ? "clearly wrong duplicate"
            : "suspicious duplicate",
    }));

  console.log(
    JSON.stringify(
      {
        totalMaterials: rows.length,
        counts,
        duplicateReport,
        rows,
      },
      null,
      2,
    ),
  );
};

main();
