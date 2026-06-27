# ADR 0002: Role And Registration Model

## Status
Accepted

## Context

The MVP separates public roles from invitation-only roles. Public registration is for learners and suppliers. Driver, moderator, and admin roles are created through invitations. The current role enum has no mentor role.

## Decision

Use this role and registration model:

- Public registration supports `LEARNER` and `SUPPLIER`.
- A user may register with learner, supplier, or both learner/supplier intent where current auth flow supports it.
- `DRIVER`, `MODERATOR`, and `ADMIN` are assigned through role invitation flows.
- Do not introduce a `MENTOR` role in the MVP.

## Consequences

- Auth registration and Flutter onboarding should not expose driver, moderator, admin, or mentor self-registration.
- Admin/moderator/driver access depends on invitation-backed role assignment, not public signup.
- Any new role or public registration change requires documentation and role/permission review.

## Current implementation evidence

- [AGENTS.md](../../AGENTS.md) states public registration supports only learner/supplier, driver/moderator/admin use admin invitation links, and mentor does not exist.
- [docs/features/auth.md](../features/auth.md) documents public signup/login for learner and supplier roles and marks driver/moderator/admin self-registration as not in scope.
- [docs/features/invitations.md](../features/invitations.md) documents invitation-only `DRIVER`, `MODERATOR`, and `ADMIN` roles.
- [docs/database/enums.md](../database/enums.md) lists `UserRole` as `LEARNER`, `SUPPLIER`, `DRIVER`, `MODERATOR`, `ADMIN` and `RoleInvitationTargetRole` as `DRIVER`, `MODERATOR`, `ADMIN`.
- [apps/backend/prisma/schema.prisma](../../apps/backend/prisma/schema.prisma) contains the current role and invitation enums and no `MENTOR` enum value.
- [docs/08-implementation-status.md](../08-implementation-status.md) marks public learner/supplier registration as implemented and role invitations as backend-only.

## Related docs

- [docs/features/auth.md](../features/auth.md)
- [docs/features/invitations.md](../features/invitations.md)
- [docs/flows/auth-flow.md](../flows/auth-flow.md)
- [docs/flows/invitation-flow.md](../flows/invitation-flow.md)
- [docs/database/enums.md](../database/enums.md)
