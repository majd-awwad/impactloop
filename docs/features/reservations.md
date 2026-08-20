# Reservations Feature

Current MVP status for material reservations.

**Sources inspected:** `apps/backend/prisma/schema.prisma`, `apps/backend/src/modules/reservations/*`, `apps/backend/src/modules/supplier-reservations/*`, `apps/backend/src/app.ts`, `apps/frontend/lib/features/reservations/*`, `apps/frontend/lib/features/material_discovery/**`, `apps/frontend/lib/features/supplier_portal/**`, `docs/flows/supplier-reservation-flow.md`, `docs/flows/learner-reservation-flow.md`, `docs/product/implementation-status.md`

## Intended Purpose

- Learner creates reservation → `PENDING` with `quantityRequested` and reserve-time `fulfillmentMethod` (`PICKUP` or `DELIVERY`). When both methods are available, the learner must explicitly choose one in the reservation dialog; the UI auto-selects only when the material supports exactly one receive method.
- Pickup reservations may store learner preferred pickup windows. When a preferred pickup window is provided, centralized pickup validation requires start/end in the future, end after start, start at least 30 minutes away (`MIN_PICKUP_LEAD_TIME_MINUTES`), and end at least 30 minutes away (`MIN_REMAINING_PICKUP_WINDOW_MINUTES`). Invalid provided windows fail before reservation creation with specific API error codes (`PICKUP_*`). Delivery reservations may store preferred delivery windows; delivery address text, drop-off city, safe drop-off preference, and optional delivery note remain part of the delivery reservation request. No `Delivery` row is created at reservation time.
- Supplier accepts or rejects pending reservations. Accept does **not** complete the reservation; it confirms or proposes scheduling and keeps the quantity hold. Only `PENDING` reservations can be accepted or declined.
- Pickup accept: supplier supplies pickup window. Selecting a learner preferred window → `ACCEPTED` with confirmed `pickupWindowStart/End` when at least 30 minutes remain, even if the window already started. Custom supplier proposals must pass the same pickup validation at accept time. Matching a learner preferred window → `ACCEPTED`, non-matching proposal → `AWAITING_LEARNER_CONFIRMATION` with `supplierProposedPickupWindowStart/End`.
- Delivery accept: supplier supplies driver pickup window from supplier only. Backend trims/confirms a delivery window using a 60-minute buffer after supplier pickup end. Feasible → `ACCEPTED`, stores supplier pickup + confirmed delivery windows, creates `Delivery` `WAITING_FOR_DRIVER`. Infeasible → `AWAITING_LEARNER_CONFIRMATION` with `schedulingConflictReason` (no delivery row).
- Multiple learners may hold different quantities from the same listing while stock remains.
- Same learner may hold only one active reservation per material. Active duplicate checks use held statuses, not terminal history, so `REJECTED`, `CANCELLED`, `EXPIRED`, and `COMPLETED` rows do not block backend re-reservation when stock remains.
- `material.quantity` is remaining physical stock; active holds are summed from open reservations.
- `availableQuantity = material.quantity - sum(quantityRequested for PENDING/AWAITING_LEARNER_CONFIRMATION/AWAITING_SUPPLIER_CONFIRMATION/ACCEPTED)`. `AWAITING_RESOLUTION` counts as held only when a related delivery has custody of the item.
- Material stays publicly `AVAILABLE` while `availableQuantity > 0`.
- Material becomes `REUSED` only when remaining quantity reaches `0` after completion/delivery.
- Learner may cancel while reservation is `PENDING` or `AWAITING_LEARNER_CONFIRMATION` (via cancel route or learner-confirmation `CANCEL` action).
- `PENDING` reservations expire automatically when the supplier does not respond within `PENDING_SUPPLIER_RESPONSE_HOURS` (48 hours) or when the last preferred pickup/delivery window ends, whichever comes first. Legacy rows without stored windows use the 48-hour response timeout only. Expiry releases the quantity hold and sets status `EXPIRED` (lazy on learner/supplier reads and material availability reads; no background cron in MVP).
- `ACCEPTED` self-pickup reservations whose confirmed `pickupWindowEnd` passes enter overdue follow-up (`isOverdue`, `needsFollowUp`). If neither learner nor supplier acts within `MISSED_PICKUP_AUTO_CLOSE_GRACE_HOURS` (72 hours) after `pickupWindowEnd`, the reservation lazy-expires to `EXPIRED` with `rejectionReason = PICKUP_WINDOW_MISSED`, releases the hold, and does **not** create strikes automatically.
- Learner resolves `AWAITING_LEARNER_CONFIRMATION` via `PATCH /api/reservations/:id/learner-confirmation`: accept proposed pickup, submit a new delivery window, or cancel.

