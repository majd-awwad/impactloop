---
name: create-flutter-feature
description: Use when creating a new Flutter feature with data, application, and presentation layers.
---

# Create Flutter Feature Skill

When creating a Flutter feature:

1. Read:
   - AGENTS.md
   - docs/00-ai-docs-router.md
   - docs/02-architecture.md
   - docs/04-api-conventions.md
   - any feature/docs files selected by docs/00-ai-docs-router.md

2. Plan:
   - Feature name
   - Screens
   - API endpoints used
   - State management approach
   - Mobile layout
   - Web layout
   - Files to create or modify

3. Create structure:

apps/frontend/lib/features/<feature>/
  data/
  application/
  presentation/
    pages/
    views/
    widgets/

4. Rules:
   - Widgets do not call APIs directly.
   - Use Riverpod providers/controllers.
   - Use Dio through core network client.
   - Add loading, empty, and error states.
   - Support mobile and web layouts.
   - Use shared widgets when possible.

5. After coding:
   - Summarize changed files.
   - Explain how to test.

6. Documentation:
   - List docs that were updated.
   - If no docs were updated, explain why using docs/00-ai-docs-router.md.
   - If unsure, ask the human explicitly before finalizing.