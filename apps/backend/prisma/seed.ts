import { prisma } from '../src/database/prisma.js';
import { normalizeSearchText } from '../src/utils/normalize-search-text.js';
import { hashPassword } from '../src/utils/password.js';
import {
  MATERIAL_CATEGORY_SEEDS,
  MATERIAL_TYPE_SEEDS,
} from './seeds/material-taxonomy.data.js';
import { seedSupplierReservations } from './seeds/seed-supplier-reservations.js';

type SeedCategoryInput = {
  key: string;
  nameEn: string;
  nameAr: string;
};

type SeedLocationInput = {
  key: string;
  country: string;
  city: string;
  area: string;
};

type SeedMaterialInput = {
  title: string;
  description: string;
  categoryKey: string;
  quantity: number;
  unit: string;
  condition: 'LIKE_NEW' | 'GOOD' | 'USED';
  status: 'AVAILABLE' | 'PENDING_RESERVATION' | 'RESERVED';
  isFree: boolean;
  price: number | null;
  locationKey: string;
  pickupAllowed: boolean;
  deliveryAllowed: boolean;
  imageUrl: string;
  tags: string[];
  materialType: string;
};

type SeedLearningProjectImageInput = {
  imageUrl: string;
  sortOrder: number;
};

type SeedLearningProjectComponentInput = {
  componentName: string;
  materialType: string;
  quantity: number;
  unit: string;
  componentRole:
    | 'REQUIRED_MATERIAL'
    | 'OPTIONAL_MATERIAL'
    | 'TOOL'
    | 'CONSUMABLE';
  isRequired: boolean;
  canBeSubstituted: boolean;
  categoryKey?: string;
  searchKeywords?: string[];
  alternativeKeywords?: string[];
  notes?: string | null;
};

type SeedLearningProjectStepInput = {
  stepNumber: number;
  title: string;
  description: string;
  imageUrl?: string | null;
};

type SeedLearningProjectLinkInput = {
  linkType: 'YOUTUBE' | 'GITHUB' | 'ARTICLE' | 'PDF' | 'OTHER';
  url: string;
  title?: string | null;
  sourceName?: string | null;
};

type SeedLearningProjectInput = {
  title: string;
  shortDescription: string;
  description: string;
  categoryKey: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  estimatedDurationMinutes: number | null;
  coverImageUrl: string | null;
  status: 'PUBLISHED' | 'PENDING_REVIEW';
  reviewNote?: string | null;
  images: SeedLearningProjectImageInput[];
  requiredComponents: SeedLearningProjectComponentInput[];
  steps: SeedLearningProjectStepInput[];
  links: SeedLearningProjectLinkInput[];
  tags: string[];
};

const DEMO_SUPPLIER_EMAIL = 'demo.materials.supplier@impactloop.local';
const DEMO_SUPPLIER_PASSWORD = 'ImpactLoopSeed123!';
const DEMO_LEARNER_EMAIL = 'demo.learning.author@impactloop.local';
const DEMO_LEARNER_PASSWORD = 'ImpactLoopSeed123!';

const categories: SeedCategoryInput[] = [
  { key: 'electronics', nameEn: 'Electronics', nameAr: 'إلكترونيات' },
  { key: 'wood-panels', nameEn: 'Wood & Panels', nameAr: 'خشب وألواح' },
  { key: 'plastics', nameEn: 'Plastics', nameAr: 'بلاستيك' },
  {
    key: 'fabric-textiles',
    nameEn: 'Fabric & Textiles',
    nameAr: 'أقمشة ومنسوجات',
  },
  {
    key: 'tools-hardware',
    nameEn: 'Tools & Hardware',
    nameAr: 'أدوات وقطع',
  },
];

const learningCategories: SeedCategoryInput[] = [
  { key: 'robotics', nameEn: 'Robotics', nameAr: 'روبوتات' },
  { key: 'electronics', nameEn: 'Electronics', nameAr: 'إلكترونيات' },
  {
    key: 'recycling-crafts',
    nameEn: 'Recycling Crafts',
    nameAr: 'حرف إعادة التدوير',
  },
  { key: 'woodworking', nameEn: 'Woodworking', nameAr: 'أعمال خشبية' },
  {
    key: 'home-experiments',
    nameEn: 'Home Experiments',
    nameAr: 'تجارب منزلية',
  },
];

const locations: SeedLocationInput[] = [
  {
    key: 'nablus-industrial-area',
    country: 'Palestine',
    city: 'Nablus',
    area: 'Industrial Area',
  },
  {
    key: 'ramallah-al-tireh',
    country: 'Palestine',
    city: 'Ramallah',
    area: 'Al-Tireh',
  },
  {
    key: 'hebron-university-district',
    country: 'Palestine',
    city: 'Hebron',
    area: 'University District',
  },
];

