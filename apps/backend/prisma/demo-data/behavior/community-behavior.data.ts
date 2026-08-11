/**
 * BEHAVIOR-DATA-01 — deterministic community behavior plan.
 *
 * Strategy
 * --------
 * - Learners: the 35 already-seeded @impactloop.demo LEARNER accounts only.
 * - Randomness: mulberry32 seeded from `cdb1|{email}|{purpose}` (no Math.random).
 * - Timestamps: fixed epoch end 2026-08-11T12:00:00Z, window ~45 days, recent-biased.
 * - Ownership: MaterialView.operationKey + viewSource; unique upserts for likes/saves/follows;
 *   builds keyed by (learnerId, projectId, attemptNumber=1) with item notes `[cdb1]`.
 *
 * Affinity
 * --------
 * Interest keys → preferred material category names + title keywords.
 * Cross-interest exploration is allowed (~15–25% of picks) but must not dominate.
 *
 * Catalog note
 * ------------
 * Community materials (~206) are electronics-heavy. Craft/wood personas also
 * interact with matching CORE catalog materials so Learner Home personalization
 * has signal beyond community electronics inventory.
 */

export const BEHAVIOR_SOURCE = "community-demo-behavior";
export const BEHAVIOR_OP_PREFIX = "cdb1";
export const BEHAVIOR_NOTE_PREFIX = "[cdb1]";

/** Fixed end of the demo activity window (deterministic). */
export const BEHAVIOR_EPOCH_END = new Date("2026-08-11T12:00:00.000Z");
export const BEHAVIOR_WINDOW_DAYS = 45;

export type ActivityTier = "HIGH" | "MEDIUM" | "LIGHT" | "DORMANT";

export type TierQuota = {
  materialViews: [number, number];
  materialLikes: [number, number];
  projectLikes: [number, number];
  projectSaves: [number, number];
  projectFollows: [number, number];
  supplierFollows: [number, number];
  /** Exact planned builds for this tier (assigned via BUILD_PLANS, not random). */
  exploreRatio: number;
};

export const TIER_QUOTAS: Record<ActivityTier, TierQuota> = {
  HIGH: {
    materialViews: [18, 26],
    materialLikes: [5, 8],
    projectLikes: [2, 4],
    projectSaves: [2, 4],
    projectFollows: [1, 2],
    supplierFollows: [1, 2],
    exploreRatio: 0.18,
  },
  MEDIUM: {
    materialViews: [8, 14],
    materialLikes: [2, 4],
    projectLikes: [1, 2],
    projectSaves: [1, 2],
    projectFollows: [0, 1],
    supplierFollows: [0, 1],
    exploreRatio: 0.22,
  },
  LIGHT: {
    materialViews: [3, 6],
    materialLikes: [0, 2],
    projectLikes: [0, 1],
    projectSaves: [0, 1],
    projectFollows: [0, 0],
    supplierFollows: [0, 0],
    exploreRatio: 0.28,
  },
  DORMANT: {
    materialViews: [0, 1],
    materialLikes: [0, 0],
    projectLikes: [0, 0],
    projectSaves: [0, 0],
    projectFollows: [0, 0],
    supplierFollows: [0, 0],
    exploreRatio: 0.5,
  },
};

/**
 * Explicit activity tiers for the 35 community learners.
 * Counts: HIGH 6 / MEDIUM 14 / LIGHT 11 / DORMANT 4
 */
