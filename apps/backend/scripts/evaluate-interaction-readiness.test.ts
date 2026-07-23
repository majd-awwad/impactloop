import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGraphMetrics,
  buildMatrixMetrics,
  classifyOrigin,
  countItemsWithAtLeastUsers,
  formatProgress,
  hasOperationLeakage,
  profileDatabase,
  resolveInteractionRecords,
  summarizeDistribution,
  validateTemporalOrder,
  type RawInteraction,
} from "./evaluate-interaction-readiness.js";

const row = (overrides: Partial<RawInteraction>): RawInteraction => ({
  id: "1",
  userId: "u1",
  itemId: "i1",
  entityType: "MATERIAL",
  signal: "LIKE",
  state: "ACTIVE",
  occurredAt: new Date("2026-01-01T00:00:00Z"),
  source: "test",
  origin: "REAL_USER",
  ...overrides,
});

test("data origin classification is deterministic and keeps test/seed origins separate", () => {
  assert.equal(classifyOrigin({ userEmail: "majd@learner.com" }), "DEMO_SEED");
  assert.equal(
    classifyOrigin({ eventSource: "TEST", userEmail: "real@example.com" }),
    "TEST_FIXTURE",
  );
  assert.equal(classifyOrigin({ eventSource: "LOAD_TEST" }), "BENCHMARK");
  assert.equal(classifyOrigin({ userEmail: "real@example.com" }), "REAL_USER");
  assert.equal(
    classifyOrigin({ itemText: "[test-internal-delivery] copy" }),
    "TEST_FIXTURE",
  );
  assert.equal(classifyOrigin({}), "UNKNOWN");
});

test("duplicate active state resolves to one row and reversals remove the positive state", () => {
  const resolved = resolveInteractionRecords([
    row({ id: "like-1" }),
    row({ id: "like-2", occurredAt: new Date("2026-01-02T00:00:00Z") }),
    row({
      id: "unlike",
      signal: "UNLIKE",
      state: "REMOVED",
      occurredAt: new Date("2026-01-03T00:00:00Z"),
    }),
  ]);
  assert.equal(resolved.filter((entry) => entry.signal === "LIKE").length, 0);
  assert.equal(resolved.filter((entry) => entry.reversal).length, 1);
});

test("duplicate durable business operations are deduplicated by operation and signal", () => {
  const resolved = resolveInteractionRecords([
    row({
      id: "reservation-1",
      signal: "RESERVATION_CREATED",
      operationId: "reservation-op",
    }),
    row({
      id: "reservation-duplicate",
      signal: "RESERVATION_CREATED",
      operationId: "reservation-op",
      occurredAt: new Date("2026-01-01T00:01:00Z"),
    }),
  ]);
  assert.equal(resolved.length, 1);
});

test("views are capped per user-item UTC day and repeat views receive weaker bounded confidence", () => {
  const resolved = resolveInteractionRecords(
    Array.from({ length: 5 }, (_, index) =>
      row({
        id: `view-${index}`,
        signal: "VIEW",
        state: null,
        occurredAt: new Date(`2026-01-01T00:0${index}:00Z`),
      }),
    ),
  );
  assert.equal(resolved.length, 3);
  assert.deepEqual(
    resolved.map((entry) => entry.confidence),
    [0.25, 0.5, 0.5],
  );
});

test("reservation and build states receive distinct confidence treatment", () => {
  const resolved = resolveInteractionRecords([
    row({ id: "pending", signal: "RESERVATION_CREATED", state: "PENDING" }),
    row({
      id: "complete",
      signal: "RESERVATION_COMPLETED",
      state: "COMPLETED",
      occurredAt: new Date("2026-01-02T00:00:00Z"),
    }),
    row({
      id: "build",
      entityType: "PROJECT",
      signal: "PROJECT_BUILD_PROGRESS",
      state: "AVAILABLE",
      occurredAt: new Date("2026-01-03T00:00:00Z"),
    }),
  ]);
  assert.deepEqual(
    resolved.map((entry) => entry.confidence),
    [4, 6, 5],
  );
});

