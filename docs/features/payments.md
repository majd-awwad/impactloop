# Payments (Mock + enforcement-ON)

Reservation and delivery-fee payment lifecycle for learners, with **`CARD`** electronic checkout and **`CASH`** collection at handover.

**Status:** **Implemented** for local Mock + enforcement-ON (PAY-01…PAY-07). Real PSP / Bank of Palestine / Admin Payment Center are **not** implemented.

---

## Payment methods (`CARD` vs `CASH`)

Learners choose `paymentMethod` on reservation create/quote (`CARD` default, `CASH` optional). The value is stored on the reservation and copied to related `PaymentOrder` rows.

| Method | Collection | Checkout | Fulfillment gate |
|--------|------------|----------|------------------|
| **`CARD`** | Electronic (Mock provider when enforcement is on) | `POST /api/payments/reservations/:id/checkout` → Mock attempt | Order must reach `PAID` (or `NOT_REQUIRED` for zero amounts) before pickup codes / driver notify |
| **`CASH`** | Supplier (pickup) or driver (delivery) at handover | **Not checkoutable** — `CASH_PAYMENT_NOT_CHECKOUTABLE` | `fulfillmentReady` while order stays `REQUIRES_PAYMENT`; supplier completion requires cash-collection confirmation when cash is due |

**CASH rules (verified in code):**

- `CASH` cannot be combined with `safeDropoffAllowed: true` on reservation create.
- Cash obligations never start Mock checkout; Flutter Pay CTAs apply to `CARD` only.
- Supplier reservation detail exposes `handoverPayment.cashDueAtHandover` and amount when cash is still due.
- When electronic enforcement is **off** and method is `CARD`, readiness treats payment as disabled/fulfillment-ready for local dev paths (see `payments.readiness.ts`).

**Provider boundary:** Mock checkout (`PAYMENT_PROVIDER=mock`) implements `CARD` settlement only. `CASH` semantics are implemented in the reservation/payment-order lifecycle regardless of provider; production currently uses `PAYMENT_PROVIDER=disabled` without a real PSP.

**Related:** [payment-flow.md](../flows/payment-flow.md), [reservations.md](reservations.md), [delivery.md](delivery.md), [learner-reservation-flow.md](../flows/learner-reservation-flow.md)

---

## Architecture

### Accounting obligations (`PaymentOrder`)

| Purpose | Source FK | Meaning |
|---------|-----------|---------|
| `MATERIAL_SUBTOTAL` | `reservationId` only | Material line for one Reservation cycle |
| `DELIVERY_FEE` | `deliveryGroupId` only | Delivery fee for one DeliveryGroup cycle |

- Zero-amount obligations create **no** `PaymentOrder` (`NOT_REQUIRED`).
- One material order per `(reservationId, cycleNumber)`.
- One fee order per `(deliveryGroupId, cycleNumber)`.
- DB CHECK enforces purpose ↔ source shape (`payment_orders_purpose_source_check`).

### Combined learner checkout (`PaymentCheckoutSession`)

- Reservation-scoped session aggregates current payable obligations (material and/or fee).
- `PaymentCheckoutSessionItem` lines are authoritative; unique per `(sessionId, paymentOrderId)`.
- One Mock provider attempt per active session (`payment_attempts_one_active_per_session_uidx`).
- Verified success settles included items **atomically** (allocation-aware).
- Flutter does **not** auto-chain independent orders.

### Attempt ownership XOR

A `PaymentAttempt` is owned by **exactly one** of:

- legacy `paymentOrderId`, or
- session `checkoutSessionId`

Constraint: `payment_attempts_owner_xor_check`.

---

## Environment contract

| Context | `PAYMENT_PROVIDER` | Notes |
|---------|-------------------|--------|
| Local development | `mock` | `PAYMENT_PROVIDER_MODE=LOCAL` + Mock secrets |
| Automated tests | default enforcement **off** | Payment suites call `setElectronicPaymentEnforcementForTests(true)` |
| Production / current deploy intent | `disabled` | Mock **rejected** at startup when `NODE_ENV=production` |

Required Mock env (see `apps/backend/.env.example`):

- `PAYMENT_MOCK_WEBHOOK_SECRET`
- `PAYMENT_MOCK_CHECKOUT_TOKEN_SECRET`

Do not commit real secrets. Placeholder LOCAL secrets are for development only; SANDBOX rejects known placeholders.

---

## Learner API surface (canonical)

| Method | Path | Role |
|--------|------|------|
| GET | `/api/payments/reservations/:reservationId/requirement` | LEARNER / ADMIN |
| POST | `/api/payments/reservations/:reservationId/checkout` | LEARNER (+ Idempotency-Key) |
| GET | `/api/payments/reservations/:reservationId/checkout-session` | LEARNER / ADMIN |
| GET | `/api/payments/checkout-sessions/:id` | LEARNER / ADMIN |
| POST | `/api/payments/checkout-sessions/:id/cancel-attempt` | LEARNER |
| POST | `/api/payments/mock/checkout/:attemptId/act` | Mock LOCAL only |
| POST | `/api/payments/mock/webhook` | HMAC-signed Mock events |

**Legacy (compatibility):** `POST /api/payments/orders/:id/checkout` remains for older order-owned flows/tests. Learner Flutter UX uses **reservation-scoped** checkout only (`/learner/checkout/reservation/:reservationId`).

---

## Fulfillment gates

### Pickup

Payment ready (material paid or not required) **and** pickup-window rules → pickup / handover code visibility and supplier completion.

### Delivery

All required current material obligations for the group **and** delivery fee paid or not required → create/open Delivery as `WAITING_FOR_DRIVER` and emit driver new-job notifications. Unpaid fee → no Delivery / no driver notify.

---

