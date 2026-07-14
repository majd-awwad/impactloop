# Delivery Feature

Internal delivery is a backend domain for accepted reservations. Learners can request delivery and view delivery status in Flutter; suppliers coordinate driver pickup windows and handover codes; internal drivers can accept jobs and advance assigned deliveries through the driver portal; admins can monitor deliveries, remove a pre-pickup assigned driver back to the job pool, and handle incident-based pickup recovery.

Role-scope boundary: driver is an operational support role for basic internal delivery coordination. Full Uber-style dispatch/tracking is not an MVP requirement.

## Current Status

| Layer | Status | Notes |
|-------|--------|-------|
| Prisma delivery domain | **Implemented** | `DriverProfile`, `Delivery`, `DeliveryAssignment`, `DeliveryStatusHistory`, `DeliveryLocationPing` |
| Learner delivery request API | **Implemented** | `POST /api/reservations/:id/delivery` |
| Learner delivery read/tracking API | **Implemented** | `GET /api/deliveries/my`, `GET /api/deliveries/:id` |
| Driver jobs/assignment/status/failure API | **Implemented** | `/api/driver/deliveries/*` |
| Supplier delivery incident API | **Implemented** | Supplier can report no driver available, mark delivery pickup expired, and report driver no-show |
| Admin delivery monitoring | **Implemented** | `/api/admin/deliveries`, `/api/admin/deliveries/:id`, plus pre-pickup driver-assignment reopen |
| Admin pickup recovery actions | **Implemented** | Incident-scoped request supplier reschedule and cancel/release-hold actions exist |
| Driver location pings | **Partial** | Assigned active drivers can share foreground location manually or automatically every 45 seconds while the active delivery detail page is open; no background tracking |
| Flutter learner delivery UI | **Partial** | My Reservations request dialog (saved or new dropoff with optional current-location coordinates + optional save), `/learner/deliveries/:id` status page, `/learner/deliveries/:id/track` polling map after `PICKED_UP`; no realtime stream |
| Flutter driver portal | **Partial** | `/driver/jobs` job board, `/driver/deliveries/:id` status updates, code prompts, incident reports, foreground auto-location sharing on the active delivery detail page, and manual location ping; no live route map or background pings |
| Flutter admin operations | **Partial** | Responsive delivery monitoring overview with server-backed summary/filter/pagination data, a concise Delivery/Journey/Progress/Attention/Updated list, and `/admin/deliveries/:deliveryId`: a conditional overview/timeline/assignment/group/incident/tracking workspace. It renders only returned contract fields and exposes pre-pickup **Reopen to drivers** only when authorized; no selected-driver reassignment or general delivery cancel screen |
| External partners/payment/AI | **Out of scope** | Not implemented |

## Data Model

Delivery is separate from reservation lifecycle:

- `Reservation` owns booking status: `PENDING`, `ACCEPTED`, `COMPLETED`, etc.
- `Delivery` owns logistics status: `WAITING_FOR_DRIVER`, `DRIVER_ASSIGNED`, `ARRIVED_PICKUP`, `PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`, `DELIVERED`, `CANCELLED`, `FAILED_PICKUP`, `FAILED_DELIVERY`, `DRIVER_NO_SHOW`, `LEARNER_NO_SHOW`, `AWAITING_RESOLUTION`.
- A reservation can have many delivery attempts over time.
- Service checks and a partial unique database index enforce one active delivery per reservation. Drivers can accept up to three active assigned deliveries; application guards enforce that limit.
- `DriverProfile` is linked to a `User` with `DRIVER` role.
- `DeliveryGroup` can combine accepted delivery reservations from the same learner/supplier/dropoff/window into one operational delivery job with multiple items.

Booking vs logistics:

- **`fulfillmentMethod`** (`PICKUP` | `DELIVERY`) on `reservations` is the booking source of truth.
- **`deliveries`** owns logistics status, driver assignment, pickup/dropoff locations, and delivery cost (when implemented).
- A pickup reservation with a later delivery job is detected via `deliveries` rows and `activeDelivery` in API responses — not a reservation flag.

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
- Notifies eligible active drivers with a persisted `DRIVER_NEW_JOB` notification.

Delivery reservation handoff:

- A learner can reserve with `fulfillmentMethod = DELIVERY`; this stores delivery address/window data but does not create a `Delivery` row immediately.
- Supplier accept for a feasible delivery window moves the reservation to `ACCEPTED`, stores supplier pickup and confirmed delivery windows, and creates or reuses a `WAITING_FOR_DRIVER` operational delivery.
- If the supplier proposal is not feasible for the learner delivery window, the reservation stays `AWAITING_LEARNER_CONFIRMATION` with no delivery row. Learner `SUBMIT_DELIVERY_WINDOW` can later accept a feasible window and create the delivery.
- Grouped delivery reservations can share a single delivery row. The driver job exposes multiple `items`; one `DELIVERED` transition completes all accepted reservations in the group.

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
- Learner opens `/learner/deliveries/:id/track` for the polling map (detail page links there when `canTrack`). The tracking page polls `GET /api/deliveries/:id/tracking` every 20 seconds while open and `canTrack` is true. Learner delivery detail also refreshes trackable deliveries every 20 seconds. Raw driver coordinates are not printed as text. Learner tracking uses polling, not WebSocket/SSE.

