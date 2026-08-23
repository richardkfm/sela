# Multi-stage build for the Next.js app. ADR-0002.
#
# `deps` and `builder` are also used directly by compose.yaml (the `migrate`
# service runs the migration script from the `builder` stage, before the
# `runner` image even needs to exist) — this keeps a single Dockerfile as
# the source of truth for the app image instead of a second, drifting one.

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --frozen-lockfile || pnpm install

# Basemap build (roadmap §5.2, ADR-0003): a separate stage so the JRE +
# curl it needs never end up in the runtime image. ingest/basemap/build.sh
# fetches a small, real, licence-clear OSM extract and runs Planetiler; on
# any failure (no network reaching Geofabrik at build time, etc.) it logs a
# warning and exits 0 without producing an archive — this stage's directory
# always exists, so the COPY below never fails the build either way, and
# the app degrades to a flat ground-colour style with no basemap source
# per lib/basemap/pmtiles-reader.ts.
FROM eclipse-temurin:21-jre-alpine AS basemap
RUN apk add --no-cache curl
WORKDIR /basemap
COPY ingest/basemap/build.sh .
RUN chmod +x build.sh && OUTPUT_PATH=/basemap/pilot.pmtiles ./build.sh

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=basemap --chown=nextjs:nodejs /basemap/ ./data/basemap/
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV PMTILES_PATH=/app/data/basemap/pilot.pmtiles
CMD ["node", "server.js"]
