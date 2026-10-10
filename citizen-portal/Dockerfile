FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .

# Bos birak: kod baseURL'e zaten /api/v1 ekliyor; burada /api/v1 verilirse cift olur (/api/v1/api/v1). Istekler goreli olur, nginx /api/ -> API_UPSTREAM proxy'ler.
ARG VITE_API_URL=
# Sabit yazma: Vault'taki ApiKey (secret/nexora/api/test/main) tek kaynak; build-arg ile gecilir.
ARG VITE_API_KEY=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_KEY=${VITE_API_KEY}

ARG APP_BASE=/
RUN npm run build -- --base=${APP_BASE}

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.d/40-generate-app-links.sh /docker-entrypoint.d/40-generate-app-links.sh
RUN chmod 755 /docker-entrypoint.d/40-generate-app-links.sh

ENV API_UPSTREAM=http://nexora-api:34000/api/ \
    HUB_UPSTREAM=http://nexora-api:34000/hubs/ \
    NGINX_ENVSUBST_FILTER='^(API_UPSTREAM|HUB_UPSTREAM)$'

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1