Driver assignment:

- Requires `DRIVER` role and active `DriverProfile`.
- Driver may accept from `OFFLINE` or `AVAILABLE`; accepting moves the profile to `ON_DELIVERY`. This matches the current driver portal, which does not yet expose a separate availability toggle.
- Driver cannot exceed the active delivery limit of three assigned in-progress deliveries.
- Accept uses transactional `updateMany` guards: the driver profile must move from `OFFLINE`/`AVAILABLE` to `ON_DELIVERY`, and only `WAITING_FOR_DRIVER` unassigned deliveries can be assigned.
- Sets driver availability to `ON_DELIVERY`.
- Accept clears unread `DRIVER_NEW_JOB` notifications for that delivery and may create a pickup-time reminder if the pickup window is due.

Admin driver assignment reopen:

- Admins can call `POST /api/admin/deliveries/:id/reopen-driver-assignment` from the dedicated admin delivery detail workspace, only when `availableMutations` returns `REOPEN_DRIVER_ASSIGNMENT`.
- Eligible delivery state is exactly `DRIVER_ASSIGNED` with an active assigned driver and active `DeliveryAssignment`; `WAITING_FOR_DRIVER`, pickup-started states (`ARRIVED_PICKUP` or later), terminal/failed/admin-review states, missing active assignment rows, and incompatible grouped delivery state are rejected with `409`.
- The operation runs transactionally, guards the delivery row by current status and driver, releases the active `DeliveryAssignment`, clears `assignedDriverProfileId` and `assignedAt`, writes `DRIVER_ASSIGNED -> WAITING_FOR_DRIVER` history, and returns the updated admin delivery detail.
- For grouped deliveries, the delivery group must still be `ASSIGNED` to the same driver and all delivery reservations in the group must still be `ACCEPTED`; the group is reopened to `OPEN` with no assigned driver.
- Reservation status, quantity hold, delivery fee, pickup/dropoff locations, delivery windows, handover codes, and grouping membership are preserved.
- The removed driver receives a persisted `DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN` notification. This admin reopen does not explicitly assign a replacement driver; eligible drivers see the job through the normal waiting-job pool.
- If the removed driver has no remaining active assigned deliveries, their profile availability is moved from `ON_DELIVERY` back to `AVAILABLE`.

Completion:

- Driver status transitions must follow the allowed order.
- `DELIVERED` completes the reservation, subtracts `quantityRequested`, and marks the material `REUSED` only when remaining quantity reaches `0`.
- Supplier complete is blocked when an active or delivered delivery exists.
- Self-pickup reservations without delivery still use supplier complete.

Failure and recovery:

- Supplier can report no driver available before assignment, mark a delivery pickup window expired, or report an assigned driver no-show after the supplier pickup window plus grace.
- Driver can report pickup failed, delivery failed, or a driver issue from the active delivery detail page when backend eligibility flags allow it.
- No-driver and stale assigned-driver pickup escalations are lazy. Read paths such as learner/supplier reservation reads, learner delivery reads, and driver active reads can move stale deliveries/reservations to `AWAITING_RESOLUTION`; there is no scheduled cron/worker for these transitions.
- Admin can verify/reject/resolve incident reports. For pickup-recovery reports (`NO_DRIVER_AVAILABLE`, `NO_RESPONSE_AFTER_PICKUP_WINDOW`, `DRIVER_DID_NOT_ARRIVE`, `PICKUP_FAILED`), generic resolve is blocked until admin chooses an operational action.
- Admin **Ask supplier for new pickup window** moves the reservation to `AWAITING_SUPPLIER_CONFIRMATION`, releases active delivery assignments, and notifies the supplier. Supplier `submit-no-driver-pickup-window` then sets the reservation back to `ACCEPTED`, reopens the delivery as `WAITING_FOR_DRIVER`, and notifies eligible drivers.
- Admin **Cancel and release hold** is implemented only for pickup-recovery incident reports. It sets the reservation to `EXPIRED`, cancels the delivery, releases the assignment, and recomputes material availability without decrementing stock.
- Admin delivery monitor reads use one shared contract for lifecycle, exclusive KPI bucket, attention state, scope, assignment state, mutations, and links. `OPEN_INCIDENT`, `OPEN_RESERVATION`, and `OPEN_GROUP` are navigation links, not admin attention actions.
- Grouped-delivery pickup recovery is fail-closed: until group-level recovery transitions are explicitly supported, reschedule and cancel/release-hold are omitted from the canonical incident action contract and direct calls return a conflict.
- General learner/supplier/admin delivery cancellation and selected-driver reassignment are not implemented. Incident recovery and admin pre-pickup unassignment reopen jobs to the driver pool instead of assigning a specific replacement driver.

