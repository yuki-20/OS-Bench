FROM node:20-alpine AS deps
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/schemas/package.json packages/schemas/package.json
# `--shamefully-hoist` produces a flat node_modules layout, which Next's
# standalone build can correctly bundle (pnpm symlinks otherwise break the copy).
RUN pnpm install --no-frozen-lockfile --shamefully-hoist

FROM node:20-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages/schemas/node_modules ./packages/schemas/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY apps/web ./apps/web
COPY packages/schemas ./packages/schemas
ENV NEXT_TELEMETRY_DISABLED=1
# Bake a sensible default for NEXT_PUBLIC_* — host-perspective for browser fetch.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ARG NEXT_PUBLIC_APP_NAME="OpenBench OS"
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
RUN pnpm --filter @openbench/web build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY --from=builder /repo/apps/web/.next/standalone ./
COPY --from=builder /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /repo/apps/web/public ./apps/web/public

# The pnpm-shamefully-hoisted node_modules from the builder stage contains the
# real `.pnpm` content that the standalone server.js's symlinks reference.
COPY --from=builder /repo/node_modules ./node_modules

EXPOSE 3000
# next.js standalone produces a top-level server.js inside the build root
# (`/app/server.js`) plus the original workspace tree under `apps/web/`.
CMD ["node", "server.js"]
