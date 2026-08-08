# Moderator Feature (Gap Doc)

**Gap / stub - not an implementation guide.**

**Sources inspected:** `apps/backend/src/app.ts`, `apps/backend/src/modules/admin*`, `apps/backend/src/modules/category-requests/*`, `apps/backend/src/modules/price-rule-requests/*`, `apps/backend/src/modules/materials/*`, `apps/backend/prisma/schema.prisma`, `apps/frontend/lib/features/`, `docs/features/admin.md`, `docs/features/roles-and-capabilities.md`, `docs/08-implementation-status.md`

## Purpose

Moderator is intended to preserve content quality without receiving full admin system permissions. This role should eventually review reports, suspicious listings, wrong categories, price issues, material type/category requests, and project submissions.

Moderator is invitation-only. It is not available through public registration.

## Current code status

| Layer | Status | Evidence |
|-------|--------|----------|
| `MODERATOR` stored role | **Implemented** | `UserRole.MODERATOR` and role invitation target |
| Moderator invitation | **Implemented** | Admin can invite `MODERATOR` |
| `moderator` backend module | **Not implemented** | No folder under `modules/` |
| Moderator Flutter feature | **Not implemented** | No `features/moderator` and no `/moderator` route |
| Moderator post-login experience | **Not implemented** | `postAuthRouteForUser` sends moderator-only users to `/home` |
| Category request approval | **Implemented for ADMIN** | `/api/admin/approvals/category-requests*` |
| Price request approval | **Implemented for ADMIN** | `/api/admin/approvals/price-requests*` |
| Material reports review | **Implemented for ADMIN** | `/api/admin/material-reports*` |
| Learning project moderation API | **Implemented for ADMIN** | Learner submit → `PENDING_REVIEW`; `/api/admin/learning-projects/*` approve/request-changes/reject/hide/restore/archive |

**Overall:** Moderator exists as a role and invitation target, but there is no moderator portal or moderator-specific API. Some planned moderation work is currently handled by admin routes.

## Current related implementation

| Area | Current owner |
|------|---------------|
| Material report submission | Authenticated users via `POST /api/materials/:id/reports` |
| Material report review | Admin material reports UI/API |
| Hide/restore material | Admin materials UI/API |
| Category request approval | Admin approvals UI/API |
| Price request approval | Admin approvals UI/API |
| Supplier verification review | Admin supplier verification UI/API |
| Project publishing/review | **Implemented for ADMIN** | `/admin/learning-projects` moderation UI + `/api/admin/learning-projects/*` |

## Planned moderator scope

From the role capability plan, moderator should eventually be able to:

- Review reported materials.
- Review suspicious listings.
- Review wrong categories.
- Review inappropriate images/descriptions.
- Review project reports when project reports exist.
- Review price issues.
- Review material type/category requests if delegated from admin.
- Hide material or reject content when policy allows.
- Add moderation reason.
- Work from a moderation queue.

## Boundaries vs admin

Moderator should not manage:

- Admin invitations.
- Sensitive role assignment.
- Platform settings.
- Price/category system policy unless explicitly delegated.
- User suspension/reactivation unless the team makes a separate decision.

Admin remains the current implemented owner for approvals and material report review.

## What is missing

- `/moderator` route and Flutter feature.
- Moderator-authenticated backend routes.
- Moderator queue API and UI.
- Clear permission matrix for moderator vs admin actions.
- Project submission/review workflow for moderators (admin owns it today).
- Notifications to suppliers/learners after moderator actions.

## Questions before implementation

- Should moderator share admin approval endpoints with `requireRoles('ADMIN', 'MODERATOR')`, or use a separate `moderator` module?
- Which queues are safe for moderator in MVP: material reports only, category/price approvals, or project review too?
- Can ADMIN act as moderator for every queue permanently, or only until moderator portal is built?
- What audit trail is required for moderator actions?

See [09-open-questions.md](../09-open-questions.md) for the current open-question index.

## Related docs

- [Roles and capabilities](roles-and-capabilities.md)
- [Admin](admin.md)
- [Materials listing](materials-listing.md)
- [Learning hub](learning-hub.md)
