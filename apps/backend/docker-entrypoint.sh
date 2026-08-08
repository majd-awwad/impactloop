#!/bin/sh
set -eu

if [ "${SKIP_DB_MIGRATIONS:-}" != "1" ]; then
  echo "[entrypoint] Applying database migrations..."
  npx prisma migrate deploy
fi

echo "[entrypoint] Starting API (upload root: ${UPLOAD_ROOT_DIR:-apps/backend/uploads})"
exec "$@"
