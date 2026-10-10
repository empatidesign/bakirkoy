#!/usr/bin/env bash
set -euo pipefail

REPO="sercanezelhan"
TAG="${1:-latest}"
PLATFORM="linux/amd64"

API_IMAGE="$REPO/sultangazi-api:$TAG"
FRONT_IMAGE="$REPO/sultangazi-front:$TAG"
MOBIL_IMAGE="$REPO/sultangazi-mobil:$TAG"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "======================================================"
echo "  Sultangazi Nexora — Docker Push"
echo "  Tag    : $TAG"
echo "  Platform: $PLATFORM"
echo "======================================================"

echo ""
echo ">>> [1/3] api → $API_IMAGE"
docker buildx build \
  --platform "$PLATFORM" \
  --push \
  -t "$API_IMAGE" \
  -f "$ROOT/api/Dockerfile" \
  "$ROOT/api"

echo ""
echo ">>> [2/3] admin-panel → $FRONT_IMAGE"
docker buildx build \
  --platform "$PLATFORM" \
  --push \
  -t "$FRONT_IMAGE" \
  --build-arg VITE_API_KEY=nxr-tst-s8g3z6a1b9c4d7e2f5h0i3j6 \
  -f "$ROOT/admin-panel/Dockerfile" \
  "$ROOT/admin-panel"

echo ""
echo ">>> [3/3] citizen-portal → $MOBIL_IMAGE"
docker buildx build \
  --platform "$PLATFORM" \
  --push \
  -t "$MOBIL_IMAGE" \
  --build-arg VITE_API_KEY=nxr-tst-s8g3z6a1b9c4d7e2f5h0i3j6 \
  -f "$ROOT/citizen-portal/Dockerfile" \
  "$ROOT/citizen-portal"

echo ""
echo "======================================================"
echo "  Tüm imajlar DockerHub'a push edildi: tag=$TAG"
echo "  $API_IMAGE"
echo "  $FRONT_IMAGE"
echo "  $MOBIL_IMAGE"
echo "======================================================"
