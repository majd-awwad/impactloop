# ADR 0004: No Delivery Requests Table

## Status
Accepted

## Context

The current schema has reservations and delivery columns on reservations. It does not have a `delivery_requests` table. Learner reservation creation and supplier reservation endpoints exist, but delivery is not implemented.

## Decision

Do not introduce a `delivery_requests` table for the MVP.

Delivery request state should live on reservations through the existing reservation delivery fields when delivery is implemented. The current reservation workflow stops at learner create plus supplier accept/decline/complete.

## Consequences

- Future delivery work must extend reservation-based behavior rather than adding a parallel delivery request abstraction.
- Supplier reservation APIs can continue operating on `Reservation` records.
- The absence of learner reservation creation must remain visible in docs until implemented.
- Delivery tables or abstractions require a new explicit architecture decision.

## Current implementation evidence

- [AGENTS.md](../../AGENTS.md) states there is no `delivery_requests` table and delivery fields live inside reservations.
- [docs/database/schema-overview.md](../database/schema-overview.md) documents no `delivery_requests` table and delivery columns on `reservations`.
- [docs/database/tables-catalog.md](../database/tables-catalog.md) documents the `reservations` table and delivery fields.
- [docs/features/reservations.md](../features/reservations.md) marks learner create and supplier list/accept/decline/complete as partial, with delivery still out of scope.
- [docs/features/delivery.md](../features/delivery.md) marks delivery API/UI as not implemented.
- [docs/08-implementation-status.md](../08-implementation-status.md) marks learner create and supplier reservations as partial, and delivery workflow as not implemented.
- [apps/backend/src/app.ts](../../apps/backend/src/app.ts) mounts `/api/supplier` and learner `/api/reservations`, but no `/api/delivery` router.
- [apps/backend/prisma/schema.prisma](../../apps/backend/prisma/schema.prisma) defines `Reservation` delivery fields and no `DeliveryRequest` model.

## Related docs

- [docs/features/reservations.md](../features/reservations.md)
- [docs/features/delivery.md](../features/delivery.md)
- [docs/flows/supplier-reservation-flow.md](../flows/supplier-reservation-flow.md)
- [docs/flows/learner-reservation-flow.md](../flows/learner-reservation-flow.md)
- [docs/backend/api-catalog.md](../backend/api-catalog.md)
- [docs/database/schema-overview.md](../database/schema-overview.md)
- [docs/09-open-questions.md](../09-open-questions.md)
