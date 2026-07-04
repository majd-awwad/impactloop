# Reservations Feature

Current MVP status for material reservations.

**Sources inspected:** `apps/backend/prisma/schema.prisma`, `apps/backend/src/modules/reservations/*`, `apps/backend/src/modules/supplier-reservations/*`, `apps/backend/src/app.ts`, `apps/frontend/lib/features/reservations/*`, `apps/frontend/lib/features/material_discovery/**`, `apps/frontend/lib/features/supplier_portal/**`, `docs/flows/supplier-reservation-flow.md`, `docs/flows/learner-reservation-flow.md`, `docs/08-implementation-status.md`

## Intended Purpose

- Learner creates reservation → `PENDING` with `quantityRequested` and reserve-time `fulfillmentMethod` (`PICKUP` or `DELIVERY`). When both methods are available, the learner must explicitly choose one in the reservation dialog; the UI auto-selects only when the material supports exactly one receive method.
- Pickup reservations store learner preferred pickup windows; each pickup window must have at least 60 minutes remaining when created. Delivery reservations store preferred delivery windows, delivery address text, safe drop-off preference, and optional delivery note. No `Delivery` row is created at reservation time.
- Supplier accepts or rejects pending reservations. Accept does **not** complete the reservation; it confirms or proposes scheduling and keeps the quantity hold.
- Pickup accept: supplier supplies pickup window. Selecting a learner preferred window → `ACCEPTED` with confirmed `pickupWindowStart/End` when at least 60 minutes remain, even if the window already started. Custom supplier proposals must start at least 30 minutes in the future; matching a learner preferred window → `ACCEPTED`, non-matching proposal → `AWAITING_LEARNER_CONFIRMATION` with `supplierProposedPickupWindowStart/End`.
- Delivery accept: supplier supplies driver pickup window from supplier only. Backend trims/confirms a delivery window using a 60-minute buffer after supplier pickup end. Feasible → `ACCEPTED`, stores supplier pickup + confirmed delivery windows, sets `deliveryRequested`, creates `Delivery` `WAITING_FOR_DRIVER`. Infeasible → `AWAITING_LEARNER_CONFIRMATION` with `schedulingConflictReason` (no delivery row).
- Multiple learners may hold different quantities from the same listing while stock remains.
- Same learner may hold only one open (`PENDING` or `ACCEPTED`) reservation per material.
- `material.quantity` is remaining physical stock; active holds are summed from open reservations.
- `availableQuantity = material.quantity - sum(quantityRequested for PENDING/AWAITING_LEARNER_CONFIRMATION/ACCEPTED)`.
- Material stays publicly `AVAILABLE` while `availableQuantity > 0`.
- Material becomes `REUSED` only when remaining quantity reaches `0` after completion/delivery.
- Learner may cancel while reservation is `PENDING` or `AWAITING_LEARNER_CONFIRMATION` (via cancel route or learner-confirmation `CANCEL` action).
- `PENDING` reservations expire automatically when the last preferred pickup/delivery window ends without supplier response. Legacy rows without stored windows expire after 72 hours (`PENDING_RESERVATION_FALLBACK_HOURS`). Expiry releases the quantity hold and sets status `EXPIRED` (lazy on learner/supplier reads and material availability reads; no background cron in MVP).
- Learner resolves `AWAITING_LEARNER_CONFIRMATION` via `PATCH /api/reservations/:id/learner-confirmation`: accept proposed pickup, submit a new delivery window, or cancel.

Reservation is the booking layer. Future build-checklist states such as `Available`, `Missing`, `Alternative`, `Already owned`, and `Reserved` should integrate with reservations, but the checklist itself belongs to future Learning Hub / AI matching work.

## Current Code Status

| Layer | Status | Evidence |
|-------|--------|----------|
| Database `reservations` + `reservation_status_history` | **Implemented** | Schema incl. `quantityRequested`, reschedule/incident fields, `AWAITING_SUPPLIER_CONFIRMATION`, `AWAITING_RESOLUTION` |
| Learner `POST /api/reservations` | **Implemented** | Partial-quantity holds, fulfillment choice, preferred windows, per-learner open-reservation guard |
| Learner `PATCH /api/reservations/:id/cancel` | **Implemented** | `PENDING` or `AWAITING_LEARNER_CONFIRMATION` cancel releases hold |
| Learner `PATCH /api/reservations/:id/learner-confirmation` | **Implemented** | Accept proposed pickup, submit delivery window, or cancel while awaiting confirmation |
| Learner follow-up APIs | **Implemented** | `request-reschedule`, `report-supplier-issue`, `report-no-driver`, reservation-scoped `messages` |
| Learner `GET /api/reservations/my` | **Implemented** | Scheduling fields, `selfPickupCode`, `pickupHandoverPhase`, follow-up flags, `pickupLocationFull` after accept/complete, `activeDelivery` |
| Material discovery/detail `availableQuantity` | **Implemented** | Public browse/detail DTO field |
| Learner reserve UI | **Implemented** | Material detail quantity + explicit pickup/delivery fulfillment dialog |
| Learner “My Reservations” UI | **Partial** | Rich list cards + `/learner/reservations/:id` detail route with 10-second polling; list cards link to detail |
| Supplier list/accept/decline/complete | **Partial** | Fulfillment-aware accept (pickup + delivery scheduling), `needs_learner` tab, handover-code complete, overdue close/report/reschedule, learner-reschedule accept, delivery handover code, incident reports including **`mark-delivery-pickup-expired` UI** |
| Delivery learner UI | **Partial** | Request/status/tracking summary + polling map marker on delivery detail; not on self-pickup reservation cards |
| Admin incident queue | **Implemented** | `/admin/no-show-reports` verify/reject/resolve |

