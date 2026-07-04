# Supplier Reservation Flow

**Sources inspected:** `supplier_incoming_requests_page.dart`, `supplier_requests_api.dart`, `supplier_requests_providers.dart`, `accept_incoming_request_dialog.dart`, `decline_incoming_request_dialog.dart`, `complete_pickup_dialog.dart`, `supplier-reservations.*`

## Trigger

Supplier opens **Incoming requests** (`/supplier/reservations`) or arrives via notification deep link (`?tab=&focus=`).

**Prerequisite:** `reservations` rows can come from the learner `POST /api/reservations` MVP flow or database seed data.

---

## Flow — List reservations by tab

### User path

Switch tabs: pending / accepted / declined / completed (wording per UI). See cards with learner info, material summary, quantity, message.

### Frontend path

`SupplierIncomingRequestsPage` → `supplier_requests_providers.dart` → `SupplierRequestsApi.fetchIncomingRequests(tab)` → `GET /api/supplier/reservations?status=<tab>`.

### Backend path

`listSupplierReservations` → map tab to reservation statuses (`accepted` tab → `ACCEPTED` + `AWAITING_LEARNER_CONFIRMATION`; `declined` → `REJECTED`) → `findSupplierReservations(ownerId, statuses)`.

### Database changes

Read-only.

### Success state

List renders `SupplierIncomingRequest` cards. Each reservation DTO includes `deliveryRequested`, nullable `activeDelivery` (`id`, `status`), and `canSupplierComplete`. The supplier UI uses `canSupplierComplete` instead of guessing whether the complete action is allowed.

### Error states

API failure → error/empty state in page (`supplier_feedback.dart` patterns).

---

## Flow — Accept pending reservation

### Trigger

Supplier taps **Accept** on pending request → dialog shows fulfillment method, learner preferred windows, delivery details (when applicable), and collects supplier window (+ optional note). Delivery label: **Driver pickup window from supplier**.

### User path

Confirm window → reservation becomes `ACCEPTED` or `AWAITING_LEARNER_CONFIRMATION` → accepted tab shows confirmed/proposed scheduling copy.

### Frontend path

`accept_incoming_request_dialog.dart` → `supplierRequestsRepository.acceptRequest` → `PATCH /api/supplier/reservations/:id/accept` with body `{ pickupWindowStart, pickupWindowEnd, supplierNote? }`.

### Backend path

`acceptSupplierReservation` transaction (fulfillment-aware):

**PICKUP**

- Selected learner preferred window → `ACCEPTED`, set `pickupWindowStart/End` when the window still has at least 60 minutes remaining, even if its start time already passed
- Selected learner preferred window with less than 60 minutes remaining → `400` with “This pickup window is too close to ending. Propose a new time.”
- Custom supplier proposal → must start at least 30 minutes in the future; matching a learner preferred window → `ACCEPTED`, non-matching proposal → `AWAITING_LEARNER_CONFIRMATION`, set `supplierProposedPickupWindowStart/End`
- Legacy null preferred windows → `ACCEPTED` (old behavior)

**DELIVERY**

- Supplier window = driver pickup from supplier
- Feasible learner delivery window (60-minute buffer after supplier pickup end) → `ACCEPTED`, store supplier pickup + confirmed delivery windows, `deliveryRequested = true`, create `Delivery` `WAITING_FOR_DRIVER`
- Not feasible → `AWAITING_LEARNER_CONFIRMATION`, store supplier pickup + `schedulingConflictReason`, no delivery row

All paths: keep quantity hold; insert `reservation_status_history`; recompute material status.

### Database changes

Update `reservations`; may insert `deliveries` + locations for feasible delivery accept; update `materials`; insert `reservation_status_history`.

### Success state

Returns mapped reservation DTO including fulfillment/scheduling fields; providers invalidated (`incomingRequestsProvider`, supplier notifications, supplier dashboard, pickup schedule, pickup schedule summary).

### Error states

- 404 not found
- 409 `CONFLICT` — not pending
- 400 validation — selected learner pickup window has too little remaining time, custom supplier pickup starts too soon, invalid end-before-start windows, or delivery requires address/windows/material.deliveryAllowed

---

## Flow — Decline pending reservation

### Trigger

Supplier taps **Decline** → optional reason.

### Frontend path

`decline_incoming_request_dialog.dart` → `PATCH .../decline` with `{ reason? }`.

### Backend path

`reservations.status` → `REJECTED`; `rejectionReason`, `rejectedAt`; history row. The material returns to `AVAILABLE` when no other active reservation exists for that material.

### Database changes

Update `reservations`; update `materials`; insert history.

### Frontend invalidation

Decline invalidates incoming requests, supplier notifications, supplier dashboard, pickup schedule, and pickup schedule summary.

### Error states

404, 409 if not pending.

---

## Flow — Complete accepted reservation (pickup done)

### Trigger

Supplier marks self-pickup complete (incoming requests or pickup schedule UI). Delivery reservations do not show the manual complete action; they show delivery status copy such as “Delivery requested”, “Driver assigned”, “On the way”, or “Delivered”.

### Frontend path

`complete_pickup_dialog.dart` / providers → `PATCH .../complete` (no body).

### Backend path

Transaction:

- `reservations.status`: `ACCEPTED` → `COMPLETED`; `completedAt`
- History: ACCEPTED → COMPLETED
- `material.quantity` decreases by `quantityRequested`
- `materials.status` → `AVAILABLE` if quantity remains, else `REUSED` with `reusedAt` and `reusedByReservationId`

If the reservation has `deliveryRequested` or any `Delivery` row, supplier complete returns `409 CONFLICT`. Delivery reservations complete only through the assigned driver `DELIVERED` transition. The supplier UI maps this stale/race conflict to: “This reservation is handled by delivery. The driver will mark it completed.”

### Database changes

Update `reservations` + `materials`; insert history.

### Success state

Reservation completed; material quantity decremented; material marked `REUSED` only when depleted.

### Frontend invalidation

Complete invalidates incoming requests, supplier notifications, supplier dashboard, pickup schedule, and pickup schedule summary.

### Error states

409 if not accepted.

---

## Pickup schedule (related)

### Status

**Implemented** — separate page `/supplier/pickup-schedule` reads accepted reservations via `supplier_pickup_schedule_api.dart` (same reservation data, different presentation).

---

## Not implemented

- Automatic `PENDING` reservation expiry — **Implemented (lazy)** on learner/supplier reservation reads and material availability reads; supplier `cancelled` tab includes `EXPIRED`.
- Supplier **`mark-delivery-pickup-expired` UI** — **Implemented** on incoming request cards.
- Dedicated learner reservation detail route (`/learner/reservations/:id`).
- Self-pickup map on learner reservation UI — **Implemented**.
- Realtime delivery tracking stream / background GPS.
- Generic persisted notifications on reservation state changes.
- QR polish.

---

## Open questions

- Notification generation when reservation state changes?

### Files involved

`supplier_incoming_requests_page.dart`, `supplier_requests_api.dart`, `supplier_requests_providers.dart`, `accept_incoming_request_dialog.dart`, `decline_incoming_request_dialog.dart`, `complete_pickup_dialog.dart`, `supplier-reservations.service.ts`, `supplier-reservations.repository.ts`, `pickup_schedule_*`
