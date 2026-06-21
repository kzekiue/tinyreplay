# syntax=docker/dockerfile:1

# ---------- Stage 1: Build ----------
FROM node:20-alpine AS builder
WORKDIR /app

# better-sqlite3 compiles a native addon; provide the toolchain.
RUN apk add --no-cache python3 make g++

# Install dependencies (scripts off for safety, then build only the native dep).
COPY package.json package-lock.json ./
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/server/package.json ./apps/server/
RUN npm ci --ignore-scripts
RUN npm rebuild better-sqlite3

# Build SDK first (server's prebuild copies the SDK bundle into public/sdk).
COPY . .
RUN npm run build -w packages/sdk
RUN npm run build -w apps/server

# ---------- Stage 2: Runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV HOSTNAME=0.0.0.0

# su-exec lets the entrypoint drop from root to the 'node' user after fixing
# the data-dir owner on the bind mount (~10KB, alpine-native).
RUN apk add --no-cache su-exec

# Next.js standalone output bundles a minimal node_modules (incl. better-sqlite3).
COPY --from=builder /app/apps/server/.next/standalone ./
COPY --from=builder /app/apps/server/.next/static ./apps/server/.next/static
COPY --from=builder /app/apps/server/public ./apps/server/public
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3000

# Liveness: hit the health probe with the bundled node (no curl in alpine).
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Entrypoint chowns the data dir then drops to 'node'; CMD is the server.
# server.js is emitted by Next standalone at apps/server/server.js (monorepo layout).
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "apps/server/server.js"]
