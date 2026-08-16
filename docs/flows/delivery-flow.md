# Delivery Flow

The core internal delivery lifecycle is implemented, with partial tracking and partial operational recovery. Flutter learner request/status UI, driver jobs/status UI, foreground auto-location sharing on the active delivery detail page, manual driver location pings, learner-owned polling map tracking, supplier incident actions, admin pre-pickup driver-assignment reopen, and admin pickup-recovery actions exist. Realtime streaming, background GPS, general delivery cancellation, selected-driver reassignment, ETA, and post-pickup retry are not implemented.

Delivery fee obligations use the same payment readiness model as reservations (**CASH** at handover in the current MVP; dormant CARD checkout infrastructure retained for future use). Driver new-job notifications require fee readiness when a positive delivery fee applies. See [payments.md](../features/payments.md).

## Triggers

- A learner requests internal delivery after a supplier accepts a pickup reservation and the material allows delivery.
- A supplier accepts a delivery reservation with a feasible delivery window.
- A learner submits a feasible delivery window after a supplier proposal conflict.

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
13. Driver may turn on **Share automatically** on `/driver/deliveries/:id` only after `PICKED_UP` (`PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`). Flutter captures foreground location every 45 seconds while that page stays open and posts it through `POST /api/driver/deliveries/:id/location-pings`. The backend rejects pings before pickup. Drivers can still tap **Send my location** when eligible. This is not background GPS.
14. `DELIVERED` completes the reservation, subtracts `quantityRequested`, and marks material `REUSED` only when remaining quantity reaches `0`.
15. Learner opens `/learner/deliveries/:id/track` (or **Track delivery** from reservations/detail) only after pickup. The tracking page polls `GET /api/deliveries/:id/tracking` every 20 seconds. Learner delivery detail also refreshes trackable deliveries every 20 seconds. Before pickup and after terminal states, the backend returns `canTrack: false` and `latestDriverLocation: null`; Flutter shows status text only. When `canTrack` is true and a ping exists, Flutter renders a simple driver marker map (plus drop-off marker when available), last update time, and stale warning when the ping is older than 90 seconds. Learner tracking uses polling, not WebSocket/SSE.

## Delivery Reservation Handoff

Delivery reservations do not create a `Delivery` row at initial reservation creation. The reservation stores delivery address, dropoff city/area, delivery note, preferred delivery windows, pricing snapshots, and optional `deliveryGroupId`.

Supplier accept:

- Feasible learner delivery window -> reservation becomes `ACCEPTED`, supplier pickup and confirmed delivery windows are stored, a `WAITING_FOR_DRIVER` delivery is created or reused for the delivery group, and eligible drivers are notified.
- No feasible delivery window -> reservation becomes `AWAITING_LEARNER_CONFIRMATION`, stores the scheduling conflict, and no delivery row is created.

Learner confirmation:

- `SUBMIT_DELIVERY_WINDOW` with a feasible window -> reservation becomes `ACCEPTED`, confirmed delivery window is stored, and a `WAITING_FOR_DRIVER` delivery is created.
- Infeasible submitted delivery window -> reservation stays `AWAITING_LEARNER_CONFIRMATION`; no delivery row is created.
- Cancel while awaiting confirmation -> reservation becomes `CANCELLED` and releases the hold.

Grouped delivery:

- Compatible delivery reservations can share one `DeliveryGroup` and one operational `Delivery`.
- Driver available jobs show one grouped job with multiple `items`.
- One `DELIVERED` transition completes all accepted reservations in that group.

## Active Delivery Rule

Active statuses:

- `WAITING_FOR_DRIVER`
- `DRIVER_ASSIGNED`
- `ARRIVED_PICKUP`
- `PICKED_UP`
- `ON_THE_WAY`
- `ARRIVED_DROPOFF`

Only one active delivery is allowed per reservation. The database allows many delivery attempts, but partial unique indexes and service transactions enforce only one active attempt per reservation.

