import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "../../../../src/database/prisma.js";
import { SEED_CATALOG_REAL_IMAGE_PATHS } from "../../materials/seed-catalog-images.data.js";
import { CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS } from "./core-material-supplement.data.js";
import {
  CORE_DEMO_PEOPLE_EMAILS,
  CORE_DEMO_PEOPLE_IMAGES,
  communityDemoOrganizationCoverRelativePath,
  communityDemoPersonAvatarRelativePath,
} from "./demo-people-images.data.js";
import {
  assertCoreMaterialImageMappingExistsOnDisk,
  assertDemoVisualAssetExistsOnDisk,
  resolveCoreMaterialImageRelativePaths,
} from "./resolve-core-material-images.js";

type AuditIssue = {
  severity: "error" | "warning";
  category: string;
  message: string;
};

const manifestDir = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(manifestDir, "../../../..");
const seedSource = fs.readFileSync(
  path.join(backendRoot, "prisma/seed.ts"),
  "utf8",
);

const collectCoreMaterialKeys = (): string[] => {
  const materialSection = seedSource.slice(
    seedSource.indexOf("const CORE_MATERIALS"),
    seedSource.indexOf("const MATERIALS:"),
  );
  const additionalSection = seedSource.slice(
    seedSource.indexOf("const ADDITIONAL_MATERIALS"),
    seedSource.indexOf("const MATERIALS:"),
  );

  const keys = [
    ...materialSection.matchAll(/key:\s*['"]([^'"]+)['"]/g),
    ...additionalSection.matchAll(/key:\s*['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);

  return [...new Set(keys)];
};

const isRemoteUrl = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().startsWith("https://");

const auditCoreMaterialManifests = (issues: AuditIssue[]) => {
  const keys = collectCoreMaterialKeys();
  const imageUseCount = new Map<string, number>();

  for (const key of keys) {
    const relativePaths = resolveCoreMaterialImageRelativePaths(key);
    if (!relativePaths?.length) {
      issues.push({
        severity: "error",
        category: "material-mapping",
        message: `Core material "${key}" has no local image mapping.`,
      });
      continue;
    }

    try {
      assertCoreMaterialImageMappingExistsOnDisk(key);
    } catch (error) {
      issues.push({
        severity: "error",
        category: "material-file",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    for (const relativePath of relativePaths) {
      imageUseCount.set(
        relativePath,
        (imageUseCount.get(relativePath) ?? 0) + 1,
      );
    }
  }

  for (const [relativePath, count] of imageUseCount.entries()) {
    if (count >= 8) {
      issues.push({
        severity: "warning",
        category: "material-duplicate",
        message: `Image "${relativePath}" is reused by ${count} core materials.`,
      });
    }
  }

  return {
    coreMaterialKeys: keys.length,
    seedCatalogMappings: Object.keys(SEED_CATALOG_REAL_IMAGE_PATHS).length,
    supplementMappings: Object.keys(CORE_MATERIAL_SUPPLEMENT_IMAGE_PATHS).length,
  };
};

const auditCorePeopleManifest = (issues: AuditIssue[]) => {
  for (const email of CORE_DEMO_PEOPLE_EMAILS) {
    const assets = CORE_DEMO_PEOPLE_IMAGES[email];

    try {
      assertDemoVisualAssetExistsOnDisk(
        assets.profileImageUrl.replace("/demo-assets/visual-assets/", ""),
      );
    } catch (error) {
      issues.push({
        severity: "error",
        category: "core-people",
        message: error instanceof Error ? error.message : String(error),
      });
    }

    if (email.endsWith("@supplier.com")) {
      if (!assets.supplierAvatarImageUrl || !assets.supplierCoverImageUrl) {
        issues.push({
          severity: "error",
          category: "core-people",
          message: `Supplier ${email} is missing avatar/cover mapping.`,
        });
      } else {
        for (const url of [
          assets.supplierAvatarImageUrl,
          assets.supplierCoverImageUrl,
        ]) {
          try {
            assertDemoVisualAssetExistsOnDisk(
              url.replace("/demo-assets/visual-assets/", ""),
            );
          } catch (error) {
            issues.push({
              severity: "error",
              category: "core-people",
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    }
  }

  return { corePeopleAccounts: CORE_DEMO_PEOPLE_EMAILS.length };
};

const auditSeededDatabase = async (
  issues: AuditIssue[],
  enabled: boolean,
) => {
  if (!enabled) {
    return null;
  }

  const [materialImages, users, suppliers] = await Promise.all([
    prisma.materialImage.findMany({
      select: { imageUrl: true, material: { select: { title: true } } },
    }),
    prisma.user.findMany({
      select: {
        email: true,
        profileImageUrl: true,
        activeRole: true,
      },
    }),
    prisma.supplierProfile.findMany({
      select: {
        publicName: true,
        avatarImageUrl: true,
        coverImageUrl: true,
        user: { select: { email: true } },
      },
    }),
  ]);

  let remoteMaterialImages = 0;
  for (const image of materialImages) {
    if (isRemoteUrl(image.imageUrl)) {
      remoteMaterialImages += 1;
      issues.push({
        severity: "error",
        category: "seeded-material",
        message: `Material "${image.material.title}" uses remote image URL: ${image.imageUrl}`,
      });
    }
  }

  const coreEmails = new Set<string>(CORE_DEMO_PEOPLE_EMAILS);
  let coreProfilesMissing = 0;
  let remoteProfiles = 0;

  for (const user of users) {
    if (isRemoteUrl(user.profileImageUrl)) {
      remoteProfiles += 1;
      issues.push({
        severity: "error",
        category: "seeded-profile",
        message: `User ${user.email} uses remote profile image: ${user.profileImageUrl}`,
      });
    }

    if (coreEmails.has(user.email) && !user.profileImageUrl) {
      coreProfilesMissing += 1;
      issues.push({
        severity: "error",
        category: "seeded-profile",
        message: `Core demo user ${user.email} is missing profileImageUrl.`,
      });
    }
  }

  let supplierAvatarsMissing = 0;
  let supplierCoversMissing = 0;
  let remoteSupplierImages = 0;

  for (const supplier of suppliers) {
    if (
      isRemoteUrl(supplier.avatarImageUrl) ||
      isRemoteUrl(supplier.coverImageUrl)
    ) {
      remoteSupplierImages += 1;
    }

    if (coreEmails.has(supplier.user.email)) {
      if (!supplier.avatarImageUrl) supplierAvatarsMissing += 1;
      if (!supplier.coverImageUrl) supplierCoversMissing += 1;
    }
  }

  return {
    materialImages: materialImages.length,
    remoteMaterialImages,
    users: users.length,
    remoteProfiles,
    coreProfilesMissing,
    suppliers: suppliers.length,
    supplierAvatarsMissing,
    supplierCoversMissing,
    remoteSupplierImages,
  };
};

const auditCommunityAssetFiles = (issues: AuditIssue[]) => {
  const communityDir = path.join(
    backendRoot,
    "prisma/demo-data/visual-assets/people/avatars/community",
  );

  if (!fs.existsSync(communityDir)) {
    issues.push({
      severity: "error",
      category: "community-people",
      message: `Missing generated community avatar directory: ${communityDir}`,
    });
    return { communityAvatarFiles: 0 };
  }

  const avatarFiles = fs
    .readdirSync(communityDir)
    .filter((name) => name.endsWith(".png")).length;

  if (avatarFiles < 100) {
    issues.push({
      severity: "warning",
      category: "community-people",
      message: `Expected at least 100 community avatar PNG files, found ${avatarFiles}. Run npm run demo:assets:people.`,
    });
  }

  return { communityAvatarFiles: avatarFiles };
};

const main = async () => {
  const issues: AuditIssue[] = [];
  const includeDatabaseAudit = process.argv.includes("--database");

  const materialSummary = auditCoreMaterialManifests(issues);
  const peopleSummary = auditCorePeopleManifest(issues);
  const communitySummary = auditCommunityAssetFiles(issues);

  let dbSummary: Awaited<ReturnType<typeof auditSeededDatabase>> | null = null;
  try {
    dbSummary = await auditSeededDatabase(issues, includeDatabaseAudit);
  } catch (error) {
    issues.push({
      severity: "warning",
      category: "database",
      message: `Database audit skipped: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  const manifestIssues = issues.filter(
    (issue) => !issue.category.startsWith("seeded-"),
  );
  const databaseIssues = issues.filter((issue) =>
    issue.category.startsWith("seeded-"),
  );

  const errors = manifestIssues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  console.log(
    JSON.stringify(
      {
        summary: {
          ...materialSummary,
          ...peopleSummary,
          ...communitySummary,
          database: dbSummary,
          databaseIssueCount: databaseIssues.length,
          errors: errors.length,
          warnings: warnings.length,
        },
        issues: includeDatabaseAudit ? issues : manifestIssues,
      },
      null,
      2,
    ),
  );

  if (errors.length > 0) {
    process.exitCode = 1;
  }
};

try {
  await main();
} finally {
  await prisma.$disconnect();
}
