# Open Questions

Consolidated unresolved questions from Phase 2A/2B feature and flow docs, plus code inspection. **Not implementation proof** — verify against code before acting.

**Sources inspected:** `docs/features/*.md`, `docs/flows/*.md`, `docs/08-implementation-status.md`, `docs/backend/api-catalog.md`, `docs/frontend/routes-map.md`, `docs/database/tables-catalog.md`, `AGENTS.md`

Status key: items marked **Needs verification** lack a single confirmed answer in checked-in code/docs.

---

## Auth and sessions

| Question | Status | Source |
|----------|--------|--------|
| Is `account_status = PENDING_VERIFICATION` enforced on login? | **Needs verification** | [auth-flow](flows/auth-flow.md), [auth](features/auth.md) |
| Web session: `WebCookieTokenStorage` no-op — is refresh cookie-only on all Flutter web targets? | **Needs verification** | [auth](features/auth.md), `apps/frontend/lib/core/auth/` |
| Does register always create a `locations` row for supplier `pickupArea`? | **Needs verification** | [auth-flow](flows/auth-flow.md), `auth.repository.ts` |
| Duplicate email on register — exact HTTP code/message mapping in Flutter? | **Needs verification** | [auth-flow](flows/auth-flow.md) |
| Change password — does it revoke existing refresh sessions? | **Needs verification** | [auth-flow](flows/auth-flow.md) |
| Which widget calls `bootstrapSession` after `/auth/checking`? | **Needs verification** | [auth-flow](flows/auth-flow.md), `app_router.dart` |
| Email/phone verification vs `account_status` gate | **Needs verification** | [auth](features/auth.md) |

---

## Invitations

| Question | Status | Source |
|----------|--------|--------|
| Production distribution of `inviteToken` without email service? | Open | [invitation-flow](flows/invitation-flow.md) |
| Should `GET /api/invitations/validate/:token` be rate-limited against token guessing? | Open | [invitation-flow](flows/invitation-flow.md) |
| Profile onboarding for DRIVER/MODERATOR/ADMIN after accept? | Open | [invitation-flow](flows/invitation-flow.md) |
| Production value of `env.invitationExpiresIn` | **Needs verification** | [invitations](features/invitations.md), `apps/backend/src/config/env.ts` |

---

## Materials, listing, and discovery

| Question | Status | Source |
|----------|--------|--------|
| Exact `CreateMaterialRequest` / supplier create payload and required location fields? | **Resolved** — `useDefaultPickupLocation` + optional `pickupLocation`; profile default still required | [supplier-material-listing-flow](flows/supplier-material-listing-flow.md), `supplier.validation.ts` |
| Inline `locations` row creation on material create vs profile-only? | **Resolved** — each create copies or creates a dedicated material `locations` row | [supplier-material-listing-flow](flows/supplier-material-listing-flow.md), `supplier.service.ts` |
| When does price-rule AI write to `ai_price_lookup_logs`? | **Needs verification** | [materials-listing](features/materials-listing.md), `ai-price-lookup.repository.ts` |
| Organization supplier: required `organization_profiles` fields on create? | Open | [supplier-material-listing-flow](flows/supplier-material-listing-flow.md) |
| `POST /api/price-rule-requests` — should route require `SUPPLIER` role? | **Needs verification** | [api-catalog](backend/api-catalog.md), [materials-listing](features/materials-listing.md) |
| Which location fields are on public material DTOs — consistent redaction on list and detail? | **Partially resolved** — list/detail return `city`/`area` only; `visibility` enforcement still open | [material-discovery-flow](flows/material-discovery-flow.md), [locations](features/locations.md) |
| Is discovery pagination exposed in Flutter UI? | **Needs verification** | [material-discovery-flow](flows/material-discovery-flow.md), [material-discovery](features/material-discovery.md) |
| Does material detail increment `materials.views_count`? | **Needs verification** | [material-discovery-flow](flows/material-discovery-flow.md) |
| Server-side filter parity with client-side discovery chips? | **Needs verification** | [material-discovery](features/material-discovery.md) |
| Network error UI path on discovery page | **Needs verification** | [material-discovery-flow](flows/material-discovery-flow.md) |
| Single-item 404 when material not publicly visible | **Needs verification** | [material-discovery-flow](flows/material-discovery-flow.md) |

---

## Locations and privacy

| Question | Status | Source |
|----------|--------|--------|
| Are all public API paths consistent on omitting lat/lng/address? | **Needs verification** | [locations](features/locations.md), `materials.service.ts` |
| Is `visibility` / `ORDER_ONLY` enforced beyond storage? | **Needs verification** | [locations](features/locations.md), `supplier.validation.ts` |
| When should precise location reveal to learner after accepted reservation? | Open — precise pickup reveal **not implemented** | [locations](features/locations.md), [reservations](features/reservations.md) |

