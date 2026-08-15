# Roles and Capabilities

Canonical product framing for ImpactLoop roles. This document separates product intent from implementation status so future work can be planned without treating every capability as already shipped.

**Source context:** `docs/product/implementation-status.md`, current feature docs, current route/module maps, and ADR role decisions.

## Role model

ImpactLoop has two primary user roles:

- `LEARNER`
- `SUPPLIER`

ImpactLoop also has operational support roles:

- `ADMIN`
- `MODERATOR`
- `DRIVER`

Guests are unauthenticated users. `GUEST` is not a stored `UserRole`.

Public registration supports only learners and suppliers. Driver, moderator, and admin accounts are created through invitation flows. `MENTOR` is not part of the MVP role model.

## Status labels

| Label | Meaning |
|-------|---------|
| **Implemented** | End-to-end or complete for the documented scope |
| **Partial** | Some layers exist; gaps remain |
| **Backend-only** | API/schema exists without matching Flutter route or user flow |
| **Frontend-only** | UI exists without production API behavior |
| **Not implemented** | No meaningful code path yet |
| **Planned / future** | Product intent that should not be treated as shipped |

## Guest

**Goal:** Understand the value of the platform before registering.

**Implemented / current:**

- Public landing page.
- Public material browse, search, filters, pagination, and detail pages.
- Public learning hub browse/detail pages for published projects.
- Material detail views create `MaterialView` engagement rows; authenticated users count once per material.
- Public material cards/details show material like counts.
- Public learning project cards/details show project like counts.
- Public material location is redacted to city/area only.

**Planned / future:**

- Guest prompts for login when trying to save, like, reserve, follow, or start a build.
- Public supplier profile pages beyond the supplier summary already shown on material details.

**Boundary:** Guests can discover content, but real interactions such as reservation, reporting, saving, following, and publishing require login.

## Learner

**Goal:** Learn, build projects, find affordable or free surplus materials, and reserve what is needed.

**Core problem:** A learner may know the project but not where to get materials, or may have a material and not know what to build with it.

**Implemented / current:**

- Learner public registration and login.
- Learner profile editing for learner type, skill level, interests, and bio.
- Authenticated learner home route.
- Home suggested materials and learning spotlight are API-backed, but not personalized yet.
- Material browse/search/filter/detail.
- Learner material likes from material detail, with counts visible on detail, discovery cards, home suggestions, and related material cards.
- Material reservation with quantity, note, and pickup/delivery preference at reservation/delivery flow boundaries.
- Learner reservation list, pending cancel, status display, and accepted self-pickup address reveal.
- Internal delivery request/status page for accepted delivery-enabled reservations.
- Published learning project browse/detail.
- Learner project likes from Learning Hub cards, Home spotlight, and detail, with counts visible on those surfaces.
- Learner project saves from Learning Hub cards, Home spotlight, and detail, with viewer-specific saved state visible on those surfaces.
- Learner project follows from Learning Hub cards, Home spotlight, and detail, with follower counts and viewer-specific followed state visible on those surfaces.
- Learner saved/followed project listing tabs in Learning Hub, with the same search/category/difficulty/tag filters and pagination as the public project list.
- Learner project ratings/reviews from Learning Hub detail, with rating summaries visible on Learning Hub cards, detail, and Home spotlight.
- Existing learner accounts can become **Student/Individual** suppliers from `/become-supplier` without a second account (`POST /api/auth/become-supplier`).
- Dual-role users switch active portal with `POST /api/auth/switch-role` and see switch actions in the account menu, profile page, and supplier profile popover.
- Learner project draft submission for admin review.

**Partial:**

- Preferences and interests exist on profile/registration, but recommendation logic is currently simple and not a dedicated personalization engine.
- Delivery tracking is polling/latest-ping based, not realtime.
- Learning hub remains partial: learners can browse/detail, list saved/followed projects, like/save/follow/review projects, submit drafts for admin review, and use a local build checklist, but persisted build progress, automatic material linking, and AI matching are not implemented.

**Planned / future:**

- Personalized home sections based on interests, city/area, price preference, followed suppliers/categories, saved projects, and reservation/build history.
- Save material, follow supplier, follow category.
- Project to materials matching.
- Material to projects discovery.
- Persisted build checklist with `Available`, `Missing`, `Alternative`, `Already owned`, and `Reserved` states across sessions. A local non-persisted checklist exists on project detail today.
- Learner-owned inventory marker such as "I already have this".
- Continue saved projects from stored build progress.
- Learner impact analytics.

**Strongest product feature:** Project to materials matching plus build checklist, where a project becomes actionable using available surplus materials.

## Supplier

**Goal:** Publish surplus materials, manage reservations, coordinate pickup/delivery, and understand demand.

**Core problem:** A supplier has surplus materials but needs an organized way to publish them and understand who can benefit.

**Implemented / current:**

- Supplier registration and supplier portal route guard.
- Supplier dashboard, profile, notifications, pickup schedule, material CRUD, and reservation inbox.
- Organization supplier verification gating for add-material access.
- Add material with category, material type/name autocomplete, description, condition, quantity, unit, images, free/paid price, pickup option, delivery allowed flag, and pickup notes/location rules.
- Price governance through listing policy, price check, max/accepted range behavior, price-rule requests, and AI-assisted price references.
- Category requests and price-rule requests.
- Supplier accept/decline/self-pickup complete.
- Delivery reservations are handed to driver flow rather than supplier manual completion.
- Supplier material image upload.
- Same-account learner upgrade for personal supplier types (Student/Individual) via `/become-supplier`.
- Portal switch between learner and supplier modes for eligible dual-role accounts (`activeRole` on `users`).

