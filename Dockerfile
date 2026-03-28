FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build web

FROM nginx:alpine

COPY --from=builder /app/dist/web/browser /var/www/htdocs
COPY nginx/site.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
