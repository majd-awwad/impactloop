import type { AiContentBlock } from '../ai.content-blocks.js';
import type { AiLocale } from '../ai.types.js';
import { resolveBuildItemStepUnlockReadiness } from '../../learning-projects/learning-projects.build-material-linking.js';

const DEFAULT_CURRENCY_SYMBOL = '₪';

const toNullableHttpUrl = (value?: string | null): string | null => {
  if (!value?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(value.trim());
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }

  return null;
};

const formatPriceLabel = (input: {
  isFree: boolean;
  price: number | null;
  currency?: string | null;
  locale: AiLocale;
}): string => {
  if (input.isFree) {
    return input.locale === 'ar' ? 'مجاني' : 'Free';
  }

  if (input.price == null) {
    return input.locale === 'ar' ? 'مدفوع' : 'Paid';
  }

  const symbol =
    input.currency === 'ILS' || input.currency == null
      ? DEFAULT_CURRENCY_SYMBOL
      : input.currency;

  return `${symbol}${input.price.toFixed(0)}`;
};

const formatLocationLabel = (input: {
  city?: string | null;
  area?: string | null;
}): string | undefined => {
  const parts = [input.city, input.area].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : undefined;
};

const formatQuantityLabel = (quantity: number, unit?: string | null): string =>
  unit ? `${quantity} ${unit}` : `${quantity}`;

const formatEstimatedTime = (
  minutes: number | null | undefined,
  locale: AiLocale,
): string | undefined => {
  if (!minutes || minutes <= 0) {
    return undefined;
  }

  if (minutes < 60) {
    return locale === 'ar' ? `${minutes} دقيقة` : `${minutes} min`;
  }

  const hours = Math.round(minutes / 60);
  return locale === 'ar' ? `${hours} ساعة` : `${hours} h`;
};

const categoryLabel = (
  category: { nameEn: string; nameAr: string } | null | undefined,
  locale: AiLocale,
): string | undefined => {
  if (!category) {
    return undefined;
  }

  return locale === 'ar' ? category.nameAr || category.nameEn : category.nameEn;
};

export const mapMaterialToCard = (
  material: {
    id: string;
    title: string;
    condition?: string;
    isFree: boolean;
    price?: number | null;
    currency?: string | null;
    quantity?: number;
    unit?: string;
    category?: { nameEn: string; nameAr: string } | null;
    location?: { city: string; area?: string | null } | null;
    city?: string;
    area?: string | null;
    pickupAllowed?: boolean;
    deliveryAllowed?: boolean;
    imageUrl?: string | null;
    primaryImageUrl?: string | null;
    approximateDistanceKm?: number | null;
    distanceKm?: number | null;
  },
  locale: AiLocale,
) => ({
  materialId: material.id,
  title: material.title,
  thumbnailUrl: toNullableHttpUrl(
    material.primaryImageUrl ?? material.imageUrl ?? null,
  ),
  categoryLabel: categoryLabel(material.category ?? null, locale),
  condition: material.condition,
  quantityLabel:
    material.quantity != null
      ? formatQuantityLabel(material.quantity, material.unit)
      : undefined,
  priceLabel: formatPriceLabel({
    isFree: material.isFree,
    price: material.price ?? null,
    currency: material.currency,
    locale,
  }),
  locationLabel: formatLocationLabel({
    city: material.location?.city ?? material.city,
    area: material.location?.area ?? material.area,
  }),
  distanceKm: material.approximateDistanceKm ?? material.distanceKm ?? null,
  pickupAllowed: material.pickupAllowed,
  deliveryAllowed: material.deliveryAllowed ?? material.deliveryAllowed,
});

export const toMaterialResultsBlock = (
  materials: Parameters<typeof mapMaterialToCard>[0][],
  locale: AiLocale,
): AiContentBlock => ({
  type: 'material_results',
  items: materials.map((material) => mapMaterialToCard(material, locale)),
});

export const toMaterialDetailsBlock = (
  material: Parameters<typeof mapMaterialToCard>[0],
  locale: AiLocale,
): AiContentBlock => ({
  type: 'material_details',
  item: mapMaterialToCard(material, locale),
});

