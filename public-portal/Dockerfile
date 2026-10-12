FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .

# Boş bırak: kod baseURL'e zaten /api/v1 ekliyor; nginx /api/ -> API_UPSTREAM proxy'ler.
ARG VITE_API_URL=
# Vault'taki PublicApi:ApiKeys (secret/nexora/api/production/main) ile aynı olmalı.
ARG VITE_API_KEY=
# Vatandaş portalının herkese açık üretim adresi (başvuru yönlendirmesi için).
ARG VITE_CITIZEN_PORTAL_URL=
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_API_KEY=${VITE_API_KEY}
ENV VITE_CITIZEN_PORTAL_URL=${VITE_CITIZEN_PORTAL_URL}

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# 2026-08-17: docker-compose.yml'de tek başına "nexora-api" adlı bir servis/container
# yoktur — 3 API instance (nexora-api-1/2/3) nexora-lb (nginx, container içi port 80)
# arkasında yatay ölçeklenir. citizen-portal/admin-panel Dockerfile'larındaki
# "nexora-api:34000" varsayılanı bu topolojiyle uyuşmuyor (Docker network'te sadece
# host'a expose edilen 34000 portu geçerlidir, container-to-container değil); buradaki
# doğru varsayılan nexora-lb'dir. Üretimde gerekirse env ile override edilebilir.
ENV API_UPSTREAM=http://nexora-lb/api/ \
    NGINX_ENVSUBST_FILTER='^(API_UPSTREAM)$'

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1/ || exit 1
