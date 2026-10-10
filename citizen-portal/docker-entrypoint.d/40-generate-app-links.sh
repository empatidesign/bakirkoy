#!/bin/sh
set -eu

well_known_dir=/usr/share/nginx/html/.well-known
mkdir -p "$well_known_dir"

android_sha256_compact=$(printf '%s' "${ANDROID_APP_SHA256:-}" | tr -d ':')
case "$android_sha256_compact" in
  *[!0-9A-Fa-f]*|'')
    echo >&2 "App Links: ANDROID_APP_SHA256 tanımlı değil veya geçersiz; assetlinks.json üretilmedi."
    ;;
  *)
    if [ "${#android_sha256_compact}" -ne 64 ]; then
      echo >&2 "App Links: ANDROID_APP_SHA256 32 baytlık SHA-256 değil; assetlinks.json üretilmedi."
    else
    cat >"$well_known_dir/assetlinks.json" <<EOF
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.sultansehir",
      "sha256_cert_fingerprints": ["${ANDROID_APP_SHA256}"]
    }
  }
]
EOF
    fi
    ;;
esac

case "${APPLE_TEAM_ID:-}:${APPLE_BUNDLE_ID:-}" in
  *[!A-Za-z0-9.:_-]*|:|:*|*:)
    echo >&2 "Universal Links: APPLE_TEAM_ID/APPLE_BUNDLE_ID tanımlı değil veya geçersiz; AASA üretilmedi."
    ;;
  *)
    cat >"$well_known_dir/apple-app-site-association" <<EOF
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "${APPLE_TEAM_ID}.${APPLE_BUNDLE_ID}",
        "paths": ["/kampanya/*"]
      }
    ]
  }
}
EOF
    ;;
esac
