import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

import {
  DEMO_VISUAL_ASSETS_DIR,
  demoVisualAssetDiskPath,
} from "../src/constants/demo-visual-assets.js";
import { COMMUNITY_DEMO_PEOPLE } from "../prisma/demo-data/community-demo-people.data.js";
import {
  CORE_DEMO_PEOPLE_IMAGES,
  communityDemoOrganizationCoverRelativePath,
  communityDemoPersonAvatarRelativePath,
} from "../prisma/demo-data/visual-assets/manifests/demo-people-images.data.js";

type AvatarSpec = {
  relativePath: string;
  label: string;
  background: string;
  foreground?: string;
};

const ensureDir = (filePath: string) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

const initialsFromLabel = (label: string): string => {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
};

const renderAvatarSvg = (spec: AvatarSpec): string => {
  const initials = initialsFromLabel(spec.label);
  const fg = spec.foreground ?? "#FFFFFF";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${spec.background}" />
      <stop offset="100%" stop-color="#111827" stop-opacity="0.92" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="256" fill="url(#bg)" />
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle"
    font-family="Segoe UI, Arial, sans-serif" font-size="168" font-weight="700" fill="${fg}">
    ${initials}
  </text>
</svg>`;
};

const renderCoverSvg = (title: string, subtitle: string, accent: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="640" viewBox="0 0 1600 640">
  <defs>
    <linearGradient id="cover" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${accent}" />
      <stop offset="55%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
  </defs>
  <rect width="1600" height="640" fill="url(#cover)" />
  <circle cx="1320" cy="120" r="220" fill="${accent}" fill-opacity="0.18" />
  <circle cx="260" cy="520" r="180" fill="#ffffff" fill-opacity="0.08" />
  <text x="96" y="250" font-family="Segoe UI, Arial, sans-serif" font-size="72" font-weight="700" fill="#ffffff">${title}</text>
  <text x="96" y="330" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#e5e7eb">${subtitle}</text>
</svg>`;

const writePngFromSvg = async (svg: string, diskPath: string) => {
  ensureDir(diskPath);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(diskPath);
};

const CORE_AVATAR_SPECS: AvatarSpec[] = [
  {
    relativePath: "people/avatars/majd-learner.png",
    label: "Majd Learner",
    background: "#2563eb",
  },
  {
    relativePath: "people/avatars/israa-learner.png",
    label: "Israa Learner",
    background: "#db2777",
  },
  {
    relativePath: "people/avatars/impactloop-learner.png",
    label: "ImpactLoop Learner",
    background: "#059669",
  },
  {
    relativePath: "people/avatars/majd-supplier.png",
    label: "Majd Tech",
    background: "#1d4ed8",
  },
  {
    relativePath: "people/avatars/israa-supplier.png",
    label: "Israa Creative",
    background: "#be185d",
  },
  {
    relativePath: "people/avatars/nablus-supplier.png",
    label: "Nablus Build",
    background: "#b45309",
  },
  {
    relativePath: "people/supplier-avatars/majd-tech-reuse.png",
    label: "Majd Tech Reuse",
    background: "#1e40af",
  },
  {
    relativePath: "people/supplier-avatars/israa-creative-reuse.png",
    label: "Israa Creative",
    background: "#9d174d",
  },
  {
    relativePath: "people/supplier-avatars/nablus-build-surplus.png",
    label: "Nablus Surplus",
    background: "#92400e",
  },
  {
    relativePath: "people/avatars/majd-driver.png",
    label: "Majd Driver",
    background: "#0369a1",
  },
  {
    relativePath: "people/avatars/israa-driver.png",
    label: "Israa Driver",
    background: "#7c3aed",
  },
  {
    relativePath: "people/avatars/impactloop-driver.png",
    label: "ImpactLoop Driver",
    background: "#0f766e",
  },
  {
    relativePath: "people/avatars/majd-admin.png",
    label: "Majd Admin",
    background: "#334155",
  },
  {
    relativePath: "people/avatars/israa-admin.png",
    label: "Israa Admin",
    background: "#475569",
  },
  {
    relativePath: "people/avatars/impactloop-admin.png",
    label: "ImpactLoop Admin",
    background: "#1f2937",
  },
];

const CORE_COVER_SPECS = [
  {
    relativePath: "people/supplier-covers/majd-tech-reuse-cover.png",
    title: "Majd Tech Reuse Workshop",
    subtitle: "Electronics reuse • Robotics parts • Lab surplus",
    accent: "#2563eb",
  },
  {
    relativePath: "people/supplier-covers/israa-creative-reuse-cover.png",
    title: "Israa Creative Materials Studio",
    subtitle: "Textiles • Crafts • Packaging reuse",
    accent: "#db2777",
  },
  {
    relativePath: "people/supplier-covers/nablus-build-surplus-cover.png",
    title: "Nablus Build Surplus Depot",
    subtitle: "Wood • Metal • Hardware • Workshop surplus",
    accent: "#d97706",
  },
] as const;

const COMMUNITY_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#059669",
  "#d97706",
  "#0f766e",
  "#1d4ed8",
  "#be185d",
  "#334155",
  "#0891b2",
] as const;

