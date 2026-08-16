# Learner Reservation Flow

Documents the implemented MVP learner reservation request path.

**Out of scope for Flutter (still):** background GPS streaming, WebSockets/realtime tracking, public tracking links, supplier live tracking, scheduled background expiry cron, reservation-related reviews, delivery cancellation/retry, and real PSP checkout.

**Payments:** **CASH** settlement at handover is the current MVP; dormant electronic/card checkout infrastructure is retained in the codebase but not mounted. See [payment-flow.md](payment-flow.md) and [payments.md](../features/payments.md).

**Implemented since earlier doc drafts:** learner cancel (`PENDING` / awaiting confirmation), partial-quantity holds, handover codes, reschedule/report/messages, delivery request + delivery detail tracking summary, **CASH** payment presentation (dormant reservation-scoped card checkout retained in codebase, not routed).

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
6. The app submits `POST /api/reservations` with the material id, requested quantity, fulfillment method, and the method-specific fields. Preferred pickup and delivery windows are optional. If the learner enters a preferred pickup window, it must start at least 30 minutes from now and end at least 30 minutes from now; invalid provided windows are blocked before creating the reservation with specific `PICKUP_*` error codes.
7. Success creates a `PENDING` reservation, keeps the success snackbar, shows a **View reservation status** CTA, invalidates learner reservations, and reloads material detail so held quantity is reflected in `availableQuantity` and material status.
8. Learner can open `/learner/reservations` from home to see pending/accepted/rejected/completed status. Accepted self-pickup cards show the full pickup address; delivery reservations keep pickup details on the delivery status page.
9. Supplier handles the request through the existing incoming requests page.
10. If the reservation is accepted and the material allows delivery, `/learner/reservations` shows **Request delivery**.
11. Learner enters a manual dropoff location. Success creates a delivery attempt and refreshes reservations/deliveries.
12. Existing deliveries show status badges and link to `/learner/deliveries/:id`.

### Frontend Path

- `material_discovery` detail CTA calls `reservationCreateControllerProvider`.
- `material_discovery` detail reads `myReservationsProvider`; if the learner has a non-terminal reservation for the material, it shows reservation status instead of the normal reserve CTA and links to My Reservations with status-specific copy. Historical `REJECTED`, `CANCELLED`, `EXPIRED`, and `COMPLETED` reservations do not block the normal reserve action when the material is still currently reservable.
- `features/reservations/data` contains the API/repository and request/response models.
- `/learner/reservations` lists the learner's reservations with loading, empty, error, manual refresh, and 10-second foreground polling states. Its seven filters are All, Active, Needs action, Pending, Accepted, Completed, and Closed: Active contains all non-terminal states, Needs action is learner-specific, Pending contains `PENDING` and `AWAITING_SUPPLIER_CONFIRMATION` (supplier/system response), and Closed contains every terminal non-completed state. Accepted cards choose pickup-only copy, delivery request, or delivery status from `myReservationsProvider` plus `learnerDeliveriesProvider`.
- `/learner/deliveries/:id` shows learner-owned delivery status history, material/supplier summary, pickup window, dropoff summary, and assigned driver summary when present.
- Home links to `/learner/reservations`.

### Backend Path

- `modules/reservations` mounts `POST /api/reservations`.
- `modules/reservations` mounts `GET /api/reservations/my`.
- Create validates `LEARNER` role, material visibility/status, requested quantity, fulfillment method, any provided pickup/delivery windows, required delivery address fields, and self-reservation.
- Create runs in a serializable transaction, expires stale pending reservations for the same learner/material, checks held quantity, and enforces one active reservation per learner/material. Terminal reservation history does not block backend re-reservation.
- Read returns only reservations where `requesterId` is the authenticated learner, newest first, with safe material/supplier/pickup-window summary fields. Approximate `material.city`/`material.area` are always included; `pickupLocationFull` is populated only for `ACCEPTED` and `COMPLETED` statuses.
- Supplier accept keeps the quantity hold; reject/cancel/expiry releases the hold; supplier self-pickup completion and driver `DELIVERED` subtract `quantityRequested` from `material.quantity`.

### Database Changes Per Flow

- Insert `reservations` (`PENDING`) and `reservation_status_history`.
- Active holds are summed from `PENDING`, `AWAITING_LEARNER_CONFIRMATION`, `AWAITING_SUPPLIER_CONFIRMATION`, and `ACCEPTED`; `AWAITING_RESOLUTION` counts only when a related delivery has custody.
- `materials.status` is recomputed from remaining physical quantity and held quantity: `AVAILABLE` while unheld stock remains, `PENDING_RESERVATION`/`RESERVED` when all stock is held, and `REUSED` only when remaining quantity reaches zero after completion.
- Cancel, reject, and expiry release holds without decrementing `material.quantity`.
- Supplier self-pickup complete or driver `DELIVERED` decrements `material.quantity` by `quantityRequested`.

### Success State

Learner sees a success snack bar, refreshed material detail, and a pending card in My Reservations. Supplier sees the pending request in incoming requests and derived reservation notification inbox.

### Error States

- Material unavailable or duplicate active reservation → 409
- Insufficient quantity / self reservation → 400
- Unauthenticated → 401
- Non-learner → 403
- Validation errors → 400
  - Pickup windows with less than 30 minutes remaining → `PICKUP_WINDOW_TOO_CLOSE_TO_ENDING`
  - Pickup start too soon → `PICKUP_START_TOO_SOON`

### Files Involved

`material_discovery` detail page, `features/reservations/*`, `modules/reservations/*`, `supplier-reservations.*`, `learner_home_page.dart`.

---

## Still Not Implemented

- Scheduled background expiry cron (lazy expiry on read paths is implemented).
- True reservation-create idempotency keys.
- Full reservation-lifecycle notification coverage; generic persisted notifications exist, but not for every state transition.
- Realtime live tracking stream, ETA, delivery cancellation/retry UI, payment, and reservation-related reviews.
- Manual regression matrix and full learner/supplier widget or E2E coverage.

---

## Open Questions

- Product policy for learner cancellation after `ACCEPTED` self-pickup or after a delivery row exists. Current code allows learner cancellation only while `PENDING` or `AWAITING_LEARNER_CONFIRMATION`.
- See [product/open-questions.md](../product/open-questions.md) § Reservations.