export const mapProjectToCard = (
  project: {
    id: string;
    title: string;
    coverImageUrl?: string | null;
    difficulty?: string;
    estimatedDurationMinutes?: number | null;
    tags?: string[];
    isSaved?: boolean;
    activeBuildId?: string | null;
  },
  locale: AiLocale,
) => ({
  projectId: project.id,
  title: project.title,
  thumbnailUrl: toNullableHttpUrl(project.coverImageUrl ?? null),
  difficulty: project.difficulty,
  estimatedTimeLabel: formatEstimatedTime(project.estimatedDurationMinutes, locale),
  interestLabels: project.tags?.slice(0, 6),
  savedByLearner: project.isSaved,
  activeBuildId: project.activeBuildId ?? null,
});

export const toProjectResultsBlock = (
  projects: Parameters<typeof mapProjectToCard>[0][],
  locale: AiLocale,
): AiContentBlock => ({
  type: 'project_results',
  items: projects.map((project) => mapProjectToCard(project, locale)),
});

export const toProjectDetailsBlock = (
  project: Parameters<typeof mapProjectToCard>[0] & {
    shortDescription?: string | null;
    description?: string | null;
  },
  locale: AiLocale,
): AiContentBlock => ({
  type: 'project_details',
  item: {
    ...mapProjectToCard(project, locale),
    summary: project.shortDescription ?? project.description ?? undefined,
  },
});

export const toComponentListBlock = (
  project: {
    id: string;
    title: string;
    coverImageUrl?: string | null;
  },
  components: Array<{
    id: string;
    componentName: string;
    quantity: number | string;
    unit?: string | null;
    isRequired: boolean;
    alternativesAllowed?: boolean | null;
    category?: { nameEn: string; nameAr: string } | null;
  }>,
  locale: AiLocale,
): AiContentBlock => ({
  type: 'component_list',
  projectId: project.id,
  projectTitle: project.title,
  projectImageUrl: toNullableHttpUrl(project.coverImageUrl ?? null),
  items: components.map((component) => ({
    componentId: component.id,
    name: component.componentName,
    quantity: Number(component.quantity),
    unit: component.unit ?? undefined,
    required: component.isRequired,
    categoryLabel: categoryLabel(component.category ?? null, locale),
    alternativesAllowed: component.alternativesAllowed ?? undefined,
  })),
});

export type BuildGuideReadinessItem = {
  status: string;
  linkedMaterial?: { id: string } | null;
  linkedReservation?: { id: string; status: string } | null;
};

export const isGenuinelyReadyForStepUnlock = (item: BuildGuideReadinessItem): boolean =>
  resolveBuildItemStepUnlockReadiness({
    status: item.status,
    linkedMaterial: item.linkedMaterial as Parameters<
      typeof resolveBuildItemStepUnlockReadiness
    >[0]['linkedMaterial'],
    linkedReservation: item.linkedReservation as Parameters<
      typeof resolveBuildItemStepUnlockReadiness
    >[0]['linkedReservation'],
  }).isReadyForStepUnlock;

export const filterGenuinelyMissingBuildItems = <
  T extends BuildGuideReadinessItem,
>(
  items: T[],
): T[] => items.filter((item) => !isGenuinelyReadyForStepUnlock(item));

export const toBuildChecklistBlock = (
  build: {
    id: string;
    projectId: string;
    progress: { ready: number; total: number };
    items: Array<{
      id: string;
      requiredComponentId: string;
      status: string;
      readinessLabel: string;
      linkedMaterial?: { id: string } | null;
      linkedReservation?: { id: string } | null;
      component: { componentName: string };
    }>;
  },
): AiContentBlock => ({
  type: 'build_checklist',
  buildId: build.id,
  projectId: build.projectId,
  readyCount: build.progress.ready,
  totalRequired: build.progress.total,
  items: build.items.map((item) => ({
    componentId: item.requiredComponentId,
    name: item.component.componentName,
    status: item.status,
    readinessLabel: item.readinessLabel,
    linkedMaterialId: item.linkedMaterial?.id ?? null,
    linkedReservationId: item.linkedReservation?.id ?? null,
  })),
});

