# Delivery Feature

Internal delivery is now a backend domain for accepted reservations. Learners can request delivery and view delivery status in Flutter; internal drivers can accept jobs and advance assigned deliveries through the driver portal.

Role-scope boundary: driver is an operational support role for basic internal delivery coordination. Full Uber-style dispatch/tracking is not an MVP requirement.

## Current Status

| Layer | Status | Notes |
|-------|--------|-------|
| Prisma delivery domain | **Implemented** | `DriverProfile`, `Delivery`, `DeliveryAssignment`, `DeliveryStatusHistory`, `DeliveryLocationPing` |
| Learner delivery request API | **Implemented** | `POST /api/reservations/:id/delivery` |
| Learner delivery read/tracking API | **Implemented** | `GET /api/deliveries/my`, `GET /api/deliveries/:id` |
| Driver jobs/assignment/status API | **Implemented** | `/api/driver/deliveries/*` |
| Driver location pings | **Partial** | Assigned active drivers can share foreground location manually or automatically every 45 seconds while the active delivery detail page is open; no background tracking |
| Flutter learner delivery UI | **Partial** | My Reservations request dialog (saved or new dropoff + optional save), `/learner/deliveries/:id` status page, safe latest driver ping summary, and polling map marker; no realtime stream |
| Flutter driver portal | **Partial** | `/driver/jobs` job board, `/driver/deliveries/:id` status updates, foreground auto-location sharing on the active delivery detail page, and manual location ping; no live map or background pings |
| External partners/payment/AI | **Out of scope** | Not implemented |

## Data Model

Delivery is separate from reservation lifecycle:

- `Reservation` owns booking status: `PENDING`, `ACCEPTED`, `COMPLETED`, etc.
- `Delivery` owns logistics status: `WAITING_FOR_DRIVER`, `DRIVER_ASSIGNED`, `ARRIVED_PICKUP`, `PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`, `DELIVERED`, terminal failures/cancel.
- A reservation can have many delivery attempts over time.
- Service checks and partial unique database indexes enforce one active delivery per reservation and one active delivery per driver.
- `DriverProfile` is linked to a `User` with `DRIVER` role.

Deprecated compatibility fields remain on `Reservation`: `deliveryRequested`, `deliveryStatus`, `deliveryCost`, `dropoffLocationId`, `driverProfileId`. `deliveryRequested` is set to `true` when the learner creates a delivery via `POST /api/reservations/:id/delivery`; other legacy fields are not the source of truth.

## Backend Behavior

Learner delivery request:

- Requires `LEARNER`.
- Reservation must belong to learner.
- Reservation must be `ACCEPTED`.
- Material must have `deliveryAllowed = true`.
- No active delivery may already exist for the reservation.
- Creates dropoff `Location`.
- Copies material pickup `Location` into a delivery pickup snapshot.
- Creates `Delivery` with `WAITING_FOR_DRIVER`.
- Creates `DeliveryStatusHistory`.

Flutter learner delivery request:

- My Reservations is the primary request surface.
- Accepted pickup-only reservations show pickup window/supplier-note copy.
- Accepted pickup reservations on delivery-enabled materials show **Request delivery** when `canLearnerRequestDelivery` is true (no active delivery).
- Submitted delivery requests invalidate learner reservations, learner deliveries, and saved dropoff addresses.
- Existing deliveries show a status badge and link to `/learner/deliveries/:id`.

Flutter driver portal:

- `DRIVER` users are routed to `/driver/jobs` after login unless they also have `SUPPLIER`, which keeps supplier precedence.
- `/driver/jobs` shows the driver's active delivery first, then available `WAITING_FOR_DRIVER` jobs.
- Available job cards use only safe pickup/dropoff city/area data.
- Accepting a job invalidates available and active job providers, then opens `/driver/deliveries/:id`.
- Active delivery detail shows assigned-driver data, including exact pickup/dropoff snapshots returned by the backend.
- The status UI exposes only the next valid backend transition.
- Assigned active drivers can tap **Send my location** on the active delivery detail page, or turn on **Share automatically** to send foreground location pings every 45 seconds while that page stays open. The app captures foreground current location and posts it to `POST /api/driver/deliveries/:id/location-pings`. This is not background GPS.
- Learner delivery detail shows a safe tracking status card with the latest ping time and optional accuracy. When the backend includes coordinates for an active tracking status, the page renders a simple map marker and polls the detail endpoint while open. Raw driver coordinates are not printed as text. Learner tracking uses polling, not WebSocket/SSE.

Driver assignment:

- Requires `DRIVER` role and active `DriverProfile`.
- Driver may accept from `OFFLINE` or `AVAILABLE`; accepting moves the profile to `ON_DELIVERY`. This matches the current driver portal, which does not yet expose a separate availability toggle.
- Driver cannot already have an active delivery.
- Accept uses transactional `updateMany` guards: the driver profile must move from `OFFLINE`/`AVAILABLE` to `ON_DELIVERY`, and only `WAITING_FOR_DRIVER` unassigned deliveries can be assigned.
- Sets driver availability to `ON_DELIVERY`.

Completion:

- Driver status transitions must follow the allowed order.
- `DELIVERED` completes the reservation, subtracts `quantityRequested`, and marks the material `REUSED` only when remaining quantity reaches `0`.
- Supplier complete is blocked when an active or delivered delivery exists.
- Self-pickup reservations without delivery still use supplier complete.

## Routes

Learner:

- `POST /api/reservations/:id/delivery`
- `GET /api/deliveries/my`
- `GET /api/deliveries/:id`

Driver:

- `/driver/jobs`
- `/driver/deliveries/:id`
- `GET /api/driver/deliveries/available`
- `GET /api/driver/deliveries/active`
- `POST /api/driver/deliveries/:id/accept`
- `PATCH /api/driver/deliveries/:id/status`
- `POST /api/driver/deliveries/:id/location-pings`

## Privacy Rules

- Public material APIs still expose only city/area.
- Unassigned drivers see approximate/safe job data only; no exact coordinates.
- Assigned drivers see exact pickup/dropoff snapshots.
- Learners see their own delivery pickup/dropoff and assigned driver summary.
- Location pings are stored for assigned active drivers only.
- Learner delivery responses include only the latest driver ping, never the full ping history.
- Live driver ping coordinates are included only for learner-owned deliveries in `DRIVER_ASSIGNED`, `ARRIVED_PICKUP`, `PICKED_UP`, `ON_THE_WAY`, and `ARRIVED_DROPOFF`.
- `WAITING_FOR_DRIVER` and terminal statuses do not expose live driver coordinates.
- The learner Flutter UI may render a map marker from allowed coordinates, but does not display raw driver latitude/longitude text.

## Not Implemented Yet

- Admin reassignment/cancellation workflow.
- Real-time tracking stream and WebSockets.
- Background GPS streaming.
- Delivery payment/cost calculation.
- Delivery failure retry workflow, learner delivery cancellation, and proof of delivery.
- External delivery partners.
