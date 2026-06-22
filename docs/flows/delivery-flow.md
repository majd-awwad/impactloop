# Delivery Flow (Planned — Not Implemented)

**Gap / stub flow.** Delivery fields exist on `reservations`; **no delivery API or driver UI** in code.

**Sources inspected:** `docs/01-requirements.md`, `docs/features/delivery.md`, `docs/features/reservations.md`, `apps/backend/prisma/schema.prisma`, `apps/backend/src/modules/supplier-reservations/supplier-reservations.service.ts`, `apps/frontend/lib/features/home/presentation/pages/learner_home_page.dart`, `docs/08-implementation-status.md`

## Trigger (planned)

Learner requests **internal delivery** after reservation is **ACCEPTED**; driver fulfills delivery; reservation completes and material becomes `REUSED`.

---

## Current reality

| Step | Status |
|------|--------|
| `delivery_requested`, `delivery_status`, etc. on schema | **Schema-only** |
| Learner request delivery API/UI | **Not implemented** |
| Driver available jobs / accept / status updates | **Not implemented** |
| `DRIVER` role portal | **Not implemented** (invitation API only — [invitations](../features/invitations.md)) |
| Home delivery tracking card | **Frontend-only** placeholder |
| Supplier complete (self-pickup) | **Partial** — `PATCH .../complete` sets `REUSED` without delivery statuses |

---

## Planned user path (requirements — not built)

1. Learner has `ACCEPTED` reservation.
2. Learner opts into delivery, provides dropoff location.
3. `delivery_requested = true`, `delivery_status = WAITING_FOR_DRIVER`.
4. Driver accepts → `DRIVER_ASSIGNED` → pickup → `ON_THE_WAY` → `DELIVERED`.
5. Reservation `COMPLETED`; material `REUSED`.

### Frontend path (planned)

- Learner: delivery request on reservation detail; tracking on home.
- Driver: new portal routes (not in `app_router.dart` today).
- No invented screen names beyond roadmap intent.

### Backend path (planned)

- PATCH learner reservation for delivery request + `dropoff_location_id`.
- Driver-scoped PATCH for status transitions on `delivery_status`.
- History rows in `reservation_status_history` (delivery group — **Needs verification** if enum supports).

### Database changes (planned)

- Update `reservations` delivery columns; possibly `locations` for dropoff.
- `driver_profile_id` assignment — **Needs verification** (no `DriverProfile` model in schema).

### Success state (planned)

`delivery_status = DELIVERED`, reservation completed, material reused.

### Error states (planned)

- Delivery not allowed on material → 400
- Invalid state transition → 409
- No driver available — product rule TBD

### Files involved today (schema / display only)

`schema.prisma`, `supplier-reservations.service.ts` (label mapping), `learner_home_page.dart` (placeholder)

---

## Not implemented

No `POST`/`PATCH` delivery endpoints. No driver module. Do not document `delivery_requests` table (explicitly out of scope per AGENTS.md).

---

## Open questions

- Driver identity model vs `driver_profile_id` column?
- Delivery cost: who calculates `delivery_cost`?
- Same `complete` endpoint for pickup vs delivery?
- See [09-open-questions.md](../09-open-questions.md) § Delivery.