test("matrix density, sparsity, cold thresholds, and graph components are exact", () => {
  const pairs = [
    { userId: "u1", itemId: "i1", occurredAt: new Date() },
    { userId: "u1", itemId: "i2", occurredAt: new Date() },
    { userId: "u2", itemId: "i2", occurredAt: new Date() },
  ];
  const matrix = buildMatrixMetrics(
    ["u1", "u2", "u3"],
    ["i1", "i2", "i3"],
    pairs,
  );
  assert.equal(matrix.possibleCells, 9);
  assert.equal(matrix.observedPairs, 3);
  assert.equal(matrix.density, 1 / 3);
  assert.ok(Math.abs(matrix.sparsity - 2 / 3) < 1e-12);
  assert.equal(matrix.usersBelow["2"], 2);
  assert.equal(matrix.itemsBelow["2"], 2);
  const graph = buildGraphMetrics(pairs);
  assert.equal(graph.connectedComponents, 1);
  assert.equal(graph.isolatedUsers, 0);
  assert.equal(graph.isolatedItems, 0);
  assert.equal(graph.itemPairCooccurrence[0]?.count, 1);
  assert.equal(graph.userPairOverlap[0]?.count, 1);
  assert.equal(countItemsWithAtLeastUsers(matrix, 2), 1);
  assert.equal(countItemsWithAtLeastUsers(matrix, 3), 0);
});

test("timestamp validation catches ordering violations", () => {
  const errors = validateTemporalOrder({
    availabilityAt: new Date("2026-01-03T00:00:00Z"),
    impressionAt: new Date("2026-01-02T00:00:00Z"),
    actionAt: new Date("2026-01-01T00:00:00Z"),
    outcomeAt: new Date("2025-12-31T00:00:00Z"),
  });
  assert.deepEqual(errors, [
    "impression_before_availability",
    "action_before_impression",
    "outcome_before_action",
  ]);
});

test("progress output is deterministic, excludes non-real origin rows, and contains no PII fields", () => {
  const profile = {
    populations: { activeLearnersWithRealUserInteraction: 1 },
    origins: {
      distributions: {
        REAL_USER: {
          usersWithAtLeast2UniqueItems: 1,
          usersWithAtLeast5UniqueItems: 0,
          usersWithAtLeast10UniqueItems: 0,
        },
      },
    },
    temporal: { realActiveDays: 2 },
    matrices: {
      material: buildMatrixMetrics(
        ["u1"],
        ["m1", "m2"],
        [{ userId: "u1", itemId: "m1", occurredAt: new Date() }],
      ),
      project: buildMatrixMetrics(["u1"], ["p1"], []),
    },
    attribution: { direct: 2, assisted: 1 },
    queue: { backlog: 0, dead: 0 },
    splitEligibility: {
      usersWithAtLeast2MaterialItems: 1,
      usersWithAtLeast5MaterialItems: 0,
      usersWithAtLeast10MaterialItems: 0,
    },
    decision: "COLLECT_MORE_REAL_INTERACTIONS",
  } as any;
  const output = formatProgress(profile);
  assert.equal(output, formatProgress(profile));
  assert.match(output, /REAL_USERS_WITH_2_UNIQUE_ITEMS=1/);
  assert.match(output, /OUTBOX_BACKLOG=0/);
  assert.doesNotMatch(
    output,
    /@|email|phone|token|address|latitude|longitude|message|name/i,
  );
  assert.doesNotMatch(output, /DEMO_SEED|TEST_FIXTURE|BENCHMARK/);
});

test("percentile summaries are deterministic and profiling helpers perform no writes", () => {
  const summary = summarizeDistribution([1, 2, 3, 4]);
  assert.equal(summary.min, 1);
  assert.equal(summary.median, 2.5);
  assert.equal(summary.p75, 3.25);
  assert.equal(summary.p90, 3.7);
  assert.ok(Math.abs(summary.p95 - 3.85) < 1e-12);
  assert.equal(summary.max, 4);
  const source = profileDatabase.toString();
  assert.doesNotMatch(
    source,
    /\.(create|createMany|update|updateMany|delete|deleteMany|upsert|executeRaw|queryRaw)\s*\(/,
  );
});

test("repeated resolution runs produce identical profiles of the same input", () => {
  const input = [
    row({ id: "a", signal: "VIEW", state: null }),
    row({
      id: "b",
      signal: "VIEW",
      state: null,
      occurredAt: new Date("2026-01-01T00:01:00Z"),
    }),
  ];
  assert.deepEqual(
    resolveInteractionRecords(input),
    resolveInteractionRecords(input),
  );
});

test("durable operation groups cannot overlap train and test splits", () => {
  assert.equal(
    hasOperationLeakage(
      [row({ operationId: "op-1" })],
      [row({ operationId: "op-1", id: "different-row" })],
    ),
    true,
  );
  assert.equal(
    hasOperationLeakage(
      [row({ operationId: "op-1" })],
      [row({ operationId: "op-2" })],
    ),
    false,
  );
});
