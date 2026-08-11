/**
 * BEHAVIOR-DATA-02 — Demo behavior consistency, education taxonomy follow-up,
 * and Material Request journeys.
 *
 * Run: npm run seed:behavior-data-02
 *
 * Safe to re-run:
 * - Core viewsCount reconcile is absolute (set to COUNT(MaterialView))
 * - MR journeys keyed by openBusinessKey + [cdb2] description ownership
 * - Suggestions/dismissals/notifications use unique constraints / eventKeys
 *
 * Does NOT:
 * - redesign BEHAVIOR-DATA-01 engagement generation
 * - delete community behavior rows
 * - create reservations / payments / FULFILLED MR noise
 * - alter genuine (non-demo) learner requests
 */

import { prisma } from "../../../src/database/prisma.js";
import { invalidateLearnerHomeCache } from "../../../src/modules/learner-home/learner-home.service.js";
import { createLearnerMaterialRequest } from "../../../src/modules/learner-material-requests/learner-material-requests.service.js";
import { dismissLearnerMaterialRequestMatch } from "../../../src/modules/learner-material-requests/learner-material-requests.service.js";
import { suggestMaterialForRequest } from "../../../src/modules/supplier-material-requests/supplier-material-requests.service.js";
import { AppError } from "../../../src/utils/app-error.js";
import {
  BD02_MARKER,
  BD02_OP_PREFIX,
  MR_JOURNEY_PLANS,
  type MrJourneyPlan,
} from "./behavior-data-02.data.js";

const LOCAL_DATABASE_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEMO_PROJECT_KEY_PREFIX = "demo-project-key:";

const assertLocalDatabaseHost = () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for BEHAVIOR-DATA-02 seeding.");
  }
  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error("DATABASE_URL must be a valid URL.");
  }
  if (!LOCAL_DATABASE_HOSTS.has(hostname)) {
    throw new Error(
      `Refusing to seed BEHAVIOR-DATA-02 against non-local DB host "${hostname}".`,
    );
  }
};

type ViewReconcileStats = {
  coreMaterialsScanned: number;
  updated: number;
  alreadyAligned: number;
  beforeSumViewsCount: number;
  afterSumViewsCount: number;
  beforeSumEvents: number;
  afterSumEvents: number;
  topBefore: Array<{ title: string; viewsCount: number; events: number }>;
  topAfter: Array<{ title: string; viewsCount: number; events: number }>;
};

const isCommunityOwnerEmail = (email: string) =>
  email.toLowerCase().endsWith("@impactloop.demo");

/**
 * Semantic B: viewsCount is a denormalized lifetime counter; retained
 * MaterialView history may be partial in production. For local core/demo
 * catalog rows, inflated seed counters (50–90+) without matching events bias
 * popular ranking. Reconcile core (non-community) materials to the retained
 * event count so a 35-learner demo stays believable — without fabricating
 * thousands of historical views.
 */
const reconcileCoreMaterialViewCounts = async (): Promise<ViewReconcileStats> => {
  const materials = await prisma.material.findMany({
    select: {
      id: true,
      title: true,
      viewsCount: true,
      owner: { select: { email: true } },
      _count: { select: { views: true } },
    },
    orderBy: [{ viewsCount: "desc" }, { id: "asc" }],
  });

  const core = materials.filter((m) => !isCommunityOwnerEmail(m.owner.email));
  const topBefore = core.slice(0, 12).map((m) => ({
    title: m.title,
    viewsCount: m.viewsCount,
    events: m._count.views,
  }));

  let updated = 0;
  let alreadyAligned = 0;
  let beforeSumViewsCount = 0;
  let beforeSumEvents = 0;

  for (const material of core) {
    beforeSumViewsCount += material.viewsCount;
    beforeSumEvents += material._count.views;
    const target = material._count.views;
    if (material.viewsCount === target) {
      alreadyAligned += 1;
      continue;
    }
    await prisma.material.update({
      where: { id: material.id },
      data: { viewsCount: target },
    });
    updated += 1;
  }

  const afterCore = await prisma.material.findMany({
    where: { id: { in: core.map((m) => m.id) } },
    select: {
      id: true,
      title: true,
      viewsCount: true,
      _count: { select: { views: true } },
    },
    orderBy: [{ viewsCount: "desc" }, { id: "asc" }],
  });

  return {
    coreMaterialsScanned: core.length,
    updated,
    alreadyAligned,
    beforeSumViewsCount,
    afterSumViewsCount: afterCore.reduce((sum, m) => sum + m.viewsCount, 0),
    beforeSumEvents,
    afterSumEvents: afterCore.reduce((sum, m) => sum + m._count.views, 0),
    topBefore,
    topAfter: afterCore.slice(0, 12).map((m) => ({
      title: m.title,
      viewsCount: m.viewsCount,
      events: m._count.views,
    })),
  };
};

