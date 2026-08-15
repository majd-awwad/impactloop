# ADR 0003: Internal Delivery Only

## Status
Accepted

## Context

Delivery is internal only. Stage 1 backend delivery now has a developed domain model for internal drivers, delivery attempts, assignment, status history, and location pings. No external delivery partners are modeled.

## Decision

Use internal delivery only:

- Do not integrate external delivery partners in the MVP.
- Keep delivery internal to ImpactLoop drivers.
- Use the delivery domain architecture in [ADR 0007](0007-delivery-domain-architecture.md) for backend delivery workflow.

## Consequences

- Delivery partner integrations, partner tables, and partner APIs are out of scope.
- Delivery work builds on accepted reservations and internal driver assignment.
- Flutter UI must only expose internal delivery workflow through the implemented learner-owned and driver-owned delivery screens.
- Driver workflow details are accepted by [ADR 0007](0007-delivery-domain-architecture.md), not by this internal-only ADR alone.

## Current implementation evidence

- [docs/features/delivery.md](../features/delivery.md) documents learner request/status/tracking UI, driver jobs/status/manual ping UI, and remaining realtime tracking, cost, and admin reassignment gaps.
- [docs/product/implementation-status.md](../product/implementation-status.md) marks delivery workflow and driver portal as partial with learner and driver Flutter UI implemented.
- [docs/database/schema-overview.md](../database/schema-overview.md) documents `deliveries`, `driver_profiles`, delivery history, and legacy reservation delivery fields.
- [docs/database/tables-catalog.md](../database/tables-catalog.md) lists the delivery domain tables.
- [apps/backend/prisma/schema.prisma](../../apps/backend/prisma/schema.prisma) defines delivery domain models and no external partner models.

## Related docs

- [docs/features/delivery.md](../features/delivery.md)
- [docs/flows/delivery-flow.md](../flows/delivery-flow.md)
- [docs/features/reservations.md](../features/reservations.md)
- [docs/database/schema-overview.md](../database/schema-overview.md)
- [docs/database/tables-catalog.md](../database/tables-catalog.md)
- [docs/product/open-questions.md](../product/open-questions.md)
