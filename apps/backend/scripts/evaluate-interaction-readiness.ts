import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { prisma } from "../src/database/prisma.js";

export type InteractionOrigin =
  "REAL_USER" | "DEMO_SEED" | "TEST_FIXTURE" | "BENCHMARK" | "UNKNOWN";
export type EntityType = "MATERIAL" | "PROJECT";
export type SignalKind =
  | "VIEW"
  | "LIKE"
  | "UNLIKE"
  | "SAVE"
  | "UNSAVE"
  | "FOLLOW"
  | "UNFOLLOW"
  | "RESERVATION_CREATED"
  | "RESERVATION_ACCEPTED"
  | "RESERVATION_COMPLETED"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_REJECTED"
  | "RESERVATION_EXPIRED"
  | "RESERVATION_FAILED"
  | "PROJECT_BUILD_STARTED"
  | "PROJECT_BUILD_PROGRESS"
  | "PROJECT_BUILD_COMPLETED"
  | "IMPRESSION"
  | "RECOMMENDATION_ACTION";
export type RawInteraction = {
  id: string;
  userId: string | null;
  itemId: string | null;
  entityType: EntityType | null;
  signal: SignalKind;
  state: string | null;
  occurredAt: Date;
  source: string;
  eventSource?: string | null;
  attributionType?: "DIRECT" | "ASSISTED" | null;
  operationId?: string | null;
  origin: InteractionOrigin;
};
export type ResolvedInteraction = RawInteraction & {
  confidence: number;
  eligible: boolean;
  reversal: boolean;
  dedupeKey: string;
  reason: string;
};
export const MAX_PROFILE_ROWS = 250_000;
export const VIEW_CAP_PER_USER_ITEM_DAY = 3;

const SEED_USER_EMAILS = new Set([
  "majd@learner.com",
  "israa@learner.com",
  "learner@learner.com",
  "seed-learner-ahmad@impactloop.test",
  "seed-learner-sara@impactloop.test",
  "seed-learner-omar@impactloop.test",
  "seed-learner-lina@impactloop.test",
  "seed-learner-yousef@impactloop.test",
  "seed-supplier@impactloop.test",
  "majd@supplier.com",
  "israa@supplier.com",
  "supplier@supplier.com",
]);
const hasMarker = (value: unknown, markers: readonly string[]) =>
  markers.some((marker) =>
    String(value ?? "")
      .toLowerCase()
      .includes(marker),
  );

export const classifyOrigin = (input: {
  eventSource?: string | null;
  userEmail?: string | null;
  itemText?: string | null;
  sourceText?: string | null;
}): InteractionOrigin => {
  const eventSource = input.eventSource?.toUpperCase();
  if (eventSource === "LOAD_TEST") return "BENCHMARK";
  if (eventSource === "TEST") return "TEST_FIXTURE";
  if (eventSource === "SYNTHETIC") return "DEMO_SEED";
  if (
    hasMarker(input.userEmail, [
      "test-",
      "test_",
      "fixture",
      "benchmark",
      "load-test",
    ]) ||
    hasMarker(input.itemText, ["[test-", "test-internal", "fixture"]) ||
    hasMarker(input.sourceText, ["[test-", "fixture"])
  )
    return "TEST_FIXTURE";
  if (
    SEED_USER_EMAILS.has((input.userEmail ?? "").toLowerCase()) ||
    hasMarker(input.itemText, [
      "[realistic-impactloop-seed]",
      "(spare batch)",
    ]) ||
    hasMarker(input.sourceText, ["viewsource:seed", "seed reservation"])
  )
    return "DEMO_SEED";
  if (eventSource === "REAL" || input.userEmail) return "REAL_USER";
  return "UNKNOWN";
};

const utcDay = (date: Date) => date.toISOString().slice(0, 10);
const reversal = (signal: SignalKind) =>
  ["UNLIKE", "UNSAVE", "UNFOLLOW"].includes(signal);
const positive = (signal: SignalKind) =>
  ![
    "UNLIKE",
    "UNSAVE",
    "UNFOLLOW",
    "IMPRESSION",
    "RECOMMENDATION_ACTION",
    "RESERVATION_CANCELLED",
    "RESERVATION_REJECTED",
    "RESERVATION_EXPIRED",
    "RESERVATION_FAILED",
  ].includes(signal);
const confidenceFor = (signal: SignalKind) =>
  (
    ({
      VIEW: 0.25,
      LIKE: 2,
      SAVE: 3,
      FOLLOW: 2.5,
      RESERVATION_CREATED: 4,
      RESERVATION_ACCEPTED: 5,
      RESERVATION_COMPLETED: 6,
      PROJECT_BUILD_STARTED: 4,
      PROJECT_BUILD_PROGRESS: 5,
      PROJECT_BUILD_COMPLETED: 6,
      RESERVATION_CANCELLED: -1,
      RESERVATION_REJECTED: -1,
      RESERVATION_EXPIRED: -1,
      RESERVATION_FAILED: -1,
      UNLIKE: 0,
      UNSAVE: 0,
      UNFOLLOW: 0,
    }) as Partial<Record<SignalKind, number>>
  )[signal] ?? 0;
const actionSignal = (action: string): SignalKind =>
  (
    ({
      MATERIAL_VIEW: "VIEW",
      MATERIAL_LIKE: "LIKE",
      MATERIAL_UNLIKE: "UNLIKE",
      RESERVATION_CREATED: "RESERVATION_CREATED",
      RESERVATION_SUBMITTED: "RESERVATION_CREATED",
      PROJECT_LIKE: "LIKE",
      PROJECT_UNLIKE: "UNLIKE",
      PROJECT_SAVE: "SAVE",
      PROJECT_UNSAVE: "UNSAVE",
      PROJECT_FOLLOW: "FOLLOW",
      PROJECT_UNFOLLOW: "UNFOLLOW",
      PROJECT_BUILD_STARTED: "PROJECT_BUILD_STARTED",
      PROJECT_BUILD_PROGRESS_UPDATED: "PROJECT_BUILD_PROGRESS",
      PROJECT_BUILD_PROGRESSED: "PROJECT_BUILD_PROGRESS",
    }) as Record<string, SignalKind>
  )[action] ?? "RECOMMENDATION_ACTION";

