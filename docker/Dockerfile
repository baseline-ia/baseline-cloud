# Multi-stage build for baseline-cloud
# Stage 1: build with full toolchain
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json drizzle.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY public ./public

RUN npm run build

# Stage 2: runtime — slim image
FROM node:20-alpine AS runtime
WORKDIR /app

# Runtime deps: ca-certificates for TLS to postgres; tzdata for timezones
RUN apk add --no-cache ca-certificates tzdata

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Non-root user
RUN addgroup -g 10001 baseline && adduser -D -G baseline -u 10001 baseline

COPY --from=builder --chown=baseline:baseline /app/package.json /app/package-lock.json* ./
COPY --from=builder --chown=baseline:baseline /app/node_modules ./node_modules
COPY --from=builder --chown=baseline:baseline /app/dist ./dist
COPY --from=builder --chown=baseline:baseline /app/src/db/migrations ./dist/db/migrations
COPY --from=builder --chown=baseline:baseline /app/src/views ./dist/views
COPY --from=builder --chown=baseline:baseline /app/public ./public

USER baseline
EXPOSE 3000

# DATABASE_URL must be set at runtime (in docker-compose env). No default — fail fast.

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
