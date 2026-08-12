# ImpactLoop deployment

This document describes how to run the ImpactLoop backend API in a reproducible, production-style environment. It addresses deployment durability for user uploads and database state.

## Storage contract

The backend stores uploaded files on the **local filesystem** (Multer + Sharp). There is no object-storage backend (S3/MinIO) in this repository yet.

| Asset type | URL prefix | Serving |
|------------|------------|---------|
| Material images | `/uploads/materials/` | Public static |
| Profile images | `/uploads/profiles/` | Public static |
| Supplier verification docs | `/uploads/supplier-verification/` | Private API only |
| Build completion photos | `/uploads/build-completion/` | Private API only |

### Production requirement

In production you **must** mount a persistent volume at `UPLOAD_ROOT_DIR`. Without it, container restarts or rescheduling will lose uploaded files.

- **Docker Compose**: the `upload_data` named volume is mounted at `/data/uploads` (see `docker-compose.yml`).
- **Kubernetes / VM**: mount a persistent volume (PVC, EBS, etc.) at the same path and set `UPLOAD_ROOT_DIR` accordingly.
- **Local development**: defaults to `apps/backend/uploads/` when `UPLOAD_ROOT_DIR` is unset.

Object storage (S3-compatible) is the recommended long-term scaling path but is not implemented here. Until then, treat local disk + persistent volumes as the supported production contract.

## Docker Compose (recommended quick start)

Prerequisites: Docker Engine 24+ with Compose v2.

```bash
# From repository root
cp .env.docker.example .env.docker
# Edit .env.docker — set secrets, CORS_ORIGIN, APP_PUBLIC_BASE_URL, SMTP, etc.

docker compose --env-file .env.docker up --build -d
```

Services:

| Service | Image / build | Port | Persistence |
|---------|---------------|------|-------------|
| `db` | `postgis/postgis:16-3.5` | internal | `postgres_data` volume |
| `api` | `apps/backend/Dockerfile` | `${API_PORT:-4000}` | `upload_data` volume at `/data/uploads` |

The API entrypoint runs `prisma migrate deploy` before starting. Set `SKIP_DB_MIGRATIONS=1` on the container to skip migrations (e.g. when a separate migration job runs them).

### Verify deployment

```bash
curl http://localhost:4000/health
curl http://localhost:4000/health/ready
```

Run production preflight inside the container (or with matching env):

```bash
docker compose --env-file .env.docker exec api \
  node --import tsx /app/apps/backend/scripts/validate-production-config.ts
```

Note: the production image ships compiled JS only; run preflight from a dev checkout or add a CI step that validates `.env.docker` values before deploy.

### Stop and remove

```bash
docker compose --env-file .env.docker down
# Add -v to remove named volumes (destroys DB and uploads):
# docker compose --env-file .env.docker down -v
```

## Environment variables (uploads)

| Variable | Default | Description |
|----------|---------|-------------|
| `UPLOAD_ROOT_DIR` | `apps/backend/uploads` | Absolute or backend-relative root for all upload subdirectories |

Subdirectories created automatically at startup:

- `materials/`, `profiles/`, `supplier-verification/`, `build-completion/`, `.tmp/`

Production preflight (`npm run validate:production-config -w apps/backend`) probes that these directories are writable.

## Building the API image manually

```bash
docker build -f apps/backend/Dockerfile -t impactloop-api .
docker run --rm -p 4000:4000 \
  -e DATABASE_URL=postgresql://... \
  -e UPLOAD_ROOT_DIR=/data/uploads \
  -v impactloop_uploads:/data/uploads \
  impactloop-api
```

## Flutter web (API base URL)

Release web builds must not rely on the development fallback (`same host:4000`). Configure the API endpoint at **build time**:

```bash
cd apps/frontend
flutter build web \
  --dart-define=API_BASE_URL=https://api.your-domain.com
```

If the reverse proxy serves the API on the **same origin** as the Flutter web app (e.g. `https://app.example.com/api` → backend), you can omit `API_BASE_URL` and opt into the same-origin contract:

```bash
flutter build web --dart-define=API_USE_SAME_ORIGIN=true
```

Without either flag, release builds fail at startup with a clear configuration error instead of calling the wrong host.

Local development (`flutter run -d chrome`) continues to default to port `4000` on the current host.

## Reverse proxy

Place nginx, Caddy, or a cloud load balancer in front of the API:

- Set `TRUST_PROXY=1` (or the hop count) so rate limiting and `req.ip` are correct.
- Terminate TLS at the proxy; set `APP_PUBLIC_BASE_URL` and `CORS_ORIGIN` to your public HTTPS origin.
- Proxy `/uploads/materials/*` and `/uploads/profiles/*` if you want the CDN/proxy to cache public media (optional).

## CI alignment

Baseline CI uses Node 22.12.0 and PostGIS 16. The Docker image matches Node 22.12.0 and the same PostGIS major version for parity.

## Demo-only / local development

Local `npm run backend:dev` without Docker continues to use `apps/backend/uploads/` on disk. This is suitable for development and demos only; do not rely on that directory for production durability.

## Recommendation ML (ML_PRIMARY)

Production-capable Learner Home serving uses:

```bash
RECOMMENDATION_ML_RUNTIME_MODE=ML_PRIMARY   # default when unset
RECOMMENDATION_ML_MATERIAL_ARTIFACT_PATH=<portable v2 JSON>
RECOMMENDATION_ML_PROJECT_ARTIFACT_PATH=<portable v2 JSON>
```

- Missing or incompatible artifacts → per-domain NOT_READY → **deterministic fallback** (API still returns 200).
- Explicit rollback: `RECOMMENDATION_ML_RUNTIME_MODE=DETERMINISTIC`.
- Legacy `RECOMMENDATION_ML_*_SERVING_ENABLED` flags were removed — do not configure them.

Validate production config: `npm run validate:production-config -w apps/backend` and `npm run validate:recommendation-release-config -w apps/backend`.

Architecture: [architecture/recommendation-system.md](architecture/recommendation-system.md). Local artifact workflow: [development/local-ml.md](development/local-ml.md).
