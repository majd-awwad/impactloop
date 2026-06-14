# API Conventions

## Base URL

Local:

http://localhost:4000/api

## Response Format

Success:

{
  "success": true,
  "message": "Success message",
  "data": {}
}

Error:

{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "details": {}
  }
}

## Naming

- Use kebab-case for URLs.
- Use camelCase for JSON fields.
- Use plural nouns for resources.

Examples:

- /api/materials
- /api/reservations
- /api/learning-projects
- /api/ai/requests

## Pagination

List endpoints should support:

- page
- limit
- sort

Example:

GET /api/materials?page=1&limit=20&sort=newest

Response:

{
  "success": true,
  "message": "Materials loaded",
  "data": {
    "items": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 0
    }
  }
}

## Auth

Protected routes require:

Authorization: Bearer <token>

## Validation

- Validate body, params, and query.
- Return 400 for invalid input.
- Return 401 for unauthenticated requests.
- Return 403 for unauthorized roles.
- Return 404 for missing resources.
- Return 409 for conflicts.

## Common Error Codes

- VALIDATION_ERROR
- UNAUTHENTICATED
- FORBIDDEN
- NOT_FOUND
- CONFLICT
- INTERNAL_ERROR
- LIMIT_REACHED

## First Endpoints To Build

Health:

GET /health

Auth:

POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
POST /api/auth/forgot-password
POST /api/auth/reset-password

Materials:

GET /api/materials
GET /api/materials/:id
POST /api/materials
PATCH /api/materials/:id

Reservations:

POST /api/reservations
GET /api/reservations/my
GET /api/reservations/incoming
PATCH /api/reservations/:id/accept
PATCH /api/reservations/:id/reject

AI:

POST /api/ai/requests
GET /api/ai/requests/:id
GET /api/ai/credits/me