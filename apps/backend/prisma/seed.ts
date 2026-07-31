import { Prisma } from "../src/generated/prisma/client.js";
import { prisma } from "../src/database/prisma.js";
import { seedTaxonomyCompatibilityRelations } from "../src/modules/taxonomy/taxonomy-compatibility-relations.seed.js";
import { seedTaxonomyFoundation } from "../src/modules/taxonomy/taxonomy-foundation.repository.js";
import { hashPassword } from "../src/utils/password.js";
import { normalizeSearchText } from "../src/utils/normalize-search-text.js";

const SEED_PASSWORD = "password";
const CURRENCY = "NIS";
const SEED_MARKER = "[realistic-impactloop-seed]";

const now = () => new Date();

const dateAt = (offsetDays: number, hour: number, minute = 0): Date => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const assertImage = (label: string, imageUrl: string | null | undefined) => {
  if (!imageUrl || imageUrl.trim().length === 0) {
    throw new Error(`Missing imageUrl for ${label}`);
  }

  if (!imageUrl.startsWith("https://")) {
    throw new Error(`Image URL for ${label} must start with https://`);
  }
};

const jsonArray = (value: string[] | undefined): Prisma.InputJsonValue =>
  value == null ? Prisma.JsonNull : value;

const shouldBlockReset = (): boolean => {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase() ?? "";

  return (
    nodeEnv === "production" ||
    databaseUrl.includes("prod") ||
    databaseUrl.includes("production")
  );
};