Driver active assignment count is application-limited to three in-progress deliveries. A grouped delivery counts as one active delivery even when it contains multiple reservation items.

## Completion Rules

- Self-pickup: supplier complete remains valid when no active/delivered delivery exists.
- Delivery: supplier complete is blocked; driver `DELIVERED` completes the reservation and reused material.
- Delivery-backed reservations remain blocked from supplier manual complete even when a delivery row is terminal.

## Failure And Recovery

Supplier actions:

- `report-no-driver` creates a system incident for no available driver.
- `mark-delivery-pickup-expired` moves a waiting delivery/reservation to admin review after the supplier pickup window plus grace.
- `driver-no-show` reports an assigned driver before pickup after the supplier pickup window plus grace.

Driver actions:

- `pickup-failed` applies before pickup after the supplier pickup window plus grace.
- `delivery-failed` applies after pickup after the confirmed delivery window plus grace.
- `driver-issue` applies after pickup when the driver cannot continue.
- These paths move the delivery/reservation into `AWAITING_RESOLUTION` or a terminal failure state and release active assignment where applicable.

Lazy escalation:

- No-driver auto-escalation is due 24 hours after the no-driver threshold and is triggered lazily by relevant read paths, not by a scheduler.
- Assigned-driver pickup auto-escalation is due 24 hours after stale assigned-driver pickup and is also lazy.

Admin pickup recovery:

- Admin delivery monitor can read delivery detail and, for eligible pre-pickup `DRIVER_ASSIGNED` deliveries, reopen the current driver assignment back to `WAITING_FOR_DRIVER`.
- Admin no-show/incident queue can verify, reject, or resolve incident reports.
- Pickup-recovery reports require an operational action before generic resolve: ask supplier for a new pickup window or cancel and release hold.
- Asking supplier moves the reservation to `AWAITING_SUPPLIER_CONFIRMATION`; supplier `submit-no-driver-pickup-window` reopens the existing delivery as `WAITING_FOR_DRIVER`.
- Cancel and release hold expires the reservation, cancels the delivery, and releases the held quantity. This is incident-scoped; it is not a general delivery cancellation endpoint.

Admin driver-assignment reopen:

- Route: `POST /api/admin/deliveries/:id/reopen-driver-assignment`.
- UI: admin delivery detail shows **Reopen to drivers** only when the backend detail marks the delivery eligible.
- Eligible state: exactly `DRIVER_ASSIGNED`, with an active assigned driver and active `DeliveryAssignment`.
- Rejected states: already `WAITING_FOR_DRIVER`, pickup started (`ARRIVED_PICKUP` or later), terminal/failed/admin-review states, missing active assignment, incompatible grouped delivery reservations, or concurrent assignment change.
- Transaction result: active assignment becomes `RELEASED`, delivery becomes `WAITING_FOR_DRIVER`, assigned driver and assigned timestamp are cleared, status history is written, grouped delivery status returns to `OPEN` when applicable, and reservation/hold/fees/windows/dropoff/group membership stay unchanged.
- Notification: removed driver receives `DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN`. The job returns to the normal available-driver pool; no selected replacement driver is assigned.

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
- General delivery cancellation -> not available
- Selected-driver admin reassignment -> not available
- Admin pre-pickup reopen to driver pool on ineligible state -> 409

## Flutter Driver Portal

- `DRIVER` users are protected by `/driver` route guards and land on `/driver/jobs` after login unless they also have `SUPPLIER`.
- `/driver/jobs` shows active delivery first and available waiting jobs below it.
- Available jobs show safe city/area pickup and dropoff data only.
- Drivers control `acceptingNewJobs` from Profile / Dashboard. Effective `availability` is system-managed (`ON_DELIVERY` / `AVAILABLE` / `OFFLINE`). Browse and accept require accepting new jobs; active work continues while future jobs are paused.
- A driver may carry up to three active in-progress deliveries.
- `/driver/deliveries/:id` is resolved from active assigned deliveries. If the id is not active or not assigned to the driver, the page shows a back-to-jobs state.
- The detail page exposes one next action at a time, matching the backend transition order.
- The detail page exposes a manual **Send my location** action and a **Share automatically** toggle only after pickup (`PICKED_UP` onward). Auto-sharing sends foreground location every 45 seconds while the page stays open. It does not start automatic tracking in the background or on `/driver/jobs`.
- The detail page conditionally exposes pickup-failed, delivery-failed, and driver-issue report actions from backend eligibility flags.

