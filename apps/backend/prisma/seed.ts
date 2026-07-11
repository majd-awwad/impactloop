import { Prisma } from '../src/generated/prisma/client.js';
import { prisma } from '../src/database/prisma.js';
import { hashPassword } from '../src/utils/password.js';
import { normalizeSearchText } from '../src/utils/normalize-search-text.js';

const SEED_PASSWORD = 'password';
const CURRENCY = 'NIS';
const SEED_MARKER = '[realistic-impactloop-seed]';

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
};

const jsonArray = (value: string[] | undefined): Prisma.InputJsonValue =>
  value == null ? Prisma.JsonNull : value;

const shouldBlockReset = (): boolean => {
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase() ?? '';

  return (
    nodeEnv === 'production' ||
    databaseUrl.includes('prod') ||
    databaseUrl.includes('production')
  );
};

const resetDatabase = async () => {
  if (shouldBlockReset()) {
    throw new Error(
      'Refusing to reset database because NODE_ENV/DATABASE_URL looks like production.',
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
    .join(', ');

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${quotedTableNames} RESTART IDENTITY CASCADE;`,
  );
};

const MATERIAL_CATEGORIES = [
  {
    key: 'electronics-components',
    nameEn: 'Electronics & Components',
    nameAr: 'إلكترونيات وقطع إلكترونية',
  },
  {
    key: 'motors-mechanical',
    nameEn: 'Motors & Mechanical Parts',
    nameAr: 'محركات وقطع ميكانيكية',
  },
  {
    key: 'power-batteries',
    nameEn: 'Power & Batteries',
    nameAr: 'طاقة وبطاريات',
  },
  { key: 'wood-boards', nameEn: 'Wood & Boards', nameAr: 'خشب وألواح' },
  {
    key: 'plastics-acrylic',
    nameEn: 'Plastics & Acrylic',
    nameAr: 'بلاستيك وأكريليك',
  },
  { key: 'metal-fasteners', nameEn: 'Metal & Fasteners', nameAr: 'معادن ومثبتات' },
  { key: 'fabric-textiles', nameEn: 'Fabric & Textiles', nameAr: 'أقمشة ومنسوجات' },
  { key: 'paper-cardboard', nameEn: 'Paper & Cardboard', nameAr: 'ورق وكرتون' },
  { key: 'tools-hardware', nameEn: 'Tools & Hardware', nameAr: 'أدوات وعدد' },
  {
    key: 'art-craft-supplies',
    nameEn: 'Art & Craft Supplies',
    nameAr: 'مستلزمات فن وحرف',
  },
  {
    key: 'packaging-containers',
    nameEn: 'Packaging & Containers',
    nameAr: 'تغليف وحاويات',
  },
  {
    key: 'lab-education',
    nameEn: 'Lab & Education Supplies',
    nameAr: 'مستلزمات مختبر وتعليم',
  },
  {
    key: 'other-reusable',
    nameEn: 'Other Reusable Materials',
    nameAr: 'مواد أخرى قابلة لإعادة الاستخدام',
  },
] as const;

const PROJECT_CATEGORIES = [
  { key: 'robotics', nameEn: 'Robotics', nameAr: 'روبوتات' },
  { key: 'electronics-learning', nameEn: 'Electronics', nameAr: 'إلكترونيات' },
  { key: 'recycling-crafts', nameEn: 'Recycling Crafts', nameAr: 'حرف إعادة التدوير' },
  { key: 'woodworking', nameEn: 'Woodworking', nameAr: 'أعمال خشبية' },
  { key: 'home-experiments', nameEn: 'Home Experiments', nameAr: 'تجارب منزلية' },
  { key: 'textile-crafts', nameEn: 'Textile Crafts', nameAr: 'حرف نسيجية' },
] as const;

const IMAGES = {
  arduino:
    'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=1200&q=80',
  electronics:
    'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
  components:
    'https://images.unsplash.com/photo-1581092335397-9583eb92d232?auto=format&fit=crop&w=1200&q=80',
  breadboard:
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80',
  motors:
    'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=1200&q=80',
  workshop:
    'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80',
  cables:
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1200&q=80',
  wood:
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
  woodPanels:
    'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
  acrylic:
    'https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&w=1200&q=80',
  cardboard:
    'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1200&q=80',
  fabric:
    'https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=1200&q=80',
  textile:
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  craft:
    'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1200&q=80',
  paint:
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=1200&q=80',
  jars:
    'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?auto=format&fit=crop&w=1200&q=80',
  metal:
    'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1200&q=80',
  tools:
    'https://images.unsplash.com/photo-1581147036324-c1c89c2c8b5c?auto=format&fit=crop&w=1200&q=80',
  pipes:
    'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=1200&q=80',
  robotProject:
    'https://images.unsplash.com/photo-1561144257-e32e8efc6c4f?auto=format&fit=crop&w=1200&q=80',
  greenhouse:
    'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80',
  sewing:
    'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=1200&q=80',
} as const;

type SupplierSeed = {
  email: string;
  displayName: string;
  publicName: string;
  supplierType: string;
  organizationType: 'WORKSHOP' | 'FACTORY' | 'EDUCATIONAL_INSTITUTION';
  city: string;
  area: string;
  addressLine: string;
  latitude: number;
  longitude: number;
  description: string;
};

const SUPPLIERS: SupplierSeed[] = [
  {
    email: 'majd@supplier.com',
    displayName: 'Majd Tech Reuse',
    publicName: 'Majd Tech Reuse Workshop',
    supplierType: 'WORKSHOP',
    organizationType: 'WORKSHOP',
    city: 'Hebron',
    area: 'University District',
    addressLine: 'Near Hebron University main gate',
    latitude: 31.5326,
    longitude: 35.0998,
    description:
      'Small electronics and robotics reuse workshop offering tested components for student projects.',
  },
  {
    email: 'israa@supplier.com',
    displayName: 'Israa Creative Reuse',
    publicName: 'Israa Creative Materials Studio',
    supplierType: 'INDIVIDUAL_SUPPLIER',
    organizationType: 'WORKSHOP',
    city: 'Ramallah',
    area: 'Al-Tireh',
    addressLine: 'Al-Tireh creative studio area',
    latitude: 31.9038,
    longitude: 35.2034,
    description:
      'Creative reuse studio sharing textile, craft, packaging, and recycled materials for makers.',
  },
  {
    email: 'supplier@supplier.com',
    displayName: 'Nablus Build Surplus',
    publicName: 'Nablus Build Surplus Depot',
    supplierType: 'FACTORY',
    organizationType: 'FACTORY',
    city: 'Nablus',
    area: 'Industrial Area',
    addressLine: 'Nablus industrial surplus pickup point',
    latitude: 32.2211,
    longitude: 35.2544,
    description:
      'Workshop and factory surplus depot with reusable wood, plastic, metal, hardware, and build parts.',
  },
];

const LEARNERS = [
  {
    email: 'majd@learner.com',
    displayName: 'Majd Learner',
    city: 'Hebron',
    area: 'University District',
    interests: ['Electronics', 'Robotics', 'Arduino', 'Recycling'],
    skillLevel: 'INTERMEDIATE',
  },
  {
    email: 'israa@learner.com',
    displayName: 'Israa Learner',
    city: 'Ramallah',
    area: 'Al-Tireh',
    interests: ['Fabric', 'Art & Crafts', 'Recycling', 'Textiles'],
    skillLevel: 'BEGINNER',
  },
  {
    email: 'learner@learner.com',
    displayName: 'ImpactLoop Learner',
    city: 'Nablus',
    area: 'Rafidia',
    interests: ['Woodworking', 'Home DIY', 'Recycling', 'Sustainability'],
    skillLevel: 'BEGINNER',
  },
] as const;

const DRIVERS = [
  {
    email: 'majd@driver.com',
    displayName: 'Majd Driver',
    phone: '+970599000101',
    city: 'Hebron',
    area: 'University District',
    transportationType: 'CAR' as const,
    vehicleType: 'CAR',
    vehicleLabel: 'White compact car',
    vehiclePlate: 'IL-DRV-101',
  },
  {
    email: 'israa@driver.com',
    displayName: 'Israa Driver',
    phone: '+970599000102',
    city: 'Ramallah',
    area: 'Al-Tireh',
    transportationType: 'MOTORCYCLE' as const,
    vehicleType: 'MOTORCYCLE',
    vehicleLabel: 'Green delivery motorcycle',
    vehiclePlate: 'IL-DRV-102',
  },
  {
    email: 'driver@driver.com',
    displayName: 'ImpactLoop Driver',
    phone: '+970599000103',
    city: 'Nablus',
    area: 'Rafidia',
    transportationType: 'CAR' as const,
    vehicleType: 'CAR',
    vehicleLabel: 'Silver hatchback',
    vehiclePlate: 'IL-DRV-103',
  },
] as const;

const ADMINS = [
  { email: 'majd@admin.com', displayName: 'Majd Admin' },
  { email: 'israa@admin.com', displayName: 'Israa Admin' },
  { email: 'admin@admin.com', displayName: 'ImpactLoop Admin' },
] as const;

type MaterialSeed = {
  key: string;
  supplierEmail: string;
  title: string;
  description: string;
  categoryKey: (typeof MATERIAL_CATEGORIES)[number]['key'];
  materialType: string;
  aliases?: string[];
  quantity: number;
  unit: string;
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'USED' | 'NEEDS_REPAIR';
  sourceType: 'STUDENT_LEFTOVER' | 'WORKSHOP_SURPLUS' | 'FACTORY_SURPLUS' | 'EDUCATIONAL_INSTITUTION';
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

const MATERIALS: MaterialSeed[] = [
  {
    key: 'majd-arduino-uno-r3',
    supplierEmail: 'majd@supplier.com',
    title: 'Arduino Uno R3 Boards',
    description:
      'Tested Arduino Uno R3 boards from a university lab cabinet. Good for robotics, sensors, and basic control projects.',
    categoryKey: 'electronics-components',
    materialType: 'Arduino Uno',
    aliases: ['Arduino', 'Microcontroller board', 'Arduino Uno R3'],
    quantity: 8,
    unit: 'pieces',
    condition: 'LIKE_NEW',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 45,
    maxAllowedUnitPriceNis: 70,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.arduino, IMAGES.electronics],
    tags: ['arduino', 'microcontroller', 'robotics'],
    suggestedUses: 'Robot cars, LED circuits, sensor prototypes, classroom labs.',
    viewsCount: 64,
  },
  {
    key: 'majd-ultrasonic-hcsr04',
    supplierEmail: 'majd@supplier.com',
    title: 'HC-SR04 Ultrasonic Sensors',
    description:
      'Distance sensors sorted and labeled after robotics workshops. Each sensor was checked with a simple Arduino test.',
    categoryKey: 'electronics-components',
    materialType: 'Ultrasonic Sensor',
    aliases: ['HC-SR04', 'Distance sensor'],
    quantity: 12,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.workshop],
    tags: ['sensor', 'ultrasonic', 'distance'],
    suggestedUses: 'Obstacle avoidance robots, distance measuring demos, smart bins.',
    viewsCount: 42,
  },
  {
    key: 'majd-breadboard-kit',
    supplierEmail: 'majd@supplier.com',
    title: 'Half-Size Breadboard Kits',
    description:
      'Clean reusable breadboards with adhesive backs removed. Suitable for quick electronics experiments.',
    categoryKey: 'electronics-components',
    materialType: 'Breadboard',
    aliases: ['Prototype board', 'Prototyping board'],
    quantity: 15,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 18,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.breadboard],
    tags: ['breadboard', 'prototype', 'electronics'],
    suggestedUses: 'LED circuits, sensor wiring, quick lab prototypes.',
    viewsCount: 39,
  },
  {
    key: 'majd-jumper-wires',
    supplierEmail: 'majd@supplier.com',
    title: 'Assorted Jumper Wires Bundle',
    description:
      'Male-to-male, male-to-female, and female-to-female jumper wires grouped into reusable packs.',
    categoryKey: 'electronics-components',
    materialType: 'Jumper Wires',
    aliases: ['Dupont wires', 'Wire pack'],
    quantity: 20,
    unit: 'packs',
    condition: 'LIKE_NEW',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 10,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cables, IMAGES.electronics],
    tags: ['jumper wires', 'dupont', 'wiring'],
    suggestedUses: 'Breadboard circuits, Arduino labs, sensor wiring.',
    viewsCount: 55,
  },
  {
    key: 'majd-resistor-box',
    supplierEmail: 'majd@supplier.com',
    title: 'Resistor Assortment Boxes',
    description:
      'Labeled resistor boxes with common values used in beginner electronics courses.',
    categoryKey: 'electronics-components',
    materialType: 'Resistor Pack',
    aliases: ['Resistors', 'Passive components'],
    quantity: 7,
    unit: 'boxes',
    condition: 'LIKE_NEW',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ['resistors', 'components', 'circuit'],
    suggestedUses: 'LED protection, voltage dividers, electronics training kits.',
    viewsCount: 31,
  },
  {
    key: 'majd-led-pack',
    supplierEmail: 'majd@supplier.com',
    title: 'Mixed Color LED Packs',
    description:
      'Reusable LED packs in red, green, blue, yellow, and white for classroom experiments.',
    categoryKey: 'electronics-components',
    materialType: 'LED Pack',
    aliases: ['LEDs', 'Light emitting diodes'],
    quantity: 12,
    unit: 'packs',
    condition: 'NEW',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components, IMAGES.electronics],
    tags: ['led', 'light', 'circuit'],
    suggestedUses: 'LED circuits, indicators, model lighting, art installations.',
    viewsCount: 48,
  },
  {
    key: 'majd-dc-gear-motors',
    supplierEmail: 'majd@supplier.com',
    title: 'Small DC Gear Motors Pair',
    description:
      'Small DC gear motors removed from retired robotics kits and tested with a battery pack.',
    categoryKey: 'motors-mechanical',
    materialType: 'DC Motor',
    aliases: ['DC gear motor', 'Robot motor'],
    quantity: 10,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 16,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ['dc motor', 'robotics', 'motion'],
    suggestedUses: 'Robot cars, small fans, motion prototypes.',
    viewsCount: 73,
  },
  {
    key: 'majd-servo-sg90',
    supplierEmail: 'majd@supplier.com',
    title: 'SG90 Micro Servo Motors',
    description:
      'Micro servo motors from student kits. Good for simple arms, gates, and angle-control prototypes.',
    categoryKey: 'motors-mechanical',
    materialType: 'Servo Motor',
    aliases: ['SG90 servo', 'Micro servo'],
    quantity: 9,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: false,
    price: 20,
    maxAllowedUnitPriceNis: 35,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.motors, IMAGES.components],
    tags: ['servo', 'actuator', 'robotics'],
    suggestedUses: 'Robotic arms, automatic gates, sensor scanners.',
    viewsCount: 44,
  },
  {
    key: 'israa-wax-molds',
    supplierEmail: 'israa@supplier.com',
    title: 'Wax Molds Set',
    description:
      'Reusable wax and candle molds for craft workshops and handmade art projects.',
    categoryKey: 'art-craft-supplies',
    materialType: 'Wax Molds',
    aliases: ['Wax mold', 'Candle molds'],
    quantity: 8,
    unit: 'sets',
    condition: 'GOOD',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [
      'https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=1200&q=80',
    ],
    tags: ['wax mold', 'craft project', 'handmade', 'art project'],
    suggestedUses: 'Candle making, handmade crafts, classroom art workshops.',
    viewsCount: 31,
  },
  {
    key: 'majd-battery-holders',
    supplierEmail: 'majd@supplier.com',
    title: 'AA and 9V Battery Holders',
    description:
      'Battery holders with attached leads, collected from unused student project kits.',
    categoryKey: 'power-batteries',
    materialType: 'Battery Holder',
    aliases: ['Battery clip', 'Power accessory'],
    quantity: 18,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'EDUCATIONAL_INSTITUTION',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.components],
    tags: ['battery', 'power', 'holder'],
    suggestedUses: 'Portable Arduino circuits, LED projects, small robot power.',
    viewsCount: 22,
  },
  {
    key: 'majd-laptop-cooling-fans',
    supplierEmail: 'majd@supplier.com',
    title: 'Reused Laptop Cooling Fans',
    description:
      'Small DC fans salvaged from damaged laptops. Tested for spin and basic airflow.',
    categoryKey: 'electronics-components',
    materialType: 'Cooling Fan',
    aliases: ['Laptop fan', 'Small DC fan'],
    quantity: 6,
    unit: 'pieces',
    condition: 'USED',
    sourceType: 'STUDENT_LEFTOVER',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.electronics],
    tags: ['fan', 'cooling', 'reuse'],
    suggestedUses: 'Mini ventilation, cooling demos, air-flow prototypes.',
    viewsCount: 17,
  },
  {
    key: 'israa-fabric-scraps',
    supplierEmail: 'israa@supplier.com',
    title: 'Mixed Fabric Scraps Bags',
    description:
      'Clean mixed fabric scraps sorted by size and color for sewing, textile experiments, and craft projects.',
    categoryKey: 'fabric-textiles',
    materialType: 'Fabric Scraps',
    aliases: ['Textile scraps', 'Fabric remnants'],
    quantity: 14,
    unit: 'bags',
    condition: 'GOOD',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.fabric, IMAGES.textile],
    tags: ['fabric', 'textile', 'sewing', 'upcycling'],
    suggestedUses: 'Pencil cases, patchwork, small bags, textile art.',
    viewsCount: 61,
  },
  {
    key: 'israa-denim-offcuts',
    supplierEmail: 'israa@supplier.com',
    title: 'Denim Offcuts Bundle',
    description:
      'Strong denim offcuts from tailoring leftovers. Useful for durable textile crafts.',
    categoryKey: 'fabric-textiles',
    materialType: 'Denim Offcuts',
    aliases: ['Denim scraps', 'Jeans fabric'],
    quantity: 9,
    unit: 'bundles',
    condition: 'GOOD',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: false,
    price: 12,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.textile],
    tags: ['denim', 'fabric', 'sewing'],
    suggestedUses: 'Pencil cases, patches, small wallets, durable covers.',
    viewsCount: 36,
  },
  {
    key: 'israa-felt-sheets',
    supplierEmail: 'israa@supplier.com',
    title: 'Felt Sheets Leftovers',
    description:
      'Colorful felt sheet leftovers from art workshops, mostly A4 and half-A4 sizes.',
    categoryKey: 'fabric-textiles',
    materialType: 'Felt Sheets',
    aliases: ['Felt leftovers', 'Craft felt'],
    quantity: 22,
    unit: 'sheets',
    condition: 'LIKE_NEW',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: false,
    price: 6,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ['felt', 'craft', 'textile'],
    suggestedUses: 'Decorations, soft models, school craft boards.',
    viewsCount: 29,
  },
  {
    key: 'israa-cardboard-sheets',
    supplierEmail: 'israa@supplier.com',
    title: 'Large Cardboard Sheets Pack',
    description:
      'Flat cardboard sheets from packaging surplus, kept dry and ready for model making.',
    categoryKey: 'paper-cardboard',
    materialType: 'Cardboard Sheets',
    aliases: ['Carton sheets', 'Cardboard'],
    quantity: 35,
    unit: 'sheets',
    condition: 'GOOD',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 5,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.cardboard],
    tags: ['cardboard', 'model', 'recycling', 'craft', 'art project'],
    suggestedUses: 'Desk organizers, architectural models, recycled prototypes.',
    viewsCount: 52,
  },
  {
    key: 'israa-cardboard-tubes',
    supplierEmail: 'israa@supplier.com',
    title: 'Corrugated Cardboard Tubes',
    description:
      'Strong cardboard tubes from fabric rolls, suitable for structural craft builds.',
    categoryKey: 'paper-cardboard',
    materialType: 'Cardboard Tubes',
    aliases: ['Paper tubes', 'Roll cores'],
    quantity: 18,
    unit: 'pieces',
    condition: 'USED',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 4,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.cardboard],
    tags: ['tube', 'cardboard', 'craft'],
    suggestedUses: 'Desk organizers, towers, columns, marble runs.',
    viewsCount: 27,
  },
  {
    key: 'israa-bottle-caps',
    supplierEmail: 'israa@supplier.com',
    title: 'Sorted Plastic Bottle Caps Bag',
    description:
      'Washed plastic bottle caps sorted by color for recycling art and classroom counting activities.',
    categoryKey: 'packaging-containers',
    materialType: 'Bottle Caps',
    aliases: ['Plastic caps', 'Bottle lids'],
    quantity: 11,
    unit: 'bags',
    condition: 'GOOD',
    sourceType: 'STUDENT_LEFTOVER',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 5,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ['plastic caps', 'recycling', 'art'],
    suggestedUses: 'Mosaics, sorting games, wheels for small cardboard cars.',
    viewsCount: 18,
  },
  {
    key: 'israa-glass-jars',
    supplierEmail: 'israa@supplier.com',
    title: 'Clean Glass Jars Set',
    description:
      'Clean glass jars with lids removed from event catering leftovers. Good for storage and plant projects.',
    categoryKey: 'packaging-containers',
    materialType: 'Glass Jars',
    aliases: ['Mason jars', 'Reusable jars'],
    quantity: 24,
    unit: 'pieces',
    condition: 'LIKE_NEW',
    sourceType: 'STUDENT_LEFTOVER',
    isFree: false,
    price: 3,
    maxAllowedUnitPriceNis: 6,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.jars],
    tags: ['jars', 'storage', 'reuse'],
    suggestedUses: 'Mini planters, storage jars, candle holders, science samples.',
    viewsCount: 34,
  },
  {
    key: 'israa-acrylic-paint',
    supplierEmail: 'israa@supplier.com',
    title: 'Acrylic Paint Leftovers Set',
    description:
      'Partially used acrylic paint bottles from workshops. Bottles still close well and colors are labeled.',
    categoryKey: 'art-craft-supplies',
    materialType: 'Acrylic Paint',
    aliases: ['Paint supplies', 'Craft paint'],
    quantity: 8,
    unit: 'sets',
    condition: 'USED',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: false,
    price: 18,
    maxAllowedUnitPriceNis: 25,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.paint],
    tags: ['paint', 'craft', 'art'],
    suggestedUses: 'Cardboard models, wood decoration, classroom art boards.',
    viewsCount: 46,
  },
  {
    key: 'israa-wooden-sticks',
    supplierEmail: 'israa@supplier.com',
    title: 'Wooden Craft Sticks Bundle',
    description:
      'Wooden craft sticks in mixed sizes for lightweight structure and model projects.',
    categoryKey: 'art-craft-supplies',
    materialType: 'Wooden Craft Sticks',
    aliases: ['Popsicle sticks', 'Craft sticks'],
    quantity: 16,
    unit: 'bundles',
    condition: 'NEW',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: false,
    price: 7,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.craft],
    tags: ['wooden sticks', 'craft', 'model'],
    suggestedUses: 'Bridges, rubber band cars, mini houses, craft frames.',
    viewsCount: 25,
  },
  {
    key: 'israa-foam-board',
    supplierEmail: 'israa@supplier.com',
    title: 'Reused Foam Board Pieces',
    description:
      'Foam board offcuts from presentation displays, still flat enough for prototypes and signs.',
    categoryKey: 'plastics-acrylic',
    materialType: 'Foam Board',
    aliases: ['Foam core', 'Display board'],
    quantity: 19,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.craft],
    tags: ['foam board', 'prototype', 'display'],
    suggestedUses: 'Mockups, science fair boards, lightweight enclosures.',
    viewsCount: 20,
  },
  {
    key: 'supplier-plywood-panels',
    supplierEmail: 'supplier@supplier.com',
    title: 'Reclaimed Plywood Panels',
    description:
      'Clean plywood panels reclaimed from temporary shelving. Edges are rough but panels are usable.',
    categoryKey: 'wood-boards',
    materialType: 'Plywood Sheet',
    aliases: ['Plywood panel', 'Wood board'],
    quantity: 12,
    unit: 'panels',
    condition: 'USED',
    sourceType: 'FACTORY_SURPLUS',
    isFree: false,
    price: 24,
    maxAllowedUnitPriceNis: 35,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.woodPanels, IMAGES.wood],
    tags: ['plywood', 'wood', 'boards'],
    suggestedUses: 'Phone stands, small shelves, prototypes, model bases.',
    viewsCount: 58,
  },
  {
    key: 'supplier-mdf-offcuts',
    supplierEmail: 'supplier@supplier.com',
    title: 'MDF Offcuts Bundle',
    description:
      'MDF offcuts in different small sizes from workshop cutting jobs. Good for indoor prototypes.',
    categoryKey: 'wood-boards',
    materialType: 'MDF Offcuts',
    aliases: ['MDF scraps', 'Fiberboard pieces'],
    quantity: 20,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 7,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.wood],
    tags: ['mdf', 'offcuts', 'wood'],
    suggestedUses: 'Bases, phone stands, model parts, small jigs.',
    viewsCount: 33,
  },
  {
    key: 'supplier-pine-strips',
    supplierEmail: 'supplier@supplier.com',
    title: 'Pine Wood Strips',
    description:
      'Long narrow pine strips from furniture manufacturing leftovers, useful for frames and light structures.',
    categoryKey: 'wood-boards',
    materialType: 'Pine Wood Strips',
    aliases: ['Wood strips', 'Timber strips'],
    quantity: 30,
    unit: 'strips',
    condition: 'GOOD',
    sourceType: 'FACTORY_SURPLUS',
    isFree: false,
    price: 5,
    maxAllowedUnitPriceNis: 8,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.wood],
    tags: ['pine', 'wood strips', 'frame'],
    suggestedUses: 'Greenhouse frames, small bridges, craft structures.',
    viewsCount: 41,
  },
  {
    key: 'supplier-acrylic-sheets',
    supplierEmail: 'supplier@supplier.com',
    title: 'Clear Acrylic Sheet Offcuts',
    description:
      'Clear acrylic offcuts with protective film on some pieces. Sizes vary from small to medium.',
    categoryKey: 'plastics-acrylic',
    materialType: 'Acrylic Sheet',
    aliases: ['Plexiglass', 'Clear plastic sheet'],
    quantity: 14,
    unit: 'sheets',
    condition: 'GOOD',
    sourceType: 'FACTORY_SURPLUS',
    isFree: false,
    price: 22,
    maxAllowedUnitPriceNis: 30,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.acrylic, IMAGES.workshop],
    tags: ['acrylic', 'plastic', 'sheet'],
    suggestedUses: 'Mini greenhouse covers, enclosures, display panels.',
    viewsCount: 67,
  },
  {
    key: 'supplier-pvc-pipes',
    supplierEmail: 'supplier@supplier.com',
    title: 'PVC Pipe Short Pieces',
    description:
      'Short PVC pipe pieces from plumbing leftovers. Ends may need trimming before use.',
    categoryKey: 'plastics-acrylic',
    materialType: 'PVC Pipes',
    aliases: ['Plastic pipes', 'PVC tube'],
    quantity: 26,
    unit: 'pieces',
    condition: 'USED',
    sourceType: 'FACTORY_SURPLUS',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.pipes],
    tags: ['pvc', 'pipes', 'structure'],
    suggestedUses: 'Greenhouse frames, stands, water-flow demos, structural prototypes.',
    viewsCount: 38,
  },
  {
    key: 'supplier-aluminum-angles',
    supplierEmail: 'supplier@supplier.com',
    title: 'Aluminum Angle Pieces',
    description:
      'Short aluminum angle pieces from fabrication leftovers. Lightweight and strong for frames.',
    categoryKey: 'metal-fasteners',
    materialType: 'Aluminum Angle',
    aliases: ['Aluminum profile', 'Metal angle'],
    quantity: 17,
    unit: 'pieces',
    condition: 'GOOD',
    sourceType: 'FACTORY_SURPLUS',
    isFree: false,
    price: 9,
    maxAllowedUnitPriceNis: 15,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.metal],
    tags: ['aluminum', 'metal', 'frame'],
    suggestedUses: 'Robot chassis, mini structures, reinforcement brackets.',
    viewsCount: 30,
  },
  {
    key: 'supplier-screws-nuts',
    supplierEmail: 'supplier@supplier.com',
    title: 'Mixed Screws and Nuts Box',
    description:
      'Sorted box of mixed screws, nuts, and washers from workshop surplus. Common small sizes included.',
    categoryKey: 'metal-fasteners',
    materialType: 'Screws and Nuts',
    aliases: ['Fasteners', 'Hardware box'],
    quantity: 9,
    unit: 'boxes',
    condition: 'GOOD',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: false,
    price: 14,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ['screws', 'nuts', 'fasteners'],
    suggestedUses: 'Wood projects, robot chassis, small hardware repairs.',
    viewsCount: 49,
  },
  {
    key: 'supplier-hinges-set',
    supplierEmail: 'supplier@supplier.com',
    title: 'Small Hinges Set',
    description:
      'Small metal hinges removed from display cabinets and workshop prototypes.',
    categoryKey: 'tools-hardware',
    materialType: 'Small Hinges',
    aliases: ['Hinges', 'Door hinge'],
    quantity: 20,
    unit: 'pieces',
    condition: 'USED',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: false,
    price: 6,
    maxAllowedUnitPriceNis: 10,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.tools],
    tags: ['hinge', 'hardware', 'mechanical'],
    suggestedUses: 'Mini greenhouse doors, boxes, moving panels.',
    viewsCount: 21,
  },
  {
    key: 'supplier-drill-bits',
    supplierEmail: 'supplier@supplier.com',
    title: 'Used Hand Drill Bits',
    description:
      'Used but usable drill bits in common small sizes. Suitable for wood and light plastic projects.',
    categoryKey: 'tools-hardware',
    materialType: 'Drill Bits',
    aliases: ['Hand drill bits', 'Tool accessories'],
    quantity: 11,
    unit: 'sets',
    condition: 'USED',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: true,
    price: null,
    maxAllowedUnitPriceNis: 20,
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrls: [IMAGES.tools],
    tags: ['drill', 'bits', 'tools'],
    suggestedUses: 'Preparing holes for wood, acrylic, and small assembly work.',
    viewsCount: 16,
  },
  {
    key: 'supplier-rubber-wheels',
    supplierEmail: 'supplier@supplier.com',
    title: 'Rubber Wheels Set',
    description:
      'Rubber wheels removed from broken carts and old robotics bases. Axle holes vary.',
    categoryKey: 'motors-mechanical',
    materialType: 'Rubber Wheels',
    aliases: ['Robot wheels', 'Cart wheels'],
    quantity: 16,
    unit: 'pieces',
    condition: 'USED',
    sourceType: 'WORKSHOP_SURPLUS',
    isFree: false,
    price: 8,
    maxAllowedUnitPriceNis: 12,
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrls: [IMAGES.motors],
    tags: ['wheels', 'rubber', 'robotics'],
    suggestedUses: 'Robot cars, rubber band cars, moving platforms.',
    viewsCount: 57,
  },
];

type ProjectSeed = {
  key: string;
  authorEmail: string;
  title: string;
  shortDescription: string;
  description: string;
  categoryKey: (typeof PROJECT_CATEGORIES)[number]['key'];
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDurationMinutes: number;
  coverImageUrl: string;
  status: 'PUBLISHED' | 'PENDING_REVIEW';
  components: Array<{
    name: string;
    materialType: string;
    categoryKey?: (typeof MATERIAL_CATEGORIES)[number]['key'];
    quantity: number;
    unit: string;
    role: 'REQUIRED_MATERIAL' | 'OPTIONAL_MATERIAL' | 'TOOL' | 'CONSUMABLE';
    required: boolean;
    substitute: boolean;
    keywords: string[];
    alternatives?: string[];
    notes?: string;
  }>;
  steps: Array<{ title: string; description: string; imageUrl?: string }>;
  links: Array<{ linkType: 'ARTICLE' | 'YOUTUBE' | 'OTHER'; url: string; title: string; sourceName: string }>;
  tags: string[];
};

const PROJECTS: ProjectSeed[] = [
  {
    key: 'obstacle-avoidance-robot',
    authorEmail: 'majd@learner.com',
    title: 'Obstacle Avoidance Robot',
    shortDescription: 'Build a small robot that detects obstacles and turns away automatically.',
    description:
      'A robotics project that connects Arduino, ultrasonic sensing, motors, wiring, and reusable wheels into a working obstacle avoidance robot. It is designed to show how surplus electronics can become a complete learning build.',
    categoryKey: 'robotics',
    difficulty: 'INTERMEDIATE',
    estimatedDurationMinutes: 240,
    coverImageUrl: IMAGES.robotProject,
    status: 'PUBLISHED',
    components: [
      {
        name: 'Arduino board',
        materialType: 'Arduino Uno',
        categoryKey: 'electronics-components',
        quantity: 1,
        unit: 'piece',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['arduino', 'microcontroller', 'uno'],
        alternatives: ['ESP32', 'Arduino Nano'],
      },
      {
        name: 'Ultrasonic distance sensor',
        materialType: 'Ultrasonic Sensor',
        categoryKey: 'electronics-components',
        quantity: 1,
        unit: 'piece',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: false,
        keywords: ['ultrasonic', 'distance sensor', 'hc-sr04'],
      },
      {
        name: 'DC gear motors',
        materialType: 'DC Motor',
        categoryKey: 'motors-mechanical',
        quantity: 2,
        unit: 'pieces',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: false,
        keywords: ['dc motor', 'gear motor', 'robot motor'],
      },
      {
        name: 'Jumper wires',
        materialType: 'Jumper Wires',
        categoryKey: 'electronics-components',
        quantity: 12,
        unit: 'pieces',
        role: 'CONSUMABLE',
        required: true,
        substitute: true,
        keywords: ['jumper wires', 'dupont wires'],
      },
      {
        name: 'Rubber wheels',
        materialType: 'Rubber Wheels',
        categoryKey: 'motors-mechanical',
        quantity: 2,
        unit: 'pieces',
        role: 'OPTIONAL_MATERIAL',
        required: false,
        substitute: true,
        keywords: ['robot wheels', 'rubber wheels'],
      },
    ],
    steps: [
      { title: 'Prepare the base', description: 'Choose a flat base and mark motor and wheel positions.' },
      { title: 'Mount motors and wheels', description: 'Attach the two motors securely and make sure wheels spin freely.' },
      { title: 'Wire Arduino and sensor', description: 'Connect the ultrasonic sensor and motor driver carefully to the Arduino.' },
      { title: 'Upload and test logic', description: 'Upload the test code, then tune turning behavior after obstacle detection.' },
    ],
    links: [
      {
        linkType: 'ARTICLE',
        url: 'https://www.arduino.cc/en/Tutorial/HomePage',
        title: 'Arduino tutorials',
        sourceName: 'Arduino',
      },
    ],
    tags: ['robotics', 'arduino', 'sensors'],
  },
  {
    key: 'simple-led-circuit',
    authorEmail: 'majd@learner.com',
    title: 'Simple LED Circuit',
    shortDescription: 'Learn current flow by building a safe LED circuit on a breadboard.',
    description:
      'A beginner electronics project using a breadboard, LED, resistor, jumper wires, and battery holder. It teaches polarity, resistance, and safe circuit testing.',
    categoryKey: 'electronics-learning',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 60,
    coverImageUrl: IMAGES.electronics,
    status: 'PUBLISHED',
    components: [
      {
        name: 'Breadboard',
        materialType: 'Breadboard',
        categoryKey: 'electronics-components',
        quantity: 1,
        unit: 'piece',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: false,
        keywords: ['breadboard', 'prototype board'],
      },
      {
        name: 'LED',
        materialType: 'LED Pack',
        categoryKey: 'electronics-components',
        quantity: 1,
        unit: 'piece',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['led', 'light emitting diode'],
      },
      {
        name: 'Resistor',
        materialType: 'Resistor Pack',
        categoryKey: 'electronics-components',
        quantity: 1,
        unit: 'piece',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['resistor', '220 ohm'],
      },
      {
        name: 'Battery holder',
        materialType: 'Battery Holder',
        categoryKey: 'power-batteries',
        quantity: 1,
        unit: 'piece',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['battery holder', 'battery clip'],
      },
    ],
    steps: [
      { title: 'Place the LED', description: 'Put the LED legs in separate breadboard rows and identify polarity.' },
      { title: 'Add resistor in series', description: 'Connect a resistor to protect the LED from high current.' },
      { title: 'Connect power', description: 'Use the battery holder and jumper wires to complete the circuit.' },
      { title: 'Test safely', description: 'Check that the LED lights without overheating the resistor.' },
    ],
    links: [
      {
        linkType: 'ARTICLE',
        url: 'https://www.arduino.cc/en/Tutorial/BuiltInExamples/Blink',
        title: 'Blink circuit reference',
        sourceName: 'Arduino',
      },
    ],
    tags: ['electronics', 'beginner', 'led'],
  },
  {
    key: 'recycled-desk-organizer',
    authorEmail: 'israa@learner.com',
    title: 'Recycled Cardboard Desk Organizer',
    shortDescription: 'Turn packaging cardboard into a useful desk organizer.',
    description:
      'A recycling craft project that transforms cardboard sheets and tubes into a practical organizer for pens, tools, and notes.',
    categoryKey: 'recycling-crafts',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 90,
    coverImageUrl: IMAGES.cardboard,
    status: 'PUBLISHED',
    components: [
      {
        name: 'Cardboard sheets',
        materialType: 'Cardboard Sheets',
        categoryKey: 'paper-cardboard',
        quantity: 3,
        unit: 'sheets',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['cardboard', 'carton sheets'],
      },
      {
        name: 'Cardboard tubes',
        materialType: 'Cardboard Tubes',
        categoryKey: 'paper-cardboard',
        quantity: 2,
        unit: 'pieces',
        role: 'OPTIONAL_MATERIAL',
        required: false,
        substitute: true,
        keywords: ['cardboard tubes', 'paper tubes'],
      },
      {
        name: 'Acrylic paint',
        materialType: 'Acrylic Paint',
        categoryKey: 'art-craft-supplies',
        quantity: 1,
        unit: 'set',
        role: 'OPTIONAL_MATERIAL',
        required: false,
        substitute: true,
        keywords: ['paint', 'acrylic paint'],
      },
    ],
    steps: [
      { title: 'Sketch compartments', description: 'Plan the organizer size and mark cardboard pieces.' },
      { title: 'Cut panels', description: 'Cut side panels, base, and separators with straight edges.' },
      { title: 'Assemble structure', description: 'Glue the frame first, then add internal dividers.' },
      { title: 'Decorate and dry', description: 'Paint or cover the organizer and let it dry fully.' },
    ],
    links: [
      {
        linkType: 'ARTICLE',
        url: 'https://www.wikihow.com/Make-a-Cardboard-Organizer',
        title: 'Cardboard organizer ideas',
        sourceName: 'wikiHow',
      },
    ],
    tags: ['cardboard', 'recycling', 'organizer'],
  },
  {
    key: 'mini-wooden-phone-stand',
    authorEmail: 'learner@learner.com',
    title: 'Mini Wooden Phone Stand',
    shortDescription: 'Make a simple phone stand from reclaimed wood pieces.',
    description:
      'A woodworking starter project using plywood, MDF offcuts, and basic hardware. It is small enough for learners to finish quickly while practicing measuring and sanding.',
    categoryKey: 'woodworking',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 80,
    coverImageUrl: IMAGES.woodPanels,
    status: 'PUBLISHED',
    components: [
      {
        name: 'Plywood panel',
        materialType: 'Plywood Sheet',
        categoryKey: 'wood-boards',
        quantity: 1,
        unit: 'panel',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['plywood', 'wood panel'],
      },
      {
        name: 'MDF offcut',
        materialType: 'MDF Offcuts',
        categoryKey: 'wood-boards',
        quantity: 1,
        unit: 'piece',
        role: 'OPTIONAL_MATERIAL',
        required: false,
        substitute: true,
        keywords: ['mdf', 'wood offcut'],
      },
      {
        name: 'Small screws',
        materialType: 'Screws and Nuts',
        categoryKey: 'metal-fasteners',
        quantity: 4,
        unit: 'pieces',
        role: 'CONSUMABLE',
        required: true,
        substitute: true,
        keywords: ['screws', 'fasteners'],
      },
    ],
    steps: [
      { title: 'Measure phone size', description: 'Mark a base and back support that fit the phone width.' },
      { title: 'Cut wood pieces', description: 'Cut the pieces carefully and test the support angle.' },
      { title: 'Sand edges', description: 'Smooth all corners so the stand is safe to handle.' },
      { title: 'Assemble stand', description: 'Screw or glue the support to the base and test stability.' },
    ],
    links: [
      {
        linkType: 'ARTICLE',
        url: 'https://www.instructables.com/Wooden-Phone-Stand/',
        title: 'Wooden phone stand reference',
        sourceName: 'Instructables',
      },
    ],
    tags: ['wood', 'phone stand', 'reuse'],
  },
  {
    key: 'mini-greenhouse-prototype',
    authorEmail: 'learner@learner.com',
    title: 'Mini Greenhouse Prototype',
    shortDescription: 'Build a small greenhouse model using acrylic sheets and PVC pieces.',
    description:
      'A home experiment project showing how transparent acrylic, PVC pipes, hinges, and screws can become a small greenhouse prototype for plant experiments.',
    categoryKey: 'home-experiments',
    difficulty: 'INTERMEDIATE',
    estimatedDurationMinutes: 180,
    coverImageUrl: IMAGES.greenhouse,
    status: 'PUBLISHED',
    components: [
      {
        name: 'Clear acrylic sheets',
        materialType: 'Acrylic Sheet',
        categoryKey: 'plastics-acrylic',
        quantity: 3,
        unit: 'sheets',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['acrylic', 'clear sheet', 'plexiglass'],
      },
      {
        name: 'PVC pipe pieces',
        materialType: 'PVC Pipes',
        categoryKey: 'plastics-acrylic',
        quantity: 4,
        unit: 'pieces',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['pvc', 'plastic pipes'],
      },
      {
        name: 'Small hinges',
        materialType: 'Small Hinges',
        categoryKey: 'tools-hardware',
        quantity: 2,
        unit: 'pieces',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['hinges', 'door hinge'],
      },
      {
        name: 'Screws and nuts',
        materialType: 'Screws and Nuts',
        categoryKey: 'metal-fasteners',
        quantity: 8,
        unit: 'pieces',
        role: 'CONSUMABLE',
        required: true,
        substitute: true,
        keywords: ['screws', 'nuts', 'fasteners'],
      },
    ],
    steps: [
      { title: 'Build PVC frame', description: 'Cut and arrange PVC pieces as a simple rectangular frame.' },
      { title: 'Attach acrylic sides', description: 'Fix clear acrylic sheets to the frame using screws or clips.' },
      { title: 'Add hinged door', description: 'Attach a small acrylic door using two small hinges.' },
      { title: 'Test plant cover', description: 'Place a small pot inside and observe heat and humidity changes.' },
    ],
    links: [
      {
        linkType: 'ARTICLE',
        url: 'https://www.instructables.com/Mini-Greenhouse/',
        title: 'Mini greenhouse ideas',
        sourceName: 'Instructables',
      },
    ],
    tags: ['greenhouse', 'home experiment', 'reuse'],
  },
  {
    key: 'fabric-pencil-case',
    authorEmail: 'israa@learner.com',
    title: 'Fabric Pencil Case',
    shortDescription: 'Sew a simple pencil case from fabric and denim offcuts.',
    description:
      'A textile craft project that helps learners reuse fabric scraps and denim offcuts while practicing measuring, folding, and basic sewing.',
    categoryKey: 'textile-crafts',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 100,
    coverImageUrl: IMAGES.sewing,
    status: 'PUBLISHED',
    components: [
      {
        name: 'Fabric scraps',
        materialType: 'Fabric Scraps',
        categoryKey: 'fabric-textiles',
        quantity: 1,
        unit: 'bag',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['fabric scraps', 'textile scraps'],
      },
      {
        name: 'Denim offcuts',
        materialType: 'Denim Offcuts',
        categoryKey: 'fabric-textiles',
        quantity: 1,
        unit: 'bundle',
        role: 'OPTIONAL_MATERIAL',
        required: false,
        substitute: true,
        keywords: ['denim', 'jeans fabric'],
      },
      {
        name: 'Felt sheet',
        materialType: 'Felt Sheets',
        categoryKey: 'fabric-textiles',
        quantity: 1,
        unit: 'sheet',
        role: 'OPTIONAL_MATERIAL',
        required: false,
        substitute: true,
        keywords: ['felt', 'craft felt'],
      },
    ],
    steps: [
      { title: 'Measure fabric', description: 'Cut two fabric rectangles slightly larger than your pencils.' },
      { title: 'Fold and pin', description: 'Fold the edges inward and pin the sides in place.' },
      { title: 'Sew sides', description: 'Sew the long sides, leaving the top opening clear.' },
      { title: 'Decorate', description: 'Add felt shapes or denim patches for style and reinforcement.' },
    ],
    links: [
      {
        linkType: 'ARTICLE',
        url: 'https://www.instructables.com/Simple-Pencil-Case/',
        title: 'Simple pencil case reference',
        sourceName: 'Instructables',
      },
    ],
    tags: ['fabric', 'sewing', 'textile'],
  },
  {
    key: 'rubber-band-powered-car',
    authorEmail: 'majd@learner.com',
    title: 'Rubber Band Powered Car',
    shortDescription: 'Build a simple moving car from cardboard, wheels, and craft sticks.',
    description:
      'A mechanical reuse project where learners build a small car using cardboard, rubber wheels, wooden sticks, and simple fasteners. Seeded as pending review to test moderation screens.',
    categoryKey: 'recycling-crafts',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 120,
    coverImageUrl: IMAGES.motors,
    status: 'PENDING_REVIEW',
    components: [
      {
        name: 'Cardboard sheet',
        materialType: 'Cardboard Sheets',
        categoryKey: 'paper-cardboard',
        quantity: 1,
        unit: 'sheet',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['cardboard', 'carton'],
      },
      {
        name: 'Rubber wheels',
        materialType: 'Rubber Wheels',
        categoryKey: 'motors-mechanical',
        quantity: 4,
        unit: 'pieces',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['rubber wheels', 'cart wheels'],
      },
      {
        name: 'Wooden craft sticks',
        materialType: 'Wooden Craft Sticks',
        categoryKey: 'art-craft-supplies',
        quantity: 2,
        unit: 'pieces',
        role: 'REQUIRED_MATERIAL',
        required: true,
        substitute: true,
        keywords: ['craft sticks', 'popsicle sticks'],
      },
    ],
    steps: [
      { title: 'Cut car base', description: 'Cut a rectangular cardboard base and mark axle lines.' },
      { title: 'Install axles and wheels', description: 'Attach wheels and test that the car rolls straight.' },
      { title: 'Add rubber band drive', description: 'Loop the rubber band around the rear axle and anchor point.' },
      { title: 'Test distance', description: 'Wind the axle and release the car, then adjust alignment.' },
    ],
    links: [
      {
        linkType: 'ARTICLE',
        url: 'https://www.sciencebuddies.org/stem-activities/rubber-band-car',
        title: 'Rubber band car activity',
        sourceName: 'Science Buddies',
      },
    ],
    tags: ['car', 'mechanics', 'recycling'],
  },
];

type SeedContext = {
  users: Map<string, string>;
  suppliers: Map<string, { userId: string; profileId: string; pickupLocationId: string }>;
  drivers: Map<string, { userId: string; profileId: string }>;
  categories: Map<string, string>;
  materials: Map<string, { id: string; ownerId: string; supplierProfileId: string; locationId: string; price: number | null; isFree: boolean }>;
  materialTypes: Map<string, { materialTypeId: string; priceRuleId: string | null }>;
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
        categoryType: 'MATERIAL',
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
        categoryType: 'PROJECT',
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
    throw new Error(`Missing category for material type: ${material.materialType}`);
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
        all.findIndex((other) => other.normalizedAlias === alias.normalizedAlias) ===
        index,
    );

  if (aliases.length > 0) {
    await prisma.materialTypeAlias.createMany({
      data: aliases.map((alias) => ({
        materialTypeId: materialType.id,
        alias: alias.alias,
        normalizedAlias: alias.normalizedAlias,
        language: 'en',
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
        sourceType: 'MANUAL',
        status: 'ACTIVE',
        sourceNote: 'Reviewed realistic development seed price rule.',
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
        accountStatus: 'ACTIVE',
        activeRole: 'LEARNER',
        emailVerifiedAt: now(),
        roles: { create: [{ role: 'LEARNER', isPrimary: true }] },
        learnerProfile: {
          create: {
            learnerType: 'STUDENT',
            bio: `${SEED_MARKER} Learner interested in ${learner.interests.join(', ')}.`,
            interests: [...learner.interests],
            skillLevel: learner.skillLevel,
          },
        },
      },
      select: { id: true },
    });

    const location = await prisma.location.create({
      data: {
        country: 'Palestine',
        city: learner.city,
        area: learner.area,
        addressLine: `${learner.area} learner dropoff area`,
        latitude:
          learner.city === 'Hebron' ? 31.5326 : learner.city === 'Ramallah' ? 31.9038 : 32.2211,
        longitude:
          learner.city === 'Hebron' ? 35.0998 : learner.city === 'Ramallah' ? 35.2034 : 35.2544,
        locationType: 'DROPOFF',
        visibility: 'PRIVATE',
        isApproximate: true,
      },
      select: { id: true },
    });

    await prisma.userSavedLocation.create({
      data: {
        userId: user.id,
        locationId: location.id,
        label: 'Default learner dropoff',
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
        accountStatus: 'ACTIVE',
        activeRole: 'SUPPLIER',
        emailVerifiedAt: now(),
        roles: { create: [{ role: 'SUPPLIER', isPrimary: true }] },
        supplierProfile: {
          create: {
            supplierType: supplier.supplierType,
            publicName: supplier.publicName,
            description: `${SEED_MARKER} ${supplier.description}`,
            verificationStatus: 'VERIFIED',
            verificationSubmittedAt: dateAt(-20, 10),
            verificationReviewedAt: dateAt(-18, 15),
            defaultPickupLocation: {
              create: {
                country: 'Palestine',
                city: supplier.city,
                area: supplier.area,
                addressLine: supplier.addressLine,
                latitude: supplier.latitude,
                longitude: supplier.longitude,
                locationType: 'PICKUP_POINT',
                visibility: 'PUBLIC_APPROXIMATE',
                isApproximate: true,
              },
            },
            organizationProfile: {
              create: {
                organizationName: supplier.publicName,
                organizationType: supplier.organizationType,
                contactPersonName: supplier.displayName,
                workingDays: ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'],
                workingHours: { start: '09:00', end: '17:00' },
                verificationDocumentStatus: 'VERIFIED',
                verificationDocumentUrl: 'https://example.com/impactloop/dev-seed-verification.pdf',
                verificationDocumentName: `${supplier.publicName.replace(/\s+/g, '-')}-verification.pdf`,
                businessLocation: {
                  create: {
                    country: 'Palestine',
                    city: supplier.city,
                    area: supplier.area,
                    addressLine: `${supplier.area} business location`,
                    latitude: supplier.latitude,
                    longitude: supplier.longitude,
                    locationType: 'BUSINESS_LOCATION',
                    visibility: 'PRIVATE',
                    isApproximate: true,
                  },
                },
              },
            },
          },
        },
      },
      include: { supplierProfile: { include: { defaultPickupLocation: true } } },
    });

    if (!user.supplierProfile?.defaultPickupLocation) {
      throw new Error(`Failed to create supplier profile for ${supplier.email}`);
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
        accountStatus: 'ACTIVE',
        activeRole: 'DRIVER',
        emailVerifiedAt: now(),
        roles: { create: [{ role: 'DRIVER', isPrimary: true }] },
        driverProfile: {
          create: {
            displayName: driver.displayName,
            phone: driver.phone,
            city: driver.city,
            area: driver.area,
            addressLine: `${driver.area} driver area`,
            transportationType: driver.transportationType,
            availabilityNote: 'Available for ImpactLoop internal deliveries.',
            status: 'ACTIVE',
            availability: 'AVAILABLE',
            vehicleType: driver.vehicleType,
            vehicleLabel: driver.vehicleLabel,
            vehiclePlate: driver.vehiclePlate,
            capacityNotes: 'Can carry small to medium student project materials.',
          },
        },
      },
      include: { driverProfile: true },
    });

    if (!user.driverProfile) {
      throw new Error(`Failed to create driver profile for ${driver.email}`);
    }

    context.users.set(driver.email, user.id);
    context.drivers.set(driver.email, { userId: user.id, profileId: user.driverProfile.id });
  }

  for (const admin of ADMINS) {
    const user = await prisma.user.create({
      data: {
        displayName: admin.displayName,
        email: admin.email,
        passwordHash,
        accountStatus: 'ACTIVE',
        activeRole: 'ADMIN',
        emailVerifiedAt: now(),
        roles: { create: [{ role: 'ADMIN', isPrimary: true }] },
      },
      select: { id: true },
    });

    context.users.set(admin.email, user.id);
  }

  context.learnerDropoffs = learnerDropoffs;
};

const createMaterials = async (context: SeedContext) => {
  for (const material of MATERIALS) {
    material.imageUrls.forEach((url, index) => assertImage(`${material.title} image ${index + 1}`, url));

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
        description: `${SEED_MARKER} ${material.description}`,
        materialType: material.materialType,
        quantity: material.quantity,
        unit: material.unit,
        condition: material.condition,
        sourceType: material.sourceType,
        status: 'AVAILABLE',
        isFree: material.isFree,
        price: material.price,
        currency: CURRENCY,
        locationId: supplier.pickupLocationId,
        pickupAllowed: material.pickupAllowed,
        deliveryAllowed: material.deliveryAllowed,
        pickupNotes: 'Pickup details are confirmed after reservation acceptance.',
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
};

const createProjects = async (context: SeedContext) => {
  for (const project of PROJECTS) {
    assertImage(`${project.title} cover`, project.coverImageUrl);

    const categoryId = context.categories.get(project.categoryKey);
    const authorId = context.users.get(project.authorEmail);
    const reviewedBy = project.status === 'PUBLISHED' ? context.users.get('admin@admin.com') ?? null : null;

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
        reviewedAt: project.status === 'PUBLISHED' ? dateAt(-8, 14) : null,
        reviewNote:
          project.status === 'PUBLISHED'
            ? 'Approved seed project with realistic reusable material requirements.'
            : 'Pending review seed project for admin moderation testing.',
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
              ? context.categories.get(component.categoryKey) ?? null
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
            reviewStatus: project.status === 'PUBLISHED' ? 'ACCEPTED' : 'PENDING_REVIEW',
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
            approvedBy: project.status === 'PUBLISHED' ? reviewedBy : null,
            reviewStatus: project.status === 'PUBLISHED' ? 'ACCEPTED' : 'PENDING_REVIEW',
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
    { email: 'majd@learner.com', project: 'obstacle-avoidance-robot' },
    { email: 'majd@learner.com', project: 'simple-led-circuit' },
    { email: 'israa@learner.com', project: 'fabric-pencil-case' },
    { email: 'israa@learner.com', project: 'recycled-desk-organizer' },
    { email: 'learner@learner.com', project: 'mini-wooden-phone-stand' },
    { email: 'learner@learner.com', project: 'mini-greenhouse-prototype' },
  ];

  for (const item of likesAndSaves) {
    const userId = context.users.get(item.email);
    const projectId = context.projects.get(item.project);
    if (!userId || !projectId) continue;

    await prisma.projectSave.create({ data: { userId, projectId } });
    await prisma.projectLike.create({ data: { userId, projectId } });
  }
};

type ReservationSeed = {
  key: string;
  materialKey: string;
  learnerEmail: string;
  status:
    | 'PENDING'
    | 'AWAITING_LEARNER_CONFIRMATION'
    | 'AWAITING_SUPPLIER_CONFIRMATION'
    | 'ACCEPTED'
    | 'REJECTED'
    | 'CANCELLED'
    | 'COMPLETED'
    | 'EXPIRED'
    | 'AWAITING_RESOLUTION';
  quantity: number;
  fulfillmentMethod: 'PICKUP' | 'DELIVERY';
  message: string;
  pickupStartOffset: number;
  pickupStartHour: number;
  pickupEndHour: number;
  supplierNote?: string;
  rejectionReason?: string;
  pendingRescheduleRequestedBy?: 'SUPPLIER' | 'LEARNER';
};

const RESERVATIONS: ReservationSeed[] = [
  {
    key: 'r-majd-arduino-pending',
    materialKey: 'majd-arduino-uno-r3',
    learnerEmail: 'majd@learner.com',
    status: 'PENDING',
    quantity: 1,
    fulfillmentMethod: 'DELIVERY',
    message: 'I need this Arduino board for the obstacle avoidance robot project.',
    pickupStartOffset: 1,
    pickupStartHour: 10,
    pickupEndHour: 12,
  },
  {
    key: 'r-majd-motors-accepted',
    materialKey: 'majd-dc-gear-motors',
    learnerEmail: 'majd@learner.com',
    status: 'ACCEPTED',
    quantity: 2,
    fulfillmentMethod: 'DELIVERY',
    message: 'Can I reserve two motors for a robot car?',
    pickupStartOffset: 0,
    pickupStartHour: 14,
    pickupEndHour: 16,
    supplierNote: 'Motors are packed in a small box near the electronics shelf.',
  },
  {
    key: 'r-majd-breadboard-completed',
    materialKey: 'majd-breadboard-kit',
    learnerEmail: 'majd@learner.com',
    status: 'COMPLETED',
    quantity: 1,
    fulfillmentMethod: 'PICKUP',
    message: 'I need one breadboard for the LED circuit.',
    pickupStartOffset: -3,
    pickupStartHour: 11,
    pickupEndHour: 12,
    supplierNote: 'Self pickup completed successfully.',
  },
  {
    key: 'r-israa-fabric-pending',
    materialKey: 'israa-fabric-scraps',
    learnerEmail: 'israa@learner.com',
    status: 'PENDING',
    quantity: 1,
    fulfillmentMethod: 'DELIVERY',
    message: 'I want fabric scraps for the pencil case project.',
    pickupStartOffset: 2,
    pickupStartHour: 10,
    pickupEndHour: 13,
  },
  {
    key: 'r-israa-cardboard-reschedule',
    materialKey: 'israa-cardboard-sheets',
    learnerEmail: 'israa@learner.com',
    status: 'AWAITING_LEARNER_CONFIRMATION',
    quantity: 4,
    fulfillmentMethod: 'PICKUP',
    message: 'Can I pick up cardboard for a desk organizer?',
    pickupStartOffset: 1,
    pickupStartHour: 12,
    pickupEndHour: 14,
    supplierNote: 'Supplier proposed a later window.',
    pendingRescheduleRequestedBy: 'SUPPLIER',
  },
  {
    key: 'r-israa-paint-completed',
    materialKey: 'israa-acrylic-paint',
    learnerEmail: 'israa@learner.com',
    status: 'COMPLETED',
    quantity: 1,
    fulfillmentMethod: 'DELIVERY',
    message: 'Need paints for the organizer decoration.',
    pickupStartOffset: -2,
    pickupStartHour: 9,
    pickupEndHour: 10,
    supplierNote: 'Paint set delivered with sealed lids.',
  },
  {
    key: 'r-learner-plywood-accepted',
    materialKey: 'supplier-plywood-panels',
    learnerEmail: 'learner@learner.com',
    status: 'ACCEPTED',
    quantity: 1,
    fulfillmentMethod: 'DELIVERY',
    message: 'I need a plywood panel for a phone stand.',
    pickupStartOffset: 0,
    pickupStartHour: 13,
    pickupEndHour: 15,
    supplierNote: 'Panel will be near the loading area.',
  },
  {
    key: 'r-learner-acrylic-awaiting-supplier',
    materialKey: 'supplier-acrylic-sheets',
    learnerEmail: 'learner@learner.com',
    status: 'AWAITING_SUPPLIER_CONFIRMATION',
    quantity: 3,
    fulfillmentMethod: 'DELIVERY',
    message: 'I need acrylic sheets for a mini greenhouse prototype.',
    pickupStartOffset: 3,
    pickupStartHour: 10,
    pickupEndHour: 12,
    pendingRescheduleRequestedBy: 'LEARNER',
  },
  {
    key: 'r-learner-screws-rejected',
    materialKey: 'supplier-screws-nuts',
    learnerEmail: 'learner@learner.com',
    status: 'REJECTED',
    quantity: 1,
    fulfillmentMethod: 'PICKUP',
    message: 'Can I take one box of screws?',
    pickupStartOffset: 1,
    pickupStartHour: 9,
    pickupEndHour: 11,
    rejectionReason: 'The remaining screws are already allocated to another reservation.',
  },
  {
    key: 'r-majd-servo-cancelled',
    materialKey: 'majd-servo-sg90',
    learnerEmail: 'majd@learner.com',
    status: 'CANCELLED',
    quantity: 2,
    fulfillmentMethod: 'PICKUP',
    message: 'I thought I needed servos but changed the project plan.',
    pickupStartOffset: -1,
    pickupStartHour: 15,
    pickupEndHour: 16,
  },
  {
    key: 'r-israa-jars-expired',
    materialKey: 'israa-glass-jars',
    learnerEmail: 'israa@learner.com',
    status: 'EXPIRED',
    quantity: 5,
    fulfillmentMethod: 'PICKUP',
    message: 'I wanted jars for plant experiments but did not confirm in time.',
    pickupStartOffset: -4,
    pickupStartHour: 10,
    pickupEndHour: 11,
  },
  {
    key: 'r-learner-pvc-resolution',
    materialKey: 'supplier-pvc-pipes',
    learnerEmail: 'learner@learner.com',
    status: 'AWAITING_RESOLUTION',
    quantity: 4,
    fulfillmentMethod: 'DELIVERY',
    message: 'Delivery issue happened with PVC pipes for the greenhouse prototype.',
    pickupStartOffset: -1,
    pickupStartHour: 10,
    pickupEndHour: 12,
    supplierNote: 'Driver reported pickup delay; moved to admin resolution.',
  },
];

const materialStatusFromReservation = (status: ReservationSeed['status']) => {
  switch (status) {
    case 'PENDING':
    case 'AWAITING_LEARNER_CONFIRMATION':
    case 'AWAITING_SUPPLIER_CONFIRMATION':
      return 'PENDING_RESERVATION' as const;
    case 'ACCEPTED':
    case 'AWAITING_RESOLUTION':
      return 'RESERVED' as const;
    case 'COMPLETED':
      return 'REUSED' as const;
    default:
      return 'AVAILABLE' as const;
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
    const deliveryFee = spec.fulfillmentMethod === 'DELIVERY' ? 15 : 0;
    const acceptedAt = ['ACCEPTED', 'COMPLETED', 'AWAITING_RESOLUTION'].includes(spec.status)
      ? dateAt(spec.pickupStartOffset - 1, 12)
      : null;
    const rejectedAt = spec.status === 'REJECTED' ? dateAt(-1, 14) : null;
    const cancelledAt = spec.status === 'CANCELLED' ? dateAt(-1, 15) : null;
    const completedAt = spec.status === 'COMPLETED' ? dateAt(spec.pickupStartOffset, spec.pickupEndHour) : null;

    const reservation = await prisma.reservation.create({
      data: {
        materialId: material.id,
        requesterId,
        ownerId: material.ownerId,
        quantityRequested: spec.quantity,
        message: `${SEED_MARKER} ${spec.message}`,
        fulfillmentMethod: spec.fulfillmentMethod,
        deliveryAddressText:
          spec.fulfillmentMethod === 'DELIVERY' ? 'Default learner dropoff location' : null,
        safeDropoffAllowed: spec.fulfillmentMethod === 'DELIVERY' ? false : null,
        deliveryNote:
          spec.fulfillmentMethod === 'DELIVERY'
            ? 'Please call learner when arriving at the dropoff area.'
            : null,
        status: spec.status,
        pickupWindowStart: ['ACCEPTED', 'COMPLETED', 'AWAITING_RESOLUTION'].includes(spec.status)
          ? start
          : null,
        pickupWindowEnd: ['ACCEPTED', 'COMPLETED', 'AWAITING_RESOLUTION'].includes(spec.status)
          ? end
          : null,
        supplierProposedPickupWindowStart:
          spec.status === 'AWAITING_LEARNER_CONFIRMATION' ? start : null,
        supplierProposedPickupWindowEnd:
          spec.status === 'AWAITING_LEARNER_CONFIRMATION' ? end : null,
        learnerProposedPickupWindowStart:
          spec.status === 'AWAITING_SUPPLIER_CONFIRMATION' ? start : null,
        learnerProposedPickupWindowEnd:
          spec.status === 'AWAITING_SUPPLIER_CONFIRMATION' ? end : null,
        pendingRescheduleRequestedBy: spec.pendingRescheduleRequestedBy ?? null,
        pendingRescheduleReason: spec.pendingRescheduleRequestedBy
          ? 'Seeded reschedule scenario.'
          : null,
        pendingRescheduleNote: spec.pendingRescheduleRequestedBy
          ? 'Please confirm the proposed time.'
          : null,
        supplierPickupWindowStart: start,
        supplierPickupWindowEnd: end,
        confirmedDeliveryWindowStart:
          spec.fulfillmentMethod === 'DELIVERY' && ['ACCEPTED', 'COMPLETED', 'AWAITING_RESOLUTION'].includes(spec.status)
            ? dateAt(spec.pickupStartOffset, spec.pickupEndHour + 1)
            : null,
        confirmedDeliveryWindowEnd:
          spec.fulfillmentMethod === 'DELIVERY' && ['ACCEPTED', 'COMPLETED', 'AWAITING_RESOLUTION'].includes(spec.status)
            ? dateAt(spec.pickupStartOffset, spec.pickupEndHour + 3)
            : null,
        earliestDeliveryStart:
          spec.fulfillmentMethod === 'DELIVERY' ? dateAt(spec.pickupStartOffset, spec.pickupEndHour) : null,
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
        deliveryZone: spec.fulfillmentMethod === 'DELIVERY' ? 'SAME_CITY' : null,
        dropoffCity: spec.fulfillmentMethod === 'DELIVERY' ? (spec.learnerEmail.includes('majd') ? 'Hebron' : spec.learnerEmail.includes('israa') ? 'Ramallah' : 'Nablus') : null,
        dropoffArea: spec.fulfillmentMethod === 'DELIVERY' ? (spec.learnerEmail.includes('majd') ? 'University District' : spec.learnerEmail.includes('israa') ? 'Al-Tireh' : 'Rafidia') : null,
      },
      select: { id: true },
    });

    context.reservations.set(spec.key, reservation.id);

    await prisma.reservationStatusHistory.create({
      data: {
        reservationId: reservation.id,
        statusGroup: 'RESERVATION',
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
        reusedAt: spec.status === 'COMPLETED' ? completedAt : null,
        reusedByReservationId: spec.status === 'COMPLETED' ? reservation.id : null,
      },
    });
  }
};

type DeliverySeed = {
  reservationKey: string;
  driverEmail?: string;
  status:
    | 'WAITING_FOR_DRIVER'
    | 'DRIVER_ASSIGNED'
    | 'PICKED_UP'
    | 'ON_THE_WAY'
    | 'DELIVERED'
    | 'AWAITING_RESOLUTION';
  note: string;
};

const DELIVERIES: DeliverySeed[] = [
  {
    reservationKey: 'r-majd-arduino-pending',
    status: 'WAITING_FOR_DRIVER',
    note: 'Open delivery waiting for first available driver.',
  },
  {
    reservationKey: 'r-majd-motors-accepted',
    driverEmail: 'majd@driver.com',
    status: 'DRIVER_ASSIGNED',
    note: 'Driver assigned and pickup not started yet.',
  },
  {
    reservationKey: 'r-israa-fabric-pending',
    status: 'WAITING_FOR_DRIVER',
    note: 'Creative material delivery request waiting for driver.',
  },
  {
    reservationKey: 'r-israa-paint-completed',
    driverEmail: 'israa@driver.com',
    status: 'DELIVERED',
    note: 'Paint set delivered successfully.',
  },
  {
    reservationKey: 'r-learner-plywood-accepted',
    driverEmail: 'driver@driver.com',
    status: 'PICKED_UP',
    note: 'Plywood panel picked up and waiting to move to dropoff.',
  },
  {
    reservationKey: 'r-learner-acrylic-awaiting-supplier',
    driverEmail: 'driver@driver.com',
    status: 'ON_THE_WAY',
    note: 'Acrylic sheets are on the way after supplier confirmation scenario.',
  },
  {
    reservationKey: 'r-learner-pvc-resolution',
    driverEmail: 'majd@driver.com',
    status: 'AWAITING_RESOLUTION',
    note: 'PVC delivery moved to admin review after pickup issue.',
  },
];

const deliveryGroupStatus = (status: DeliverySeed['status']) => {
  if (status === 'WAITING_FOR_DRIVER') return 'OPEN' as const;
  if (status === 'DELIVERED') return 'COMPLETED' as const;
  return 'ASSIGNED' as const;
};

const createDeliveryStatusHistory = async (
  deliveryId: string,
  status: DeliverySeed['status'],
  changedByUserId: string,
) => {
  const order: DeliverySeed['status'][] = [
    'WAITING_FOR_DRIVER',
    'DRIVER_ASSIGNED',
    'PICKED_UP',
    'ON_THE_WAY',
    'DELIVERED',
  ];

  const sequence = status === 'AWAITING_RESOLUTION'
    ? ['WAITING_FOR_DRIVER', 'DRIVER_ASSIGNED', 'AWAITING_RESOLUTION'] as DeliverySeed['status'][]
    : order.slice(0, order.indexOf(status) + 1);

  let oldStatus: DeliverySeed['status'] | null = null;
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
      throw new Error(`Missing reservation for delivery: ${spec.reservationKey}`);
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { material: true, requester: true },
    });

    if (!reservation) {
      throw new Error(`Reservation not found for delivery: ${spec.reservationKey}`);
    }

    const driver = spec.driverEmail ? context.drivers.get(spec.driverEmail) : null;
    const dropoffLocationId = context.learnerDropoffs.get(reservation.requester.email);
    if (!dropoffLocationId) {
      throw new Error(`Missing learner dropoff for ${reservation.requester.email}`);
    }

    const group = await prisma.deliveryGroup.create({
      data: {
        learnerId: reservation.requesterId,
        supplierProfileId: reservation.material.supplierProfileId!,
        dropoffCity: reservation.dropoffCity ?? 'Hebron',
        dropoffArea: reservation.dropoffArea,
        deliveryAddressText: reservation.deliveryAddressText ?? 'Default learner dropoff location',
        deliveryFee: reservation.deliveryFee ?? 15,
        currency: CURRENCY,
        deliveryZone: reservation.deliveryZone ?? 'SAME_CITY',
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
        arrivedPickupAt: ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(spec.status)
          ? dateAt(-1, 12)
          : null,
        pickedUpAt: ['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(spec.status)
          ? dateAt(-1, 12, 30)
          : null,
        onTheWayAt: ['ON_THE_WAY', 'DELIVERED'].includes(spec.status) ? dateAt(-1, 13) : null,
        arrivedDropoffAt: spec.status === 'DELIVERED' ? dateAt(-1, 14) : null,
        deliveredAt: spec.status === 'DELIVERED' ? dateAt(-1, 14, 15) : null,
        failedAt: spec.status === 'AWAITING_RESOLUTION' ? dateAt(-1, 13, 20) : null,
        learnerNote: reservation.deliveryNote,
        driverNote: spec.note,
        failureReason:
          spec.status === 'AWAITING_RESOLUTION'
            ? 'Pickup was not completed inside the confirmed window.'
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
          status: spec.status === 'AWAITING_RESOLUTION' ? 'RELEASED' : 'ACTIVE',
          acceptedAt: dateAt(-1, 11),
          releasedAt: spec.status === 'AWAITING_RESOLUTION' ? dateAt(-1, 13, 30) : null,
          releaseReason:
            spec.status === 'AWAITING_RESOLUTION'
              ? 'Released by seed to simulate escalation to admin review.'
              : null,
        },
      });

      if (['PICKED_UP', 'ON_THE_WAY', 'DELIVERED'].includes(spec.status)) {
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
      learnerEmail: 'majd@learner.com',
      projectKey: 'obstacle-avoidance-robot',
      links: [
        { componentIncludes: 'Arduino', materialKey: 'majd-arduino-uno-r3', reservationKey: 'r-majd-arduino-pending', status: 'RESERVED' as const },
        { componentIncludes: 'DC gear motors', materialKey: 'majd-dc-gear-motors', reservationKey: 'r-majd-motors-accepted', status: 'RESERVED' as const },
        { componentIncludes: 'Jumper wires', materialKey: 'majd-jumper-wires', status: 'AVAILABLE' as const },
      ],
    },
    {
      learnerEmail: 'israa@learner.com',
      projectKey: 'fabric-pencil-case',
      links: [
        { componentIncludes: 'Fabric scraps', materialKey: 'israa-fabric-scraps', reservationKey: 'r-israa-fabric-pending', status: 'RESERVED' as const },
        { componentIncludes: 'Denim offcuts', materialKey: 'israa-denim-offcuts', status: 'AVAILABLE' as const },
      ],
    },
    {
      learnerEmail: 'learner@learner.com',
      projectKey: 'mini-greenhouse-prototype',
      links: [
        { componentIncludes: 'Clear acrylic', materialKey: 'supplier-acrylic-sheets', reservationKey: 'r-learner-acrylic-awaiting-supplier', status: 'RESERVED' as const },
        { componentIncludes: 'PVC pipe', materialKey: 'supplier-pvc-pipes', reservationKey: 'r-learner-pvc-resolution', status: 'RESERVED' as const },
      ],
    },
  ];

  for (const buildSeed of builds) {
    const learnerId = context.users.get(buildSeed.learnerEmail);
    const projectId = context.projects.get(buildSeed.projectKey);
    if (!learnerId || !projectId) continue;

    const build = await prisma.projectBuild.create({
      data: { learnerId, projectId, status: 'IN_PROGRESS' },
      select: { id: true },
    });

    const components = await prisma.projectRequiredComponent.findMany({
      where: { projectId },
      select: { id: true, componentName: true },
    });

    for (const component of components) {
      const link = buildSeed.links.find((candidate) =>
        component.componentName.toLowerCase().includes(candidate.componentIncludes.toLowerCase()),
      );

      await prisma.projectBuildItem.create({
        data: {
          buildId: build.id,
          requiredComponentId: component.id,
          status: link?.status ?? 'MISSING',
          learnerNote: link ? 'Linked by realistic seed.' : 'Still missing in realistic seed.',
          linkedMaterialId: link ? context.materials.get(link.materialKey)?.id ?? null : null,
          linkedReservationId: link?.reservationKey
            ? context.reservations.get(link.reservationKey) ?? null
            : null,
          linkedMaterialAt: link ? now() : null,
        },
      });
    }
  }
};

const createAdminAndNotificationData = async (context: SeedContext) => {
  const adminId = context.users.get('admin@admin.com');
  const majdSupplierId = context.users.get('majd@supplier.com');
  const israaSupplierId = context.users.get('israa@supplier.com');
  const majdLearnerId = context.users.get('majd@learner.com');
  const driverUserId = context.users.get('driver@driver.com');
  const electronicsCategoryId = context.categories.get('electronics-components');
  const otherCategoryId = context.categories.get('other-reusable');

  if (!adminId || !majdSupplierId || !israaSupplierId || !majdLearnerId || !driverUserId) {
    throw new Error('Missing users for admin/notification seed data.');
  }

  await prisma.categoryRequest.create({
    data: {
      requestedName: `${SEED_MARKER} Lab Glassware`,
      normalizedRequestedName: normalizeSearchText(`${SEED_MARKER} Lab Glassware`),
      requestedByUserId: majdSupplierId,
      status: 'PENDING',
      listingDraftJson: {
        title: 'Reusable lab glassware set',
        requestedCategoryName: 'Lab Glassware',
        imageUrls: ['https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=80'],
      },
    },
  });

  await prisma.categoryRequest.create({
    data: {
      requestedName: `${SEED_MARKER} Random paid mystery box`,
      normalizedRequestedName: normalizeSearchText(`${SEED_MARKER} Random paid mystery box`),
      requestedByUserId: israaSupplierId,
      status: 'REJECTED',
      moderatorNote: 'Paid materials should use a clear existing category instead of Other.',
      approvedCategoryId: otherCategoryId ?? null,
    },
  });

  await prisma.priceRuleRequest.create({
    data: {
      materialName: `${SEED_MARKER} Solar panel scraps`,
      normalizedMaterialName: normalizeSearchText(`${SEED_MARKER} Solar panel scraps`),
      categoryId: electronicsCategoryId ?? null,
      unit: 'piece',
      condition: 'USED',
      quantity: 3,
      supplierPriceNis: 65,
      requestedByUserId: majdSupplierId,
      status: 'PENDING',
      aiSuggestedUnit: 'piece',
      aiSuggestedMaxUnitPriceNis: 45,
      aiSuggestedMaxTotalPriceNis: 135,
      aiResultJson: {
        source: 'seed',
        note: 'Pending admin review for a material type not yet in approved taxonomy.',
      },
    },
  });

  await prisma.roleInvitation.create({
    data: {
      targetEmail: 'moderator.seed@impactloop.local',
      targetRole: 'MODERATOR',
      tokenHash: `${SEED_MARKER}-moderator-token-hash`,
      invitedBy: adminId,
      status: 'PENDING',
      sendStatus: 'SENT',
      sentAt: dateAt(-1, 10),
      expiresAt: dateAt(7, 10),
      notes: 'Realistic seed pending moderator invitation.',
    },
  });

  const reportedMaterial = context.materials.get('supplier-screws-nuts');
  if (reportedMaterial) {
    await prisma.materialReport.create({
      data: {
        materialId: reportedMaterial.id,
        reporterId: majdLearnerId,
        reason: 'ITEM_NOT_AVAILABLE',
        note: 'Seed report: learner claims the screw box was not available after reservation rejection.',
        status: 'PENDING',
      },
    });
  }

  const resolvedReservationId = context.reservations.get('r-learner-pvc-resolution');
  if (resolvedReservationId) {
    await prisma.noShowReport.create({
      data: {
        reservationId: resolvedReservationId,
        reporterUserId: driverUserId,
        targetRole: 'SYSTEM',
        reasonCode: 'PICKUP_FAILED',
        note: 'Seed incident: pickup failed and delivery moved to admin review.',
        pickupWindowStart: dateAt(-1, 10),
        pickupWindowEnd: dateAt(-1, 12),
        status: 'PENDING_REVIEW',
      },
    });
  }

  const completedReservation = context.reservations.get('r-israa-paint-completed');
  if (completedReservation && israaSupplierId) {
    await prisma.review.create({
      data: {
        reservationId: completedReservation,
        reviewerId: context.users.get('israa@learner.com')!,
        reviewedUserId: israaSupplierId,
        targetType: 'SUPPLIER',
        rating: 5,
        comment: 'Paint was well packed and useful for the project.',
      },
    });
  }

  const notifications = [
    {
      userId: majdSupplierId,
      type: 'RESERVATION_CREATED',
      title: 'New Arduino reservation',
      body: 'Majd Learner requested Arduino Uno R3 Boards for a robotics project.',
      entityType: 'reservation',
      entityKey: 'r-majd-arduino-pending',
    },
    {
      userId: majdLearnerId,
      type: 'DELIVERY_WAITING_FOR_DRIVER',
      title: 'Delivery request opened',
      body: 'Your Arduino delivery is waiting for an available driver.',
      entityType: 'delivery',
      entityKey: null,
    },
    {
      userId: adminId,
      type: 'ADMIN_REVIEW_REQUIRED',
      title: 'Delivery moved to admin review',
      body: 'A PVC pipe delivery needs admin resolution after a pickup issue.',
      entityType: 'reservation',
      entityKey: 'r-learner-pvc-resolution',
    },
    {
      userId: driverUserId,
      type: 'DRIVER_ASSIGNMENT_AVAILABLE',
      title: 'Open delivery nearby',
      body: 'A learner delivery request is waiting for a driver in your area.',
      entityType: 'delivery',
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
          ? context.reservations.get(notification.entityKey) ?? null
          : null,
        isRead: false,
      },
    });
  }

  await prisma.adminActivityLog.createMany({
    data: [
      {
        actorUserId: adminId,
        action: 'SEED_REVIEW_CATEGORY_REQUEST',
        targetType: 'CATEGORY_REQUEST',
        targetLabel: 'Seed category review queue initialized',
        metadata: { seed: true, marker: SEED_MARKER },
      },
      {
        actorUserId: adminId,
        action: 'SEED_REVIEW_DELIVERY_INCIDENT',
        targetType: 'NO_SHOW_REPORT',
        targetLabel: 'Seed delivery incident initialized',
        metadata: { seed: true, marker: SEED_MARKER },
      },
    ],
  });
};

const main = async () => {
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
  await createReservations(context);
  await createDeliveries(context);
  await createProjectBuilds(context);
  await createAdminAndNotificationData(context);

  const summary = {
    seedMarker: SEED_MARKER,
    resetApplied: true,
    passwordForAllAccounts: SEED_PASSWORD,
    learners: LEARNERS.map((learner) => learner.email),
    suppliers: SUPPLIERS.map((supplier) => supplier.email),
    drivers: DRIVERS.map((driver) => driver.email),
    admins: ADMINS.map((admin) => admin.email),
    materialCategories: MATERIAL_CATEGORIES.length,
    projectCategories: PROJECT_CATEGORIES.length,
    materialsSeeded: MATERIALS.length,
    materialsPerSupplier: SUPPLIERS.map((supplier) => ({
      supplier: supplier.email,
      count: MATERIALS.filter((material) => material.supplierEmail === supplier.email).length,
    })),
    learningProjectsSeeded: PROJECTS.length,
    reservationsSeeded: RESERVATIONS.length,
    deliveriesSeeded: DELIVERIES.length,
    command: 'cd apps/backend && npm run seed',
  };

  console.log(JSON.stringify(summary, null, 2));
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
