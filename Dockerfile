# syntax=docker/dockerfile:1

# Stage 1: Build stage
FROM node:24-slim AS builder

WORKDIR /app

# Enable pnpm via corepack or npm
RUN npm install -g pnpm@9

# Copy workspace configurations
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/learning/package.json ./packages/learning/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Copy source trees
COPY packages/shared ./packages/shared
COPY packages/learning ./packages/learning
COPY apps/api ./apps/api
COPY apps/web ./apps/web

# Build all packages and apps
RUN pnpm -r build

# Stage 2: Production runner
FROM node:24-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_URL=/app/data/mindset.db

# Create non-root user for security hardening
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m mindset && \
    mkdir -p /app/data && \
    chown -R mindset:nodejs /app

# Copy built workspace output
COPY --from=builder --chown=mindset:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=mindset:nodejs /app/packages/shared/package.json ./packages/shared/
COPY --from=builder --chown=mindset:nodejs /app/packages/learning ./packages/learning
COPY --from=builder --chown=mindset:nodejs /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=mindset:nodejs /app/apps/api/package.json ./apps/api/
COPY --from=builder --chown=mindset:nodejs /app/apps/web/dist ./apps/web/dist
COPY --from=builder --chown=mindset:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=mindset:nodejs /app/apps/api/node_modules ./apps/api/node_modules

USER mindset

VOLUME ["/app/data"]

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/healthz').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
