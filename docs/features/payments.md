# Payments (current MVP: CASH-only)

ImpactLoop's **current MVP** uses **cash settlement** for payment-bearing flows. Electronic/card payment infrastructure — including provider abstractions, `PaymentOrder` / `PaymentAttempt` lifecycle, checkout sessions, and Mock webhook handling — **remains in the codebase for future integration** but is **not exposed or enabled** in the current product.

**Status:** CASH collection at handover is **active**. CARD/Mock checkout is **dormant** (not mounted in current product). Real PSP / Bank of Palestine / Admin Payment Center are **future work**.

---

## Current product policy

| Aspect | Current MVP |
|--------|-------------|
| New reservations | `paymentMethod` defaults to **`CASH`**; explicit **`CARD`** requests are rejected (`CARD_PAYMENT_DISABLED`) |
| Learner checkout UI | **Not routed** — no Pay now / card checkout screens in active navigation |
| Card checkout API | **Not mounted** in current product (no route registration); re-enable via `payments.product-policy.ts` |
| Historical `CARD` records | **Readable** for audit/admin; no new card checkout actions |
| Schema | `CARD` enum and payment tables **preserved** |

---

## Payment methods (`CARD` vs `CASH`)

`CARD` remains in the schema and API enums for historical compatibility and future reactivation. **Only `CASH` is accepted for new reservation create/quote operations.**

| Method | Current MVP | Dormant infrastructure |
|--------|-------------|----------------------|
| **`CASH`** | Collected at supplier pickup or driver delivery handover; `fulfillmentReady` while order stays `REQUIRES_PAYMENT` | — |
| **`CARD`** | **Not selectable** for new reservations; no active checkout | Mock provider, checkout sessions, webhooks (`payments.checkout-routes.ts`, `payments.service.ts`, etc.) |

**CASH rules (active):**

- `CASH` cannot be combined with `safeDropoffAllowed: true` on reservation create.
- Cash obligations never start electronic checkout.
- Supplier/driver handover requires `cashReceivedConfirmed` when cash is due.
- Payment orders for material subtotal and delivery fee are still created for accounting; settlement happens at handover.

**Related:** [payment-flow.md](../flows/payment-flow.md), [reservations.md](reservations.md), [delivery.md](delivery.md)

---

## Architecture (preserved)

### Accounting obligations (`PaymentOrder`)

| Purpose | Source FK | Meaning |
|---------|-----------|---------|
| `MATERIAL_SUBTOTAL` | `reservationId` only | Material line for one Reservation cycle |
| `DELIVERY_FEE` | `deliveryGroupId` only | Delivery fee for one DeliveryGroup cycle |

Zero-amount obligations create **no** `PaymentOrder` (`NOT_REQUIRED`).

### Dormant electronic checkout (`PaymentCheckoutSession`)

Reservation-scoped sessions, Mock provider attempts, and webhook settlement remain implemented for future CARD reactivation. See `payments.checkout-session.ts`, `payments.checkout-routes.ts`, and provider modules under `payments/providers/`.

---

## Environment contract

| Context | `PAYMENT_PROVIDER` | Card checkout in product |
|---------|-------------------|--------------------------|
| Local development | `mock` or `disabled` | **Off** (code policy; not env-only) |
| Automated tests | varies | Provider suites enable via `setElectronicPaymentEnforcementForTests(true)` |
| Production | `disabled` | **Off** |

Product policy is enforced in `payments.product-policy.ts` — not only by `PAYMENT_PROVIDER`.

---

## API surface (current)

| Route | Status |
|-------|--------|
| `GET /api/payments/reservations/:id/requirement` | **Active** — read payment requirement (CASH semantics) |
| `GET /api/payments/orders/:id` | **Active** — read order (audit/history) |
| `POST .../checkout`, checkout sessions, Mock act/webhook | **Not mounted** in current product |

---

## Reactivation notes (future)

To re-enable CARD in a future release:

1. Set `isCardCheckoutProductEnabled()` to return `true` (or wire to feature flag).
2. Re-register Flutter checkout routes in `app_router.dart`.
3. Restore CARD in reservation payment selector UI.
4. Configure real or Mock `PAYMENT_PROVIDER` with enforcement.

Do **not** drop schema enums/tables when disabling — preserves migration history and historical rows.
