# ImpactLoop backend API — production image
# Build context: repository root (see docker-compose.yml)

FROM node:22.12.0-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/

RUN npm ci --workspace=apps/backend --include-workspace-root

FROM node:22.12.0-bookworm-slim AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules
COPY package.json package-lock.json ./
COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend

RUN npm run prisma:generate && npm run build

FROM node:22.12.0-bookworm-slim AS runtime

WORKDIR /app/apps/backend

ENV NODE_ENV=production
ENV UPLOAD_ROOT_DIR=/data/uploads

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system impactloop \
  && useradd --system --gid impactloop --home-dir /app impactloop \
  && mkdir -p /data/uploads \
  && chown -R impactloop:impactloop /data/uploads

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/backend/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./dist
COPY --from=build /app/apps/backend/prisma ./prisma
COPY --from=build /app/apps/backend/package.json ./package.json
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && chown -R impactloop:impactloop /app/apps/backend

USER impactloop

EXPOSE 4000

VOLUME ["/data/uploads"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/server.js"]
