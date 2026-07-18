FROM node:22-bookworm-slim AS dependencies
WORKDIR /build/web
COPY web/package.json web/package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /build/web
COPY --from=dependencies /build/web/node_modules ./node_modules
COPY web/ ./
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app/web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV SARANOTE_DATA_DIR=/app/web/data
ENV SARANOTE_PROJECT_ROOT=/app/project
ENV SARANOTE_PYTHON=/app/project/.venv/bin/python

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates ffmpeg poppler-utils python3 python3-venv \
  && rm -rf /var/lib/apt/lists/* \
  && python3 -m venv /app/project/.venv \
  && /app/project/.venv/bin/pip install --no-cache-dir httpx==0.28.1 \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir -p /app/web/data \
  && chown nextjs:nodejs /app/web/data

COPY --from=builder --chown=nextjs:nodejs /build/web/public ./public
COPY --from=builder --chown=nextjs:nodejs /build/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /build/web/.next/static ./.next/static
COPY src /app/project/src
COPY configs /app/project/configs

USER nextjs
EXPOSE 3000
VOLUME ["/app/web/data"]
CMD ["node", "server.js"]