export const LEARNER_ACTIVITY_TIERS: Record<string, ActivityTier> = {
  // HIGH — persona anchors
  "user14@impactloop.demo": "HIGH", // electronics ADVANCED
  "user32@impactloop.demo": "HIGH", // electronics ADVANCED
  "user43@impactloop.demo": "HIGH", // fabric/crafts ADVANCED
  "user23@impactloop.demo": "HIGH", // wood ADVANCED
  "user90@impactloop.demo": "HIGH", // fabric/crafts ADVANCED
  "user86@impactloop.demo": "HIGH", // wood ADVANCED

  // MEDIUM
  "user4@impactloop.demo": "MEDIUM", // wood ADVANCED
  "user19@impactloop.demo": "MEDIUM", // fabric INTERMEDIATE
  "user24@impactloop.demo": "MEDIUM", // wood INTERMEDIATE
  "user26@impactloop.demo": "MEDIUM", // fabric INTERMEDIATE
  "user33@impactloop.demo": "MEDIUM", // wood INTERMEDIATE
  "user46@impactloop.demo": "MEDIUM", // fabric INTERMEDIATE
  "user52@impactloop.demo": "MEDIUM", // education ADVANCED
  "user58@impactloop.demo": "MEDIUM", // recycling ADVANCED
  "user61@impactloop.demo": "MEDIUM", // crafts INTERMEDIATE
  "user71@impactloop.demo": "MEDIUM", // crafts INTERMEDIATE
  "user74@impactloop.demo": "MEDIUM", // education INTERMEDIATE
  "user77@impactloop.demo": "MEDIUM", // crafts ADVANCED
  "user91@impactloop.demo": "MEDIUM", // wood ADVANCED
  "user100@impactloop.demo": "MEDIUM", // wood ADVANCED

  // LIGHT
  "user6@impactloop.demo": "LIGHT",
  "user10@impactloop.demo": "LIGHT",
  "user12@impactloop.demo": "LIGHT",
  "user17@impactloop.demo": "LIGHT",
  "user22@impactloop.demo": "LIGHT",
  "user34@impactloop.demo": "LIGHT",
  "user47@impactloop.demo": "LIGHT",
  "user63@impactloop.demo": "LIGHT",
  "user78@impactloop.demo": "LIGHT",
  "user81@impactloop.demo": "LIGHT",
  "user92@impactloop.demo": "LIGHT",

  // DORMANT
  "user50@impactloop.demo": "DORMANT",
  "user68@impactloop.demo": "DORMANT",
  "user96@impactloop.demo": "DORMANT",
  "user99@impactloop.demo": "DORMANT",
};

export const INTEREST_CATEGORY_AFFINITY: Record<string, string[]> = {
  electronics: [
    "Electronics & Components",
    "Motors & Mechanical Parts",
    "Power & Batteries",
  ],
  circuits: ["Electronics & Components", "Power & Batteries"],
  arduino: [
    "Electronics & Components",
    "Motors & Mechanical Parts",
    "Power & Batteries",
  ],
  woodworking: [
    "Wood & Boards",
    "Tools & Hardware",
    "Metal & Fasteners",
    "Plastics & Acrylic",
  ],
  fabric_textiles: ["Fabric & Textiles", "Art & Craft Supplies"],
  art_crafts: [
    "Art & Craft Supplies",
    "Paper & Cardboard",
    "Packaging & Containers",
    "Other Reusable Materials",
    "Plastics & Acrylic",
  ],
  recycling: [
    "Packaging & Containers",
    "Paper & Cardboard",
    "Other Reusable Materials",
    "Plastics & Acrylic",
  ],
  home_diy: [
    "Wood & Boards",
    "Tools & Hardware",
    "Metal & Fasteners",
    "Plastics & Acrylic",
  ],
  education: [
    "Lab & Education Supplies",
    "Paper & Cardboard",
    "Electronics & Components",
  ],
};

export const INTEREST_TITLE_KEYWORDS: Record<string, string[]> = {
  electronics: [
    "arduino",
    "esp32",
    "esp8266",
    "sensor",
    "led",
    "resistor",
    "pcb",
    "breadboard",
    "jumper",
    "wire",
    "motor",
    "servo",
    "ultrasonic",
    "relay",
    "transistor",
  ],
  circuits: ["resistor", "led", "breadboard", "capacitor", "transistor", "pcb"],
  arduino: ["arduino", "uno", "nano", "esp32", "esp8266", "shield"],
  woodworking: [
    "wood",
    "plywood",
    "mdf",
    "pine",
    "timber",
    "board",
    "screw",
    "hinge",
    "drill",
  ],
  fabric_textiles: [
    "fabric",
    "felt",
    "denim",
    "textile",
    "cloth",
    "yarn",
    "cotton",
    "sewing",
  ],
  art_crafts: [
    "paint",
    "felt",
    "cardboard",
    "glue",
    "mold",
    "craft",
    "wax",
    "foam",
    "acrylic paint",
  ],
  recycling: [
    "bottle",
    "cap",
    "cardboard",
    "jar",
    "recycle",
    "plastic",
    "container",
    "tin",
  ],
  home_diy: [
    "screw",
    "hinge",
    "pipe",
    "pvc",
    "acrylic",
    "bracket",
    "tool",
    "shelf",
  ],
  education: ["lab", "beaker", "pipette", "sample", "kit", "sensor", "trainer"],
};

