import { getHeldQuantitiesByMaterialIds, toDecimal } from '../reservations/reservations.quantity.js';
import { mapMaterial } from '../materials/materials.service.js';
import { materialsQuerySchema } from '../materials/materials.validation.js';
import { learningProjectsQuerySchema } from '../learning-projects/learning-projects.validation.js';
import {
  LANDING_FEATURED_LIMIT,
  countAvailablePublicMaterials,
  countPublishedPublicProjects,
  countReusedMaterials,
  findFeaturedPublicMaterials,
  findFeaturedPublishedProjects,
  findPublicCommunityMembers,
} from './public-landing.repository.js';

const mapLandingProject = (
  project: Awaited<
    ReturnType<typeof findFeaturedPublishedProjects>
  >['items'][number],
) => ({
  id: project.id,
  title: project.title,
  shortDescription: project.shortDescription,
  category: {
    id: project.category.id,
    nameEn: project.category.nameEn,
    nameAr: project.category.nameAr,
  },
  difficulty: project.difficulty,
  estimatedDurationMinutes: project.estimatedDurationMinutes,
  coverImageUrl: project.coverImageUrl,
  authorName: project.createdByUser.displayName,
  creator: {
    id: project.createdByUser.id,
    displayName: project.createdByUser.displayName,
    avatarUrl: project.createdByUser.profileImageUrl,
  },
  tags: project.tags.map((tag) => tag.tag),
  createdAt: project.createdAt.toISOString(),
});

export const getPublicLanding = async () => {
  const materialsQuery = materialsQuerySchema.parse({
    page: 1,
    limit: LANDING_FEATURED_LIMIT,
    status: 'AVAILABLE',
    sort: 'newest',
  });
  const projectsQuery = learningProjectsQuerySchema.parse({
    page: 1,
    limit: LANDING_FEATURED_LIMIT,
    sort: 'NEWEST',
  });

  const [
    availableMaterialsCount,
    publishedProjectsCount,
    reusedMaterialsCount,
    materialsResult,
    projectsResult,
    communityMembers,
  ] = await Promise.all([
    countAvailablePublicMaterials(),
    countPublishedPublicProjects(),
    countReusedMaterials(),
    findFeaturedPublicMaterials(materialsQuery),
    findFeaturedPublishedProjects(projectsQuery),
    findPublicCommunityMembers(),
  ]);

  const heldByMaterialId = await getHeldQuantitiesByMaterialIds(
    materialsResult.items.map((item) => item.id),
  );

  return {
    stats: {
      availableMaterialsCount,
      publishedProjectsCount,
      reusedMaterialsCount,
    },
    materials: materialsResult.items.map((item) =>
      mapMaterial(item, heldByMaterialId.get(item.id) ?? toDecimal(0)),
    ),
    projects: projectsResult.items.map(mapLandingProject),
    communityMembers,
  };
};

export type PublicLandingResponse = Awaited<ReturnType<typeof getPublicLanding>>;
