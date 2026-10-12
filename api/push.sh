#!/usr/bin/env bash
set -euo pipefail

REPO="sercanezelhan"
TAG="${1:-latest}"
PLATFORM="linux/amd64"

API_IMAGE="$REPO/sultangazi-api:$TAG"
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "======================================================"
echo "  Bakırköy Nexora — API Docker Push (yalnız API)"
echo "  Image   : $API_IMAGE"
echo "  Platform: $PLATFORM"
echo "  Context : $ROOT"
echo "======================================================"

docker buildx build \
  --platform "$PLATFORM" \
  --push \
  -t "$API_IMAGE" \
  -f "$ROOT/Dockerfile" \
  "$ROOT"

echo ""
echo "Bitti: yalnız API imajı push edildi → $API_IMAGE (tag=$TAG)"
