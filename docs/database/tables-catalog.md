# Database Tables Catalog

Per-table reference from `apps/backend/prisma/schema.prisma`. Column names shown as Prisma field names; physical names use `@@map` / `@map` where defined.

**Source:** `schema.prisma`  
**Supersedes:** table list in [03-database.md](../03-database.md) (stale / aspirational)

---

## `users` — model `User`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| displayName | String | |
| email | String | unique |
| phone | String? | unique |
| passwordHash | String | |
| accountStatus | AccountStatus | default `PENDING_VERIFICATION` |
| profileImageUrl | String? | |
| emailVerifiedAt, phoneVerifiedAt, lastLoginAt | DateTime? | |
| activeRole | UserRole? | Current portal selection (`LEARNER`, `SUPPLIER`, etc.); does not remove stored roles |
| createdAt, updatedAt | DateTime | |

Relations: roles, authTokens, idempotencyRecords, learnerProfile, supplierProfile, materials, reservations, notifications, reviews, material reports, learning projects, project likes/saves/follows/reviews, requests.

---

## `user_roles` — model `UserRoleAssignment`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → users |
| role | UserRole | |
| isPrimary | Boolean | default false |
| assignedBy | String? | FK → users |

**Unique:** `(userId, role)`

---

## `auth_tokens` — model `AuthToken`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → users |
| tokenHash | String | unique — not raw token |
| tokenType | AuthTokenType | |
| target | String | |
| expiresAt | DateTime | |
| usedAt | DateTime? | |

---

## `role_invitations` — model `RoleInvitation`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| targetEmail, targetPhone | String? | |
| targetRole | RoleInvitationTargetRole | |
| tokenHash | String | unique |
| invitedBy | String? | FK → users |
| status | RoleInvitationStatus | default `PENDING` |
| sendStatus | RoleInvitationSendStatus | default `PENDING` |
| sentAt | DateTime? | |
| sendError | String? | |
| providerMessageId | String? | |
| revokedAt | DateTime? | |
| expiresAt | DateTime | |
| usedAt | DateTime? | |
| usedByUserId | String? | FK → users |
| notes | String? | |

---

## `learner_profiles` — model `LearnerProfile`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | unique FK → users |
| learnerType, bio, skillLevel | String? | |
| interests | String[] | default `[]` |

---

## `supplier_profiles` — model `SupplierProfile`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | unique FK → users |
| supplierType, publicName, description | String? | |
| verificationStatus | String | default `UNVERIFIED` |
| verificationSubmittedAt | DateTime? | |
| verificationReviewedAt | DateTime? | |
| verificationReviewedById | String? | FK → users |
| verificationAdminNote | String? | |
| defaultPickupLocationId | String? | FK → locations |

Relations: organizationProfile, materials.

---

## `driver_profiles` — model `DriverProfile`

Unified invitation signup + internal delivery operations.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | unique FK → users |
| displayName | String | |
| phone | String | required at invitation accept |
| city, area | String | signup address |
| addressLine | String? | |
| transportationType | TransportationType | signup enum (`CAR`, `MOTORCYCLE`, `BICYCLE`, `WALKING`) |
| availabilityNote | String? | signup note |
| status | DriverProfileStatus | default `ACTIVE` |
| availability | DriverAvailabilityStatus | default `OFFLINE` |
| vehicleType | String | default `UNSPECIFIED`; mapped from `transportationType` at signup |
| vehicleLabel, vehiclePlate, capacityNotes | String? | operational metadata |
| createdAt, updatedAt | DateTime | |

Relations: assigned deliveries, assignments, location pings.

---

## `organization_profiles` — model `OrganizationProfile`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| supplierProfileId | String | unique FK → supplier_profiles |
| organizationName | String | |
| organizationType | OrganizationType | |
| contactPersonName | String? | |
| workingDays, workingHours | Json? | |
| businessLocationId | String? | FK → locations |
| verificationDocumentStatus | VerificationDocumentStatus? | |
| verificationDocumentUrl | String? | |
| verificationDocumentName | String? | |

---

