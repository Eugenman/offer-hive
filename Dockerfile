# syntax=docker/dockerfile:1

# Offerhive as a self-contained Node.js server.
#   docker build -t offerhive .
#   docker run -p 3000:3000 offerhive

ARG NODE_VERSION=24
ARG BUN_VERSION=1.4.4

FROM oven/bun:${BUN_VERSION} AS bun

# Dependencies, in their own layer so they're reused while only the code changes.
FROM node:${NODE_VERSION}-slim AS deps
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build with Node (bun installs and runs the scripts) into .next/standalone.
FROM node:${NODE_VERSION}-slim AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# public/ may be empty, and git doesn't keep empty folders.
RUN mkdir -p public && bun run build

# Runtime: only the standalone server, static files and public assets, as a non-root user.
FROM node:${NODE_VERSION}-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nextjs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