## Cancellation and refunds

| Case | Behavior |
|------|----------|
| Unpaid cancel/expire | Active session/attempts/orders cancelled; no fulfillment |
| Paid cancel | Allocation-aware refunds per `PaymentOrder` (PAY-03 rules) |
| Combined charge | Refunds per included allocation amounts |
| Late verified success after terminal source | Auto-refund (`LATE_SUCCESS_AFTER_SOURCE_TERMINAL`); no fulfillment leak |
| Refund states | REQUESTED → PENDING → SUCCEEDED / FAILED; failed keeps order PAID without Pay CTA |
| New cycle | New `cycleNumber` when product rules reopen payment after terminal refund |

---

## Notifications

Learner payment notification types:

| Type | Typical destination |
|------|---------------------|
| `PAYMENT_REQUIRED` | Reservation-scoped checkout (server truth on open) |
| `PAYMENT_COMPLETED` | Reservation details (payment focus) |
| `PAYMENT_FULFILLMENT_READY` | Details pickup or fulfillment focus |
| `PAYMENT_REFUND_REQUESTED` | Details payment focus |
| `PAYMENT_REFUNDED` | Details; checkout if new cycle |
| `PAYMENT_REFUND_FAILED` | Resolution focus |
| `PAYMENT_LATE_SUCCESS_REFUND` | Payment focus |
| `PAYMENT_NEW_CYCLE_REQUIRED` | Reservation checkout |
| `PAYMENT_RESOLUTION_REQUIRED` | Resolution focus |

Never trust frozen notification metadata over current requirement/checkout APIs.

---

## Security

- Learner ownership on reservation, requirement, session, attempt, and Delivery reads
- Mock webhook HMAC + replay window
- Mock routes disabled when provider is `disabled`
- Mock prohibited in production startup gate
- No card / PAN / CVV storage
- Backend verified provider events are source of truth (not UI redirects)
- Idempotent provider event processing (`provider` + `providerEventId`)

---

## Reconciliation

- CheckoutSession TTL / expired-session reconcile endpoint exists for learners/admins
- Historical/invariant reconciliation tooling from earlier PAY slices
- **No write-on-read** payment repair on GET requirement/list
- Incomplete recovery rows (positive delivery fee but missing confirmed delivery window / address fields) stay ungrouped until a later writer attaches a group; they do not hard-fail acceptance
- **No cron worker** for payment TTL in local/MVP — known limitation; reconcile is on-demand

---

## Test map (enforcement ON)

Payment suites force `setElectronicPaymentEnforcementForTests(true)` because `NODE_ENV=test` defaults enforcement off.

| Suite | Path / pattern | Covers |
|-------|----------------|--------|
| PAY-01 / 01B | `payments.pay01b.test.ts`, `payments.env.test.ts` | Config / domain foundation |
| PAY-02 / 02R / 02T | `payments.pay02*.test.ts` | Obligations, gating, production accept paths |
| PAY-03 / 03R | `payments.pay03*.test.ts` | Lifecycle, refunds, late success |
| PAY-04 / 04R | `payments.pay04*.test.ts` | Notifications |
| PAY-05A–F | `payments.pay05*.test.ts`, Flutter `*_pay05*` | List/detail/checkout UX, fee gate, sessions, cross-flow |
| PAY-05D / R / R2 | `payments.pay05d*.test.ts` | CheckoutSession matrix, resume, races |
| PAY-06 | `payments.pay06-e2e.test.ts`, `payments.pay06-http-auth.test.ts`, `pay06_ar_mobile_acceptance_test.dart` | Final E2E acceptance |

Run examples (from `apps/backend`):

```bash
npx tsx --test src/modules/payments/payments.pay06-e2e.test.ts
npx tsx --test src/modules/payments/**/*.test.ts
```

Flutter (from `apps/frontend`):

```bash
flutter test test/pay06_ar_mobile_acceptance_test.dart test/pay05f_cross_flow_presentation_test.dart
flutter test test/learner_checkout_pay05c_test.dart test/learner_notifications_pay05e_test.dart
```

---

## Dead / legacy paths

| Path | Status |
|------|--------|
| Flutter `/learner/checkout/reservation/:id` | **Active** learner UX |
| `POST /api/payments/reservations/:id/checkout` | **Active** |
| `POST /api/payments/orders/:id/checkout` | **Legacy compatibility** (tests / older clients); not used by learner Flutter screens |
| Flutter `PaymentsApi.startCheckout(orderId)` | API/repository only; controller uses reservation-scoped start |
| Flutter sibling-order auto-chain | **Removed / guarded** |
| Placeholder checkout / payment-purpose radio | **Not** in active learner UX |
| Write-on-read payment repair on GET | **Not** used; reconcile is explicit |

---

## Local payment demo runbook

1. **Env** — in `apps/backend/.env` set `PAYMENT_PROVIDER=mock`, `PAYMENT_PROVIDER_MODE=LOCAL`, and the two Mock secrets from `.env.example` (or your local values).
2. **Migrate** — `cd apps/backend && npx prisma migrate deploy && npx prisma generate`
3. **Backend** — `npm run dev`
4. **Flutter** — `cd apps/frontend && flutter run -d chrome` (or device)
5. **Create / accept** — learner reserves a positive-price material; supplier accepts
6. **Checkout** — open reservation details → Pay now → `/learner/checkout/reservation/:id`
7. **Mock success** — Complete mock payment; wait for verified success screen
8. **Fulfillment** — pickup: wait for window then code; delivery: confirm `WAITING_FOR_DRIVER`
9. **Decline + retry** — Simulate decline, then retry once
10. **Refund** — exercise eligible refund via existing admin/lifecycle/test paths for Mock refunds

Do not put secrets in docs or commits.
