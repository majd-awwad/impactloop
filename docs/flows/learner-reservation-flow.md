# Learner Reservation Flow

Documents the implemented MVP learner reservation request path.

**Out of scope:** delivery, learner reservation list/cancel, expiry jobs, reviews, multi-reservation queues, partial stock allocation, and precise pickup-location reveal.

## Trigger

Authenticated **LEARNER** reserves an available material from public material detail (`/materials/:id`).

---

## Current Reality

| Step | Status |
|------|--------|
| Learner reserve UI | **Implemented MVP** — detail CTA only |
| `POST /api/reservations` | **Implemented MVP** |
| Learner status list UI | **Frontend-only** placeholders on `/home` |
| Supplier accept/decline/complete | **Partial** — accept/reject/complete implemented; no delivery |
| Test data | **Partial** — seed data still exists for supplier portal demos |

---

## User Path

1. Learner opens material detail (`/materials/:id`).
2. Taps **Reserve Material**.
3. If unauthenticated, the app redirects to login with `from=/materials/:id`.
4. If authenticated as a non-learner, the UI blocks the action.
5. The app submits `POST /api/reservations` with the material id and full listed quantity.
6. Success creates a `PENDING` reservation and reloads material detail so the status becomes `PENDING_RESERVATION`.
7. Supplier handles the request through the existing incoming requests page.

### Frontend Path

- `material_discovery` detail CTA calls `reservationCreateControllerProvider`.
- `features/reservations/data` contains the API/repository and request/response models.
- Home “My reservations” remains a placeholder.

### Backend Path

- `modules/reservations` mounts `POST /api/reservations`.
- Create validates `LEARNER` role, material `AVAILABLE`, quantity, and self-reservation.
- Create enforces one active reservation per material and uses `updateMany` with `status = AVAILABLE` as the race-safe guard.
- Supplier accept sets material `RESERVED`; reject returns material `AVAILABLE`; complete sets material `REUSED`.

### Database Changes Per Flow

- Insert `reservations` (`PENDING`), `reservation_status_history`.
- `materials.status`: `AVAILABLE` → `PENDING_RESERVATION` on create.
- `materials.status`: `PENDING_RESERVATION` → `RESERVED` on supplier accept.
- `materials.status`: `PENDING_RESERVATION` → `AVAILABLE` on supplier reject.
- `materials.status`: `RESERVED` → `REUSED` on supplier complete.

### Success State

Learner sees a success snack bar and refreshed material detail; supplier sees the pending request in incoming requests and derived reservation notification inbox.

### Error States

- Material unavailable or duplicate active reservation → 409
- Insufficient quantity / self reservation → 400
- Unauthenticated → 401
- Non-learner → 403
- Validation errors → 400

### Files Involved

`material_discovery` detail page, `features/reservations/*`, `modules/reservations/*`, `supplier-reservations.*`, `learner_home_page.dart` placeholders.

---

## Still Not Implemented

- Learner reservation list/detail/cancel.
- Delivery selection and driver workflow.
- Expiry jobs.
- Reviews.
- Multi-reservation queues and partial stock allocation.
- Precise pickup-location reveal.

---

## Open Questions

- Whether later reservations should start from learning hub components too.
- Whether learner cancellation is allowed before supplier acceptance.
- See [09-open-questions.md](../09-open-questions.md) § Reservations.
