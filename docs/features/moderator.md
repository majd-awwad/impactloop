# Moderator Feature (Gap Doc)

**Gap / stub — not an implementation guide.**

**Sources inspected:** `apps/backend/src/app.ts`, `apps/backend/src/modules/category-requests/*`, `apps/backend/src/modules/price-rule-requests/*`, `apps/backend/prisma/schema.prisma` (`category_requests`, `price_rule_requests`, `learning_projects`), `apps/frontend/lib/features/` (no `moderator` folder), `docs/01-requirements.md` (§Moderator, §Learning Hub), `docs/05-roadmap.md` (Phase 7), `docs/08-implementation-status.md`

## Intended purpose (requirements / roadmap — aspirational)

From [01-requirements.md](01-requirements.md):

- Review pending learning projects (approve/reject/request edits).
- Review reports; hide content per permissions.
- Cannot manage sensitive roles or system settings (vs Admin).

Roadmap Phase 7: moderator review queue, reports, project approval.

## Current code status

| Layer | Status | Evidence |
|-------|--------|----------|
| `moderator` backend module | **Not implemented** | No folder under `modules/` |
| Moderator Flutter feature | **Not implemented** | No `features/moderator` |
| `MODERATOR` role in invitations | **Backend-only** | Target role on `POST /api/invitations` only |
| Category request **approval** API | **Not implemented** | Supplier create/list/draft only (`category-requests.routes.ts`) |
| Price rule request **approval** API | **Not implemented** | Supplier create + draft read; AI suggestion on create |
| Learning project moderation API | **Not implemented** | Public read `PUBLISHED` only; no submit/review endpoints |
| Content reports (user flags) | **Not implemented** | No `Report` model/table exists in the current schema. Review moderation is not implemented; current schema has `Review` only if applicable. |

**Overall:** **Not implemented** as portal; supplier-facing **request** workflows exist without moderator approve endpoints in code.

## Existing related files

### Backend (supplier-side requests only)

| Path | Role |
|------|------|
| `modules/category-requests/*` | Supplier `POST/GET` category requests |
| `modules/price-rule-requests/*` | Authenticated create; supplier draft `GET` |
| `modules/learning-projects/*` | Public read published projects |

### Database (pending review data may exist from seeds)

| Table | Role |
|-------|------|
| `category_requests` | Status includes approval fields in schema |
| `price_rule_requests` | AI + review status columns |
| `learning_projects` | `status` enum — publish workflow **not implemented** in API |

## What is missing

- Moderator-authenticated routes (`requireRoles('MODERATOR')` or ADMIN delegate).
- Review queues UI (category, price rule, projects; user reports **not implemented** — no `Report` table in schema).
- Approve/reject actions updating request/project status.
- Notifications to suppliers on approval outcomes.
- Separation of moderator vs admin permissions in code.

## Risks

- Suppliers can submit category/price requests with **no in-app approval path** — blocked on paid “Other” category server-side only.
- Learning hub draft page is mock — no real submit queue.
- Moderator role assignable via invitation API but no post-login experience.

## Questions before implementation

- Shared review module vs per-domain approve endpoints?
- Can ADMIN act as moderator for all queues?
- How are requests marked `APPROVED` today (seed/manual DB)?
- See [09-open-questions.md](../09-open-questions.md) § Admin and moderator.

## Related docs

- [Admin](admin.md)
- [Materials listing](materials-listing.md)
- [Learning hub](learning-hub.md)
