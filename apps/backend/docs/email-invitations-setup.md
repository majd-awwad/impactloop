# Email invitations

## Env files (read this first)

The backend loads, in order:

1. `apps/backend/.env`
2. `apps/backend/config/invitations.env` (copy from `config/invitations.env.example`)

**Do not set `EMAIL_PROVIDER=mock` in `invitations.env` if you want real SMTP** — that file overrides `.env`.

Put SMTP settings in `config/invitations.env` (or saved `.env`), then restart the backend.

Startup should show:

```
EMAIL provider: smtp
[Email invitation provider] SmtpEmailInvitationProvider selected
SMTP connection verify: ok
```

## Gmail SMTP (local test)

In `config/invitations.env`:

```env
EMAIL_PROVIDER=smtp
APP_PUBLIC_BASE_URL=http://localhost:63052
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM="ImpactLoop <your@gmail.com>"
```

Use a [Gmail App Password](https://support.google.com/accounts/answer/185833), not your normal account password.

## Real SMTP (production / real email flow)

Set these in `apps/backend/.env` (do not commit real credentials):

```env
EMAIL_PROVIDER=smtp

# Must match the Flutter web URL in your browser address bar (not port 4000)
APP_PUBLIC_BASE_URL=http://localhost:YOUR_FLUTTER_WEB_PORT

SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM="ImpactLoop <no-reply@your-domain.com>"
```

Restart the backend after changing env values.

### Flutter web port

Flutter web uses a random port unless you pin it:

```bash
cd apps/frontend
flutter run -d chrome --web-port=51640
```

Then set:

```env
APP_PUBLIC_BASE_URL=http://localhost:51640
```

Invitation links are generated as:

`{APP_PUBLIC_BASE_URL}/invite/accept?token=RAW_TOKEN`

If `APP_PUBLIC_BASE_URL` is missing, invitation creation fails with `APP_PUBLIC_BASE_URL is not configured`.

If `EMAIL_PROVIDER=smtp` and SMTP variables are missing, the invitation is stored but email send returns `sendStatus=FAILED` with a visible `sendError`.

## Local testing without SMTP (mock)

```env
EMAIL_PROVIDER=mock
APP_PUBLIC_BASE_URL=http://localhost:YOUR_FLUTTER_WEB_PORT
```

With mock:

- No real email is sent.
- The backend logs the invite link to the console.
- Admin UI shows a fallback invite link for manual testing.

## Env template

Copy from `apps/backend/.env.example` when available, or use the variables above.

## Notes

- Invitation tokens are never stored in the database; only `tokenHash` is persisted.
- Driver, Moderator, and Admin accounts must be created through admin email invitations.
- Public registration remains limited to Learner and Supplier roles.
