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
| Post-accept workspace completeness for DRIVER/MODERATOR/ADMIN? | Partial — driver/admin have partial portals; moderator has no portal | [invitation-flow](flows/invitation-flow.md), [roles-and-capabilities](features/roles-and-capabilities.md) |
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
| Which location fields are on public material DTOs — consistent redaction on list and detail? | **Resolved for discovery list/detail** — `GET /api/materials` returns `city`/`area` plus optional privacy-safe approximate pins/distance; `GET /api/materials/:id` returns `city`/`area` only. Both omit exact `addressLine`, exact latitude/longitude, location object, supplier private location object, and `pickupNotes`; broader non-material public API visibility enforcement remains tracked under Locations | [material-discovery-flow](flows/material-discovery-flow.md), [locations](features/locations.md) |
| Is discovery pagination exposed in Flutter UI? | **Resolved** — Load more increments `MaterialDiscoveryQuery.page` and appends results | [material-discovery-flow](flows/material-discovery-flow.md), [material-discovery](features/material-discovery.md) |
| Does material detail increment `materials.views_count`? | **Resolved** — yes on successful `GET /api/materials/:id`; authenticated viewers count once per user/material, guests count per request; also writes `material_views`; exposed as `viewsCount` in public DTO | [material-discovery-flow](flows/material-discovery-flow.md) |
| Server-side filter parity with client-side discovery chips? | **Resolved for current discovery UI** — UI query maps to repository/API params including category, condition, status, price, delivery/pickup, city/area, sort, page, and limit | [material-discovery](features/material-discovery.md) |
| Is nearest-first material discovery implemented? | **Resolved** — `sort=nearest` accepts viewer `latitude`/`longitude` or authenticated `savedLocationId`; distance is computed server-side and only `approximateDistanceKm`/approximate list pins are returned | [material-discovery](features/material-discovery.md), [locations](features/locations.md) |
| Network error UI path on discovery page | **Resolved** — initial failures show centered retry; refetch failures keep cached results with inline retry | [material-discovery-flow](flows/material-discovery-flow.md) |
| Single-item 404 when material not publicly visible | **Resolved** — detail maps 404/not public to “Material not found” with back action | [material-discovery-flow](flows/material-discovery-flow.md) |

---

## Locations and privacy

| Question | Status | Source |
|----------|--------|--------|
| Are all public API paths consistent on omitting lat/lng/address? | **Needs verification** — public Materials Discovery list/detail verified; non-material public API paths still need separate review | [locations](features/locations.md), `materials.service.ts` |
| Is `visibility` / `ORDER_ONLY` enforced beyond storage? | **Needs verification** | [locations](features/locations.md), `supplier.validation.ts` |
| Are authenticated saved locations implemented? | **Resolved** — backend `GET/POST/PATCH/DELETE /api/locations/saved`; Flutter `/profile/locations` manages saved locations and Materials Discovery reads them for nearest sort selection | [locations](features/locations.md), [material-discovery](features/material-discovery.md) |
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
| Target Flutter repository pattern (`LearningHubRepository` + Riverpod providers)? | **Resolved** — `ApiLearningHubRepository`, `learning_hub_providers.dart`, override in `main.dart` | [learning-hub](features/learning-hub.md), [state-management](frontend/state-management.md) |
| Map API `difficulty` enum to localized labels? | **Resolved** — `LearningHubApiMapper.mapDifficultyLabel` | [learning-hub](features/learning-hub.md) |
| Remove mock data from list/detail/home spotlight? | **Resolved** — API-backed; mock file retained for disabled AI copy and unused sample catalog only | [learning-hub-browse-flow](flows/learning-hub-browse-flow.md) |
| Show fake ratings on API-backed pages? | **Resolved** — hidden when `ratingSummary` is null; backend currently always null | [learning-hub](features/learning-hub.md) |
| Project submission/admin review workflow (draft → pending → published)? | **Resolved** — learner submit creates `PENDING_REVIEW`; `/admin/learning-projects` moderation can approve/request changes/reject/hide/restore/archive. Moderator-owned review remains not implemented. | [learning-hub-browse-flow](flows/learning-hub-browse-flow.md), `learning-projects.routes.ts`, `admin.routes.ts`, `admin-learning-projects.*` |
| Learning project ratings/reviews model and API? | **Not implemented** — `reviews` table is reservation-scoped; no PROJECT target type | [learning-hub](features/learning-hub.md) |
| AI material matching for project components? | **Not implemented** | [ai-agent](features/ai-agent.md) |
| Open external project links in browser (`url_launcher`)? | **Resolved** — detail links open safe `http`/`https` URLs; invalid/missing URLs render disabled | [learning-hub](features/learning-hub.md) |
| Expose Hub search (`q`), difficulty, tag filters, or server pagination in UI? | **Partially resolved** — search, difficulty, and tag filters are wired; server `page > 1` navigation is still not exposed | [learning-hub-browse-flow](flows/learning-hub-browse-flow.md) |

---

## Home, landing, and navigation

| Question | Status | Source |
|----------|--------|--------|
| Intended learner → supplier path (home “Become a supplier” disabled)? | **Resolved** — active CTA via `supplierEntryRouteForUser` | [home-learner](features/home-learner.md) |
| Dual-role users: always land on `/supplier` when SUPPLIER present? | **Needs verification** | [routes-map](frontend/routes-map.md) |
| Landing feature cards link to `/register` not `/materials` — intentional? | Documented | [landing](features/landing.md) |

---

## Delivery, driver, AI agent (not implemented)

| Question | Status | Source |
|----------|--------|--------|
| Driver profile model — `reservations.driver_profile_id` has no `DriverProfile` table? | **Resolved** — `DriverProfile` exists; `reservations.driver_profile_id` is legacy compatibility, `deliveries.assigned_driver_profile_id` is the real relation | [tables-catalog](database/tables-catalog.md), `schema.prisma` |
| Delivery cost calculation and who sets `delivery_cost`? | Open — **not implemented** | [delivery](features/delivery.md) |
| AI material matching credit model — roadmap tables not in schema | **Not implemented** | [ai-agent](features/ai-agent.md), `05-roadmap.md` |

---

## Admin and moderator

| Question | Status | Source |
|----------|--------|--------|
| Should category/price/material report review remain admin-only, or should moderator share those queues? | Open | [admin](features/admin.md), [moderator](features/moderator.md) |
| What moderator portal should be built first? | Open | [moderator](features/moderator.md), [roles-and-capabilities](features/roles-and-capabilities.md) |
| Should future sensitive admin actions require a `SUPER_ADMIN` role or another policy? | Open | [admin](features/admin.md) |

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
