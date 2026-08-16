# Payment Flow (Learner)

Documents payment journeys for the **current MVP (CASH-only)** and preserved dormant CARD infrastructure.

**Feature overview:** [payments.md](../features/payments.md)

**Current product:** cash settlement at handover. Electronic/card checkout is **not** exposed in the UI or active API.

**Out of scope (current):** active real PSP, Admin Payment Center, WebSocket payment updates.

---

## Current MVP happy paths

### Paid pickup (`CASH` — default)

1. Learner reserves PICKUP with positive `materialSubtotal` (`paymentMethod` defaults to `CASH`).
2. Supplier accepts → `MATERIAL_SUBTOTAL` PaymentOrder (`CASH`, `REQUIRES_PAYMENT`).
3. No electronic checkout — amount due in cash at handover.
4. Pickup code hidden before window; visible inside window when `fulfillmentReady`.
5. Supplier completes pickup and confirms cash collection when `cashDueAtHandover` is true.

### Free pickup

`materialSubtotal = 0` → no PaymentOrder → payment status **not required** → pickup rules still apply.

### Delivery with `CASH`

Material and delivery-fee obligations remain `CASH` / `REQUIRES_PAYMENT` until handover. Driver/supplier confirms cash collection at delivery/pickup as applicable. No card checkout gate blocks dispatch for cash reservations.

### Zero-fee delivery

No `DELIVERY_FEE` order → UI “Free delivery” → Delivery when other readiness is met.

---

## Dormant CARD paths (infrastructure retained, not active)

The following flows remain implemented in code for future reactivation but are **not** reachable in the current product:

- Paid pickup (`CARD`) with Mock checkout
- Combined material + fee card checkout session
- Fee-only card checkout after material paid
- Shared DeliveryGroup card checkout disclosure

See `payments.checkout-routes.ts`, `learner_checkout_page.dart`, and provider modules.

---

## Historical records

Reservations and payment orders with `paymentMethod: CARD` from before the cash-only policy remain readable. They do not expose new checkout actions in the current UI/API.

---

## Error codes (reference)

| Code | Meaning |
|------|---------|
| `CARD_PAYMENT_DISABLED` | Explicit `CARD` on new reservation or card checkout API when product policy is off |
| `CASH_PAYMENT_NOT_CHECKOUTABLE` | Checkout attempted on cash obligation (guard in dormant checkout services) |