export const toMissingBuildChecklistBlock = (
  build: {
    id: string;
    projectId: string;
    progress: { ready: number; total: number };
    items: Array<{
      id: string;
      requiredComponentId: string;
      status: string;
      readinessLabel: string;
      linkedMaterial?: { id: string } | null;
      linkedReservation?: { id: string; status: string } | null;
      component: { componentName: string };
    }>;
  },
): AiContentBlock => {
  const notReadyItems = filterGenuinelyMissingBuildItems(build.items);

  return {
    type: 'build_checklist',
    buildId: build.id,
    projectId: build.projectId,
    readyCount: build.progress.ready,
    totalRequired: build.progress.total,
    items: notReadyItems.map((item) => ({
      componentId: item.requiredComponentId,
      name: item.component.componentName,
      status: item.status,
      readinessLabel: item.readinessLabel,
      linkedMaterialId: item.linkedMaterial?.id ?? null,
      linkedReservationId: item.linkedReservation?.id ?? null,
    })),
  };
};

export const toComponentMatchesBlock = (
  groups: Array<{
    componentId: string;
    componentName: string;
    materials: Parameters<typeof mapMaterialToCard>[0][];
  }>,
  locale: AiLocale,
  buildId?: string,
): AiContentBlock => ({
  type: 'component_matches',
  buildId,
  groups: groups.map((group) => ({
    componentId: group.componentId,
    componentName: group.componentName,
    materials: group.materials.map((material) => mapMaterialToCard(material, locale)),
  })),
});

export const toComparisonBlock = (
  subject: 'MATERIAL' | 'PROJECT',
  items: Array<{ id: string; title: string; facts: string[] }>,
): AiContentBlock => ({
  type: 'comparison',
  subject,
  items,
});

export const toRecommendationsBlock = (
  recommendationType: 'MATERIALS' | 'PROJECTS' | 'NEXT_ACTIONS',
  items: Array<{
    itemType: 'MATERIAL' | 'PROJECT' | 'ACTION';
    itemId: string;
    title: string;
    reasons: string[];
    thumbnailUrl?: string | null;
    priceLabel?: string;
    categoryLabel?: string;
    difficulty?: string;
    estimatedTimeLabel?: string;
    distanceKm?: number | null;
    savedByLearner?: boolean;
    activeBuildId?: string | null;
  }>,
): AiContentBlock => ({
  type: 'recommendations',
  recommendationType,
  items,
});

const formatComponentNameList = (names: string[], locale: AiLocale): string => {
  if (names.length <= 1) {
    return names[0] ?? '';
  }

  if (locale === 'ar') {
    return `${names.slice(0, -1).join(' و')}${names.length > 1 ? ' و' : ''}${names[names.length - 1]}`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]}`;
  }

  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
};

export const buildComponentMatchesIntro = (
  trustedBlocks: AiContentBlock[],
  locale: AiLocale,
): string => {
  const matchBlock = trustedBlocks.find((block) => block.type === 'component_matches');
  if (matchBlock?.type !== 'component_matches') {
    return locale === 'ar'
      ? 'هذه مواد مطابقة من ImpactLoop:'
      : 'Here are matching materials from ImpactLoop:';
  }

  const componentNames = matchBlock.groups.map((group) => group.componentName).filter(Boolean);
  const joined = formatComponentNameList(componentNames, locale);
  return locale === 'ar'
    ? `وجدت مواد مطابقة للمكونات الناقصة: ${joined}.`
    : `I found matching materials for missing components: ${joined}.`;
};

export const buildProjectMaterialAvailabilityIntro = (
  locale: AiLocale,
  projectTitle?: string,
): string => {
  if (projectTitle) {
    return locale === 'ar'
      ? `المواد المتوفرة حالياً على ImpactLoop لمشروع ${projectTitle}:`
      : `Currently available ImpactLoop materials for ${projectTitle}:`;
  }

  return locale === 'ar'
    ? 'المواد المتوفرة حالياً على ImpactLoop لمكونات هذا المشروع:'
    : 'Currently available ImpactLoop materials for this project:';
};

export const mergeAgentBlocks = (
  text: string,
  blocks: AiContentBlock[],
  purpose: 'answer' | 'clarification' = 'answer',
): AiContentBlock[] => [
  { type: 'text', text, purpose },
  ...blocks,
];
