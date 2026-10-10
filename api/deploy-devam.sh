#!/usr/bin/env bash
# Deploy'un push adımını tamamlar.
#
# 2026-09-07: ./push.sh çalıştırıldığında imaj BAŞARIYLA derlendi ama DockerHub push'u
# "insufficient_scope: authorization failed" ile reddedildi — makinede `hushboard`
# hesabıyla giriş yapılmış, imaj ise `sercanezelhan/` deposuna gidiyor.
#
# Kullanım:
#   ./deploy-devam.sh              → doğru hesapla giriş yapıp push eder
#   ./deploy-devam.sh <tag>        → belirli bir tag ile
set -euo pipefail

REPO="sercanezelhan"
TAG="${1:-latest}"
IMAGE="$REPO/sultangazi-api:$TAG"

echo "Mevcut DockerHub kimliği:"
docker-credential-desktop list 2>/dev/null | tr ',' '\n' | grep -i "docker.io" || echo "  (bulunamadı)"
echo ""

if ! docker push "$IMAGE" 2>/dev/null; then
  echo "Push reddedildi. '$REPO' hesabına giriş gerekiyor:"
  docker logout
  docker login -u "$REPO"
  docker push "$IMAGE"
fi

echo ""
echo "✅ Push tamam: $IMAGE"
echo "   Sunucuda: docker compose pull && docker compose up -d"
