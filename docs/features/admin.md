# Admin Feature

Current MVP status for the invitation-only `ADMIN` role and admin portal.

**Sources inspected:** `apps/backend/src/app.ts`, `apps/backend/src/modules/admin*`, `apps/backend/src/modules/invitations/*`, `apps/frontend/lib/features/admin_portal/`, `apps/frontend/lib/app/router/app_router.dart`, `docs/backend/api-catalog.md`, `docs/frontend/routes-map.md`, `docs/08-implementation-status.md`

## Purpose

Admin manages platform operations: invitations, supplier verification, category/price approvals, material moderation, people management, and platform-level metrics.

Admin is an operational support role. It is not available through public registration; admin accounts are created through invitation flows.

## Current status

| Area | Status | Notes |
|------|--------|-------|
| Admin role creation | **Implemented** | Invitation-only via admin invitation flow |
| Backend `/api/admin/dashboard` | **Implemented** | Overview metrics, impact snapshot, charts/review data |
| Backend admin invitations | **Implemented** | List/create/resend/revoke under `/api/admin/invitations` |
| Backend supplier verification review | **Implemented** | List/detail/approve/reject/request changes |
| Backend approvals | **Implemented** | Category request and price request review |
| Backend material moderation/reports | **Implemented** | List/detail, hide/unavailable/restore, report resolve/reject/hide material |
| Backend people management | **Implemented** | Summary, list, detail, suspend, reactivate with safety guards |
| Flutter admin portal | **Partial** | `/admin` shell with overview, users, supplier verification, materials, approvals, invitations, impact, audit logs, read-only operations monitors, and learning project moderation |
| Impact analytics route | **Implemented** | `/admin/impact` uses dashboard impact data; broader analytics remain future work |
| Audit logs route | **Implemented** | `/admin/audit-logs` reads paginated `admin_activity_logs` with filters/details |
| Delivery/reservation admin ops | **Partial** | Read-only monitoring pages exist; reassignment/cancellation operations are not implemented |
| AI usage/log viewer | **Not implemented** | Material-matching AI is not implemented |
| Project moderation | **Implemented** | `/admin/learning-projects` review queue for admins; backend `/api/admin/learning-projects*` review endpoints also allow `MODERATOR` |

**Overall:** **Partial**. Admin portal and APIs cover several MVP operations, including learning project moderation, impact, audit logs, and read-only reservation/delivery monitors. AI logs and operational delivery/reservation actions remain future work.

## Main user flow

1. Admin logs in or accepts an admin invitation.
2. `postAuthRouteForUser` routes the user to `/admin`.
3. Admin uses the shell navigation:
   - Overview dashboard.
   - Users/people management.
   - Supplier verification.
   - Materials moderation and material reports.
   - Category and price approvals.
   - Invitations.
   - Impact analytics, audit logs, read-only operations monitors, and learning project moderation.
4. Admin actions use `/api/admin/*` endpoints guarded by `authMiddleware` + `requireRoles('ADMIN')`; learning project moderation endpoints are shared with `MODERATOR`.

## Frontend files

| Area | Path |
|------|------|
| Feature root | `apps/frontend/lib/features/admin_portal/` |
| Routes | `/admin`, `/admin/users`, `/admin/supplier-verification`, `/admin/materials`, `/admin/approvals`, `/admin/invitations`, `/admin/impact`, `/admin/audit-logs`, `/admin/reservations`, `/admin/deliveries`, `/admin/learning-projects` |
| Data | `data/admin_dashboard_api.dart`, `admin_invitations_api.dart`, `admin_supplier_verification_api.dart`, `admin_approvals_api.dart`, `admin_materials_api.dart`, `admin_people_api.dart`, `admin_learning_projects_api.dart` |
| Pages | `presentation/pages/admin_overview_page.dart`, `admin_people_page.dart`, `admin_supplier_verification_page.dart`, `admin_materials_page.dart`, `admin_approvals_page.dart`, `admin_invitations_page.dart`, `admin_learning_projects_page.dart`, analytics/audit/monitoring pages |
| Shell/widgets | `presentation/widgets/admin_shell.dart`, sidebar/topbar/dashboard widgets |

## Backend files

| Module | Role |
|--------|------|
| `modules/admin/*` | Dashboard, invitation routes/controllers, parent admin router |
| `modules/admin-approvals/*` | Category and price request review |
| `modules/admin-materials/*` | Material moderation and material report review |
| `modules/admin-learning-projects/*` | Learning project moderation |
| `modules/admin-people/*` | People management |
| `modules/admin-supplier-verifications/*` | Organization supplier verification review |
| `modules/invitations/*` | Public validate/accept and invitation service primitives |

## API surface

Mounted at `/api/admin` and guarded by `ADMIN`, except learning project moderation which allows `ADMIN` or `MODERATOR`.

| Area | Endpoints |
|------|-----------|
| Dashboard | `GET /dashboard` |
| Invitations | `GET/POST /invitations`, `POST /invitations/:id/resend`, `PATCH /invitations/:id/revoke` |
| Supplier verification | `GET /supplier-verifications`, `GET /supplier-verifications/:id`, `PATCH /supplier-verifications/:id/approve|reject|request-changes` |
| Approvals | `GET /approvals/summary`, `GET /approvals/category-requests`, `PATCH /approvals/category-requests/:id/approve|reject`, `GET /approvals/price-requests`, `PATCH /approvals/price-requests/:id/approve|reject` |
| Materials | `GET /materials/summary`, `GET /materials`, `GET /materials/:id`, `PATCH /materials/:id/hide|mark-unavailable|restore` |
| Material reports | `GET /material-reports`, `GET /material-reports/:id`, `PATCH /material-reports/:id/resolve|reject|hide-material` |
| People | `GET /people/summary`, `GET /people`, `GET /people/:id`, `PATCH /people/:id/suspend|reactivate` |
| Learning projects | `GET /learning-projects`, `GET /learning-projects/:id`, `PATCH /learning-projects/:id/approve|request-changes|reject|hide|restore|archive` |

Full route details: [api-catalog](../backend/api-catalog.md#admin--apiadmin).

## Current boundaries

- Admin can invite `DRIVER`, `MODERATOR`, and `ADMIN`.
- Admin can review category and price requests; moderator cannot yet.
- Admin can review material reports; a general reports module is not present.
- Admin can review and publish/hide/archive learning projects in the admin portal; moderator tokens can call the same backend review endpoints, but there is no moderator portal yet.
- Admin people management cannot delete users or manually edit roles.
- Admin suspension/reactivation is guarded against self-suspension, admin suspension, and last-active-admin risk.

## Planned / future capabilities

From the role capability plan:

- Category hierarchy management and bilingual labels.
- Material type and price rule management beyond request approvals.
- Delivery operations dashboard.
- Reservation operations dashboard.
- Deeper impact analytics beyond the current dashboard-backed route.
- Audit log export/retention policy beyond the current paginated admin UI.
- AI usage/log review if learner material matching AI is implemented.
- A dedicated moderator portal/workspace for the shared project review queue.

## Risks / open questions

- No separate `SUPER_ADMIN` role exists; future admin suspension or sensitive role management needs policy.
- Moderator responsibilities currently overlap with admin because the moderator portal is not implemented.
- Delivery failure/reassignment/cancellation admin workflow is not implemented.

See [09-open-questions.md](../09-open-questions.md) for unresolved admin/moderator questions.

## Related docs

- [Roles and capabilities](roles-and-capabilities.md)
- [Invitations](invitations.md)
- [Moderator](moderator.md)
- [Backend API catalog](../backend/api-catalog.md)
- [Routes map](../frontend/routes-map.md)
