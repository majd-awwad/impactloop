# Database Enums

All enums from `apps/backend/prisma/schema.prisma`. Values are exact Prisma enum members.

**Source:** `schema.prisma` enum definitions.

---

## `UserRole`

`LEARNER`, `SUPPLIER`, `DRIVER`, `MODERATOR`, `ADMIN`

Used by: `UserRoleAssignment.role`

Public signup in API: `LEARNER`, `SUPPLIER` only (`auth/auth.validation.ts`).

---

## `AccountStatus`

`PENDING_VERIFICATION`, `ACTIVE`, `SUSPENDED`, `DISABLED`

Used by: `User.accountStatus`

---

## `AuthTokenType`

`EMAIL_VERIFICATION`, `PHONE_OTP`, `PASSWORD_RESET`, `REFRESH_TOKEN`

Used by: `AuthToken.tokenType`

---

## `RoleInvitationTargetRole`

`DRIVER`, `MODERATOR`, `ADMIN`

Used by: `RoleInvitation.targetRole`

---

## `RoleInvitationStatus`

`PENDING`, `ACCEPTED`, `EXPIRED`, `REVOKED`

Used by: `RoleInvitation.status`

---

## `MaterialCondition`

`NEW`, `LIKE_NEW`, `GOOD`, `USED`, `NEEDS_REPAIR`

Used by: `Material.condition`, `PriceRuleRequest.condition`

---

## `MaterialSourceType`

`STUDENT_LEFTOVER`, `WORKSHOP_SURPLUS`, `FACTORY_SURPLUS`, `EDUCATIONAL_INSTITUTION`

Used by: `Material.sourceType`

---

## `MaterialStatus`

`AVAILABLE`, `PENDING_RESERVATION`, `RESERVED`, `REUSED`, `UNAVAILABLE`

Used by: `Material.status`

---

## `CategoryType`

`MATERIAL`, `PROJECT`, `BOTH`

Used by: `Category.categoryType`

---

## `OrganizationType`

`WORKSHOP`, `FACTORY`, `EDUCATIONAL_INSTITUTION`

Used by: `OrganizationProfile.organizationType`

---

## `VerificationDocumentStatus`

`PENDING`, `VERIFIED`, `REJECTED`, `CHANGES_REQUESTED`

Used by: `OrganizationProfile.verificationDocumentStatus`

---

## `ReservationStatus`

`PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `COMPLETED`, `EXPIRED`

Used by: `Reservation.status`

---

## `ReservationStatusGroup`

`RESERVATION`, `DELIVERY`

Used by: `ReservationStatusHistory.statusGroup`

---

## `PickupType`

`SELF_PICKUP`, `DELIVERY_ALLOWED`

Used by: `Reservation.pickupType`

---

## `DeliveryStatus`

`WAITING_FOR_DRIVER`, `DRIVER_ASSIGNED`, `ARRIVED_PICKUP`, `PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`, `DELIVERED`, `CANCELLED`, `FAILED_PICKUP`, `FAILED_DELIVERY`

Used by: `Delivery.status`, `DeliveryStatusHistory.oldStatus`, `DeliveryStatusHistory.newStatus`, legacy `Reservation.deliveryStatus`

Active delivery statuses: `WAITING_FOR_DRIVER`, `DRIVER_ASSIGNED`, `ARRIVED_PICKUP`, `PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`.

---

## `DriverProfileStatus`

`ACTIVE`, `INACTIVE`, `SUSPENDED`

Used by: `DriverProfile.status`

---

## `DriverAvailabilityStatus`

`OFFLINE`, `AVAILABLE`, `ON_DELIVERY`

Used by: `DriverProfile.availability`

---

## `DeliveryAssignmentStatus`

`ACTIVE`, `RELEASED`, `CANCELLED`

Used by: `DeliveryAssignment.status`

---

## `ReviewTargetType`

`SUPPLIER`, `DRIVER`, `MATERIAL`

Used by: `Review.targetType`

---

## `MaterialPriceRuleStatus`

`ACTIVE`, `PENDING_REVIEW`, `REJECTED`

Used by: `MaterialPriceRule.status`

---

## `MaterialPriceRuleSourceType`

`MANUAL`, `IMPORTED`, `AI_PROPOSED`

Used by: `MaterialPriceRule.sourceType`

---

## `MaterialRequestStatus`

`PENDING`, `APPROVED`, `REJECTED`

Used by: `PriceRuleRequest.status`, `CategoryRequest.status`

---

## `AiLookupStatus`

`SUCCESS`, `FAILED`, `SKIPPED`, `PENDING_REVIEW`

Used by: `AiPriceLookupLog.status`

---

## `IdempotencyStatus`

`IN_PROGRESS`, `SUCCEEDED`, `FAILED`

Used by: `IdempotencyRecord.status`

---

## `ProjectDifficulty`

`BEGINNER`, `INTERMEDIATE`, `ADVANCED`

Used by: `LearningProject.difficulty`

---

## `LearningProjectStatus`

`DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`, `ARCHIVED`

Used by: `LearningProject.status`

**Note:** Older docs may say `ProjectStatus` — actual enum name is `LearningProjectStatus`.

---

## `ProjectComponentRole`

`REQUIRED_MATERIAL`, `OPTIONAL_MATERIAL`, `TOOL`, `CONSUMABLE`, `ALTERNATIVE`

Used by: `ProjectRequiredComponent.componentRole`

---

## `ProjectReviewStatus`

`PENDING_REVIEW`, `ACCEPTED`, `REJECTED`

Used by: `ProjectRequiredComponent.reviewStatus`, `ProjectStep.reviewStatus`

---

## `ProjectLinkType`

`YOUTUBE`, `GITHUB`, `ARTICLE`, `PDF`, `OTHER`

Used by: `ProjectLink.linkType`

---

## Enums in older docs but **not** in schema

From [03-database.md](../03-database.md) — **not present** in current `schema.prisma`:

- `AIRequestStatus` (and related AI request enums)

These are **aspirational** until models are added.