const hashString = (value: string): number => {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
};

const main = async () => {
  fs.mkdirSync(DEMO_VISUAL_ASSETS_DIR, { recursive: true });

  for (const spec of CORE_AVATAR_SPECS) {
    await writePngFromSvg(
      renderAvatarSvg(spec),
      demoVisualAssetDiskPath(spec.relativePath),
    );
  }

  for (const cover of CORE_COVER_SPECS) {
    await writePngFromSvg(
      renderCoverSvg(cover.title, cover.subtitle, cover.accent),
      demoVisualAssetDiskPath(cover.relativePath),
    );
  }

  for (const person of COMMUNITY_DEMO_PEOPLE) {
    const avatarPath = communityDemoPersonAvatarRelativePath(person.email);
    await writePngFromSvg(
      renderAvatarSvg({
        relativePath: avatarPath,
        label: person.displayName,
        background:
          COMMUNITY_PALETTE[hashString(person.email) % COMMUNITY_PALETTE.length],
      }),
      demoVisualAssetDiskPath(avatarPath),
    );

    if (person.supplierKind === "ORGANIZATION") {
      const coverPath = communityDemoOrganizationCoverRelativePath(person.email);
      const orgTitle = person.publicName || person.organizationName || person.displayName;
      await writePngFromSvg(
        renderCoverSvg(
          orgTitle.slice(0, 48),
          `${person.city} • ${person.preferredCategory || "Reuse materials"}`,
          COMMUNITY_PALETTE[
            (hashString(person.email) + 3) % COMMUNITY_PALETTE.length
          ],
        ),
        demoVisualAssetDiskPath(coverPath),
      );
    }
  }

  const corePaths = new Set<string>();
  for (const assets of Object.values(CORE_DEMO_PEOPLE_IMAGES)) {
    corePaths.add(assets.profileImageUrl.replace("/demo-assets/visual-assets/", ""));
    if (assets.supplierAvatarImageUrl) {
      corePaths.add(
        assets.supplierAvatarImageUrl.replace("/demo-assets/visual-assets/", ""),
      );
    }
    if (assets.supplierCoverImageUrl) {
      corePaths.add(
        assets.supplierCoverImageUrl.replace("/demo-assets/visual-assets/", ""),
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        generatedCoreAvatars: CORE_AVATAR_SPECS.length,
        generatedCoreCovers: CORE_COVER_SPECS.length,
        generatedCommunityAvatars: COMMUNITY_DEMO_PEOPLE.length,
        generatedCommunityCovers: COMMUNITY_DEMO_PEOPLE.filter(
          (person) => person.supplierKind === "ORGANIZATION",
        ).length,
        coreManifestPaths: corePaths.size,
      },
      null,
      2,
    ),
  );
};

await main();