Notifications:

- Driver notifications are intentionally limited to `DRIVER_NEW_JOB`, `DRIVER_PICKUP_TIME`, `DRIVER_DROPOFF_TIME`, and `DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN`.
- Supplier notifications exist for admin no-driver/stale-pickup reschedule requests.
- Existing reservation notifications still cover only part of the lifecycle. No delivery-completed, delivery-failed, learner tracking, admin-review, or replacement-driver notification event was found.

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
- `POST /api/driver/deliveries/:id/pickup-failed`
- `POST /api/driver/deliveries/:id/delivery-failed`
- `POST /api/driver/deliveries/:id/driver-issue`

Supplier:

- `POST /api/supplier/reservations/:id/report-no-driver`
- `POST /api/supplier/reservations/:id/mark-delivery-pickup-expired`
- `POST /api/supplier/reservations/:id/submit-no-driver-pickup-window`
- `POST /api/supplier/deliveries/:id/driver-no-show`

Admin:

- `GET /api/admin/deliveries`
- `GET /api/admin/deliveries/:id`
- `POST /api/admin/deliveries/:id/reopen-driver-assignment`
- `GET/PATCH /api/admin/no-show-reports/*`
- `POST /api/admin/no-show-reports/:id/request-supplier-reschedule`
- `POST /api/admin/no-show-reports/:id/cancel-release-hold`

## Privacy Rules

- Public material APIs still expose only city/area.
- Unassigned drivers see approximate/safe job data only; no exact coordinates.
- Assigned drivers see exact pickup/dropoff snapshots.
- Learners see their own delivery pickup/dropoff and assigned driver summary.
- Location pings are stored for assigned active drivers only.
- Learner delivery responses include only the latest driver ping, never the full ping history.
- Live driver ping coordinates are included only for learner-owned deliveries in `PICKED_UP`, `ON_THE_WAY`, and `ARRIVED_DROPOFF`.
- Before pickup (`DRIVER_ASSIGNED`, `ARRIVED_PICKUP`), learners see status text and optional ping summary without coordinates (`trackingLockedReason: TRACKING_STARTS_AFTER_PICKUP`).
- `WAITING_FOR_DRIVER`, pre-pickup assigned statuses, and terminal statuses do not expose live driver coordinates to learners.
- The learner Flutter UI may render a map marker from allowed coordinates, but does not display raw driver latitude/longitude text.
- Learner delivery detail and tracking refresh while tracking is available using 20-second polling. Driver foreground auto-location sharing uses 45-second pings while the detail page is open.

## Test Coverage

- Backend delivery core tests cover request validation, race-safe creation, driver list/filter/accept, active driver limit, status transitions, location ping visibility, completion accounting, and supplier-complete blocking.
- Backend grouped delivery tests cover grouped job creation, grouping reuse, driver job item payloads, assignment, grouped handover code, and grouped completion.
- Backend fulfillment and admin incident tests cover supplier/driver failure reports, no-driver and stale-pickup lazy escalations, admin request-supplier-reschedule, supplier pickup-window resubmission, and cancel/release-hold.
- Backend admin delivery tests cover pre-pickup driver-assignment reopen service behavior, preserving the accepted reservation, releasing the active assignment, clearing the driver, restoring driver availability when no other active deliveries remain, writing notification, and rejecting pickup-started delivery reopen.
- Backend driver notification tests cover new-job notification creation, idempotent notification writes, pickup/dropoff reminders, and intentionally omitted legacy/next-step notification types.
- Flutter tests cover delivery status labels, handover-code models, learner reservation delivery buttons, driver auto-ping eligibility/controller behavior, supplier delivery incident flags, supplier delivery status models, and the admin delivery reopen confirmation/success/conflict UI.
- Remaining verification gap: no end-to-end manual or automated test was found that clicks the complete learner -> supplier -> driver -> admin recovery lifecycle across all roles.

## Not Implemented Yet

- General selected-driver admin reassignment workflow.
- General learner/supplier/admin delivery cancellation workflow outside incident-scoped admin cancel/release-hold.
- Real-time tracking stream and WebSockets.
- Background GPS streaming.
- Delivery payment/settlement. Delivery fee metadata exists for reservation pricing/groups, but payment is not implemented.
- Post-pickup delivery failure retry/redelivery workflow.
- ETA/route calculation and proof-of-delivery media/signature. Handover codes are implemented.
- External delivery partners.
