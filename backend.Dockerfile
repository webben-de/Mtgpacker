FROM node:24-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build api
RUN npm prune --omit=dev

FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist/api ./dist/api

ENV NODE_ENV=production
ENV DB_PATH=/app/data/mtg_packer.db

RUN mkdir -p /app/data

EXPOSE 3333

CMD ["node", "dist/api/main.js"]
