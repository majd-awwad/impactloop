# Delivery Flow

Backend Stage 1 is implemented. Flutter learner request/status UI, driver jobs/status UI, foreground auto-location sharing on the active delivery detail page, manual driver location pings, and learner-owned polling map tracking are partially implemented. Realtime streaming/live maps are not implemented.

## Trigger

Learner requests internal delivery after a supplier accepts a reservation.

## Flow

1. Learner owns an `ACCEPTED` reservation.
2. Learner opens `/learner/reservations`.
3. If the accepted material is delivery-enabled and no active delivery exists, the card shows **Request delivery**.
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
11. Flutter invalidates available/active driver providers and opens `/driver/deliveries/:id`.
12. Assigned driver progresses status:
   - `DRIVER_ASSIGNED -> ARRIVED_PICKUP`
   - `ARRIVED_PICKUP -> PICKED_UP`
   - `PICKED_UP -> ON_THE_WAY`
   - `ON_THE_WAY -> ARRIVED_DROPOFF`
   - `ARRIVED_DROPOFF -> DELIVERED`
13. Driver may turn on **Share automatically** on `/driver/deliveries/:id` while assigned to an active delivery. Flutter captures foreground location every 45 seconds while that page stays open and posts it through `POST /api/driver/deliveries/:id/location-pings`. Drivers can still tap **Send my location** for a one-off update. This is not background GPS.
14. `DELIVERED` completes the reservation, subtracts `quantityRequested`, and marks material `REUSED` only when remaining quantity reaches `0`.
15. Learner delivery detail polls `GET /api/deliveries/:id/tracking` only after pickup (`PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`). Before pickup and after terminal states, the backend returns `canTrack: false` and `latestDriverLocation: null`; Flutter shows status text only and does not render a driver map marker. When `canTrack` is true and a ping exists, Flutter renders a simple driver marker map plus last update time and accuracy. Raw driver coordinates are not printed as text. Learner tracking uses polling, not WebSocket/SSE.

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
- Driver already on delivery or otherwise not eligible to accept -> 409
- Second driver accepts same job -> 409
- Unassigned driver status update -> 404
- Unassigned driver location ping -> 404
- Terminal delivery location ping -> 404
- Invalid status transition -> 409

## Flutter Driver Portal

- `DRIVER` users are protected by `/driver` route guards and land on `/driver/jobs` after login unless they also have `SUPPLIER`.
- `/driver/jobs` shows active delivery first and available waiting jobs below it.
- Available jobs show safe city/area pickup and dropoff data only.
- The current portal does not expose a separate availability toggle; an active driver profile can accept a waiting job from `OFFLINE` or `AVAILABLE`, and accept moves the profile to `ON_DELIVERY`.
- `/driver/deliveries/:id` is resolved from active assigned deliveries. If the id is not active or not assigned to the driver, the page shows a back-to-jobs state.
- The detail page exposes one next action at a time, matching the backend transition order.
- The detail page exposes a manual **Send my location** action and a **Share automatically** toggle on active assigned deliveries. Auto-sharing sends foreground location every 45 seconds while the page stays open. It does not start automatic tracking in the background or on `/driver/jobs`.

## Learner Tracking Summary

- `GET /api/deliveries/:id` and `GET /api/deliveries/:id/tracking` remain learner-owned.
- `canTrack` is true only for `PICKED_UP`, `ON_THE_WAY`, and `ARRIVED_DROPOFF`.
- Before pickup (`WAITING_FOR_DRIVER`, `DRIVER_ASSIGNED`, `ARRIVED_PICKUP`) and after terminal states, the backend returns `latestDriverLocation: null` and never exposes driver coordinates.
- Flutter learner detail renders a map marker only when `canTrack` is true and coordinates are present, and never prints raw latitude/longitude as text.
- Polling uses `GET /api/deliveries/:id/tracking` only while `canTrack` is true, stops on terminal status, and does not poll before pickup.

## Still Missing

- Admin reassignment and cancellation operations.
- Realtime streaming tracking and WebSockets.
- Background GPS streaming.
- Payment, reviews, external partners, delivery cost, failure retry, learner delivery cancellation, and proof of delivery.