const materials: SeedMaterialInput[] = [
  {
    title: 'Arduino Uno Board',
    description:
      'Working Arduino Uno board for student prototypes and classroom demos.',
    categoryKey: 'electronics',
    quantity: 6,
    unit: 'pieces',
    condition: 'LIKE_NEW',
    status: 'AVAILABLE',
    isFree: true,
    price: null,
    locationKey: 'nablus-industrial-area',
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrl:
      'https://images.unsplash.com/photo-1553406830-ef2513450d76?auto=format&fit=crop&w=1200&q=80',
    tags: ['arduino', 'microcontroller', 'prototyping'],
    materialType: 'Microcontroller boards',
  },
  {
    title: 'Jumper Wires Bundle',
    description:
      'Assorted male-to-male and male-to-female jumper wires for breadboard testing.',
    categoryKey: 'electronics',
    quantity: 18,
    unit: 'bundles',
    condition: 'GOOD',
    status: 'AVAILABLE',
    isFree: false,
    price: 15,
    locationKey: 'ramallah-al-tireh',
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrl:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    tags: ['jumper wires', 'breadboard', 'electronics'],
    materialType: 'Electronic wiring',
  },
  {
    title: 'Acrylic Sheets',
    description:
      'Clear acrylic offcuts suitable for laser cutting, display cases, and enclosures.',
    categoryKey: 'plastics',
    quantity: 12,
    unit: 'sheets',
    condition: 'GOOD',
    status: 'AVAILABLE',
    isFree: false,
    price: 35,
    locationKey: 'ramallah-al-tireh',
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrl:
      'https://images.unsplash.com/photo-1581092921461-eab62e97a780?auto=format&fit=crop&w=1200&q=80',
    tags: ['acrylic', 'sheet', 'laser cutting'],
    materialType: 'Plastic sheets',
  },
  {
    title: 'Reclaimed Wood Panels',
    description:
      'Clean reclaimed panels from workshop shelving, useful for furniture mockups.',
    categoryKey: 'wood-panels',
    quantity: 9,
    unit: 'panels',
    condition: 'USED',
    status: 'RESERVED',
    isFree: true,
    price: null,
    locationKey: 'hebron-university-district',
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrl:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    tags: ['wood', 'panels', 'furniture'],
    materialType: 'Wood panels',
  },
  {
    title: 'DC Motors',
    description:
      'Tested DC motors removed from robotics kits and ready for reuse in motion builds.',
    categoryKey: 'tools-hardware',
    quantity: 10,
    unit: 'pieces',
    condition: 'GOOD',
    status: 'PENDING_RESERVATION',
    isFree: false,
    price: 25,
    locationKey: 'nablus-industrial-area',
    pickupAllowed: false,
    deliveryAllowed: true,
    imageUrl:
      'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=1200&q=80',
    tags: ['dc motor', 'robotics', 'mechanical'],
    materialType: 'Electric motors',
  },
  {
    title: 'Cardboard Sheets',
    description:
      'Large cardboard sheets from packaging surplus for model making and prototyping.',
    categoryKey: 'wood-panels',
    quantity: 24,
    unit: 'sheets',
    condition: 'USED',
    status: 'AVAILABLE',
    isFree: true,
    price: null,
    locationKey: 'hebron-university-district',
    pickupAllowed: true,
    deliveryAllowed: false,
    imageUrl:
      'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1200&q=80',
    tags: ['cardboard', 'packaging', 'prototype'],
    materialType: 'Packaging boards',
  },
  {
    title: 'Fabric Scraps',
    description:
      'Sorted fabric scraps in mixed colors for fashion, textile, and craft experiments.',
    categoryKey: 'fabric-textiles',
    quantity: 14,
    unit: 'bags',
    condition: 'GOOD',
    status: 'AVAILABLE',
    isFree: true,
    price: null,
    locationKey: 'ramallah-al-tireh',
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrl:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
    tags: ['fabric', 'textiles', 'upcycling'],
    materialType: 'Fabric remnants',
  },
  {
    title: 'Resistors Pack',
    description:
      'Labeled resistor assortment packs for electronics labs and quick circuit repairs.',
    categoryKey: 'electronics',
    quantity: 30,
    unit: 'packs',
    condition: 'LIKE_NEW',
    status: 'AVAILABLE',
    isFree: false,
    price: 12,
    locationKey: 'nablus-industrial-area',
    pickupAllowed: true,
    deliveryAllowed: true,
    imageUrl:
      'https://images.unsplash.com/photo-1581092335397-9583eb92d232?auto=format&fit=crop&w=1200&q=80',
    tags: ['resistors', 'components', 'electronics'],
    materialType: 'Electronic components',
  },
];

