# Local development

Fresh checkout setup for ImpactLoop backend and Flutter client. For **LightFM artifacts and ML_PRIMARY serving**, continue with [local-ml.md](local-ml.md) after the database is seeded.

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js | CI pin `22.12.0` (`.github/workflows/recommendation-ci.yml`) |
| npm | `npm ci` at repository root |
| PostgreSQL + PostGIS | Local `DATABASE_URL`; PostGIS required for location features |
| Flutter | Dart SDK `^3.10.7` per `apps/frontend/pubspec.yaml` |

---

## Environment

1. Copy `apps/backend/.env.example` → `apps/backend/.env` (gitignored).
2. Set at minimum:
   - `DATABASE_URL` — local PostgreSQL
   - `TEST_DATABASE_URL` — isolated test DB (`impactloop_test`, never `impactloop`)
   - `NODE_ENV=development`
3. Migrate test DB once: `npm run test:db:migrate -w apps/backend`

Do not commit secrets.

---

## Install and database

From repository root:

```bash
npm ci
npm run prisma:generate -w apps/backend
npm run prisma:migrate -w apps/backend
npm run prisma:seed -w apps/backend    # destructive core reset
npm run demo:seed -w apps/backend      # additive community demo — see demo-data.md
```

---

## Run backend

```bash
npm run backend:dev
```

Default API: `http://localhost:4000` (`PORT` in env).

Workspace equivalents from `apps/backend/`: `npm run dev`, `npm run build`, `npm run typecheck`.

---

## Run Flutter

```bash
cd apps/frontend
flutter pub get
flutter run -d chrome   # or another device
```

Release builds require `API_BASE_URL` or `API_USE_SAME_ORIGIN` — see [deployment.md](../deployment.md).

---

## Tests (common)

```bash
npm run typecheck -w apps/backend
npm run test:recommendations:ci:pure -w apps/backend
npm run test:database-isolation -w apps/backend
```

Baseline pure tests include known unrelated JWT env failures — see [product/implementation-status.md](../product/implementation-status.md).

---

## Demo learners

After seed: `learner@learner.com`, `majd@learner.com`, `israa@learner.com` (credentials from local seed — do not commit).

---

## Next steps

| Goal | Document |
|------|----------|
| Demo dataset | [demo-data.md](../demo-data.md) |
| ML artifacts + ML_PRIMARY | [local-ml.md](local-ml.md) |
| Recommendation architecture | [architecture/recommendation-system.md](../architecture/recommendation-system.md) |
| Full doc index | [README.md](../README.md) |
