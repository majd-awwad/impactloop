# Delivery Feature (Gap Doc)

**Gap / stub — not an implementation guide.**

**Sources inspected:** `apps/backend/prisma/schema.prisma` (`Reservation` delivery fields, `DeliveryStatus`, `PickupType`, `Material.deliveryAllowed`), `apps/backend/src/modules/supplier-reservations/supplier-reservations.service.ts` (`mapPickupPreference`), `apps/backend/src/app.ts`, `apps/frontend/lib/features/home/presentation/pages/learner_home_page.dart`, `docs/01-requirements.md` (§Delivery), `docs/05-roadmap.md` (Phase 6), `AGENTS.md`, `docs/08-implementation-status.md`

## Intended purpose (requirements / roadmap — aspirational)

From [01-requirements.md](01-requirements.md) and [05-roadmap.md](05-roadmap.md) Phase 6:

- No `delivery_requests` table — delivery lives on `reservations`.
- Learner requests delivery after reservation accepted.
- Driver sees reservations with `delivery_requested = true` and `delivery_status = WAITING_FOR_DRIVER`.
- Status flow: `WAITING_FOR_DRIVER` → `DRIVER_ASSIGNED` → `PICKED_UP` → `ON_THE_WAY` → `DELIVERED` (or `CANCELLED` / `FAILED_PICKUP`).
- Delivered completes reservation and marks material `REUSED`.

## Current code status

| Layer | Status | Evidence |
|-------|--------|----------|
| Schema: `delivery_requested`, `delivery_status`, `delivery_cost`, `dropoff_location_id`, `driver_profile_id` | **Schema-only** | `schema.prisma` — no `DriverProfile` model |
| `DeliveryStatus` enum | **Schema-only** | Defined; not updated by application code found |
| `materials.delivery_allowed` | **Partial** | Set on supplier create; no delivery workflow consumes it |
| Delivery API (learner request, driver assign, status updates) | **Not implemented** | No module in `app.ts` |
| Driver portal / Flutter `driver` feature | **Not implemented** | No `features/driver` folder |
| Supplier UI for delivery fields | **Not implemented** | Supplier maps `deliveryRequested` to display string only |
| Home “Delivery tracking” | **Frontend-only** placeholder | `learner_home_page.dart` |

**Overall:** **Schema-only** with **Partial** material flag; workflow **not implemented**.

## Existing related files

| Path | Role |
|------|------|
| `schema.prisma` | `Reservation` delivery columns; `DeliveryStatus` enum |
| `supplier-reservations.service.ts` | `deliveryRequested` in DTO mapping (“Delivery requested” label) |
| `supplier.validation.ts` | `deliveryAllowed` on material create input |
| `docs/database/tables-catalog.md` | Documents `driverProfileId` — **Needs verification** (no `DriverProfile` model) |

No `modules/delivery` or `modules/driver` folder.

## What is missing

- Learner API to set `delivery_requested` + dropoff location after accept.
- Driver authentication portal and role-gated routes.
- Driver accept/assign/pickup/deliver API updating `delivery_status` and history.
- Internal delivery cost rules and `delivery_cost` calculation.
- Flutter UI for learner tracking and driver workflow.
- Post-delivery material `REUSED` path distinct from self-pickup complete.
- Location privacy rules for driver vs public (see [locations](locations.md)).

## Risks

- `driver_profile_id` FK target unclear without `DriverProfile` model — migration/schema drift risk.
- Building delivery before learner reservations leaves no valid entry point.
- AGENTS.md: internal delivery only — external partners out of scope; still needs clear assignment model.

## Questions before implementation

- Resolve `DriverProfile` vs `users` + `DRIVER` role representation.
- Can supplier complete pickup and delivery both use same `complete` endpoint?
- Who can transition each `DeliveryStatus` — driver only or supplier too?
- See [09-open-questions.md](../09-open-questions.md) § Delivery.

## Related docs

- [Delivery flow](../flows/delivery-flow.md) — planned stub
- [Reservations](reservations.md) — parent entity
- [Invitations](invitations.md) — DRIVER role via invitation API only
