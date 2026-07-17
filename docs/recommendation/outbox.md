# Recommendation Outbox Delivery

## Purpose

`RecommendationEventOutbox` separates recommendation computation from durable event materialization. The request path enqueues a bounded generation/exposure envelope, while the worker writes the retained normalized recommendation tables asynchronously.

## Payload and privacy contract

The two schema versions are `recommendation-generation-outbox-v1` and `recommendation-exposure-outbox-v1`. Payloads contain only internal learner/entity IDs, surface and section keys, finite scores, bounded score components, finite reason codes, cache state, correlation IDs, timestamps, and algorithm/policy versions. Payload size is capped at 256 KiB. Candidate traces and impressions are capped at 512 records, and score-component maps are capped at 12 scalar values.

Names, emails, descriptions, search text, coordinates, tokens, request bodies, response bodies, and supplier/private fields are not serialized. The outbox is an operational delivery buffer, not an analytics warehouse; retention and aggregation jobs remain future work.

## Delivery semantics

The request path uses one bulk outbox insert for zero, one, or two rows: a generation event on a cache miss and an exposure event for every HTTP caller. Cache hits and single-flight waiters therefore share one generation but receive distinct exposure and impression IDs. Enqueue failure is logged with the request correlation ID and does not fail the recommendation response.

The worker uses short transactions and at-least-once delivery. Claiming uses `FOR UPDATE SKIP LOCKED` and a lease token. Generation events are prioritized before exposure events. Materialization is idempotent by generation ID, exposure/request ID, and impression ID. A stale processing lease becomes retryable. Retry delay is bounded exponentially; poison payloads and records exceeding the configured attempt limit become `DEAD` with only a bounded error code/summary persisted.

## Operations

The worker is disabled by default. Configure `RECOMMENDATION_OUTBOX_WORKER_ENABLED=true` only after the migration is deployed and the process has access to the same PostgreSQL database. Defaults are a 2-second poll interval, batch size 10, five attempts, and a 30-second lease. Monitor pending/retry/dead counts, oldest pending age, processing age, materialization failures, and the enqueue failure log. A dead-letter row requires payload inspection under the privacy contract before replay or deletion.

The migration adds status/availability, lease, processed-time, and creation-time indexes. It has no destructive operation and no foreign key to the polymorphic payload entities. Rollback means stopping the worker and preserving or draining pending rows before a separately reviewed schema rollback; production migration application was not performed for this phase.

## Limitations

The worker currently materializes recommendation generations, requests, candidate traces, and impressions only. Learner action controllers, direct/assisted attribution, recommendation headers, and CORS configuration remain inactive. Project views and supplier-side reservation lifecycle actions remain unsupported. The outbox provides durable at-least-once delivery, not exactly-once external publication or a general-purpose job framework.

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