**Partial:**

- Dashboard/profile surfaces include material views and likes as demand signals, but deeper demand insights are limited.
- AI support is focused on price references; AI category/use/description suggestions are not a complete shipped assistant.
- Related projects for a supplier material are not implemented as a product surface.

**Planned / future:**

- Supplier followers and followed-supplier recommendations.
- Saves per material as demand signals.
- Supplier insights for saves, reservations, category demand, and materials learners request.
- "This material can be used in these projects" guidance for supplier listings.
- Richer AI support for description, category, likely uses, and pricing explanations.

**Strongest product feature:** Material to projects plus supplier insights, so suppliers can understand the educational value and demand for their surplus.

## Driver

**Goal:** Coordinate internal delivery of materials from suppliers to learners.

**Current role boundary:** Driver is an operational support role, not a primary marketplace role.

**Implemented / current:**

- Driver accounts are invitation-only.
- Invitation acceptance creates a `DriverProfile`.
- Driver portal routes: `/driver/jobs`, `/driver/deliveries/:id`.
- Available delivery jobs, active job, accept action, assigned delivery detail, ordered status updates, manual location ping, and page-scoped foreground auto-location sharing.
- Driver status flow includes `WAITING_FOR_DRIVER`, `DRIVER_ASSIGNED`, `ARRIVED_PICKUP`, `PICKED_UP`, `ON_THE_WAY`, `ARRIVED_DROPOFF`, `DELIVERED`, plus failure/cancel terminal states.

**Partial:**

- No background GPS.
- No realtime stream.
- No full Uber-style tracking.
- Driver `acceptingNewJobs` preference is exposed in Flutter; effective availability remains system-managed.

**Planned / future:**

- Better operational controls for failed deliveries, reassignment, cancellation, and proof of delivery.

**Strongest product feature:** Basic internal delivery coordination with explicit delivery status.

## Moderator

**Goal:** Preserve content quality without full admin system permissions.

**Implemented / current:**

- `MODERATOR` is a stored role and an invitation target.

**Not implemented as a portal:**

- No moderator backend module.
- No Flutter moderator portal.
- No post-login moderator workspace.

**Covered elsewhere today:**

- Admin currently handles material reports, material hide/restore, category request approval, price request approval, supplier verification review, and people management.
- Supplier-facing category and price request submission exists.
- Material report submission exists from material detail.

**Planned / future:**

- Moderator queue for reported materials, suspicious listings, wrong categories, inappropriate images/descriptions, project reports, material type/category requests, and price issues.
- Hide/reject content with a moderation reason.
- Review project submissions if/when moderation is delegated from admin.
- Clear separation between moderator permissions and admin-only permissions.

**Strongest product feature:** Moderation queue for reports, price issues, category/material type requests, and content quality.

## Admin

**Goal:** Manage the platform, operational roles, approvals, content quality, and platform analytics.

**Implemented / current:**

- Admin accounts are invitation-only.
- Admin route guard and `/admin` shell.
- Admin overview dashboard with platform metrics and impact snapshot.
- Admin invitation list/create/resend/revoke UI and API.
- Supplier verification review.
- Category and price request approval/rejection.
- Material moderation, material reports, hide/unavailable/restore flows.
- Learning project moderation: list/detail, approve, request changes, reject, hide, restore, and archive.
- People management list, summary, suspend, and reactivate with safety guards.

**Partial:**

- Impact analytics route exists and uses dashboard-backed impact data; deeper analytics remain partial.
- Audit logs route exists with paginated backend data, filters, summary stats, and details.
- Delivery oversight and reservation admin management are not complete.
- AI log viewing is not implemented.
- Project moderation is implemented for ADMIN; moderator-owned project review is not implemented.

**Planned / future:**

- Category hierarchy management and Arabic/English label management.
- Material type and price rule management beyond approval flows.
- Delivery operations dashboard.
- Full analytics by city, category, demand, reservations, reused materials, and popular projects/materials.
- AI usage/log review if the material matching agent is implemented.

**Strongest product feature:** Price rules, category/request approvals, material moderation, invitations, people management, and analytics.

## Cross-role interaction signals

The team wants engagement signals to improve recommendations and measure interest. These are product signals, not a social media feature.

**Implemented now:**

- `viewsCount` on material detail plus row-backed `MaterialView` analytics, with authenticated users counted once per material.
- Material likes.
- Material reports.
- Reservation and delivery activity.

**Planned / future:**

- Saves.
- Follows.
- Project start/build progress.
- Already-owned material markers.

## Product framing for presentations

ImpactLoop should be explained by role goals:

- Learners need materials and executable projects.
- Suppliers have materials and need people who can reuse them.
- Drivers coordinate internal delivery.
- Moderators protect content quality.
- Admins manage roles, approvals, prices, categories, and analytics.
- Guests need to understand the platform before registering.

This framing keeps features connected to user problems instead of presenting the product as a loose list of screens.
