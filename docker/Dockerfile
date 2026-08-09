# Multi-stage build for baseline-cloud (Next.js 16 standalone)
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN NODE_ENV=development npm ci

COPY . .
RUN npm run build

# Stage 2: runtime — slim image with standalone output
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup -g 10001 baseline && adduser -D -G baseline -u 10001 baseline

# Next.js standalone bundle
COPY --from=builder --chown=baseline:baseline /app/.next/standalone ./
COPY --from=builder --chown=baseline:baseline /app/.next/static ./.next/static
COPY --from=builder --chown=baseline:baseline /app/public ./public

USER baseline
EXPOSE 3000

# DATABASE_URL must be set at runtime. No default — fail fast.

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD wget -q -O- http://localhost:3000/api/health | grep -q '"status":"ok"' || exit 1

CMD ["node", "server.js"]
