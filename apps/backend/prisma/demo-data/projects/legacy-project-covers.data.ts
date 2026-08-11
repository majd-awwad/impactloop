/**
 * Cover URLs for the original 30 Learning Projects.
 * Runtime source: local repository assets under source-images/covers/legacy/.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  COMMUNITY_DEMO_PROJECTS_SOURCE_IMAGES_DIR,
  communityDemoProjectImageUrl,
} from '../../../src/constants/community-demo-projects.js';

const LEGACY_REL_DIR = 'covers/legacy';
const LEGACY_DISK_DIR = path.join(
  COMMUNITY_DEMO_PROJECTS_SOURCE_IMAGES_DIR,
  'covers',
  'legacy',
);

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

/** Stable keys for the original 30 catalog projects (disk filenames without extension). */
export const LEGACY_PROJECT_COVER_KEYS = [
  'obstacle-avoidance-robot',
  'simple-led-circuit',
  'recycled-desk-organizer',
  'mini-wooden-phone-stand',
  'mini-greenhouse-prototype',
  'fabric-pencil-case',
  'rubber-band-powered-car',
  'line-follower-robot',
  'smart-plant-monitor',
  'automatic-night-light',
  'temperature-humidity-station',
  'servo-distance-scanner',
  'electronic-dice',
  'water-level-alarm',
  'portable-usb-fan',
  'patchwork-tote-bag',
  'bottle-cap-mosaic',
  'glass-jar-herb-planter',
  'cardboard-marble-run',
  'tin-can-lantern',
  'felt-phone-sleeve',
  'yarn-wall-hanging',
  'egg-carton-seed-starter',
  'small-wall-shelf',
  'reclaimed-wood-birdhouse',
  'plywood-laptop-stand',
  'wooden-tool-caddy',
  'pvc-plant-stand',
  'acrylic-display-box',
  'rolling-storage-crate',
] as const;

export type LegacyProjectCoverKey = (typeof LEGACY_PROJECT_COVER_KEYS)[number];

const LEGACY_PROJECT_COVER_KEY_SET = new Set<string>(LEGACY_PROJECT_COVER_KEYS);

export const findLegacyCoverFilename = (key: string): string | null => {
  for (const ext of IMAGE_EXTS) {
    const filename = `${key}${ext}`;
    if (fs.existsSync(path.join(LEGACY_DISK_DIR, filename))) {
      return filename;
    }
  }
  return null;
};

export const resolveLocalLegacyCoverUrl = (key: string): string => {
  const found = findLegacyCoverFilename(key);
  const filename = found ?? `${key}.jpg`;
  return communityDemoProjectImageUrl(`${LEGACY_REL_DIR}/${filename}`);
};

export const legacyCoverDiskPath = (filename: string): string =>
  path.join(LEGACY_DISK_DIR, filename);

export const ensureLegacyCoverDir = () => {
  fs.mkdirSync(LEGACY_DISK_DIR, { recursive: true });
};

/** Runtime cover map used by seed.ts and --sync-covers (resolves disk filenames live). */
export const LEGACY_PROJECT_COVERS: Record<string, string> = new Proxy(
  {} as Record<string, string>,
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (!LEGACY_PROJECT_COVER_KEY_SET.has(prop)) return undefined;
      return resolveLocalLegacyCoverUrl(prop);
    },
    has(_target, prop) {
      return typeof prop === 'string' && LEGACY_PROJECT_COVER_KEY_SET.has(prop);
    },
    ownKeys() {
      return [...LEGACY_PROJECT_COVER_KEYS];
    },
    getOwnPropertyDescriptor(_target, prop) {
      if (typeof prop !== 'string' || !LEGACY_PROJECT_COVER_KEY_SET.has(prop)) {
        return undefined;
      }
      return {
        enumerable: true,
        configurable: true,
        value: resolveLocalLegacyCoverUrl(prop),
      };
    },
  },
);