const resetDatabase = async () => {
  if (shouldBlockReset()) {
    throw new Error(
      "Refusing to reset database because NODE_ENV/DATABASE_URL looks like production.",
    );
  }

  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN ('_prisma_migrations', 'spatial_ref_sys')
  `;

  if (tables.length === 0) {
    return;
  }

  const quotedTableNames = tables
    .map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`)
    .join(", ");

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quotedTableNames} RESTART IDENTITY CASCADE;`,
  );
};

const MATERIAL_CATEGORIES = [
  {
    key: "electronics-components",
    nameEn: "Electronics & Components",
    nameAr: "إلكترونيات وقطع إلكترونية",
  },
  {
    key: "motors-mechanical",
    nameEn: "Motors & Mechanical Parts",
    nameAr: "محركات وقطع ميكانيكية",
  },
  {
    key: "power-batteries",
    nameEn: "Power & Batteries",
    nameAr: "طاقة وبطاريات",
  },
  { key: "wood-boards", nameEn: "Wood & Boards", nameAr: "خشب وألواح" },
  {
    key: "plastics-acrylic",
    nameEn: "Plastics & Acrylic",
    nameAr: "بلاستيك وأكريليك",
  },
  {
    key: "metal-fasteners",
    nameEn: "Metal & Fasteners",
    nameAr: "معادن ومثبتات",
  },
  {
    key: "fabric-textiles",
    nameEn: "Fabric & Textiles",
    nameAr: "أقمشة ومنسوجات",
  },
  { key: "paper-cardboard", nameEn: "Paper & Cardboard", nameAr: "ورق وكرتون" },
  { key: "tools-hardware", nameEn: "Tools & Hardware", nameAr: "أدوات وعدد" },
  {
    key: "art-craft-supplies",
    nameEn: "Art & Craft Supplies",
    nameAr: "مستلزمات فن وحرف",
  },
  {
    key: "packaging-containers",
    nameEn: "Packaging & Containers",
    nameAr: "تغليف وحاويات",
  },
  {
    key: "lab-education",
    nameEn: "Lab & Education Supplies",
    nameAr: "مستلزمات مختبر وتعليم",
  },
  {
    key: "other-reusable",
    nameEn: "Other Reusable Materials",
    nameAr: "مواد أخرى قابلة لإعادة الاستخدام",
  },
] as const;

const PROJECT_CATEGORIES = [
  { key: "robotics", nameEn: "Robotics", nameAr: "روبوتات" },
  { key: "electronics-learning", nameEn: "Electronics", nameAr: "إلكترونيات" },
  {
    key: "recycling-crafts",
    nameEn: "Recycling Crafts",
    nameAr: "حرف إعادة التدوير",
  },
  { key: "woodworking", nameEn: "Woodworking", nameAr: "أعمال خشبية" },
  {
    key: "home-experiments",
    nameEn: "Home Experiments",
    nameAr: "تجارب منزلية",
  },
  { key: "textile-crafts", nameEn: "Textile Crafts", nameAr: "حرف نسيجية" },
] as const;

const IMAGES = {
  arduino:
    "https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=1200&q=80",
  electronics:
    "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80",
  components:
    "https://images.unsplash.com/photo-1581092335397-9583eb92d232?auto=format&fit=crop&w=1200&q=80",
  breadboard:
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80",
  motors:
    "https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=1200&q=80",
  workshop:
    "https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80",
  cables:
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80",
  wood: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80",
  woodPanels:
    "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
  acrylic:
    "https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=80",
  cardboard:
    "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1200&q=80",
  fabric:
    "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=80",
  textile:
    "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80",
  craft:
    "https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=80",
  paint:
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80",
  jars: "https://images.unsplash.com/photo-1604187351574-c75ca79f5807?auto=format&fit=crop&w=1200&q=80",
  metal:
    "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80",
  tools:
    "https://images.unsplash.com/photo-1581147036324-c1c89c2c8b5c?auto=format&fit=crop&w=1200&q=80",
  pipes:
    "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80",
  robotProject:
    "https://images.unsplash.com/photo-1561144257-e32e8efc6c4f?auto=format&fit=crop&w=1200&q=80",
  greenhouse:
    "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80",
  sewing:
    "https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=1200&q=80",
} as const;

type SupplierSeed = {
  email: string;
  displayName: string;
  publicName: string;
  supplierType: string;
  organizationType: "WORKSHOP" | "FACTORY" | "EDUCATIONAL_INSTITUTION";
  city: string;
  area: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  description: string;
};

const SUPPLIERS: SupplierSeed[] = [
  {
    email: "majd@supplier.com",
    displayName: "Majd Tech Reuse",
    publicName: "Majd Tech Reuse Workshop",
    supplierType: "WORKSHOP",
    organizationType: "WORKSHOP",
    city: "Hebron",
    area: "University District",
    addressLine: "Near Hebron University main gate",
    latitude: 31.5326,
    longitude: 35.0998,
    description:
      "Small electronics and robotics reuse workshop offering tested components for student projects.",
  },
  {
    email: "israa@supplier.com",
    displayName: "Israa Creative Reuse",
    publicName: "Israa Creative Materials Studio",
    supplierType: "INDIVIDUAL_SUPPLIER",
    organizationType: "WORKSHOP",
    city: "Ramallah",
    area: "Al-Tireh",
    addressLine: "Al-Tireh creative studio area",
    latitude: 31.9038,
    longitude: 35.2034,
    description:
      "Creative reuse studio sharing textile, craft, packaging, and recycled materials for makers.",
  },
  {
    email: "supplier@supplier.com",
    displayName: "Nablus Build Surplus",
    publicName: "Nablus Build Surplus Depot",
    supplierType: "FACTORY",
    organizationType: "FACTORY",
    city: "Nablus",
    area: "Industrial Area",
    addressLine: "Nablus industrial surplus pickup point",
    latitude: 32.2211,
    longitude: 35.2544,
    description:
      "Workshop and factory surplus depot with reusable wood, plastic, metal, hardware, and build parts.",
  },
];

const LEARNERS = [
  {
    email: "majd@learner.com",
    displayName: "Majd Learner",
    city: "Hebron",
    area: "University District",
    interests: ["arduino", "robotics", "sensors", "circuits"],
    skillLevel: "INTERMEDIATE",
  },
  {
    email: "israa@learner.com",
    displayName: "Israa Learner",
    city: "Ramallah",
    area: "Al-Tireh",
    interests: ["art_crafts", "fabric_textiles", "recycling"],
    skillLevel: "BEGINNER",
  },
  {
    email: "learner@learner.com",
    displayName: "ImpactLoop Learner",
    city: "Nablus",
    area: "Rafidia",
    interests: ["woodworking", "home_diy", "recycling"],
    skillLevel: "BEGINNER",
  },
] as const;

/** Reservation workflow copies — primary listing keys stay AVAILABLE for recommendations. */
const WORKFLOW_MATERIAL_COPIES = [
  {
    key: "wf-majd-arduino-uno-r3",
    sourceKey: "majd-arduino-uno-r3",
    titleSuffix: "(Spare Batch)",
  },
  {
    key: "wf-majd-dc-gear-motors",
    sourceKey: "majd-dc-gear-motors",
    titleSuffix: "(Spare Batch)",
  },
  {
    key: "wf-majd-breadboard-kit",
    sourceKey: "majd-breadboard-kit",
    titleSuffix: "(Spare Batch)",
  },
  {
    key: "wf-israa-fabric-scraps",
    sourceKey: "israa-fabric-scraps",
    titleSuffix: "(Spare Batch)",
  },
  {
    key: "wf-israa-cardboard-sheets",
    sourceKey: "israa-cardboard-sheets",
    titleSuffix: "(Spare Batch)",
  },
  {
    key: "wf-israa-acrylic-paint",
    sourceKey: "israa-acrylic-paint",
    titleSuffix: "(Spare Batch)",
  },
  {
    key: "wf-supplier-plywood-panels",
    sourceKey: "supplier-plywood-panels",
    titleSuffix: "(Spare Batch)",
  },
  {
    key: "wf-supplier-acrylic-sheets",
    sourceKey: "supplier-acrylic-sheets",
    titleSuffix: "(Spare Batch)",
  },
  {
    key: "wf-supplier-pvc-pipes",
    sourceKey: "supplier-pvc-pipes",
    titleSuffix: "(Spare Batch)",
  },
] as const;

const LEARNER_ENGAGEMENT = [
  {
    email: "majd@learner.com",
    likes: [
      "majd-arduino-uno-r3",
      "majd-ultrasonic-hcsr04",
      "majd-jumper-wires",
      "majd-dc-gear-motors",
      "majd-servo-sg90",
      "majd-breadboard-kit",
    ],
    views: [
      "majd-resistor-box",
      "majd-led-pack",
      "majd-battery-holders",
      "majd-laptop-cooling-fans",
    ],
    follows: ["obstacle-avoidance-robot", "simple-led-circuit"],
  },
  {
    email: "israa@learner.com",
    likes: [
      "israa-fabric-scraps",
      "israa-cardboard-sheets",
      "israa-felt-sheets",
      "israa-wax-molds",
      "israa-acrylic-paint",
      "israa-bottle-caps",
      "israa-glass-jars",
    ],
    views: [
      "israa-denim-offcuts",
      "israa-cardboard-tubes",
      "israa-wooden-sticks",
      "israa-foam-board",
    ],
    follows: ["fabric-pencil-case", "recycled-desk-organizer"],
  },
  {
    email: "learner@learner.com",
    likes: [
      "supplier-plywood-panels",
      "supplier-mdf-offcuts",
      "supplier-pine-strips",
      "supplier-acrylic-sheets",
      "supplier-pvc-pipes",
      "supplier-screws-nuts",
      "supplier-hinges-set",
      "supplier-drill-bits",
    ],
    views: ["supplier-aluminum-angles", "supplier-rubber-wheels"],
    follows: ["mini-wooden-phone-stand", "mini-greenhouse-prototype"],
  },
] as const;

const DRIVERS = [
  {
    email: "majd@driver.com",
    displayName: "Majd Driver",
    phone: "+970599000101",
    city: "Hebron",
    area: "University District",
    transportationType: "CAR" as const,
    vehicleType: "CAR",
    vehicleLabel: "White compact car",
    vehiclePlate: "IL-DRV-101",
  },
  {
    email: "israa@driver.com",
    displayName: "Israa Driver",
    phone: "+970599000102",
    city: "Ramallah",
    area: "Al-Tireh",
    transportationType: "MOTORCYCLE" as const,
    vehicleType: "MOTORCYCLE",
    vehicleLabel: "Green delivery motorcycle",
    vehiclePlate: "IL-DRV-102",
  },
  {
    email: "driver@driver.com",
    displayName: "ImpactLoop Driver",
    phone: "+970599000103",
    city: "Nablus",
    area: "Rafidia",
    transportationType: "CAR" as const,
    vehicleType: "CAR",
    vehicleLabel: "Silver hatchback",
    vehiclePlate: "IL-DRV-103",
  },
] as const;

const ADMINS = [
  { email: "majd@admin.com", displayName: "Majd Admin" },
  { email: "israa@admin.com", displayName: "Israa Admin" },
  { email: "admin@admin.com", displayName: "ImpactLoop Admin" },
] as const;

const EXTRA_USER_FIRST_NAMES = [
  "Ahmad",
  "Mohammad",
  "Omar",
  "Yousef",
  "Khaled",
  "Laith",
  "Zaid",
  "Hamza",
  "Tariq",
  "Samer",
  "Rami",
  "Anas",
  "Lina",
  "Sara",
  "Noor",
  "Dana",
  "Hala",
  "Aya",
  "Rana",
  "Maya",
  "Salma",
  "Dina",
  "Reem",
  "Nour",
] as const;

const EXTRA_USER_LAST_NAMES = [
  "Khalil",
  "Nasser",
  "Saleh",
  "Haddad",
  "Qasem",
  "Darwish",
  "Mansour",
  "Barakat",
  "Awad",
  "Hamdan",
  "Jaber",
  "Shami",
] as const;

const EXTRA_INTEREST_SETS = [
  ["arduino", "robotics"],
  ["sensors", "circuits"],
  ["art_crafts", "recycling"],
  ["fabric_textiles", "art_crafts"],
  ["woodworking", "home_diy"],
  ["recycling", "home_diy"],
] as const;

const EXTRA_LEARNERS = EXTRA_USER_FIRST_NAMES.flatMap((firstName, firstIndex) =>
  EXTRA_USER_LAST_NAMES.map((lastName, lastIndex) => {
    const displayName = `${firstName} ${lastName}`;
    const email =
      `${firstName}.${lastName}@community.impactloop.test`.toLowerCase();
    const interestSet =
      EXTRA_INTEREST_SETS[
        (firstIndex + lastIndex) % EXTRA_INTEREST_SETS.length
      ];

    return {
      displayName,
      email,
      interests: [...interestSet],
      skillLevel: ["BEGINNER", "INTERMEDIATE", "ADVANCED"][
        (firstIndex + lastIndex) % 3
      ],
    };
  }),
);

type MaterialSeed = {
  key: string;
  supplierEmail: string;
  title: string;
  description: string;
  categoryKey: (typeof MATERIAL_CATEGORIES)[number]["key"];
  materialType: string;
  aliases?: string[];
  quantity: number;
  unit: string;
  condition: "NEW" | "LIKE_NEW" | "GOOD" | "USED" | "NEEDS_REPAIR";
  sourceType:
    | "STUDENT_LEFTOVER"
    | "WORKSHOP_SURPLUS"
    | "FACTORY_SURPLUS"
    | "EDUCATIONAL_INSTITUTION";
  isFree: boolean;
  price: number | null;
  maxAllowedUnitPriceNis?: number;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
  imageUrls: string[];
  tags: string[];
  suggestedUses: string;
  viewsCount: number;
};

const CORE_MATERIALS: MaterialSeed[] = [
  {
    key: "majd-arduino-uno-r3",
    supplierEmail: "majd@supplier.com",
    title: "Arduino Uno R3 Boards",
    description:
      "Tested Arduino Uno R3 boards from a university lab cabinet. Good for robotics, sensors, and basic control projects.",
    categoryKey: "electronics-components",
    materialType: "Arduino Uno",
    aliases: ["Arduino", "Microcontroller board", "Arduino Uno R3"],
    quantity: 8,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 45,
    maxAllowedUnitPriceNis: 70,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.arduino, IMAGES.electronics],
    tags: ["arduino", "microcontroller", "robotics"],
    suggestedUses:
      "Robot cars, LED circuits, sensor prototypes, classroom labs.",
    viewsCount: 64,
  },
  {
    key: "majd-ultrasonic-hcsr04",
    supplierEmail: "majd@supplier.com",
    title: "HC-SR04 Ultrasonic Sensors",
    description:
      "Distance sensors sorted and labeled after robotics workshops. Each sensor was checked with a simple Arduino test.",
    categoryKey: "electronics-components",
    materialType: "Ultrasonic Sensor",
    aliases: ["HC-SR04", "Distance sensor"],
    quantity: 12,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.workshop],
    tags: ["sensor", "ultrasonic", "distance"],
    suggestedUses:
      "Obstacle avoidance robots, distance measuring demos, smart bins.",
    viewsCount: 42,
  },
  {
    key: "majd-breadboard-kit",
    supplierEmail: "majd@supplier.com",
    title: "Half-Size Breadboard Kits",
    description:
      "Clean reusable breadboards with adhesive backs removed. Suitable for quick electronics experiments.",
    categoryKey: "electronics-components",
    materialType: "Breadboard",
    aliases: ["Prototype board", "Prototyping board"],
    quantity: 15,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.breadboard],
    tags: ["breadboard", "prototype", "electronics"],
    suggestedUses: "LED circuits, sensor wiring, quick lab prototypes.",
    viewsCount: 39,
  },
  {
    key: "majd-jumper-wires",
    supplierEmail: "majd@supplier.com",
    title: "Assorted Jumper Wires Bundle",
    description:
      "Male-to-male, male-to-female, and female-to-female jumper wires grouped into reusable packs.",
    categoryKey: "electronics-components",
    materialType: "Jumper Wires",
    aliases: ["Dupont wires", "Wire pack"],
    quantity: 20,
    unit: "packs",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 10,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cables, IMAGES.electronics],
    tags: ["jumper wires", "dupont", "wiring"],
    suggestedUses: "Breadboard circuits, Arduino labs, sensor wiring.",
    viewsCount: 55,
  },
  {
    key: "majd-resistor-box",
    supplierEmail: "majd@supplier.com",
    title: "Resistor Assortment Boxes",
    description:
      "Labeled resistor boxes with common values used in beginner electronics courses.",
    categoryKey: "electronics-components",
    materialType: "Resistor Pack",
    aliases: ["Resistors", "Passive components"],
    quantity: 7,
    unit: "boxes",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["resistors", "components", "circuit"],
    suggestedUses:
      "LED protection, voltage dividers, electronics training kits.",
    viewsCount: 31,
  },
  {
    key: "majd-led-pack",
    supplierEmail: "majd@supplier.com",
    title: "Mixed Color LED Packs",
    description:
      "Reusable LED packs in red, green, blue, yellow, and white for classroom experiments.",
    categoryKey: "electronics-components",
    materialType: "LED Pack",
    aliases: ["LEDs", "Light emitting diodes"],
    quantity: 12,
    unit: "packs",
    condition: "NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components, IMAGES.electronics],
    tags: ["led", "light", "circuit"],
    suggestedUses:
      "LED circuits, indicators, model lighting, art installations.",
    viewsCount: 48,
  },
  {
    key: "majd-dc-gear-motors",
    supplierEmail: "majd@supplier.com",
    title: "Small DC Gear Motors Pair",
    description:
      "Small DC gear motors removed from retired robotics kits and tested with a battery pack.",
    categoryKey: "motors-mechanical",
    materialType: "DC Motor",
    aliases: ["DC gear motor", "Robot motor"],
    quantity: 10,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 16,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ["dc motor", "robotics", "motion"],
    suggestedUses: "Robot cars, small fans, motion prototypes.",
    viewsCount: 73,
  },
  {
    key: 'majd-arduino-student-salvage',
    supplierEmail: 'majd@supplier.com',
    title: 'Salvaged Arduino Uno Boards',
    description:
      'Working Arduino Uno boards recovered from a classroom cabinet refresh. Tested for USB power and blink sketches.',
    categoryKey: 'electronics-components',
    materialType: 'Arduino Uno',
    aliases: ['Arduino Uno', 'Microcontroller board', 'Student Arduino'],
    quantity: 6,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 32,
    maxAllowedUnitPriceNis: 70,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.arduino, IMAGES.electronics],
    tags: ['arduino', 'microcontroller', 'salvage'],
    suggestedUses: 'Obstacle avoidance robots, sensor labs, beginner control projects.',
    viewsCount: 28,
  },
  {
    key: 'majd-ultrasonic-lab-surplus',
    supplierEmail: 'majd@supplier.com',
    title: 'Lab Surplus HC-SR04 Sensors',
    description:
      'Lightly used HC-SR04 ultrasonic sensors sorted after a robotics lab cleanup. Each unit passed a quick trigger test.',
    categoryKey: 'electronics-components',
    materialType: 'Ultrasonic Sensor',
    aliases: ['HC-SR04', 'Distance sensor', 'Ultrasonic distance sensor'],
    quantity: 9,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.workshop],
    tags: ['sensor', 'ultrasonic', 'distance'],
    suggestedUses: 'Obstacle avoidance robots, distance demos, smart bins.',
    viewsCount: 19,
  },
  {
    key: 'majd-ultrasonic-free-lab',
    supplierEmail: 'majd@supplier.com',
    title: 'Free Workshop Ultrasonic Sensors',
    description:
      'Surplus HC-SR04 sensors offered free to learners after a university workshop. Cosmetic wear only.',
    categoryKey: 'electronics-components',
    materialType: 'Ultrasonic Sensor',
    aliases: ['HC-SR04', 'Ultrasonic sensor', 'Distance sensor'],
    quantity: 5,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.workshop],
    tags: ['sensor', 'ultrasonic', 'free'],
    suggestedUses: 'Obstacle avoidance robots, classroom demos.',
    viewsCount: 11,
  },
  {
    key: 'majd-jumper-wires-free-pieces',
    supplierEmail: 'majd@supplier.com',
    title: 'Community Jumper Wire Pieces',
    description:
      'Individual jumper wire pieces donated for beginner robotics builds. Enough loose wires for Arduino and sensor wiring across a full obstacle-avoidance robot.',
    categoryKey: 'electronics-components',
    materialType: 'Jumper Wires',
    aliases: ['Dupont wires', 'Jumper wires', 'Wire pieces'],
    quantity: 24,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.cables, IMAGES.electronics],
    tags: ['jumper wires', 'dupont', 'free'],
    suggestedUses: 'Arduino labs, sensor wiring, robot prototypes.',
    viewsCount: 17,
  },
  {
    key: 'majd-dc-motors-surplus',
    supplierEmail: 'majd@supplier.com',
    title: 'Surplus DC Gear Motors',
    description:
      'Small DC gear motors removed from retired classroom kits. Tested for smooth rotation before listing.',
    categoryKey: 'motors-mechanical',
    materialType: 'DC Motor',
    aliases: ['DC gear motor', 'Robot motor', 'Gear motor'],
    quantity: 14,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ['dc motor', 'robotics', 'surplus'],
    suggestedUses: 'Robot cars, obstacle avoidance builds, motion prototypes.',
    viewsCount: 36,
  },
  {
    key: 'majd-servo-sg90',
    supplierEmail: 'majd@supplier.com',
    title: 'SG90 Micro Servo Motors',
    description:
      "Micro servo motors from student kits. Good for simple arms, gates, and angle-control prototypes.",
    categoryKey: "motors-mechanical",
    materialType: "Servo Motor",
    aliases: ["SG90 servo", "Micro servo"],
    quantity: 9,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 20,
    maxAllowedUnitPriceNis: 35,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.motors, IMAGES.components],
    tags: ["servo", "actuator", "robotics"],
    suggestedUses: "Robotic arms, automatic gates, sensor scanners.",
    viewsCount: 44,
  },
  {
    key: "israa-wax-molds",
    supplierEmail: "israa@supplier.com",
    title: "Wax Molds Set",
    description:
      "Reusable wax and candle molds for craft workshops and handmade art projects.",
    categoryKey: "art-craft-supplies",
    materialType: "Wax Molds",
    aliases: ["Wax mold", "Candle molds"],
    quantity: 8,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [
      "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80",
    ],
    tags: ["wax mold", "craft project", "handmade", "art project"],
    suggestedUses: "Candle making, handmade crafts, classroom art workshops.",
    viewsCount: 31,
  },
  {
    key: "majd-battery-holders",
    supplierEmail: "majd@supplier.com",
    title: "AA and 9V Battery Holders",
    description:
      "Battery holders with attached leads, collected from unused student project kits.",
    categoryKey: "power-batteries",
    materialType: "Battery Holder",
    aliases: ["Battery clip", "Power accessory"],
    quantity: 18,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["battery", "power", "holder"],
    suggestedUses:
      "Portable Arduino circuits, LED projects, small robot power.",
    viewsCount: 22,
  },
  {
    key: "majd-laptop-cooling-fans",
    supplierEmail: "majd@supplier.com",
    title: "Reused Laptop Cooling Fans",
    description:
      "Small DC fans salvaged from damaged laptops. Tested for spin and basic airflow.",
    categoryKey: "electronics-components",
    materialType: "Cooling Fan",
    aliases: ["Laptop fan", "Small DC fan"],
    quantity: 6,
    unit: "pieces",
    condition: "USED",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.electronics],
    tags: ["fan", "cooling", "reuse"],
    suggestedUses: "Mini ventilation, cooling demos, air-flow prototypes.",
    viewsCount: 17,
  },
  {
    key: "israa-fabric-scraps",
    supplierEmail: "israa@supplier.com",
    title: "Mixed Fabric Scraps Bags",
    description:
      "Clean mixed fabric scraps sorted by size and color for sewing, textile experiments, and craft projects.",
    categoryKey: "fabric-textiles",
    materialType: "Fabric Scraps",
    aliases: ["Textile scraps", "Fabric remnants"],
    quantity: 14,
    unit: "bags",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.fabric, IMAGES.textile],
    tags: ["fabric", "textile", "sewing", "upcycling"],
    suggestedUses: "Pencil cases, patchwork, small bags, textile art.",
    viewsCount: 61,
  },
  {
    key: "israa-denim-offcuts",
    supplierEmail: "israa@supplier.com",
    title: "Denim Offcuts Bundle",
    description:
      "Strong denim offcuts from tailoring leftovers. Useful for durable textile crafts.",
    categoryKey: "fabric-textiles",
    materialType: "Denim Offcuts",
    aliases: ["Denim scraps", "Jeans fabric"],
    quantity: 9,
    unit: "bundles",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.textile],
    tags: ["denim", "fabric", "sewing"],
    suggestedUses: "Pencil cases, patches, small wallets, durable covers.",
    viewsCount: 36,
  },
  {
    key: "israa-felt-sheets",
    supplierEmail: "israa@supplier.com",
    title: "Felt Sheets Leftovers",
    description:
      "Colorful felt sheet leftovers from art workshops, mostly A4 and half-A4 sizes.",
    categoryKey: "fabric-textiles",
    materialType: "Felt Sheets",
    aliases: ["Felt leftovers", "Craft felt"],
    quantity: 22,
    unit: "sheets",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 6,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ["felt", "craft", "textile"],
    suggestedUses: "Decorations, soft models, school craft boards.",
    viewsCount: 29,
  },
  {
    key: "israa-cardboard-sheets",
    supplierEmail: "israa@supplier.com",
    title: "Large Cardboard Sheets Pack",
    description:
      "Flat cardboard sheets from packaging surplus, kept dry and ready for model making.",
    categoryKey: "paper-cardboard",
    materialType: "Cardboard Sheets",
    aliases: ["Carton sheets", "Cardboard"],
    quantity: 35,
    unit: "sheets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 5,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cardboard],
    tags: ["cardboard", "model", "recycling", "craft", "art project"],
    suggestedUses:
      "Desk organizers, architectural models, recycled prototypes.",
    viewsCount: 52,
  },
  {
    key: "israa-cardboard-tubes",
    supplierEmail: "israa@supplier.com",
    title: "Corrugated Cardboard Tubes",
    description:
      "Strong cardboard tubes from fabric rolls, suitable for structural craft builds.",
    categoryKey: "paper-cardboard",
    materialType: "Cardboard Tubes",
    aliases: ["Paper tubes", "Roll cores"],
    quantity: 18,
    unit: "pieces",
    condition: "USED",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 4,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.cardboard],
    tags: ["tube", "cardboard", "craft"],
    suggestedUses: "Desk organizers, towers, columns, marble runs.",
    viewsCount: 27,
  },
  {
    key: "israa-bottle-caps",
    supplierEmail: "israa@supplier.com",
    title: "Sorted Plastic Bottle Caps Bag",
    description:
      "Washed plastic bottle caps sorted by color for recycling art and classroom counting activities.",
    categoryKey: "packaging-containers",
    materialType: "Bottle Caps",
    aliases: ["Plastic caps", "Bottle lids"],
    quantity: 11,
    unit: "bags",
    condition: "GOOD",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 5,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["plastic caps", "recycling", "art"],
    suggestedUses: "Mosaics, sorting games, wheels for small cardboard cars.",
    viewsCount: 18,
  },
  {
    key: "israa-glass-jars",
    supplierEmail: "israa@supplier.com",
    title: "Clean Glass Jars Set",
    description:
      "Clean glass jars with lids removed from event catering leftovers. Good for storage and plant projects.",
    categoryKey: "packaging-containers",
    materialType: "Glass Jars",
    aliases: ["Mason jars", "Reusable jars"],
    quantity: 24,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "STUDENT_LEFTOVER",
    isFree: false,
    price: 3,
    maxAllowedUnitPriceNis: 6,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.jars],
    tags: ["jars", "storage", "reuse"],
    suggestedUses:
      "Mini planters, storage jars, candle holders, science samples.",
    viewsCount: 34,
  },
  {
    key: "israa-acrylic-paint",
    supplierEmail: "israa@supplier.com",
    title: "Acrylic Paint Leftovers Set",
    description:
      "Partially used acrylic paint bottles from workshops. Bottles still close well and colors are labeled.",
    categoryKey: "art-craft-supplies",
    materialType: "Acrylic Paint",
    aliases: ["Paint supplies", "Craft paint"],
    quantity: 8,
    unit: "sets",
    condition: "USED",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.paint],
    tags: ["paint", "craft", "art"],
    suggestedUses: "Cardboard models, wood decoration, classroom art boards.",
    viewsCount: 46,
  },
  {
    key: "israa-wooden-sticks",
    supplierEmail: "israa@supplier.com",
    title: "Wooden Craft Sticks Bundle",
    description:
      "Wooden craft sticks in mixed sizes for lightweight structure and model projects.",
    categoryKey: "art-craft-supplies",
    materialType: "Wooden Craft Sticks",
    aliases: ["Popsicle sticks", "Craft sticks"],
    quantity: 16,
    unit: "bundles",
    condition: "NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 7,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["wooden sticks", "craft", "model"],
    suggestedUses: "Bridges, rubber band cars, mini houses, craft frames.",
    viewsCount: 25,
  },
  {
    key: "israa-foam-board",
    supplierEmail: "israa@supplier.com",
    title: "Reused Foam Board Pieces",
    description:
      "Foam board offcuts from presentation displays, still flat enough for prototypes and signs.",
    categoryKey: "plastics-acrylic",
    materialType: "Foam Board",
    aliases: ["Foam core", "Display board"],
    quantity: 19,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ["foam board", "prototype", "display"],
    suggestedUses: "Mockups, science fair boards, lightweight enclosures.",
    viewsCount: 20,
  },
  {
    key: "supplier-plywood-panels",
    supplierEmail: "supplier@supplier.com",
    title: "Reclaimed Plywood Panels",
    description:
      "Clean plywood panels reclaimed from temporary shelving. Edges are rough but panels are usable.",
    categoryKey: "wood-boards",
    materialType: "Plywood Sheet",
    aliases: ["Plywood panel", "Wood board"],
    quantity: 12,
    unit: "panels",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 24,
    maxAllowedUnitPriceNis: 35,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.woodPanels, IMAGES.wood],
    tags: ["plywood", "wood", "boards"],
    suggestedUses: "Phone stands, small shelves, prototypes, model bases.",
    viewsCount: 58,
  },
  {
    key: "supplier-mdf-offcuts",
    supplierEmail: "supplier@supplier.com",
    title: "MDF Offcuts Bundle",
    description:
      "MDF offcuts in different small sizes from workshop cutting jobs. Good for indoor prototypes.",
    categoryKey: "wood-boards",
    materialType: "MDF Offcuts",
    aliases: ["MDF scraps", "Fiberboard pieces"],
    quantity: 20,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 7,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.wood],
    tags: ["mdf", "offcuts", "wood"],
    suggestedUses: "Bases, phone stands, model parts, small jigs.",
    viewsCount: 33,
  },
  {
    key: "supplier-pine-strips",
    supplierEmail: "supplier@supplier.com",
    title: "Pine Wood Strips",
    description:
      "Long narrow pine strips from furniture manufacturing leftovers, useful for frames and light structures.",
    categoryKey: "wood-boards",
    materialType: "Pine Wood Strips",
    aliases: ["Wood strips", "Timber strips"],
    quantity: 30,
    unit: "strips",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 5,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.wood],
    tags: ["pine", "wood strips", "frame"],
    suggestedUses: "Greenhouse frames, small bridges, craft structures.",
    viewsCount: 41,
  },
  {
    key: "supplier-acrylic-sheets",
    supplierEmail: "supplier@supplier.com",
    title: "Clear Acrylic Sheet Offcuts",
    description:
      "Clear acrylic offcuts with protective film on some pieces. Sizes vary from small to medium.",
    categoryKey: "plastics-acrylic",
    materialType: "Acrylic Sheet",
    aliases: ["Plexiglass", "Clear plastic sheet"],
    quantity: 14,
    unit: "sheets",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 22,
    maxAllowedUnitPriceNis: 30,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.acrylic, IMAGES.workshop],
    tags: ["acrylic", "plastic", "sheet"],
    suggestedUses: "Mini greenhouse covers, enclosures, display panels.",
    viewsCount: 67,
  },
  {
    key: "supplier-pvc-pipes",
    supplierEmail: "supplier@supplier.com",
    title: "PVC Pipe Short Pieces",
    description:
      "Short PVC pipe pieces from plumbing leftovers. Ends may need trimming before use.",
    categoryKey: "plastics-acrylic",
    materialType: "PVC Pipes",
    aliases: ["Plastic pipes", "PVC tube"],
    quantity: 26,
    unit: "pieces",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.pipes],
    tags: ["pvc", "pipes", "structure"],
    suggestedUses:
      "Greenhouse frames, stands, water-flow demos, structural prototypes.",
    viewsCount: 38,
  },
  {
    key: "supplier-aluminum-angles",
    supplierEmail: "supplier@supplier.com",
    title: "Aluminum Angle Pieces",
    description:
      "Short aluminum angle pieces from fabrication leftovers. Lightweight and strong for frames.",
    categoryKey: "metal-fasteners",
    materialType: "Aluminum Angle",
    aliases: ["Aluminum profile", "Metal angle"],
    quantity: 17,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.metal],
    tags: ["aluminum", "metal", "frame"],
    suggestedUses: "Robot chassis, mini structures, reinforcement brackets.",
    viewsCount: 30,
  },
  {
    key: "supplier-screws-nuts",
    supplierEmail: "supplier@supplier.com",
    title: "Mixed Screws and Nuts Box",
    description:
      "Sorted box of mixed screws, nuts, and washers from workshop surplus. Common small sizes included.",
    categoryKey: "metal-fasteners",
    materialType: "Screws and Nuts",
    aliases: ["Fasteners", "Hardware box"],
    quantity: 9,
    unit: "boxes",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 14,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["screws", "nuts", "fasteners"],
    suggestedUses: "Wood projects, robot chassis, small hardware repairs.",
    viewsCount: 49,
  },
  {
    key: "supplier-hinges-set",
    supplierEmail: "supplier@supplier.com",
    title: "Small Hinges Set",
    description:
      "Small metal hinges removed from display cabinets and workshop prototypes.",
    categoryKey: "tools-hardware",
    materialType: "Small Hinges",
    aliases: ["Hinges", "Door hinge"],
    quantity: 20,
    unit: "pieces",
    condition: "USED",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 6,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["hinge", "hardware", "mechanical"],
    suggestedUses: "Mini greenhouse doors, boxes, moving panels.",
    viewsCount: 21,
  },
  {
    key: "supplier-drill-bits",
    supplierEmail: "supplier@supplier.com",
    title: "Used Hand Drill Bits",
    description:
      "Used but usable drill bits in common small sizes. Suitable for wood and light plastic projects.",
    categoryKey: "tools-hardware",
    materialType: "Drill Bits",
    aliases: ["Hand drill bits", "Tool accessories"],
    quantity: 11,
    unit: "sets",
    condition: "USED",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.tools],
    tags: ["drill", "bits", "tools"],
    suggestedUses:
      "Preparing holes for wood, acrylic, and small assembly work.",
    viewsCount: 16,
  },
  {
    key: "supplier-rubber-wheels",
    supplierEmail: "supplier@supplier.com",
    title: "Rubber Wheels Set",
    description:
      "Rubber wheels removed from broken carts and old robotics bases. Axle holes vary.",
    categoryKey: "motors-mechanical",
    materialType: "Rubber Wheels",
    aliases: ["Robot wheels", "Cart wheels"],
    quantity: 16,
    unit: "pieces",
    condition: "USED",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 12,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ["wheels", "rubber", "robotics"],
    suggestedUses: "Robot cars, rubber band cars, moving platforms.",
    viewsCount: 57,
  },
];

const ADDITIONAL_MATERIALS: MaterialSeed[] = [
  {
    key: "majd-arduino-nano-boards",
    supplierEmail: "majd@supplier.com",
    title: "Arduino Nano Development Boards",
    description:
      "Arduino Nano Development Boards from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Arduino Nano",
    aliases: ["Arduino Nano", "Arduino Nano Development Boards"],
    quantity: 14,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 32,
    maxAllowedUnitPriceNis: 50,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.arduino],
    tags: ["arduino", "nano", "microcontroller"],
    suggestedUses:
      "Compact breadboard controllers, wearable prototypes, and small sensor builds.",
    viewsCount: 12,
  },
  {
    key: "majd-esp32-devkit-boards",
    supplierEmail: "majd@supplier.com",
    title: "ESP32 DevKit Wi-Fi Boards",
    description:
      "ESP32 DevKit Wi-Fi Boards from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "ESP32 Development Board",
    aliases: ["ESP32 Development Board", "ESP32 DevKit Wi-Fi Boards"],
    quantity: 11,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 42,
    maxAllowedUnitPriceNis: 65,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.electronics],
    tags: ["esp32", "wifi", "iot"],
    suggestedUses:
      "IoT dashboards, wireless sensors, and connected home experiments.",
    viewsCount: 29,
  },
  {
    key: "majd-raspberry-pi-pico-boards",
    supplierEmail: "majd@supplier.com",
    title: "Raspberry Pi Pico Boards",
    description:
      "Raspberry Pi Pico Boards from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Raspberry Pi Pico",
    aliases: ["Raspberry Pi Pico", "Raspberry Pi Pico Boards"],
    quantity: 9,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 28,
    maxAllowedUnitPriceNis: 45,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.arduino],
    tags: ["raspberry pi pico", "microcontroller", "embedded"],
    suggestedUses:
      "MicroPython lessons, control projects, and compact automation prototypes.",
    viewsCount: 46,
  },
  {
    key: "majd-raspberry-pi-3b-boards",
    supplierEmail: "majd@supplier.com",
    title: "Raspberry Pi 3 Model B Boards",
    description:
      "Raspberry Pi 3 Model B Boards from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Raspberry Pi 3B",
    aliases: ["Raspberry Pi 3B", "Raspberry Pi 3 Model B Boards"],
    quantity: 4,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 145,
    maxAllowedUnitPriceNis: 220,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.electronics],
    tags: ["raspberry pi", "single board computer", "linux"],
    suggestedUses:
      "Local servers, computer vision demos, and programming labs.",
    viewsCount: 63,
  },
  {
    key: "majd-pir-motion-sensors",
    supplierEmail: "majd@supplier.com",
    title: "PIR Motion Sensor Modules",
    description:
      "PIR Motion Sensor Modules from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "PIR Motion Sensor",
    aliases: ["PIR Motion Sensor", "PIR Motion Sensor Modules"],
    quantity: 18,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["pir", "motion sensor", "automation"],
    suggestedUses:
      "Motion-triggered lighting, alarms, and occupancy experiments.",
    viewsCount: 80,
  },
  {
    key: "majd-dht11-sensors",
    supplierEmail: "majd@supplier.com",
    title: "DHT11 Temperature and Humidity Sensors",
    description:
      "DHT11 Temperature and Humidity Sensors from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "DHT11 Sensor",
    aliases: ["DHT11 Sensor", "DHT11 Temperature and Humidity Sensors"],
    quantity: 15,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 11,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["temperature", "humidity", "sensor"],
    suggestedUses:
      "Weather stations, greenhouse monitoring, and classroom data logging.",
    viewsCount: 14,
  },
  {
    key: "majd-soil-moisture-sensors",
    supplierEmail: "majd@supplier.com",
    title: "Soil Moisture Sensor Modules",
    description:
      "Soil Moisture Sensor Modules from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Soil Moisture Sensor",
    aliases: ["Soil Moisture Sensor", "Soil Moisture Sensor Modules"],
    quantity: 13,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.components],
    tags: ["soil moisture", "plant monitor", "sensor"],
    suggestedUses: "Plant watering alerts and smart garden prototypes.",
    viewsCount: 31,
  },
  {
    key: "majd-ldr-light-sensors",
    supplierEmail: "majd@supplier.com",
    title: "LDR Light Sensor Packs",
    description:
      "LDR Light Sensor Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Light Sensor",
    aliases: ["Light Sensor", "LDR Light Sensor"],
    quantity: 10,
    unit: "packs",
    condition: "NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 12,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["ldr", "light sensor", "photoresistor"],
    suggestedUses: "Automatic night lights and light-level experiments.",
    viewsCount: 48,
  },
  {
    key: "majd-mq2-gas-sensors",
    supplierEmail: "majd@supplier.com",
    title: "MQ-2 Gas Sensor Modules",
    description:
      "MQ-2 Gas Sensor Modules from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "MQ-2 Gas Sensor",
    aliases: ["MQ-2 Gas Sensor", "MQ-2 Gas Sensor Modules"],
    quantity: 7,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 30,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.workshop],
    tags: ["gas sensor", "mq2", "safety"],
    suggestedUses:
      "Ventilation demonstrations and supervised air-quality experiments.",
    viewsCount: 65,
  },
  {
    key: "majd-flame-sensor-modules",
    supplierEmail: "majd@supplier.com",
    title: "Infrared Flame Sensor Modules",
    description:
      "Infrared Flame Sensor Modules from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Flame Sensor",
    aliases: ["Flame Sensor", "Infrared Flame Sensor Modules"],
    quantity: 9,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 10,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.components],
    tags: ["flame sensor", "infrared", "alarm"],
    suggestedUses:
      "Supervised fire-detection demonstrations and alarm prototypes.",
    viewsCount: 82,
  },
  {
    key: "majd-water-level-sensors",
    supplierEmail: "majd@supplier.com",
    title: "Water Level Sensor Strips",
    description:
      "Water Level Sensor Strips from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Water Level Sensor",
    aliases: ["Water Level Sensor", "Water Level Sensor Strips"],
    quantity: 12,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 16,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["water level", "sensor", "alarm"],
    suggestedUses:
      "Tank level alerts, rain experiments, and leak detection demos.",
    viewsCount: 16,
  },
  {
    key: "majd-ir-obstacle-sensors",
    supplierEmail: "majd@supplier.com",
    title: "IR Obstacle Detection Modules",
    description:
      "IR Obstacle Detection Modules from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "IR Obstacle Sensor",
    aliases: ["IR Obstacle Sensor", "IR Obstacle Detection Modules"],
    quantity: 16,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 10,
    maxAllowedUnitPriceNis: 16,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["infrared", "obstacle sensor", "robotics"],
    suggestedUses: "Line followers, obstacle detection, and counting gates.",
    viewsCount: 33,
  },
  {
    key: "majd-l298n-motor-drivers",
    supplierEmail: "majd@supplier.com",
    title: "L298N Dual Motor Driver Modules",
    description:
      "L298N Dual Motor Driver Modules from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "L298N Motor Driver",
    aliases: ["L298N Motor Driver", "L298N Dual Motor Driver Modules"],
    quantity: 10,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 24,
    maxAllowedUnitPriceNis: 35,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.electronics],
    tags: ["l298n", "motor driver", "robotics"],
    suggestedUses: "Two-motor robot cars and direction-control experiments.",
    viewsCount: 50,
  },
  {
    key: "majd-tb6612-motor-drivers",
    supplierEmail: "majd@supplier.com",
    title: "TB6612FNG Motor Driver Boards",
    description:
      "TB6612FNG Motor Driver Boards from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "TB6612FNG Motor Driver",
    aliases: ["TB6612FNG Motor Driver", "TB6612FNG Motor Driver Boards"],
    quantity: 8,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 30,
    maxAllowedUnitPriceNis: 45,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.electronics],
    tags: ["tb6612", "motor controller", "robotics"],
    suggestedUses: "Efficient small robot and battery-powered motor projects.",
    viewsCount: 67,
  },
  {
    key: "majd-nema17-stepper-motors",
    supplierEmail: "majd@supplier.com",
    title: "NEMA 17 Stepper Motors",
    description:
      "NEMA 17 Stepper Motors from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "motors-mechanical",
    materialType: "NEMA 17 Stepper Motor",
    aliases: ["NEMA 17 Stepper Motor", "NEMA 17 Stepper Motors"],
    quantity: 6,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 58,
    maxAllowedUnitPriceNis: 85,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ["stepper motor", "nema17", "motion"],
    suggestedUses:
      "CNC demonstrations, camera sliders, and precise motion prototypes.",
    viewsCount: 84,
  },
  {
    key: "majd-28byj48-stepper-kits",
    supplierEmail: "majd@supplier.com",
    title: "28BYJ-48 Stepper Motor Kits",
    description:
      "28BYJ-48 Stepper Motor Kits from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "motors-mechanical",
    materialType: "28BYJ-48 Stepper Kit",
    aliases: ["28BYJ-48 Stepper Kit", "28BYJ-48 Stepper Motor Kits"],
    quantity: 9,
    unit: "kits",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 22,
    maxAllowedUnitPriceNis: 32,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.motors],
    tags: ["stepper", "uln2003", "motor kit"],
    suggestedUses:
      "Clock mechanisms, rotating displays, and beginner motion control.",
    viewsCount: 18,
  },
  {
    key: "majd-relay-modules",
    supplierEmail: "majd@supplier.com",
    title: "5V Relay Module Packs",
    description:
      "5V Relay Module Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Relay Module",
    aliases: ["Relay Module", "5V Relay Module"],
    quantity: 10,
    unit: "packs",
    condition: "NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 16,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["relay", "switching", "automation"],
    suggestedUses: "Low-voltage control demos for lamps, pumps, and fans.",
    viewsCount: 35,
  },
  {
    key: "majd-oled-displays",
    supplierEmail: "majd@supplier.com",
    title: "0.96-inch OLED Display Modules",
    description:
      "0.96-inch OLED Display Modules from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "OLED Display",
    aliases: ["OLED Display", "0.96-inch OLED Display Modules"],
    quantity: 12,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 27,
    maxAllowedUnitPriceNis: 40,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.electronics],
    tags: ["oled", "display", "i2c"],
    suggestedUses: "Compact sensor dashboards and portable project screens.",
    viewsCount: 52,
  },
  {
    key: "majd-lcd-16x2-displays",
    supplierEmail: "majd@supplier.com",
    title: "16x2 LCD Displays with I2C Backpacks",
    description:
      "16x2 LCD Displays with I2C Backpacks from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "16x2 LCD Display",
    aliases: ["16x2 LCD Display", "16x2 LCD Displays with I2C Backpacks"],
    quantity: 8,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 26,
    maxAllowedUnitPriceNis: 38,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.electronics],
    tags: ["lcd", "display", "i2c"],
    suggestedUses: "Counters, temperature displays, and menu-driven projects.",
    viewsCount: 69,
  },
  {
    key: "majd-seven-segment-displays",
    supplierEmail: "majd@supplier.com",
    title: "Four-Digit Seven-Segment Displays",
    description:
      "Four-Digit Seven-Segment Displays from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Seven Segment Display",
    aliases: ["Seven Segment Display", "Four-Digit Seven-Segment Displays"],
    quantity: 10,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 15,
    maxAllowedUnitPriceNis: 24,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.electronics],
    tags: ["seven segment", "display", "counter"],
    suggestedUses: "Timers, scoreboards, counters, and electronic dice.",
    viewsCount: 86,
  },
  {
    key: "majd-potentiometer-packs",
    supplierEmail: "majd@supplier.com",
    title: "10k Potentiometer Packs",
    description:
      "10k Potentiometer Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Potentiometer Pack",
    aliases: ["Potentiometer Pack", "10k Potentiometer"],
    quantity: 12,
    unit: "packs",
    condition: "NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["potentiometer", "analog", "control"],
    suggestedUses: "Brightness, speed, and sensor-threshold controls.",
    viewsCount: 20,
  },
  {
    key: "majd-tactile-switch-packs",
    supplierEmail: "majd@supplier.com",
    title: "Tactile Push Switch Packs",
    description:
      "Tactile Push Switch Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Tactile Switch Pack",
    aliases: ["Tactile Switch Pack", "Tactile Push Switch"],
    quantity: 15,
    unit: "packs",
    condition: "NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 7,
    maxAllowedUnitPriceNis: 12,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.components],
    tags: ["tactile switch", "button", "input"],
    suggestedUses: "Control panels, counters, and interactive electronics.",
    viewsCount: 37,
  },
  {
    key: "majd-push-button-packs",
    supplierEmail: "majd@supplier.com",
    title: "Panel-Mount Push Button Packs",
    description:
      "Panel-Mount Push Button Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Push Button Pack",
    aliases: ["Push Button Pack", "Panel-Mount Push Button"],
    quantity: 8,
    unit: "packs",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 14,
    maxAllowedUnitPriceNis: 22,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["push button", "panel switch", "input"],
    suggestedUses: "Durable project controls and classroom interface builds.",
    viewsCount: 54,
  },
  {
    key: "majd-buzzer-modules",
    supplierEmail: "majd@supplier.com",
    title: "Active Buzzer Module Packs",
    description:
      "Active Buzzer Module Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Buzzer Module",
    aliases: ["Buzzer Module", "Active Buzzer Module"],
    quantity: 11,
    unit: "packs",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 14,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["buzzer", "alarm", "sound"],
    suggestedUses: "Timers, warning systems, and feedback sounds.",
    viewsCount: 71,
  },
  {
    key: "majd-capacitor-kits",
    supplierEmail: "majd@supplier.com",
    title: "Mixed Capacitor Assortment Kits",
    description:
      "Mixed Capacitor Assortment Kits from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Capacitor Kit",
    aliases: ["Capacitor Kit", "Mixed Capacitor Assortment Kits"],
    quantity: 7,
    unit: "kits",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 19,
    maxAllowedUnitPriceNis: 28,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.components],
    tags: ["capacitor", "passive components", "circuit"],
    suggestedUses:
      "Filtering, timing circuits, and electronics repair practice.",
    viewsCount: 88,
  },
  {
    key: "majd-diode-packs",
    supplierEmail: "majd@supplier.com",
    title: "General Purpose Diode Packs",
    description:
      "General Purpose Diode Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Diode Pack",
    aliases: ["Diode Pack", "General Purpose Diode"],
    quantity: 9,
    unit: "packs",
    condition: "NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 14,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["diode", "rectifier", "components"],
    suggestedUses: "Reverse-polarity protection and rectifier demonstrations.",
    viewsCount: 22,
  },
  {
    key: "majd-transistor-packs",
    supplierEmail: "majd@supplier.com",
    title: "NPN and PNP Transistor Packs",
    description:
      "NPN and PNP Transistor Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Transistor Pack",
    aliases: ["Transistor Pack", "NPN and PNP Transistor"],
    quantity: 8,
    unit: "packs",
    condition: "NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 14,
    maxAllowedUnitPriceNis: 22,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["transistor", "switching", "amplifier"],
    suggestedUses:
      "LED drivers, motor switching, and basic amplifier experiments.",
    viewsCount: 39,
  },
  {
    key: "majd-perfboard-sheets",
    supplierEmail: "majd@supplier.com",
    title: "Perforated Prototype Board Sheets",
    description:
      "Perforated Prototype Board Sheets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Perfboard",
    aliases: ["Perfboard", "Perforated Prototype Board Sheets"],
    quantity: 18,
    unit: "sheets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 7,
    maxAllowedUnitPriceNis: 12,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.breadboard],
    tags: ["perfboard", "prototype board", "soldering"],
    suggestedUses: "Permanent versions of tested breadboard circuits.",
    viewsCount: 56,
  },
  {
    key: "majd-pcb-offcuts",
    supplierEmail: "majd@supplier.com",
    title: "Copper-Clad PCB Offcuts",
    description:
      "Copper-Clad PCB Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "PCB Offcuts",
    aliases: ["PCB Offcuts", "Copper-Clad PCB Offcuts"],
    quantity: 24,
    unit: "pieces",
    condition: "USED",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.electronics],
    tags: ["pcb", "copper clad", "offcuts"],
    suggestedUses:
      "Soldering practice, etching demonstrations, and small circuits.",
    viewsCount: 73,
  },
  {
    key: "majd-soldering-practice-boards",
    supplierEmail: "majd@supplier.com",
    title: "Soldering Practice Board Sets",
    description:
      "Soldering Practice Board Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "lab-education",
    materialType: "Soldering Practice Boards",
    aliases: ["Soldering Practice Boards", "Soldering Practice Board"],
    quantity: 10,
    unit: "sets",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 28,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.workshop],
    tags: ["soldering", "training", "lab"],
    suggestedUses:
      "Beginner soldering workshops and component replacement practice.",
    viewsCount: 90,
  },
  {
    key: "majd-copper-wire-spools",
    supplierEmail: "majd@supplier.com",
    title: "Insulated Copper Wire Spools",
    description:
      "Insulated Copper Wire Spools from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Copper Wire",
    aliases: ["Copper Wire", "Insulated Copper Wire Spools"],
    quantity: 12,
    unit: "spools",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 16,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.cables],
    tags: ["copper wire", "wiring", "spool"],
    suggestedUses: "Low-voltage circuits, coils, and classroom prototypes.",
    viewsCount: 24,
  },
  {
    key: "majd-alligator-clip-leads",
    supplierEmail: "majd@supplier.com",
    title: "Alligator Clip Test Lead Sets",
    description:
      "Alligator Clip Test Lead Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "lab-education",
    materialType: "Alligator Clip Leads",
    aliases: ["Alligator Clip Leads", "Alligator Clip Test Lead"],
    quantity: 14,
    unit: "sets",
    condition: "LIKE_NEW",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cables],
    tags: ["alligator clips", "test leads", "lab"],
    suggestedUses:
      "Temporary connections, battery tests, and circuit demonstrations.",
    viewsCount: 41,
  },
  {
    key: "majd-heat-shrink-tubing",
    supplierEmail: "majd@supplier.com",
    title: "Heat-Shrink Tubing Assortments",
    description:
      "Heat-Shrink Tubing Assortments from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Heat Shrink Tubing",
    aliases: ["Heat Shrink Tubing", "Heat-Shrink Tubing Assortments"],
    quantity: 13,
    unit: "packs",
    condition: "NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 11,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cables],
    tags: ["heat shrink", "insulation", "wiring"],
    suggestedUses: "Safe wire joints, cable repair, and electronics finishing.",
    viewsCount: 58,
  },
  {
    key: "majd-dupont-connector-housings",
    supplierEmail: "majd@supplier.com",
    title: "Dupont Connector Housing Sets",
    description:
      "Dupont Connector Housing Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Dupont Connectors",
    aliases: ["Dupont Connectors", "Dupont Connector Housing"],
    quantity: 10,
    unit: "sets",
    condition: "NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 13,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.components],
    tags: ["dupont", "connectors", "wiring"],
    suggestedUses: "Custom jumper cables and reusable sensor connectors.",
    viewsCount: 75,
  },
  {
    key: "majd-usb-cables",
    supplierEmail: "majd@supplier.com",
    title: "Mixed USB Data Cable Bundles",
    description:
      "Mixed USB Data Cable Bundles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "USB Cables",
    aliases: ["USB Cables", "Mixed USB Data Cable"],
    quantity: 17,
    unit: "bundles",
    condition: "USED",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 12,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cables],
    tags: ["usb", "data cable", "reuse"],
    suggestedUses:
      "Programming boards, charging small devices, and cable repair.",
    viewsCount: 92,
  },
  {
    key: "majd-dc-barrel-jack-adapters",
    supplierEmail: "majd@supplier.com",
    title: "DC Barrel Jack Adapter Packs",
    description:
      "DC Barrel Jack Adapter Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "power-batteries",
    materialType: "DC Barrel Jack Adapter",
    aliases: ["DC Barrel Jack Adapter", "DC Barrel Jack Adapter"],
    quantity: 9,
    unit: "packs",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["dc jack", "power adapter", "connector"],
    suggestedUses: "Reusable power inputs for enclosures and bench projects.",
    viewsCount: 26,
  },
  {
    key: "majd-mini-solar-panels",
    supplierEmail: "majd@supplier.com",
    title: "Small 5V Solar Panels",
    description:
      "Small 5V Solar Panels from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "power-batteries",
    materialType: "Mini Solar Panel",
    aliases: ["Mini Solar Panel", "Small 5V Solar Panels"],
    quantity: 8,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 48,
    maxAllowedUnitPriceNis: 70,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.greenhouse],
    tags: ["solar panel", "renewable energy", "power"],
    suggestedUses: "Solar charging demonstrations and outdoor sensor projects.",
    viewsCount: 43,
  },
  {
    key: "majd-small-speakers",
    supplierEmail: "majd@supplier.com",
    title: "Small Reclaimed Speaker Pairs",
    description:
      "Small Reclaimed Speaker Pairs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Small Speakers",
    aliases: ["Small Speakers", "Small Reclaimed Speaker Pairs"],
    quantity: 7,
    unit: "pairs",
    condition: "USED",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.electronics],
    tags: ["speaker", "audio", "reuse"],
    suggestedUses: "Audio alarms, simple amplifiers, and sound experiments.",
    viewsCount: 60,
  },
  {
    key: "majd-toggle-switches",
    supplierEmail: "majd@supplier.com",
    title: "Mini Toggle Switch Packs",
    description:
      "Mini Toggle Switch Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "electronics-components",
    materialType: "Toggle Switch Pack",
    aliases: ["Toggle Switch Pack", "Mini Toggle Switch"],
    quantity: 9,
    unit: "packs",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 15,
    maxAllowedUnitPriceNis: 22,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ["toggle switch", "control", "panel"],
    suggestedUses: "On/off controls for battery projects and small enclosures.",
    viewsCount: 77,
  },
  {
    key: "majd-multimeter-probe-sets",
    supplierEmail: "majd@supplier.com",
    title: "Replacement Multimeter Probe Sets",
    description:
      "Replacement Multimeter Probe Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "lab-education",
    materialType: "Multimeter Probes",
    aliases: ["Multimeter Probes", "Replacement Multimeter Probe"],
    quantity: 6,
    unit: "sets",
    condition: "GOOD",
    sourceType: "EDUCATIONAL_INSTITUTION",
    isFree: false,
    price: 24,
    maxAllowedUnitPriceNis: 35,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.workshop],
    tags: ["multimeter", "probe", "testing"],
    suggestedUses:
      "Electronics measurement practice and replacing damaged leads.",
    viewsCount: 94,
  },
  {
    key: "israa-cotton-offcuts",
    supplierEmail: "israa@supplier.com",
    title: "Cotton Fabric Offcuts",
    description:
      "Cotton Fabric Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Cotton Offcuts",
    aliases: ["Cotton Offcuts", "Cotton Fabric Offcuts"],
    quantity: 16,
    unit: "bundles",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.fabric],
    tags: ["cotton", "fabric", "sewing"],
    suggestedUses:
      "Patchwork, small pouches, reusable wraps, and classroom textile work.",
    viewsCount: 28,
  },
  {
    key: "israa-canvas-offcuts",
    supplierEmail: "israa@supplier.com",
    title: "Heavy Canvas Offcuts",
    description:
      "Heavy Canvas Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Canvas Offcuts",
    aliases: ["Canvas Offcuts", "Heavy Canvas Offcuts"],
    quantity: 10,
    unit: "bundles",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 14,
    maxAllowedUnitPriceNis: 22,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.textile],
    tags: ["canvas", "heavy fabric", "sewing"],
    suggestedUses: "Tote bags, tool rolls, covers, and durable craft projects.",
    viewsCount: 45,
  },
  {
    key: "israa-leather-offcuts",
    supplierEmail: "israa@supplier.com",
    title: "Synthetic Leather Offcuts",
    description:
      "Synthetic Leather Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Synthetic Leather Offcuts",
    aliases: ["Synthetic Leather Offcuts", "Synthetic Leather Offcuts"],
    quantity: 7,
    unit: "bundles",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 28,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.textile],
    tags: ["synthetic leather", "offcuts", "craft"],
    suggestedUses: "Wallets, labels, straps, and decorative patches.",
    viewsCount: 62,
  },
  {
    key: "israa-zipper-bundles",
    supplierEmail: "israa@supplier.com",
    title: "Mixed Zipper Bundles",
    description:
      "Mixed Zipper Bundles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Zippers",
    aliases: ["Zippers", "Mixed Zipper"],
    quantity: 13,
    unit: "bundles",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 10,
    maxAllowedUnitPriceNis: 16,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.sewing],
    tags: ["zippers", "sewing", "fastener"],
    suggestedUses: "Pencil cases, bags, cushions, and clothing repairs.",
    viewsCount: 79,
  },
  {
    key: "israa-button-assortment",
    supplierEmail: "israa@supplier.com",
    title: "Sorted Button Assortment Boxes",
    description:
      "Sorted Button Assortment Boxes from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Button Assortment",
    aliases: ["Button Assortment", "Sorted Button Assortment Boxes"],
    quantity: 11,
    unit: "boxes",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["buttons", "sewing", "decoration"],
    suggestedUses:
      "Repairs, learning activities, mosaics, and textile decoration.",
    viewsCount: 13,
  },
  {
    key: "israa-sewing-thread-spools",
    supplierEmail: "israa@supplier.com",
    title: "Mixed Sewing Thread Spools",
    description:
      "Mixed Sewing Thread Spools from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Sewing Thread",
    aliases: ["Sewing Thread", "Mixed Sewing Thread Spools"],
    quantity: 12,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.sewing],
    tags: ["thread", "sewing", "spools"],
    suggestedUses: "Hand sewing, machine practice, and fabric repairs.",
    viewsCount: 30,
  },
  {
    key: "israa-embroidery-thread",
    supplierEmail: "israa@supplier.com",
    title: "Embroidery Thread Bundles",
    description:
      "Embroidery Thread Bundles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Embroidery Thread",
    aliases: ["Embroidery Thread", "Embroidery Thread"],
    quantity: 14,
    unit: "bundles",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 11,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.sewing],
    tags: ["embroidery", "thread", "textile art"],
    suggestedUses:
      "Decorative stitching, friendship bracelets, and textile art.",
    viewsCount: 47,
  },
  {
    key: "israa-yarn-bundles",
    supplierEmail: "israa@supplier.com",
    title: "Mixed Yarn Bundles",
    description:
      "Mixed Yarn Bundles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Yarn",
    aliases: ["Yarn", "Mixed Yarn"],
    quantity: 15,
    unit: "bundles",
    condition: "GOOD",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.textile],
    tags: ["yarn", "knitting", "crochet"],
    suggestedUses: "Wall hangings, pom-poms, knitting practice, and weaving.",
    viewsCount: 64,
  },
  {
    key: "israa-ribbon-rolls",
    supplierEmail: "israa@supplier.com",
    title: "Decorative Ribbon Rolls",
    description:
      "Decorative Ribbon Rolls from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Ribbon Rolls",
    aliases: ["Ribbon Rolls", "Decorative Ribbon Rolls"],
    quantity: 18,
    unit: "rolls",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 7,
    maxAllowedUnitPriceNis: 12,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ["ribbon", "decoration", "craft"],
    suggestedUses:
      "Gift wrapping, textile decoration, and classroom craft work.",
    viewsCount: 81,
  },
  {
    key: "israa-lace-trim",
    supplierEmail: "israa@supplier.com",
    title: "Lace Trim Remnants",
    description:
      "Lace Trim Remnants from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Lace Trim",
    aliases: ["Lace Trim", "Lace Trim Remnants"],
    quantity: 9,
    unit: "bundles",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 14,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.textile],
    tags: ["lace", "trim", "sewing"],
    suggestedUses: "Clothing repair, textile cards, and decorative edges.",
    viewsCount: 15,
  },
  {
    key: "israa-elastic-bands",
    supplierEmail: "israa@supplier.com",
    title: "Sewing Elastic Band Rolls",
    description:
      "Sewing Elastic Band Rolls from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Elastic Band",
    aliases: ["Elastic Band", "Sewing Elastic Band Rolls"],
    quantity: 10,
    unit: "rolls",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.sewing],
    tags: ["elastic", "sewing", "band"],
    suggestedUses: "Masks, pouches, clothing repairs, and flexible straps.",
    viewsCount: 32,
  },
  {
    key: "israa-velcro-strips",
    supplierEmail: "israa@supplier.com",
    title: "Hook-and-Loop Fastener Strips",
    description:
      "Hook-and-Loop Fastener Strips from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Hook and Loop Strips",
    aliases: ["Hook and Loop Strips", "Hook-and-Loop Fastener Strips"],
    quantity: 12,
    unit: "packs",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 11,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ["velcro", "fastener", "sewing"],
    suggestedUses: "Reusable closures for bags, models, and cable organizers.",
    viewsCount: 49,
  },
  {
    key: "israa-burlap-sacks",
    supplierEmail: "israa@supplier.com",
    title: "Clean Burlap Sack Pieces",
    description:
      "Clean Burlap Sack Pieces from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "fabric-textiles",
    materialType: "Burlap Fabric",
    aliases: ["Burlap Fabric", "Clean Burlap Sack Pieces"],
    quantity: 8,
    unit: "pieces",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 9,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.textile],
    tags: ["burlap", "natural fabric", "reuse"],
    suggestedUses: "Plant covers, rustic crafts, storage sacks, and wall art.",
    viewsCount: 66,
  },
  {
    key: "israa-fabric-hoops",
    supplierEmail: "israa@supplier.com",
    title: "Embroidery Hoop Sets",
    description:
      "Embroidery Hoop Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Embroidery Hoops",
    aliases: ["Embroidery Hoops", "Embroidery Hoop"],
    quantity: 9,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 15,
    maxAllowedUnitPriceNis: 24,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.sewing],
    tags: ["embroidery hoop", "textile tool", "craft"],
    suggestedUses:
      "Embroidery practice, framed textile art, and fabric painting.",
    viewsCount: 83,
  },
  {
    key: "israa-crochet-hooks",
    supplierEmail: "israa@supplier.com",
    title: "Mixed Crochet Hook Sets",
    description:
      "Mixed Crochet Hook Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Crochet Hooks",
    aliases: ["Crochet Hooks", "Mixed Crochet Hook"],
    quantity: 7,
    unit: "sets",
    condition: "GOOD",
    sourceType: "STUDENT_LEFTOVER",
    isFree: false,
    price: 16,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.sewing],
    tags: ["crochet hook", "yarn tool", "craft"],
    suggestedUses: "Crochet lessons, yarn reuse, and small handmade projects.",
    viewsCount: 17,
  },
  {
    key: "israa-knitting-needles",
    supplierEmail: "israa@supplier.com",
    title: "Knitting Needle Pairs",
    description:
      "Knitting Needle Pairs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Knitting Needles",
    aliases: ["Knitting Needles", "Knitting Needle Pairs"],
    quantity: 10,
    unit: "pairs",
    condition: "GOOD",
    sourceType: "STUDENT_LEFTOVER",
    isFree: false,
    price: 14,
    maxAllowedUnitPriceNis: 22,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.sewing],
    tags: ["knitting needles", "yarn tool", "textile"],
    suggestedUses:
      "Beginner knitting, reused-yarn projects, and classroom clubs.",
    viewsCount: 34,
  },
  {
    key: "israa-sewing-pattern-paper",
    supplierEmail: "israa@supplier.com",
    title: "Large Sewing Pattern Paper Sheets",
    description:
      "Large Sewing Pattern Paper Sheets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "paper-cardboard",
    materialType: "Pattern Paper",
    aliases: ["Pattern Paper", "Large Sewing Pattern Paper Sheets"],
    quantity: 30,
    unit: "sheets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 4,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cardboard],
    tags: ["pattern paper", "sewing", "paper"],
    suggestedUses:
      "Reusable templates, garment patterns, and full-size sketches.",
    viewsCount: 51,
  },
  {
    key: "israa-foam-sheets",
    supplierEmail: "israa@supplier.com",
    title: "Colored Craft Foam Sheets",
    description:
      "Colored Craft Foam Sheets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "plastics-acrylic",
    materialType: "Craft Foam Sheets",
    aliases: ["Craft Foam Sheets", "Colored Craft Foam Sheets"],
    quantity: 25,
    unit: "sheets",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 5,
    maxAllowedUnitPriceNis: 9,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ["foam sheet", "craft", "model"],
    suggestedUses:
      "School models, masks, decorations, and lightweight prototypes.",
    viewsCount: 68,
  },
  {
    key: "israa-eva-foam-offcuts",
    supplierEmail: "israa@supplier.com",
    title: "EVA Foam Offcuts",
    description:
      "EVA Foam Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "plastics-acrylic",
    materialType: "EVA Foam Offcuts",
    aliases: ["EVA Foam Offcuts", "EVA Foam Offcuts"],
    quantity: 12,
    unit: "bags",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["eva foam", "offcuts", "costume"],
    suggestedUses: "Protective pads, costume props, stamps, and model parts.",
    viewsCount: 85,
  },
  {
    key: "israa-decorative-paper",
    supplierEmail: "israa@supplier.com",
    title: "Decorative Paper Assortment",
    description:
      "Decorative Paper Assortment from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "paper-cardboard",
    materialType: "Decorative Paper",
    aliases: ["Decorative Paper", "Decorative Paper Assortment"],
    quantity: 15,
    unit: "packs",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 14,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["decorative paper", "scrapbook", "craft"],
    suggestedUses: "Cards, collages, model finishing, and paper crafts.",
    viewsCount: 19,
  },
  {
    key: "israa-magazine-bundles",
    supplierEmail: "israa@supplier.com",
    title: "Old Magazine Bundles",
    description:
      "Old Magazine Bundles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "paper-cardboard",
    materialType: "Magazine Paper",
    aliases: ["Magazine Paper", "Old Magazine"],
    quantity: 20,
    unit: "bundles",
    condition: "USED",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 3,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.cardboard],
    tags: ["magazines", "collage", "recycling"],
    suggestedUses: "Collages, mood boards, paper weaving, and decoupage.",
    viewsCount: 36,
  },
  {
    key: "israa-newspaper-bundles",
    supplierEmail: "israa@supplier.com",
    title: "Clean Newspaper Bundles",
    description:
      "Clean Newspaper Bundles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "paper-cardboard",
    materialType: "Newspaper",
    aliases: ["Newspaper", "Clean Newspaper"],
    quantity: 18,
    unit: "bundles",
    condition: "USED",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 3,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cardboard],
    tags: ["newspaper", "paper mache", "recycling"],
    suggestedUses: "Paper-mâché, protective wrapping, and classroom art.",
    viewsCount: 53,
  },
  {
    key: "israa-paper-rolls",
    supplierEmail: "israa@supplier.com",
    title: "Wide Kraft Paper Rolls",
    description:
      "Wide Kraft Paper Rolls from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "paper-cardboard",
    materialType: "Kraft Paper Roll",
    aliases: ["Kraft Paper Roll", "Wide Kraft Paper Rolls"],
    quantity: 9,
    unit: "rolls",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 14,
    maxAllowedUnitPriceNis: 22,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cardboard],
    tags: ["kraft paper", "paper roll", "packaging"],
    suggestedUses: "Sketching, wrapping, pattern making, and large posters.",
    viewsCount: 70,
  },
  {
    key: "israa-shipping-boxes",
    supplierEmail: "israa@supplier.com",
    title: "Reusable Shipping Boxes",
    description:
      "Reusable Shipping Boxes from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "packaging-containers",
    materialType: "Cardboard Boxes",
    aliases: ["Cardboard Boxes", "Reusable Shipping Boxes"],
    quantity: 32,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 5,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.cardboard],
    tags: ["shipping box", "cardboard", "packaging"],
    suggestedUses: "Storage, moving, prototype enclosures, and model bases.",
    viewsCount: 87,
  },
  {
    key: "israa-egg-cartons",
    supplierEmail: "israa@supplier.com",
    title: "Clean Paper Egg Cartons",
    description:
      "Clean Paper Egg Cartons from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "paper-cardboard",
    materialType: "Egg Cartons",
    aliases: ["Egg Cartons", "Clean Paper Egg Cartons"],
    quantity: 40,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 2,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cardboard],
    tags: ["egg carton", "seed starter", "recycling"],
    suggestedUses: "Seed starters, paint palettes, sorting games, and crafts.",
    viewsCount: 21,
  },
  {
    key: "israa-plastic-bottles",
    supplierEmail: "israa@supplier.com",
    title: "Washed Clear Plastic Bottles",
    description:
      "Washed Clear Plastic Bottles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "packaging-containers",
    materialType: "Plastic Bottles",
    aliases: ["Plastic Bottles", "Washed Clear Plastic Bottles"],
    quantity: 16,
    unit: "bags",
    condition: "GOOD",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 4,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.jars],
    tags: ["plastic bottle", "recycling", "container"],
    suggestedUses: "Planters, bottle rockets, water experiments, and models.",
    viewsCount: 38,
  },
  {
    key: "israa-plastic-containers",
    supplierEmail: "israa@supplier.com",
    title: "Reusable Food-Grade Plastic Containers",
    description:
      "Reusable Food-Grade Plastic Containers from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "packaging-containers",
    materialType: "Plastic Containers",
    aliases: ["Plastic Containers", "Reusable Food-Grade Plastic Containers"],
    quantity: 18,
    unit: "sets",
    condition: "LIKE_NEW",
    sourceType: "STUDENT_LEFTOVER",
    isFree: false,
    price: 4,
    maxAllowedUnitPriceNis: 7,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.jars],
    tags: ["plastic container", "storage", "reuse"],
    suggestedUses: "Parts storage, seed trays, paint mixing, and organization.",
    viewsCount: 55,
  },
  {
    key: "israa-tin-cans",
    supplierEmail: "israa@supplier.com",
    title: "Clean Tin Can Sets",
    description:
      "Clean Tin Can Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "packaging-containers",
    materialType: "Tin Cans",
    aliases: ["Tin Cans", "Clean Tin Can"],
    quantity: 15,
    unit: "sets",
    condition: "GOOD",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 4,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.jars],
    tags: ["tin can", "metal container", "recycling"],
    suggestedUses:
      "Lanterns, pencil holders, planters, and percussion instruments.",
    viewsCount: 72,
  },
  {
    key: "israa-cork-pieces",
    supplierEmail: "israa@supplier.com",
    title: "Natural Cork Pieces",
    description:
      "Natural Cork Pieces from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Cork Pieces",
    aliases: ["Cork Pieces", "Natural Cork Pieces"],
    quantity: 12,
    unit: "bags",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 7,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["cork", "natural material", "craft"],
    suggestedUses: "Coasters, stamps, model textures, and pin boards.",
    viewsCount: 89,
  },
  {
    key: "israa-beads-assortment",
    supplierEmail: "israa@supplier.com",
    title: "Mixed Craft Beads Assortment",
    description:
      "Mixed Craft Beads Assortment from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Craft Beads",
    aliases: ["Craft Beads", "Mixed Craft Beads Assortment"],
    quantity: 10,
    unit: "boxes",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 14,
    maxAllowedUnitPriceNis: 22,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ["beads", "jewelry", "craft"],
    suggestedUses:
      "Bracelets, counting activities, decorations, and textile details.",
    viewsCount: 23,
  },
  {
    key: "israa-sequins",
    supplierEmail: "israa@supplier.com",
    title: "Sequins and Decorative Shapes Packs",
    description:
      "Sequins and Decorative Shapes Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Sequins",
    aliases: ["Sequins", "Sequins and Decorative Shapes"],
    quantity: 13,
    unit: "packs",
    condition: "NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 7,
    maxAllowedUnitPriceNis: 12,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["sequins", "decoration", "art"],
    suggestedUses: "Textile decoration, cards, masks, and collage work.",
    viewsCount: 40,
  },
  {
    key: "israa-glue-stick-packs",
    supplierEmail: "israa@supplier.com",
    title: "Craft Glue Stick Packs",
    description:
      "Craft Glue Stick Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Glue Sticks",
    aliases: ["Glue Sticks", "Craft Glue Stick"],
    quantity: 16,
    unit: "packs",
    condition: "NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 14,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["glue stick", "adhesive", "craft"],
    suggestedUses: "Cardboard models, paper crafts, and lightweight assembly.",
    viewsCount: 57,
  },
  {
    key: "israa-paint-brushes",
    supplierEmail: "israa@supplier.com",
    title: "Mixed Paint Brush Sets",
    description:
      "Mixed Paint Brush Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Paint Brushes",
    aliases: ["Paint Brushes", "Mixed Paint Brush"],
    quantity: 9,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 13,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.paint],
    tags: ["paint brush", "art tool", "craft"],
    suggestedUses: "Acrylic painting, model finishing, and classroom art.",
    viewsCount: 74,
  },
  {
    key: "israa-air-dry-clay",
    supplierEmail: "israa@supplier.com",
    title: "Air-Dry Clay Leftover Packs",
    description:
      "Air-Dry Clay Leftover Packs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Air Dry Clay",
    aliases: ["Air Dry Clay", "Air-Dry Clay Leftover"],
    quantity: 8,
    unit: "packs",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 16,
    maxAllowedUnitPriceNis: 24,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["air dry clay", "modeling", "art"],
    suggestedUses: "Small sculptures, model details, and texture experiments.",
    viewsCount: 91,
  },
  {
    key: "israa-mosaic-tiles",
    supplierEmail: "israa@supplier.com",
    title: "Mixed Mosaic Tile Offcuts",
    description:
      "Mixed Mosaic Tile Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Mosaic Tiles",
    aliases: ["Mosaic Tiles", "Mixed Mosaic Tile Offcuts"],
    quantity: 7,
    unit: "boxes",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 19,
    maxAllowedUnitPriceNis: 28,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["mosaic", "tile offcuts", "art"],
    suggestedUses: "Mosaics, coasters, frames, and decorative panels.",
    viewsCount: 25,
  },
  {
    key: "israa-silicone-molds",
    supplierEmail: "israa@supplier.com",
    title: "Reusable Silicone Mold Sets",
    description:
      "Reusable Silicone Mold Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Silicone Molds",
    aliases: ["Silicone Molds", "Reusable Silicone Mold"],
    quantity: 9,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 24,
    maxAllowedUnitPriceNis: 35,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ["silicone mold", "casting", "craft"],
    suggestedUses: "Soap, wax, clay, and supervised resin craft projects.",
    viewsCount: 42,
  },
  {
    key: "israa-resin-molds",
    supplierEmail: "israa@supplier.com",
    title: "Small Resin Casting Molds",
    description:
      "Small Resin Casting Molds from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Resin Molds",
    aliases: ["Resin Molds", "Small Resin Casting Molds"],
    quantity: 8,
    unit: "sets",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 22,
    maxAllowedUnitPriceNis: 34,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["resin mold", "casting", "craft"],
    suggestedUses:
      "Supervised casting demonstrations, keychains, and ornaments.",
    viewsCount: 59,
  },
  {
    key: "israa-gift-wrap-rolls",
    supplierEmail: "israa@supplier.com",
    title: "Partially Used Gift Wrap Rolls",
    description:
      "Partially Used Gift Wrap Rolls from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "paper-cardboard",
    materialType: "Gift Wrap Rolls",
    aliases: ["Gift Wrap Rolls", "Partially Used Gift Wrap Rolls"],
    quantity: 14,
    unit: "rolls",
    condition: "GOOD",
    sourceType: "STUDENT_LEFTOVER",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 6,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["gift wrap", "decorative paper", "reuse"],
    suggestedUses:
      "Gift boxes, model surfaces, collage, and classroom decoration.",
    viewsCount: 76,
  },
  {
    key: "israa-wooden-clothespins",
    supplierEmail: "israa@supplier.com",
    title: "Wooden Clothespin Bundles",
    description:
      "Wooden Clothespin Bundles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "art-craft-supplies",
    materialType: "Wooden Clothespins",
    aliases: ["Wooden Clothespins", "Wooden Clothespin"],
    quantity: 12,
    unit: "bundles",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 13,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ["clothespins", "wood craft", "clips"],
    suggestedUses:
      "Photo displays, simple mechanisms, classroom games, and crafts.",
    viewsCount: 93,
  },
  {
    key: "supplier-reclaimed-pallet-boards",
    supplierEmail: "supplier@supplier.com",
    title: "Reclaimed Pallet Boards",
    description:
      "Reclaimed Pallet Boards from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "wood-boards",
    materialType: "Pallet Wood Boards",
    aliases: ["Pallet Wood Boards", "Reclaimed Pallet Boards"],
    quantity: 28,
    unit: "boards",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 9,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.wood],
    tags: ["pallet wood", "reclaimed timber", "boards"],
    suggestedUses:
      "Shelves, planter boxes, signs, and rustic furniture prototypes.",
    viewsCount: 27,
  },
  {
    key: "supplier-timber-beams",
    supplierEmail: "supplier@supplier.com",
    title: "Short Reclaimed Timber Beams",
    description:
      "Short Reclaimed Timber Beams from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "wood-boards",
    materialType: "Timber Beams",
    aliases: ["Timber Beams", "Short Reclaimed Timber Beams"],
    quantity: 12,
    unit: "pieces",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 28,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.wood],
    tags: ["timber beam", "reclaimed wood", "structure"],
    suggestedUses:
      "Frames, benches, strong model bases, and workshop supports.",
    viewsCount: 44,
  },
  {
    key: "supplier-particleboard-offcuts",
    supplierEmail: "supplier@supplier.com",
    title: "Laminated Particleboard Offcuts",
    description:
      "Laminated Particleboard Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "wood-boards",
    materialType: "Particleboard Offcuts",
    aliases: ["Particleboard Offcuts", "Laminated Particleboard Offcuts"],
    quantity: 24,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.woodPanels],
    tags: ["particleboard", "offcuts", "furniture"],
    suggestedUses: "Shelves, boxes, templates, and indoor prototypes.",
    viewsCount: 61,
  },
  {
    key: "supplier-veneer-sheets",
    supplierEmail: "supplier@supplier.com",
    title: "Natural Wood Veneer Sheets",
    description:
      "Natural Wood Veneer Sheets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "wood-boards",
    materialType: "Wood Veneer",
    aliases: ["Wood Veneer", "Natural Wood Veneer Sheets"],
    quantity: 18,
    unit: "sheets",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 11,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.woodPanels],
    tags: ["wood veneer", "finish", "sheet"],
    suggestedUses: "Decorative surfaces, model furniture, and repair practice.",
    viewsCount: 78,
  },
  {
    key: "supplier-wooden-dowels",
    supplierEmail: "supplier@supplier.com",
    title: "Wooden Dowel Rod Bundles",
    description:
      "Wooden Dowel Rod Bundles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "wood-boards",
    materialType: "Wooden Dowels",
    aliases: ["Wooden Dowels", "Wooden Dowel Rod"],
    quantity: 20,
    unit: "bundles",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 14,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.wood],
    tags: ["wooden dowel", "rod", "joinery"],
    suggestedUses:
      "Axles, frames, joints, birdhouses, and classroom structures.",
    viewsCount: 12,
  },
  {
    key: "supplier-wood-blocks",
    supplierEmail: "supplier@supplier.com",
    title: "Mixed Small Wood Blocks",
    description:
      "Mixed Small Wood Blocks from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "wood-boards",
    materialType: "Wood Blocks",
    aliases: ["Wood Blocks", "Mixed Small Wood Blocks"],
    quantity: 16,
    unit: "boxes",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 7,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.wood],
    tags: ["wood blocks", "offcuts", "model"],
    suggestedUses:
      "Carving practice, toy prototypes, stands, and support blocks.",
    viewsCount: 29,
  },
  {
    key: "supplier-sandpaper-sheets",
    supplierEmail: "supplier@supplier.com",
    title: "Mixed-Grit Sandpaper Sheets",
    description:
      "Mixed-Grit Sandpaper Sheets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Sandpaper",
    aliases: ["Sandpaper", "Mixed-Grit Sandpaper Sheets"],
    quantity: 15,
    unit: "packs",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["sandpaper", "finishing", "woodworking"],
    suggestedUses:
      "Smoothing wood, plastic edges, and preparing painted surfaces.",
    viewsCount: 46,
  },
  {
    key: "supplier-wood-glue-bottles",
    supplierEmail: "supplier@supplier.com",
    title: "Partially Used Wood Glue Bottles",
    description:
      "Partially Used Wood Glue Bottles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Wood Glue",
    aliases: ["Wood Glue", "Partially Used Wood Glue Bottles"],
    quantity: 8,
    unit: "bottles",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["wood glue", "adhesive", "woodworking"],
    suggestedUses: "Small furniture, phone stands, boxes, and wood repairs.",
    viewsCount: 63,
  },
  {
    key: "supplier-colored-acrylic-sheets",
    supplierEmail: "supplier@supplier.com",
    title: "Colored Acrylic Sheet Offcuts",
    description:
      "Colored Acrylic Sheet Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "plastics-acrylic",
    materialType: "Colored Acrylic Sheet",
    aliases: ["Colored Acrylic Sheet", "Colored Acrylic Sheet Offcuts"],
    quantity: 19,
    unit: "sheets",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 20,
    maxAllowedUnitPriceNis: 30,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.acrylic],
    tags: ["colored acrylic", "plastic sheet", "display"],
    suggestedUses:
      "Signs, decorative panels, enclosures, and light experiments.",
    viewsCount: 80,
  },
  {
    key: "supplier-polycarbonate-sheets",
    supplierEmail: "supplier@supplier.com",
    title: "Clear Polycarbonate Offcuts",
    description:
      "Clear Polycarbonate Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "plastics-acrylic",
    materialType: "Polycarbonate Sheet",
    aliases: ["Polycarbonate Sheet", "Clear Polycarbonate Offcuts"],
    quantity: 13,
    unit: "sheets",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 26,
    maxAllowedUnitPriceNis: 38,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.acrylic],
    tags: ["polycarbonate", "clear sheet", "durable plastic"],
    suggestedUses:
      "Protective covers, greenhouse panels, and durable enclosures.",
    viewsCount: 14,
  },
  {
    key: "supplier-hdpe-sheets",
    supplierEmail: "supplier@supplier.com",
    title: "HDPE Plastic Sheet Offcuts",
    description:
      "HDPE Plastic Sheet Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "plastics-acrylic",
    materialType: "HDPE Sheet",
    aliases: ["HDPE Sheet", "HDPE Plastic Sheet Offcuts"],
    quantity: 15,
    unit: "sheets",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 14,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.acrylic],
    tags: ["hdpe", "plastic sheet", "offcuts"],
    suggestedUses: "Cutting boards, durable bases, and outdoor prototypes.",
    viewsCount: 31,
  },
  {
    key: "supplier-plastic-crates",
    supplierEmail: "supplier@supplier.com",
    title: "Stackable Plastic Crates",
    description:
      "Stackable Plastic Crates from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "packaging-containers",
    materialType: "Plastic Crates",
    aliases: ["Plastic Crates", "Stackable Plastic Crates"],
    quantity: 20,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.jars],
    tags: ["plastic crate", "storage", "container"],
    suggestedUses:
      "Mobile storage, material sorting, and workshop organization.",
    viewsCount: 48,
  },
  {
    key: "supplier-storage-baskets",
    supplierEmail: "supplier@supplier.com",
    title: "Reusable Storage Baskets",
    description:
      "Reusable Storage Baskets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "packaging-containers",
    materialType: "Storage Baskets",
    aliases: ["Storage Baskets", "Reusable Storage Baskets"],
    quantity: 18,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.jars],
    tags: ["basket", "storage", "organization"],
    suggestedUses: "Parts organization, classroom supplies, and project kits.",
    viewsCount: 65,
  },
  {
    key: "supplier-plastic-trays",
    supplierEmail: "supplier@supplier.com",
    title: "Shallow Plastic Parts Trays",
    description:
      "Shallow Plastic Parts Trays from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "packaging-containers",
    materialType: "Plastic Trays",
    aliases: ["Plastic Trays", "Shallow Plastic Parts Trays"],
    quantity: 16,
    unit: "sets",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.jars],
    tags: ["parts tray", "plastic", "storage"],
    suggestedUses:
      "Sorting screws, electronics components, paint, and craft items.",
    viewsCount: 82,
  },
  {
    key: "supplier-aluminum-sheets",
    supplierEmail: "supplier@supplier.com",
    title: "Thin Aluminum Sheet Offcuts",
    description:
      "Thin Aluminum Sheet Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "metal-fasteners",
    materialType: "Aluminum Sheet",
    aliases: ["Aluminum Sheet", "Thin Aluminum Sheet Offcuts"],
    quantity: 17,
    unit: "sheets",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 28,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.metal],
    tags: ["aluminum sheet", "metal", "offcut"],
    suggestedUses:
      "Robot chassis, brackets, signs, and lightweight structures.",
    viewsCount: 16,
  },
  {
    key: "supplier-steel-plates",
    supplierEmail: "supplier@supplier.com",
    title: "Small Mild-Steel Plate Offcuts",
    description:
      "Small Mild-Steel Plate Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "metal-fasteners",
    materialType: "Steel Plate",
    aliases: ["Steel Plate", "Small Mild-Steel Plate Offcuts"],
    quantity: 11,
    unit: "pieces",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 22,
    maxAllowedUnitPriceNis: 34,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.metal],
    tags: ["steel plate", "metal offcut", "fabrication"],
    suggestedUses:
      "Weighted bases, brackets, supervised metalwork, and fixtures.",
    viewsCount: 33,
  },
  {
    key: "supplier-metal-rods",
    supplierEmail: "supplier@supplier.com",
    title: "Mixed Metal Rod Sections",
    description:
      "Mixed Metal Rod Sections from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "metal-fasteners",
    materialType: "Metal Rods",
    aliases: ["Metal Rods", "Mixed Metal Rod Sections"],
    quantity: 21,
    unit: "pieces",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.metal],
    tags: ["metal rod", "shaft", "structure"],
    suggestedUses: "Axles, frames, stands, and mechanical demonstrations.",
    viewsCount: 50,
  },
  {
    key: "supplier-wire-mesh",
    supplierEmail: "supplier@supplier.com",
    title: "Galvanized Wire Mesh Offcuts",
    description:
      "Galvanized Wire Mesh Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "metal-fasteners",
    materialType: "Wire Mesh",
    aliases: ["Wire Mesh", "Galvanized Wire Mesh Offcuts"],
    quantity: 12,
    unit: "sheets",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 15,
    maxAllowedUnitPriceNis: 24,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.metal],
    tags: ["wire mesh", "metal grid", "offcuts"],
    suggestedUses: "Ventilation covers, plant supports, sieves, and models.",
    viewsCount: 67,
  },
  {
    key: "supplier-bolts-washers",
    supplierEmail: "supplier@supplier.com",
    title: "Bolts, Nuts, and Washer Assortments",
    description:
      "Bolts, Nuts, and Washer Assortments from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "metal-fasteners",
    materialType: "Bolts and Washers",
    aliases: ["Bolts and Washers", "Bolts, Nuts, and Washer Assortments"],
    quantity: 14,
    unit: "boxes",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 16,
    maxAllowedUnitPriceNis: 24,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["bolts", "washers", "fasteners"],
    suggestedUses:
      "Reusable joints, frames, tool repairs, and prototype assembly.",
    viewsCount: 84,
  },
  {
    key: "supplier-angle-brackets",
    supplierEmail: "supplier@supplier.com",
    title: "Small Metal Angle Brackets",
    description:
      "Small Metal Angle Brackets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "metal-fasteners",
    materialType: "Angle Brackets",
    aliases: ["Angle Brackets", "Small Metal Angle Brackets"],
    quantity: 18,
    unit: "packs",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 10,
    maxAllowedUnitPriceNis: 16,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["angle bracket", "hardware", "fastener"],
    suggestedUses:
      "Shelves, wooden boxes, frames, and structural reinforcement.",
    viewsCount: 18,
  },
  {
    key: "supplier-drawer-slides",
    supplierEmail: "supplier@supplier.com",
    title: "Short Drawer Slide Pairs",
    description:
      "Short Drawer Slide Pairs from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Drawer Slides",
    aliases: ["Drawer Slides", "Short Drawer Slide Pairs"],
    quantity: 9,
    unit: "pairs",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 24,
    maxAllowedUnitPriceNis: 36,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.tools],
    tags: ["drawer slide", "linear motion", "hardware"],
    suggestedUses: "Sliding trays, tool drawers, and motion demonstrations.",
    viewsCount: 35,
  },
  {
    key: "supplier-caster-wheels",
    supplierEmail: "supplier@supplier.com",
    title: "Small Swivel Caster Wheels",
    description:
      "Small Swivel Caster Wheels from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "motors-mechanical",
    materialType: "Caster Wheels",
    aliases: ["Caster Wheels", "Small Swivel Caster Wheels"],
    quantity: 12,
    unit: "sets",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 28,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ["caster wheel", "swivel wheel", "mobility"],
    suggestedUses: "Rolling crates, carts, mobile stands, and robot supports.",
    viewsCount: 52,
  },
  {
    key: "supplier-springs-assortment",
    supplierEmail: "supplier@supplier.com",
    title: "Compression and Extension Spring Sets",
    description:
      "Compression and Extension Spring Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "motors-mechanical",
    materialType: "Spring Assortment",
    aliases: ["Spring Assortment", "Compression and Extension Spring"],
    quantity: 10,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 13,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ["spring", "mechanical", "motion"],
    suggestedUses:
      "Mechanism experiments, return systems, and model suspensions.",
    viewsCount: 69,
  },
  {
    key: "supplier-bearings",
    supplierEmail: "supplier@supplier.com",
    title: "Small Ball Bearing Assortments",
    description:
      "Small Ball Bearing Assortments from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "motors-mechanical",
    materialType: "Ball Bearings",
    aliases: ["Ball Bearings", "Small Ball Bearing Assortments"],
    quantity: 8,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 22,
    maxAllowedUnitPriceNis: 34,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.motors],
    tags: ["bearing", "rotation", "mechanical"],
    suggestedUses:
      "Wheels, rotating displays, shafts, and low-friction mechanisms.",
    viewsCount: 86,
  },
  {
    key: "supplier-gears",
    supplierEmail: "supplier@supplier.com",
    title: "Mixed Plastic and Metal Gear Sets",
    description:
      "Mixed Plastic and Metal Gear Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "motors-mechanical",
    materialType: "Gear Set",
    aliases: ["Gear Set", "Mixed Plastic and Metal Gear"],
    quantity: 11,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 19,
    maxAllowedUnitPriceNis: 30,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ["gears", "transmission", "mechanical"],
    suggestedUses:
      "Mechanical ratios, robot drives, and motion demonstrations.",
    viewsCount: 20,
  },
  {
    key: "supplier-pulleys",
    supplierEmail: "supplier@supplier.com",
    title: "Small Pulley Wheel Sets",
    description:
      "Small Pulley Wheel Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "motors-mechanical",
    materialType: "Pulley Set",
    aliases: ["Pulley Set", "Small Pulley Wheel"],
    quantity: 10,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 15,
    maxAllowedUnitPriceNis: 24,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ["pulley", "lift", "mechanical"],
    suggestedUses:
      "Simple machines, lifting demonstrations, and cable routing.",
    viewsCount: 37,
  },
  {
    key: "supplier-chain-links",
    supplierEmail: "supplier@supplier.com",
    title: "Short Roller Chain Sections",
    description:
      "Short Roller Chain Sections from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "motors-mechanical",
    materialType: "Roller Chain",
    aliases: ["Roller Chain", "Short Roller Chain Sections"],
    quantity: 7,
    unit: "pieces",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 30,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.metal],
    tags: ["chain", "drive system", "mechanical"],
    suggestedUses:
      "Drive demonstrations, kinetic art, and supervised mechanisms.",
    viewsCount: 54,
  },
  {
    key: "supplier-rubber-belts",
    supplierEmail: "supplier@supplier.com",
    title: "Mixed Rubber Drive Belts",
    description:
      "Mixed Rubber Drive Belts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "motors-mechanical",
    materialType: "Rubber Drive Belts",
    aliases: ["Rubber Drive Belts", "Mixed Rubber Drive Belts"],
    quantity: 9,
    unit: "bundles",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 14,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ["belt drive", "rubber belt", "mechanical"],
    suggestedUses:
      "Pulley systems, small machines, and motion-transfer prototypes.",
    viewsCount: 71,
  },
  {
    key: "supplier-clamps",
    supplierEmail: "supplier@supplier.com",
    title: "Small Workshop Clamp Sets",
    description:
      "Small Workshop Clamp Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Workshop Clamps",
    aliases: ["Workshop Clamps", "Small Workshop Clamp"],
    quantity: 8,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 28,
    maxAllowedUnitPriceNis: 42,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["clamp", "woodworking", "tool"],
    suggestedUses:
      "Holding wood, acrylic, and glued assemblies during fabrication.",
    viewsCount: 88,
  },
  {
    key: "supplier-screwdrivers",
    supplierEmail: "supplier@supplier.com",
    title: "Mixed Screwdriver Sets",
    description:
      "Mixed Screwdriver Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Screwdriver Set",
    aliases: ["Screwdriver Set", "Mixed Screwdriver"],
    quantity: 9,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 24,
    maxAllowedUnitPriceNis: 36,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.tools],
    tags: ["screwdriver", "hand tool", "repair"],
    suggestedUses:
      "Assembly, electronics enclosures, furniture, and repair workshops.",
    viewsCount: 22,
  },
  {
    key: "supplier-hammers",
    supplierEmail: "supplier@supplier.com",
    title: "Small Claw Hammers",
    description:
      "Small Claw Hammers from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Claw Hammer",
    aliases: ["Claw Hammer", "Small Claw Hammers"],
    quantity: 7,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 22,
    maxAllowedUnitPriceNis: 34,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["hammer", "hand tool", "woodworking"],
    suggestedUses: "Wood assembly, nail removal, and basic workshop practice.",
    viewsCount: 39,
  },
  {
    key: "supplier-pliers",
    supplierEmail: "supplier@supplier.com",
    title: "Combination Pliers Sets",
    description:
      "Combination Pliers Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Pliers",
    aliases: ["Pliers", "Combination Pliers"],
    quantity: 10,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 20,
    maxAllowedUnitPriceNis: 32,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["pliers", "hand tool", "wire"],
    suggestedUses: "Wire bending, gripping, repair, and electronics work.",
    viewsCount: 56,
  },
  {
    key: "supplier-measuring-tapes",
    supplierEmail: "supplier@supplier.com",
    title: "Five-Meter Measuring Tapes",
    description:
      "Five-Meter Measuring Tapes from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Measuring Tape",
    aliases: ["Measuring Tape", "Five-Meter Measuring Tapes"],
    quantity: 12,
    unit: "pieces",
    condition: "LIKE_NEW",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.tools],
    tags: ["measuring tape", "measurement", "tool"],
    suggestedUses: "Accurate project planning, woodworking, and layout tasks.",
    viewsCount: 73,
  },
  {
    key: "supplier-spirit-levels",
    supplierEmail: "supplier@supplier.com",
    title: "Compact Spirit Levels",
    description:
      "Compact Spirit Levels from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Spirit Level",
    aliases: ["Spirit Level", "Compact Spirit Levels"],
    quantity: 8,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 28,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["spirit level", "measurement", "tool"],
    suggestedUses:
      "Shelf installation, frame alignment, and construction models.",
    viewsCount: 90,
  },
  {
    key: "supplier-hand-saws",
    supplierEmail: "supplier@supplier.com",
    title: "Small Hand Saws",
    description:
      "Small Hand Saws from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Hand Saw",
    aliases: ["Hand Saw", "Small Hand Saws"],
    quantity: 6,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 32,
    maxAllowedUnitPriceNis: 48,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["hand saw", "woodworking", "cutting"],
    suggestedUses: "Supervised wood cutting, dowel trimming, and small builds.",
    viewsCount: 24,
  },
  {
    key: "supplier-paint-rollers",
    supplierEmail: "supplier@supplier.com",
    title: "Small Paint Roller Sets",
    description:
      "Small Paint Roller Sets from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "tools-hardware",
    materialType: "Paint Rollers",
    aliases: ["Paint Rollers", "Small Paint Roller"],
    quantity: 9,
    unit: "sets",
    condition: "GOOD",
    sourceType: "WORKSHOP_SURPLUS",
    isFree: false,
    price: 14,
    maxAllowedUnitPriceNis: 22,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.paint],
    tags: ["paint roller", "finishing", "tool"],
    suggestedUses: "Painting boards, models, signs, and reclaimed furniture.",
    viewsCount: 41,
  },
  {
    key: "supplier-ceramic-tiles",
    supplierEmail: "supplier@supplier.com",
    title: "Mixed Ceramic Tile Offcuts",
    description:
      "Mixed Ceramic Tile Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "other-reusable",
    materialType: "Ceramic Tile Offcuts",
    aliases: ["Ceramic Tile Offcuts", "Mixed Ceramic Tile Offcuts"],
    quantity: 13,
    unit: "boxes",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ["ceramic tile", "offcuts", "mosaic"],
    suggestedUses: "Mosaics, coasters, sample boards, and decorative surfaces.",
    viewsCount: 58,
  },
  {
    key: "supplier-pvc-conduits",
    supplierEmail: "supplier@supplier.com",
    title: "Electrical PVC Conduit Offcuts",
    description:
      "Electrical PVC Conduit Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "plastics-acrylic",
    materialType: "PVC Conduit",
    aliases: ["PVC Conduit", "Electrical PVC Conduit Offcuts"],
    quantity: 24,
    unit: "pieces",
    condition: "USED",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.pipes],
    tags: ["pvc conduit", "tube", "structure"],
    suggestedUses:
      "Cable routing, model frames, plant supports, and mechanisms.",
    viewsCount: 75,
  },
  {
    key: "supplier-insulation-foam",
    supplierEmail: "supplier@supplier.com",
    title: "Rigid Insulation Foam Offcuts",
    description:
      "Rigid Insulation Foam Offcuts from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "plastics-acrylic",
    materialType: "Insulation Foam",
    aliases: ["Insulation Foam", "Rigid Insulation Foam Offcuts"],
    quantity: 18,
    unit: "pieces",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 9,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ["insulation foam", "model foam", "offcuts"],
    suggestedUses:
      "Terrain models, insulation experiments, and lightweight mockups.",
    viewsCount: 92,
  },
  {
    key: "supplier-nylon-rope",
    supplierEmail: "supplier@supplier.com",
    title: "Nylon Rope Offcut Bundles",
    description:
      "Nylon Rope Offcut Bundles from a documented local surplus batch. Items were sorted, checked for obvious damage, and grouped for practical learner use.",
    categoryKey: "other-reusable",
    materialType: "Nylon Rope",
    aliases: ["Nylon Rope", "Nylon Rope Offcut"],
    quantity: 11,
    unit: "bundles",
    condition: "GOOD",
    sourceType: "FACTORY_SURPLUS",
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ["rope", "cord", "reuse"],
    suggestedUses:
      "Pulley projects, handles, tying practice, and outdoor models.",
    viewsCount: 26,
  },
];

const MATERIALS: MaterialSeed[] = [...CORE_MATERIALS, ...ADDITIONAL_MATERIALS];

const PROJECT_BUDGET_DEMO_MATERIAL_KEYS = [
  'majd-arduino-student-salvage',
  'majd-arduino-uno-r3',
  'majd-ultrasonic-free-lab',
  'majd-ultrasonic-hcsr04',
  'majd-dc-motors-surplus',
  'majd-dc-gear-motors',
  'majd-jumper-wires-free-pieces',
  'majd-jumper-wires',
] as const;

const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const assertLocalDatabaseHost = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for project budget demo seeding.');
  }

  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error('DATABASE_URL must be a valid URL for project budget demo seeding.');
  }

  if (!LOCAL_DATABASE_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing project budget demo seed on non-local database host "${hostname}".`,
    );
  }
};