## `locations` — model `Location`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| country, city | String | |
| area, addressLine | String? | |
| latitude, longitude | Decimal? | |
| location | geography(Point,4326) | PostGIS — Prisma `Unsupported` type |
| locationType | String? | |
| visibility | String? | default `PRIVATE` |
| isApproximate | Boolean | default true |

---

## `user_saved_locations` — model `UserSavedLocation`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → users; cascade delete |
| locationId | String | FK → locations; cascade delete |
| label | String | User-facing private label |
| isDefault | Boolean | default false |
| createdAt, updatedAt | DateTime | |

Indexes: `userId`, `(userId, isDefault)`, `locationId`.

---

## `categories` — model `Category`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| nameEn, nameAr | String | |
| parentId | String? | self-FK |
| categoryType | CategoryType | |
| iconUrl | String? | |
| isActive | Boolean | default true |

---

## `learning_projects` — model `LearningProject`

| Field | Type | Notes |
|-------|------|-------|
| id | String (uuid) | PK |
| categoryId | String | FK → categories |
| createdBy | String | FK → users |
| title, shortDescription, description | String | |
| difficulty | ProjectDifficulty | |
| estimatedDurationMinutes | Int? | |
| coverImageUrl | String? | |
| status | LearningProjectStatus | default `DRAFT` |
| reviewedBy | String? | FK → users |
| reviewNote | String? | |
| stepsGeneratedByAi | Boolean | default false |
| aiStepsGeneratedAt | DateTime? | |

Child tables: project_images, project_required_components, project_steps, project_links, project_tags, project_likes, project_saves, project_follows, project_user_reviews, project_builds.

---

## `project_images` — model `ProjectImage`

| Field | Type | Notes |
|-------|------|-------|
| id | String (uuid) | PK |
| projectId | String | FK → learning_projects |
| imageUrl | String | |
| sortOrder | Int | default 0 |

---

## `project_required_components` — model `ProjectRequiredComponent`

| Field | Type | Notes |
|-------|------|-------|
| id | String (uuid) | PK |
| projectId | String | FK → learning_projects |
| categoryId | String? | FK → categories |
| componentName, materialType, unit | String | |
| quantity | Decimal | |
| componentRole | ProjectComponentRole | |
| isRequired, canBeSubstituted | Boolean | |
| searchKeywords, alternativeKeywords | Json? | |
| providedByUser, confirmedByUser, generatedOrSuggestedByAi | Boolean | |
| reviewStatus | ProjectReviewStatus | default `PENDING_REVIEW` |
| notes | String? | |

---

## `project_steps` — model `ProjectStep`

| Field | Type | Notes |
|-------|------|-------|
| id | String (uuid) | PK |
| projectId | String | FK → learning_projects |
| stepNumber | Int | unique per project |
| title, description | String | |
| imageUrl | String? | |
| generatedByAi | Boolean | default false |
| approvedBy | String? | FK → users |
| reviewStatus | ProjectReviewStatus | default `PENDING_REVIEW` |

---

## `project_links` — model `ProjectLink`

| Field | Type | Notes |
|-------|------|-------|
| id | String (uuid) | PK |
| projectId | String | FK → learning_projects |
| linkType | ProjectLinkType | |
| url | String | |
| title, sourceName | String? | |

---

## `project_tags` — model `ProjectTag`

| Field | Type | Notes |
|-------|------|-------|
| id | String (uuid) | PK |
| projectId | String | FK → learning_projects |
| tag | String | unique per project |

---

## `project_likes` — model `ProjectLike`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| projectId | String | FK → learning_projects; cascade delete |
| userId | String | FK → users; cascade delete |
| createdAt | DateTime | default now |

**Unique:** `(projectId, userId)`. Used by learner project like/unlike and public Learning Hub `likesCount` / viewer-specific `isLiked` fields.

---

## `project_saves` — model `ProjectSave`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| projectId | String | FK → learning_projects; cascade delete |
| userId | String | FK → users; cascade delete |
| createdAt | DateTime | default now |

**Unique:** `(projectId, userId)`. Used by private learner project save/unsave and viewer-specific `isSaved`; save counts are not exposed publicly.

---

