# ImpactLoop Database Reference

> Historical document — not a source of truth for the current implementation. See [docs/README.md](../../README.md) and [database/schema-overview.md](../../database/schema-overview.md).

> **Stale / aspirational.** This file describes a planned 34-table baseline and tables not in the current schema.
> **Use instead (code-derived):** [database/schema-overview.md](database/schema-overview.md), [database/tables-catalog.md](database/tables-catalog.md), [database/enums.md](database/enums.md).  
> **Source of truth:** `apps/backend/prisma/schema.prisma` (28 models as of last inventory).

## Final Database Baseline

The project uses 34 tables.

## Core Removed Tables

These tables are not part of MVP:

- delivery_partners
- partner_driver_profiles
- materials_favorite
- projects_saved
- requests_delivery
- impact_logs
- impact_summaries
- subscription_plans
- user_subscriptions
- featured_listings

## Main Tables

Identity and access:

- users
- user_roles
- role_invitations
- auth_tokens

Profiles:

- learner_profiles
- student_profiles
- supplier_profiles
- organization_profiles
- driver_profiles
- admin_profiles

Locations:

- locations
- user_saved_locations

Materials:

- categories
- materials
- material_images
- material_tags
- material_pickup_windows

Reservations and delivery:

- reservations
- reservation_status_history
- delivery_status_history
- delivery_location_updates

Learning Hub:

- learning_projects
- project_images
- project_required_components
- project_steps
- project_links
- project_ai_suggestions

AI:

- ai_requests
- ai_material_matches
- ai_credit_wallets
- ai_usage_logs

System:

- notifications
- reviews
- reports

## Important Enums

UserRole:

- LEARNER
- SUPPLIER
- DRIVER
- MODERATOR
- ADMIN

Public signup roles:

- LEARNER
- SUPPLIER

Invitation target roles:

- DRIVER
- MODERATOR
- ADMIN

MaterialStatus:

- AVAILABLE
- PENDING_RESERVATION
- RESERVED
- REUSED
- UNAVAILABLE

ReservationStatus:

- PENDING
- ACCEPTED
- REJECTED
- CANCELLED
- COMPLETED
- EXPIRED

DeliveryStatus:

- WAITING_FOR_DRIVER
- DRIVER_ASSIGNED
- PICKED_UP
- ON_THE_WAY
- DELIVERED
- CANCELLED
- FAILED_PICKUP

ProjectStatus:

- DRAFT
- PENDING_REVIEW
- PUBLISHED
- REJECTED
- ARCHIVED

AIRequestStatus:

- PENDING
- COMPLETED
- FAILED
- LIMIT_REACHED

## Important Database Rules

- users does not contain a role column.
- user_roles supports multiple roles per user.
- Add UNIQUE(user_id, role) on user_roles.
- role_invitations stores token hash only, not raw token.
- auth_tokens handles OTP, email verification, and password reset.
- locations uses PostGIS geography(Point) for distance queries.
- individual locations are approximate or hidden before booking/delivery.
- reservations includes delivery fields.
- material becomes REUSED only after completed self-pickup or delivery.
- impact dashboard uses materials.reused_at and reservations.completed_at.