export const INTEREST_PROJECT_CATEGORIES: Record<string, string[]> = {
  electronics: ["Electronics", "Robotics"],
  circuits: ["Electronics"],
  arduino: ["Electronics", "Robotics"],
  woodworking: ["Woodworking", "Home Experiments"],
  fabric_textiles: ["Textile Crafts"],
  art_crafts: ["Recycling Crafts", "Textile Crafts", "Art & Crafts"],
  recycling: ["Recycling Crafts", "Sustainability", "Home Experiments"],
  home_diy: ["Home Experiments", "Woodworking", "Home DIY"],
  education: ["Electronics", "Home Experiments", "Robotics"],
};

/** PROJECT-DATA-03 keys preferred by interest groups. */
export const INTEREST_PD03_KEYS: Record<string, string[]> = {
  electronics: [
    "najah-map-go-ros-lidar-robot",
    "najah-packsort-smart-package-sorter",
    "najah-wireless-braille-printer",
    "najah-bottle-separator-robot",
  ],
  circuits: [
    "najah-packsort-smart-package-sorter",
    "najah-wireless-braille-printer",
  ],
  arduino: [
    "najah-packsort-smart-package-sorter",
    "najah-wireless-braille-printer",
    "najah-map-go-ros-lidar-robot",
  ],
  woodworking: ["najah-henna-cnc-pattern-machine", "najah-rootrise-cnc-plant-care"],
  fabric_textiles: ["najah-henna-cnc-pattern-machine"],
  art_crafts: [
    "najah-henna-cnc-pattern-machine",
    "najah-bottle-separator-robot",
  ],
  recycling: [
    "najah-bottle-separator-robot",
    "najah-henna-cnc-pattern-machine",
  ],
  home_diy: [
    "najah-rootrise-cnc-plant-care",
    "najah-henna-cnc-pattern-machine",
  ],
  education: [
    "najah-automated-liquid-sample-trainer",
    "najah-rootrise-cnc-plant-care",
    "najah-wireless-braille-printer",
  ],
};

export type BuildItemPlan = {
  /** Substring match against componentName (case-insensitive). */
  componentIncludes?: string;
  status: "MISSING" | "ALREADY_OWNED" | "AVAILABLE";
  /** Prefer community identity tag, else match material title/type substring. */
  materialSeedKey?: string;
  materialTitleIncludes?: string;
};

export type BuildPlan = {
  learnerEmail: string;
  projectKey: string;
  status: "IN_PROGRESS" | "COMPLETED";
  /** Days before BEHAVIOR_EPOCH_END when the build started. */
  startedDaysAgo: number;
  completedDaysAgo?: number;
  items: BuildItemPlan[];
  note: string;
};

/**
 * Limited representative builds (not every active learner).
 * Domain-valid: no fake COMPLETED reservations; AVAILABLE links use live materials;
 * ALREADY_OWNED needs no reservation; COMPLETED only for a simple beginner craft.
 */
