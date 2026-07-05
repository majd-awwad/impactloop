# Database Schema Overview

**Source of truth:** `apps/backend/prisma/schema.prisma` and `apps/backend/prisma/migrations/`.

**Stale doc:** [03-database.md](../03-database.md) describes a 34-table baseline and tables not in the current schema. Use this file and [tables-catalog.md](tables-catalog.md) instead.

## Summary

| Metric | Value | Source |
|--------|-------|--------|
| Prisma models | 35 | `schema.prisma` (`^model ` count) |
| PostgreSQL tables | 35 | `@@map(...)` on each model |
| Enums | 33 | [enums.md](enums.md) |
| PostGIS | Yes | `Location.location` — `Unsupported("geography(Point,4326)")`; enabled in migration `20260614145408_add_auth_schema` |

## Domain groups

### Identity and access

```
User ──┬── UserRoleAssignment (many roles per user, @@unique [userId, role])
       ├── AuthToken
       ├── IdempotencyRecord
       ├── LearnerProfile (0..1)
       ├── SupplierProfile (0..1)
       ├── DriverProfile (0..1)
       └── RoleInvitation (invited / used relations)
```

**Inspected:** `User`, `UserRoleAssignment`, `AuthToken`, `IdempotencyRecord`, `RoleInvitation`, `LearnerProfile`, `SupplierProfile`, `DriverProfile`

### Locations

```
Location ←── SupplierProfile.defaultPickupLocation
         ←── OrganizationProfile.businessLocation
         ←── Material.location
         ←── UserSavedLocation.location
         ←── Reservation.dropoffLocation
         ←── Delivery.pickupLocation / dropoffLocation
User ←── UserSavedLocation.user
```

PostGIS column `locations.location` stores geography point; lat/long also stored as decimals.
`user_saved_locations` stores private saved-location labels/default flags for authenticated users.

### Taxonomy and listing policy

```
Category (self-referential parent/children)
    ├── Material
    ├── LearningProject
    ├── MaterialType
    ├── ProjectRequiredComponent (optional category)
    ├── CategoryRequest.approvedCategory
    └── PriceRuleRequest.category

MaterialType ──┬── MaterialTypeAlias
               ├── MaterialPriceRule
               ├── Material.approvedMaterialType
               └── PriceRuleRequest
```

### Materials and discovery

```
Material ──┬── MaterialImage
           ├── MaterialTag
           ├── MaterialReport
           ├── Reservation (many)
           ├── publishedFromCategoryRequest (CategoryRequest)
           └── publishedFromPriceRuleRequest (PriceRuleRequest)

Material.reusedByReservationId → Reservation (material becomes REUSED)
```

### Reservations and delivery

```
Reservation ──┬── ReservationStatusHistory
              ├── Review
              ├── Material (FK)
              ├── requester / owner → User
              ├── legacy dropoffLocation → Location
              └── Delivery (many attempts)

Delivery ──┬── DeliveryAssignment
           ├── DeliveryStatusHistory
           ├── DeliveryLocationPing
           ├── pickup/dropoff Location snapshots
           └── assigned DriverProfile
```

Legacy reservation delivery fields still exist for compatibility: `deliveryRequested`, `deliveryStatus`, `deliveryCost`, `dropoffLocationId`, `driverProfileId`. New delivery code uses `deliveries` as the source of truth. `driverProfileId` on `Reservation` remains a nullable string legacy field; `Delivery.assignedDriverProfileId` is the real relation.

### Learning hub

```
LearningProject ──┬── ProjectImage
                  ├── ProjectRequiredComponent
                  ├── ProjectStep
                  ├── ProjectLink
                  └── ProjectTag
```

### Reviews and notifications

```
Review → Reservation, User (reviewer, reviewedUser)
MaterialReport → Material, User (reporter, reviewedBy)
Notification → User (generic table; no REST module in apps/backend/src/modules/)
```

### Supplier requests and AI price lookup

```
CategoryRequest → User, Category?, Material? (published)
PriceRuleRequest → User?, MaterialType?, Category?, Material? (published)
AiPriceLookupLog (standalone audit of price AI lookups)
```

### Idempotency

```
IdempotencyRecord → User
```

`idempotency_records` stores per-user operation keys, request hashes, status (`IN_PROGRESS`, `SUCCEEDED`, `FAILED`), optional resource metadata, and successful response JSON. The unique `(userId, scope, key)` constraint is used by supplier material create and Learning Hub project submit to prevent duplicate inserts for repeated `Idempotency-Key` submissions.

## Tables in schema vs older docs

Tables listed in [03-database.md](../03-database.md) but **absent** from current `schema.prisma`:

`student_profiles`, `admin_profiles`, `material_pickup_windows`, `delivery_location_updates`, `project_ai_suggestions`, `ai_requests`, `ai_material_matches`, `ai_credit_wallets`, `ai_usage_logs`, `reports`, `impact_logs`, `impact_summaries`, and removed MVP tables (delivery partners, favorites, etc.)

## Migration history (chronological)

**Inspected:** `apps/backend/prisma/migrations/*/migration.sql` folder names

| Migration folder | Theme |
|------------------|--------|
| `20260614145408_add_auth_schema` | PostGIS, users, roles, auth, profiles, locations |
| `20260614160000_add_refresh_token_type` | `REFRESH_TOKEN` on `AuthTokenType` |
| `20260616120000_add_supplier_domain_tables` | Supplier domain tables |
| `20260616230216_add_material_discovery_read_models` | Materials discovery |
| `20260617083306_add_material_taxonomy_price_rules` | Material taxonomy |
| `20260617120300_refine_material_taxonomy_price_rules` | Taxonomy refinements |
| `20260617153000_add_material_type_request_ai_result_json` | AI result JSON on requests |
| `20260617160000_add_reservation_status_history` | Reservation status history |
| `20260617171825_add_learning_projects_read_models` | Learning projects |
| `20260618095255_add_listing_drafts_split_review_requests` | Listing drafts / review requests |
| `20260619120000_simplify_category_requests_with_listing_draft_json` | Category request drafts |
| `20260619143000_extend_price_rule_requests_drop_material_type_requests` | Price rule request changes |
| `20260619180000_add_price_rule_request_listing_draft_json` | Price rule listing drafts |
| `20260619190000_add_request_published_material_tracking` | Published material tracking |
| `20260625120000_add_internal_delivery_domain` | Driver profiles, deliveries, assignment/history/location pings |
| `20260625123000_add_delivery_active_invariant_indexes` | Partial unique indexes for active delivery invariants |
| `20260627120000_add_idempotency_records` | Generic idempotency records for safe create retries |
| `20260704120000_add_user_saved_locations` | Private saved locations and PostGIS location index |

## Design rules (still valid from code)

- No `delivery_requests` table — delivery attempts live in `deliveries`.
- Legacy reservation delivery columns remain but are deprecated compatibility fields.
- No `users.role` column — use `user_roles`.
- `role_invitations.token_hash` — not raw tokens.
- `auth_tokens` for OTP, reset, refresh (hashed).
- Impact/reuse tracking via `materials.reused_at`, `materials.status`, `reservations.completed_at` — **no** `impact_logs` table in schema.
