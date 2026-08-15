import {
  demoVisualAssetUrl,
} from "../../../../src/constants/demo-visual-assets.js";

export type DemoPersonVisualAssets = {
  profileImageUrl: string;
  supplierAvatarImageUrl?: string;
  supplierCoverImageUrl?: string;
};

const person = (
  profileRelativePath: string,
  supplier?: { avatarRelativePath: string; coverRelativePath: string },
): DemoPersonVisualAssets => ({
  profileImageUrl: demoVisualAssetUrl(profileRelativePath),
  ...(supplier
    ? {
        supplierAvatarImageUrl: demoVisualAssetUrl(supplier.avatarRelativePath),
        supplierCoverImageUrl: demoVisualAssetUrl(supplier.coverRelativePath),
      }
    : {}),
});

const ISRAA_CORE_PORTRAIT = "people/profiles/israa-core-profile.png";
const MAJD_CORE_PORTRAIT = "people/profiles/profile-majd-core.png";
const IMPACTLOOP_LEARNER_PORTRAIT = "people/profiles/profile-impactloop-learner.png";
const IMPACTLOOP_DRIVER_PORTRAIT = "people/profiles/profile-impactloop-driver.png";
const IMPACTLOOP_ADMIN_PORTRAIT = "people/profiles/profile-impactloop-admin.png";
const NABLUS_BUILD_SURPLUS_LOGO =
  "people/supplier-avatars/profile-nablus-build-surplus.png";
const MAJD_SUPPLIER_COVER = "people/supplier-covers/cover-majd-tech-reuse.png";
const ISRAA_SUPPLIER_COVER = "people/supplier-covers/cover-israa-creative-reuse.png";
const NABLUS_BUILD_SURPLUS_COVER =
  "people/supplier-covers/cover-nablus-build-surplus-depot.png";

/** Core prisma/seed.ts demo accounts — local, stable, demo-ready portraits and covers. */
export const CORE_DEMO_PEOPLE_IMAGES: Readonly<
  Record<string, DemoPersonVisualAssets>
> = {
  "majd@learner.com": person(MAJD_CORE_PORTRAIT),
  "israa@learner.com": person(ISRAA_CORE_PORTRAIT),
  "learner@learner.com": person(IMPACTLOOP_LEARNER_PORTRAIT),

  "majd@supplier.com": person(MAJD_CORE_PORTRAIT, {
    avatarRelativePath: MAJD_CORE_PORTRAIT,
    coverRelativePath: MAJD_SUPPLIER_COVER,
  }),
  "israa@supplier.com": person(ISRAA_CORE_PORTRAIT, {
    avatarRelativePath: ISRAA_CORE_PORTRAIT,
    coverRelativePath: ISRAA_SUPPLIER_COVER,
  }),
  "supplier@supplier.com": person(NABLUS_BUILD_SURPLUS_LOGO, {
    avatarRelativePath: NABLUS_BUILD_SURPLUS_LOGO,
    coverRelativePath: NABLUS_BUILD_SURPLUS_COVER,
  }),

  "majd@driver.com": person(MAJD_CORE_PORTRAIT),
  "israa@driver.com": person(ISRAA_CORE_PORTRAIT),
  "driver@driver.com": person(IMPACTLOOP_DRIVER_PORTRAIT),

  "majd@admin.com": person(MAJD_CORE_PORTRAIT),
  "israa@admin.com": person(ISRAA_CORE_PORTRAIT),
  "admin@admin.com": person(IMPACTLOOP_ADMIN_PORTRAIT),
} as const;

export const CORE_DEMO_PEOPLE_EMAILS = Object.keys(
  CORE_DEMO_PEOPLE_IMAGES,
) as Array<keyof typeof CORE_DEMO_PEOPLE_IMAGES>;

export const communityDemoPersonAvatarRelativePath = (email: string): string => {
  const slug = email.trim().toLowerCase().replace("@", "-at-");
  return `people/avatars/community/${slug}.png`;
};

export const communityDemoOrganizationCoverRelativePath = (
  email: string,
): string => {
  const slug = email.trim().toLowerCase().replace("@", "-at-");
  return `people/supplier-covers/community/${slug}-cover.png`;
};

export const resolveCommunityDemoProfileImageUrl = (email: string): string =>
  demoVisualAssetUrl(communityDemoPersonAvatarRelativePath(email));

export const resolveCommunityDemoSupplierCoverImageUrl = (
  email: string,
): string =>
  demoVisualAssetUrl(communityDemoOrganizationCoverRelativePath(email));

export const resolveCoreDemoPersonVisualAssets = (
  email: string,
): DemoPersonVisualAssets | null => CORE_DEMO_PEOPLE_IMAGES[email] ?? null;

// Re-export for validation scripts that need disk paths.
export { demoVisualAssetDiskPath } from "../../../../src/constants/demo-visual-assets.js";
