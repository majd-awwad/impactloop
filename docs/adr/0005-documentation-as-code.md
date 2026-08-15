# ADR 0005: Documentation As Code

## Status
Accepted (revised 2026-08-16)

## Context

ImpactLoop keeps project documentation in the repository alongside application code. Contributors need a single, human-maintained documentation set that reflects what actually ships, without relying on external wikis or stale requirement drafts.

A previous revision of this ADR also mandated an AI documentation router and local agent instruction files. Those approaches were useful during intensive development but are not required for runtime, build, tests, or CI. This revision preserves the documentation-as-code principle and supersedes that routing approach for canonical project documentation.

## Decision

Use **documentation-as-code** for:

- architecture overviews and ADRs
- implementation status and open questions
- API, database, and frontend inventories derived from code
- feature and flow documentation
- operations runbooks (deployment, demo data, observability)

**Canonical navigation** is [docs/README.md](../README.md). The root [README.md](../../README.md) is the graduation-facing entry point.

Documentation must be updated when behavior, API contracts, database schema, roles, delivery, payments, theme tokens, shared UI, or architecture decisions change.

Contributors should verify claims against checked-in code and [product/implementation-status.md](../product/implementation-status.md) before describing features as implemented.

Historical documents under [history/](../history/) and [archive/](../archive/) are retained as evidence and context. They are **not** current runtime truth.

## Consequences

- Documentation changes are part of feature and architecture work, not an afterthought.
- Pull requests that change user-visible behavior should update the matching feature/flow doc and implementation status when appropriate.
- ADRs record accepted decisions supported by current code or canonical docs.
- Aspirational requirements and roadmap documents remain context only.

## Supersedes

- Mandatory dependency on `AGENTS.md` for canonical documentation navigation (file may exist locally but is not part of committed documentation).
- Mandatory dependency on `docs/00-ai-docs-router.md` (removed; navigation consolidated into `docs/README.md`).

## Related docs

- [docs/README.md](../README.md)
- [docs/product/implementation-status.md](../product/implementation-status.md)
- [README.md](../../README.md)