const findCategoryIdBySeedKey = async (categoryKey: string): Promise<string> => {
  const categorySeed = MATERIAL_CATEGORIES.find((category) => category.key === categoryKey);
  if (!categorySeed) {
    throw new Error(`Missing material category seed definition for ${categoryKey}.`);
  }

  const category = await prisma.category.findFirst({
    where: {
      nameEn: categorySeed.nameEn,
      categoryType: { in: ['MATERIAL', 'BOTH'] },
      isActive: true,
    },
    select: { id: true },
  });

  if (!category) {
    throw new Error(
      `Missing active material category "${categorySeed.nameEn}" required for project budget demo seeding.`,
    );
  }

  return category.id;
};

const findExistingMaterialTypeInfo = async (input: {
  categoryId: string;
  material: MaterialSeed;
}) => {
  const normalizedName = normalizeSearchText(input.material.materialType);
  const existing = await prisma.materialType.findFirst({
    where: {
      categoryId: input.categoryId,
      normalizedName,
      isActive: true,
    },
    select: { id: true },
  });

  if (existing) {
    return { materialTypeId: existing.id, priceRuleId: null as string | null };
  }

  const fallbackContext: SeedContext = {
    users: new Map(),
    suppliers: new Map(),
    drivers: new Map(),
    categories: new Map([[input.material.categoryKey, input.categoryId]]),
    materials: new Map(),
    materialTypes: new Map(),
    projects: new Map(),
    reservations: new Map(),
    learnerDropoffs: new Map(),
  };

  return ensureMaterialTypeWithPriceRule(fallbackContext, input.material);
};