const learningProjects: SeedLearningProjectInput[] = [
  {
    title: 'Obstacle Avoidance Robot',
    shortDescription:
      'Build a simple autonomous robot using Arduino, sensors, and reused motion parts.',
    description:
      'This guided robotics project helps learners assemble a compact obstacle avoidance robot using common workshop electronics and reusable mechanical parts. It introduces sensor wiring, motor control, and basic decision logic.',
    categoryKey: 'robotics',
    difficulty: 'INTERMEDIATE',
    estimatedDurationMinutes: 240,
    coverImageUrl:
      'https://images.unsplash.com/photo-1561144257-e32e8efc6c4f?auto=format&fit=crop&w=1200&q=80',
    status: 'PUBLISHED',
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1561144257-e32e8efc6c4f?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
      {
        imageUrl:
          'https://images.unsplash.com/photo-1535378620166-273708d44e4c?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 1,
      },
    ],
    requiredComponents: [
      {
        componentName: 'Arduino board',
        materialType: 'Microcontroller board',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
        categoryKey: 'electronics',
        searchKeywords: ['arduino', 'uno', 'microcontroller'],
      },
      {
        componentName: 'Ultrasonic sensor',
        materialType: 'Distance sensor',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: true,
        categoryKey: 'electronics',
        searchKeywords: ['ultrasonic', 'distance sensor', 'hc-sr04'],
      },
      {
        componentName: 'DC motors',
        materialType: 'Electric motors',
        quantity: 2,
        unit: 'pieces',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['dc motor', 'gear motor'],
      },
      {
        componentName: 'Wheels',
        materialType: 'Motion parts',
        quantity: 2,
        unit: 'pieces',
        componentRole: 'OPTIONAL_MATERIAL',
        isRequired: false,
        canBeSubstituted: true,
        searchKeywords: ['robot wheels', 'plastic wheels'],
      },
      {
        componentName: 'Jumper wires',
        materialType: 'Electronic wiring',
        quantity: 12,
        unit: 'pieces',
        componentRole: 'CONSUMABLE',
        isRequired: true,
        canBeSubstituted: false,
        categoryKey: 'electronics',
        searchKeywords: ['jumper wires', 'dupont wires'],
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Prepare the base',
        description:
          'Lay out the chassis, mount the wheels, and make sure both motors fit securely on the robot base.',
      },
      {
        stepNumber: 2,
        title: 'Install the control board',
        description:
          'Fix the Arduino board to the base and leave enough space around the USB and power connections.',
      },
      {
        stepNumber: 3,
        title: 'Wire the ultrasonic sensor',
        description:
          'Connect the sensor pins carefully so the robot can detect nearby obstacles from the front.',
      },
      {
        stepNumber: 4,
        title: 'Connect the motors',
        description:
          'Attach both DC motors through a suitable driver or control circuit and verify the left and right channels separately.',
      },
      {
        stepNumber: 5,
        title: 'Upload the movement logic',
        description:
          'Load the Arduino sketch, test forward motion, and confirm that the robot turns away when an obstacle is detected.',
      },
    ],
    links: [
      {
        linkType: 'ARTICLE',
        url: 'https://www.arduino.cc/en/Tutorial/HomePage',
        title: 'Arduino project tutorials',
        sourceName: 'Arduino',
      },
    ],
    tags: ['arduino', 'robotics', 'sensors'],
  },
  {
    title: 'Simple LED Circuit',
    shortDescription:
      'A beginner-friendly exercise for wiring a safe LED circuit on a breadboard.',
    description:
      'This beginner project introduces the fundamentals of current flow, resistor use, and breadboard layout through a simple LED lighting circuit powered by a small battery source.',
    categoryKey: 'electronics',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 60,
    coverImageUrl:
      'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
    status: 'PUBLISHED',
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    requiredComponents: [
      {
        componentName: 'LED',
        materialType: 'Electronic component',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: true,
        categoryKey: 'electronics',
        searchKeywords: ['led', 'light diode'],
      },
      {
        componentName: 'Resistor',
        materialType: 'Electronic component',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: true,
        categoryKey: 'electronics',
        searchKeywords: ['resistor', '220 ohm'],
      },
      {
        componentName: 'Breadboard',
        materialType: 'Prototype board',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['breadboard'],
      },
      {
        componentName: 'Jumper wires',
        materialType: 'Electronic wiring',
        quantity: 4,
        unit: 'pieces',
        componentRole: 'CONSUMABLE',
        isRequired: true,
        canBeSubstituted: false,
        categoryKey: 'electronics',
        searchKeywords: ['jumper wires'],
      },
      {
        componentName: 'Battery',
        materialType: 'Power source',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['9v battery', 'battery pack'],
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Place the LED on the breadboard',
        description:
          'Insert the LED so the long leg and short leg are in separate rows and easy to identify.',
      },
      {
        stepNumber: 2,
        title: 'Add the resistor',
        description:
          'Connect a resistor in series with the LED to limit current and protect the component.',
      },
      {
        stepNumber: 3,
        title: 'Connect the battery leads',
        description:
          'Wire the positive and negative battery connections to the correct breadboard rows.',
      },
      {
        stepNumber: 4,
        title: 'Test the circuit',
        description:
          'Check the LED orientation and verify the light turns on without overheating any component.',
      },
    ],
    links: [
      {
        linkType: 'YOUTUBE',
        url: 'https://www.youtube.com/watch?v=QdXxYj2aV4Q',
        title: 'Basic LED circuit walkthrough',
        sourceName: 'YouTube',
      },
    ],
    tags: ['led', 'circuit', 'beginner'],
  },
  {
    title: 'Recycled Cardboard Organizer',
    shortDescription:
      'Turn cardboard leftovers into a simple desk organizer for tools and notes.',
    description:
      'This craft project shows learners how to measure, cut, and assemble recycled cardboard into a practical organizer. It is suitable for reuse workshops and school eco-club sessions.',
    categoryKey: 'recycling-crafts',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 90,
    coverImageUrl:
      'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1200&q=80',
    status: 'PUBLISHED',
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    requiredComponents: [
      {
        componentName: 'Cardboard sheets',
        materialType: 'Packaging board',
        quantity: 3,
        unit: 'sheets',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['cardboard', 'box board'],
      },
      {
        componentName: 'Glue',
        materialType: 'Adhesive',
        quantity: 1,
        unit: 'tube',
        componentRole: 'CONSUMABLE',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['craft glue', 'white glue'],
      },
      {
        componentName: 'Cutter',
        materialType: 'Hand tool',
        quantity: 1,
        unit: 'piece',
        componentRole: 'TOOL',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['utility knife', 'cutter'],
      },
      {
        componentName: 'Ruler',
        materialType: 'Measuring tool',
        quantity: 1,
        unit: 'piece',
        componentRole: 'TOOL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['ruler', 'measuring scale'],
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Measure the organizer sections',
        description:
          'Sketch the compartments you want, then mark the panel sizes clearly on the cardboard.',
      },
      {
        stepNumber: 2,
        title: 'Cut the main panels',
        description:
          'Use the ruler and cutter to cut the base, side walls, and inner dividers neatly.',
      },
      {
        stepNumber: 3,
        title: 'Assemble the structure',
        description:
          'Glue the outer frame first and let it hold its shape before adding inner separators.',
      },
      {
        stepNumber: 4,
        title: 'Reinforce and finish',
        description:
          'Add an extra cardboard layer where needed, then let the organizer dry fully before use.',
      },
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
    title: 'Mini Wooden Phone Stand',
    shortDescription:
      'Create a compact phone stand from reused wood panels with simple finishing steps.',
    description:
      'This woodworking starter project uses small reclaimed wood pieces to build a stable phone stand. It helps learners practice measuring, shaping, sanding, and basic assembly with minimal material waste.',
    categoryKey: 'woodworking',
    difficulty: 'BEGINNER',
    estimatedDurationMinutes: 80,
    coverImageUrl:
      'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
    status: 'PUBLISHED',
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    requiredComponents: [
      {
        componentName: 'Wood panels',
        materialType: 'Reclaimed wood',
        quantity: 2,
        unit: 'pieces',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['wood panel', 'scrap wood'],
      },
      {
        componentName: 'Sandpaper',
        materialType: 'Finishing material',
        quantity: 2,
        unit: 'sheets',
        componentRole: 'CONSUMABLE',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['sandpaper', 'sanding sheet'],
      },
      {
        componentName: 'Glue',
        materialType: 'Wood adhesive',
        quantity: 1,
        unit: 'tube',
        componentRole: 'CONSUMABLE',
        isRequired: true,
        canBeSubstituted: true,
        searchKeywords: ['wood glue'],
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Mark the two wood pieces',
        description:
          'Measure the phone width and mark one base piece and one angled support piece.',
      },
      {
        stepNumber: 2,
        title: 'Cut and test the angle',
        description:
          'Cut the marked pieces and check that the support angle holds the phone comfortably.',
      },
      {
        stepNumber: 3,
        title: 'Sand the edges',
        description:
          'Smooth all edges and corners so the stand is safe to handle and visually clean.',
      },
      {
        stepNumber: 4,
        title: 'Glue and dry',
        description:
          'Join the support to the base, align it carefully, and allow the glue to dry completely.',
      },
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
    title: 'Solar Oven Prototype',
    shortDescription:
      'Prototype a simple solar oven to explore heat reflection and insulation concepts.',
    description:
      'This non-public project is seeded for visibility testing. It helps learners explore solar heat collection with household materials, reflective surfaces, and a transparent cover.',
    categoryKey: 'home-experiments',
    difficulty: 'INTERMEDIATE',
    estimatedDurationMinutes: 180,
    coverImageUrl:
      'https://images.unsplash.com/photo-1509395176047-4a66953fd231?auto=format&fit=crop&w=1200&q=80',
    status: 'PENDING_REVIEW',
    reviewNote: 'Waiting for review before public publishing.',
    images: [
      {
        imageUrl:
          'https://images.unsplash.com/photo-1509395176047-4a66953fd231?auto=format&fit=crop&w=1200&q=80',
        sortOrder: 0,
      },
    ],
    requiredComponents: [
      {
        componentName: 'Cardboard box',
        materialType: 'Insulated container',
        quantity: 1,
        unit: 'piece',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['cardboard box'],
      },
      {
        componentName: 'Aluminum foil',
        materialType: 'Reflective material',
        quantity: 2,
        unit: 'sheets',
        componentRole: 'REQUIRED_MATERIAL',
        isRequired: true,
        canBeSubstituted: false,
        searchKeywords: ['aluminum foil'],
      },
      {
        componentName: 'Plastic sheet',
        materialType: 'Transparent cover',
        quantity: 1,
        unit: 'piece',
        componentRole: 'OPTIONAL_MATERIAL',
        isRequired: false,
        canBeSubstituted: true,
        searchKeywords: ['clear plastic', 'plastic sheet'],
      },
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Prepare the box opening',
        description:
          'Cut a flap into the top of the box so sunlight can enter through the transparent cover area.',
      },
      {
        stepNumber: 2,
        title: 'Add reflective foil',
        description:
          'Line the flap and inner walls with aluminum foil to direct and concentrate heat inward.',
      },
      {
        stepNumber: 3,
        title: 'Seal with a clear cover',
        description:
          'Attach a plastic sheet over the opening so heat can collect while still allowing light through.',
      },
      {
        stepNumber: 4,
        title: 'Test the heat build-up',
        description:
          'Place the prototype in direct sunlight and observe how orientation changes affect the temperature inside.',
      },
    ],
    links: [
      {
        linkType: 'ARTICLE',
        url: 'https://solarcooking.fandom.com/wiki/Solar_oven',
        title: 'Solar oven basics',
        sourceName: 'Solar Cooking Wiki',
      },
    ],
    tags: ['solar', 'experiment', 'prototype'],
  },
];

