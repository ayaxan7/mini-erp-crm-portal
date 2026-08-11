# --- base: shared dependencies ---------------------------------------------
FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- dev: tsx watch with bind-mounted source -------------------------------
FROM base AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

# --- build: compile TypeScript + prune dev deps ----------------------------
FROM base AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY src/views ./views
RUN npm run build && npm prune --omit=dev

# --- prod: slim runtime with chromium for invoice PDF ------------------------
FROM node:20-bookworm-slim AS prod
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/views ./views
EXPOSE 4000
CMD ["node", "dist/server.js"]
