# Reservations Feature

Current MVP status for material reservations.

**Sources inspected:** `apps/backend/prisma/schema.prisma`, `apps/backend/src/modules/reservations/*`, `apps/backend/src/modules/supplier-reservations/*`, `apps/backend/src/app.ts`, `apps/frontend/lib/features/reservations/*`, `apps/frontend/lib/features/material_discovery/**`, `apps/frontend/lib/features/supplier_portal/**`, `docs/flows/supplier-reservation-flow.md`, `docs/flows/learner-reservation-flow.md`, `docs/08-implementation-status.md`

## Intended Purpose

- Learner creates reservation → `PENDING`.
- Supplier accepts or rejects; on accept sets pickup window.
- Material becomes `RESERVED` after acceptance; `REUSED` after completed pickup.
- MVP is exclusive: one active reservation holds the whole material.

## Current Code Status

| Layer | Status | Evidence |
|-------|--------|----------|
| Database `reservations` + `reservation_status_history` | **Implemented for MVP** | Existing schema used; no migration needed |
| Learner `POST /api/reservations` | **Implemented MVP** | `modules/reservations` router mounted in `app.ts` |
| Learner `GET /api/reservations/my` | **Implemented MVP** | Learner-owned reservation list/read model |
| Learner Flutter feature / reserve UI | **Implemented MVP** | Material detail CTA creates reservation and shows learner reservation state |
| Learner “My Reservations” UI | **Partial** | `/learner/reservations`; delivery request/status integrated; no cancel |
| Supplier list/accept/decline/complete | **Partial** | `GET/PATCH /api/supplier/reservations/*`; supplier complete is self-pickup only when delivery exists |
| Material `RESERVED` on accept | **Implemented** | Accept updates reservation and material in one transaction |
| Delivery learner UI | **Partial** | Learner can request delivery from accepted reservations and open `/learner/deliveries/:id`; no driver UI/live map |
**Overall:** **Partial**. Learner create/read UI + supplier accept/reject/complete exist for an exclusive reservation MVP. Learner delivery request/status UI exists separately, but driver delivery UI, learner cancel, expiry, reviews, queues, partial stock allocation, and public pickup-location reveal in Flutter are not implemented.

## Existing Related Files

### Backend

| Path | Role |
|------|------|
| `modules/reservations/reservations.routes.ts` | Learner reservation create endpoint |
| `modules/reservations/reservations.service.ts` | Learner reservation create/read business logic |
| `modules/reservations/reservations.repository.ts` | Transactional create + material status update; learner-owned list query |
| `modules/reservations/reservations.validation.ts` | Request schema |
| `modules/reservations/reservations.create.test.ts` | Learner create tests |
| `modules/supplier-reservations/supplier-reservations.routes.ts` | Supplier endpoints |
| `modules/supplier-reservations/supplier-reservations.service.ts` | Supplier reservation business logic |
| `modules/supplier-reservations/supplier-reservations.repository.ts` | Supplier status transition transactions |
| `modules/supplier/supplier.routes.ts` | Mounts `/reservations` under `/api/supplier` |
| `prisma/seeds/seed-supplier-reservations.ts` | Demo PENDING/ACCEPTED rows |

### Frontend

| Path | Role |
|------|------|
| `reservations/data/*`, `reservations/application/*` | Learner reservation API/repository/controllers |
| `reservations/presentation/pages/learner_reservations_page.dart` | Learner reservation status page |
| `material_discovery/.../material_details_page.dart` | Reserve button entry point; post-success and existing-reservation links to My Reservations |
| `supplier_portal/.../supplier_incoming_requests_page.dart` | Supplier inbox |
| `supplier_portal/data/supplier_requests_api.dart` | Supplier API client |
| `home/.../learner_home_page.dart` | Links to My Reservations |

### Database

- `reservations`, `reservation_status_history`
- Enums: `ReservationStatus`, `ReservationStatusGroup`, `PickupType`
- Related: `materials.status`, `materials.reused_at`, `materials.reused_by_reservation_id`
- Delivery domain: `deliveries`, `driver_profiles`, `delivery_assignments`, `delivery_status_history`, `delivery_location_pings`
- Legacy reservation delivery fields still exist for compatibility, but new code uses `deliveries`.

## Status Transitions

- Create: `AVAILABLE` → `PENDING_RESERVATION`
- Accept: `PENDING_RESERVATION` → `RESERVED`
- Reject: `PENDING_RESERVATION` → `AVAILABLE`
- Complete: `RESERVED` → `REUSED`

Active reservation statuses are `PENDING`, `ACCEPTED`, and `COMPLETED`. Rejected/cancelled/expired reservations do not block future reservations.

## What Is Missing

- Learner cancel reservation API and Flutter feature.
- Dedicated learner reservation detail page.
- Cancel/expiry workflows.
- Driver delivery workflow UI.
- Live delivery map/tracking, ETA, cancellation/retry, payment, and reviews.
- Reviews.
- Multi-reservation queues and partial stock allocation.
- Precise pickup-location reveal.
- Generic persisted notification table flow.

## Risks

- Public discovery pages own local futures, so the detail page refreshes itself and home suggestions/my reservations are invalidated after reservation; existing open discovery pages refresh only by re-entering/reloading.
- No database unique constraint enforces one active reservation per material; MVP protection is transactional service logic using material status and active-reservation checks.
- `REUSED` happens on supplier complete for self-pickup or on driver `DELIVERED` for delivery reservations.

## Related Docs

- [Learner reservation flow](../flows/learner-reservation-flow.md)
- [Supplier reservation flow](../flows/supplier-reservation-flow.md)
- [Delivery](delivery.md) — delivery domain and learner request/status UI
