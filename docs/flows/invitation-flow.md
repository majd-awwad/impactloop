# Invitation flow

## Creation

An `ADMIN` submits `POST /api/admin/invitations` with a normalized recipient
email, `DRIVER` or `ADMIN`, and a permitted expiry. The backend rejects
`LEARNER`, `SUPPLIER`, and newly issued `MODERATOR` invitations. A recipient
who already has the requested role is rejected; an existing recipient missing
the role is valid.

The service creates a pending record in `role_invitations`, stores only the
token hash, and sends the acceptance URL.

## Preview and account state

`GET /api/invitations/validate?token=...` validates token lifecycle and returns
the target email/role plus one of these states:

- `NEW_ACCOUNT`
- `EXISTING_ACCOUNT_LOGGED_OUT`
- `EXISTING_ACCOUNT_READY`
- `WRONG_AUTHENTICATED_ACCOUNT`
- `ALREADY_HAS_ROLE`
- `UNSUPPORTED_ROLE` for historical moderator invitations

The endpoint receives optional authentication only to decide UI state. The
acceptance endpoints independently enforce every authorization decision.

## New account

The public `POST /api/invitations/accept` accepts new-account profile data.
It uses the invitation’s email and role, rejects an already registered email,
creates the user and invited role, creates `DriverProfile` for drivers, and
consumes the invitation in one transaction. The success screen sends the user
to sign in; no auth session is issued.

## Existing account

For a logged-out existing account, the client routes to:

```text
/login?from=/invite/accept?token=...
```

The login route already validates this as an internal target. After login, the
client returns to the invitation preview.

`POST /api/invitations/accept-existing` requires a current session. It derives
the user ID from that session and checks the normalized session email against
the invitation target. It then safely adds the stored role, preserves all
existing roles, creates a missing driver profile only when complete validated
driver fields are supplied, and consumes the invitation transactionally.

If the matching account already owns the role, acceptance remains idempotent:
no duplicate `user_roles` row is created and the invitation can be completed.

## Lifecycle and legacy moderation

Expiry, revocation, prior use, and invalid tokens are rejected before any role
or profile write. Resend and issue-link operations rotate token hashes. Pending
historical moderator invitations are displayed but cannot be renewed or
accepted; admins may revoke them.