export const resolveInteractionRecords = (
  raw: RawInteraction[],
): ResolvedInteraction[] => {
  const ordered = [...raw].sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      a.id.localeCompare(b.id),
  );
  const output: ResolvedInteraction[] = [];
  const viewCounts = new Map<string, number>();
  const stateEvents = new Map<string, RawInteraction[]>();
  const operationSeen = new Set<string>();
  for (const row of ordered) {
    if (!row.userId || !row.itemId || !row.entityType) continue;
    const pair = `${row.userId}|${row.entityType}|${row.itemId}`;
    if (row.signal === "VIEW") {
      const key = `${pair}|${utcDay(row.occurredAt)}`;
      const count = viewCounts.get(key) ?? 0;
      if (count >= VIEW_CAP_PER_USER_ITEM_DAY) continue;
      viewCounts.set(key, count + 1);
      output.push({
        ...row,
        confidence: count ? 0.5 : 0.25,
        eligible: true,
        reversal: false,
        dedupeKey: `${row.id}|${key}`,
        reason: count ? "capped repeat view" : "first view in UTC day",
      });
      continue;
    }
    if (
      ["LIKE", "UNLIKE", "SAVE", "UNSAVE", "FOLLOW", "UNFOLLOW"].includes(
        row.signal,
      )
    ) {
      const family =
        row.signal === "LIKE" || row.signal === "UNLIKE"
          ? "LIKE"
          : row.signal === "SAVE" || row.signal === "UNSAVE"
            ? "SAVE"
            : "FOLLOW";
      const key = `${pair}|${family}`;
      stateEvents.set(key, [...(stateEvents.get(key) ?? []), row]);
      continue;
    }
    const operationKey = row.operationId
      ? `${row.operationId}|${row.signal}`
      : null;
    if (operationKey && operationSeen.has(operationKey)) continue;
    if (operationKey) operationSeen.add(operationKey);
    const score = confidenceFor(row.signal);
    output.push({
      ...row,
      confidence: score,
      eligible: positive(row.signal) && score > 0,
      reversal: false,
      dedupeKey: row.operationId ?? row.id,
      reason: row.state ?? row.signal,
    });
  }
  for (const [key, rows] of stateEvents) {
    const final = [...rows].sort(
      (a, b) =>
        b.occurredAt.getTime() - a.occurredAt.getTime() ||
        b.id.localeCompare(a.id),
    )[0]!;
    const active = !reversal(final.signal);
    output.push({
      ...final,
      confidence: active ? confidenceFor(final.signal) : 0,
      eligible: active,
      reversal: !active,
      dedupeKey: `${key}|active-state`,
      reason: active
        ? "latest active state"
        : "latest reversal removes active state",
    });
  }
  return output.sort(
    (a, b) =>
      a.occurredAt.getTime() - b.occurredAt.getTime() ||
      a.dedupeKey.localeCompare(b.dedupeKey),
  );
};

export const hasOperationLeakage = (
  train: RawInteraction[],
  test: RawInteraction[],
) => {
  const trainKeys = new Set(train.map((row) => row.operationId ?? row.id));
  return test.some((row) => trainKeys.has(row.operationId ?? row.id));
};

export const validateTemporalOrder = (input: {
  availabilityAt: Date | null;
  impressionAt: Date | null;
  actionAt: Date | null;
  outcomeAt?: Date | null;
}): string[] => {
  const errors: string[] = [];
  if (
    input.availabilityAt &&
    input.impressionAt &&
    input.impressionAt < input.availabilityAt
  )
    errors.push("impression_before_availability");
  if (
    input.impressionAt &&
    input.actionAt &&
    input.actionAt < input.impressionAt
  )
    errors.push("action_before_impression");
  if (input.actionAt && input.outcomeAt && input.outcomeAt < input.actionAt)
    errors.push("outcome_before_action");
  return errors;
};

export const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  return low === high
    ? sorted[low]!
    : sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low);
};
export const summarizeDistribution = (values: number[]) => ({
  min: values.length ? Math.min(...values) : 0,
  median: percentile(values, 0.5),
  p75: percentile(values, 0.75),
  p90: percentile(values, 0.9),
  p95: percentile(values, 0.95),
  max: values.length ? Math.max(...values) : 0,
});
type Pair = { userId: string; itemId: string; occurredAt: Date };
export type MatrixMetrics = {
  users: number;
  items: number;
  possibleCells: number;
  observedPairs: number;
  density: number;
  sparsity: number;
  usersBelow: Record<"2" | "3" | "5" | "10", number>;
  itemsBelow: Record<"2" | "3" | "5" | "10", number>;
};
export const buildMatrixMetrics = (
  users: string[],
  items: string[],
  pairs: Pair[],
): MatrixMetrics => {
  const userItems = new Map(users.map((user) => [user, new Set<string>()]));
  const itemUsers = new Map(items.map((item) => [item, new Set<string>()]));
  const unique = new Set<string>();
  for (const pair of pairs) {
    unique.add(`${pair.userId}|${pair.itemId}`);
    if (!userItems.has(pair.userId)) userItems.set(pair.userId, new Set());
    if (!itemUsers.has(pair.itemId)) itemUsers.set(pair.itemId, new Set());
    userItems.get(pair.userId)!.add(pair.itemId);
    itemUsers.get(pair.itemId)!.add(pair.userId);
  }
  const below = (values: Iterable<Set<string>>, threshold: number) =>
    [...values].filter((set) => set.size < threshold).length;
  const possibleCells = users.length * items.length;
  const density = possibleCells ? unique.size / possibleCells : 0;
  return {
    users: users.length,
    items: items.length,
    possibleCells,
    observedPairs: unique.size,
    density,
    sparsity: 1 - density,
    usersBelow: {
      "2": below(userItems.values(), 2),
      "3": below(userItems.values(), 3),
      "5": below(userItems.values(), 5),
      "10": below(userItems.values(), 10),
    },
    itemsBelow: {
      "2": below(itemUsers.values(), 2),
      "3": below(itemUsers.values(), 3),
      "5": below(itemUsers.values(), 5),
      "10": below(itemUsers.values(), 10),
    },
  };
};

