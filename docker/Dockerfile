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
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
