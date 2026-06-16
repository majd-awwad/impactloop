import { AppError } from '../../utils/app-error.js';

import * as materialsRepository from './materials.repository.js';
import type { MaterialsQuery } from './materials.validation.js';

const decimalToNumber = (value: { toNumber(): number } | number): number => {
  if (typeof value === 'number') {
    return value;
  }

  return value.toNumber();
};

const resolveSupplierName = (material: Awaited<
  ReturnType<typeof materialsRepository.findMaterialById>
>) => {
  if (!material) {
    return null;
  }

  return (
    material.supplierProfile?.publicName ??
    material.supplierProfile?.user.displayName ??
    material.owner.displayName ??
    null
  );
};

const mapMaterial = (
  material: NonNullable<
    Awaited<ReturnType<typeof materialsRepository.findMaterialById>>
  >,
) => ({
  id: material.id,
  title: material.title,
  description: material.description,
  category: {
    id: material.category.id,
    nameEn: material.category.nameEn,
    nameAr: material.category.nameAr,
  },
  condition: material.condition,
  status: material.status,
  quantity: decimalToNumber(material.quantity),
  unit: material.unit,
  isFree: material.isFree,
  price: material.price == null ? null : decimalToNumber(material.price),
  city: material.location.city,
  area: material.location.area,
  deliveryAvailable: material.deliveryAllowed,
  imageUrl: material.images[0]?.imageUrl ?? null,
  supplierName: resolveSupplierName(material),
  ratingSummary: null,
  createdAt: material.createdAt.toISOString(),
});

export const getMaterials = async (query: MaterialsQuery) => {
  const result = await materialsRepository.findMaterials(query);

  return {
    items: result.items.map(mapMaterial),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: result.total === 0 ? 0 : Math.ceil(result.total / query.limit),
    },
  };
};

export const getMaterialById = async (id: string) => {
  const material = await materialsRepository.findMaterialById(id);

  if (!material) {
    throw new AppError('Material not found', 404, 'NOT_FOUND');
  }

  return mapMaterial(material);
};
