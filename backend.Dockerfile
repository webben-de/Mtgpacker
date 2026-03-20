# Build stage: compile native deps (better-sqlite3)
FROM --platform=amd64 node:24-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Rebuild better-sqlite3 native bindings for this platform
RUN npm rebuild better-sqlite3

# Runtime stage
FROM --platform=amd64 node:24-alpine

WORKDIR /app

# Copy node_modules with compiled native bindings
COPY --from=builder /app/node_modules ./node_modules

# Copy built API dist
COPY dist/apps/api ./dist/apps/api

# SQLite database persisted via volume mount at /app/data
ENV DB_PATH=/app/data/mtg_packer.db
RUN mkdir -p /app/data

EXPOSE 3333

CMD ["node", "dist/apps/api/main.js"]
