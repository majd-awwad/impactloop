# Payment Flow (Learner)

Documents the implemented Mock + enforcement-ON payment journey for reservations and delivery fees.

**Feature overview:** [payments.md](../features/payments.md)

**Out of scope:** real PSP, Admin Payment Center, WebSocket payment updates, cron TTL worker.

---

## Happy paths

### Paid pickup (`CARD`)

1. Learner reserves PICKUP with positive `materialSubtotal` and `paymentMethod: CARD`.
2. Supplier accepts → `MATERIAL_SUBTOTAL` PaymentOrder (`CARD`).
3. Learner opens reservation → Pay now → reservation-scoped Mock checkout.
4. One Mock charge → order `PAID`; no Delivery.
5. Pickup code hidden before window; visible inside window.
6. Supplier completes with correct handover code.

### Paid pickup (`CASH`)

1. Learner reserves with `paymentMethod: CASH` (not allowed with `safeDropoffAllowed`).
2. Supplier accepts → `MATERIAL_SUBTOTAL` PaymentOrder (`CASH`, `REQUIRES_PAYMENT`).
3. No checkout — Pay CTA is not used; cash is due at handover.
4. Pickup code/window rules still apply when payment readiness is `fulfillmentReady` for cash.
5. Supplier completes pickup and confirms cash collection when `cashDueAtHandover` is true.

### Free pickup

`materialSubtotal = 0` → no PaymentOrder → no checkout → payment status **not required** → pickup rules still apply (any `paymentMethod`).

### Delivery selected before payment (`CARD`)

Material + fee obligations exist (`CARD`) → one CheckoutSession totaling both → one Mock attempt → both settle atomically → Delivery `WAITING_FOR_DRIVER` once → driver notify after settlement. UI must not say “two separate payments”.

### Delivery with `CASH` material payment

Material obligation remains `CASH` / `REQUIRES_PAYMENT` at handover. Delivery fee (if any) may still be `CARD` and require separate Mock checkout before driver notify — verify combined requirement API for the reservation/group.

### Paid pickup then Request Delivery

Material already PAID → Request Delivery → fee calculated → fee-only PaymentOrder → fee-only checkout → material not recharged → Delivery after fee success.

### Zero-fee delivery

No `DELIVERY_FEE` order → UI “Free delivery” / توصيل مجاني → Delivery when other readiness is met.

### Free material + paid delivery

No material order → fee-only checkout → Delivery after fee payment.

### Flexible delivery

No learner preferred windows → supplier proposes valid window → group attached before checkout → fee snapshot → checkout includes correct obligations → no GET write-repair.

### Shared DeliveryGroup

One fee PaymentOrder → checkout discloses every included learner-facing line → provider total equals session total → resume from another included Reservation restores same active session → Delivery when group readiness is met.

---

## Failure / recovery paths

| Path | Expected |
|------|----------|
| Decline / cancel attempt | No PAID; no Delivery; no code; retry safe |
| Pending + refresh | Session restores from backend; no new charge |
| Double-click / concurrent start | One effective session/attempt |
| Stale `PAYMENT_REQUIRED` notification | Opens reservation checkout; already-paid → nothing to pay |
| Cancel before payment | Session/orders terminal; no fulfillment |
| Cancel + late verified success | Money represented; allocation auto-refund; no fulfillment |
| Refund failure | Order stays PAID; no misleading Pay CTA |

---

## Flutter surfaces

| Route | Role |
|-------|------|
| `/learner/reservations` | List paymentSummary + primary actions |
| `/learner/reservations/:id` | Details, pay, pickup code, request delivery |
| `/learner/checkout/reservation/:id` | Reservation-scoped Mock checkout |
| `/notifications` | Payment notification presentation + deep links |
| `/materials/:id` | Embedded reservation CTA (no invented payment state) |
| `/learner/deliveries/:id` | Delivery details only after payment readiness |

---

## Authorization

Learner B must not read A’s reservation payment requirement, start/restore A’s checkout, act on A’s Mock attempt, or access A’s Delivery via forged deep links. Deep links only build routes; APIs enforce ownership.
