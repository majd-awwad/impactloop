/**
 * Allowed image URL shapes for prisma/seed.ts and related demo seeding.
 * Accepts absolute https URLs and repository-owned demo-asset paths.
 */
export const isAllowedSeedImageUrl = (imageUrl: string): boolean => {
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith("https://")) return true;
  if (trimmed.startsWith("/demo-assets/community-materials/")) return true;
  if (trimmed.startsWith("/demo-assets/community-projects/")) return true;
  if (trimmed.startsWith("/demo-assets/visual-assets/")) return true;
  return false;
};