Reservation is the booking layer. Learning Hub build checklist items can link reservations via optional `buildItemId` on `POST /api/reservations` (primary path) or `POST /api/learning-projects/:id/builds/me/items/:itemId/link-reservation` (repair path). Checklist readiness uses linked reservation `COMPLETED` status; manual checklist statuses remain separate.

## Current Code Status

| Layer | Status | Evidence |
|-------|--------|----------|
| Database `reservations` + `reservation_status_history` | **Implemented** | Schema incl. `quantityRequested`, reschedule/incident fields, `AWAITING_SUPPLIER_CONFIRMATION`, `AWAITING_RESOLUTION` |
| Learner `POST /api/reservations` | **Implemented** | Partial-quantity holds, fulfillment choice, preferred windows, per-learner open-reservation guard, optional `buildItemId` build-checklist linking |
| Learner `PATCH /api/reservations/:id/cancel` | **Implemented** | `PENDING` or `AWAITING_LEARNER_CONFIRMATION` cancel releases hold |
| Learner `PATCH /api/reservations/:id/learner-confirmation` | **Implemented** | Accept proposed pickup, submit delivery window, or cancel while awaiting confirmation |
| Learner follow-up APIs | **Implemented** | `request-reschedule`, `report-supplier-issue`, `report-no-driver`, reservation-scoped `messages` |
| Learner `GET /api/reservations/my` | **Implemented** | Scheduling fields, `selfPickupCode`, `pickupHandoverPhase`, follow-up flags, `pickupLocationFull` after accept/complete, `activeDelivery` |
| Material discovery/detail `availableQuantity` | **Implemented** | Public browse/detail DTO field |
| Learner reserve UI | **Implemented** | Material detail quantity + explicit pickup/delivery fulfillment dialog |
| Learner “My Reservations” UI | **Partial** | Rich list cards + `/learner/reservations/:id` detail route with 10-second polling; list cards link to detail |
| Supplier list/accept/decline/complete | **Partial** | Fulfillment-aware accept (pickup + delivery scheduling), paginated/filterable supplier list contract with canonical attention/action state, owner-scoped reservation detail read, `needs_learner` tab, handover-code complete, overdue close/report/reschedule, learner-reschedule accept, delivery handover code, incident reports including **`mark-delivery-pickup-expired` UI** |
| Delivery learner UI | **Partial** | Request/status/tracking summary + polling map marker on delivery detail; not on self-pickup reservation cards |
| Admin incident queue | **Implemented** | `/admin/no-show-reports` verify/reject/resolve |

**Overall:** **Partial**. Core booking, scheduling, handover codes, cancel/reschedule, lazy expiry, quantity accounting, incident reporting, delivery handoff, terminal-state re-reservation from Material Detail, and saved dropoff addresses are implemented. Remaining gaps are true idempotency keys, complete reservation-lifecycle notification coverage, reservation-related reviews, automated legacy quantity cleanup, manual/E2E coverage, and QR polish.

### Learner My Reservations filters

`/learner/reservations` keeps a compact seven-filter set: **All**, **Active**, **Needs action**, **Pending**, **Accepted**, **Completed**, and **Closed**. **Active** includes every non-terminal reservation status. **Needs action** is limited to learner-confirmation and returned learner-follow-up signals, while **Pending** contains the supplier/system-response states `PENDING` and `AWAITING_SUPPLIER_CONFIRMATION`. **Closed** groups `CANCELLED`, `REJECTED`, `EXPIRED`, `NO_SHOW`, and `FULFILLMENT_FAILED`; it is deliberately not labelled “Cancelled” because it contains more than cancellations.

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
| `reservations/presentation/pages/learner_reservations_page.dart` | Learner reservation list + card actions |
| `reservations/presentation/pages/learner_reservation_detail_page.dart` | Learner reservation detail route (`/learner/reservations/:id`) |
| `reservations/presentation/widgets/learner_awaiting_confirmation_panel.dart` | Awaiting-confirmation accept/submit/cancel |
| `reservations/presentation/widgets/learner_reservation_messages_panel.dart` | Reservation-scoped messages |
| `shared/widgets/handover_confirmation_code_panel.dart` | Self-pickup / delivery handover code display |
| `material_discovery/.../material_details_page.dart` | Reserve button entry point; post-success and existing-reservation links to My Reservations |
| `supplier_portal/.../supplier_incoming_requests_page.dart` | Supplier inbox |
| `supplier_portal/data/supplier_requests_api.dart` | Supplier API client |
| `home/.../learner_home_page.dart` | Links to My Reservations |

### Database

- `reservations`, `reservation_status_history`
- Enums: `ReservationStatus`, `ReservationStatusGroup`, `ReservationFulfillmentMethod`
- Related: `materials.status`, `materials.reused_at`, `materials.reused_by_reservation_id`
- Delivery domain: `deliveries`, `driver_profiles`, `delivery_assignments`, `delivery_status_history`, `delivery_location_pings`
- Operational delivery state lives in `deliveries`; older reservation delivery fields were removed by migration.

