# ImpactLoop Roadmap

## Phase 0 — Project Setup

Goal:
Create a working monorepo with Flutter and Express.

Tasks:

- Create repo structure.
- Add AGENTS.md.
- Add docs.
- Add Cursor rules.
- Create backend skeleton.
- Create frontend skeleton.
- Add health check.
- Flutter calls backend health endpoint.

Definition of Done:

- Backend runs locally.
- Flutter web runs locally.
- Flutter can call /health.
- Project instructions exist.

## Phase 1 — Auth and Identity

Goal:
Allow Learner and Supplier public registration.

Tasks:

- users
- user_roles
- auth_tokens
- role_invitations
- register
- login
- auth middleware
- role middleware
- Flutter login/register
- Choose Role Learner/Supplier only

Definition of Done:

- Learner can register.
- Supplier can register.
- User can login.
- Flutter stores token.
- /auth/me works.

## Phase 2 — Profiles and Locations

Goal:
Complete Learner and Supplier profiles.

Tasks:

- learner_profiles
- supplier_profiles
- locations
- user_saved_locations
- Complete Learner Profile screen
- Complete Supplier Profile screen
- Select Location screen

Definition of Done:

- Learner profile can be created.
- Supplier profile can be created.
- Location can be saved.
- /users/me returns user + roles + profiles.

## Phase 3 — Materials

Goal:
Supplier can add materials and Learner can browse/search.

Dev A:
- Material Supply
- Add Material
- Edit Material
- My Materials

Dev B:
- Material Discovery
- Materials List
- Search/Filters
- Material Details

Definition of Done:

- Supplier creates material.
- Learner sees material.
- Search/filter works.
- Location privacy respected.

## Phase 4 — Reservations

Goal:
Learner can reserve, Supplier can accept/reject.

Tasks:

- reservations
- reservation_status_history
- reserve material
- incoming reservations
- accept/reject
- pickup window

Definition of Done:

- Reservation starts as PENDING.
- Supplier can accept.
- Material becomes RESERVED.
- Supplier can reject.
- Learner sees reservation status.

## Phase 5 — Learning Hub and AI

Goal:
Learner can browse projects and ask AI for material matching.

Tasks:

- learning_projects
- project_required_components
- project_steps
- ai_requests
- ai_material_matches
- ai_credit_wallets
- ai_usage_logs

Definition of Done:

- Project details show components.
- AI request is created.
- Credits are checked.
- AI matching returns Exact/Similar/Alternative/Missing.

## Phase 6 — Internal Delivery

Goal:
Internal delivery works from accepted reservations without external delivery partners.

Tasks:

- request delivery
- driver available deliveries
- driver assignment
- picked up
- on the way
- delivered
- failed pickup

Definition of Done:

- No delivery_requests table.
- Delivery lifecycle is stored in the internal delivery domain; legacy reservation delivery fields are compatibility only.
- Driver accepts delivery.
- Delivered makes reservation COMPLETED and material REUSED.

## Phase 7 — Admin and Moderator

Goal:
Admin and Moderator can manage system content.

Tasks:

- admin dashboard
- users management
- drivers overview
- moderator review queue
- reports
- reviews
- AI logs

Definition of Done:

- Admin can view system stats.
- Moderator can approve/reject projects.
- Reports can be reviewed.
