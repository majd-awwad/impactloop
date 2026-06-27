---
name: create-express-module
description: Use when creating a new Express backend module with routes, controller, service, and validation.
---

# Create Express Module Skill

When creating a backend module:

1. Read:
   - AGENTS.md
   - docs/00-ai-docs-router.md
   - docs/02-architecture.md
   - docs/04-api-conventions.md
   - docs/backend/api-catalog.md
   - docs/08-implementation-status.md
   - any feature/docs files selected by docs/00-ai-docs-router.md

2. Plan:
   - Module name
   - Endpoints
   - Request bodies
   - Response shape
   - Database tables used
   - Auth and role requirements
   - Files to create or modify

3. Create structure:

apps/backend/src/modules/<module>/
  <module>.routes.ts
  <module>.controller.ts
  <module>.service.ts
  <module>.validation.ts

4. Rules:
   - Controllers stay thin.
   - Services contain logic.
   - Validate input.
   - Use async error handling.
   - Do not add dependencies without approval.
   - Do not change database schema unless requested.

5. After coding:
   - Summarize changed files.
   - Explain how to test.

6. Documentation:
   - Update docs/backend/api-catalog.md when endpoint behavior changes.
   - Update docs/08-implementation-status.md when ship status changes.
   - List docs that were updated.
   - If no docs were updated, explain why using docs/00-ai-docs-router.md.
   - If unsure, ask the human explicitly before finalizing.
