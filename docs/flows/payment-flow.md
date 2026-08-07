# Payment Flow (Learner)

Documents the implemented Mock + enforcement-ON payment journey for reservations and delivery fees.

**Feature overview:** [payments.md](../features/payments.md)

**Out of scope:** real PSP, Admin Payment Center, WebSocket payment updates, cron TTL worker.

---

## Happy paths

### Paid pickup

1. Learner reserves PICKUP with positive `materialSubtotal`.
2. Supplier accepts → `MATERIAL_SUBTOTAL` PaymentOrder.
3. Learner opens reservation → Pay now → reservation-scoped checkout.
4. One Mock charge → order PAID; no Delivery.
5. Pickup code hidden before window; visible inside window.
6. Supplier completes with correct handover code.

### Free pickup

`materialSubtotal = 0` → no PaymentOrder → no checkout → payment status **not required** → pickup rules still apply.

### Delivery selected before payment

Material + fee obligations exist → one CheckoutSession totaling both → one Mock attempt → both settle atomically → Delivery `WAITING_FOR_DRIVER` once → driver notify after settlement. UI must not say “two separate payments”.

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
