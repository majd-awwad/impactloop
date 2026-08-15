# ADR 0004: No Delivery Requests Table

## Status
Accepted

## Context

The original MVP schema had reservations and legacy delivery columns on reservations. It does not have a `delivery_requests` table. The developed delivery architecture now uses `deliveries` and related delivery-domain tables while preserving the no-`delivery_requests` decision.

## Decision

Do not introduce a `delivery_requests` table for the MVP.

Delivery request state must not use a separate `delivery_requests` table. ADR 0007 supersedes the older MVP assumption that delivery state should live only on reservations; current delivery request state lives in `deliveries`.

## Consequences

- Future delivery work must extend the `deliveries` domain rather than adding a parallel delivery request abstraction.
- Supplier reservation APIs can continue operating on `Reservation` records.
- Learner reservation creation and developed delivery workflow are now implemented as separate booking and logistics lifecycles.
- Delivery tables and abstractions are governed by ADR 0007.

## Superseded Scope Note

[ADR 0007](0007-delivery-domain-architecture.md) records the developed delivery architecture. It keeps the **no `delivery_requests` table** decision, but supersedes the MVP assumption that delivery state should live only on `reservations`. New delivery workflow code uses `deliveries` and related delivery tables as the source of truth; old reservation delivery fields remain legacy compatibility fields.

## Current implementation evidence

- [docs/adr/0007-delivery-domain-architecture.md](0007-delivery-domain-architecture.md) keeps the no `delivery_requests` table decision and moves developed delivery state to `deliveries`.
- [docs/database/schema-overview.md](../database/schema-overview.md) documents no `delivery_requests` table, delivery domain tables, and legacy reservation delivery columns.
- [docs/database/tables-catalog.md](../database/tables-catalog.md) documents the `deliveries` table and legacy `reservations` delivery fields.
- [docs/features/reservations.md](../features/reservations.md) marks learner create and supplier list/accept/decline/complete as partial, with delivery handled by the delivery feature.
- [docs/features/delivery.md](../features/delivery.md) documents learner request/status/tracking UI and driver jobs/status/manual ping UI.
- [docs/product/implementation-status.md](../product/implementation-status.md) marks delivery workflow as partial with backend and Flutter learner/driver delivery surfaces implemented.
- [apps/backend/src/app.ts](../../apps/backend/src/app.ts) mounts `/api/deliveries` and `/api/driver`, and no `/api/delivery-requests` router.
- [apps/backend/prisma/schema.prisma](../../apps/backend/prisma/schema.prisma) defines `Delivery` models and no `DeliveryRequest` model.

## Related docs

- [docs/features/reservations.md](../features/reservations.md)
- [docs/features/delivery.md](../features/delivery.md)
- [docs/flows/supplier-reservation-flow.md](../flows/supplier-reservation-flow.md)
- [docs/flows/learner-reservation-flow.md](../flows/learner-reservation-flow.md)
- [docs/backend/api-catalog.md](../backend/api-catalog.md)
- [docs/database/schema-overview.md](../database/schema-overview.md)
- [docs/product/open-questions.md](../product/open-questions.md)
