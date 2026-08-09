# syntax=docker/dockerfile:1.7
# Multi-stage build for baseline-cloud (Next.js standalone output)

# ── Stage 1: dependencies ──────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --ignore-scripts

# ── Stage 2: builder ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ── Stage 3: runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

ENV NODE_ENV=production
ENV PORT=3007
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 10001 baseline && adduser -D -G baseline -u 10001 baseline

# Next.js standalone bundle
COPY --from=builder --chown=baseline:baseline /app/.next/standalone ./
COPY --from=builder --chown=baseline:baseline /app/.next/static ./.next/static
COPY --from=builder --chown=baseline:baseline /app/public ./public

USER baseline
EXPOSE 3007

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD wget -q -O- http://localhost:3007/api/health | grep -q '"status":"ok"' || exit 1

CMD ["node", "server.js"]
