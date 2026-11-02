# syntax=docker/dockerfile:1
# The production image for the Hostinger VPS (deploy/docker-compose.yml,
# docs/deploy-vps.md). Every site on that box is a container behind the shared
# nginx-proxy, so YaadiGo is one too.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Full source plus dev dependencies: what `drizzle-kit migrate` runs from.
FROM deps AS source
COPY . .

# Prerendering reads the catalogue and navigation from Postgres, so the build
# needs the real database. The env arrives as a BuildKit secret mounted for
# this one command and never lands in a layer.
FROM source AS builder
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=build_env,target=/app/.env.local \
    npm run build && npm prune --omit=dev --no-audit --no-fund

FROM node:24-bookworm-slim AS runner
# Chromium prints the quotation and itinerary PDFs (src/lib/pdf/render.js).
# Noto covers ₹ and the Indian scripts in customer names.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-noto-core fonts-noto-color-emoji ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CHROME_PATH=/usr/bin/chromium \
    CHROME_NO_SANDBOX=1
COPY --from=builder --chown=node:node /app ./
# The uploads volume mounts over this; created here so it starts owned by node.
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
