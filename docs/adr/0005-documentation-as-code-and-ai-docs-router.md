# ADR 0005: Documentation As Code And AI Docs Router

## Status
Accepted

## Context

ImpactLoop keeps project documentation in the repository. Agents and contributors are directed by `AGENTS.md` and `docs/00-ai-docs-router.md`, with code-derived inventories documenting the current implementation.

## Decision

Use documentation-as-code for project architecture, implementation status, API/database/frontend inventories, feature docs, flow docs, and ADRs.

AI coding agents must use:

- `AGENTS.md` for project rules and MVP decisions.
- `docs/00-ai-docs-router.md` to decide which docs to read and update.
- Code-derived docs as current implementation references.

Docs must be updated when behavior, API contracts, database schema, roles, delivery, theme tokens, reusable UI, or architecture decisions change.

## Consequences

- Docs changes are part of feature and architecture work, not a separate afterthought.
- Agents must verify against code and implementation-status docs before claiming behavior exists.
- ADRs should record accepted decisions only when proven by current docs or code.
- Older requirements and roadmap docs remain context, not implementation proof.

## Current implementation evidence

- [AGENTS.md](../../AGENTS.md) requires reading relevant docs before coding and updating documentation for behavior/API/DB/theme/shared UI/architecture changes.
- [docs/00-ai-docs-router.md](../00-ai-docs-router.md) defines which docs to read/update for Flutter, backend API, database, auth/security, and feature/flow changes.
- [docs/08-implementation-status.md](../08-implementation-status.md) explicitly distinguishes implemented, partial, mock-only, backend-only, frontend-only, and not implemented status.
- [README.md](../../README.md) points contributors to the documentation index and code-derived inventories.
- [docs/00-ai-docs-router.md](../00-ai-docs-router.md) marks ADRs as the location for major design decisions.

## Related docs

- [AGENTS.md](../../AGENTS.md)
- [docs/00-ai-docs-router.md](../00-ai-docs-router.md)
- [docs/08-implementation-status.md](../08-implementation-status.md)
- [README.md](../../README.md)