const upsertProjectBudgetDemoMaterial = async (input: {
  supplier: { userId: string; profileId: string; pickupLocationId: string };
  categoryId: string;
  material: MaterialSeed;
}) => {
  input.material.imageUrls.forEach((url, index) =>
    assertImage(`${input.material.title} image ${index + 1}`, url),
  );

  const typeInfo = await findExistingMaterialTypeInfo({
    categoryId: input.categoryId,
    material: input.material,
  });

  const existing = await prisma.material.findFirst({
    where: {
      ownerId: input.supplier.userId,
      title: input.material.title,
    },
    select: { id: true },
  });

  const materialData = {
    ownerId: input.supplier.userId,
    supplierProfileId: input.supplier.profileId,
    categoryId: input.categoryId,
    materialTypeId: typeInfo.materialTypeId,
    priceRuleId: typeInfo.priceRuleId,
    title: input.material.title,
    description: input.material.description,
    materialType: input.material.materialType,
    quantity: input.material.quantity,
    unit: input.material.unit,
    condition: input.material.condition,
    sourceType: input.material.sourceType,
    status: 'AVAILABLE' as const,
    isFree: input.material.isFree,
    price: input.material.price,
    currency: CURRENCY,
    locationId: input.supplier.pickupLocationId,
    pickupAllowed: input.material.pickupAllowed,
    deliveryAllowed: input.material.deliveryAllowed,
    pickupNotes: 'Pickup details are confirmed after reservation acceptance.',
    suggestedUses: input.material.suggestedUses,
    viewsCount: input.material.viewsCount,
  };

  if (existing) {
    await prisma.material.update({
      where: { id: existing.id },
      data: materialData,
    });
    return { id: existing.id, created: false, key: input.material.key };
  }

  const created = await prisma.material.create({
    data: {
      ...materialData,
      images: {
        create: input.material.imageUrls.map((imageUrl, index) => ({
          imageUrl,
          sortOrder: index,
          isCover: index === 0,
        })),
      },
      tags: {
        create: input.material.tags.map((tag) => ({ tag })),
      },
    },
    select: { id: true },
  });

  return { id: created.id, created: true, key: input.material.key };
};

