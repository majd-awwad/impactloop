---
name: review-feature
description: Use when reviewing an implemented feature before merging.
---

# Review Feature Skill

When reviewing a feature:

1. Read:
   - AGENTS.md
   - docs/00-ai-docs-router.md
   - docs/02-architecture.md
   - docs/04-api-conventions.md
   - docs/backend/api-catalog.md
   - docs/frontend/reusable-widgets.md
   - docs/07-theme-system.md
   - docs/08-implementation-status.md
   - any feature/docs files selected by docs/00-ai-docs-router.md

2. Check:
   - Does the implementation follow project decisions?
   - Are unrelated files modified?
   - Are request bodies validated?
   - Are auth and role checks correct?
   - Are errors handled consistently?
   - Are Flutter loading, empty, and error states handled?
   - Does the feature support mobile and web?
   - Is there duplicated business logic?
   - Are any secrets hardcoded?
   - Did the developer add dependencies without approval?
   - Are docs updated for API behavior, DB schema/enums/relations, feature behavior, user flows, reusable widgets, theme/tokens/colors, and auth/roles/security changes?

3. Output:
   - Critical issues
   - Important improvements
   - Optional improvements
   - Suggested minimal fixes

4. Documentation:
   - List docs that were updated.
   - If no docs were updated, explain why using docs/00-ai-docs-router.md.
   - If unsure, ask the human explicitly before finalizing.

Do not rewrite the whole feature unless asked.
