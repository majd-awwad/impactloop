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
- Flutter UI must not imply delivery workflow is available until learner/driver delivery screens are implemented.
- Driver workflow details are accepted by [ADR 0007](0007-delivery-domain-architecture.md), not by this internal-only ADR alone.

## Current implementation evidence

- [AGENTS.md](../../AGENTS.md) states delivery is internal only and there are no delivery partners.
- [docs/features/delivery.md](../features/delivery.md) marks delivery as backend-only and lists missing Flutter UI, live tracking UI, cost, and admin reassignment gaps.
- [docs/08-implementation-status.md](../08-implementation-status.md) marks delivery workflow and driver portal as backend-only.
- [docs/database/schema-overview.md](../database/schema-overview.md) documents `deliveries`, `driver_profiles`, delivery history, and legacy reservation delivery fields.
- [docs/database/tables-catalog.md](../database/tables-catalog.md) lists the delivery domain tables.
- [apps/backend/prisma/schema.prisma](../../apps/backend/prisma/schema.prisma) defines delivery domain models and no external partner models.

## Related docs

- [docs/features/delivery.md](../features/delivery.md)
- [docs/flows/delivery-flow.md](../flows/delivery-flow.md)
- [docs/features/reservations.md](../features/reservations.md)
- [docs/database/schema-overview.md](../database/schema-overview.md)
- [docs/database/tables-catalog.md](../database/tables-catalog.md)
- [docs/09-open-questions.md](../09-open-questions.md)