## `project_follows` — model `ProjectFollow`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| projectId | String | FK → learning_projects; cascade delete |
| userId | String | FK → users; cascade delete |
| createdAt | DateTime | default now |

**Unique:** `(projectId, userId)`. Used by learner project follow/unfollow and public Learning Hub `followersCount` / viewer-specific `isFollowing` fields.

---

## `project_user_reviews` — model `ProjectUserReview`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| projectId | String | FK → learning_projects; cascade delete |
| userId | String | FK → users; cascade delete |
| rating | Int | 1–5 by API validation |
| comment | String? | Optional learner review text |
| createdAt, updatedAt | DateTime | |

**Unique:** `(projectId, userId)`. Used by learner project rating/review upsert/delete, public `ratingSummary`, detail `recentReviews`, and viewer-specific `viewerReview`.

---

## `project_builds` — model `ProjectBuild`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| projectId | String | FK → learning_projects; cascade delete |
| learnerId | String | FK → users; cascade delete |
| status | ProjectBuildStatus | default `IN_PROGRESS` |
| startedAt | DateTime | default now |
| completedAt | DateTime? | Reserved for later completion flow |
| createdAt, updatedAt | DateTime | |

**Unique:** `(projectId, learnerId)`. Stores one manual build checklist per learner/project.

---

## `project_build_items` — model `ProjectBuildItem`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| buildId | String | FK → project_builds; cascade delete |
| requiredComponentId | String | FK → project_required_components; cascade delete |
| status | ProjectBuildItemStatus | default `MISSING` |
| learnerNote | String? | Optional learner checklist note |
| linkedMaterialId | String? | FK → materials; nullable learner-selected platform material |
| linkedReservationId | String? | FK → reservations; reserved for future reservation-aware readiness |
| linkedMaterialAt | DateTime? | When the learner linked the material |
| createdAt, updatedAt | DateTime | |

**Unique:** `(buildId, requiredComponentId)`. Stores manual checklist status per required component plus optional per-learner material link. Linking a material does not automatically mark the item ready.

---

## `materials` — model `Material`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| ownerId | String | FK → users |
| supplierProfileId | String? | FK → supplier_profiles |
| categoryId | String | FK → categories |
| title, description, materialType, unit | String | |
| materialTypeId | String? | FK → material_types |
| customMaterialType | String? | |
| priceRuleId | String? | FK → material_price_rules |
| priceCheckedAt | DateTime? | |
| maxAllowedPriceAtCheck | Decimal? | |
| quantity | Decimal | Remaining physical stock (decremented on reservation completion/delivery) |
| condition | MaterialCondition | |
| sourceType | MaterialSourceType | |
| status | MaterialStatus | default `AVAILABLE` |
| isFree | Boolean | default true |
| price | Decimal? | |
| currency | String | default `NIS` |
| locationId | String | FK → locations |
| pickupAllowed, deliveryAllowed | Boolean | |
| pickupNotes, suggestedUses | String? | |
| viewsCount | Int | default 0 |
| reusedAt | DateTime? | |
| reusedByReservationId | String? | unique FK → reservations |

---

## `material_reports` — model `MaterialReport`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| materialId | String | FK → materials |
| reporterId | String | FK → users |
| reason | MaterialReportReason | |
| note | String? | Required by API when `reason=OTHER` |
| status | MaterialReportStatus | default `PENDING` |
| adminNote | String? | |
| reviewedById | String? | FK → users |
| reviewedAt | DateTime? | |
| createdAt, updatedAt | DateTime | |

Used by authenticated material reporting and admin material report review. This is material-specific reporting, not a general `reports` module/table.

---

## `material_images` — model `MaterialImage`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| materialId | String | FK → materials |
| imageUrl | String | |
| sortOrder | Int | default 0 |
| isCover | Boolean | default false |

---

## `material_tags` — model `MaterialTag`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| materialId | String | FK → materials |
| tag | String | unique per material |

---

