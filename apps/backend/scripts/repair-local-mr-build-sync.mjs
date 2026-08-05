import { prisma } from '../src/database/prisma.js';
import { getLearnerMaterialRequest } from '../src/modules/learner-material-requests/learner-material-requests.service.js';
import { getMyProjectBuildById } from '../src/modules/learning-projects/learning-projects.service.js';

const requestId = process.argv[2] ?? 'cmsc1inu6000el0vgvj9q8iok';
const projectId = process.argv[3] ?? '87bfb01b-6941-44e5-9872-e9efd67dad31';

const request = await prisma.learnerMaterialRequest.findUnique({
  where: { id: requestId },
  select: { learnerId: true, projectBuildItemId: true },
});

if (!request) {
  console.error('Request not found');
  process.exit(1);
}

const buildItemBefore = request.projectBuildItemId
  ? await prisma.projectBuildItem.findUnique({
      where: { id: request.projectBuildItemId },
    })
  : null;

const before = await getMyProjectBuildById(projectId, request.learnerId);
const detail = await getLearnerMaterialRequest(request.learnerId, requestId);
const after = await getMyProjectBuildById(projectId, request.learnerId);

const buildItemAfter = request.projectBuildItemId
  ? await prisma.projectBuildItem.findUnique({
      where: { id: request.projectBuildItemId },
    })
  : null;

const item = after?.items.find((entry) => entry.id === request.projectBuildItemId);

console.log(
  JSON.stringify(
    {
      buildItemBefore: buildItemBefore
        ? {
            linkedMaterialId: buildItemBefore.linkedMaterialId,
            linkedReservationId: buildItemBefore.linkedReservationId,
            linkedMaterialAt: buildItemBefore.linkedMaterialAt,
          }
        : null,
      buildItemAfter: buildItemAfter
        ? {
            linkedMaterialId: buildItemAfter.linkedMaterialId,
            linkedReservationId: buildItemAfter.linkedReservationId,
            linkedMaterialAt: buildItemAfter.linkedMaterialAt,
          }
        : null,
      buildApiBefore: {
        ready: before?.progress.ready,
        total: before?.progress.total,
      },
      buildApiAfter: {
        ready: after?.progress.ready,
        total: after?.progress.total,
        item: item
          ? {
              isReadyForBuild: item.isReadyForBuild,
              readinessLabel: item.readinessLabel,
              linkedMaterialId: item.linkedMaterial?.id,
              linkedReservationId: item.linkedReservation?.id,
              linkedReservationStatus: item.linkedReservation?.status,
            }
          : null,
      },
      detail: {
        buildSyncRepaired: detail.buildSyncRepaired,
        acquiredMatches: detail.matches?.filter((match) => match.isAcquired),
      },
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