## Learner Tracking Summary

- `GET /api/deliveries/:id` and `GET /api/deliveries/:id/tracking` remain learner-owned.
- `canTrack` is true only for `PICKED_UP`, `ON_THE_WAY`, and `ARRIVED_DROPOFF`.
- Before pickup (`WAITING_FOR_DRIVER`, `DRIVER_ASSIGNED`, `ARRIVED_PICKUP`) and after terminal states, the backend returns `latestDriverLocation: null` and never exposes driver coordinates.
- Flutter learner detail renders a map marker only when `canTrack` is true and coordinates are present, and never prints raw latitude/longitude as text.
- Polling uses `GET /api/deliveries/:id/tracking` every 20 seconds only while `canTrack` is true, stops on terminal status, and does not poll before pickup.

## Notifications

- New deliveries and supplier pickup-window reschedule reopens create idempotent `DRIVER_NEW_JOB` notifications for eligible active drivers.
- Driver accept clears unread new-job notifications for that delivery.
- Pickup/dropoff time reminders are created only when their windows are due and are idempotent.
- Admin pre-pickup driver-assignment reopen notifies the removed driver with `DRIVER_DELIVERY_UNASSIGNED_BY_ADMIN`.
- Admin request-supplier-reschedule creates supplier notifications for no-driver or stale-pickup recovery.

## Supplier schedule distinction

The Supplier Pickup Schedule uses the delivery-side Supplier-to-driver pickup window (`SUPPLIER_DELIVERY_PICKUP`) as its appointment. It never treats the learner drop-off/confirmed delivery window or `deliveredAt` as a Supplier pickup time. For completed delivery history, the schedule timestamp is `pickedUpAt`; delivery completion remains a separate learner handover event.

`GET /api/supplier/reservations/schedule` deduplicates grouped deliveries before pagination and returns one representative Supplier handover entry per DeliveryGroup, with bounded member IDs and group context. Waiting-for-driver, assigned, arrived, picked-up, and on-the-way states are classified from delivery operational state without changing delivery mutations.
- Delivery accepted/completed/failed/admin-review notifications are not broadly implemented for learners, suppliers, or admins.

## Verified Coverage

- Backend tests cover learner delivery request validation, duplicate/race guards, driver job filters, driver accept race safety, status transitions, location ping privacy, completion accounting, grouped deliveries, fulfillment failures, lazy escalations, admin pickup recovery, admin pre-pickup driver-assignment reopen, and driver notifications.
- Flutter tests cover delivery labels/models, learner reservation delivery actions, supplier delivery status/incident flags, handover-code payloads, driver auto-ping eligibility/controller behavior, and admin reopen confirmation/success/conflict UI.

## Manual Verification Still Needed

- Full role-to-role manual flow: learner delivery reservation -> supplier accept -> driver accept -> supplier handover code -> learner delivery code -> completion.
- Full no-driver/stale-pickup recovery flow through learner/supplier/admin/driver screens.
- Browser/device verification of current-location permissions and tracking map rendering across web/mobile.

## Still Missing

- General selected-driver admin reassignment operations.
- General delivery cancellation operations outside incident-scoped admin cancel/release-hold.
- Realtime streaming tracking and WebSockets.
- Background GPS streaming.
- Payment/settlement, reviews, external partners, ETA/route calculation, post-pickup failure retry, learner delivery cancellation, and proof-of-delivery media/signature.