export const BUILD_PLANS: BuildPlan[] = [
  {
    learnerEmail: "user14@impactloop.demo",
    projectKey: "obstacle-avoidance-robot",
    status: "IN_PROGRESS",
    startedDaysAgo: 12,
    note: "Electronics advanced — partial prep with owned + selected parts",
    items: [
      {
        componentIncludes: "arduino",
        status: "AVAILABLE",
        materialTitleIncludes: "arduino",
      },
      {
        componentIncludes: "ultrasonic",
        status: "AVAILABLE",
        materialTitleIncludes: "ultrasonic",
      },
      {
        componentIncludes: "motor",
        status: "ALREADY_OWNED",
      },
      {
        componentIncludes: "jumper",
        status: "ALREADY_OWNED",
      },
    ],
  },
  {
    learnerEmail: "user32@impactloop.demo",
    projectKey: "line-follower-robot",
    status: "IN_PROGRESS",
    startedDaysAgo: 4,
    note: "Electronics advanced — newly started, mostly missing",
    items: [
      {
        componentIncludes: "arduino",
        status: "AVAILABLE",
        materialTitleIncludes: "arduino",
      },
    ],
  },
  {
    learnerEmail: "user43@impactloop.demo",
    projectKey: "fabric-pencil-case",
    status: "IN_PROGRESS",
    startedDaysAgo: 18,
    note: "Craft advanced — fabric selected + felt already owned",
    items: [
      {
        componentIncludes: "fabric",
        status: "AVAILABLE",
        materialTitleIncludes: "fabric",
      },
      {
        componentIncludes: "felt",
        status: "ALREADY_OWNED",
      },
      {
        componentIncludes: "thread",
        status: "MISSING",
      },
    ],
  },
  {
    learnerEmail: "user23@impactloop.demo",
    projectKey: "plywood-laptop-stand",
    status: "IN_PROGRESS",
    startedDaysAgo: 9,
    note: "Wood advanced — plywood selected, fasteners owned",
    items: [
      {
        componentIncludes: "plywood",
        status: "AVAILABLE",
        materialTitleIncludes: "plywood",
      },
      {
        componentIncludes: "screw",
        status: "ALREADY_OWNED",
      },
    ],
  },
  {
    learnerEmail: "user90@impactloop.demo",
    projectKey: "najah-henna-cnc-pattern-machine",
    status: "IN_PROGRESS",
    startedDaysAgo: 6,
    note: "Craft advanced — exploring Henna CNC, mostly missing",
    items: [],
  },
  {
    learnerEmail: "user86@impactloop.demo",
    projectKey: "mini-wooden-phone-stand",
    status: "IN_PROGRESS",
    startedDaysAgo: 21,
    note: "Wood advanced — wood selected + hardware already owned",
    items: [
      {
        componentIncludes: "wood",
        status: "AVAILABLE",
        materialTitleIncludes: "pine",
      },
      {
        componentIncludes: "screw",
        status: "ALREADY_OWNED",
      },
      {
        componentIncludes: "sand",
        status: "ALREADY_OWNED",
      },
    ],
  },
  {
    learnerEmail: "user58@impactloop.demo",
    projectKey: "najah-bottle-separator-robot",
    status: "IN_PROGRESS",
    startedDaysAgo: 3,
    note: "Recycling advanced — started Bottle Separator, checklist mostly missing",
    items: [],
  },
  {
    learnerEmail: "user52@impactloop.demo",
    projectKey: "najah-automated-liquid-sample-trainer",
    status: "IN_PROGRESS",
    startedDaysAgo: 8,
    note: "Education advanced — sample trainer with one selected component",
    items: [
      {
        componentIncludes: "arduino",
        status: "AVAILABLE",
        materialTitleIncludes: "arduino",
      },
    ],
  },
  {
    learnerEmail: "user19@impactloop.demo",
    projectKey: "bottle-cap-mosaic",
    status: "COMPLETED",
    startedDaysAgo: 28,
    completedDaysAgo: 14,
    note: "Craft intermediate — completed beginner recycling craft",
    items: [
      {
        componentIncludes: "bottle",
        status: "ALREADY_OWNED",
      },
      {
        componentIncludes: "glue",
        status: "ALREADY_OWNED",
      },
      {
        componentIncludes: "board",
        status: "ALREADY_OWNED",
      },
    ],
  },
  {
    learnerEmail: "user26@impactloop.demo",
    projectKey: "patchwork-tote-bag",
    status: "IN_PROGRESS",
    startedDaysAgo: 11,
    note: "Fabric intermediate — partial prep",
    items: [
      {
        componentIncludes: "fabric",
        status: "AVAILABLE",
        materialTitleIncludes: "fabric",
      },
      {
        componentIncludes: "denim",
        status: "ALREADY_OWNED",
      },
    ],
  },
];

