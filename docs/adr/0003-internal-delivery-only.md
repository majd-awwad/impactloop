# ADR 0003: Internal Delivery Only

## Status
Accepted

## Context

Delivery is an MVP concept, but the delivery workflow is not implemented yet. Current docs and schema keep delivery information on reservations rather than modeling external partners or a standalone delivery workflow.

## Decision

Use internal delivery only:

- Do not integrate external delivery partners in the MVP.
- Keep delivery fields in the reservation-backed material reuse flow as currently documented.
- Treat the delivery workflow as not implemented until learner reservation and delivery APIs/UI are built.

## Consequences

- Delivery partner integrations, partner tables, and partner APIs are out of scope.
- Delivery work must build on reservations and internal driver assignment when implemented.
- Docs and UI must not imply delivery workflow is currently available.
- Driver workflow details remain unresolved and must not be treated as accepted by this ADR.

## Current implementation evidence

- [AGENTS.md](../../AGENTS.md) states delivery is internal only and there are no delivery partners.
- [docs/features/delivery.md](../features/delivery.md) marks delivery as schema-only / not implemented and lists missing learner, driver, cost, and tracking flows.
- [docs/08-implementation-status.md](../08-implementation-status.md) marks delivery workflow and driver portal as not implemented.
- [docs/database/schema-overview.md](../database/schema-overview.md) documents delivery fields on `Reservation`.
- [docs/database/tables-catalog.md](../database/tables-catalog.md) lists `deliveryRequested`, `deliveryStatus`, `deliveryCost`, `dropoffLocationId`, and `driverProfileId` on `Reservation`.
- [apps/backend/prisma/schema.prisma](../../apps/backend/prisma/schema.prisma) defines `Reservation` delivery fields and `DeliveryStatus`.

## Related docs

- [docs/features/delivery.md](../features/delivery.md)
- [docs/flows/delivery-flow.md](../flows/delivery-flow.md)
- [docs/features/reservations.md](../features/reservations.md)
- [docs/database/schema-overview.md](../database/schema-overview.md)
- [docs/database/tables-catalog.md](../database/tables-catalog.md)
- [docs/09-open-questions.md](../09-open-questions.md)
