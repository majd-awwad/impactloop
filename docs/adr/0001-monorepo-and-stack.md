# ADR 0001: Monorepo And Stack Choice

## Status
Accepted

## Context

ImpactLoop is implemented as a single repository with a Flutter frontend and a Node/Express backend. The backend uses TypeScript, Prisma, PostgreSQL, and PostGIS. The root npm workspace currently includes `apps/backend`; the Flutter app lives in `apps/frontend`.

## Decision

Use this project structure and stack for the MVP:

- Flutter for one mobile/web frontend codebase.
- Express with TypeScript for the backend API.
- Prisma ORM with PostgreSQL and PostGIS for persistence and location support.
- A monorepo layout with `apps/backend`, `apps/frontend`, and `docs`.

## Consequences

- Backend and frontend can evolve together with code-derived docs in the same repository.
- Flutter features must support web and mobile layouts where implemented.
- Backend modules should stay modular Express modules with Prisma-backed repositories/services.
- PostgreSQL/PostGIS remains the source for relational data and geospatial location fields.

## Current implementation evidence

- [docs/product/implementation-status.md](../product/implementation-status.md) marks monorepo/backend scripts, Flutter app, PostgreSQL + Prisma, and PostGIS as implemented.
- [package.json](../../package.json) declares the root npm workspace for `apps/backend`.
- [apps/backend/package.json](../../apps/backend/package.json) includes Express, TypeScript, Prisma, PostgreSQL driver, and backend scripts.
- [apps/frontend/pubspec.yaml](../../apps/frontend/pubspec.yaml) defines the Flutter frontend and dependencies including Riverpod, GoRouter, and Dio.
- [docs/database/schema-overview.md](../database/schema-overview.md) documents the current Prisma models and PostGIS use.

## Related docs

- [docs/architecture/system-overview.md](../architecture/system-overview.md)
- [docs/architecture/system-overview.md](../architecture/system-overview.md)
- [docs/product/implementation-status.md](../product/implementation-status.md)
- [docs/database/schema-overview.md](../database/schema-overview.md)
