import type { Prisma } from '../../generated/prisma/client.js';

import { prisma } from '../../database/prisma.js';

import { isPersonallyReadyBuildItem } from './learning-projects.material-coverage.js';
import { resolveBuildItemReadiness } from './learning-projects.build-item-state.js';
import { resolveBuildItemAllocationContext } from './learning-projects.build-material-allocation.js';
import type { projectBuildInclude } from './learning-projects.project-build.includes.js';

type BuildForSnapshot = Prisma.ProjectBuildGetPayload<{
  include: typeof projectBuildInclude;
}>;

const isRequiredMaterialComponent = (role: string) => role !== 'TOOL';

export const buildCompletionSnapshotPayload = async (build: BuildForSnapshot) => {
  const allocationContexts = await resolveBuildItemAllocationContext(prisma, {
    buildStatus: build.status,
    items: build.items.map((item) => ({
      id: item.id,
      status: item.status,
      requiredComponentId: item.requiredComponent.id,
      linkedMaterialId: item.linkedMaterial?.id ?? null,
      linkedReservationId: item.linkedReservation?.id ?? null,
      requiredComponent: item.requiredComponent,
      linkedMaterial: item.linkedMaterial,
      linkedReservation: item.linkedReservation,
    })),
  });

  const allocationByItemId = new Map(
    allocationContexts.map((context) => [context.itemId, context]),
  );

  let requiredMaterialCount = 0;
  let readyAtCompletion = 0;
  let alreadyOwnedCount = 0;
  let acquiredViaReservationCount = 0;
  const acquiredMaterialIds = new Set<string>();
  const categoriesUsed = new Set<string>();

  for (const item of build.items) {
    if (!isRequiredMaterialComponent(item.requiredComponent.componentRole)) {
      continue;
    }

    requiredMaterialCount += 1;
    const allocation = allocationByItemId.get(item.id);
    const readiness = resolveBuildItemReadiness({
      status: item.status,
      componentRole: allocation?.componentRole,
      requiredQuantity: allocation?.requiredQuantity,
      requiredUnit: allocation?.requiredUnit,
      materialUnit: allocation?.materialUnit,
      availableQuantity: allocation?.availableQuantity,
      peerClaimsOnMaterial: allocation?.peerClaimsOnMaterial,
      allocationWarning: allocation?.allocationWarning,
      linkedReservation: item.linkedReservation,
      linkedMaterial: item.linkedMaterial,
    });

    if (
      isPersonallyReadyBuildItem({
        status: item.status,
        acquisitionState: readiness.acquisitionState,
        allocationResult: readiness.allocationResult,
        allocationWarning: allocation?.allocationWarning,
      })
    ) {
      readyAtCompletion += 1;
    }

    if (item.status === 'ALREADY_OWNED') {
      alreadyOwnedCount += 1;
    }

    if (
      item.linkedReservation?.status === 'COMPLETED' &&
      readiness.acquisitionState === 'acquired' &&
      readiness.allocationResult === 'sufficient'
    ) {
      acquiredViaReservationCount += 1;
      if (item.linkedMaterial?.id) {
        acquiredMaterialIds.add(item.linkedMaterial.id);
      }
    }

    const categoryName = item.requiredComponent.category?.nameEn;
    if (categoryName?.trim()) {
      categoriesUsed.add(categoryName.trim());
    }
  }

  const completedSteps = build.stepProgress.filter(
    (row) => row.completedAt != null,
  ).length;
  const totalSteps = build.project.steps.length;
  const completedAt = build.completedAt ?? new Date();

  return {
    projectId: build.projectId,
    projectTitle: build.project.title,
    attemptNumber: build.attemptNumber,
    completedAt: completedAt.toISOString(),
    startedAt: build.startedAt.toISOString(),
    elapsedMs: completedAt.getTime() - build.startedAt.getTime(),
    requiredMaterialComponentCount: requiredMaterialCount,
    readyMaterialComponentCount: readyAtCompletion,
    alreadyOwnedComponentCount: alreadyOwnedCount,
    acquiredViaImpactLoopCount: acquiredViaReservationCount,
    uniqueAcquiredMaterialCount: acquiredMaterialIds.size,
    completedStepCount: completedSteps,
    totalStepCount: totalSteps,
    materialCategoriesUsed: [...categoriesUsed].sort((a, b) => a.localeCompare(b)),
  };
};

export const createProjectBuildCompletionSnapshot = async (
  build: BuildForSnapshot,
) => {
  const existing = await prisma.projectBuildCompletionSnapshot.findUnique({
    where: { buildId: build.id },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const snapshot = await buildCompletionSnapshotPayload(build);

  return prisma.projectBuildCompletionSnapshot.create({
    data: {
      buildId: build.id,
      snapshot,
    },
  });
};