const seedProjectBudgetDemo = async () => {
  assertLocalDatabaseHost();

  const supplierUser = await prisma.user.findUnique({
    where: { email: 'majd@supplier.com' },
    select: {
      id: true,
      supplierProfile: {
        select: {
          id: true,
          defaultPickupLocationId: true,
        },
      },
    },
  });

  if (!supplierUser?.supplierProfile?.defaultPickupLocationId) {
    throw new Error(
      'Missing majd@supplier.com supplier profile or pickup location required for project budget demo seeding.',
    );
  }

  const project = await prisma.learningProject.findFirst({
    where: {
      title: 'Obstacle Avoidance Robot',
      status: 'PUBLISHED',
      hiddenAt: null,
      archivedAt: null,
    },
    select: { id: true, title: true },
  });

  if (!project) {
    throw new Error(
      'Missing published project "Obstacle Avoidance Robot" required for project budget demo seeding.',
    );
  }

  const supplier = {
    userId: supplierUser.id,
    profileId: supplierUser.supplierProfile.id,
    pickupLocationId: supplierUser.supplierProfile.defaultPickupLocationId,
  };

  const categoryIds = new Map<string, string>();
  for (const categoryKey of new Set(
    PROJECT_BUDGET_DEMO_MATERIAL_KEYS.map(
      (key) => MATERIALS.find((material) => material.key === key)?.categoryKey,
    ).filter((value): value is string => Boolean(value)),
  )) {
    categoryIds.set(categoryKey, await findCategoryIdBySeedKey(categoryKey));
  }

  const results = [];
  for (const materialKey of PROJECT_BUDGET_DEMO_MATERIAL_KEYS) {
    const material = MATERIALS.find((entry) => entry.key === materialKey);
    if (!material) {
      throw new Error(`Missing demo material seed definition for ${materialKey}.`);
    }

    const categoryId = categoryIds.get(material.categoryKey);
    if (!categoryId) {
      throw new Error(`Missing category mapping for demo material ${materialKey}.`);
    }

    results.push(
      await upsertProjectBudgetDemoMaterial({
        supplier,
        categoryId,
        material,
      }),
    );
  }

  const materialIds = results.map((result) => result.id);
  const uniqueMaterialIds = new Set(materialIds);

  return {
    mode: 'project-budget-demo',
    projectId: project.id,
    projectTitle: project.title,
    demoMaterialCount: uniqueMaterialIds.size,
    createdCount: results.filter((result) => result.created).length,
    updatedCount: results.filter((result) => !result.created).length,
    materialKeys: results.map((result) => result.key),
    materialIds: [...uniqueMaterialIds],
  };
};

type ProjectSeed = {
  key: string;
  authorEmail: string;
  title: string;
  shortDescription: string;
  description: string;
  categoryKey: (typeof PROJECT_CATEGORIES)[number]["key"];
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  estimatedDurationMinutes: number;
  coverImageUrl: string;
  status: "PUBLISHED" | "PENDING_REVIEW";
  components: Array<{
    name: string;
    materialType: string;
    categoryKey?: (typeof MATERIAL_CATEGORIES)[number]["key"];
    quantity: number;
    unit: string;
    role: "REQUIRED_MATERIAL" | "OPTIONAL_MATERIAL" | "TOOL" | "CONSUMABLE";
    required: boolean;
    substitute: boolean;
    keywords: string[];
    alternatives?: string[];
    notes?: string;
  }>;
  steps: Array<{ title: string; description: string; imageUrl?: string }>;
  links: Array<{
    linkType: "ARTICLE" | "YOUTUBE" | "OTHER";
    url: string;
    title: string;
    sourceName: string;
  }>;
  tags: string[];
};

