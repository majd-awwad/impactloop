# ImpactLoop Requirements

## Authentication

- Guest can browse limited public content.
- Public registration allows only LEARNER and SUPPLIER.
- DRIVER, MODERATOR, and ADMIN are created by admin invitation links.
- Login is required for reservations, AI usage, publishing materials, and publishing projects.
- Forgot password and OTP use auth_tokens.

## Roles

Stored roles:

- LEARNER
- SUPPLIER
- DRIVER
- MODERATOR
- ADMIN

Rules:

- A user can have more than one role.
- A Learner can become a Supplier.
- Driver cannot self-register.
- Moderator cannot self-register.
- Admin cannot self-register.
- Mentor role does not exist.

## Materials

Supplier can:

- Add material.
- Upload images.
- Add tags.
- Set category, condition, quantity, price/free.
- Set material location and visibility.
- Set pickup_allowed and delivery_allowed.
- Manage own materials.

Learner can:

- Browse materials.
- Search and filter materials.
- View material details.
- Reserve material.

## Reservations

- Learner creates a reservation with status PENDING.
- Supplier accepts or rejects.
- On accept, supplier sets pickup window.
- Material becomes RESERVED after acceptance.
- Material becomes REUSED only after completed self-pickup or delivered internal delivery.

## Delivery

- No delivery_requests table.
- Delivery data is stored inside reservations.
- Learner requests delivery after reservation is accepted.
- Driver sees available reservations with delivery_requested = true and delivery_status = WAITING_FOR_DRIVER.
- Driver accepts delivery.
- Delivery status flow:
  - WAITING_FOR_DRIVER
  - DRIVER_ASSIGNED
  - PICKED_UP
  - ON_THE_WAY
  - DELIVERED
  - CANCELLED
  - FAILED_PICKUP

## Learning Hub

- Learning Hub is for learning only.
- No direct booking inside Learning Hub.
- Projects contain:
  - description
  - difficulty
  - duration
  - images
  - required components
  - steps
  - external links
- Projects are reviewed by Moderator or Admin.

## AI Agent

- AI can generate steps.
- AI can find materials for project required components.
- AI uses credits and usage logs from the beginning.
- AI material matches use:
  - EXACT
  - SIMILAR
  - ALTERNATIVE
  - MISSING

## Admin

Admin can:

- Manage users.
- Manage materials.
- Manage projects.
- Manage reservations.
- Manage deliveries.
- Create Driver invite links.
- Create Moderator invite links.
- View AI logs.
- View reports.

## Moderator

Moderator can:

- Review pending projects.
- Review reports.
- Approve, reject, or request edits.
- Hide content according to permissions.
- Cannot manage sensitive roles or system settings.