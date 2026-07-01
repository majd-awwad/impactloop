# ImpactLoop Requirements

This document describes product requirements and intended scope. It is not implementation proof. For current shipped status, use [08-implementation-status.md](08-implementation-status.md). For role-by-role capability framing, use [features/roles-and-capabilities.md](features/roles-and-capabilities.md).

## Authentication

- Guest can browse limited public content.
- Public registration allows only LEARNER and SUPPLIER.
- DRIVER, MODERATOR, and ADMIN are created by admin invitation links.
- Login is required for reservations, AI usage, publishing materials, and publishing projects.
- Forgot password and OTP use auth_tokens.

## Roles

Primary user roles:

- LEARNER
- SUPPLIER

Operational support roles:

- DRIVER
- MODERATOR
- ADMIN

Unauthenticated access:

- Guest is not a stored role.
- Guests can browse public materials and public projects.
- Login is required before reservation, reporting, saving, liking, following, publishing, or starting a build.

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

Role intent:

- Learner: find materials, learn from projects, reserve materials, and build.
- Supplier: publish surplus materials, handle reservations, coordinate pickup/delivery, and understand demand.
- Driver: support internal delivery coordination.
- Moderator: review content quality issues without full admin permissions.
- Admin: manage users, invitations, approvals, price/category rules, moderation, and analytics.

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
- View approximate public location only before booking.
- See views/popularity signals where exposed.
- Report material issues after login.

Planned learner interactions:

- Save materials.
- Like materials.
- Follow suppliers/categories.
- Discover projects that can use a selected material.

## Reservations

- Learner creates a reservation with status PENDING.
- Supplier accepts or rejects.
- On accept, supplier sets pickup window.
- Reservation quantity may hold part of the material stock.
- Material availability is derived from remaining quantity and active holds.
- Material becomes REUSED only after completed self-pickup or delivered internal delivery.
- Learner can track reservation status.

## Delivery

- No delivery_requests table.
- Delivery is internal only.
- Delivery partner integrations are out of scope.
- Developed delivery lifecycle uses the `deliveries` domain as the source of truth while legacy reservation delivery fields remain compatibility fields.
- Learner requests delivery after reservation is accepted.
- Driver sees available internal delivery jobs.
- Driver accepts delivery.
- Delivery status flow:
  - WAITING_FOR_DRIVER
  - DRIVER_ASSIGNED
  - ARRIVED_PICKUP
  - PICKED_UP
  - ON_THE_WAY
  - ARRIVED_DROPOFF
  - DELIVERED
  - CANCELLED
  - FAILED_PICKUP
  - FAILED_DELIVERY
- Full Uber-style tracking is not required for MVP; basic internal delivery coordination is enough.

## Learning Hub

- Learning Hub is for learning only.
- No direct booking inside Learning Hub in the current MVP path.
- Projects contain:
  - description
  - difficulty
  - duration
  - images
  - required components
  - steps
  - external links
- Projects are reviewed by Moderator or Admin.
- Project detail should eventually connect required materials to available materials.
- A learner may start from a project and find materials, or start from a material and discover projects.

Planned project build support:

- Save project.
- Like project.
- Start build.
- Build checklist with available, missing, alternative, already owned, and reserved states.
- "I already have this" marker so owned components are not treated as missing.

## AI Agent

- AI can generate steps.
- AI can find materials for project required components.
- AI uses credits and usage logs from the beginning.
- AI material matches use:
  - EXACT
  - SIMILAR
  - ALTERNATIVE
  - MISSING
- Price-rule AI for supplier listing governance is separate from learner material-matching AI.

## Admin

Admin can:

- Manage users.
- Manage roles through invitation flows and admin policy.
- Manage materials.
- Manage projects.
- Manage reservations.
- Manage deliveries.
- Create Driver invite links.
- Create Moderator invite links.
- Manage category and material type rules.
- Manage price rules and accepted ranges.
- View AI logs.
- View reports.
- View platform analytics.

## Moderator

Moderator can:

- Review pending projects.
- Review reports.
- Review suspicious listings.
- Review wrong categories.
- Review price issues.
- Review material type/category requests.
- Approve, reject, or request edits.
- Hide content according to permissions.
- Cannot manage sensitive roles or system settings.
