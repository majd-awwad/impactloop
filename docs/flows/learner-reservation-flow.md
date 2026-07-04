# Learner Reservation Flow

Documents the implemented MVP learner reservation request path.

**Out of scope for Flutter (still):** background GPS streaming, WebSockets/realtime tracking, public tracking links, supplier live tracking, scheduled background expiry cron, reviews, multi-reservation queues, saved dropoff addresses, standalone location CRUD, and nearest-first sorting.

**Implemented since earlier doc drafts:** learner cancel (`PENDING` / awaiting confirmation), partial-quantity holds, handover codes, reschedule/report/messages, delivery request + delivery detail tracking summary.

## Trigger

Authenticated **LEARNER** reserves an available material from public material detail (`/materials/:id`).

---

## Current Reality

| Step | Status |
|------|--------|
| Learner reserve UI | **Implemented MVP** — detail CTA only |
| `POST /api/reservations` | **Implemented MVP** — partial quantity, fulfillment method, preferred windows |
| Learner cancel + awaiting-confirmation actions | **Implemented** — `PATCH .../cancel`, `PATCH .../learner-confirmation` |
| Learner follow-up (reschedule, reports, messages) | **Implemented** — on `/learner/reservations` list cards |
| Learner status list + detail UI | **Partial** — `/learner/reservations` list + `/learner/reservations/:id` detail |
| Supplier accept/decline/complete + overdue follow-up | **Partial** — accept/reject/handover complete + incident flows implemented |
| Delivery after accept | **Partial** — learner request/status/tracking UI and driver jobs/status/manual ping UI exist; no background GPS, WebSockets, ETA, or public tracking |
| Test data | **Partial** — seed data still exists for supplier portal demos |

---

## User Path

1. Learner opens material detail (`/materials/:id`).
2. Taps **Reserve Material**.
3. If unauthenticated, the app redirects to login with `from=/materials/:id`.
4. If authenticated as a non-learner, the UI blocks the action.
5. The learner chooses pickup or delivery when both are available. Pickup-only or delivery-only materials preselect the only valid method.
6. The app submits `POST /api/reservations` with the material id, requested quantity, fulfillment method, and the method-specific scheduling fields. Pickup preferred windows must leave at least 60 minutes before ending; shorter windows are blocked before creating the reservation.
7. Success creates a `PENDING` reservation, keeps the success snackbar, shows a **View reservation status** CTA, invalidates learner reservations, and reloads material detail so the status becomes `PENDING_RESERVATION`.
8. Learner can open `/learner/reservations` from home to see pending/accepted/rejected/completed status. Accepted self-pickup cards show the full pickup address; delivery reservations keep pickup details on the delivery status page.
9. Supplier handles the request through the existing incoming requests page.
10. If the reservation is accepted and the material allows delivery, `/learner/reservations` shows **Request delivery**.
11. Learner enters a manual dropoff location. Success creates a delivery attempt and refreshes reservations/deliveries.
12. Existing deliveries show status badges and link to `/learner/deliveries/:id`.

### Frontend Path

- `material_discovery` detail CTA calls `reservationCreateControllerProvider`.
- `material_discovery` detail reads `myReservationsProvider`; if the learner already has a reservation for the material, it shows reservation status instead of the normal reserve CTA and links to My Reservations with status-specific copy.
- `features/reservations/data` contains the API/repository and request/response models.
- `/learner/reservations` lists the learner's reservations with loading, empty, error, manual refresh, and 10-second foreground polling states. Accepted cards choose pickup-only copy, delivery request, or delivery status from `myReservationsProvider` plus `learnerDeliveriesProvider`.
- `/learner/deliveries/:id` shows learner-owned delivery status history, material/supplier summary, pickup window, dropoff summary, and assigned driver summary when present.
- Home links to `/learner/reservations`.

### Backend Path

- `modules/reservations` mounts `POST /api/reservations`.
- `modules/reservations` mounts `GET /api/reservations/my`.
- Create validates `LEARNER` role, material `AVAILABLE`, quantity, and self-reservation.
- Create enforces one active reservation per material and uses `updateMany` with `status = AVAILABLE` as the race-safe guard.
- Read returns only reservations where `requesterId` is the authenticated learner, newest first, with safe material/supplier/pickup-window summary fields. Approximate `material.city`/`material.area` are always included; `pickupLocationFull` is populated only for `ACCEPTED` and `COMPLETED` statuses.
- Supplier accept sets material `RESERVED`; reject returns material `AVAILABLE`; supplier complete sets material `REUSED` only for self-pickup reservations. Delivery reservations complete through driver `DELIVERED`.

### Database Changes Per Flow

- Insert `reservations` (`PENDING`), `reservation_status_history`.
- `materials.status`: `AVAILABLE` → `PENDING_RESERVATION` on create.
- `materials.status`: `PENDING_RESERVATION` → `RESERVED` on supplier accept.
- `materials.status`: `PENDING_RESERVATION` → `AVAILABLE` on supplier reject.
- `materials.status`: `RESERVED` → `REUSED` on supplier complete.

### Success State

Learner sees a success snack bar, refreshed material detail, and a pending card in My Reservations. Supplier sees the pending request in incoming requests and derived reservation notification inbox.

### Error States

- Material unavailable or duplicate active reservation → 409
- Insufficient quantity / self reservation → 400
- Unauthenticated → 401
- Non-learner → 403
- Validation errors → 400
  - Pickup windows with less than 60 minutes remaining → `Preferred pickup window is too close to ending. Choose a window with at least 60 minutes remaining.`

### Files Involved

`material_discovery` detail page, `features/reservations/*`, `modules/reservations/*`, `supplier-reservations.*`, `learner_home_page.dart`.

---

## Still Not Implemented

- Scheduled background expiry cron (lazy expiry on read paths is implemented).
- Self-pickup map on reservation cards — **Implemented** when `pickupLocationFull` has coordinates (accepted self-pickup, no active delivery row).
- Realtime live tracking map/stream, ETA, delivery cancellation/retry UI, payment, and reviews.
- Generic persisted notifications (supplier-derived inbox only).
- Saved dropoff addresses, standalone location CRUD, current-location delivery request, and nearest-first sorting.

---

## Open Questions

- Whether later reservations should start from learning hub components too.
- Whether learner cancellation is allowed before supplier acceptance.
- See [09-open-questions.md](../09-open-questions.md) § Reservations.