const mergeCategoryType = (
  existingType: 'MATERIAL' | 'PROJECT' | 'BOTH',
  desiredType: 'MATERIAL' | 'PROJECT',
): 'MATERIAL' | 'PROJECT' | 'BOTH' => {
  if (existingType === 'BOTH' || existingType === desiredType) {
    return existingType;
  }

  return 'BOTH';
};

const ensureSupplierOwner = async () => {
  const existingDemoUser = await prisma.user.findUnique({
    where: { email: DEMO_SUPPLIER_EMAIL },
    include: {
      supplierProfile: true,
      roles: true,
    },
  });

  if (existingDemoUser?.supplierProfile) {
    return {
      ownerId: existingDemoUser.id,
      supplierProfileId: existingDemoUser.supplierProfile.id,
      ownerMode: 'reused-demo' as const,
      ownerEmail: existingDemoUser.email,
    };
  }

  if (existingDemoUser && !existingDemoUser.supplierProfile) {
    const supplierRole = existingDemoUser.roles.find(
      (role) => role.role === 'SUPPLIER',
    );

    if (!supplierRole) {
      await prisma.userRoleAssignment.create({
        data: {
          userId: existingDemoUser.id,
          role: 'SUPPLIER',
          isPrimary: existingDemoUser.roles.length === 0,
        },
      });
    }

    const supplierProfile = await prisma.supplierProfile.create({
      data: {
        userId: existingDemoUser.id,
        supplierType: 'WORKSHOP',
        publicName: 'ImpactLoop Demo Supplier',
        description: 'Reusable materials demo supplier for local development.',
      },
    });

    return {
      ownerId: existingDemoUser.id,
      supplierProfileId: supplierProfile.id,
      ownerMode: 'repaired-demo' as const,
      ownerEmail: existingDemoUser.email,
    };
  }

  const existingSupplier = await prisma.user.findFirst({
    where: {
      supplierProfile: {
        isNot: null,
      },
    },
    select: {
      id: true,
      email: true,
      supplierProfile: {
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (existingSupplier?.supplierProfile) {
    return {
      ownerId: existingSupplier.id,
      supplierProfileId: existingSupplier.supplierProfile.id,
      ownerMode: 'reused-existing' as const,
      ownerEmail: existingSupplier.email,
    };
  }

  const passwordHash = await hashPassword(DEMO_SUPPLIER_PASSWORD);

  const user = await prisma.user.create({
    data: {
      displayName: 'ImpactLoop Demo Supplier',
      email: DEMO_SUPPLIER_EMAIL,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: {
        create: {
          role: 'SUPPLIER',
          isPrimary: true,
        },
      },
      supplierProfile: {
        create: {
          supplierType: 'WORKSHOP',
          publicName: 'ImpactLoop Demo Supplier',
          description: 'Reusable materials demo supplier for local development.',
        },
      },
    },
    include: {
      supplierProfile: true,
    },
  });

  if (!user.supplierProfile) {
    throw new Error('Failed to create a valid demo supplier profile.');
  }

  return {
    ownerId: user.id,
    supplierProfileId: user.supplierProfile.id,
    ownerMode: 'created-demo' as const,
    ownerEmail: user.email,
  };
};

const ensureLearningAuthor = async () => {
  const existingLearner = await prisma.user.findFirst({
    where: {
      accountStatus: 'ACTIVE',
      roles: {
        some: {
          role: 'LEARNER',
        },
      },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (existingLearner) {
    return {
      authorId: existingLearner.id,
      authorMode: 'reused-existing-learner' as const,
      authorEmail: existingLearner.email,
      authorDisplayName: existingLearner.displayName,
    };
  }

  const existingDemoUser = await prisma.user.findUnique({
    where: { email: DEMO_LEARNER_EMAIL },
    include: {
      roles: true,
    },
  });

  if (existingDemoUser) {
    const learnerRole = existingDemoUser.roles.find(
      (role) => role.role === 'LEARNER',
    );

    if (!learnerRole) {
      await prisma.userRoleAssignment.create({
        data: {
          userId: existingDemoUser.id,
          role: 'LEARNER',
          isPrimary: existingDemoUser.roles.length === 0,
        },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: existingDemoUser.id },
      data: {
        displayName: 'ImpactLoop Demo Learner',
        accountStatus: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    });

    return {
      authorId: updatedUser.id,
      authorMode: 'repaired-demo-learner' as const,
      authorEmail: updatedUser.email,
      authorDisplayName: updatedUser.displayName,
    };
  }

  const passwordHash = await hashPassword(DEMO_LEARNER_PASSWORD);
  const createdUser = await prisma.user.create({
    data: {
      displayName: 'ImpactLoop Demo Learner',
      email: DEMO_LEARNER_EMAIL,
      passwordHash,
      accountStatus: 'ACTIVE',
      roles: {
        create: {
          role: 'LEARNER',
          isPrimary: true,
        },
      },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  });

  return {
    authorId: createdUser.id,
    authorMode: 'created-demo-learner' as const,
    authorEmail: createdUser.email,
    authorDisplayName: createdUser.displayName,
  };
};

const ensureCategory = async (
  input: SeedCategoryInput,
  desiredType: 'MATERIAL' | 'PROJECT',
) => {
  const existing = await prisma.category.findFirst({
    where: { nameEn: input.nameEn },
  });

  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data: {
        nameAr: input.nameAr,
        categoryType: mergeCategoryType(existing.categoryType, desiredType),
        isActive: true,
      },
    });
  }

  return prisma.category.create({
    data: {
      nameEn: input.nameEn,
      nameAr: input.nameAr,
      categoryType: desiredType,
      isActive: true,
    },
  });
};

const ensureLocation = async (input: SeedLocationInput) => {
  const existing = await prisma.location.findFirst({
    where: {
      country: input.country,
      city: input.city,
      area: input.area,
    },
  });

  if (existing) {
    return prisma.location.update({
      where: { id: existing.id },
      data: {
        visibility: 'PUBLIC_APPROXIMATE',
        isApproximate: true,
      },
    });
  }

  return prisma.location.create({
    data: {
      country: input.country,
      city: input.city,
      area: input.area,
      visibility: 'PUBLIC_APPROXIMATE',
      isApproximate: true,
    },
  });
};

const syncMaterialChildren = async (
  materialId: string,
  imageUrl: string,
  tags: string[],
) => {
  const existingCover = await prisma.materialImage.findFirst({
    where: {
      materialId,
      isCover: true,
    },
    orderBy: {
      sortOrder: 'asc',
    },
  });

  if (existingCover) {
    await prisma.materialImage.update({
      where: { id: existingCover.id },
      data: {
        imageUrl,
        sortOrder: 0,
        isCover: true,
      },
    });

    await prisma.materialImage.deleteMany({
      where: {
        materialId,
        id: { not: existingCover.id },
      },
    });
  } else {
    await prisma.materialImage.deleteMany({
      where: { materialId },
    });

    await prisma.materialImage.create({
      data: {
        materialId,
        imageUrl,
        isCover: true,
        sortOrder: 0,
      },
    });
  }

  await prisma.materialTag.deleteMany({
    where: { materialId },
  });

  await prisma.materialTag.createMany({
    data: tags.map((tag) => ({
      materialId,
      tag,
    })),
  });
};

const ensureMaterial = async (
  owner: Awaited<ReturnType<typeof ensureSupplierOwner>>,
  categoryId: string,
  locationId: string,
  input: SeedMaterialInput,
) => {
  const existing = await prisma.material.findFirst({
    where: {
      title: input.title,
      categoryId,
    },
  });

  const data = {
    ownerId: owner.ownerId,
    supplierProfileId: owner.supplierProfileId,
    categoryId,
    title: input.title,
    description: input.description,
    materialType: input.materialType,
    quantity: input.quantity,
    unit: input.unit,
    condition: input.condition,
    sourceType: 'WORKSHOP_SURPLUS' as const,
    status: input.status,
    isFree: input.isFree,
    price: input.price,
    currency: 'NIS',
    locationId,
    pickupAllowed: input.pickupAllowed,
    deliveryAllowed: input.deliveryAllowed,
    pickupNotes: null,
    suggestedUses: null,
  };

  const material = existing
    ? await prisma.material.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.material.create({ data });

  await syncMaterialChildren(material.id, input.imageUrl, input.tags);

  return material;
};

const syncProjectImages = async (
  projectId: string,
  images: SeedLearningProjectImageInput[],
) => {
  const existing = await prisma.projectImage.findMany({
    where: { projectId },
  });

  const existingByUrl = new Map(existing.map((image) => [image.imageUrl, image]));

  for (const image of images) {
    const existingImage = existingByUrl.get(image.imageUrl);

    if (existingImage) {
      await prisma.projectImage.update({
        where: { id: existingImage.id },
        data: {
          sortOrder: image.sortOrder,
        },
      });
    } else {
      await prisma.projectImage.create({
        data: {
          projectId,
          imageUrl: image.imageUrl,
          sortOrder: image.sortOrder,
        },
      });
    }
  }

  await prisma.projectImage.deleteMany({
    where: {
      projectId,
      imageUrl: {
        notIn: images.map((image) => image.imageUrl),
      },
    },
  });
};

const syncProjectComponents = async (
  projectId: string,
  components: SeedLearningProjectComponentInput[],
  categoryMap: Map<string, string>,
  reviewStatus: 'ACCEPTED' | 'PENDING_REVIEW',
) => {
  const existing = await prisma.projectRequiredComponent.findMany({
    where: { projectId },
  });

  const existingByName = new Map(
    existing.map((component) => [component.componentName, component]),
  );

  for (const component of components) {
    const categoryId = component.categoryKey
      ? categoryMap.get(component.categoryKey) ?? null
      : null;
    const data = {
      categoryId,
      componentName: component.componentName,
      materialType: component.materialType,
      quantity: component.quantity,
      unit: component.unit,
      componentRole: component.componentRole,
      isRequired: component.isRequired,
      canBeSubstituted: component.canBeSubstituted,
      searchKeywords: component.searchKeywords ?? null,
      alternativeKeywords: component.alternativeKeywords ?? null,
      providedByUser: false,
      confirmedByUser: true,
      generatedOrSuggestedByAi: false,
      reviewStatus,
      notes: component.notes ?? null,
    };

    const existingComponent = existingByName.get(component.componentName);

    if (existingComponent) {
      await prisma.projectRequiredComponent.update({
        where: { id: existingComponent.id },
        data,
      });
    } else {
      await prisma.projectRequiredComponent.create({
        data: {
          projectId,
          ...data,
        },
      });
    }
  }

  await prisma.projectRequiredComponent.deleteMany({
    where: {
      projectId,
      componentName: {
        notIn: components.map((component) => component.componentName),
      },
    },
  });
};

const syncProjectSteps = async (
  projectId: string,
  steps: SeedLearningProjectStepInput[],
  approvedBy: string | null,
  reviewStatus: 'ACCEPTED' | 'PENDING_REVIEW',
) => {
  const existing = await prisma.projectStep.findMany({
    where: { projectId },
  });

  const existingByStepNumber = new Map(
    existing.map((step) => [step.stepNumber, step]),
  );

  for (const step of steps) {
    const data = {
      title: step.title,
      description: step.description,
      imageUrl: step.imageUrl ?? null,
      generatedByAi: false,
      approvedBy,
      reviewStatus,
    };

    const existingStep = existingByStepNumber.get(step.stepNumber);

    if (existingStep) {
      await prisma.projectStep.update({
        where: { id: existingStep.id },
        data,
      });
    } else {
      await prisma.projectStep.create({
        data: {
          projectId,
          stepNumber: step.stepNumber,
          ...data,
        },
      });
    }
  }

  await prisma.projectStep.deleteMany({
    where: {
      projectId,
      stepNumber: {
        notIn: steps.map((step) => step.stepNumber),
      },
    },
  });
};

const syncProjectLinks = async (
  projectId: string,
  links: SeedLearningProjectLinkInput[],
) => {
  const existing = await prisma.projectLink.findMany({
    where: { projectId },
  });

  const existingByUrl = new Map(existing.map((link) => [link.url, link]));

  for (const link of links) {
    const data = {
      linkType: link.linkType,
      title: link.title ?? null,
      sourceName: link.sourceName ?? null,
    };

    const existingLink = existingByUrl.get(link.url);

    if (existingLink) {
      await prisma.projectLink.update({
        where: { id: existingLink.id },
        data,
      });
    } else {
      await prisma.projectLink.create({
        data: {
          projectId,
          url: link.url,
          ...data,
        },
      });
    }
  }

  await prisma.projectLink.deleteMany({
    where: {
      projectId,
      url: {
        notIn: links.map((link) => link.url),
      },
    },
  });
};

const syncProjectTags = async (projectId: string, tags: string[]) => {
  const existing = await prisma.projectTag.findMany({
    where: { projectId },
  });

  const existingByTag = new Map(existing.map((tag) => [tag.tag, tag]));

  for (const tag of tags) {
    const existingTag = existingByTag.get(tag);

    if (!existingTag) {
      await prisma.projectTag.create({
        data: {
          projectId,
          tag,
        },
      });
    }
  }

  await prisma.projectTag.deleteMany({
    where: {
      projectId,
      tag: {
        notIn: tags,
      },
    },
  });
};

const ensureLearningProject = async (
  author: Awaited<ReturnType<typeof ensureLearningAuthor>>,
  categoryMap: Map<string, string>,
  input: SeedLearningProjectInput,
) => {
  const categoryId = categoryMap.get(input.categoryKey);

  if (!categoryId) {
    throw new Error(`Missing category for learning project: ${input.title}`);
  }

  const existing = await prisma.learningProject.findFirst({
    where: {
      title: input.title,
      categoryId,
    },
  });

  const isPublished = input.status === 'PUBLISHED';
  const projectData = {
    categoryId,
    createdBy: author.authorId,
    title: input.title,
    shortDescription: input.shortDescription,
    description: input.description,
    difficulty: input.difficulty,
    estimatedDurationMinutes: input.estimatedDurationMinutes,
    coverImageUrl: input.coverImageUrl,
    status: input.status,
    reviewedBy: null,
    reviewNote: input.reviewNote ?? null,
    stepsGeneratedByAi: false,
    aiStepsGeneratedAt: null,
  };

  const project = existing
    ? await prisma.learningProject.update({
        where: { id: existing.id },
        data: projectData,
      })
    : await prisma.learningProject.create({
        data: projectData,
      });

  const reviewStatus = isPublished ? 'ACCEPTED' : 'PENDING_REVIEW';
  const approvedBy = isPublished ? author.authorId : null;

  await syncProjectImages(project.id, input.images);
  await syncProjectComponents(
    project.id,
    input.requiredComponents,
    categoryMap,
    reviewStatus,
  );
  await syncProjectSteps(project.id, input.steps, approvedBy, reviewStatus);
  await syncProjectLinks(project.id, input.links);
  await syncProjectTags(project.id, input.tags);

  return project;
};

const OBSOLETE_ALIAS_NORMALIZED_VALUES = new Set(
  ['رaspberry pi', 'رaspberry باي', 'سيرvo', 'درill'].map((alias) =>
    normalizeSearchText(alias),
  ),
);

const normalizeSeedAliases = (
  aliases: Array<{ alias: string; language?: string }>,
) => {
  const normalizedAliases = new Map<
    string,
    { alias: string; normalizedAlias: string; language: string | null }
  >();

  for (const alias of aliases) {
    const normalizedAlias = normalizeSearchText(alias.alias);

    if (!normalizedAliases.has(normalizedAlias)) {
      normalizedAliases.set(normalizedAlias, {
        alias: alias.alias,
        normalizedAlias,
        language: alias.language ?? null,
      });
    }
  }

  return [...normalizedAliases.values()];
};

const hasValidSeedPriceRule = (input: {
  nameEn: string;
  priceRule: {
    unit: string;
    maxAllowedUnitPriceNis?: number;
    maxAllowedTotalPriceNis?: number;
  };
}): boolean => {
  if (
    input.priceRule.maxAllowedUnitPriceNis == null &&
    input.priceRule.maxAllowedTotalPriceNis == null
  ) {
    console.warn(
      `Skipping invalid seed price rule for ${input.nameEn}: missing both max unit and max total price.`,
    );
    return false;
  }

  return true;
};

const syncAliases = async (
  materialTypeId: string,
  aliases: Array<{ alias: string; language?: string }>,
) => {
  const seedAliases = normalizeSeedAliases(aliases);

  await prisma.materialTypeAlias.deleteMany({
    where: {
      materialTypeId,
      normalizedAlias: { in: [...OBSOLETE_ALIAS_NORMALIZED_VALUES] },
    },
  });

  const existingAliases = await prisma.materialTypeAlias.findMany({
    where: { materialTypeId },
    select: { normalizedAlias: true },
  });
  const existingNormalizedAliases = new Set(
    existingAliases.map((alias) => alias.normalizedAlias),
  );

  for (const alias of seedAliases) {
    if (existingNormalizedAliases.has(alias.normalizedAlias)) {
      continue;
    }

    await prisma.materialTypeAlias.create({
      data: {
        materialTypeId,
        alias: alias.alias,
        normalizedAlias: alias.normalizedAlias,
        language: alias.language,
      },
    });
    existingNormalizedAliases.add(alias.normalizedAlias);
  }
};

const syncManualActivePriceRule = async (
  materialTypeId: string,
  materialTypeName: string,
  priceRule: {
    unit: string;
    maxAllowedUnitPriceNis?: number;
    maxAllowedTotalPriceNis?: number;
  },
) => {
  if (!hasValidSeedPriceRule({ nameEn: materialTypeName, priceRule })) {
    return;
  }

  await prisma.materialPriceRule.updateMany({
    where: {
      materialTypeId,
      currency: 'NIS',
      sourceType: 'MANUAL',
      status: 'ACTIVE',
      isActive: true,
      unit: { not: priceRule.unit },
    },
    data: {
      isActive: false,
      sourceNote:
        'Deactivated by seed because the reviewed manual unit changed.',
    },
  });

  const activeRules = await prisma.materialPriceRule.findMany({
    where: {
      materialTypeId,
      currency: 'NIS',
      unit: priceRule.unit,
      status: 'ACTIVE',
      isActive: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  const [ruleToUpdate, ...duplicateRules] = activeRules;

  if (duplicateRules.length > 0) {
    await prisma.materialPriceRule.updateMany({
      where: { id: { in: duplicateRules.map((rule) => rule.id) } },
      data: {
        isActive: false,
        sourceNote:
          'Deactivated by seed to avoid duplicate active rules for the same material type, currency, and unit.',
      },
    });
  }

  const data = {
    currency: 'NIS',
    unit: priceRule.unit,
    maxAllowedUnitPriceNis: priceRule.maxAllowedUnitPriceNis ?? null,
    maxAllowedTotalPriceNis: priceRule.maxAllowedTotalPriceNis ?? null,
    sourceType: 'MANUAL' as const,
    status: 'ACTIVE' as const,
    sourceNote: 'Initial MVP reviewed internal price rule',
    isActive: true,
  };

  if (ruleToUpdate) {
    await prisma.materialPriceRule.update({
      where: { id: ruleToUpdate.id },
      data,
    });
    return;
  }

  await prisma.materialPriceRule.create({
    data: {
      materialTypeId,
      ...data,
    },
  });
};

const seedMaterialTaxonomy = async () => {
  const categoryIds = new Map<string, string>();

  for (const category of MATERIAL_CATEGORY_SEEDS) {
    const record = await ensureCategory(
      {
        key: category.nameEn,
        nameEn: category.nameEn,
        nameAr: category.nameAr,
      },
      'MATERIAL',
    );

    categoryIds.set(category.nameEn, record.id);
  }

  for (const [categoryNameEn, materialTypes] of Object.entries(
    MATERIAL_TYPE_SEEDS,
  )) {
    const categoryId = categoryIds.get(categoryNameEn);

    if (!categoryId) {
      continue;
    }

    for (const materialType of materialTypes) {
      const normalizedName = normalizeSearchText(materialType.nameEn);
      const existing = await prisma.materialType.findFirst({
        where: {
          categoryId,
          normalizedName,
        },
        select: { id: true },
      });

      const savedMaterialType = existing
        ? await prisma.materialType.update({
            where: { id: existing.id },
            data: {
              nameAr: materialType.nameAr ?? null,
              defaultUnit: materialType.defaultUnit,
              normalizedName,
            },
            select: { id: true },
          })
        : await prisma.materialType.create({
            data: {
              categoryId,
              nameEn: materialType.nameEn,
              nameAr: materialType.nameAr ?? null,
              normalizedName,
              defaultUnit: materialType.defaultUnit,
            },
            select: { id: true },
          });

      await syncAliases(savedMaterialType.id, materialType.aliases);
      await syncManualActivePriceRule(
        savedMaterialType.id,
        materialType.nameEn,
        materialType.priceRule,
      );
    }
  }

  return [...categoryIds.keys()];
};

const main = async () => {
  const owner = await ensureSupplierOwner();
  const author = await ensureLearningAuthor();

  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    const record = await ensureCategory(category, 'MATERIAL');
    categoryMap.set(category.key, record.id);
  }

  const locationMap = new Map<string, string>();
  for (const location of locations) {
    const record = await ensureLocation(location);
    locationMap.set(location.key, record.id);
  }

  const seededMaterials: string[] = [];
  for (const material of materials) {
    const categoryId = categoryMap.get(material.categoryKey);
    const locationId = locationMap.get(material.locationKey);

    if (!categoryId || !locationId) {
      throw new Error(`Missing seed dependency for material: ${material.title}`);
    }

    const record = await ensureMaterial(owner, categoryId, locationId, material);
    seededMaterials.push(record.title);
  }

  for (const category of learningCategories) {
    const record = await ensureCategory(category, 'PROJECT');
    categoryMap.set(category.key, record.id);
  }

  const seededProjects: { title: string; status: string }[] = [];
  for (const project of learningProjects) {
    const record = await ensureLearningProject(author, categoryMap, project);
    seededProjects.push({ title: record.title, status: record.status });
  }

  const taxonomyCategoriesSeeded = await seedMaterialTaxonomy();
  const supplierReservationSeedResult = await seedSupplierReservations(prisma);

  console.log(
    JSON.stringify(
      {
        ownerMode: owner.ownerMode,
        ownerEmail: owner.ownerEmail,
        authorMode: author.authorMode,
        authorEmail: author.authorEmail,
        categoriesSeeded: categories.map((category) => category.nameEn),
        learningCategoriesSeeded: learningCategories.map(
          (category) => category.nameEn,
        ),
        locationsSeeded: locations.map(
          (location) => `${location.city} / ${location.area}`,
        ),
        materialsSeeded: seededMaterials,
        learningProjectsSeeded: seededProjects,
        materialTaxonomyCategoriesSeeded: taxonomyCategoriesSeeded,
        supplierReservationSeed: supplierReservationSeedResult,
        command: 'npm run seed',
      },
      null,
      2,
    ),
  );
};

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