## `reservations` — model `Reservation`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| materialId | String | FK → materials |
| requesterId, ownerId | String | FK → users |
| quantityRequested | Decimal | Held/requested amount for this reservation |
| message | String? | |
| status | ReservationStatus | default `PENDING` |
| fulfillmentMethod | ReservationFulfillmentMethod | default `PICKUP` |
| learnerPreferredPickupWindows | Json? | Reserve-time pickup windows |
| learnerPreferredDeliveryWindows | Json? | Reserve-time delivery windows |
| deliveryAddressText | String? | Delivery drop-off text |
| safeDropoffAllowed | Boolean | default false |
| deliveryNote | String? | Learner delivery note |
| pickupWindowStart, pickupWindowEnd | DateTime? | Confirmed self-pickup window |
| supplierProposedPickupWindowStart, supplierProposedPickupWindowEnd | DateTime? | Supplier-proposed pickup awaiting learner confirmation |
| supplierPickupWindowStart, supplierPickupWindowEnd | DateTime? | Driver pickup from supplier (delivery accept) |
| confirmedDeliveryWindowStart, confirmedDeliveryWindowEnd | DateTime? | Feasible delivery window after supplier pickup + buffer |
| earliestDeliveryStart | DateTime? | Computed earliest learner delivery start |
| schedulingConflictReason | String? | Set when delivery scheduling is infeasible |
| supplierNote, rejectionReason | String? | |
| acceptedAt, rejectedAt, cancelledAt, completedAt | DateTime? | |

Logistics (driver, delivery status, dropoff location, cost) live on `deliveries`, not `reservations`.

---

## `deliveries` — model `Delivery`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| reservationId | String | FK → reservations; many attempts per reservation |
| pickupLocationId, dropoffLocationId | String | FKs → locations |
| assignedDriverProfileId | String? | FK → driver_profiles |
| requestedByUserId | String | FK → users |
| status | DeliveryStatus | default `WAITING_FOR_DRIVER` |
| requestedAt | DateTime | default now |
| assignedAt, arrivedPickupAt, pickedUpAt, onTheWayAt, arrivedDropoffAt, deliveredAt, cancelledAt, failedAt | DateTime? | lifecycle timestamps |
| learnerNote, driverNote, failureReason | String? | |
| createdAt, updatedAt | DateTime | |

Partial unique indexes and service logic enforce one active delivery per reservation and one active assigned delivery per driver.

---

## `delivery_assignments` — model `DeliveryAssignment`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| deliveryId | String | FK → deliveries |
| driverProfileId | String | FK → driver_profiles |
| assignedByUserId | String? | FK → users |
| status | DeliveryAssignmentStatus | default `ACTIVE` |
| acceptedAt | DateTime | default now |
| releasedAt | DateTime? | |
| releaseReason | String? | |
| createdAt | DateTime | |

---

## `delivery_status_history` — model `DeliveryStatusHistory`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| deliveryId | String | FK → deliveries |
| oldStatus | DeliveryStatus? | |
| newStatus | DeliveryStatus | |
| changedByUserId | String | FK → users |
| note | String? | |
| createdAt | DateTime | |

---

## `delivery_location_pings` — model `DeliveryLocationPing`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| deliveryId | String | FK → deliveries |
| driverProfileId | String | FK → driver_profiles |
| latitude, longitude | Decimal | `Decimal(9,6)` |
| accuracyMeters, heading, speed | Decimal? | |
| capturedAt | DateTime | client capture time |
| createdAt | DateTime | server write time |

No new PostGIS geography column is used for pings in Stage 1.

---

## `reservation_status_history` — model `ReservationStatusHistory`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| reservationId | String | FK → reservations |
| statusGroup | ReservationStatusGroup | default `RESERVATION` |
| oldStatus | String? | |
| newStatus | String | |
| changedBy | String? | FK → users |
| note | String? | |

---

## `reviews` — model `Review`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| reservationId | String | FK → reservations |
| reviewerId | String | FK → users |
| reviewedUserId | String? | FK → users |
| targetType | ReviewTargetType | |
| rating | Int | |
| comment | String? | |

**No reviews API module** in backend — table exists, API **not implemented**.

---

