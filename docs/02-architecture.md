# ImpactLoop Architecture

## Repository Style

ImpactLoop uses a monorepo:

impactloop/
  apps/
    backend/
    frontend/
  docs/
  database/
  .cursor/
  AGENTS.md

## Backend Architecture

Backend stack:

- Node.js
- Express.js
- PostgreSQL
- PostGIS
- Prisma ORM
- JWT authentication

Backend style:

- Modular monolith.
- Feature modules.
- Thin controllers.
- Business logic in services.
- Validation before controller/service logic.
- Centralized error handling.
- Auth and role checks as middleware.

Backend folder structure:

apps/backend/src/
  app.ts
  server.ts
  config/
  database/
  middlewares/
  utils/
  modules/
    auth/
    users/
    roles/
    invitations/
    locations/
    materials/
    reservations/
    learning-projects/
    ai-agent/
    notifications/
    admin/
    moderator/
    reports/
    reviews/

Each backend module may contain:

- routes
- controller
- service
- validation
- tests when needed

## Frontend Architecture

Frontend stack:

- Flutter
- Flutter Web
- Riverpod
- GoRouter
- Dio

Frontend style:

- Feature-first.
- Shared widgets.
- Adaptive layouts for mobile and web.
- No API calls directly from widgets.
- Data layer handles API calls.
- Application layer handles state/controllers.
- Presentation layer contains pages, views, and widgets.

Flutter folder structure:

apps/frontend/lib/
  main.dart
  app/
    app.dart
    router/
    theme/
  core/
    network/
    auth/
    responsive/
    errors/
    utils/
  shared/
    widgets/
    components/
  features/
    auth/
    materials/
    reservations/
    delivery/
    learning_hub/
    ai_agent/
    admin/
    moderator/
    reports/
    reviews/

Feature structure:

features/feature_name/
  data/
  application/
  presentation/
    pages/
    views/
    widgets/

## Database Architecture

Database:

- PostgreSQL
- PostGIS extension for distance search.
- Prisma for schema and migrations.
- Raw SQL allowed only for PostGIS queries if Prisma does not support required spatial functions.

Important decisions:

- No delivery_requests table.
- Reservations contain delivery fields.
- No impact_logs table.
- Impact is calculated from source tables.
- No delivery partners.
- No partner drivers.
- No Mentor role.

## API Style

REST API.

Base path:

/api

Example routes:

- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- GET /api/materials
- POST /api/materials
- POST /api/reservations
- PATCH /api/reservations/:id/accept
- POST /api/ai/requests

## Response Format

Success:

{
  "success": true,
  "message": "Operation completed successfully",
  "data": {}
}

Error:

{
  "success": false,
  "message": "Human readable error",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}

## Security Rules

- Hash passwords.
- Store only token hashes for invitation links and reset tokens.
- Validate all input.
- Do not expose exact private locations publicly.
- Use role middleware for protected routes.
- Never hardcode secrets.