# ImpactLoop frontend

Flutter client for ImpactLoop (web and mobile). Feature code lives under `lib/features/`; routing uses GoRouter; state management uses Riverpod.

## Run locally

```bash
flutter pub get
flutter run -d chrome   # or another device
```

The API defaults to `http://localhost:4000` in development. Release builds require `API_BASE_URL` or `API_USE_SAME_ORIGIN` — see [docs/deployment.md](../../docs/deployment.md).

## Documentation

- [Repository README](../../README.md) — project overview and setup
- [docs/frontend/routes-map.md](../../docs/frontend/routes-map.md) — routes and guards
- [docs/development/local-development.md](../../docs/development/local-development.md) — full local setup
