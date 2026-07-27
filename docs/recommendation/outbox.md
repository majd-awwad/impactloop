# Recommendation Outbox Delivery

## Purpose

`RecommendationEventOutbox` separates recommendation computation from durable event materialization. The request path enqueues a bounded generation/exposure envelope, while the worker writes the retained normalized recommendation tables asynchronously.

## Payload and privacy contract

The three schema versions are `recommendation-generation-outbox-v1`, `recommendation-exposure-outbox-v1`, and `recommendation-action-outbox-v1`. Action payloads contain only an action ID, learner ID, finite action/entity type, entity ID, optional impression hint, bounded source operation ID, occurrence time, event source, and schema version. Payload size is capped at 256 KiB. Candidate traces and impressions are capped at 512 records.

Names, emails, descriptions, search text, coordinates, tokens, request bodies, response bodies, and supplier/private fields are not serialized. The outbox is an operational delivery buffer, not an analytics warehouse; retention and aggregation jobs remain future work.

## Delivery semantics

The request path uses one bulk outbox insert for zero, one, or two rows: a generation event on a cache miss and an exposure event for every HTTP caller. Cache hits and single-flight waiters therefore share one generation but receive distinct exposure and impression IDs. Enqueue failure is logged with the request correlation ID and does not fail the recommendation response.

The worker uses short transactions and at-least-once delivery. Claiming uses `FOR UPDATE SKIP LOCKED` and a lease token. Generation events are prioritized before exposure/action events. Materialization is idempotent by generation ID, exposure/request ID, impression ID, and action ID. When a matching exposure is still pending, action processing records `IMPRESSION_NOT_READY` and retries; malformed, foreign, expired, or unsupported action payloads do not produce an action row. Retry delay is bounded exponentially; poison payloads and records exceeding the configured attempt limit become `DEAD` with only a bounded error code/summary persisted.

## Operations

### Configuration

| Variable | Default | Meaning |
|----------|---------|---------|
| `RECOMMENDATION_OUTBOX_WORKER_ENABLED` | `false` | Whether the in-process worker polls and materializes outbox rows |
| `RECOMMENDATION_OUTBOX_WORKER_REQUIRED` | `true` when `NODE_ENV=production`, otherwise `false` | Whether application **readiness** depends on the worker |
| `RECOMMENDATION_OUTBOX_POLL_INTERVAL_MS` | `2000` (clamp 250–60000) | Poll interval |
| `RECOMMENDATION_OUTBOX_BATCH_SIZE` | `10` (clamp 1–100) | Claim batch size |
| `RECOMMENDATION_OUTBOX_MAX_ATTEMPTS` | `5` (clamp 1–20) | Attempts before `DEAD` |
| `RECOMMENDATION_OUTBOX_LEASE_MS` | `30000` (clamp 1000–300000) | Processing lease duration |

`enabled` and `required` are independent. In production, the intentional behavior when `required=true` and `enabled=false` is: process stays up, `GET /health` remains healthy (liveness), and `GET /health/ready` returns HTTP **503** with reason `WORKER_REQUIRED_BUT_DISABLED` and worker state **`DISABLED`** (not `FAILED`). During migration rollout, set `RECOMMENDATION_OUTBOX_WORKER_REQUIRED=false` or enable the worker after the outbox migration is applied.

Configure `RECOMMENDATION_OUTBOX_WORKER_ENABLED=true` only after the migration is deployed and the process has access to the same PostgreSQL database.

### Health vs readiness

| Endpoint | Role | Worker impact |
|----------|------|----------------|
| `GET /health` | Process **liveness** / basic health | **None.** Always HTTP 200 with `{ status, uptime, timestamp }`. Do **not** treat this as readiness. |
| `GET /health/ready` | **Readiness** | Reflects enabled/required/worker state. HTTP **200** when ready (`success: true`); HTTP **503** when not ready (`success: false`, `error.code: NOT_READY`). |

Example:

```bash
curl -sS http://127.0.0.1:4000/health
curl -sS -i http://127.0.0.1:4000/health/ready
```

### Worker states