const findJourneyContext = async (plan: MrJourneyPlan) => {
  const learner = await prisma.user.findUnique({
    where: { email: plan.learnerEmail },
    select: {
      id: true,
      email: true,
      savedLocations: {
        where: { isDefault: true },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!learner) {
    throw new Error(`Missing learner ${plan.learnerEmail}`);
  }
  const savedLocationId = learner.savedLocations[0]?.id;
  if (!savedLocationId) {
    throw new Error(`Missing default saved location for ${plan.learnerEmail}`);
  }

  const project = await prisma.learningProject.findFirst({
    where: {
      tags: {
        some: { tag: `${DEMO_PROJECT_KEY_PREFIX}${plan.projectKey}` },
      },
    },
    select: { id: true, title: true },
  });
  if (!project) {
    throw new Error(`Missing project for key ${plan.projectKey}`);
  }

  const build = await prisma.projectBuild.findFirst({
    where: {
      learnerId: learner.id,
      projectId: project.id,
      attemptNumber: 1,
    },
    select: {
      id: true,
      items: {
        select: {
          id: true,
          status: true,
          requiredComponent: {
            select: {
              id: true,
              componentName: true,
              categoryId: true,
              quantity: true,
              unit: true,
            },
          },
        },
      },
    },
  });
  if (!build) {
    throw new Error(
      `Missing build for ${plan.learnerEmail} / ${plan.projectKey}`,
    );
  }

  const needle = plan.componentIncludes.toLowerCase();
  const matches = build.items.filter((row) =>
    row.requiredComponent.componentName.toLowerCase().includes(needle),
  );
  // Prefer MISSING items, then the longest component name (more specific).
  const item =
    [...matches].sort((a, b) => {
      const statusRank =
        Number(b.status === "MISSING") - Number(a.status === "MISSING");
      if (statusRank !== 0) return statusRank;
      return (
        b.requiredComponent.componentName.length -
        a.requiredComponent.componentName.length
      );
    })[0] ?? null;
  if (!item) {
    throw new Error(
      `Missing build item matching "${plan.componentIncludes}" on ${plan.projectKey}`,
    );
  }
  if (!item.requiredComponent.categoryId) {
    throw new Error(
      `Component ${item.requiredComponent.componentName} has no categoryId`,
    );
  }

  return {
    learner,
    savedLocationId,
    project,
    build,
    item,
    categoryId: item.requiredComponent.categoryId,
  };
};

const findOwnedDemoRequest = async (
  learnerId: string,
  categoryId: string,
  requestedItemName: string,
) => {
  const normalized = requestedItemName.trim().toLowerCase();
  return prisma.learnerMaterialRequest.findFirst({
    where: {
      learnerId,
      categoryId,
      status: "OPEN",
      OR: [
        { description: { contains: BD02_MARKER } },
        {
          normalizedRequestedItemName: {
            equals: normalized,
            mode: "insensitive",
          },
        },
      ],
    },
    include: {
      matches: {
        include: {
          material: { select: { id: true, title: true, ownerId: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
};

const pickSuggestionMaterial = async (plan: MrJourneyPlan) => {
  if (!plan.suggestMaterialTitleIncludes) {
    return null;
  }

  const candidates = await prisma.material.findMany({
    where: {
      status: { in: ["AVAILABLE", "PENDING_RESERVATION"] },
      title: {
        contains: plan.suggestMaterialTitleIncludes,
        mode: "insensitive",
      },
      quantity: { gt: 0 },
    },
    select: {
      id: true,
      title: true,
      ownerId: true,
      owner: { select: { email: true } },
      category: { select: { nameEn: true } },
    },
    take: 20,
  });

  if (candidates.length === 0) {
    throw new Error(
      `No suggestable material matching "${plan.suggestMaterialTitleIncludes}" for ${plan.key}`,
    );
  }

  if (plan.preferSupplierEmail) {
    const preferred = candidates.find(
      (c) =>
        c.owner.email.toLowerCase() === plan.preferSupplierEmail!.toLowerCase(),
    );
    if (preferred) return preferred;
  }

  return candidates[0]!;
};

const ensureSuggestion = async (input: {
  plan: MrJourneyPlan;
  requestId: string;
  materialId: string;
  supplierUserId: string;
  dismiss: boolean;
  learnerId: string;
}) => {
  const existing = await prisma.learnerMaterialRequestMatch.findUnique({
    where: {
      materialRequestId_materialId: {
        materialRequestId: input.requestId,
        materialId: input.materialId,
      },
    },
  });

  let matchId = existing?.id ?? null;
  let created = false;
  let suggested = false;

  if (!existing) {
    try {
      await suggestMaterialForRequest(input.supplierUserId, input.requestId, {
        materialId: input.materialId,
        confirmWeakMatch: true,
      });
      created = true;
      suggested = true;
    } catch (error) {
      if (
        error instanceof AppError &&
        error.code === "WEAK_MATCH_CONFIRMATION_REQUIRED"
      ) {
        await suggestMaterialForRequest(input.supplierUserId, input.requestId, {
          materialId: input.materialId,
          confirmWeakMatch: true,
        });
        created = true;
        suggested = true;
      } else {
        throw error;
      }
    }

    const createdMatch = await prisma.learnerMaterialRequestMatch.findUnique({
      where: {
        materialRequestId_materialId: {
          materialRequestId: input.requestId,
          materialId: input.materialId,
        },
      },
    });
    matchId = createdMatch?.id ?? null;
  } else if (existing.status === "SUGGESTED" || existing.status === "DISMISSED") {
    suggested = existing.status === "SUGGESTED";
  }

  if (!matchId) {
    throw new Error(`Failed to resolve match for ${input.plan.key}`);
  }

  let dismissed = false;
  if (input.dismiss) {
    const current = await prisma.learnerMaterialRequestMatch.findUnique({
      where: { id: matchId },
      select: { status: true },
    });
    if (current?.status === "SUGGESTED") {
      await dismissLearnerMaterialRequestMatch(input.learnerId, matchId);
      dismissed = true;
    } else if (current?.status === "DISMISSED") {
      dismissed = false; // already dismissed — idempotent no-op
    }
  }

  return { matchId, created, suggested, dismissed };
};

type JourneyResult = {
  key: string;
  kind: MrJourneyPlan["kind"];
  learnerEmail: string;
  requestId: string;
  projectId: string;
  buildId: string;
  buildItemId: string;
  componentName: string;
  status: string;
  requestCreated: boolean;
  matchStatus: string | null;
  suggestionMaterialTitle: string | null;
  matchCreated: boolean;
  dismissedNow: boolean;
  matchesCleared: number;
};

const seedMrJourneys = async (): Promise<{
  results: JourneyResult[];
  createdRequests: number;
  skippedRequests: number;
  createdMatches: number;
  dismissedMatches: number;
}> => {
  const results: JourneyResult[] = [];
  let createdRequests = 0;
  let skippedRequests = 0;
  let createdMatches = 0;
  let dismissedMatches = 0;

  for (const plan of MR_JOURNEY_PLANS) {
    const ctx = await findJourneyContext(plan);
    let request = await findOwnedDemoRequest(
      ctx.learner.id,
      ctx.categoryId,
      plan.requestedItemName,
    );
    let requestCreated = false;

    if (!request) {
      try {
        const created = await createLearnerMaterialRequest(ctx.learner.id, {
          requestedItemName: plan.requestedItemName,
          categoryId: ctx.categoryId,
          description: plan.description,
          quantity: plan.quantity,
          unit: plan.unit,
          alternativesAllowed: true,
          sourceSavedLocationId: ctx.savedLocationId,
          projectId: ctx.project.id,
          projectBuildId: ctx.build.id,
          projectBuildItemId: ctx.item.id,
        });
        requestCreated = true;
        createdRequests += 1;
        request = await prisma.learnerMaterialRequest.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            matches: {
              include: {
                material: { select: { id: true, title: true, ownerId: true } },
              },
            },
          },
        });
      } catch (error) {
        if (error instanceof AppError && error.code === "DUPLICATE_OPEN_REQUEST") {
          request = await findOwnedDemoRequest(
            ctx.learner.id,
            ctx.categoryId,
            plan.requestedItemName,
          );
          if (!request) throw error;
          skippedRequests += 1;
        } else {
          throw error;
        }
      }
    } else {
      skippedRequests += 1;
      // Ensure build linkage is present on owned demo requests.
      if (
        !request.projectBuildItemId ||
        request.projectBuildItemId !== ctx.item.id ||
        request.description?.includes(BD02_MARKER)
      ) {
        await prisma.learnerMaterialRequest.update({
          where: { id: request.id },
          data: {
            projectId: ctx.project.id,
            projectBuildId: ctx.build.id,
            projectBuildItemId: ctx.item.id,
            description: plan.description,
          },
        });
        request = await prisma.learnerMaterialRequest.findUniqueOrThrow({
          where: { id: request.id },
          include: {
            matches: {
              include: {
                material: { select: { id: true, title: true, ownerId: true } },
              },
            },
          },
        });
      }
    }

    if (!request) {
      throw new Error(`Failed to resolve request for ${plan.key}`);
    }

    let matchStatus: string | null = null;
    let suggestionMaterialTitle: string | null = null;
    let matchCreated = false;
    let dismissedNow = false;
    let matchesCleared = 0;

    if (plan.kind === "open_no_suggestions") {
      // Idempotent re-runs may retire a prior suggestion on this owned demo request.
      const stale = await prisma.learnerMaterialRequestMatch.findMany({
        where: { materialRequestId: request.id },
        select: { id: true },
      });
      if (stale.length > 0) {
        const matchIds = stale.map((row) => row.id);
        await prisma.notification.deleteMany({
          where: {
            OR: matchIds.map((id) => ({
              eventKey: `mr:suggest:${id}`,
            })),
          },
        });
        const deleted = await prisma.learnerMaterialRequestMatch.deleteMany({
          where: { materialRequestId: request.id },
        });
        matchesCleared = deleted.count;
      }
    } else {
      const material = await pickSuggestionMaterial(plan);
      if (!material) {
        throw new Error(`Missing suggestion material for ${plan.key}`);
      }
      suggestionMaterialTitle = material.title;
      const outcome = await ensureSuggestion({
        plan,
        requestId: request.id,
        materialId: material.id,
        supplierUserId: material.ownerId,
        dismiss: plan.kind === "open_with_dismissed_suggestion",
        learnerId: ctx.learner.id,
      });
      matchCreated = outcome.created;
      dismissedNow = outcome.dismissed;
      if (outcome.created) createdMatches += 1;
      if (outcome.dismissed) dismissedMatches += 1;

      const freshMatch = await prisma.learnerMaterialRequestMatch.findUnique({
        where: { id: outcome.matchId },
        select: { status: true },
      });
      matchStatus = freshMatch?.status ?? null;

      // Dismissed suggestion: keep historical notification but do not present as unread "new".
      if (
        plan.kind === "open_with_dismissed_suggestion" &&
        matchStatus === "DISMISSED"
      ) {
        await prisma.notification.updateMany({
          where: {
            userId: ctx.learner.id,
            relatedEntityType: "MATERIAL_REQUEST",
            relatedEntityId: request.id,
            OR: [
              { eventKey: `mr:suggest:${outcome.matchId}` },
              {
                notificationType: "MATERIAL_REQUEST_SUGGESTION",
                isRead: false,
              },
            ],
          },
          data: {
            isRead: true,
            readAt: new Date(),
          },
        });
      }
    }

    invalidateLearnerHomeCache(ctx.learner.id);

    results.push({
      key: plan.key,
      kind: plan.kind,
      learnerEmail: plan.learnerEmail,
      requestId: request.id,
      projectId: ctx.project.id,
      buildId: ctx.build.id,
      buildItemId: ctx.item.id,
      componentName: ctx.item.requiredComponent.componentName,
      status: request.status,
      requestCreated,
      matchStatus,
      suggestionMaterialTitle,
      matchCreated,
      dismissedNow,
      matchesCleared,
    });
  }

  return {
    results,
    createdRequests,
    skippedRequests,
    createdMatches,
    dismissedMatches,
  };
};

const countDemoMrNotifications = async () => {
  const rows = await prisma.notification.findMany({
    where: {
      OR: [
        { eventKey: { startsWith: "mr:suggest:" } },
        { eventKey: { startsWith: `mr:unavail:` } },
        { eventKey: { startsWith: `${BD02_OP_PREFIX}:` } },
      ],
      relatedEntityType: "MATERIAL_REQUEST",
      user: { email: { endsWith: "@impactloop.demo" } },
    },
    select: {
      id: true,
      notificationType: true,
      eventKey: true,
      relatedEntityId: true,
      entityId: true,
      actionType: true,
      user: { select: { email: true } },
    },
  });
  return rows.map((row) => ({
    email: row.user.email,
    type: row.notificationType,
    eventKey: row.eventKey,
    requestId: row.relatedEntityId ?? row.entityId,
    actionType: row.actionType,
  }));
};

async function main() {
  assertLocalDatabaseHost();

  console.log(
    JSON.stringify(
      {
        phase: "BEHAVIOR-DATA-02",
        marker: BD02_MARKER,
        opPrefix: BD02_OP_PREFIX,
      },
      null,
      2,
    ),
  );

  const viewStats = await reconcileCoreMaterialViewCounts();
  const mrStats = await seedMrJourneys();
  const notifications = await countDemoMrNotifications();

  const popular = await prisma.material.findMany({
    orderBy: [{ viewsCount: "desc" }, { id: "asc" }],
    take: 10,
    select: {
      title: true,
      viewsCount: true,
      owner: { select: { email: true } },
      _count: { select: { views: true } },
    },
  });

  const reservationCount = await prisma.reservation.count();
  const mrCount = await prisma.learnerMaterialRequest.count();
  const peopleCount = await prisma.user.count({
    where: { email: { endsWith: "@impactloop.demo" } },
  });
  const communityMaterials = await prisma.material.count({
    where: { owner: { email: { endsWith: "@impactloop.demo" } } },
  });

  console.log(
    JSON.stringify(
      {
        viewReconcile: viewStats,
        popularAfter: popular.map((m) => ({
          title: m.title,
          viewsCount: m.viewsCount,
          events: m._count.views,
          owner: m.owner.email,
        })),
        materialRequests: {
          total: mrCount,
          createdRequests: mrStats.createdRequests,
          skippedRequests: mrStats.skippedRequests,
          createdMatches: mrStats.createdMatches,
          dismissedMatches: mrStats.dismissedMatches,
          journeys: mrStats.results,
        },
        mrNotifications: notifications,
        sanity: {
          communityPeople: peopleCount,
          communityMaterials,
          reservations: reservationCount,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
