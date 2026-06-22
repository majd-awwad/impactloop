# Learner Reservation Flow (Planned — Not Implemented)

**Gap / stub flow.** Documents **intended** learner path vs **current code**. Do not treat as shipped behavior.

**Sources inspected:** `docs/01-requirements.md`, `docs/features/reservations.md`, `docs/flows/supplier-reservation-flow.md`, `apps/backend/src/app.ts`, `apps/frontend/lib/features/material_discovery/**`, `apps/frontend/lib/features/home/**`, `apps/backend/prisma/schema.prisma`

## Trigger (planned)

Authenticated **LEARNER** reserves quantity of an available material from discovery detail (or project component link — **not implemented**).

---

## Current reality

| Step | Status |
|------|--------|
| Learner reserve UI | **Not implemented** |
| `POST /api/reservations` (or equivalent) | **Not implemented** |
| Learner status list UI | **Frontend-only** placeholders on `/home` |
| Supplier accept/decline/complete | **Partial** — see [supplier-reservation-flow](supplier-reservation-flow.md) |
| Test data | **Partial** — `prisma/seeds/seed-supplier-reservations.ts` |

---

## Planned user path (requirements — not built)

1. Learner opens material detail (`/materials/:id`).
2. Chooses quantity, optional message, pickup preference.
3. Submits → reservation `PENDING`.
4. Tracks status on “My reservations” (`/home` or dedicated route).
5. After supplier accept → sees pickup window; optional delivery request (see [delivery-flow](delivery-flow.md)).

### Frontend path (planned)

- New `features/reservations` or extend `material_discovery` detail CTA.
- Repository → learner reservation API.
- Home “My reservations” replaces `ComingSoonCard`.

### Backend path (planned)

- New `modules/reservations` or learner routes under `/api/reservations`.
- Create: validate material `AVAILABLE`, quantity, requester auth.
- On supplier accept (existing): optionally set `materials.status = RESERVED` per requirements.

### Database changes (planned)

- Insert `reservations` (`PENDING`), `reservation_status_history`.
- Update `materials.status` on accept — **Needs verification** vs current supplier-only code.

### Success state (planned)

Learner sees confirmation + reservation id; supplier sees pending inbox.

### Error states (planned)

- Material unavailable / insufficient quantity → 409
- Unauthenticated → 401
- Validation errors → 400

### Files involved today (partial only)

`material_discovery` pages (no reserve CTA wired), `learner_home_page.dart` (placeholder), `supplier-reservations.*`, `seed-supplier-reservations.ts`

---

## Not implemented

Entire learner create + track loop. No invented endpoint paths or request bodies.

---

## Open questions

- Reserve from discovery detail only or also learning hub components?
- Should create be idempotent per user+material?
- Cancel learner-side before supplier accept?
- See [09-open-questions.md](../09-open-questions.md) § Reservations.
