# Reservations Feature (Gap Doc)

**Gap / stub — not an implementation guide.**

**Sources inspected:** `apps/backend/prisma/schema.prisma` (`Reservation`, `ReservationStatusHistory`), `apps/backend/src/modules/supplier-reservations/*`, `apps/backend/src/app.ts`, `apps/backend/prisma/seeds/seed-supplier-reservations.ts`, `apps/frontend/lib/features/home/presentation/pages/learner_home_page.dart`, `apps/frontend/lib/features/supplier_portal/**`, `docs/01-requirements.md` (§Reservations), `docs/05-roadmap.md` (Phase 4), `docs/flows/supplier-reservation-flow.md`, `docs/08-implementation-status.md`

## Intended purpose (requirements / roadmap — aspirational)

From [01-requirements.md](01-requirements.md) and [05-roadmap.md](05-roadmap.md) Phase 4:

- Learner creates reservation → `PENDING`.
- Supplier accepts or rejects; on accept sets pickup window.
- Material becomes `RESERVED` after acceptance; `REUSED` after completed pickup or delivery.
- Learner sees reservation status.

## Current code status

| Layer | Status | Evidence |
|-------|--------|----------|
| Database `reservations` + `reservation_status_history` | **Schema-only** / **Partial** | Tables exist; populated via seed/tests |
| Learner `POST /api/reservations` (or `/api/reservations` module) | **Not implemented** | No router in `app.ts`; no `modules/reservations` folder |
| Learner Flutter feature / reserve UI | **Not implemented** | No `features/reservations`; home placeholders only |
| Supplier list/accept/decline/complete | **Partial** | `GET/PATCH /api/supplier/reservations/*` |
| Material `RESERVED` on accept | **Needs verification** | Accept updates reservation only; **complete** sets material `REUSED` (`supplier-reservations.repository.ts`) |
| Learner “my reservations” UI | **Frontend-only** placeholders | `learner_home_page.dart` — Coming soon cards |

**Overall:** **Partial** (supplier-side API + schema); learner creation and status UI **not implemented**.

## Existing related files

### Backend

| Path | Role |
|------|------|
| `modules/supplier-reservations/supplier-reservations.routes.ts` | Supplier endpoints |
| `modules/supplier-reservations/supplier-reservations.service.ts` | Business logic |
| `modules/supplier-reservations/supplier-reservations.repository.ts` | Prisma transactions |
| `modules/supplier-reservations/supplier-reservations.validation.ts` | Request schemas |
| `modules/supplier/supplier.routes.ts` | Mounts `/reservations` under `/api/supplier` |
| `prisma/seeds/seed-supplier-reservations.ts` | Demo PENDING/ACCEPTED rows |

### Frontend

| Path | Role |
|------|------|
| `supplier_portal/.../supplier_incoming_requests_page.dart` | Supplier inbox |
| `supplier_portal/data/supplier_requests_api.dart` | Supplier API client |
| `home/.../learner_home_page.dart` | Placeholder “My reservations” (not wired) |

### Database

- `reservations`, `reservation_status_history`
- Enums: `ReservationStatus`, `ReservationStatusGroup`, `PickupType`
- Related: `materials.reused_by_reservation_id`, delivery columns (see [delivery](delivery.md))

## What is missing

- Learner create reservation API + validation (quantity, message, material availability).
- Learner list/detail/cancel reservation API and Flutter feature.
- Reserve action on material discovery detail screen.
- Alignment with requirements: `materials.status → RESERVED` on accept.
- Cancel/expiry workflows.
- Integration with notifications (generic `notifications` table unused).
- End-to-end test without seed data.

## Risks

- Supplier workflow tested only on **seeded** reservations — production has no learner entry point.
- Accept without `RESERVED` material status may allow double-booking — **Needs verification**.
- Requirements vs code mismatch on impact/reuse timing (`REUSED` only on supplier **complete** today).

## Questions before implementation

See [09-open-questions.md](../09-open-questions.md) § Reservations and [learner-reservation-flow](../flows/learner-reservation-flow.md).

## Related docs

- [Supplier reservation flow](../flows/supplier-reservation-flow.md) — what exists today
- [Learner reservation flow](../flows/learner-reservation-flow.md) — planned stub
- [Delivery](delivery.md) — delivery fields on same table
