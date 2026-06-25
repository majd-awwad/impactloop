# Delivery Feature

Internal delivery is now a backend domain for accepted reservations. Flutter UI is not implemented yet.

## Current Status

| Layer | Status | Notes |
|-------|--------|-------|
| Prisma delivery domain | **Implemented** | `DriverProfile`, `Delivery`, `DeliveryAssignment`, `DeliveryStatusHistory`, `DeliveryLocationPing` |
| Learner delivery request API | **Implemented** | `POST /api/reservations/:id/delivery` |
| Learner delivery read/tracking API | **Implemented** | `GET /api/deliveries/my`, `GET /api/deliveries/:id` |
| Driver jobs/assignment/status API | **Implemented** | `/api/driver/deliveries/*` |
| Driver location pings | **Implemented backend-only** | Stored decimal lat/lng; no live streaming |
| Flutter learner delivery UI | **Not implemented** | No request/tracking screens yet |
| Flutter driver portal | **Not implemented** | No driver routes/pages yet |
| External partners/payment/AI | **Out of scope** | Not implemented |

## Data Model

Delivery is separate from reservation lifecycle:

- `Reservation` owns booking status: `PENDING`, `ACCEPTED`, `COMPLETED`, etc.
- `Delivery` owns logistics status: `WAITING_FOR_DRIVER`, `DRIVER_ASSIGNED`, `ARRIVED_PICKUP`, `PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`, `DELIVERED`, terminal failures/cancel.
- A reservation can have many delivery attempts over time.
- Service checks and partial unique database indexes enforce one active delivery per reservation and one active delivery per driver.
- `DriverProfile` is linked to a `User` with `DRIVER` role.

Deprecated compatibility fields remain on `Reservation`: `deliveryRequested`, `deliveryStatus`, `deliveryCost`, `dropoffLocationId`, `driverProfileId`. New delivery code does not use them as the source of truth.

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

Driver assignment:

- Requires `DRIVER` role and active `DriverProfile`.
- Driver must be `AVAILABLE`.
- Driver cannot already have an active delivery.
- Accept uses transactional `updateMany` guards: the driver profile must move from `AVAILABLE` to `ON_DELIVERY`, and only `WAITING_FOR_DRIVER` unassigned deliveries can be assigned.
- Sets driver availability to `ON_DELIVERY`.

Completion:

- Driver status transitions must follow the allowed order.
- `DELIVERED` completes the reservation and marks the material `REUSED`.
- Supplier complete is blocked when an active or delivered delivery exists.
- Self-pickup reservations without delivery still use supplier complete.

## Routes

Learner:

- `POST /api/reservations/:id/delivery`
- `GET /api/deliveries/my`
- `GET /api/deliveries/:id`

Driver:

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

## Not Implemented Yet

- Learner delivery request/tracking UI.
- Driver portal UI.
- Admin reassignment/cancellation workflow.
- Real-time tracking stream.
- Delivery payment/cost calculation.
- External delivery partners.
