# ADR 0007: Internal Delivery Domain Architecture

## Status
Accepted

## Context

The earlier MVP decision kept delivery fields directly on `reservations` and explicitly avoided a `delivery_requests` table. Stage 1 of the developed internal delivery architecture needs driver profiles, delivery attempts, assignment audit, status history, and location pings while keeping delivery internal only.

## Decision

Delivery is its own backend domain.

- `Reservation` owns booking lifecycle.
- `Delivery` owns logistics lifecycle.
- A reservation may have many delivery attempts over time.
- Service logic enforces only one active delivery per reservation.
- `DriverProfile` is a real profile linked one-to-one to `User`.
- No `delivery_requests` table is introduced.
- Existing reservation delivery fields remain temporarily as legacy compatibility fields, but new code uses `deliveries` as the source of truth.

## Consequences

- Driver invitation acceptance creates a `DriverProfile`.
- Driver assignment is race-protected by transactional `updateMany` from `WAITING_FOR_DRIVER`.
- Supplier completion is limited to self-pickup reservations; delivery reservations complete through the driver `DELIVERED` transition.
- Location pings use decimal latitude/longitude fields for now, not a new PostGIS geography column.
- Docs and database catalog must distinguish deprecated reservation delivery fields from the active delivery domain.

## Implementation Evidence

- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/modules/deliveries/*`
- `apps/backend/src/modules/driver/*`
- `apps/backend/prisma/migrations/20260625120000_add_internal_delivery_domain/migration.sql`

## Related ADR

ADR 0004 still applies to the name `delivery_requests`: no such table should be introduced. This ADR supersedes ADR 0004 only on where delivery state lives: developed delivery state now lives in `deliveries`, not reservation delivery columns.