---

## Reservations

| Question | Status | Source |
|----------|--------|--------|
| Should learner reservation create be idempotent for same learner/material after rejected/cancelled/expired history? | Open — MVP rejects active duplicates only | [learner-reservation-flow](flows/learner-reservation-flow.md) |
| Should future inventory support partial allocation instead of whole-material hold? | Open — MVP exclusive reservation only | [learner-reservation-flow](flows/learner-reservation-flow.md) |
| Notification generation on reservation state changes? | Open | [supplier-reservation-flow](flows/supplier-reservation-flow.md) |
| Pickup window validation schema — exact rules? | **Needs verification** | [supplier-reservation-flow](flows/supplier-reservation-flow.md) |
| Cancel/expiry flows for reservations? | **Not implemented** | [supplier-reservation-flow](flows/supplier-reservation-flow.md) |

---

## Learning hub

| Question | Status | Source |
|----------|--------|--------|
| Target Flutter repository pattern (`LearningHubRepository` vs feature data layer)? | Open | [learning-hub-browse-flow](flows/learning-hub-browse-flow.md) |
| Map API `difficulty` enum to localized labels? | Open | [learning-hub-browse-flow](flows/learning-hub-browse-flow.md) |
| Gate or remove mock data during API integration? | Open | [learning-hub-browse-flow](flows/learning-hub-browse-flow.md) |
| Will ratings come from API or remain mock? | Open | [learning-hub](features/learning-hub.md) |

---

## Home, landing, and navigation

| Question | Status | Source |
|----------|--------|--------|
| Intended learner → supplier path (home “Become a supplier” disabled)? | **Needs verification** | [home-learner](features/home-learner.md) |
| Dual-role users: always land on `/supplier` when SUPPLIER present? | **Needs verification** | [routes-map](frontend/routes-map.md) |
| Landing feature cards link to `/register` not `/materials` — intentional? | Documented | [landing](features/landing.md) |

---

## Delivery, driver, AI agent (not implemented)

| Question | Status | Source |
|----------|--------|--------|
| Driver profile model — `reservations.driver_profile_id` has no `DriverProfile` table? | **Needs verification** | [tables-catalog](database/tables-catalog.md), `schema.prisma` |
| Delivery cost calculation and who sets `delivery_cost`? | Open — **not implemented** | [delivery](features/delivery.md) |
| AI material matching credit model — roadmap tables not in schema | **Not implemented** | [ai-agent](features/ai-agent.md), `05-roadmap.md` |

---

## Admin and moderator (not implemented)

| Question | Status | Source |
|----------|--------|--------|
| How are `category_requests` / `price_rule_requests` approved without moderator API? | Open (seed/manual DB?) | [moderator](features/moderator.md) |
| Admin invitation create only — other admin capabilities deferred? | Documented | [admin](features/admin.md) |

---

## Phase 2C stub-flow questions

From [learner-reservation-flow](flows/learner-reservation-flow.md), [delivery-flow](flows/delivery-flow.md), [ai-material-matching-flow](flows/ai-material-matching-flow.md).

| Question | Status | Source |
|----------|--------|--------|
| Learner reservation create: should repeated reserve attempts be idempotent? | Open | [learner-reservation-flow](flows/learner-reservation-flow.md) |
| Learner reservation cancel: can learners cancel before supplier acceptance? | Open | [learner-reservation-flow](flows/learner-reservation-flow.md) |
| Reservation entry point: should reservations start from Material Discovery only, Learning Hub, or both? | Open | [learner-reservation-flow](flows/learner-reservation-flow.md) |
| Delivery completion: should pickup/delivery completion use the same supplier reservation complete endpoint or separate driver endpoints? | Open | [delivery-flow](flows/delivery-flow.md) |
| AI matching credits: is AI material matching one-shot, conversational, or both? | Open | [ai-material-matching-flow](flows/ai-material-matching-flow.md) |
| AI matching credits: what wallet/free-credit rules apply? | Open | [ai-material-matching-flow](flows/ai-material-matching-flow.md) |

---

## Testing and tooling

| Question | Status | Source |
|----------|--------|--------|
| Flutter test coverage beyond isolated model tests? | **Needs verification** | [08-implementation-status](08-implementation-status.md) |
| Supplier notifications — exact query derivation | **Needs verification** | [backend/modules-map](backend/modules-map.md) |

---

## How to use this file

1. When closing a question, update the relevant feature/flow doc and remove or strike the row here.
2. Do not treat aspirational answers from [01-requirements.md](01-requirements.md) or [05-roadmap.md](05-roadmap.md) as shipped behavior.
3. Link new gap docs: [reservations](features/reservations.md), [delivery](features/delivery.md), [ai-agent](features/ai-agent.md), [admin](features/admin.md), [moderator](features/moderator.md).
