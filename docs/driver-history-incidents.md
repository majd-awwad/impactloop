# Driver delivery history and incident follow-up

## Product contract

`GET /api/driver/deliveries/history` returns deliveries with `DeliveryAssignment` evidence for the authenticated active Driver that are no longer active for that same Driver. This includes terminal deliveries, Admin-review deliveries, released jobs, and jobs later assigned to another Driver. Results use descending `updatedAt`, then descending delivery ID, with a bounded resource-specific opaque cursor.

`GET /api/driver/deliveries/history/:id` applies the same assignment-based authorization and returns a privacy-safe, read-only detail. Unrelated Drivers receive `404`. Historical responses omit phone numbers, exact addresses, coordinates, learner notes, handover codes and hashes, unrestricted Driver notes, and mutation capabilities.

`GET /api/driver/incidents` is reporter-owned: only reports whose `reporterUserId` is the authenticated Driver are returned. Admin review notes, reviewer identity, strike internals, and target-user personal data are not included. Ordering is descending `createdAt`, then descending report ID.

## Durable evidence

`DeliveryPickupItem` snapshots every member of an operational delivery when pickup is confirmed. The snapshot records whether each item was actually handed over and survives reservation detachment or regrouping. Older deliveries without a snapshot use a clearly marked best-effort reservation fallback.

Driver-created reports store the submitted reason and note separately from legacy operational notes. Recovery actions write product-safe codes to the report: supplier reschedule requested, replacement window submitted, reservation regrouped, or reservation cancelled/expired with its hold released.

Incident idempotency is scoped to reservation, operational delivery, target, and reason. A retry cannot duplicate the same occurrence, while a later replacement delivery can create its own follow-up record instead of overwriting the earlier incident.

## Compatibility and rollback

Existing `/api/driver/deliveries/:id` links remain valid. The Flutter client resolves inactive links through the new historical-detail contract and renders no operational actions. `/inactive-context` remains a compatibility endpoint.

The database migration is additive. A code rollback is safe while the added table and nullable columns remain in place. Do not drop pickup snapshots during rollback; historical deletion remains out of scope.