## Status Transitions

- `material.quantity` = remaining physical stock (decremented on supplier complete or driver `DELIVERED`).
- Holds = sum of `quantityRequested` for `PENDING` + `AWAITING_LEARNER_CONFIRMATION` + `AWAITING_SUPPLIER_CONFIRMATION` + `ACCEPTED` reservations. `AWAITING_RESOLUTION` is held only for delivery rows where the driver has custody.
- `availableQuantity = material.quantity - holds` (also exposed on material list/detail APIs).
- Create hold: validates against `availableQuantity`; keeps material `AVAILABLE` when stock remains; may set `PENDING_RESERVATION` / `RESERVED` only when all stock is held.
- Cancel / decline / reject: releases hold and recomputes material status; does not decrement `material.quantity`.
- Accept: keeps hold; does not decrement `material.quantity`.
- Complete / `DELIVERED`: subtract `quantityRequested`, recompute status; `REUSED` only when quantity reaches `0`.

`COMPLETED` reservations are excluded from holds because quantity was already subtracted.

Backend re-reservation after terminal states is allowed by the active-hold guard. Material Detail now treats `REJECTED`, `CANCELLED`, `EXPIRED`, and `COMPLETED` learner reservation history as non-blocking for the reserve CTA, while all other reservation statuses still block duplicate attempts. The normal material-level checks still apply, including current status, available quantity, fulfillment options, current user/role, own-material checks, backend `canReserve`, and submission state.

## What Is Missing

Verified against code (2026-07-10):

- Reservation create has duplicate active-reservation protection, but no idempotency key or retry-safe "same request returns same reservation" behavior.
- Supplier notification coverage now persists canonical event rows for reservation request/cancel/expiry and delivery recovery reschedule requests. Supplier inbox reads revalidate the current reservation state and fail closed when the target is missing. Other learner/driver lifecycle gaps remain outside the Supplier Notifications contract.
- Reservation-related reviews after completion are not implemented beyond the `Review` table and dashboard aggregation hooks.
- Live delivery tracking stream, ETA, delivery cancellation/retry, and payment remain delivery-domain gaps.
- Automated cleanup/backfill for stale legacy reservation quantities is not implemented; use the manual cleanup guidance below for shared dev databases.
- Manual regression documentation and end-to-end/widget coverage for the full learner/supplier lifecycle are still incomplete.
- QR polish is deferred.

## Already implemented (do not re-build)

- Learner cancel while `PENDING` or `AWAITING_LEARNER_CONFIRMATION`.
- Partial-quantity holds and reserve-time pickup/delivery fulfillment choice.
- Handover confirmation codes (learner self-pickup code, supplier→driver handover code, code-required supplier complete).
- Phase-based overdue pickup follow-up (±30 min handover window) for supplier and learner reschedule/report actions.
- Reservation-scoped messages, incident reports, and admin `/admin/no-show-reports` queue.
- Learner delivery request + `/learner/deliveries/:id` status/tracking summary.
- Dedicated learner reservation detail route (`/learner/reservations/:id`).
- Lazy `PENDING` and missed-pickup expiry on learner/supplier/material read paths.
- Supplier `mark-delivery-pickup-expired` UI.
- Self-pickup map on learner reservation cards when accepted pickup location coordinates are available.
- Generic persisted notifications API and Flutter notifications page.
- Saved learner dropoff addresses.
- Learning Hub build checklist reservation linking and already-owned markers.

## Location privacy (MVP)

- Public material discovery (`GET /api/materials`, `GET /api/materials/:id`) exposes only approximate `city` and `area`.
- `GET /api/reservations/my` keeps the same approximate material fields for all statuses.
- `activeDelivery` is included on learner reservation list items so the UI can hide self-pickup instructions when delivery is in progress.
- `pickupLocationFull` (country, city, area, address line, coordinates, `isApproximate`) is returned only for learner-owned reservations in `ACCEPTED` or `COMPLETED` status; it is `null` for `PENDING`, `AWAITING_LEARNER_CONFIRMATION`, `REJECTED`, `CANCELLED`, and `EXPIRED`. The My Reservations UI shows the pickup address + map panel for accepted self-pickup reservations without `activeDelivery` when coordinates are present.
- Delivery route exact pickup/dropoff locations remain on learner-owned or assigned-driver delivery APIs only.

## Legacy data and dev DB cleanup

This branch changes **forward** stock semantics only. It does not backfill historical completions.

| Existing row state | Risk after deploy |
|--------------------|-------------------|
| `COMPLETED` reservations where `material.quantity` was never decremented | `availableQuantity` overstates stock; learners may reserve already-delivered quantity |
| `REUSED` materials with `quantity > 0` (common in old seeds) | Hidden from discovery; Admin Impact Analytics no longer estimates CO₂e from leftover listing quantity |

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