## `notifications` — model `Notification`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → users |
| notificationType | String | |
| title, body | String | |
| relatedEntityType, relatedEntityId | String? | |
| readAt | DateTime? | Set together with `isRead` by mark-read routes; legacy read rows may remain null |
| eventKey | String? unique | Deterministic producer idempotency key; nullable for legacy rows |
| entityType, entityId | String? | Canonical semantic target, retained alongside legacy related fields |
| actionType | String? | Persisted producer hint; supplier read-time classifier revalidates it |
| metadata | Json? | Structured non-route event context |
| resolvedAt | DateTime? | Explicit producer resolution timestamp |
| actorId | String? | Optional actor identifier |
| isRead | Boolean | default false |

Generic authenticated API remains at `/api/notifications` for backwards compatibility and other roles. Supplier inbox routes are under `/api/supplier/notifications` and use the persisted rows as their canonical source.

---

## `material_types` — model `MaterialType`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| categoryId | String | FK → categories |
| nameEn | String | |
| nameAr | String? | |
| normalizedName | String | unique per category |
| defaultUnit | String | default `piece` |
| isActive | Boolean | default true |

---

## `material_type_aliases` — model `MaterialTypeAlias`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| materialTypeId | String | FK → material_types |
| alias, normalizedAlias | String | unique per type |
| language | String? | |

---

## `material_price_rules` — model `MaterialPriceRule`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| materialTypeId | String | FK → material_types |
| currency | String | default `NIS` |
| unit | String | |
| maxAllowedUnitPriceNis, maxAllowedTotalPriceNis | Decimal? | |
| conditionFactorsJson | Json? | |
| sourceType | MaterialPriceRuleSourceType | default `MANUAL` |
| status | MaterialPriceRuleStatus | default `PENDING_REVIEW` |
| sourceNote | String? | |
| confidence | Decimal? | |
| isActive | Boolean | default true |

---

## `price_rule_requests` — model `PriceRuleRequest`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| materialTypeId, categoryId | String? | FKs |
| materialName, normalizedMaterialName | String? | |
| unit | String? | |
| condition | MaterialCondition? | |
| quantity, supplierPriceNis | Decimal? | |
| requestedByUserId | String? | FK → users |
| status | MaterialRequestStatus | default `PENDING` |
| aiSuggested* fields | various | AI pricing suggestions |
| aiResultJson | Json? | |
| moderatorNote | String? | |
| listingDraftJson | Json? | |
| publishedMaterialId | String? | unique FK → materials |
| publishedAt | DateTime? | |

---

## `category_requests` — model `CategoryRequest`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| requestedName, normalizedRequestedName | String | |
| requestedByUserId | String | FK → users |
| status | MaterialRequestStatus | default `PENDING` |
| approvedCategoryId | String? | FK → categories |
| moderatorNote | String? | |
| listingDraftJson | Json? | |
| publishedMaterialId | String? | unique FK → materials |
| publishedAt | DateTime? | |

---

## `ai_price_lookup_logs` — model `AiPriceLookupLog`

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| query, normalizedQuery | String | |
| resultJson | Json? | |
| status | AiLookupStatus | |
| costEstimate | Decimal? | |

Used by price-rule AI services — not a user-facing AI agent credits system.

---

## `idempotency_records` — model `IdempotencyRecord`

Generic operation idempotency store. Supplier material create uses scope `SUPPLIER_CREATE_MATERIAL`; Learning Hub learner submit uses scope `LEARNING_PROJECT_SUBMIT`.

| Field | Type | Notes |
|-------|------|-------|
| id | String (cuid) | PK |
| userId | String | FK → users |
| scope | String | Operation scope, e.g. `SUPPLIER_CREATE_MATERIAL` |
| key | String | Client-supplied idempotency key |
| requestHash | String | Hash of the validated create payload |
| status | IdempotencyStatus | `IN_PROGRESS`, `SUCCEEDED`, or `FAILED` |
| resourceType | String? | e.g. `MATERIAL` after success |
| resourceId | String? | Created resource id after success |
| responseJson | Json? | Stored successful API response |
| expiresAt | DateTime? | Retention/cleanup marker; no cleanup job documented yet |
| createdAt, updatedAt | DateTime | |

**Unique:** `(userId, scope, key)`. This prevents duplicate processing for the same operation key without blocking valid similar material listings by title/name/category.
