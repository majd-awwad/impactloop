# Invitations

ImpactLoop invitations grant an operational role to the account whose email is
named by the invitation. They support both a new account and an existing
multi-role account.

## Active invitation roles

- `DRIVER`
- `ADMIN`

`MODERATOR` remains in the database and historical invitation records for
compatibility, but new moderator invitations cannot be created, resent, issued,
or accepted.

## Flow

1. An authenticated `ADMIN` creates a role invitation for an email address.
2. The service stores a SHA-256 hash of a random opaque token and emails the
   raw token in `/invite/accept?token=...`.
3. The public preview endpoint identifies whether the email has no account, an
   existing logged-out account, the matching authenticated account, or a
   different authenticated account.
4. A new email completes account registration. The invitation creates one user
   with the invited role; drivers also receive a `DriverProfile`.
5. An existing matching account uses the authenticated acceptance endpoint.
   Its role assignment is inserted safely without replacing any previous role.
   A driver profile is created only when required and missing.
6. The invitation is consumed atomically with the role/profile mutation.

New-account acceptance does not create a session. The person signs in after the
success screen. Existing-account acceptance refreshes access claims and
`/auth/me` so the new role is visible immediately.

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/invitations/validate?token=` | Optional | Token preview and safe account state |
| POST | `/api/invitations/accept` | No | Create a new account and consume invite |
| POST | `/api/invitations/accept-existing` | Required | Add the database invitation role to matching account |
| GET | `/api/admin/invitations` | ADMIN | List invitation history |
| POST | `/api/admin/invitations` | ADMIN | Create a driver/admin invitation |
| POST | `/api/admin/invitations/:id/issue-link` | ADMIN | Rotate active invitation link |
| POST | `/api/admin/invitations/:id/resend` | ADMIN | Rotate and resend active invitation |
| PATCH | `/api/admin/invitations/:id/revoke` | ADMIN | Revoke an unused invitation |

The authenticated acceptance request never supplies an authoritative email,
role, or user ID. Those values come from the session and the stored invitation.
