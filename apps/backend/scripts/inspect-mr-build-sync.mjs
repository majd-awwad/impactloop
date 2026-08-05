import { prisma } from '../src/database/prisma.js';
import { getMyProjectBuildById } from '../src/modules/learning-projects/learning-projects.service.js';

const requestId = process.argv[2] ?? 'cmsc1inu6000el0vgvj9q8iok';
const projectIds = process.argv.slice(3);
if (projectIds.length === 0) {
  projectIds.push(
    '69e4cb6c-c7fc-4f0b-96f0-2984c09fa8fd',
    '87bfb01b-6941-44e5-9872-e9efd67dad31',
  );
}

const request = await prisma.learnerMaterialRequest.findUnique({
  where: { id: requestId },
  include: {
    matches: {
      include: {
        reservation: {
          select: {
            id: true,
            status: true,
            requesterId: true,
            materialId: true,
            completedAt: true,
          },
        },
        material: { select: { id: true, title: true, status: true } },
      },
    },
  },
});

const build = request?.projectBuildId
  ? await prisma.projectBuild.findUnique({
      where: { id: request.projectBuildId },
      include: {
        items: {
          include: {
            requiredComponent: { select: { componentName: true } },
          },
        },
      },
    })
  : null;

const buildItem = request?.projectBuildItemId
  ? await prisma.projectBuildItem.findUnique({
      where: { id: request.projectBuildItemId },
    })
  : null;

let buildApiByProject = {};
if (request?.learnerId) {
  for (const projectId of projectIds) {
    try {
      const buildApi = await getMyProjectBuildById(projectId, request.learnerId);
      buildApiByProject[projectId] = {
        id: buildApi.id,
        readyCount: buildApi.progress?.ready,
        totalCount: buildApi.progress?.total,
        items: buildApi.items.map((item) => ({
          id: item.id,
          name: item.requiredComponentName,
          status: item.status,
          isReadyForBuild: item.isReadyForBuild,
          readinessLabel: item.readinessLabel,
          linkedMaterialId: item.linkedMaterial?.id,
          linkedReservationId: item.linkedReservation?.id,
          linkedReservationStatus: item.linkedReservation?.status,
        })),
      };
    } catch (error) {
      buildApiByProject[projectId] = { error: String(error) };
    }
  }
}

console.log(
  JSON.stringify(
    {
      request: request
        ? {
            id: request.id,
            status: request.status,
            learnerId: request.learnerId,
            projectId: request.projectId,
            projectBuildId: request.projectBuildId,
            projectBuildItemId: request.projectBuildItemId,
            fulfilledAt: request.fulfilledAt,
            requestedItemName: request.requestedItemName,
          }
        : null,
      matches: request?.matches.map((match) => ({
        id: match.id,
        materialRequestId: match.materialRequestId,
        materialId: match.materialId,
        status: match.status,
        reservationId: match.reservationId,
        materialTitle: match.material?.title,
        reservation: match.reservation,
      })),
      build: build
        ? {
            id: build.id,
            projectId: build.projectId,
            learnerId: build.learnerId,
            status: build.status,
          }
        : null,
      buildItem: buildItem
        ? {
            id: buildItem.id,
            buildId: buildItem.buildId,
            componentId: buildItem.componentId,
            status: buildItem.status,
            linkedMaterialId: buildItem.linkedMaterialId,
            linkedReservationId: buildItem.linkedReservationId,
            linkedMaterialAt: buildItem.linkedMaterialAt,
          }
        : null,
      buildApiByProject,
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
