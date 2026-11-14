# MIPAAS web app (Next.js standalone server). Build context: apps/frontend
#   docker build -t mipaas-web --build-arg NEXT_PUBLIC_API_ORIGIN=http://api:8080 apps/frontend
# The API and assistant addresses are compiled into the rewrite rules, so they are build
# arguments: they must be the addresses the web container uses to reach those services.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG NEXT_PUBLIC_API_ORIGIN=http://api:8080
ARG MIPAAS_CHAT_ORIGIN=http://agents:8200
ENV NEXT_PUBLIC_API_ORIGIN=$NEXT_PUBLIC_API_ORIGIN \
    MIPAAS_CHAT_ORIGIN=$MIPAAS_CHAT_ORIGIN \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