export const countItemsWithAtLeastUsers = (
  matrix: MatrixMetrics,
  threshold: 2 | 3 | 5,
): number => {
  const totalItems = matrix.items;
  if (threshold === 2) return totalItems - matrix.itemsBelow["2"];
  if (threshold === 3) return totalItems - matrix.itemsBelow["3"];
  return totalItems - matrix.itemsBelow["5"];
};

export type GraphMetrics = {
  connectedComponents: number;
  largestComponentShare: number;
  isolatedUsers: number;
  isolatedItems: number;
  userDegree: ReturnType<typeof summarizeDistribution>;
  itemDegree: ReturnType<typeof summarizeDistribution>;
  itemPairCooccurrence: Array<{ left: string; right: string; count: number }>;
  userPairOverlap: Array<{ left: string; right: string; count: number }>;
};
export const buildGraphMetrics = (pairs: Pair[]): GraphMetrics => {
  const userItems = new Map<string, Set<string>>();
  const itemUsers = new Map<string, Set<string>>();
  const adjacency = new Map<string, Set<string>>();
  for (const pair of pairs) {
    if (!userItems.has(pair.userId)) userItems.set(pair.userId, new Set());
    if (!itemUsers.has(pair.itemId)) itemUsers.set(pair.itemId, new Set());
    userItems.get(pair.userId)!.add(pair.itemId);
    itemUsers.get(pair.itemId)!.add(pair.userId);
    const user = `u:${pair.userId}`,
      item = `i:${pair.itemId}`;
    if (!adjacency.has(user)) adjacency.set(user, new Set());
    if (!adjacency.has(item)) adjacency.set(item, new Set());
    adjacency.get(user)!.add(item);
    adjacency.get(item)!.add(user);
  }
  const nodes = [...adjacency.keys()];
  const seen = new Set<string>();
  const sizes: number[] = [];
  for (const node of nodes) {
    if (seen.has(node)) continue;
    const queue = [node];
    seen.add(node);
    let size = 0;
    while (queue.length) {
      const current = queue.shift()!;
      size++;
      for (const next of adjacency.get(current) ?? [])
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
    }
    sizes.push(size);
  }
  const overlaps = (sets: Map<string, Set<string>>) => {
    const keys = [...sets.keys()].sort();
    const result: Array<{ left: string; right: string; count: number }> = [];
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++) {
        let count = 0;
        for (const value of sets.get(keys[i]!)!)
          if (sets.get(keys[j]!)!.has(value)) count++;
        if (count) result.push({ left: keys[i]!, right: keys[j]!, count });
      }
    return result
      .sort(
        (a, b) =>
          b.count - a.count ||
          `${a.left}|${a.right}`.localeCompare(`${b.left}|${b.right}`),
      )
      .slice(0, 20);
  };
  const totalNodes = userItems.size + itemUsers.size;
  return {
    connectedComponents: sizes.length,
    largestComponentShare: totalNodes ? Math.max(...sizes, 0) / totalNodes : 0,
    isolatedUsers: 0,
    isolatedItems: 0,
    userDegree: summarizeDistribution(
      [...userItems.values()].map((set) => set.size),
    ),
    itemDegree: summarizeDistribution(
      [...itemUsers.values()].map((set) => set.size),
    ),
    itemPairCooccurrence: overlaps(itemUsers),
    userPairOverlap: overlaps(userItems),
  };
};

const pseudonymizeGraph = (graph: GraphMetrics): GraphMetrics => {
  const pseudonym = (value: string) =>
    createHash("sha256").update(value).digest("hex").slice(0, 16);
  return {
    ...graph,
    itemPairCooccurrence: graph.itemPairCooccurrence.map((pair) => ({
      ...pair,
      left: pseudonym(pair.left),
      right: pseudonym(pair.right),
    })),
    userPairOverlap: graph.userPairOverlap.map((pair) => ({
      ...pair,
      left: pseudonym(pair.left),
      right: pseudonym(pair.right),
    })),
  };
};

const bounded = async <T>(rows: Promise<T[]>, total: number) => ({
  rows: await rows,
  total,
  capped: total > MAX_PROFILE_ROWS,
});
const statusSignal = (status: string): SignalKind =>
  status === "COMPLETED"
    ? "RESERVATION_COMPLETED"
    : status === "ACCEPTED"
      ? "RESERVATION_ACCEPTED"
      : status === "CANCELLED"
        ? "RESERVATION_CANCELLED"
        : status === "REJECTED"
          ? "RESERVATION_REJECTED"
          : status === "EXPIRED"
            ? "RESERVATION_EXPIRED"
            : ["NO_SHOW", "FULFILLMENT_FAILED"].includes(status)
              ? "RESERVATION_FAILED"
              : "RESERVATION_CREATED";