**Overall:** **Partial**. Core booking, scheduling, handover codes, cancel/reschedule, incident reporting, delivery request paths, and saved dropoff addresses are implemented end-to-end. **Deferred:** QR polish.

## Existing Related Files

### Backend

| Path | Role |
|------|------|
| `modules/reservations/reservations.routes.ts` | Learner reservation create endpoint |
| `modules/reservations/reservations.service.ts` | Learner reservation create/read business logic |
| `modules/reservations/reservations.repository.ts` | Transactional create + material status update; learner-owned list query |
| `modules/reservations/reservations.validation.ts` | Request schema |
| `modules/reservations/reservations.quantity.ts` | Held/available quantity helpers + status recompute |
| `modules/reservations/reservations.partial.test.ts` | Partial quantity + cancel tests |
| `modules/supplier-reservations/supplier-reservations.routes.ts` | Supplier endpoints |
| `modules/supplier-reservations/supplier-reservations.service.ts` | Supplier reservation business logic |
| `modules/supplier-reservations/supplier-reservations.repository.ts` | Supplier status transition transactions |
| `modules/supplier/supplier.routes.ts` | Mounts `/reservations` under `/api/supplier` |
| `prisma/seeds/seed-supplier-reservations.ts` | Demo PENDING/ACCEPTED rows |

### Frontend

| Path | Role |
|------|------|
| `reservations/data/*`, `reservations/application/*` | Learner reservation API/repository/controllers |
| `reservations/presentation/pages/learner_reservations_page.dart` | Learner reservation list + inline actions (not a separate detail route) |
| `reservations/presentation/widgets/learner_awaiting_confirmation_panel.dart` | Awaiting-confirmation accept/submit/cancel |
| `reservations/presentation/widgets/learner_reservation_messages_panel.dart` | Reservation-scoped messages |
| `shared/widgets/handover_confirmation_code_panel.dart` | Self-pickup / delivery handover code display |
| `material_discovery/.../material_details_page.dart` | Reserve button entry point; post-success and existing-reservation links to My Reservations |
| `supplier_portal/.../supplier_incoming_requests_page.dart` | Supplier inbox |
| `supplier_portal/data/supplier_requests_api.dart` | Supplier API client |
| `home/.../learner_home_page.dart` | Links to My Reservations |

### Database

- `reservations`, `reservation_status_history`
- Enums: `ReservationStatus`, `ReservationStatusGroup`, `PickupType`
- Related: `materials.status`, `materials.reused_at`, `materials.reused_by_reservation_id`
- Delivery domain: `deliveries`, `driver_profiles`, `delivery_assignments`, `delivery_status_history`, `delivery_location_pings`
- Legacy reservation delivery fields still exist for compatibility, but new code uses `deliveries`.

## Status Transitions

- `material.quantity` = remaining physical stock (decremented on supplier complete or driver `DELIVERED`).
- Holds = sum of `quantityRequested` for `PENDING` + `AWAITING_LEARNER_CONFIRMATION` + `ACCEPTED` reservations.
- `availableQuantity = material.quantity - holds` (also exposed on material list/detail APIs).
- Create hold: validates against `availableQuantity`; keeps material `AVAILABLE` when stock remains; may set `PENDING_RESERVATION` / `RESERVED` only when all stock is held.
- Cancel / decline / reject: releases hold and recomputes material status; does not decrement `material.quantity`.
- Accept: keeps hold; does not decrement `material.quantity`.
- Complete / `DELIVERED`: subtract `quantityRequested`, recompute status; `REUSED` only when quantity reaches `0`.

`COMPLETED` reservations are excluded from holds because quantity was already subtracted.

## What Is Missing

Verified against code (2026-07-04):