| State | Meaning |
|-------|---------|
| `DISABLED` | `enabled=false` only. Required-disabled stays here (never reclassified as `FAILED`). |
| `STARTING` | `start()` invoked; waiting for first successful poll (including empty poll). |
| `HEALTHY` | Recent successful poll; backlog/dead below warn thresholds. |
| `DEGRADED` | Transient poll failure with recent success, or warn-level retry/dead/metrics; **still ready**. |
| `FAILED` | Enabled worker operationally failed (grace expired, consecutive failures, stale poll). |
| `STOPPING` | Shutdown in progress (including timed-out in-flight). |
| `STOPPED` | Terminal after graceful shutdown completes (HTTP closed + Prisma disconnected). |

### Queue diagnostics

Readiness exposes an in-memory snapshot. Queue metrics refresh at most every `max(30s, 15 × pollIntervalMs)` (default 30s), never from `/health` or `/health/ready`.

- `retryBacklog`: bounded sample of rows with status exactly `RETRY` (take = warnThreshold + 1).
- `deadRows`: bounded sample of rows with status exactly `DEAD` (take = warnThreshold + 1).
- `retryBacklogCapped` / `deadRowsCapped`: when true, the value means **at least** that many rows (not an exact total).

### Shutdown

1. Readiness becomes false immediately.
2. Worker enters `STOPPING`, clears scheduling, sets a cooperative abort (no new rows/metrics).
3. The current Prisma operation is allowed to settle (it cannot be cancelled).
4. Await the in-flight poll up to **15 seconds** (internal shutdown wait; not the lease).
5. On success: close HTTP, disconnect Prisma, mark `STOPPED`.
6. On timeout with in-flight still running: log `SHUTDOWN_TIMED_OUT`, **initiate** HTTP close (stop accepting new connections) but **do not wait** for full connection draining, **do not** disconnect Prisma concurrently, then request server hard-exit (non-zero). State remains `STOPPING` until process exit — never a false `STOPPED`.

Monitor pending/retry/dead pressure via readiness diagnostics and materialization failure logs. A dead-letter row requires payload inspection under the privacy contract before replay or deletion.

The migration adds status/availability, lease, processed-time, and creation-time indexes. It has no destructive operation and no foreign key to the polymorphic payload entities. Rollback means stopping the worker and preserving or draining pending rows before a separately reviewed schema rollback; production migration application was not performed for this phase.

## Limitations

The worker materializes recommendation generations, requests, candidate traces, impressions, and supported learner actions. Action capture is centralized at the successful JSON response boundary and never reads request bodies. Project views and supplier-side reservation lifecycle actions remain unsupported. The outbox provides durable at-least-once delivery, not exactly-once external publication or a general-purpose job framework.

## Redacted event samples

Generation envelope:

```json
{
  "eventKind": "RECOMMENDATION_GENERATION",
  "schemaVersion": "recommendation-generation-outbox-v1",
  "deduplicationKey": "generation:<generation-id>",
  "payload": {
    "generationId": "<generation-id>",
    "learnerId": "<learner-id>",
    "surface": "LEARNER_HOME",
    "candidateCount": 149,
    "persistedTraceCount": 150,
    "traceTruncated": false
  }
}
```

Exposure envelope:

```json
{
  "eventKind": "RECOMMENDATION_EXPOSURE",
  "schemaVersion": "recommendation-exposure-outbox-v1",
  "deduplicationKey": "exposure:<exposure-id>",
  "payload": {
    "exposureId": "<exposure-id>",
    "generationId": "<generation-id>",
    "learnerId": "<learner-id>",
    "correlationId": "<request-correlation-id>",
    "impressions": [{
      "impressionId": "<opaque-impression-id>",
      "entityType": "MATERIAL",
      "entityId": "<entity-id>",
      "sectionKey": "suggested_materials",
      "position": 1,
      "reasonCode": "INTEREST_MATCH"
    }]
  }
}
```

Action envelope:

```json
{
  "eventKind": "RECOMMENDATION_ACTION",
  "schemaVersion": "recommendation-action-outbox-v1",
  "deduplicationKey": "action:PROJECT_SAVE:<operation-id>",
  "payload": {
    "actionId": "<opaque-action-id>",
    "learnerId": "<learner-id>",
    "actionType": "PROJECT_SAVE",
    "entityType": "PROJECT",
    "entityId": "<project-id>",
    "impressionId": "<opaque-impression-id>",
    "sourceOperationId": "<bounded-operation-id>",
    "occurredAt": "<iso-timestamp>",
    "eventSource": "REAL"
  }
}
```
