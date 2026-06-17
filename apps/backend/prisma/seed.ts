import { prisma } from '../src/database/prisma.js';
import { hashPassword } from '../src/utils/password.js';

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

const DEMO_SUPPLIER_EMAIL = 'demo.materials.supplier@impactloop.local';
const DEMO_SUPPLIER_PASSWORD = 'ImpactLoopSeed123!';

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
    const supplierRole = existingDemoUser.roles.find((role) => role.role === 'SUPPLIER');

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
      displayName: true,
      email: true,
      supplierProfile: {
        select: {
          id: true,
          publicName: true,
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

const ensureCategory = async (input: SeedCategoryInput) => {
  const existing = await prisma.category.findFirst({
    where: { nameEn: input.nameEn },
  });

  if (existing) {
    return prisma.category.update({
      where: { id: existing.id },
      data: {
        nameAr: input.nameAr,
        categoryType: 'MATERIAL',
        isActive: true,
      },
    });
  }

  return prisma.category.create({
    data: {
      nameEn: input.nameEn,
      nameAr: input.nameAr,
      categoryType: 'MATERIAL',
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

const syncMaterialChildren = async (materialId: string, imageUrl: string, tags: string[]) => {
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

const main = async () => {
  const owner = await ensureSupplierOwner();

  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    const record = await ensureCategory(category);
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

  console.log(
    JSON.stringify(
      {
        ownerMode: owner.ownerMode,
        ownerEmail: owner.ownerEmail,
        categoriesSeeded: categories.map((category) => category.nameEn),
        locationsSeeded: locations.map(
          (location) => `${location.city} / ${location.area}`,
        ),
        materialsSeeded: seededMaterials,
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