export async function profileDatabase(client: PrismaClient = prisma) {
  const started = performance.now();
  const [users, materials, projects] = await Promise.all([
    client.user.findMany({
      where: { roles: { some: { role: "LEARNER" } } },
      select: { id: true, email: true, accountStatus: true },
    }),
    client.material.findMany({
      take: MAX_PROFILE_ROWS,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { isActive: true } },
      },
    }),
    client.learningProject.findMany({
      take: MAX_PROFILE_ROWS,
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { isActive: true } },
      },
    }),
  ]);
  const [
    viewCount,
    likeCount,
    reservationCount,
    historyCount,
    projectLikeCount,
    saveCount,
    followCount,
    buildCount,
    impressionCount,
    actionCount,
    outboxCount,
    outboxStatuses,
  ] = await Promise.all([
    client.materialView.count(),
    client.materialLike.count(),
    client.reservation.count(),
    client.reservationStatusHistory.count(),
    client.projectLike.count(),
    client.projectSave.count(),
    client.projectFollow.count(),
    client.projectBuild.count(),
    client.recommendationImpression.count(),
    client.recommendationAction.count(),
    client.recommendationEventOutbox.count(),
    client.recommendationEventOutbox.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);
  const [
    views,
    likes,
    reservations,
    histories,
    projectLikes,
    saves,
    follows,
    builds,
    impressions,
    actions,
  ] = await Promise.all([
    bounded(
      client.materialView.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          materialId: true,
          viewerUserId: true,
          viewSource: true,
          createdAt: true,
          material: { select: { title: true, description: true } },
        },
      }),
      viewCount,
    ),
    bounded(
      client.materialLike.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          materialId: true,
          userId: true,
          createdAt: true,
          material: { select: { title: true, description: true } },
          user: { select: { email: true } },
        },
      }),
      likeCount,
    ),
    bounded(
      client.reservation.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          materialId: true,
          requesterId: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          acceptedAt: true,
          rejectedAt: true,
          cancelledAt: true,
          completedAt: true,
          message: true,
          material: { select: { title: true, description: true } },
          requester: { select: { email: true } },
        },
      }),
      reservationCount,
    ),
    bounded(
      client.reservationStatusHistory.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          reservationId: true,
          oldStatus: true,
          newStatus: true,
          createdAt: true,
        },
      }),
      historyCount,
    ),
    bounded(
      client.projectLike.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          projectId: true,
          userId: true,
          createdAt: true,
          project: { select: { title: true } },
          user: { select: { email: true } },
        },
      }),
      projectLikeCount,
    ),
    bounded(
      client.projectSave.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          projectId: true,
          userId: true,
          createdAt: true,
          project: { select: { title: true } },
          user: { select: { email: true } },
        },
      }),
      saveCount,
    ),
    bounded(
      client.projectFollow.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          projectId: true,
          userId: true,
          createdAt: true,
          project: { select: { title: true } },
          user: { select: { email: true } },
        },
      }),
      followCount,
    ),
    bounded(
      client.projectBuild.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          projectId: true,
          learnerId: true,
          status: true,
          startedAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
          project: { select: { title: true } },
          learner: { select: { email: true } },
          items: { select: { id: true, status: true, updatedAt: true } },
        },
      }),
      buildCount,
    ),
    bounded(
      client.recommendationImpression.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          learnerId: true,
          entityType: true,
          entityId: true,
          shownAt: true,
          eventSource: true,
          learner: { select: { email: true } },
        },
      }),
      impressionCount,
    ),
    bounded(
      client.recommendationAction.findMany({
        take: MAX_PROFILE_ROWS,
        select: {
          id: true,
          learnerId: true,
          entityType: true,
          entityId: true,
          actionType: true,
          attributionType: true,
          actionAt: true,
          sourceOperationId: true,
          eventSource: true,
          learner: { select: { email: true } },
          impression: { select: { shownAt: true } },
        },
      }),
      actionCount,
    ),
  ]);
  const userById = new Map(users.map((user) => [user.id, user]));
  const materialById = new Map(materials.map((item) => [item.id, item]));
  const projectById = new Map(projects.map((item) => [item.id, item]));
  const raw: RawInteraction[] = [];
  const add = (row: RawInteraction) => raw.push(row);
  for (const row of views.rows)
    add({
      id: row.id,
      userId: row.viewerUserId,
      itemId: row.materialId,
      entityType: "MATERIAL",
      signal: "VIEW",
      state: null,
      occurredAt: row.createdAt,
      source: row.viewSource ?? "material_views",
      origin: classifyOrigin({
        userEmail: userById.get(row.viewerUserId ?? "")?.email,
        itemText: `${row.material.title} ${row.material.description}`,
        sourceText: row.viewSource,
      }),
    });
  for (const row of likes.rows)
    add({
      id: row.id,
      userId: row.userId,
      itemId: row.materialId,
      entityType: "MATERIAL",
      signal: "LIKE",
      state: "ACTIVE",
      occurredAt: row.createdAt,
      source: "material_likes",
      origin: classifyOrigin({
        userEmail: row.user.email,
        itemText: `${row.material.title} ${row.material.description}`,
      }),
    });
  for (const row of reservations.rows)
    add({
      id: row.id,
      userId: row.requesterId,
      itemId: row.materialId,
      entityType: "MATERIAL",
      signal: statusSignal(row.status),
      state: row.status,
      occurredAt: row.createdAt,
      source: "reservations",
      operationId: row.id,
      origin: classifyOrigin({
        userEmail: row.requester.email,
        itemText: `${row.material.title} ${row.material.description}`,
        sourceText: row.message,
      }),
    });
  for (const row of projectLikes.rows)
    add({
      id: row.id,
      userId: row.userId,
      itemId: row.projectId,
      entityType: "PROJECT",
      signal: "LIKE",
      state: "ACTIVE",
      occurredAt: row.createdAt,
      source: "project_likes",
      origin: classifyOrigin({
        userEmail: row.user.email,
        itemText: row.project.title,
      }),
    });
  for (const row of saves.rows)
    add({
      id: row.id,
      userId: row.userId,
      itemId: row.projectId,
      entityType: "PROJECT",
      signal: "SAVE",
      state: "ACTIVE",
      occurredAt: row.createdAt,
      source: "project_saves",
      origin: classifyOrigin({
        userEmail: row.user.email,
        itemText: row.project.title,
      }),
    });
  for (const row of follows.rows)
    add({
      id: row.id,
      userId: row.userId,
      itemId: row.projectId,
      entityType: "PROJECT",
      signal: "FOLLOW",
      state: "ACTIVE",
      occurredAt: row.createdAt,
      source: "project_follows",
      origin: classifyOrigin({
        userEmail: row.user.email,
        itemText: row.project.title,
      }),
    });
  for (const row of builds.rows) {
    const origin = classifyOrigin({
      userEmail: row.learner.email,
      itemText: row.project.title,
    });
    add({
      id: `${row.id}:start`,
      userId: row.learnerId,
      itemId: row.projectId,
      entityType: "PROJECT",
      signal: "PROJECT_BUILD_STARTED",
      state: row.status,
      occurredAt: row.startedAt,
      source: "project_builds",
      operationId: row.id,
      origin,
    });
    for (const item of row.items.filter((item) => item.status !== "MISSING"))
      add({
        id: `${row.id}:item:${item.id}`,
        userId: row.learnerId,
        itemId: row.projectId,
        entityType: "PROJECT",
        signal:
          row.status === "COMPLETED"
            ? "PROJECT_BUILD_COMPLETED"
            : "PROJECT_BUILD_PROGRESS",
        state: item.status,
        occurredAt: item.updatedAt,
        source: "project_build_items",
        operationId: `${row.id}:${item.id}`,
        origin,
      });
  }
  for (const row of impressions.rows)
    add({
      id: row.id,
      userId: row.learnerId,
      itemId: row.entityId,
      entityType: row.entityType,
      signal: "IMPRESSION",
      state: null,
      occurredAt: row.shownAt,
      source: "recommendation_impressions",
      eventSource: row.eventSource,
      origin: classifyOrigin({
        eventSource: row.eventSource,
        userEmail: row.learner.email,
      }),
    });
  for (const row of actions.rows)
    add({
      id: row.id,
      userId: row.learnerId,
      itemId: row.entityId,
      entityType: row.entityType,
      signal: actionSignal(row.actionType),
      state: row.actionType,
      occurredAt: row.actionAt,
      source: "recommendation_actions",
      eventSource: row.eventSource,
      attributionType: row.attributionType,
      operationId: row.sourceOperationId,
      origin: classifyOrigin({
        eventSource: row.eventSource,
        userEmail: row.learner.email,
      }),
    });
  const resolved = resolveInteractionRecords(raw);
  const allObserved = resolved.filter(
    (row) => row.userId && row.itemId && row.entityType,
  );
  const real = resolved.filter(
    (row) =>
      row.eligible &&
      row.origin === "REAL_USER" &&
      row.userId &&
      row.itemId &&
      row.entityType,
  );
  const pairs = (entity: EntityType): Pair[] =>
    real
      .filter((row) => row.entityType === entity)
      .map((row) => ({
        userId: row.userId!,
        itemId: row.itemId!,
        occurredAt: row.occurredAt,
      }));
  const allPairs = (entity: EntityType): Pair[] =>
    allObserved
      .filter((row) => row.entityType === entity)
      .map((row) => ({
        userId: row.userId!,
        itemId: row.itemId!,
        occurredAt: row.occurredAt,
      }));
  const materialIds = materials
    .filter((item) => item.status === "AVAILABLE" && item.category.isActive)
    .map((item) => item.id);
  const projectIds = projects
    .filter((item) => item.status === "PUBLISHED" && item.category.isActive)
    .map((item) => item.id);
  const activeUsers = [...new Set(real.map((row) => row.userId!))];
  const grouped = (
    values: ResolvedInteraction[],
    key: (row: ResolvedInteraction) => string,
  ) =>
    [...new Set(values.map(key))].map((value) =>
      values.filter((row) => key(row) === value),
    );
  const dist = (groups: ResolvedInteraction[][], unique = false) =>
    summarizeDistribution(
      groups.map((group) =>
        unique
          ? new Set(group.map((row) => `${row.entityType}:${row.itemId}`)).size
          : group.length,
      ),
    );
  const usersAtLeast = (groups: ResolvedInteraction[][], threshold: number) =>
    groups.filter(
      (group) =>
        new Set(group.map((row) => `${row.entityType}:${row.itemId}`)).size >=
        threshold,
    ).length;
  const userGroups = grouped(real, (row) => row.userId!);
  const materialGroups = materialIds.map((id) =>
    real.filter((row) => row.entityType === "MATERIAL" && row.itemId === id),
  );
  const projectGroups = projectIds.map((id) =>
    real.filter((row) => row.entityType === "PROJECT" && row.itemId === id),
  );
  const originCounts = Object.fromEntries(
    (
      [
        "REAL_USER",
        "DEMO_SEED",
        "TEST_FIXTURE",
        "BENCHMARK",
        "UNKNOWN",
      ] as InteractionOrigin[]
    ).map((origin) => [
      origin,
      resolved.filter((row) => row.origin === origin).length,
    ]),
  );
  const daysByUser = new Map<string, Set<string>>();
  const daysByItem = new Map<string, Set<string>>();
  for (const row of real) {
    if (!daysByUser.has(row.userId!)) daysByUser.set(row.userId!, new Set());
    daysByUser.get(row.userId!)!.add(utcDay(row.occurredAt));
    const key = `${row.entityType}:${row.itemId}`;
    if (!daysByItem.has(key)) daysByItem.set(key, new Set());
    daysByItem.get(key)!.add(utcDay(row.occurredAt));
  }
  const timeline = [...raw]
    .filter((row) => row.userId && row.itemId)
    .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const first = timeline[0]?.occurredAt ?? null;
  const last = timeline.at(-1)?.occurredAt ?? null;
  const beforePublication = resolved.filter((row) => {
    const item =
      row.entityType === "MATERIAL"
        ? materialById.get(row.itemId ?? "")
        : projectById.get(row.itemId ?? "");
    return Boolean(item && row.occurredAt < item.createdAt);
  }).length;
  const impressionBeforeItemAvailability = impressions.rows.filter((row) => {
    const item =
      row.entityType === "MATERIAL"
        ? materialById.get(row.entityId)
        : projectById.get(row.entityId);
    return Boolean(item && row.shownAt < item.createdAt);
  }).length;
  const actionBeforeImpression = actions.rows.filter(
    (row) => row.actionAt < row.impression.shownAt,
  ).length;
  const attribution: Record<
    string,
    { total: number; DIRECT: number; ASSISTED: number }
  > = {};
  for (const row of actions.rows) {
    const key = `${row.entityType}:${row.actionType}`;
    const value = attribution[key] ?? { total: 0, DIRECT: 0, ASSISTED: 0 };
    value.total++;
    value[row.attributionType]++;
    attribution[key] = value;
  }
  const tableCounts = {
    materialViews: viewCount,
    materialLikes: likeCount,
    reservations: reservationCount,
    reservationStatusHistory: historyCount,
    projectViews: 0,
    projectLikes: projectLikeCount,
    projectSaves: saveCount,
    projectFollows: followCount,
    projectBuilds: buildCount,
    recommendationImpressions: impressionCount,
    recommendationActions: actionCount,
    recommendationEventOutbox: outboxCount,
  };
  const queueStatusCounts = Object.fromEntries(
    (["PENDING", "PROCESSING", "RETRY", "PROCESSED", "DEAD"] as const).map(
      (status) => [
        status,
        outboxStatuses.find((row) => row.status === status)?._count._all ?? 0,
      ],
    ),
  );
  const queue = {
    statusCounts: queueStatusCounts,
    backlog: ["PENDING", "PROCESSING", "RETRY"].reduce(
      (sum, status) => sum + (queueStatusCounts[status] ?? 0),
      0,
    ),
    dead: queueStatusCounts.DEAD ?? 0,
    processed: queueStatusCounts.PROCESSED ?? 0,
  };
  const materialRealUsers = new Set(
    pairs("MATERIAL").map((pair) => pair.userId),
  );
  const projectRealUsers = new Set(pairs("PROJECT").map((pair) => pair.userId));
  const allUsers = [...new Set(allObserved.map((row) => row.userId!))];
  const materialAllUsers = new Set(
    allPairs("MATERIAL").map((pair) => pair.userId),
  );
  const projectAllUsers = new Set(
    allPairs("PROJECT").map((pair) => pair.userId),
  );
  const originDistributions = Object.fromEntries(
    (
      [
        "REAL_USER",
        "DEMO_SEED",
        "TEST_FIXTURE",
        "BENCHMARK",
        "UNKNOWN",
      ] as InteractionOrigin[]
    ).map((origin) => {
      const rows = allObserved.filter((row) => row.origin === origin);
      const groups = grouped(rows, (row) => row.userId!);
      return [
        origin,
        {
          rows: rows.length,
          users: groups.length,
          usersWithAtLeast2UniqueItems: usersAtLeast(groups, 2),
          usersWithAtLeast5UniqueItems: usersAtLeast(groups, 5),
          usersWithAtLeast10UniqueItems: usersAtLeast(groups, 10),
          interactionsPerUser: dist(groups),
          uniqueItemsPerUser: dist(groups, true),
        },
      ];
    }),
  );
  const profile = {
    generatedAt: new Date().toISOString(),
    tablesScanned: Object.keys(tableCounts).length,
    tableCounts,
    bounded: {
      maxRowsPerTable: MAX_PROFILE_ROWS,
      cappedTables: [
        views,
        likes,
        reservations,
        histories,
        projectLikes,
        saves,
        follows,
        builds,
        impressions,
        actions,
      ].filter((value) => value.capped).length,
    },
    populations: {
      learnerUsers: users.length,
      activeLearners: users.filter((user) => user.accountStatus === "ACTIVE")
        .length,
      materials: materials.length,
      availableMaterials: materials.filter(
        (item) => item.status === "AVAILABLE",
      ).length,
      publicAvailableMaterials: materialIds.length,
      projects: projects.length,
      publicProjects: projectIds.length,
      activeLearnersWithInteraction: allUsers.length,
      activeLearnersWithRealUserInteraction: activeUsers.length,
      usersWithMaterialInteractions: materialAllUsers.size,
      usersWithRealMaterialInteractions: materialRealUsers.size,
      usersWithProjectInteractions: projectAllUsers.size,
      usersWithRealProjectInteractions: projectRealUsers.size,
      usersWithBothDomains: [...materialAllUsers].filter((id) =>
        projectAllUsers.has(id),
      ).length,
      usersWithBothRealDomains: [...materialRealUsers].filter((id) =>
        projectRealUsers.has(id),
      ).length,
      coldUsers: users.filter((user) => !allUsers.includes(user.id)).length,
      coldRealUsers: users.filter((user) => !activeUsers.includes(user.id))
        .length,
      coldMaterials: materialIds.filter(
        (id) => !allPairs("MATERIAL").some((pair) => pair.itemId === id),
      ).length,
      coldRealMaterials: materialIds.filter(
        (id) => !pairs("MATERIAL").some((pair) => pair.itemId === id),
      ).length,
      coldProjects: projectIds.filter(
        (id) => !allPairs("PROJECT").some((pair) => pair.itemId === id),
      ).length,
      coldRealProjects: projectIds.filter(
        (id) => !pairs("PROJECT").some((pair) => pair.itemId === id),
      ).length,
    },
    origins: {
      allResolvedRows: resolved.length,
      originCounts,
      realUserRows: originCounts.REAL_USER,
      demoSeedRows: originCounts.DEMO_SEED,
      testFixtureRows: originCounts.TEST_FIXTURE,
      benchmarkRows: originCounts.BENCHMARK,
      unknownRows: originCounts.UNKNOWN,
      distributions: originDistributions,
    },
    distributions: {
      interactionsPerUser: dist(userGroups),
      uniqueItemsPerUser: dist(userGroups, true),
      interactionsPerMaterial: dist(materialGroups),
      interactionsPerProject: dist(projectGroups),
      activityDaysPerUser: summarizeDistribution(
        [...daysByUser.values()].map((set) => set.size),
      ),
      activeTimeSpanDays:
        first && last
          ? Math.ceil((last.getTime() - first.getTime()) / 86_400_000)
          : 0,
      repeatInteractionRate: real.length
        ? 1 -
          new Set(
            real.map((row) => `${row.userId}|${row.entityType}|${row.itemId}`),
          ).size /
            real.length
        : 0,
    },
    allCurrentRows: {
      interactionsPerUser: dist(grouped(allObserved, (row) => row.userId!)),
      uniqueItemsPerUser: dist(
        grouped(allObserved, (row) => row.userId!),
        true,
      ),
      interactionsPerMaterial: dist(
        materials.map((item) =>
          allObserved.filter(
            (row) => row.entityType === "MATERIAL" && row.itemId === item.id,
          ),
        ),
      ),
      interactionsPerProject: dist(
        projects.map((item) =>
          allObserved.filter(
            (row) => row.entityType === "PROJECT" && row.itemId === item.id,
          ),
        ),
      ),
    },
    matrices: {
      material: buildMatrixMetrics(activeUsers, materialIds, pairs("MATERIAL")),
      project: buildMatrixMetrics(activeUsers, projectIds, pairs("PROJECT")),
      combined: buildMatrixMetrics(
        activeUsers,
        [
          ...materialIds.map((id) => `MATERIAL:${id}`),
          ...projectIds.map((id) => `PROJECT:${id}`),
        ],
        real.map((row) => ({
          userId: row.userId!,
          itemId: `${row.entityType}:${row.itemId}`,
          occurredAt: row.occurredAt,
        })),
      ),
      allCurrentRows: {
        material: buildMatrixMetrics(
          allUsers,
          materials.map((item) => item.id),
          allPairs("MATERIAL"),
        ),
        project: buildMatrixMetrics(
          allUsers,
          projects.map((item) => item.id),
          allPairs("PROJECT"),
        ),
      },
    },
    graph: {
      material: pseudonymizeGraph(buildGraphMetrics(pairs("MATERIAL"))),
      project: pseudonymizeGraph(buildGraphMetrics(pairs("PROJECT"))),
      allCurrentRows: {
        material: pseudonymizeGraph(buildGraphMetrics(allPairs("MATERIAL"))),
        project: pseudonymizeGraph(buildGraphMetrics(allPairs("PROJECT"))),
      },
    },
    stateResolution: {
      rawRows: raw.length,
      resolvedRows: resolved.length,
      realTrainableRows: real.length,
      viewsCapped:
        raw.filter((row) => row.signal === "VIEW").length -
        resolved.filter((row) => row.signal === "VIEW").length,
      reversals: resolved.filter((row) => row.reversal).length,
      reservationStates: Object.fromEntries(
        [...new Set(reservations.rows.map((row) => row.status))]
          .sort()
          .map((status) => [
            status,
            reservations.rows.filter((row) => row.status === status).length,
          ]),
      ),
      buildStates: Object.fromEntries(
        [...new Set(builds.rows.map((row) => row.status))]
          .sort()
          .map((status) => [
            status,
            builds.rows.filter((row) => row.status === status).length,
          ]),
      ),
    },
    attribution: {
      byAction: attribution,
      direct: actions.rows.filter((row) => row.attributionType === "DIRECT")
        .length,
      assisted: actions.rows.filter((row) => row.attributionType === "ASSISTED")
        .length,
      unattributedBusinessActions: null,
      actionOrigins: actions.rows.reduce(
        (acc, row) => {
          acc[row.eventSource] = (acc[row.eventSource] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    },
    queue,
    temporal: {
      earliest: first?.toISOString() ?? null,
      latest: last?.toISOString() ?? null,
      activeDays: new Set(timeline.map((row) => utcDay(row.occurredAt))).size,
      realActiveDays: new Set(real.map((row) => utcDay(row.occurredAt))).size,
      usersActiveMultipleDays: [...daysByUser.values()].filter(
        (set) => set.size > 1,
      ).length,
      itemsActiveMultipleDays: [...daysByItem.values()].filter(
        (set) => set.size > 1,
      ).length,
      interactionsBeforeItemPublication: beforePublication,
      impressionBeforeItemAvailability,
      actionBeforeImpression,
      futureTimestamps: resolved.filter(
        (row) => row.occurredAt.getTime() > Date.now() + 300_000,
      ).length,
      duplicateTimestampRows:
        raw.length -
        new Set(
          raw
            .filter((row) => row.userId && row.itemId)
            .map(
              (row) =>
                `${row.userId}|${row.entityType}|${row.itemId}|${row.signal}|${row.occurredAt.toISOString()}`,
            ),
        ).size,
      impossibleReservationOrdering: reservations.rows.filter(
        (row) =>
          row.updatedAt < row.createdAt ||
          Boolean(
            row.completedAt &&
            row.acceptedAt &&
            row.completedAt < row.acceptedAt,
          ) ||
          Boolean(row.cancelledAt && row.cancelledAt < row.createdAt),
      ).length,
      projectBuildOrdering: builds.rows.filter(
        (row) =>
          row.updatedAt < row.createdAt ||
          Boolean(row.completedAt && row.completedAt < row.startedAt),
      ).length,
    },
    leakage: {
      seededRows: resolved.filter((row) => row.origin === "DEMO_SEED").length,
      recommendationGeneratedRows: resolved.filter((row) =>
        row.source.startsWith("recommendation_"),
      ).length,
      workflowCopyItems: materials.filter((item) =>
        hasMarker(item.title, ["(spare batch)"]),
      ).length,
      linkedBuildItems: builds.rows.reduce(
        (sum, build) =>
          sum + build.items.filter((item) => item.status !== "MISSING").length,
        0,
      ),
      durableOperationDeduplication: true,
    },
    splitEligibility: {
      usersWithAtLeast2MaterialItems: new Set(
        activeUsers.filter(
          (userId) =>
            new Set(
              pairs("MATERIAL")
                .filter((pair) => pair.userId === userId)
                .map((pair) => pair.itemId),
            ).size >= 2,
        ),
      ).size,
      usersWithAtLeast5MaterialItems: new Set(
        activeUsers.filter(
          (userId) =>
            new Set(
              pairs("MATERIAL")
                .filter((pair) => pair.userId === userId)
                .map((pair) => pair.itemId),
            ).size >= 5,
        ),
      ).size,
      usersWithAtLeast10MaterialItems: new Set(
        activeUsers.filter(
          (userId) =>
            new Set(
              pairs("MATERIAL")
                .filter((pair) => pair.userId === userId)
                .map((pair) => pair.itemId),
            ).size >= 10,
        ),
      ).size,
      leaveOneOutUsersMaterial: new Set(
        activeUsers.filter(
          (userId) =>
            new Set(
              pairs("MATERIAL")
                .filter((pair) => pair.userId === userId)
                .map((pair) => pair.itemId),
            ).size >= 2,
        ),
      ).size,
      temporalPerUserUsersMaterial: new Set(
        activeUsers.filter(
          (userId) =>
            new Set(
              pairs("MATERIAL")
                .filter((pair) => pair.userId === userId)
                .map((pair) => pair.itemId),
            ).size >= 2,
        ),
      ).size,
      realTrainableRows: real.length,
    },
    features: {
      user: {
        learnerInterests: "ready-but-semantically-reviewed",
        preferredCityArea: "ready-as-bucket",
        freeDeliveryPreferences: "ready",
        IDs: "rejected",
      },
      material: {
        category: "ready",
        materialType: "needs-normalization",
        reviewedTags: "sparse",
        typedTaxonomyConcepts: "sparse-and-inactive",
        freeDelivery: "ready",
        locationBucket: "ready-as-bucket",
        condition: "ready",
      },
      project: {
        category: "ready",
        reviewedTags: "sparse",
        typedTaxonomyConcepts: "sparse-and-inactive",
        components: "needs-normalization",
        difficulty: "ready",
        IDs: "rejected",
      },
    },
    decision: "COLLECT_MORE_REAL_INTERACTIONS" as const,
    durationMs: performance.now() - started,
    outputSizeBytes: 0,
  };
  const json = JSON.stringify(profile, null, 2);
  profile.outputSizeBytes = Buffer.byteLength(json, "utf8");
  return profile;
}

export const formatProgress = (
  profile: Awaited<ReturnType<typeof profileDatabase>>,
): string => {
  const realUsers = profile.populations.activeLearnersWithRealUserInteraction;
  const realUserDistribution = profile.origins.distributions.REAL_USER;
  const material = profile.matrices.material;
  const project = profile.matrices.project;
  const realActiveDays = profile.temporal.realActiveDays;
  const eligibleUsers = profile.splitEligibility;
  const lines = [
    `REAL_USERS_WITH_INTERACTIONS=${realUsers}`,
    `REAL_USERS_WITH_2_UNIQUE_ITEMS=${realUserDistribution.usersWithAtLeast2UniqueItems}`,
    `REAL_USERS_WITH_5_UNIQUE_ITEMS=${realUserDistribution.usersWithAtLeast5UniqueItems}`,
    `REAL_USERS_WITH_10_UNIQUE_ITEMS=${realUserDistribution.usersWithAtLeast10UniqueItems}`,
    `REAL_ACTIVE_DAYS=${realActiveDays}`,
    `MATERIAL_OBSERVED_PAIRS=${material.observedPairs}`,
    `PROJECT_OBSERVED_PAIRS=${project.observedPairs}`,
    `MATERIAL_MATRIX_DENSITY=${material.density}`,
    `PROJECT_MATRIX_DENSITY=${project.density}`,
    `MATERIAL_ITEMS_WITH_2_USERS=${countItemsWithAtLeastUsers(material, 2)}`,
    `MATERIAL_ITEMS_WITH_3_USERS=${countItemsWithAtLeastUsers(material, 3)}`,
    `MATERIAL_ITEMS_WITH_5_USERS=${countItemsWithAtLeastUsers(material, 5)}`,
    `PROJECT_ITEMS_WITH_2_USERS=${countItemsWithAtLeastUsers(project, 2)}`,
    `PROJECT_ITEMS_WITH_3_USERS=${countItemsWithAtLeastUsers(project, 3)}`,
    `PROJECT_ITEMS_WITH_5_USERS=${countItemsWithAtLeastUsers(project, 5)}`,
    `DIRECT_ATTRIBUTION=${profile.attribution.direct}`,
    `ASSISTED_ATTRIBUTION=${profile.attribution.assisted}`,
    `OUTBOX_BACKLOG=${profile.queue.backlog}`,
    `OUTBOX_DEAD=${profile.queue.dead}`,
    `SPLIT_ELIGIBLE_USERS_MATERIAL_2=${eligibleUsers.usersWithAtLeast2MaterialItems}`,
    `SPLIT_ELIGIBLE_USERS_MATERIAL_5=${eligibleUsers.usersWithAtLeast5MaterialItems}`,
    `SPLIT_ELIGIBLE_USERS_MATERIAL_10=${eligibleUsers.usersWithAtLeast10MaterialItems}`,
    `DECISION=${profile.decision}`,
  ];
  return `${lines.join("\n")}\n`;
};

const main = async () => {
  const output = process.argv
    .find((arg) => arg.startsWith("--output="))
    ?.slice("--output=".length);
  const progress = process.argv.includes("--progress");
  try {
    const profile = await profileDatabase();
    const result = progress
      ? formatProgress(profile)
      : JSON.stringify(profile, null, 2);
    if (output) await writeFile(output, result, "utf8");
    else process.stdout.write(`${result}${progress ? "" : "\n"}`);
  } finally {
    await prisma.$disconnect();
  }
};
if (
  process.argv[1]
    ?.replace(/\\/g, "/")
    .endsWith("/evaluate-interaction-readiness.ts")
)
  void main();
