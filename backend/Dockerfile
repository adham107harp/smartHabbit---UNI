# ------- build stage -------
FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first so npm ci caches when src changes
COPY package*.json tsconfig.json ./
RUN npm ci

# Now compile the TypeScript
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
RUN npx tsc

# ------- runtime stage -------
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install prod deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Bundle compiled output + the runtime assets we still need at startup
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/migrations  ./migrations
COPY --from=builder /app/scripts     ./scripts

# Where user uploads live (mounted as a volume in compose)
RUN mkdir -p ./uploads/avatars

# v4 hardening: run as an unprivileged user, not root.
# A compromise of the node process now stays inside the container's
# nodejs user instead of getting root-equivalent capabilities.
RUN addgroup -g 1001 -S nodejs \
 && adduser -S nodejs -u 1001 -G nodejs \
 && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