- **Dedicated learner reservation detail page** — `GET /api/reservations/:id` + `/learner/reservations/:id` with shared reservation card UI.
- **Automatic `PENDING` expiry** — implemented via lazy expiry on read paths; see Intended Purpose above.
- ~~**Supplier `mark-delivery-pickup-expired` UI**~~ — implemented on incoming request cards (`canSupplierMarkDeliveryPickupExpired` + confirm dialog).
- **Self-pickup map on learner reservation UI** — implemented on accepted self-pickup cards when `pickupLocationFull` includes coordinates (OpenStreetMap marker + address text).
- Generic persisted notification table flow — **Implemented** via `/api/notifications` + reservation lifecycle writes (supplier derived inbox unchanged).
- Live delivery tracking stream, ETA, delivery cancellation/retry, payment, and reviews.
- ~~**Saved learner dropoff addresses**~~ — implemented via `/api/learner/saved-dropoff-addresses` CRUD + My Reservations request-delivery dialog (saved pick or inline with optional save).
- Standalone location CRUD, current-location delivery request, and nearest-first sorting.
- QR polish (**deferred**).
- Project build checklist integration and already-owned material markers.

## Already implemented (do not re-build)

- Learner cancel while `PENDING` or `AWAITING_LEARNER_CONFIRMATION`.
- Partial-quantity holds and reserve-time pickup/delivery fulfillment choice.
- Handover confirmation codes (learner self-pickup code, supplier→driver handover code, code-required supplier complete).
- Phase-based overdue pickup follow-up (±30 min handover window) for supplier and learner reschedule/report actions.
- Reservation-scoped messages, incident reports, and admin `/admin/no-show-reports` queue.
- Learner delivery request + `/learner/deliveries/:id` status/tracking summary.

## Location privacy (MVP)

- Public material discovery (`GET /api/materials`, `GET /api/materials/:id`) exposes only approximate `city` and `area`.
- `GET /api/reservations/my` keeps the same approximate material fields for all statuses.
- `deliveryRequested` is included on learner reservation list items so the UI can hide self-pickup instructions when delivery is in progress, even if the deliveries list has not loaded yet.
- `pickupLocationFull` (country, city, area, address line, coordinates, `isApproximate`) is returned only for learner-owned reservations in `ACCEPTED` or `COMPLETED` status; it is `null` for `PENDING`, `AWAITING_LEARNER_CONFIRMATION`, `REJECTED`, `CANCELLED`, and `EXPIRED`. The My Reservations UI shows the pickup address + map panel for accepted self-pickup reservations without `deliveryRequested` and without a loaded delivery row when coordinates are present.
- Delivery route exact pickup/dropoff locations remain on learner-owned or assigned-driver delivery APIs only.

## Legacy data and dev DB cleanup

This branch changes **forward** stock semantics only. It does not backfill historical completions.

| Existing row state | Risk after deploy |
|--------------------|-------------------|
| `COMPLETED` reservations where `material.quantity` was never decremented | `availableQuantity` overstates stock; learners may reserve already-delivered quantity |
| `REUSED` materials with `quantity > 0` (common in old seeds) | Hidden from discovery; admin CO₂ may over-count until cleaned |

**Before manual QA on a shared dev database:** reseed (`SEED_FORCE_*` / fresh migrate) **or** run a one-time backfill. Example SQL (review on a copy first):

```sql
-- Subtract completed reservation totals from remaining stock.
UPDATE materials m
SET quantity = GREATEST(
  0,
  m.quantity - COALESCE(c.completed_total, 0)
)
FROM (
  SELECT material_id, SUM(quantity_requested) AS completed_total
  FROM reservations
  WHERE status = 'COMPLETED'
  GROUP BY material_id
) c
WHERE m.id = c.material_id;

-- Clamp REUSED rows that still show remaining stock.
UPDATE materials
SET quantity = 0
WHERE status = 'REUSED' AND quantity > 0;
```

Recompute `materials.status` / `reused_at` manually for affected rows if needed. Do not run silently in production without review.

## Risks

- Public discovery pages own local futures, so the detail page refreshes itself and home suggestions/my reservations are invalidated after reservation/cancel; existing open discovery pages refresh only by re-entering/reloading. The learner reservations page polls its reservation and delivery summaries every 10 seconds while open to pick up supplier-side accept/decline/complete changes without a full WebSocket channel.
- No database unique constraint enforces stock limits; protection is serializable transactions plus held-quantity math.
- `REUSED` is set only when remaining `material.quantity` reaches `0`; `reusedByReservationId` points to the completing reservation.
- Admin impact metrics still count whole `REUSED` materials; partial depletion may need reservation-level impact later.

## Related Docs

- [Learner reservation flow](../flows/learner-reservation-flow.md)
- [Supplier reservation flow](../flows/supplier-reservation-flow.md)
- [Delivery](delivery.md) — delivery domain and learner request/status UI
