# AGENTS.md — ImpactLoop Project Instructions

## Project Summary

ImpactLoop is a graduation software project that helps learners reuse surplus materials, browse educational projects, find required components using AI, reserve materials, and use internal delivery.

Frontend:
- Flutter for both Mobile and Web from one codebase.

Backend:
- Node.js + Express.js.
- PostgreSQL + PostGIS.
- Prisma ORM.
- Prefer TypeScript for backend unless the team explicitly decides JavaScript.

Core MVP decisions:
- Public registration supports only LEARNER and SUPPLIER.
- DRIVER, MODERATOR, and ADMIN are created through admin invitation links.
- MENTOR role does not exist.
- Delivery is internal only.
- No delivery partners.
- No delivery_requests table.
- Delivery fields live inside reservations.
- Impact is calculated from:
  - materials.status = REUSED
  - materials.reused_at
  - reservations.completed_at
- No subscriptions, featured listings, favorite materials, or saved projects in MVP.

## Development Rules

Cost-control rule:
Do not read broad docs unless needed.
For small bug fixes, read only AGENTS.md, docs/00-ai-docs-router.md, and the exact feature docs required.
Never scan the full repo.
Before editing, list max 8 files you intend to inspect.
If more files are needed, ask first.

Before coding:
1. Read the relevant files inside `/docs`.
2. Explain the implementation plan.
3. List files that will be created or modified.
4. Wait for approval before large changes.

General rules:
- Work in small vertical slices.
- Do not build a whole feature in one giant step.
- Do not modify unrelated files.
- Do not add new dependencies without explaining why.
- Do not change database schema unless the task explicitly asks for it.
- Do not duplicate business logic.
- Keep controllers thin.
- Put business logic in services.
- Validate all request bodies.
- Use consistent API responses.
- Handle loading, empty, and error states in Flutter.
- Build both mobile and web layouts for each Flutter feature.
- Never expose precise individual locations publicly before booking or delivery.
- Never store raw invitation tokens or password reset tokens.

## Backend Rules

- Backend is a modular Express app.
- Backend modules live in `apps/backend/src/modules`.
- Each module should have routes, controller, service, and validation when needed.
- Auth and role checks must be middleware-based.
- Prisma is used for database access.
- Raw SQL is allowed only when needed for PostGIS distance queries.
- Controllers should not contain business logic.
- Services should contain business logic.

## Flutter Rules

- Flutter uses feature-first structure.
- Features live in `apps/frontend/lib/features`.
- Use Riverpod for state management.
- Use GoRouter for navigation.
- Widgets must not call APIs directly.
- Use a data layer and providers/controllers.
- Each feature should support mobile and web using adaptive layouts.

## Testing and Verification

After implementation:
1. Summarize changed files.
2. Explain how to test manually.
3. Run available checks.
4. Mention missing pieces or risks.
5. Update documentation if behavior changes.

Preferred agent workflow:
1. Plan.
2. Implement one small step.
3. Show changed files.
4. Run checks.
5. Explain what remains.

## Documentation Rules

Before editing, read:
- docs/00-ai-docs-router.md

Documentation must be updated when changing:
- API behavior, endpoints, request bodies, response shapes
- Database schema, enums, relations, migrations
- Feature behavior
- User flows
- Shared widgets, reusable UI patterns
- Theme tokens, colors, palettes
- Auth, roles, permissions, delivery, AI credit rules
- Architecture or major technical decisions

If unsure whether documentation is required, ask explicitly before skipping it.

Do not create new documentation files with random names.
Use the official docs structure defined in docs/00-ai-docs-router.md.