const CORE_PROJECTS: ProjectSeed[] = [
  {
    key: "obstacle-avoidance-robot",
    authorEmail: "majd@learner.com",
    title: "Obstacle Avoidance Robot",
    shortDescription:
      "Build a small robot that detects obstacles and turns away automatically.",
    description:
      "A robotics project that connects Arduino, ultrasonic sensing, motors, wiring, and reusable wheels into a working obstacle avoidance robot. It is designed to show how surplus electronics can become a complete learning build.",
    categoryKey: "robotics",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 240,
    coverImageUrl: IMAGES.robotProject,
    status: "PUBLISHED",
    components: [
      {
        name: "Arduino board",
        materialType: "Arduino Uno",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["arduino", "microcontroller", "uno"],
        alternatives: ["ESP32", "Arduino Nano"],
      },
      {
        name: "Ultrasonic distance sensor",
        materialType: "Ultrasonic Sensor",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["ultrasonic", "distance sensor", "hc-sr04"],
      },
      {
        name: "DC gear motors",
        materialType: "DC Motor",
        categoryKey: "motors-mechanical",
        quantity: 2,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["dc motor", "gear motor", "robot motor"],
      },
      {
        name: "Jumper wires",
        materialType: "Jumper Wires",
        categoryKey: "electronics-components",
        quantity: 12,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["jumper wires", "dupont wires"],
      },
      {
        name: "Rubber wheels",
        materialType: "Rubber Wheels",
        categoryKey: "motors-mechanical",
        quantity: 2,
        unit: "pieces",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["robot wheels", "rubber wheels"],
      },
    ],
    steps: [
      {
        title: "Prepare the base",
        description: "Choose a flat base and mark motor and wheel positions.",
      },
      {
        title: "Mount motors and wheels",
        description:
          "Attach the two motors securely and make sure wheels spin freely.",
      },
      {
        title: "Wire Arduino and sensor",
        description:
          "Connect the ultrasonic sensor and motor driver carefully to the Arduino.",
      },
      {
        title: "Upload and test logic",
        description:
          "Upload the test code, then tune turning behavior after obstacle detection.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.arduino.cc/en/Tutorial/HomePage",
        title: "Arduino tutorials",
        sourceName: "Arduino",
      },
    ],
    tags: ["robotics", "arduino", "sensors"],
  },
  {
    key: "simple-led-circuit",
    authorEmail: "majd@learner.com",
    title: "Simple LED Circuit",
    shortDescription:
      "Learn current flow by building a safe LED circuit on a breadboard.",
    description:
      "A beginner electronics project using a breadboard, LED, resistor, jumper wires, and battery holder. It teaches polarity, resistance, and safe circuit testing.",
    categoryKey: "electronics-learning",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 60,
    coverImageUrl: IMAGES.electronics,
    status: "PUBLISHED",
    components: [
      {
        name: "Breadboard",
        materialType: "Breadboard",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["breadboard", "prototype board"],
      },
      {
        name: "LED",
        materialType: "LED Pack",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["led", "light emitting diode"],
      },
      {
        name: "Resistor",
        materialType: "Resistor Pack",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["resistor", "220 ohm"],
      },
      {
        name: "Battery holder",
        materialType: "Battery Holder",
        categoryKey: "power-batteries",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["battery holder", "battery clip"],
      },
    ],
    steps: [
      {
        title: "Place the LED",
        description:
          "Put the LED legs in separate breadboard rows and identify polarity.",
      },
      {
        title: "Add resistor in series",
        description: "Connect a resistor to protect the LED from high current.",
      },
      {
        title: "Connect power",
        description:
          "Use the battery holder and jumper wires to complete the circuit.",
      },
      {
        title: "Test safely",
        description:
          "Check that the LED lights without overheating the resistor.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.arduino.cc/en/Tutorial/BuiltInExamples/Blink",
        title: "Blink circuit reference",
        sourceName: "Arduino",
      },
    ],
    tags: ["electronics", "beginner", "led"],
  },
  {
    key: "recycled-desk-organizer",
    authorEmail: "israa@learner.com",
    title: "Recycled Cardboard Desk Organizer",
    shortDescription: "Turn packaging cardboard into a useful desk organizer.",
    description:
      "A recycling craft project that transforms cardboard sheets and tubes into a practical organizer for pens, tools, and notes.",
    categoryKey: "recycling-crafts",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 90,
    coverImageUrl: IMAGES.cardboard,
    status: "PUBLISHED",
    components: [
      {
        name: "Cardboard sheets",
        materialType: "Cardboard Sheets",
        categoryKey: "paper-cardboard",
        quantity: 3,
        unit: "sheets",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["cardboard", "carton sheets"],
      },
      {
        name: "Cardboard tubes",
        materialType: "Cardboard Tubes",
        categoryKey: "paper-cardboard",
        quantity: 2,
        unit: "pieces",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["cardboard tubes", "paper tubes"],
      },
      {
        name: "Acrylic paint",
        materialType: "Acrylic Paint",
        categoryKey: "art-craft-supplies",
        quantity: 1,
        unit: "set",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["paint", "acrylic paint"],
      },
    ],
    steps: [
      {
        title: "Sketch compartments",
        description: "Plan the organizer size and mark cardboard pieces.",
      },
      {
        title: "Cut panels",
        description:
          "Cut side panels, base, and separators with straight edges.",
      },
      {
        title: "Assemble structure",
        description: "Glue the frame first, then add internal dividers.",
      },
      {
        title: "Decorate and dry",
        description: "Paint or cover the organizer and let it dry fully.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.wikihow.com/Make-a-Cardboard-Organizer",
        title: "Cardboard organizer ideas",
        sourceName: "wikiHow",
      },
    ],
    tags: ["cardboard", "recycling", "organizer"],
  },
  {
    key: "mini-wooden-phone-stand",
    authorEmail: "learner@learner.com",
    title: "Mini Wooden Phone Stand",
    shortDescription: "Make a simple phone stand from reclaimed wood pieces.",
    description:
      "A woodworking starter project using plywood, MDF offcuts, and basic hardware. It is small enough for learners to finish quickly while practicing measuring and sanding.",
    categoryKey: "woodworking",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 80,
    coverImageUrl: IMAGES.woodPanels,
    status: "PUBLISHED",
    components: [
      {
        name: "Plywood panel",
        materialType: "Plywood Sheet",
        categoryKey: "wood-boards",
        quantity: 1,
        unit: "panel",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["plywood", "wood panel"],
      },
      {
        name: "MDF offcut",
        materialType: "MDF Offcuts",
        categoryKey: "wood-boards",
        quantity: 1,
        unit: "piece",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["mdf", "wood offcut"],
      },
      {
        name: "Small screws",
        materialType: "Screws and Nuts",
        categoryKey: "metal-fasteners",
        quantity: 4,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["screws", "fasteners"],
      },
    ],
    steps: [
      {
        title: "Measure phone size",
        description: "Mark a base and back support that fit the phone width.",
      },
      {
        title: "Cut wood pieces",
        description: "Cut the pieces carefully and test the support angle.",
      },
      {
        title: "Sand edges",
        description: "Smooth all corners so the stand is safe to handle.",
      },
      {
        title: "Assemble stand",
        description:
          "Screw or glue the support to the base and test stability.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/Wooden-Phone-Stand/",
        title: "Wooden phone stand reference",
        sourceName: "Instructables",
      },
    ],
    tags: ["wood", "phone stand", "reuse"],
  },
  {
    key: "mini-greenhouse-prototype",
    authorEmail: "learner@learner.com",
    title: "Mini Greenhouse Prototype",
    shortDescription:
      "Build a small greenhouse model using acrylic sheets and PVC pieces.",
    description:
      "A home experiment project showing how transparent acrylic, PVC pipes, hinges, and screws can become a small greenhouse prototype for plant experiments.",
    categoryKey: "home-experiments",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 180,
    coverImageUrl: IMAGES.greenhouse,
    status: "PUBLISHED",
    components: [
      {
        name: "Clear acrylic sheets",
        materialType: "Acrylic Sheet",
        categoryKey: "plastics-acrylic",
        quantity: 3,
        unit: "sheets",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["acrylic", "clear sheet", "plexiglass"],
      },
      {
        name: "PVC pipe pieces",
        materialType: "PVC Pipes",
        categoryKey: "plastics-acrylic",
        quantity: 4,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["pvc", "plastic pipes"],
      },
      {
        name: "Small hinges",
        materialType: "Small Hinges",
        categoryKey: "tools-hardware",
        quantity: 2,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["hinges", "door hinge"],
      },
      {
        name: "Screws and nuts",
        materialType: "Screws and Nuts",
        categoryKey: "metal-fasteners",
        quantity: 8,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["screws", "nuts", "fasteners"],
      },
    ],
    steps: [
      {
        title: "Build PVC frame",
        description:
          "Cut and arrange PVC pieces as a simple rectangular frame.",
      },
      {
        title: "Attach acrylic sides",
        description:
          "Fix clear acrylic sheets to the frame using screws or clips.",
      },
      {
        title: "Add hinged door",
        description: "Attach a small acrylic door using two small hinges.",
      },
      {
        title: "Test plant cover",
        description:
          "Place a small pot inside and observe heat and humidity changes.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/Mini-Greenhouse/",
        title: "Mini greenhouse ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["greenhouse", "home experiment", "reuse"],
  },
  {
    key: "fabric-pencil-case",
    authorEmail: "israa@learner.com",
    title: "Fabric Pencil Case",
    shortDescription: "Sew a simple pencil case from fabric and denim offcuts.",
    description:
      "A textile craft project that helps learners reuse fabric scraps and denim offcuts while practicing measuring, folding, and basic sewing.",
    categoryKey: "textile-crafts",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 100,
    coverImageUrl: IMAGES.sewing,
    status: "PUBLISHED",
    components: [
      {
        name: "Fabric scraps",
        materialType: "Fabric Scraps",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "bag",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["fabric scraps", "textile scraps"],
      },
      {
        name: "Denim offcuts",
        materialType: "Denim Offcuts",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "bundle",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["denim", "jeans fabric"],
      },
      {
        name: "Felt sheet",
        materialType: "Felt Sheets",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "sheet",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["felt", "craft felt"],
      },
    ],
    steps: [
      {
        title: "Measure fabric",
        description:
          "Cut two fabric rectangles slightly larger than your pencils.",
      },
      {
        title: "Fold and pin",
        description: "Fold the edges inward and pin the sides in place.",
      },
      {
        title: "Sew sides",
        description: "Sew the long sides, leaving the top opening clear.",
      },
      {
        title: "Decorate",
        description:
          "Add felt shapes or denim patches for style and reinforcement.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/Simple-Pencil-Case/",
        title: "Simple pencil case reference",
        sourceName: "Instructables",
      },
    ],
    tags: ["fabric", "sewing", "textile"],
  },
  {
    key: "rubber-band-powered-car",
    authorEmail: "majd@learner.com",
    title: "Rubber Band Powered Car",
    shortDescription:
      "Build a simple moving car from cardboard, wheels, and craft sticks.",
    description:
      "A mechanical reuse project where learners build a small car using cardboard, rubber wheels, wooden sticks, and simple fasteners. Seeded as pending review to test moderation screens.",
    categoryKey: "recycling-crafts",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 120,
    coverImageUrl: IMAGES.motors,
    status: "PENDING_REVIEW",
    components: [
      {
        name: "Cardboard sheet",
        materialType: "Cardboard Sheets",
        categoryKey: "paper-cardboard",
        quantity: 1,
        unit: "sheet",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["cardboard", "carton"],
      },
      {
        name: "Rubber wheels",
        materialType: "Rubber Wheels",
        categoryKey: "motors-mechanical",
        quantity: 4,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["rubber wheels", "cart wheels"],
      },
      {
        name: "Wooden craft sticks",
        materialType: "Wooden Craft Sticks",
        categoryKey: "art-craft-supplies",
        quantity: 2,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["craft sticks", "popsicle sticks"],
      },
    ],
    steps: [
      {
        title: "Cut car base",
        description: "Cut a rectangular cardboard base and mark axle lines.",
      },
      {
        title: "Install axles and wheels",
        description: "Attach wheels and test that the car rolls straight.",
      },
      {
        title: "Add rubber band drive",
        description:
          "Loop the rubber band around the rear axle and anchor point.",
      },
      {
        title: "Test distance",
        description:
          "Wind the axle and release the car, then adjust alignment.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.sciencebuddies.org/stem-activities/rubber-band-car",
        title: "Rubber band car activity",
        sourceName: "Science Buddies",
      },
    ],
    tags: ["car", "mechanics", "recycling"],
  },
];

const ADDITIONAL_PROJECTS: ProjectSeed[] = [
  {
    key: "line-follower-robot",
    authorEmail: "majd@learner.com",
    title: "Line Follower Robot",
    shortDescription:
      "Build a two-wheel robot that follows a dark line using infrared sensors.",
    description:
      "Build a two-wheel robot that follows a dark line using infrared sensors. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "robotics",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 210,
    coverImageUrl: IMAGES.robotProject,
    status: "PUBLISHED",
    components: [
      {
        name: "Arduino board",
        materialType: "Arduino Uno",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["arduino", "microcontroller"],
      },
      {
        name: "IR obstacle sensors",
        materialType: "IR Obstacle Sensor",
        categoryKey: "electronics-components",
        quantity: 2,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["ir sensor", "line sensor"],
      },
      {
        name: "DC gear motors",
        materialType: "DC Motor",
        categoryKey: "motors-mechanical",
        quantity: 2,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["dc motor", "gear motor"],
      },
      {
        name: "Motor driver",
        materialType: "L298N Motor Driver",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["l298n", "motor driver"],
      },
      {
        name: "Rubber wheels",
        materialType: "Rubber Wheels",
        categoryKey: "motors-mechanical",
        quantity: 2,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["robot wheels", "rubber wheels"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Line Follower Robot reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["robotics", "arduino", "line follower"],
  },
  {
    key: "smart-plant-monitor",
    authorEmail: "majd@learner.com",
    title: "Smart Plant Moisture Monitor",
    shortDescription:
      "Create a small monitor that warns when plant soil becomes dry.",
    description:
      "Create a small monitor that warns when plant soil becomes dry. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "electronics-learning",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 120,
    coverImageUrl: IMAGES.greenhouse,
    status: "PUBLISHED",
    components: [
      {
        name: "Arduino board",
        materialType: "Arduino Nano",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["arduino nano", "microcontroller"],
      },
      {
        name: "Soil moisture sensor",
        materialType: "Soil Moisture Sensor",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["soil moisture", "plant sensor"],
      },
      {
        name: "OLED display",
        materialType: "OLED Display",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["oled", "display"],
      },
      {
        name: "Buzzer",
        materialType: "Buzzer Module",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["buzzer", "alarm"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Smart Plant Moisture Monitor reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["plants", "sensors", "arduino"],
  },
  {
    key: "automatic-night-light",
    authorEmail: "majd@learner.com",
    title: "Automatic Night Light",
    shortDescription:
      "Use a light sensor to switch LEDs on when the room gets dark.",
    description:
      "Use a light sensor to switch LEDs on when the room gets dark. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "electronics-learning",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 75,
    coverImageUrl: IMAGES.electronics,
    status: "PUBLISHED",
    components: [
      {
        name: "Light sensor",
        materialType: "Light Sensor",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "pack",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["ldr", "photoresistor"],
      },
      {
        name: "LED pack",
        materialType: "LED Pack",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "pack",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["led", "light"],
      },
      {
        name: "Resistor pack",
        materialType: "Resistor Pack",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "pack",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["resistor"],
      },
      {
        name: "Breadboard",
        materialType: "Breadboard",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["breadboard"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Automatic Night Light reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["circuits", "light", "beginner"],
  },
  {
    key: "temperature-humidity-station",
    authorEmail: "majd@learner.com",
    title: "Temperature and Humidity Station",
    shortDescription:
      "Build a compact indoor station using a DHT11 sensor and display.",
    description:
      "Build a compact indoor station using a DHT11 sensor and display. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "electronics-learning",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 150,
    coverImageUrl: IMAGES.electronics,
    status: "PUBLISHED",
    components: [
      {
        name: "ESP32 board",
        materialType: "ESP32 Development Board",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["esp32", "wifi"],
      },
      {
        name: "DHT11 sensor",
        materialType: "DHT11 Sensor",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["dht11", "humidity sensor"],
      },
      {
        name: "LCD display",
        materialType: "16x2 LCD Display",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["lcd", "display"],
      },
      {
        name: "Jumper wires",
        materialType: "Jumper Wires",
        categoryKey: "electronics-components",
        quantity: 8,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["jumper wires"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Temperature and Humidity Station reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["weather", "sensors", "iot"],
  },
  {
    key: "servo-distance-scanner",
    authorEmail: "majd@learner.com",
    title: "Servo Distance Scanner",
    shortDescription:
      "Make a sweeping distance scanner using a servo and ultrasonic sensor.",
    description:
      "Make a sweeping distance scanner using a servo and ultrasonic sensor. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "robotics",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 180,
    coverImageUrl: IMAGES.robotProject,
    status: "PUBLISHED",
    components: [
      {
        name: "Servo motor",
        materialType: "Servo Motor",
        categoryKey: "motors-mechanical",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["sg90", "servo"],
      },
      {
        name: "Ultrasonic sensor",
        materialType: "Ultrasonic Sensor",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["hc-sr04", "distance sensor"],
      },
      {
        name: "Arduino board",
        materialType: "Arduino Uno",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["arduino"],
      },
      {
        name: "Breadboard",
        materialType: "Breadboard",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["breadboard"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Servo Distance Scanner reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["robotics", "servo", "sensor"],
  },
  {
    key: "electronic-dice",
    authorEmail: "majd@learner.com",
    title: "Electronic LED Dice",
    shortDescription:
      "Create a push-button electronic dice using LEDs and a microcontroller.",
    description:
      "Create a push-button electronic dice using LEDs and a microcontroller. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "electronics-learning",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 100,
    coverImageUrl: IMAGES.electronics,
    status: "PUBLISHED",
    components: [
      {
        name: "Arduino board",
        materialType: "Arduino Nano",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["arduino nano"],
      },
      {
        name: "LED pack",
        materialType: "LED Pack",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "pack",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["led"],
      },
      {
        name: "Push button",
        materialType: "Push Button Pack",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "pack",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["push button"],
      },
      {
        name: "Resistors",
        materialType: "Resistor Pack",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "pack",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["resistor"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Electronic LED Dice reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["dice", "led", "circuits"],
  },
  {
    key: "water-level-alarm",
    authorEmail: "majd@learner.com",
    title: "Water Level Alarm",
    shortDescription:
      "Build a simple alarm that sounds when water reaches a selected level.",
    description:
      "Build a simple alarm that sounds when water reaches a selected level. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "home-experiments",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 90,
    coverImageUrl: IMAGES.greenhouse,
    status: "PUBLISHED",
    components: [
      {
        name: "Water level sensor",
        materialType: "Water Level Sensor",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["water level", "sensor"],
      },
      {
        name: "Buzzer",
        materialType: "Buzzer Module",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["buzzer", "alarm"],
      },
      {
        name: "Battery holder",
        materialType: "Battery Holder",
        categoryKey: "power-batteries",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["battery holder"],
      },
      {
        name: "Jumper wires",
        materialType: "Jumper Wires",
        categoryKey: "electronics-components",
        quantity: 4,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["jumper wires"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Water Level Alarm reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["water", "alarm", "sensor"],
  },
  {
    key: "portable-usb-fan",
    authorEmail: "majd@learner.com",
    title: "Portable USB Cooling Fan",
    shortDescription:
      "Reuse a laptop fan and USB cable to make a small desk fan.",
    description:
      "Reuse a laptop fan and USB cable to make a small desk fan. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "home-experiments",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 70,
    coverImageUrl: IMAGES.electronics,
    status: "PUBLISHED",
    components: [
      {
        name: "Laptop cooling fan",
        materialType: "Cooling Fan",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["laptop fan", "dc fan"],
      },
      {
        name: "USB cable",
        materialType: "USB Cables",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["usb cable"],
      },
      {
        name: "Toggle switch",
        materialType: "Toggle Switch Pack",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "piece",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["toggle switch"],
      },
      {
        name: "Heat shrink tubing",
        materialType: "Heat Shrink Tubing",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "pack",
        role: "CONSUMABLE",
        required: false,
        substitute: true,
        keywords: ["heat shrink"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Portable USB Cooling Fan reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["reuse", "fan", "home diy"],
  },
  {
    key: "patchwork-tote-bag",
    authorEmail: "israa@learner.com",
    title: "Patchwork Tote Bag",
    shortDescription:
      "Combine cotton, denim, and canvas offcuts into a reusable shopping bag.",
    description:
      "Combine cotton, denim, and canvas offcuts into a reusable shopping bag. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "textile-crafts",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 180,
    coverImageUrl: IMAGES.sewing,
    status: "PUBLISHED",
    components: [
      {
        name: "Cotton offcuts",
        materialType: "Cotton Offcuts",
        categoryKey: "fabric-textiles",
        quantity: 2,
        unit: "bundles",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["cotton", "fabric offcuts"],
      },
      {
        name: "Canvas offcuts",
        materialType: "Canvas Offcuts",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "bundle",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["canvas", "heavy fabric"],
      },
      {
        name: "Sewing thread",
        materialType: "Sewing Thread",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "set",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["thread", "sewing"],
      },
      {
        name: "Zipper",
        materialType: "Zippers",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "piece",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["zipper"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Patchwork Tote Bag reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["fabric", "reuse", "bag"],
  },
  {
    key: "bottle-cap-mosaic",
    authorEmail: "israa@learner.com",
    title: "Bottle Cap Mosaic Board",
    shortDescription:
      "Arrange sorted bottle caps into a colorful recycled mosaic.",
    description:
      "Arrange sorted bottle caps into a colorful recycled mosaic. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "recycling-crafts",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 120,
    coverImageUrl: IMAGES.craft,
    status: "PUBLISHED",
    components: [
      {
        name: "Bottle caps",
        materialType: "Bottle Caps",
        categoryKey: "packaging-containers",
        quantity: 1,
        unit: "bag",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["bottle caps", "plastic caps"],
      },
      {
        name: "Cardboard base",
        materialType: "Cardboard Sheets",
        categoryKey: "paper-cardboard",
        quantity: 1,
        unit: "sheet",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["cardboard", "base"],
      },
      {
        name: "Glue sticks",
        materialType: "Glue Sticks",
        categoryKey: "art-craft-supplies",
        quantity: 1,
        unit: "pack",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["glue stick"],
      },
      {
        name: "Acrylic paint",
        materialType: "Acrylic Paint",
        categoryKey: "art-craft-supplies",
        quantity: 1,
        unit: "set",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["acrylic paint"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Bottle Cap Mosaic Board reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["mosaic", "recycling", "art"],
  },
  {
    key: "glass-jar-herb-planter",
    authorEmail: "israa@learner.com",
    title: "Glass Jar Herb Planter",
    shortDescription: "Reuse clean glass jars as small indoor herb planters.",
    description:
      "Reuse clean glass jars as small indoor herb planters. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "home-experiments",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 80,
    coverImageUrl: IMAGES.greenhouse,
    status: "PUBLISHED",
    components: [
      {
        name: "Glass jars",
        materialType: "Glass Jars",
        categoryKey: "packaging-containers",
        quantity: 3,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["glass jar", "mason jar"],
      },
      {
        name: "Burlap fabric",
        materialType: "Burlap Fabric",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "piece",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["burlap"],
      },
      {
        name: "Decorative ribbon",
        materialType: "Ribbon Rolls",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "roll",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["ribbon"],
      },
      {
        name: "Cork pieces",
        materialType: "Cork Pieces",
        categoryKey: "art-craft-supplies",
        quantity: 1,
        unit: "bag",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["cork"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Glass Jar Herb Planter reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["plants", "glass jars", "reuse"],
  },
  {
    key: "cardboard-marble-run",
    authorEmail: "israa@learner.com",
    title: "Cardboard Marble Run",
    shortDescription:
      "Build a wall-mounted marble track from cardboard sheets and tubes.",
    description:
      "Build a wall-mounted marble track from cardboard sheets and tubes. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "recycling-crafts",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 150,
    coverImageUrl: IMAGES.cardboard,
    status: "PUBLISHED",
    components: [
      {
        name: "Cardboard sheets",
        materialType: "Cardboard Sheets",
        categoryKey: "paper-cardboard",
        quantity: 4,
        unit: "sheets",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["cardboard sheets"],
      },
      {
        name: "Cardboard tubes",
        materialType: "Cardboard Tubes",
        categoryKey: "paper-cardboard",
        quantity: 5,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["cardboard tubes"],
      },
      {
        name: "Glue sticks",
        materialType: "Glue Sticks",
        categoryKey: "art-craft-supplies",
        quantity: 1,
        unit: "pack",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["glue"],
      },
      {
        name: "Decorative paper",
        materialType: "Decorative Paper",
        categoryKey: "paper-cardboard",
        quantity: 1,
        unit: "pack",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["decorative paper"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Cardboard Marble Run reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["cardboard", "physics", "recycling"],
  },
  {
    key: "tin-can-lantern",
    authorEmail: "israa@learner.com",
    title: "Decorated Tin Can Lantern",
    shortDescription:
      "Turn a clean tin can into a patterned lantern for an LED light.",
    description:
      "Turn a clean tin can into a patterned lantern for an LED light. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "recycling-crafts",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 90,
    coverImageUrl: IMAGES.craft,
    status: "PUBLISHED",
    components: [
      {
        name: "Tin can",
        materialType: "Tin Cans",
        categoryKey: "packaging-containers",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["tin can"],
      },
      {
        name: "LED pack",
        materialType: "LED Pack",
        categoryKey: "electronics-components",
        quantity: 1,
        unit: "pack",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["led"],
      },
      {
        name: "Acrylic paint",
        materialType: "Acrylic Paint",
        categoryKey: "art-craft-supplies",
        quantity: 1,
        unit: "set",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["paint"],
      },
      {
        name: "Nylon rope",
        materialType: "Nylon Rope",
        categoryKey: "other-reusable",
        quantity: 1,
        unit: "bundle",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["rope", "handle"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Decorated Tin Can Lantern reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["lantern", "recycling", "craft"],
  },
  {
    key: "felt-phone-sleeve",
    authorEmail: "israa@learner.com",
    title: "Felt Phone Sleeve",
    shortDescription:
      "Sew a protective phone sleeve from felt and fabric scraps.",
    description:
      "Sew a protective phone sleeve from felt and fabric scraps. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "textile-crafts",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 100,
    coverImageUrl: IMAGES.sewing,
    status: "PUBLISHED",
    components: [
      {
        name: "Felt sheets",
        materialType: "Felt Sheets",
        categoryKey: "fabric-textiles",
        quantity: 2,
        unit: "sheets",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["felt sheets"],
      },
      {
        name: "Fabric scraps",
        materialType: "Fabric Scraps",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "bag",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["fabric scraps"],
      },
      {
        name: "Sewing thread",
        materialType: "Sewing Thread",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "set",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["sewing thread"],
      },
      {
        name: "Hook and loop strip",
        materialType: "Hook and Loop Strips",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "pack",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["velcro"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Felt Phone Sleeve reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["felt", "sewing", "phone"],
  },
  {
    key: "yarn-wall-hanging",
    authorEmail: "israa@learner.com",
    title: "Reused Yarn Wall Hanging",
    shortDescription:
      "Create a textured wall hanging from mixed yarn and a wooden dowel.",
    description:
      "Create a textured wall hanging from mixed yarn and a wooden dowel. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "textile-crafts",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 110,
    coverImageUrl: IMAGES.textile,
    status: "PUBLISHED",
    components: [
      {
        name: "Yarn",
        materialType: "Yarn",
        categoryKey: "fabric-textiles",
        quantity: 2,
        unit: "bundles",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["yarn"],
      },
      {
        name: "Wooden dowel",
        materialType: "Wooden Dowels",
        categoryKey: "wood-boards",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["wooden dowel"],
      },
      {
        name: "Embroidery thread",
        materialType: "Embroidery Thread",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "bundle",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["embroidery thread"],
      },
      {
        name: "Ribbon",
        materialType: "Ribbon Rolls",
        categoryKey: "fabric-textiles",
        quantity: 1,
        unit: "roll",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["ribbon"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Reused Yarn Wall Hanging reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["yarn", "wall art", "reuse"],
  },
  {
    key: "egg-carton-seed-starter",
    authorEmail: "israa@learner.com",
    title: "Egg Carton Seed Starter",
    shortDescription:
      "Use paper egg cartons as biodegradable seed-starting cells.",
    description:
      "Use paper egg cartons as biodegradable seed-starting cells. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "home-experiments",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 60,
    coverImageUrl: IMAGES.greenhouse,
    status: "PUBLISHED",
    components: [
      {
        name: "Egg cartons",
        materialType: "Egg Cartons",
        categoryKey: "paper-cardboard",
        quantity: 2,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["egg carton"],
      },
      {
        name: "Kraft paper",
        materialType: "Kraft Paper Roll",
        categoryKey: "paper-cardboard",
        quantity: 1,
        unit: "roll",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["kraft paper"],
      },
      {
        name: "Plastic tray",
        materialType: "Plastic Trays",
        categoryKey: "packaging-containers",
        quantity: 1,
        unit: "set",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["plastic tray"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Egg Carton Seed Starter reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["plants", "recycling", "home experiment"],
  },
  {
    key: "small-wall-shelf",
    authorEmail: "learner@learner.com",
    title: "Small Reclaimed Wood Wall Shelf",
    shortDescription:
      "Build a compact wall shelf from reclaimed boards and brackets.",
    description:
      "Build a compact wall shelf from reclaimed boards and brackets. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "woodworking",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 160,
    coverImageUrl: IMAGES.woodPanels,
    status: "PUBLISHED",
    components: [
      {
        name: "Pallet boards",
        materialType: "Pallet Wood Boards",
        categoryKey: "wood-boards",
        quantity: 2,
        unit: "boards",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["pallet wood", "reclaimed board"],
      },
      {
        name: "Angle brackets",
        materialType: "Angle Brackets",
        categoryKey: "metal-fasteners",
        quantity: 2,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["angle bracket"],
      },
      {
        name: "Screws",
        materialType: "Screws and Nuts",
        categoryKey: "metal-fasteners",
        quantity: 8,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["screws"],
      },
      {
        name: "Spirit level",
        materialType: "Spirit Level",
        categoryKey: "tools-hardware",
        quantity: 1,
        unit: "piece",
        role: "TOOL",
        required: false,
        substitute: true,
        keywords: ["spirit level"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Small Reclaimed Wood Wall Shelf reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["woodworking", "shelf", "home diy"],
  },
  {
    key: "reclaimed-wood-birdhouse",
    authorEmail: "learner@learner.com",
    title: "Reclaimed Wood Birdhouse",
    shortDescription:
      "Make a simple birdhouse from plywood, dowels, and reclaimed timber.",
    description:
      "Make a simple birdhouse from plywood, dowels, and reclaimed timber. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "woodworking",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 200,
    coverImageUrl: IMAGES.wood,
    status: "PUBLISHED",
    components: [
      {
        name: "Plywood panel",
        materialType: "Plywood Sheet",
        categoryKey: "wood-boards",
        quantity: 2,
        unit: "panels",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["plywood"],
      },
      {
        name: "Wooden dowel",
        materialType: "Wooden Dowels",
        categoryKey: "wood-boards",
        quantity: 1,
        unit: "piece",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["wooden dowel"],
      },
      {
        name: "Small hinges",
        materialType: "Small Hinges",
        categoryKey: "tools-hardware",
        quantity: 2,
        unit: "pieces",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["hinges"],
      },
      {
        name: "Wood glue",
        materialType: "Wood Glue",
        categoryKey: "tools-hardware",
        quantity: 1,
        unit: "bottle",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["wood glue"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Reclaimed Wood Birdhouse reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["birdhouse", "wood", "reuse"],
  },
  {
    key: "plywood-laptop-stand",
    authorEmail: "learner@learner.com",
    title: "Plywood Laptop Stand",
    shortDescription:
      "Build an angled laptop stand from plywood and wood strips.",
    description:
      "Build an angled laptop stand from plywood and wood strips. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "woodworking",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 140,
    coverImageUrl: IMAGES.woodPanels,
    status: "PUBLISHED",
    components: [
      {
        name: "Plywood sheet",
        materialType: "Plywood Sheet",
        categoryKey: "wood-boards",
        quantity: 1,
        unit: "panel",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["plywood"],
      },
      {
        name: "Pine strips",
        materialType: "Pine Wood Strips",
        categoryKey: "wood-boards",
        quantity: 2,
        unit: "strips",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["pine strips"],
      },
      {
        name: "Sandpaper",
        materialType: "Sandpaper",
        categoryKey: "tools-hardware",
        quantity: 1,
        unit: "pack",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["sandpaper"],
      },
      {
        name: "Wood glue",
        materialType: "Wood Glue",
        categoryKey: "tools-hardware",
        quantity: 1,
        unit: "bottle",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["wood glue"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Plywood Laptop Stand reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["laptop stand", "woodworking", "home diy"],
  },
  {
    key: "wooden-tool-caddy",
    authorEmail: "learner@learner.com",
    title: "Wooden Tool Caddy",
    shortDescription:
      "Create a portable organizer for small hand tools and project supplies.",
    description:
      "Create a portable organizer for small hand tools and project supplies. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "woodworking",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 190,
    coverImageUrl: IMAGES.wood,
    status: "PUBLISHED",
    components: [
      {
        name: "Particleboard offcuts",
        materialType: "Particleboard Offcuts",
        categoryKey: "wood-boards",
        quantity: 3,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["particleboard", "wood offcuts"],
      },
      {
        name: "Wooden dowel",
        materialType: "Wooden Dowels",
        categoryKey: "wood-boards",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["wooden dowel", "handle"],
      },
      {
        name: "Screws",
        materialType: "Screws and Nuts",
        categoryKey: "metal-fasteners",
        quantity: 10,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["screws"],
      },
      {
        name: "Wood glue",
        materialType: "Wood Glue",
        categoryKey: "tools-hardware",
        quantity: 1,
        unit: "bottle",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["wood glue"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Wooden Tool Caddy reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["tool storage", "wood", "reuse"],
  },
  {
    key: "pvc-plant-stand",
    authorEmail: "learner@learner.com",
    title: "PVC Plant Stand",
    shortDescription:
      "Assemble a lightweight indoor plant stand from PVC pipe offcuts.",
    description:
      "Assemble a lightweight indoor plant stand from PVC pipe offcuts. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "home-experiments",
    difficulty: "BEGINNER",
    estimatedDurationMinutes: 130,
    coverImageUrl: IMAGES.greenhouse,
    status: "PUBLISHED",
    components: [
      {
        name: "PVC pipes",
        materialType: "PVC Pipes",
        categoryKey: "plastics-acrylic",
        quantity: 6,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["pvc pipes"],
      },
      {
        name: "PVC conduit",
        materialType: "PVC Conduit",
        categoryKey: "plastics-acrylic",
        quantity: 4,
        unit: "pieces",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["pvc conduit"],
      },
      {
        name: "Bolts and washers",
        materialType: "Bolts and Washers",
        categoryKey: "metal-fasteners",
        quantity: 8,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["bolts", "washers"],
      },
      {
        name: "Plastic tray",
        materialType: "Plastic Trays",
        categoryKey: "packaging-containers",
        quantity: 1,
        unit: "set",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["plant tray"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "PVC Plant Stand reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["plants", "pvc", "home diy"],
  },
  {
    key: "acrylic-display-box",
    authorEmail: "learner@learner.com",
    title: "Acrylic Display Box",
    shortDescription:
      "Build a clear protective box for a model or electronics project.",
    description:
      "Build a clear protective box for a model or electronics project. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "home-experiments",
    difficulty: "ADVANCED",
    estimatedDurationMinutes: 240,
    coverImageUrl: IMAGES.acrylic,
    status: "PUBLISHED",
    components: [
      {
        name: "Clear acrylic sheets",
        materialType: "Acrylic Sheet",
        categoryKey: "plastics-acrylic",
        quantity: 4,
        unit: "sheets",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["clear acrylic", "plexiglass"],
      },
      {
        name: "Small hinges",
        materialType: "Small Hinges",
        categoryKey: "tools-hardware",
        quantity: 2,
        unit: "pieces",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["hinges"],
      },
      {
        name: "Screws and nuts",
        materialType: "Screws and Nuts",
        categoryKey: "metal-fasteners",
        quantity: 8,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["screws", "nuts"],
      },
      {
        name: "Clamps",
        materialType: "Workshop Clamps",
        categoryKey: "tools-hardware",
        quantity: 2,
        unit: "pieces",
        role: "TOOL",
        required: false,
        substitute: true,
        keywords: ["clamps"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Acrylic Display Box reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["acrylic", "display", "enclosure"],
  },
  {
    key: "rolling-storage-crate",
    authorEmail: "learner@learner.com",
    title: "Rolling Workshop Storage Crate",
    shortDescription:
      "Add caster wheels and dividers to a reused plastic crate.",
    description:
      "Add caster wheels and dividers to a reused plastic crate. This project is designed around reusable materials already available in the ImpactLoop marketplace and includes a practical component checklist.",
    categoryKey: "home-experiments",
    difficulty: "INTERMEDIATE",
    estimatedDurationMinutes: 150,
    coverImageUrl: IMAGES.tools,
    status: "PUBLISHED",
    components: [
      {
        name: "Plastic crate",
        materialType: "Plastic Crates",
        categoryKey: "packaging-containers",
        quantity: 1,
        unit: "piece",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: false,
        keywords: ["plastic crate"],
      },
      {
        name: "Caster wheels",
        materialType: "Caster Wheels",
        categoryKey: "motors-mechanical",
        quantity: 4,
        unit: "pieces",
        role: "REQUIRED_MATERIAL",
        required: true,
        substitute: true,
        keywords: ["caster wheels"],
      },
      {
        name: "Bolts and washers",
        materialType: "Bolts and Washers",
        categoryKey: "metal-fasteners",
        quantity: 8,
        unit: "pieces",
        role: "CONSUMABLE",
        required: true,
        substitute: true,
        keywords: ["bolts", "washers"],
      },
      {
        name: "Plastic trays",
        materialType: "Plastic Trays",
        categoryKey: "packaging-containers",
        quantity: 2,
        unit: "sets",
        role: "OPTIONAL_MATERIAL",
        required: false,
        substitute: true,
        keywords: ["parts tray"],
      },
    ],
    steps: [
      {
        title: "Plan and inspect materials",
        description:
          "Review the component list, check dimensions and condition, and prepare a safe workspace.",
      },
      {
        title: "Prepare the main parts",
        description:
          "Measure, clean, cut, or sort the reusable materials needed for assembly.",
      },
      {
        title: "Assemble and connect",
        description:
          "Build the main structure or circuit, checking each connection before continuing.",
      },
      {
        title: "Test and improve",
        description:
          "Test the result, correct weak points, and document any substitutions used.",
      },
    ],
    links: [
      {
        linkType: "ARTICLE",
        url: "https://www.instructables.com/",
        title: "Rolling Workshop Storage Crate reference ideas",
        sourceName: "Instructables",
      },
    ],
    tags: ["storage", "workshop", "reuse"],
  },
];

const PROJECTS: ProjectSeed[] = [...CORE_PROJECTS, ...ADDITIONAL_PROJECTS];

type SeedContext = {
  users: Map<string, string>;
  suppliers: Map<
    string,
    { userId: string; profileId: string; pickupLocationId: string }
  >;
  drivers: Map<string, { userId: string; profileId: string }>;
  categories: Map<string, string>;
  materials: Map<
    string,
    {
      id: string;
      ownerId: string;
      supplierProfileId: string;
      locationId: string;
      price: number | null;
      isFree: boolean;
    }
  >;
  materialTypes: Map<
    string,
    { materialTypeId: string; priceRuleId: string | null }
  >;
  projects: Map<string, string>;
  reservations: Map<string, string>;
  learnerDropoffs: Map<string, string>;
};

const createMaterialCategories = async () => {
  const categoryMap = new Map<string, string>();

  for (const category of MATERIAL_CATEGORIES) {
    const record = await prisma.category.create({
      data: {
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        categoryType: "MATERIAL",
        isActive: true,
      },
      select: { id: true },
    });

    categoryMap.set(category.key, record.id);
  }

  for (const category of PROJECT_CATEGORIES) {
    const record = await prisma.category.create({
      data: {
        nameEn: category.nameEn,
        nameAr: category.nameAr,
        categoryType: "PROJECT",
        isActive: true,
      },
      select: { id: true },
    });

    categoryMap.set(category.key, record.id);
  }

  return categoryMap;
};

const ensureMaterialTypeWithPriceRule = async (
  context: SeedContext,
  material: MaterialSeed,
) => {
  const cacheKey = `${material.categoryKey}:${normalizeSearchText(material.materialType)}`;
  const cached = context.materialTypes.get(cacheKey);
  if (cached) {
    return cached;
  }

  const categoryId = context.categories.get(material.categoryKey);
  if (!categoryId) {
    throw new Error(
      `Missing category for material type: ${material.materialType}`,
    );
  }

  const materialType = await prisma.materialType.create({
    data: {
      categoryId,
      nameEn: material.materialType,
      nameAr: null,
      normalizedName: normalizeSearchText(material.materialType),
      defaultUnit: material.unit,
      isActive: true,
    },
    select: { id: true },
  });

  const aliases = [material.materialType, ...(material.aliases ?? [])]
    .map((alias) => ({ alias, normalizedAlias: normalizeSearchText(alias) }))
    .filter(
      (alias, index, all) =>
        all.findIndex(
          (other) => other.normalizedAlias === alias.normalizedAlias,
        ) === index,
    );

  if (aliases.length > 0) {
    await prisma.materialTypeAlias.createMany({
      data: aliases.map((alias) => ({
        materialTypeId: materialType.id,
        alias: alias.alias,
        normalizedAlias: alias.normalizedAlias,
        language: "en",
      })),
    });
  }

  let priceRuleId: string | null = null;
  if (material.maxAllowedUnitPriceNis != null) {
    const priceRule = await prisma.materialPriceRule.create({
      data: {
        materialTypeId: materialType.id,
        currency: CURRENCY,
        unit: material.unit,
        maxAllowedUnitPriceNis: material.maxAllowedUnitPriceNis,
        maxAllowedTotalPriceNis: Math.max(
          material.maxAllowedUnitPriceNis * Math.max(1, material.quantity),
          material.maxAllowedUnitPriceNis,
        ),
        sourceType: "MANUAL",
        status: "ACTIVE",
        sourceNote: "Reviewed realistic development seed price rule.",
        confidence: 0.95,
        isActive: true,
      },
      select: { id: true },
    });
    priceRuleId = priceRule.id;
  }

  const saved = { materialTypeId: materialType.id, priceRuleId };
  context.materialTypes.set(cacheKey, saved);
  return saved;
};

const createUsers = async (passwordHash: string, context: SeedContext) => {
  const learnerDropoffs = new Map<string, string>();

  for (const learner of LEARNERS) {
    const user = await prisma.user.create({
      data: {
        displayName: learner.displayName,
        email: learner.email,
        passwordHash,
        accountStatus: "ACTIVE",
        activeRole: "LEARNER",
        emailVerifiedAt: now(),
        recommendationEvidenceEligibility: "EXCLUDED_DEMO",
        roles: { create: [{ role: "LEARNER", isPrimary: true }] },
        learnerProfile: {
          create: {
            learnerType: "STUDENT",
            bio: `Learner interested in ${learner.interests.join(", ")} reuse projects.`,
            interests: [...learner.interests],
            skillLevel: learner.skillLevel,
          },
        },
      },
      select: { id: true },
    });

    const location = await prisma.location.create({
      data: {
        country: "Palestine",
        city: learner.city,
        area: learner.area,
        addressLine: `${learner.area} learner dropoff area`,
        latitude:
          learner.city === "Hebron"
            ? 31.5326
            : learner.city === "Ramallah"
              ? 31.9038
              : 32.2211,
        longitude:
          learner.city === "Hebron"
            ? 35.0998
            : learner.city === "Ramallah"
              ? 35.2034
              : 35.2544,
        locationType: "DROPOFF",
        visibility: "PRIVATE",
        isApproximate: true,
      },
      select: { id: true },
    });

    await prisma.userSavedLocation.create({
      data: {
        userId: user.id,
        locationId: location.id,
        label: "Default learner dropoff",
        isDefault: true,
      },
    });

    context.users.set(learner.email, user.id);
    learnerDropoffs.set(learner.email, location.id);
  }

  for (const supplier of SUPPLIERS) {
    const user = await prisma.user.create({
      data: {
        displayName: supplier.displayName,
        email: supplier.email,
        passwordHash,
        accountStatus: "ACTIVE",
        activeRole: "SUPPLIER",
        emailVerifiedAt: now(),
        recommendationEvidenceEligibility: "EXCLUDED_DEMO",
        roles: { create: [{ role: "SUPPLIER", isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: supplier.supplierType,
            publicName: supplier.publicName,
            description: supplier.description,
            verificationStatus: "APPROVED",
            verificationSubmittedAt: dateAt(-20, 10),
            verificationReviewedAt: dateAt(-18, 15),
            defaultPickupLocation: {
              create: {
                country: "Palestine",
                city: supplier.city,
                area: supplier.area,
                addressLine: supplier.addressLine,
                latitude: supplier.latitude,
                longitude: supplier.longitude,
                locationType: "PICKUP_POINT",
                visibility: "PUBLIC_APPROXIMATE",
                isApproximate: true,
              },
            },
            organizationProfile: {
              create: {
                organizationName: supplier.publicName,
                organizationType: supplier.organizationType,
                contactPersonName: supplier.displayName,
                workingDays: [
                  "SUNDAY",
                  "MONDAY",
                  "TUESDAY",
                  "WEDNESDAY",
                  "THURSDAY",
                ],
                workingHours: { start: "09:00", end: "17:00" },
                verificationDocumentStatus: "VERIFIED",
                verificationDocumentUrl: null,
                verificationDocumentName: null,
                businessLocation: {
                  create: {
                    country: "Palestine",
                    city: supplier.city,
                    area: supplier.area,
                    addressLine: `${supplier.area} business location`,
                    latitude: supplier.latitude,
                    longitude: supplier.longitude,
                    locationType: "BUSINESS_LOCATION",
                    visibility: "PRIVATE",
                    isApproximate: true,
                  },
                },
              },
            },
          },
        },
      },
      include: {
        supplierProfile: { include: { defaultPickupLocation: true } },
      },
    });

    if (!user.supplierProfile?.defaultPickupLocation) {
      throw new Error(
        `Failed to create supplier profile for ${supplier.email}`,
      );
    }

    context.users.set(supplier.email, user.id);
    context.suppliers.set(supplier.email, {
      userId: user.id,
      profileId: user.supplierProfile.id,
      pickupLocationId: user.supplierProfile.defaultPickupLocation.id,
    });
  }

  for (const driver of DRIVERS) {
    const user = await prisma.user.create({
      data: {
        displayName: driver.displayName,
        email: driver.email,
        phone: driver.phone,
        passwordHash,
        accountStatus: "ACTIVE",
        activeRole: "DRIVER",
        emailVerifiedAt: now(),
        recommendationEvidenceEligibility: "EXCLUDED_INTERNAL",
        roles: { create: [{ role: "DRIVER", isPrimary: true }] },
        driverProfile: {
          create: {
            displayName: driver.displayName,
            phone: driver.phone,
            city: driver.city,
            area: driver.area,
            addressLine: `${driver.area} driver area`,
            transportationType: driver.transportationType,
            availabilityNote: "Available for ImpactLoop internal deliveries.",
            status: "ACTIVE",
            availability: "AVAILABLE",
            vehicleType: driver.vehicleType,
            vehicleLabel: driver.vehicleLabel,
            vehiclePlate: driver.vehiclePlate,
            capacityNotes:
              "Can carry small to medium student project materials.",
          },
        },
      },
      include: { driverProfile: true },
    });

    if (!user.driverProfile) {
      throw new Error(`Failed to create driver profile for ${driver.email}`);
    }

    context.users.set(driver.email, user.id);
    context.drivers.set(driver.email, {
      userId: user.id,
      profileId: user.driverProfile.id,
    });
  }

  for (const admin of ADMINS) {
    const user = await prisma.user.create({
      data: {
        displayName: admin.displayName,
        email: admin.email,
        passwordHash,
        accountStatus: "ACTIVE",
        activeRole: "ADMIN",
        emailVerifiedAt: now(),
        recommendationEvidenceEligibility: "EXCLUDED_INTERNAL",
        roles: { create: [{ role: "ADMIN", isPrimary: true }] },
      },
      select: { id: true },
    });

    context.users.set(admin.email, user.id);
  }

  await createAdditionalLearners(passwordHash, context);
  context.learnerDropoffs = learnerDropoffs;
};

const createAdditionalLearners = async (
  passwordHash: string,
  context: SeedContext,
) => {
  await prisma.user.createMany({
    data: EXTRA_LEARNERS.map((learner) => ({
      displayName: learner.displayName,
      email: learner.email,
      passwordHash,
      accountStatus: "ACTIVE" as const,
      activeRole: "LEARNER" as const,
      emailVerifiedAt: now(),
      recommendationEvidenceEligibility: "EXCLUDED_DEMO" as const,
      profileImageUrl: `https://api.dicebear.com/9.x/initials/png?seed=${encodeURIComponent(
        learner.displayName,
      )}`,
    })),
  });

  const createdUsers = await prisma.user.findMany({
    where: { email: { in: EXTRA_LEARNERS.map((learner) => learner.email) } },
    select: { id: true, email: true },
  });

  const userIdByEmail = new Map(
    createdUsers.map((user) => [user.email, user.id]),
  );

  await prisma.userRoleAssignment.createMany({
    data: EXTRA_LEARNERS.map((learner) => ({
      userId: userIdByEmail.get(learner.email)!,
      role: "LEARNER" as const,
      isPrimary: true,
    })),
  });

  await prisma.learnerProfile.createMany({
    data: EXTRA_LEARNERS.map((learner) => ({
      userId: userIdByEmail.get(learner.email)!,
      learnerType: "STUDENT",
      bio: `Community learner interested in ${learner.interests.join(", ")} projects.`,
      interests: learner.interests,
      skillLevel: learner.skillLevel,
    })),
  });

  for (const user of createdUsers) {
    context.users.set(user.email, user.id);
  }
};

const createMaterials = async (context: SeedContext) => {
  for (const material of MATERIALS) {
    material.imageUrls.forEach((url, index) =>
      assertImage(`${material.title} image ${index + 1}`, url),
    );

    const supplier = context.suppliers.get(material.supplierEmail);
    const categoryId = context.categories.get(material.categoryKey);
    if (!supplier || !categoryId) {
      throw new Error(`Missing dependency for material: ${material.title}`);
    }

    const typeInfo = await ensureMaterialTypeWithPriceRule(context, material);

    const created = await prisma.material.create({
      data: {
        ownerId: supplier.userId,
        supplierProfileId: supplier.profileId,
        categoryId,
        materialTypeId: typeInfo.materialTypeId,
        priceRuleId: typeInfo.priceRuleId,
        title: material.title,
        description: material.description,
        materialType: material.materialType,
        quantity: material.quantity,
        unit: material.unit,
        condition: material.condition,
        sourceType: material.sourceType,
        status: "AVAILABLE",
        isFree: material.isFree,
        price: material.price,
        currency: CURRENCY,
        locationId: supplier.pickupLocationId,
        pickupAllowed: material.pickupAllowed,
        deliveryAllowed: material.deliveryAllowed,
        pickupNotes:
          "Pickup details are confirmed after reservation acceptance.",
        suggestedUses: material.suggestedUses,
        viewsCount: material.viewsCount,
        images: {
          create: material.imageUrls.map((imageUrl, index) => ({
            imageUrl,
            sortOrder: index,
            isCover: index === 0,
          })),
        },
        tags: {
          create: material.tags.map((tag) => ({ tag })),
        },
      },
      select: { id: true },
    });

    context.materials.set(material.key, {
      id: created.id,
      ownerId: supplier.userId,
      supplierProfileId: supplier.profileId,
      locationId: supplier.pickupLocationId,
      price: material.price,
      isFree: material.isFree,
    });
  }

  const materialByKey = new Map(MATERIALS.map((entry) => [entry.key, entry]));

  for (const copy of WORKFLOW_MATERIAL_COPIES) {
    const source = materialByKey.get(copy.sourceKey);
    if (!source) {
      throw new Error(
        `Missing source material for workflow copy: ${copy.sourceKey}`,
      );
    }

    const workflowMaterial: MaterialSeed & { key: string } = {
      ...source,
      key: copy.key,
      title: `${source.title} ${copy.titleSuffix}`.trim(),
      description: `${source.description} Separate listing used for reservation workflow testing.`,
      viewsCount: Math.max(1, Math.floor(source.viewsCount / 4)),
    };

    workflowMaterial.imageUrls.forEach((url, index) =>
      assertImage(`${workflowMaterial.title} image ${index + 1}`, url),
    );

    const supplier = context.suppliers.get(workflowMaterial.supplierEmail);
    const categoryId = context.categories.get(workflowMaterial.categoryKey);
    if (!supplier || !categoryId) {
      throw new Error(
        `Missing dependency for workflow material: ${workflowMaterial.title}`,
      );
    }

    const typeInfo = await ensureMaterialTypeWithPriceRule(
      context,
      workflowMaterial,
    );

    const created = await prisma.material.create({
      data: {
        ownerId: supplier.userId,
        supplierProfileId: supplier.profileId,
        categoryId,
        materialTypeId: typeInfo.materialTypeId,
        priceRuleId: typeInfo.priceRuleId,
        title: workflowMaterial.title,
        description: workflowMaterial.description,
        materialType: workflowMaterial.materialType,
        quantity: workflowMaterial.quantity,
        unit: workflowMaterial.unit,
        condition: workflowMaterial.condition,
        sourceType: workflowMaterial.sourceType,
        status: "AVAILABLE",
        isFree: workflowMaterial.isFree,
        price: workflowMaterial.price,
        currency: CURRENCY,
        locationId: supplier.pickupLocationId,
        pickupAllowed: workflowMaterial.pickupAllowed,
        deliveryAllowed: workflowMaterial.deliveryAllowed,
        pickupNotes:
          "Pickup details are confirmed after reservation acceptance.",
        suggestedUses: workflowMaterial.suggestedUses,
        viewsCount: workflowMaterial.viewsCount,
        images: {
          create: workflowMaterial.imageUrls.map((imageUrl, index) => ({
            imageUrl,
            sortOrder: index,
            isCover: index === 0,
          })),
        },
        tags: {
          create: workflowMaterial.tags.map((tag) => ({ tag })),
        },
      },
      select: { id: true },
    });

    context.materials.set(workflowMaterial.key, {
      id: created.id,
      ownerId: supplier.userId,
      supplierProfileId: supplier.profileId,
      locationId: supplier.pickupLocationId,
      price: workflowMaterial.price,
      isFree: workflowMaterial.isFree,
    });
  }
};

const createProjects = async (context: SeedContext) => {
  for (const project of PROJECTS) {
    assertImage(`${project.title} cover`, project.coverImageUrl);

    const categoryId = context.categories.get(project.categoryKey);
    const authorId = context.users.get(project.authorEmail);
    const reviewedBy =
      project.status === "PUBLISHED"
        ? (context.users.get("admin@admin.com") ?? null)
        : null;

    if (!categoryId || !authorId) {
      throw new Error(`Missing dependency for project: ${project.title}`);
    }

    const created = await prisma.learningProject.create({
      data: {
        categoryId,
        createdBy: authorId,
        title: project.title,
        shortDescription: project.shortDescription,
        description: project.description,
        difficulty: project.difficulty,
        estimatedDurationMinutes: project.estimatedDurationMinutes,
        coverImageUrl: project.coverImageUrl,
        status: project.status,
        submittedAt: dateAt(-9, 11),
        reviewedBy,
        reviewedAt: project.status === "PUBLISHED" ? dateAt(-8, 14) : null,
        reviewNote:
          project.status === "PUBLISHED"
            ? "Approved seed project with realistic reusable material requirements."
            : "Pending review seed project for admin moderation testing.",
        stepsGeneratedByAi: false,
        images: {
          create: [
            { imageUrl: project.coverImageUrl, sortOrder: 0 },
            { imageUrl: project.coverImageUrl, sortOrder: 1 },
          ],
        },
        requiredComponents: {
          create: project.components.map((component) => ({
            categoryId: component.categoryKey
              ? (context.categories.get(component.categoryKey) ?? null)
              : null,
            componentName: component.name,
            materialType: component.materialType,
            quantity: component.quantity,
            unit: component.unit,
            componentRole: component.role,
            isRequired: component.required,
            canBeSubstituted: component.substitute,
            searchKeywords: jsonArray(component.keywords),
            alternativeKeywords: jsonArray(component.alternatives),
            providedByUser: true,
            confirmedByUser: true,
            generatedOrSuggestedByAi: false,
            reviewStatus:
              project.status === "PUBLISHED" ? "ACCEPTED" : "PENDING_REVIEW",
            notes: component.notes ?? null,
          })),
        },
        steps: {
          create: project.steps.map((step, index) => ({
            stepNumber: index + 1,
            title: step.title,
            description: step.description,
            imageUrl: step.imageUrl ?? null,
            generatedByAi: false,
            approvedBy: project.status === "PUBLISHED" ? reviewedBy : null,
            reviewStatus:
              project.status === "PUBLISHED" ? "ACCEPTED" : "PENDING_REVIEW",
          })),
        },
        links: {
          create: project.links.map((link) => ({
            linkType: link.linkType,
            url: link.url,
            title: link.title,
            sourceName: link.sourceName,
          })),
        },
        tags: {
          create: project.tags.map((tag) => ({ tag })),
        },
      },
      select: { id: true },
    });

    context.projects.set(project.key, created.id);
  }

  const likesAndSaves = [
    { email: "majd@learner.com", project: "obstacle-avoidance-robot" },
    { email: "majd@learner.com", project: "simple-led-circuit" },
    { email: "israa@learner.com", project: "fabric-pencil-case" },
    { email: "israa@learner.com", project: "recycled-desk-organizer" },
    { email: "learner@learner.com", project: "mini-wooden-phone-stand" },
    { email: "learner@learner.com", project: "mini-greenhouse-prototype" },
  ];

  for (const item of likesAndSaves) {
    const userId = context.users.get(item.email);
    const projectId = context.projects.get(item.project);
    if (!userId || !projectId) continue;

    await prisma.projectSave.create({ data: { userId, projectId } });
    await prisma.projectLike.create({ data: { userId, projectId } });
  }
};

type LearnerEngagementCounts = {
  email: string;
  materialLikes: number;
  materialViews: number;
  projectFollows: number;
};

const createLearnerEngagement = async (
  context: SeedContext,
): Promise<LearnerEngagementCounts[]> => {
  const counts: LearnerEngagementCounts[] = [];
  let viewOffsetMinutes = 0;

  for (const persona of LEARNER_ENGAGEMENT) {
    const userId = context.users.get(persona.email);
    if (!userId) {
      continue;
    }

    let materialLikes = 0;
    let materialViews = 0;
    let projectFollows = 0;

    for (const materialKey of persona.likes) {
      const material = context.materials.get(materialKey);
      if (!material) {
        continue;
      }

      await prisma.materialLike.create({
        data: { userId, materialId: material.id },
      });
      materialLikes += 1;
    }

    for (const materialKey of persona.views) {
      const material = context.materials.get(materialKey);
      if (!material) {
        continue;
      }

      viewOffsetMinutes += 1;
      await prisma.materialView.create({
        data: {
          materialId: material.id,
          viewerUserId: userId,
          viewSource: "seed",
          createdAt: new Date(Date.now() - viewOffsetMinutes * 60_000),
        },
      });
      materialViews += 1;
    }

    for (const projectKey of persona.follows) {
      const projectId = context.projects.get(projectKey);
      if (!projectId) {
        continue;
      }

      await prisma.projectFollow.create({
        data: { userId, projectId },
      });
      projectFollows += 1;
    }

    counts.push({
      email: persona.email,
      materialLikes,
      materialViews,
      projectFollows,
    });
  }

  return counts;
};

type ReservationSeed = {
  key: string;
  materialKey: string;
  learnerEmail: string;
  status:
    | "PENDING"
    | "AWAITING_LEARNER_CONFIRMATION"
    | "AWAITING_SUPPLIER_CONFIRMATION"
    | "ACCEPTED"
    | "REJECTED"
    | "CANCELLED"
    | "COMPLETED"
    | "EXPIRED"
    | "AWAITING_RESOLUTION";
  quantity: number;
  fulfillmentMethod: "PICKUP" | "DELIVERY";
  message: string;
  pickupStartOffset: number;
  pickupStartHour: number;
  pickupEndHour: number;
  supplierNote?: string;
  rejectionReason?: string;
  pendingRescheduleRequestedBy?: "SUPPLIER" | "LEARNER";
};

const RESERVATIONS: ReservationSeed[] = [
  {
    key: "r-majd-arduino-pending",
    materialKey: "wf-majd-arduino-uno-r3",
    learnerEmail: "majd@learner.com",
    status: "PENDING",
    quantity: 1,
    fulfillmentMethod: "DELIVERY",
    message:
      "I need this Arduino board for the obstacle avoidance robot project.",
    pickupStartOffset: 1,
    pickupStartHour: 10,
    pickupEndHour: 12,
  },
  {
    key: "r-majd-motors-accepted",
    materialKey: "wf-majd-dc-gear-motors",
    learnerEmail: "majd@learner.com",
    status: "ACCEPTED",
    quantity: 2,
    fulfillmentMethod: "DELIVERY",
    message: "Can I reserve two motors for a robot car?",
    pickupStartOffset: 0,
    pickupStartHour: 14,
    pickupEndHour: 16,
    supplierNote:
      "Motors are packed in a small box near the electronics shelf.",
  },
  {
    key: "r-majd-breadboard-completed",
    materialKey: "wf-majd-breadboard-kit",
    learnerEmail: "majd@learner.com",
    status: "COMPLETED",
    quantity: 1,
    fulfillmentMethod: "PICKUP",
    message: "I need one breadboard for the LED circuit.",
    pickupStartOffset: -3,
    pickupStartHour: 11,
    pickupEndHour: 12,
    supplierNote: "Self pickup completed successfully.",
  },
  {
    key: "r-israa-fabric-pending",
    materialKey: "wf-israa-fabric-scraps",
    learnerEmail: "israa@learner.com",
    status: "PENDING",
    quantity: 1,
    fulfillmentMethod: "DELIVERY",
    message: "I want fabric scraps for the pencil case project.",
    pickupStartOffset: 2,
    pickupStartHour: 10,
    pickupEndHour: 13,
  },
  {
    key: "r-israa-cardboard-reschedule",
    materialKey: "wf-israa-cardboard-sheets",
    learnerEmail: "israa@learner.com",
    status: "AWAITING_LEARNER_CONFIRMATION",
    quantity: 4,
    fulfillmentMethod: "PICKUP",
    message: "Can I pick up cardboard for a desk organizer?",
    pickupStartOffset: 1,
    pickupStartHour: 12,
    pickupEndHour: 14,
    supplierNote: "Supplier proposed a later window.",
    pendingRescheduleRequestedBy: "SUPPLIER",
  },
  {
    key: "r-israa-paint-completed",
    materialKey: "wf-israa-acrylic-paint",
    learnerEmail: "israa@learner.com",
    status: "COMPLETED",
    quantity: 1,
    fulfillmentMethod: "DELIVERY",
    message: "Need paints for the organizer decoration.",
    pickupStartOffset: -2,
    pickupStartHour: 9,
    pickupEndHour: 10,
    supplierNote: "Paint set delivered with sealed lids.",
  },
  {
    key: "r-learner-plywood-accepted",
    materialKey: "wf-supplier-plywood-panels",
    learnerEmail: "learner@learner.com",
    status: "ACCEPTED",
    quantity: 1,
    fulfillmentMethod: "DELIVERY",
    message: "I need a plywood panel for a phone stand.",
    pickupStartOffset: 0,
    pickupStartHour: 13,
    pickupEndHour: 15,
    supplierNote: "Panel will be near the loading area.",
  },
  {
    key: "r-learner-acrylic-awaiting-supplier",
    materialKey: "wf-supplier-acrylic-sheets",
    learnerEmail: "learner@learner.com",
    status: "AWAITING_SUPPLIER_CONFIRMATION",
    quantity: 3,
    fulfillmentMethod: "DELIVERY",
    message: "I need acrylic sheets for a mini greenhouse prototype.",
    pickupStartOffset: 3,
    pickupStartHour: 10,
    pickupEndHour: 12,
    pendingRescheduleRequestedBy: "LEARNER",
  },
  {
    key: "r-learner-screws-rejected",
    materialKey: "supplier-screws-nuts",
    learnerEmail: "learner@learner.com",
    status: "REJECTED",
    quantity: 1,
    fulfillmentMethod: "PICKUP",
    message: "Can I take one box of screws?",
    pickupStartOffset: 1,
    pickupStartHour: 9,
    pickupEndHour: 11,
    rejectionReason:
      "The remaining screws are already allocated to another reservation.",
  },
  {
    key: "r-majd-servo-cancelled",
    materialKey: "majd-servo-sg90",
    learnerEmail: "majd@learner.com",
    status: "CANCELLED",
    quantity: 2,
    fulfillmentMethod: "PICKUP",
    message: "I thought I needed servos but changed the project plan.",
    pickupStartOffset: -1,
    pickupStartHour: 15,
    pickupEndHour: 16,
  },
  {
    key: "r-israa-jars-expired",
    materialKey: "israa-glass-jars",
    learnerEmail: "israa@learner.com",
    status: "EXPIRED",
    quantity: 5,
    fulfillmentMethod: "PICKUP",
    message: "I wanted jars for plant experiments but did not confirm in time.",
    pickupStartOffset: -4,
    pickupStartHour: 10,
    pickupEndHour: 11,
  },
  {
    key: "r-learner-pvc-resolution",
    materialKey: "wf-supplier-pvc-pipes",
    learnerEmail: "learner@learner.com",
    status: "AWAITING_RESOLUTION",
    quantity: 4,
    fulfillmentMethod: "DELIVERY",
    message:
      "Delivery issue happened with PVC pipes for the greenhouse prototype.",
    pickupStartOffset: -1,
    pickupStartHour: 10,
    pickupEndHour: 12,
    supplierNote: "Driver reported pickup delay; moved to admin resolution.",
  },
];

const materialStatusFromReservation = (status: ReservationSeed["status"]) => {
  switch (status) {
    case "PENDING":
    case "AWAITING_LEARNER_CONFIRMATION":
    case "AWAITING_SUPPLIER_CONFIRMATION":
      return "PENDING_RESERVATION" as const;
    case "ACCEPTED":
    case "AWAITING_RESOLUTION":
      return "RESERVED" as const;
    case "COMPLETED":
      return "REUSED" as const;
    default:
      return "AVAILABLE" as const;
  }
};

const createReservations = async (context: SeedContext) => {
  for (const spec of RESERVATIONS) {
    const material = context.materials.get(spec.materialKey);
    const requesterId = context.users.get(spec.learnerEmail);
    if (!material || !requesterId) {
      throw new Error(`Missing dependency for reservation: ${spec.key}`);
    }

    const start = dateAt(spec.pickupStartOffset, spec.pickupStartHour);
    const end = dateAt(spec.pickupStartOffset, spec.pickupEndHour);
    const price = material.price ?? 0;
    const materialSubtotal = material.isFree ? 0 : price * spec.quantity;
    const deliveryFee = spec.fulfillmentMethod === "DELIVERY" ? 15 : 0;
    const acceptedAt = [
      "ACCEPTED",
      "COMPLETED",
      "AWAITING_RESOLUTION",
    ].includes(spec.status)
      ? dateAt(spec.pickupStartOffset - 1, 12)
      : null;
    const rejectedAt = spec.status === "REJECTED" ? dateAt(-1, 14) : null;
    const cancelledAt = spec.status === "CANCELLED" ? dateAt(-1, 15) : null;
    const completedAt =
      spec.status === "COMPLETED"
        ? dateAt(spec.pickupStartOffset, spec.pickupEndHour)
        : null;

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId,
        ownerId: material.ownerId,
        quantityRequested: spec.quantity,
        message: spec.message,
        fulfillmentMethod: spec.fulfillmentMethod,
        deliveryAddressText:
          spec.fulfillmentMethod === "DELIVERY"
            ? "Default learner dropoff location"
            : null,
        safeDropoffAllowed:
          spec.fulfillmentMethod === "DELIVERY" ? false : null,
        deliveryNote:
          spec.fulfillmentMethod === "DELIVERY"
            ? "Please call learner when arriving at the dropoff area."
            : null,
        status: spec.status,
        pickupWindowStart: [
          "ACCEPTED",
          "COMPLETED",
          "AWAITING_RESOLUTION",
        ].includes(spec.status)
          ? start
          : null,
        pickupWindowEnd: [
          "ACCEPTED",
          "COMPLETED",
          "AWAITING_RESOLUTION",
        ].includes(spec.status)
          ? end
          : null,
        supplierProposedPickupWindowStart:
          spec.status === "AWAITING_LEARNER_CONFIRMATION" ? start : null,
        supplierProposedPickupWindowEnd:
          spec.status === "AWAITING_LEARNER_CONFIRMATION" ? end : null,
        learnerProposedPickupWindowStart:
          spec.status === "AWAITING_SUPPLIER_CONFIRMATION" ? start : null,
        learnerProposedPickupWindowEnd:
          spec.status === "AWAITING_SUPPLIER_CONFIRMATION" ? end : null,
        pendingRescheduleRequestedBy: spec.pendingRescheduleRequestedBy ?? null,
        pendingRescheduleReason: spec.pendingRescheduleRequestedBy
          ? "Seeded reschedule scenario."
          : null,
        pendingRescheduleNote: spec.pendingRescheduleRequestedBy
          ? "Please confirm the proposed time."
          : null,
        supplierPickupWindowStart: start,
        supplierPickupWindowEnd: end,
        confirmedDeliveryWindowStart:
          spec.fulfillmentMethod === "DELIVERY" &&
          ["ACCEPTED", "COMPLETED", "AWAITING_RESOLUTION"].includes(spec.status)
            ? dateAt(spec.pickupStartOffset, spec.pickupEndHour + 1)
            : null,
        confirmedDeliveryWindowEnd:
          spec.fulfillmentMethod === "DELIVERY" &&
          ["ACCEPTED", "COMPLETED", "AWAITING_RESOLUTION"].includes(spec.status)
            ? dateAt(spec.pickupStartOffset, spec.pickupEndHour + 3)
            : null,
        earliestDeliveryStart:
          spec.fulfillmentMethod === "DELIVERY"
            ? dateAt(spec.pickupStartOffset, spec.pickupEndHour)
            : null,
        supplierNote: spec.supplierNote ?? null,
        rejectionReason: spec.rejectionReason ?? null,
        acceptedAt,
        rejectedAt,
        cancelledAt,
        completedAt,
        unitPriceAtReservation: material.isFree ? 0 : price,
        materialSubtotal,
        deliveryFee,
        totalAmount: materialSubtotal + deliveryFee,
        pricingCurrency: CURRENCY,
        deliveryZone:
          spec.fulfillmentMethod === "DELIVERY" ? "SAME_CITY" : null,
        dropoffCity:
          spec.fulfillmentMethod === "DELIVERY"
            ? spec.learnerEmail.includes("majd")
              ? "Hebron"
              : spec.learnerEmail.includes("israa")
                ? "Ramallah"
                : "Nablus"
            : null,
        dropoffArea:
          spec.fulfillmentMethod === "DELIVERY"
            ? spec.learnerEmail.includes("majd")
              ? "University District"
              : spec.learnerEmail.includes("israa")
                ? "Al-Tireh"
                : "Rafidia"
            : null,
      },
      select: { id: true },
    });

    context.reservations.set(spec.key, reservation.id);

    await prisma.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: "RESERVATION",
        oldStatus: null,
        newStatus: spec.status,
        changedBy: requesterId,
        note: `Seeded reservation status: ${spec.status}`,
      },
    });

    await prisma.reservationMessage.create({
      data: {
        reservationId: reservation.id,
        senderUserId: requesterId,
        body: spec.message,
      },
    });

    await prisma.material.update({
      where: { id: material.id },
      data: {
        status: materialStatusFromReservation(spec.status),
        reusedAt: spec.status === "COMPLETED" ? completedAt : null,
        reusedByReservationId:
          spec.status === "COMPLETED" ? reservation.id : null,
      },
    });
  }
};

type DeliverySeed = {
  reservationKey: string;
  driverEmail?: string;
  status:
    | "WAITING_FOR_DRIVER"
    | "DRIVER_ASSIGNED"
    | "PICKED_UP"
    | "ON_THE_WAY"
    | "DELIVERED"
    | "AWAITING_RESOLUTION";
  note: string;
};

const DELIVERIES: DeliverySeed[] = [
  {
    reservationKey: "r-majd-arduino-pending",
    status: "WAITING_FOR_DRIVER",
    note: "Open delivery waiting for first available driver.",
  },
  {
    reservationKey: "r-majd-motors-accepted",
    driverEmail: "majd@driver.com",
    status: "DRIVER_ASSIGNED",
    note: "Driver assigned and pickup not started yet.",
  },
  {
    reservationKey: "r-israa-fabric-pending",
    status: "WAITING_FOR_DRIVER",
    note: "Creative material delivery request waiting for driver.",
  },
  {
    reservationKey: "r-israa-paint-completed",
    driverEmail: "israa@driver.com",
    status: "DELIVERED",
    note: "Paint set delivered successfully.",
  },
  {
    reservationKey: "r-learner-plywood-accepted",
    driverEmail: "driver@driver.com",
    status: "PICKED_UP",
    note: "Plywood panel picked up and waiting to move to dropoff.",
  },
  {
    reservationKey: "r-learner-acrylic-awaiting-supplier",
    driverEmail: "driver@driver.com",
    status: "ON_THE_WAY",
    note: "Acrylic sheets are on the way after supplier confirmation scenario.",
  },
  {
    reservationKey: "r-learner-pvc-resolution",
    driverEmail: "majd@driver.com",
    status: "AWAITING_RESOLUTION",
    note: "PVC delivery moved to admin review after pickup issue.",
  },
];

const deliveryGroupStatus = (status: DeliverySeed["status"]) => {
  if (status === "WAITING_FOR_DRIVER") return "OPEN" as const;
  if (status === "DELIVERED") return "COMPLETED" as const;
  return "ASSIGNED" as const;
};

const createDeliveryStatusHistory = async (
  deliveryId: string,
  status: DeliverySeed["status"],
  changedByUserId: string,
) => {
  const order: DeliverySeed["status"][] = [
    "WAITING_FOR_DRIVER",
    "DRIVER_ASSIGNED",
    "PICKED_UP",
    "ON_THE_WAY",
    "DELIVERED",
  ];

  const sequence =
    status === "AWAITING_RESOLUTION"
      ? ([
          "WAITING_FOR_DRIVER",
          "DRIVER_ASSIGNED",
          "AWAITING_RESOLUTION",
        ] as DeliverySeed["status"][])
      : order.slice(0, order.indexOf(status) + 1);

  let oldStatus: DeliverySeed["status"] | null = null;
  for (const newStatus of sequence) {
    await prisma.deliveryStatusHistory.create({
      data: {
        deliveryId,
        oldStatus,
        newStatus,
        changedByUserId,
        note: `Seeded delivery transition to ${newStatus}`,
        createdAt: now(),
      },
    });
    oldStatus = newStatus;
  }
};

const createDeliveries = async (context: SeedContext) => {
  for (const spec of DELIVERIES) {
    const reservationId = context.reservations.get(spec.reservationKey);
    if (!reservationId) {
      throw new Error(
        `Missing reservation for delivery: ${spec.reservationKey}`,
      );
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { material: true, requester: true },
    });

    if (!reservation) {
      throw new Error(
        `Reservation not found for delivery: ${spec.reservationKey}`,
      );
    }

    const driver = spec.driverEmail
      ? context.drivers.get(spec.driverEmail)
      : null;
    const dropoffLocationId = context.learnerDropoffs.get(
      reservation.requester.email,
    );
    if (!dropoffLocationId) {
      throw new Error(
        `Missing learner dropoff for ${reservation.requester.email}`,
      );
    }

    const group = await prisma.deliveryGroup.create({
      data: {
        learnerId: reservation.requesterId,
        supplierProfileId: reservation.material.supplierProfileId!,
        dropoffCity: reservation.dropoffCity ?? "Hebron",
        dropoffArea: reservation.dropoffArea,
        deliveryAddressText:
          reservation.deliveryAddressText ?? "Default learner dropoff location",
        deliveryFee: reservation.deliveryFee ?? 15,
        currency: CURRENCY,
        deliveryZone: reservation.deliveryZone ?? "SAME_CITY",
        status: deliveryGroupStatus(spec.status),
        windowStart: reservation.confirmedDeliveryWindowStart ?? dateAt(1, 15),
        windowEnd: reservation.confirmedDeliveryWindowEnd ?? dateAt(1, 18),
        assignedDriverProfileId: driver?.profileId ?? null,
      },
      select: { id: true },
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { deliveryGroupId: group.id },
    });

    const delivery = await prisma.delivery.create({
      data: {
        reservationId: reservation.id,
        deliveryGroupId: group.id,
        pickupLocationId: reservation.material.locationId,
        dropoffLocationId,
        assignedDriverProfileId: driver?.profileId ?? null,
        requestedByUserId: reservation.requesterId,
        status: spec.status,
        requestedAt: dateAt(-1, 10),
        assignedAt: driver ? dateAt(-1, 11) : null,
        arrivedPickupAt: ["PICKED_UP", "ON_THE_WAY", "DELIVERED"].includes(
          spec.status,
        )
          ? dateAt(-1, 12)
          : null,
        pickedUpAt: ["PICKED_UP", "ON_THE_WAY", "DELIVERED"].includes(
          spec.status,
        )
          ? dateAt(-1, 12, 30)
          : null,
        onTheWayAt: ["ON_THE_WAY", "DELIVERED"].includes(spec.status)
          ? dateAt(-1, 13)
          : null,
        arrivedDropoffAt: spec.status === "DELIVERED" ? dateAt(-1, 14) : null,
        deliveredAt: spec.status === "DELIVERED" ? dateAt(-1, 14, 15) : null,
        failedAt:
          spec.status === "AWAITING_RESOLUTION" ? dateAt(-1, 13, 20) : null,
        learnerNote: reservation.deliveryNote,
        driverNote: spec.note,
        failureReason:
          spec.status === "AWAITING_RESOLUTION"
            ? "Pickup was not completed inside the confirmed window."
            : null,
      },
      select: { id: true },
    });

    const changedBy = driver?.userId ?? reservation.requesterId;
    await createDeliveryStatusHistory(delivery.id, spec.status, changedBy);

    if (driver) {
      await prisma.deliveryAssignment.create({
        data: {
          deliveryId: delivery.id,
          driverProfileId: driver.profileId,
          assignedByUserId: driver.userId,
          status: spec.status === "AWAITING_RESOLUTION" ? "RELEASED" : "ACTIVE",
          acceptedAt: dateAt(-1, 11),
          releasedAt:
            spec.status === "AWAITING_RESOLUTION" ? dateAt(-1, 13, 30) : null,
          releaseReason:
            spec.status === "AWAITING_RESOLUTION"
              ? "Released by seed to simulate escalation to admin review."
              : null,
        },
      });

      if (["PICKED_UP", "ON_THE_WAY", "DELIVERED"].includes(spec.status)) {
        await prisma.deliveryLocationPing.createMany({
          data: [
            {
              deliveryId: delivery.id,
              driverProfileId: driver.profileId,
              latitude: 31.9,
              longitude: 35.2,
              accuracyMeters: 12,
              heading: 90,
              speed: 25,
              capturedAt: dateAt(-1, 13),
            },
            {
              deliveryId: delivery.id,
              driverProfileId: driver.profileId,
              latitude: 31.91,
              longitude: 35.21,
              accuracyMeters: 10,
              heading: 95,
              speed: 30,
              capturedAt: dateAt(-1, 13, 10),
            },
          ],
        });
      }
    }
  }
};

const createProjectBuilds = async (context: SeedContext) => {
  const builds = [
    {
      learnerEmail: "majd@learner.com",
      projectKey: "obstacle-avoidance-robot",
      links: [
        {
          componentIncludes: "Arduino",
          materialKey: "wf-majd-arduino-uno-r3",
          reservationKey: "r-majd-arduino-pending",
          status: "RESERVED" as const,
        },
        {
          componentIncludes: "DC gear motors",
          materialKey: "wf-majd-dc-gear-motors",
          reservationKey: "r-majd-motors-accepted",
          status: "RESERVED" as const,
        },
        {
          componentIncludes: "Jumper wires",
          materialKey: "majd-jumper-wires",
          status: "AVAILABLE" as const,
        },
      ],
    },
    {
      learnerEmail: "israa@learner.com",
      projectKey: "fabric-pencil-case",
      links: [
        {
          componentIncludes: "Fabric scraps",
          materialKey: "wf-israa-fabric-scraps",
          reservationKey: "r-israa-fabric-pending",
          status: "RESERVED" as const,
        },
        {
          componentIncludes: "Denim offcuts",
          materialKey: "israa-denim-offcuts",
          status: "AVAILABLE" as const,
        },
      ],
    },
    {
      learnerEmail: "learner@learner.com",
      projectKey: "mini-greenhouse-prototype",
      links: [
        {
          componentIncludes: "Clear acrylic",
          materialKey: "wf-supplier-acrylic-sheets",
          reservationKey: "r-learner-acrylic-awaiting-supplier",
          status: "RESERVED" as const,
        },
        {
          componentIncludes: "PVC pipe",
          materialKey: "wf-supplier-pvc-pipes",
          reservationKey: "r-learner-pvc-resolution",
          status: "RESERVED" as const,
        },
      ],
    },
  ];

  for (const buildSeed of builds) {
    const learnerId = context.users.get(buildSeed.learnerEmail);
    const projectId = context.projects.get(buildSeed.projectKey);
    if (!learnerId || !projectId) continue;

    const build = await prisma.projectBuild.create({
      data: { learnerId, projectId, status: "IN_PROGRESS" },
      select: { id: true },
    });

    const components = await prisma.projectRequiredComponent.findMany({
      where: { projectId },
      select: { id: true, componentName: true },
    });

    for (const component of components) {
      const link = buildSeed.links.find((candidate) =>
        component.componentName
          .toLowerCase()
          .includes(candidate.componentIncludes.toLowerCase()),
      );

      await prisma.projectBuildItem.create({
        data: {
          buildId: build.id,
          requiredComponentId: component.id,
          status: link?.status ?? "MISSING",
          learnerNote: link
            ? "Linked for build checklist testing."
            : "Still missing.",
          linkedMaterialId: link
            ? (context.materials.get(link.materialKey)?.id ?? null)
            : null,
          linkedReservationId: link?.reservationKey
            ? (context.reservations.get(link.reservationKey) ?? null)
            : null,
          linkedMaterialAt: link ? now() : null,
        },
      });
    }
  }
};

const createAdminAndNotificationData = async (context: SeedContext) => {
  const adminId = context.users.get("admin@admin.com");
  const majdSupplierId = context.users.get("majd@supplier.com");
  const israaSupplierId = context.users.get("israa@supplier.com");
  const majdLearnerId = context.users.get("majd@learner.com");
  const driverUserId = context.users.get("driver@driver.com");
  const electronicsCategoryId = context.categories.get(
    "electronics-components",
  );
  const otherCategoryId = context.categories.get("other-reusable");

  if (
    !adminId ||
    !majdSupplierId ||
    !israaSupplierId ||
    !majdLearnerId ||
    !driverUserId
  ) {
    throw new Error("Missing users for admin/notification seed data.");
  }

  await prisma.categoryRequest.create({
    data: {
      requestedName: "Lab Glassware",
      normalizedRequestedName: normalizeSearchText("Lab Glassware"),
      requestedByUserId: majdSupplierId,
      status: "PENDING",
      listingDraftJson: {
        title: "Reusable lab glassware set",
        requestedCategoryName: "Lab Glassware",
        imageUrls: [
          "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=80",
        ],
        _seedMarker: SEED_MARKER,
      },
    },
  });

  await prisma.categoryRequest.create({
    data: {
      requestedName: "Random paid mystery box",
      normalizedRequestedName: normalizeSearchText("Random paid mystery box"),
      requestedByUserId: israaSupplierId,
      status: "REJECTED",
      moderatorNote:
        "Paid materials should use a clear existing category instead of Other.",
      approvedCategoryId: otherCategoryId ?? null,
    },
  });

  await prisma.priceRuleRequest.create({
    data: {
      materialName: "Solar panel scraps",
      normalizedMaterialName: normalizeSearchText("Solar panel scraps"),
      categoryId: electronicsCategoryId ?? null,
      unit: "piece",
      condition: "USED",
      quantity: 3,
      supplierPriceNis: 65,
      requestedByUserId: majdSupplierId,
      status: "PENDING",
      aiSuggestedUnit: "piece",
      aiSuggestedMaxUnitPriceNis: 45,
      aiSuggestedMaxTotalPriceNis: 135,
      aiResultJson: {
        source: "seed",
        seedMarker: SEED_MARKER,
        note: "Pending admin review for a material type not yet in approved taxonomy.",
      },
    },
  });

  await prisma.roleInvitation.create({
    data: {
      targetEmail: "moderator.seed@impactloop.local",
      targetRole: "MODERATOR",
      tokenHash: `${SEED_MARKER}-moderator-token-hash`,
      invitedBy: adminId,
      status: "PENDING",
      sendStatus: "SENT",
      sentAt: dateAt(-1, 10),
      expiresAt: dateAt(7, 10),
      notes: "Realistic seed pending moderator invitation.",
    },
  });

  const reportedMaterial = context.materials.get("supplier-screws-nuts");
  if (reportedMaterial) {
    await prisma.materialReport.create({
      data: {
        materialId: reportedMaterial.id,
        reporterId: majdLearnerId,
        reason: "ITEM_NOT_AVAILABLE",
        note: "Seed report: learner claims the screw box was not available after reservation rejection.",
        status: "PENDING",
      },
    });
  }

  const supplierTargetPickupFailureReservationId = context.reservations.get(
    "r-learner-pvc-resolution",
  );
  if (supplierTargetPickupFailureReservationId) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: supplierTargetPickupFailureReservationId },
      select: {
        ownerId: true,
        deliveries: { select: { id: true }, take: 1 },
      },
    });

    const deliveryId = reservation?.deliveries[0]?.id;
    if (!reservation || !deliveryId) {
      throw new Error(
        "Missing delivery context for supplier-target pickup failure seed.",
      );
    }

    await prisma.noShowReport.create({
      data: {
        reservationId: supplierTargetPickupFailureReservationId,
        deliveryId,
        reporterUserId: driverUserId,
        targetUserId: reservation.ownerId,
        targetRole: "SUPPLIER",
        reasonCode: "PICKUP_FAILED",
        note: "Seed incident: supplier-target pickup failure moved to admin review.",
        pickupWindowStart: dateAt(-1, 10),
        pickupWindowEnd: dateAt(-1, 12),
        status: "PENDING_REVIEW",
      },
    });
  }

  const systemRecoveryReservationId = context.reservations.get(
    "r-majd-motors-accepted",
  );
  if (systemRecoveryReservationId) {
    const reservation = await prisma.reservation.findUnique({
      where: { id: systemRecoveryReservationId },
      select: {
        requesterId: true,
        deliveries: { select: { id: true }, take: 1 },
      },
    });

    const deliveryId = reservation?.deliveries[0]?.id;
    if (!reservation || !deliveryId) {
      throw new Error("Missing delivery context for system recovery seed.");
    }

    await prisma.deliveryAssignment.updateMany({
      where: { deliveryId, status: "ACTIVE" },
      data: {
        status: "RELEASED",
        releasedAt: dateAt(-1, 13),
        releaseReason: "Seeded no-driver recovery scenario.",
      },
    });
    await prisma.delivery.update({
      where: { id: deliveryId },
      data: {
        status: "AWAITING_RESOLUTION",
        assignedDriverProfileId: null,
        assignedAt: null,
        failedAt: dateAt(-1, 13),
        failureReason: "No driver available for the supplier pickup window.",
      },
    });
    await prisma.reservation.update({
      where: { id: systemRecoveryReservationId },
      data: { status: "AWAITING_RESOLUTION" },
    });

    await prisma.noShowReport.create({
      data: {
        reservationId: systemRecoveryReservationId,
        deliveryId,
        reporterUserId: reservation.requesterId,
        targetRole: "SYSTEM",
        reasonCode: "NO_DRIVER_AVAILABLE",
        note: "Seed incident: no driver was available for the pickup window.",
        pickupWindowStart: dateAt(-1, 10),
        pickupWindowEnd: dateAt(-1, 12),
        status: "PENDING_REVIEW",
      },
    });
  }

  const accountabilityReservationId = context.reservations.get(
    "r-majd-breadboard-completed",
  );
  if (accountabilityReservationId) {
    await prisma.noShowReport.create({
      data: {
        reservationId: accountabilityReservationId,
        reporterUserId: majdSupplierId,
        targetUserId: majdLearnerId,
        targetRole: "LEARNER",
        reasonCode: "REPEATED_DELAY",
        note: "Seed incident: repeated pickup coordination delays.",
        status: "PENDING_REVIEW",
      },
    });
  }

  const completedReservation = context.reservations.get(
    "r-israa-paint-completed",
  );
  if (completedReservation && israaSupplierId) {
    await prisma.review.create({
      data: {
        reservationId: completedReservation,
        reviewerId: context.users.get("israa@learner.com")!,
        reviewedUserId: israaSupplierId,
        targetType: "SUPPLIER",
        rating: 5,
        comment: "Paint was well packed and useful for the project.",
      },
    });
  }

  const notifications = [
    {
      userId: majdSupplierId,
      type: "RESERVATION_REQUESTED",
      title: "New Arduino reservation",
      body: "Majd Learner requested Arduino Uno R3 Boards for a robotics project.",
      entityType: "RESERVATION",
      entityKey: "r-majd-arduino-pending",
    },
    {
      userId: majdLearnerId,
      type: "DELIVERY_WAITING_FOR_DRIVER",
      title: "Delivery request opened",
      body: "Your Arduino delivery is waiting for an available driver.",
      entityType: "DELIVERY",
      entityKey: null,
    },
    {
      userId: adminId,
      type: "ADMIN_REVIEW_REQUIRED",
      title: "Delivery moved to admin review",
      body: "A PVC pipe delivery needs admin resolution after a pickup issue.",
      entityType: "RESERVATION",
      entityKey: "r-learner-pvc-resolution",
    },
    {
      userId: driverUserId,
      type: "DRIVER_ASSIGNMENT_AVAILABLE",
      title: "Open delivery nearby",
      body: "A learner delivery request is waiting for a driver in your area.",
      entityType: "DELIVERY",
      entityKey: null,
    },
  ];

  for (const notification of notifications) {
    await prisma.notification.create({
      data: {
        userId: notification.userId,
        notificationType: notification.type,
        title: notification.title,
        body: notification.body,
        relatedEntityType: notification.entityType,
        relatedEntityId: notification.entityKey
          ? (context.reservations.get(notification.entityKey) ?? null)
          : null,
        entityType: notification.entityType,
        entityId: notification.entityKey
          ? (context.reservations.get(notification.entityKey) ?? null)
          : null,
        eventKey: notification.entityKey
          ? `seed:${notification.type}:${notification.userId}:${context.reservations.get(notification.entityKey) ?? notification.entityKey}`
          : null,
        actionType:
          notification.type === "RESERVATION_REQUESTED"
            ? "REVIEW_RESERVATION"
            : null,
        isRead: false,
      },
    });
  }

  await prisma.adminActivityLog.createMany({
    data: [
      {
        actorUserId: adminId,
        action: "SEED_REVIEW_CATEGORY_REQUEST",
        targetType: "CATEGORY_REQUEST",
        targetLabel: "Seed category review queue initialized",
        metadata: { seed: true, marker: SEED_MARKER },
      },
      {
        actorUserId: adminId,
        action: "SEED_REVIEW_DELIVERY_INCIDENT",
        targetType: "NO_SHOW_REPORT",
        targetLabel: "Seed delivery incident initialized",
        metadata: { seed: true, marker: SEED_MARKER },
      },
    ],
  });
};

const main = async () => {
  if (EXTRA_LEARNERS.length !== 288) {
    throw new Error(
      `Expected 288 additional learners, found ${EXTRA_LEARNERS.length}.`,
    );
  }
  if (MATERIALS.length !== 155) {
    throw new Error(`Expected 155 primary materials, found ${MATERIALS.length}.`);
  }
  if (PROJECTS.length !== 30) {
    throw new Error(`Expected 30 learning projects, found ${PROJECTS.length}.`);
  }

  await resetDatabase();

  const passwordHash = await hashPassword(SEED_PASSWORD);
  const context: SeedContext = {
    users: new Map(),
    suppliers: new Map(),
    drivers: new Map(),
    categories: new Map(),
    materials: new Map(),
    materialTypes: new Map(),
    projects: new Map(),
    reservations: new Map(),
    learnerDropoffs: new Map(),
  };

  context.categories = await createMaterialCategories();
  await createUsers(passwordHash, context);
  await createMaterials(context);
  await createProjects(context);
  await seedTaxonomyFoundation();
  await seedTaxonomyCompatibilityRelations();
  const engagementCounts = await createLearnerEngagement(context);
  await createReservations(context);
  await createDeliveries(context);
  await createProjectBuilds(context);
  await createAdminAndNotificationData(context);

  const totalUsers = await prisma.user.count();
  const totalProjects = await prisma.learningProject.count();
  const totalMaterials = await prisma.material.count();

  const materialStatusCounts = await prisma.material.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const materialStatusSummary = Object.fromEntries(
    materialStatusCounts.map((entry) => [entry.status, entry._count._all]),
  );
  const availableMaterials =
    materialStatusCounts.find((entry) => entry.status === "AVAILABLE")?._count
      ._all ?? 0;
  const nonAvailableMaterials = Object.entries(materialStatusSummary)
    .filter(([status]) => status !== "AVAILABLE")
    .reduce((total, [, count]) => total + count, 0);

  const summary = {
    seedMarker: SEED_MARKER,
    resetApplied: true,
    passwordForAllAccounts: SEED_PASSWORD,
    usersSeeded: totalUsers,
    expectedUsers: 300,
    primaryMaterialsInDatabase: totalMaterials,
    learningProjectsInDatabase: totalProjects,
    supplierVerificationStatus: "APPROVED",
    learnerInterests: LEARNERS.map((learner) => ({
      email: learner.email,
      interests: [...learner.interests],
    })),
    engagementCounts,
    learners: LEARNERS.map((learner) => learner.email),
    suppliers: SUPPLIERS.map((supplier) => supplier.email),
    drivers: DRIVERS.map((driver) => driver.email),
    admins: ADMINS.map((admin) => admin.email),
    materialCategories: MATERIAL_CATEGORIES.length,
    projectCategories: PROJECT_CATEGORIES.length,
    primaryMaterialsSeeded: MATERIALS.length,
    workflowMaterialCopiesSeeded: WORKFLOW_MATERIAL_COPIES.length,
    materialsSeeded: MATERIALS.length + WORKFLOW_MATERIAL_COPIES.length,
    materialStatusSummary,
    availableMaterials,
    nonAvailableMaterials,
    materialsPerSupplier: SUPPLIERS.map((supplier) => ({
      supplier: supplier.email,
      primaryCount: MATERIALS.filter(
        (material) => material.supplierEmail === supplier.email,
      ).length,
      workflowCopyCount: WORKFLOW_MATERIAL_COPIES.filter((copy) => {
        const source = MATERIALS.find(
          (material) => material.key === copy.sourceKey,
        );
        return source?.supplierEmail === supplier.email;
      }).length,
    })),
    learningProjectsSeeded: PROJECTS.length,
    reservationsSeeded: RESERVATIONS.length,
    deliveriesSeeded: DELIVERIES.length,
    command: "cd apps/backend && npm run seed",
  };

  console.log(JSON.stringify(summary, null, 2));
};

try {
  if (process.argv.includes('--project-budget-demo')) {
    const summary = await seedProjectBudgetDemo();
    console.log(JSON.stringify(summary, null, 2));
  } else {
    await main();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
