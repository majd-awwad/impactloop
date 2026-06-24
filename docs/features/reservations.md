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
| Learner Flutter feature / reserve UI | **Implemented MVP** | Material detail CTA creates reservation; no list/cancel |
| Supplier list/accept/decline/complete | **Partial** | `GET/PATCH /api/supplier/reservations/*`; no delivery |
| Material `RESERVED` on accept | **Implemented** | Accept updates reservation and material in one transaction |
| Learner “my reservations” UI | **Frontend-only** placeholders | `learner_home_page.dart` — Coming soon cards |

**Overall:** **Partial**. Learner create + supplier accept/reject/complete exist for an exclusive reservation MVP. Learner list/cancel, delivery, expiry, reviews, queues, partial stock allocation, and pickup-location reveal are not implemented.

## Existing Related Files

### Backend

| Path | Role |
|------|------|
| `modules/reservations/reservations.routes.ts` | Learner reservation create endpoint |
| `modules/reservations/reservations.service.ts` | Learner reservation business logic |
| `modules/reservations/reservations.repository.ts` | Transactional create + material status update |
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
| `reservations/data/*`, `reservations/application/*` | Learner reservation API/repository/controller |
| `material_discovery/.../material_details_page.dart` | Reserve button entry point |
| `supplier_portal/.../supplier_incoming_requests_page.dart` | Supplier inbox |
| `supplier_portal/data/supplier_requests_api.dart` | Supplier API client |
| `home/.../learner_home_page.dart` | Placeholder “My reservations” (not wired) |

### Database

- `reservations`, `reservation_status_history`
- Enums: `ReservationStatus`, `ReservationStatusGroup`, `PickupType`
- Related: `materials.status`, `materials.reused_at`, `materials.reused_by_reservation_id`

## Status Transitions

- Create: `AVAILABLE` → `PENDING_RESERVATION`
- Accept: `PENDING_RESERVATION` → `RESERVED`
- Reject: `PENDING_RESERVATION` → `AVAILABLE`
- Complete: `RESERVED` → `REUSED`

Active reservation statuses are `PENDING`, `ACCEPTED`, and `COMPLETED`. Rejected/cancelled/expired reservations do not block future reservations.

## What Is Missing

- Learner list/detail/cancel reservation API and Flutter feature.
- Cancel/expiry workflows.
- Delivery request / driver workflow.
- Reviews.
- Multi-reservation queues and partial stock allocation.
- Precise pickup-location reveal.
- Generic persisted notification table flow.

## Risks

- Public discovery pages own local futures, so the detail page refreshes itself and home suggestions are invalidated after reservation; existing open discovery pages refresh only by re-entering/reloading.
- No database unique constraint enforces one active reservation per material; MVP protection is transactional service logic using material status and active-reservation checks.
- `REUSED` happens only on supplier complete, matching the impact rule.

## Related Docs

- [Learner reservation flow](../flows/learner-reservation-flow.md)
- [Supplier reservation flow](../flows/supplier-reservation-flow.md)
- [Delivery](delivery.md) — delivery fields on the same table, not implemented