/** Prefer these published core projects for non-electronics personas. */
export const CORE_PROJECT_KEYS_BY_PERSONA: Record<string, string[]> = {
  electronics: [
    "obstacle-avoidance-robot",
    "line-follower-robot",
    "automatic-night-light",
    "electronic-dice",
    "simple-led-circuit",
  ],
  woodworking: [
    "mini-wooden-phone-stand",
    "plywood-laptop-stand",
    "reclaimed-wood-birdhouse",
    "rolling-storage-crate",
  ],
  fabric_textiles: [
    "fabric-pencil-case",
    "felt-phone-sleeve",
    "patchwork-tote-bag",
    "yarn-wall-hanging",
  ],
  art_crafts: [
    "bottle-cap-mosaic",
    "cardboard-marble-run",
    "tin-can-lantern",
    "recycled-desk-organizer",
  ],
  recycling: [
    "bottle-cap-mosaic",
    "recycled-desk-organizer",
    "tin-can-lantern",
    "cardboard-marble-run",
    "egg-carton-seed-starter",
  ],
  home_diy: [
    "mini-greenhouse-prototype",
    "pvc-plant-stand",
    "rolling-storage-crate",
    "acrylic-display-box",
    "portable-usb-fan",
  ],
  education: [
    "egg-carton-seed-starter",
    "glass-jar-herb-planter",
    "automatic-night-light",
    "simple-led-circuit",
  ],
};

export const fnv1a = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  bool(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T | undefined {
    if (items.length === 0) return undefined;
    return items[this.int(0, items.length - 1)];
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      const tmp = copy[i]!;
      copy[i] = copy[j]!;
      copy[j] = tmp;
    }
    return copy;
  }

  /** Weighted sample without replacement. */
  sampleWeighted<T>(
    items: readonly T[],
    count: number,
    weightOf: (item: T) => number,
  ): T[] {
    if (count <= 0 || items.length === 0) return [];
    const pool = items.map((item) => ({
      item,
      weight: Math.max(0.0001, weightOf(item)),
    }));
    const selected: T[] = [];
    const n = Math.min(count, pool.length);
    for (let i = 0; i < n; i += 1) {
      const total = pool.reduce((sum, row) => sum + row.weight, 0);
      let r = this.next() * total;
      let idx = 0;
      for (; idx < pool.length; idx += 1) {
        r -= pool[idx]!.weight;
        if (r <= 0) break;
      }
      const chosen = pool.splice(Math.min(idx, pool.length - 1), 1)[0];
      if (!chosen) break;
      selected.push(chosen.item);
    }
    return selected;
  }
};

export const makeRng = (email: string, purpose: string): SeededRng =>
  new SeededRng(fnv1a(`${BEHAVIOR_OP_PREFIX}|${email}|${purpose}`));

export const viewOperationKey = (
  email: string,
  materialKey: string,
  index: number,
): string => `${BEHAVIOR_OP_PREFIX}:${email}:${materialKey}:v${index}`;

/** Recent-biased day offset within the window (0 = epoch end day). */
export const recentBiasedDaysAgo = (rng: SeededRng, maxDays: number): number => {
  const u = rng.next();
  // Square bias toward recent (smaller daysAgo).
  return Math.floor(u * u * maxDays);
};

export const timestampDaysAgo = (
  daysAgo: number,
  hour: number,
  minute = 0,
): Date => {
  const d = new Date(BEHAVIOR_EPOCH_END);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, minute, rngMinute(daysAgo, hour), 0);
  return d;
};

const rngMinute = (daysAgo: number, hour: number): number =>
  fnv1a(`${BEHAVIOR_OP_PREFIX}|ts|${daysAgo}|${hour}`) % 60;

export const materialPopularityWeight = (seedKey: string): number => {
  // Long-tail: most 1–2, some 3–5, a few 6–8.
  const bucket = fnv1a(`${BEHAVIOR_OP_PREFIX}|pop|${seedKey}`) % 100;
  if (bucket < 55) return 1;
  if (bucket < 80) return 2;
  if (bucket < 92) return 4;
  if (bucket < 98) return 6;
  return 8;
};
