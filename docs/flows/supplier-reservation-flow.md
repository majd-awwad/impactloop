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

`listSupplierReservations` → map tab to `ReservationStatus` (`declined` → `REJECTED`) → `findSupplierReservations(ownerId, status)`.

### Database changes

Read-only.

### Success state

List renders `SupplierIncomingRequest` cards.

### Error states

API failure → error/empty state in page (`supplier_feedback.dart` patterns).

---

## Flow — Accept pending reservation

### Trigger

Supplier taps **Accept** on pending request → dialog collects pickup window (+ optional note).

### User path

Confirm pickup start/end → reservation accepted → moves to accepted tab / pickup schedule.

### Frontend path

`accept_incoming_request_dialog.dart` → `supplierRequestsRepository.acceptRequest` → `PATCH /api/supplier/reservations/:id/accept` with body `{ pickupWindowStart, pickupWindowEnd, supplierNote? }`.

### Backend path

`acceptSupplierReservation` transaction:

- `reservations.status`: `PENDING` → `ACCEPTED`
- Set `pickupWindowStart`, `pickupWindowEnd`, `supplierNote`, `acceptedAt`
- `materials.status`: `PENDING_RESERVATION` → `RESERVED`
- Insert `reservation_status_history` (RESERVATION group)

### Database changes

Update `reservations`; update `materials`; insert `reservation_status_history`.

### Success state

Returns mapped reservation DTO; providers invalidated (`incomingRequestsProvider`, supplier notifications, supplier dashboard, pickup schedule, pickup schedule summary).

### Error states

- 404 not found
- 409 `CONFLICT` — not pending
- Validation errors on pickup window — **Needs verification** of schema

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

Supplier marks pickup complete (incoming requests or pickup schedule UI).

### Frontend path

`complete_pickup_dialog.dart` / providers → `PATCH .../complete` (no body).

### Backend path

Transaction:

- `reservations.status`: `ACCEPTED` → `COMPLETED`; `completedAt`
- History: ACCEPTED → COMPLETED
- `materials.status` → `REUSED`; `reusedAt`; `reusedByReservationId`

### Database changes

Update `reservations` + `materials`; insert history.

### Success state

Reservation completed; material marked reused.

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

- Learner reservation cancel
- Delivery request / driver assignment (`deliveryRequested`, `deliveryStatus` on schema)
- Cancel/expiry flows in UI
- Multi-reservation queues / partial inventory allocation

---

## Open questions

- Notification generation when reservation state changes?

### Files involved

`supplier_incoming_requests_page.dart`, `supplier_requests_api.dart`, `supplier_requests_providers.dart`, `accept_incoming_request_dialog.dart`, `decline_incoming_request_dialog.dart`, `complete_pickup_dialog.dart`, `supplier-reservations.service.ts`, `supplier-reservations.repository.ts`, `pickup_schedule_*`
