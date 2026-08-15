## Summary

## Changed files

## Documentation
- [ ] Implementation matches updated docs (or docs updated to match code)
- [ ] API/schema changes reflected in `docs/backend/api-catalog.md` and/or `docs/database/*` when applicable
- [ ] User-visible behavior reflected in matching `docs/features/` and `docs/flows/` docs when applicable
- [ ] [product/implementation-status.md](docs/product/implementation-status.md) updated when ship status changed
- [ ] ADR added/updated for accepted architecture decisions
- [ ] No stale links to removed documentation files
- [ ] No docs needed because:

## Verification
- [ ] `flutter analyze` (if frontend changed)
- [ ] `flutter test` (if frontend changed)
- [ ] critical-route a11y smoke (`flutter test test/a11y/critical_route_smoke_test.dart`) when UI routes changed
- [ ] `npm run backend:typecheck` / backend tests (if backend changed)
- [ ] `prisma migrate` / schema check if DB changed
- [ ] manual UI test for user-visible changes

## Risks
