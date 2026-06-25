# Delivery Flow

Backend Stage 1 is implemented. Flutter learner request/status UI is partially implemented; driver UI and live tracking UI are not implemented.

## Trigger

Learner requests internal delivery after a supplier accepts a reservation.

## Flow

1. Learner owns an `ACCEPTED` reservation.
2. Learner opens `/learner/reservations`.
3. If the accepted material is delivery-enabled and no delivery exists, the card shows **Request delivery**.
4. Learner submits a manual dropoff location to `POST /api/reservations/:id/delivery`.
5. Backend verifies reservation ownership, accepted status, `material.deliveryAllowed = true`, and no active delivery for the reservation.
6. Backend creates:
   - copied delivery pickup `Location`
   - learner dropoff `Location`
   - `Delivery(status = WAITING_FOR_DRIVER)`
   - `DeliveryStatusHistory`
7. Flutter invalidates learner reservations and deliveries, then shows `WAITING_FOR_DRIVER` and links to `/learner/deliveries/:id`.
8. Driver lists waiting jobs through `GET /api/driver/deliveries/available`.
9. Driver accepts a job through `POST /api/driver/deliveries/:id/accept`.
10. Backend assigns driver transactionally, creates `DeliveryAssignment`, moves driver availability to `ON_DELIVERY`, and writes status history.
11. Assigned driver progresses status:
   - `DRIVER_ASSIGNED -> ARRIVED_PICKUP`
   - `ARRIVED_PICKUP -> PICKED_UP`
   - `PICKED_UP -> ON_THE_WAY`
   - `ON_THE_WAY -> ARRIVED_DROPOFF`
   - `ARRIVED_DROPOFF -> DELIVERED`
12. Driver may post location pings while assigned to an active delivery.
13. `DELIVERED` completes the reservation and marks material `REUSED`.

## Active Delivery Rule

Active statuses:

- `WAITING_FOR_DRIVER`
- `DRIVER_ASSIGNED`
- `ARRIVED_PICKUP`
- `PICKED_UP`
- `ON_THE_WAY`
- `ARRIVED_DROPOFF`

Only one active delivery is allowed per reservation. The database allows many delivery attempts, but partial unique indexes and service transactions enforce only one active attempt per reservation and one active assigned delivery per driver.

## Completion Rules

- Self-pickup: supplier complete remains valid when no active/delivered delivery exists.
- Delivery: supplier complete is blocked; driver `DELIVERED` completes the reservation and reused material.

## Error States

- Reservation not owned by learner -> 404
- Reservation not accepted -> 409
- Material delivery disabled -> 400
- Active delivery already exists -> 409
- Driver unavailable or already on delivery -> 409
- Second driver accepts same job -> 409
- Unassigned driver status update -> 404
- Invalid status transition -> 409

## Still Missing

- Driver portal UI.
- Admin reassignment and cancellation operations.
- Live map/streaming tracking.
- Payment, reviews, external partners, cancellation, retry UI, and ETA.
