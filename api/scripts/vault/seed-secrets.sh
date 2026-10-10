#!/bin/sh
# Vault "dev mode" bellekte çalışır: konteyner her yeniden başladığında (deploy,
# sunucu reboot, `docker compose down`) TÜM sırlar sıfırlanır. VaultSecretManager.cs
# JwtSettings:SecretKey'i bulamayınca Program.cs güvenlik gereği başlamayı reddeder,
# 3 API instance'ı da sürekli crash-loop'a girer (2026-09-04'te canlıda yaşandı —
# "şifre değiştir" dahil TÜM istekler 502/boş cevap döndü).
#
# Bu script vault healthy olur olmaz gerekli tüm kategori/anahtarları otomatik
# yeniden yazar, böylece bir sonraki restart'ta manuel müdahaleye gerek kalmaz.
# JWT/QR anahtarları ilk kurulumda rastgele üretilir ve host'ta kalıcı bir dosyada
# saklanır (/vault-seed-state/*.key) — her Vault restart'ında AYNI anahtar
# yeniden yazılır, aksi halde her restart'ta üretilen yeni JWT secret tüm aktif
# oturumları geçersiz kılardı.
set -eu

VAULT_ADDR="${VAULT_ADDR:-http://nexora-vault:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-nexora-dev-root-token}"
export VAULT_ADDR VAULT_TOKEN

STATE_DIR="/vault-seed-state"
mkdir -p "$STATE_DIR"

rand_key() {
  # 48 rastgele bayt, base64 -> JWT/QR SecretKey (32 bayt asgari şartını rahatça karşılar)
  head -c 48 /dev/urandom | base64 | tr -d '\n'
}

persist_key() {
  file="$STATE_DIR/$1"
  if [ ! -s "$file" ]; then
    rand_key > "$file"
  fi
  cat "$file"
}

echo "[vault-seed] Vault'un ayakta olması bekleniyor..."
until vault status >/dev/null 2>&1; do sleep 1; done

JWT_SECRET=$(persist_key jwt-secret.key)
QR_SECRET=$(persist_key qr-secret.key)
PUBLIC_API_KEY=$(persist_key public-api.key)

echo "[vault-seed] database kategorisi yazılıyor..."
vault kv put secret/nexora/api/production/production/database \
  "ConnectionStrings:PostgreSQL=Host=nexora-postgres;Port=5432;Database=bakirkoy;Username=nexora_admin;Password=${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required};Maximum Pool Size=200;Minimum Pool Size=10" \
  "ConnectionStrings:Redis=nexora-redis:6379,password=${REDIS_PASSWORD:?REDIS_PASSWORD is required}" >/dev/null

echo "[vault-seed] main kategorisi yazılıyor..."
vault kv put secret/nexora/api/production/production/main \
  "JwtSettings:SecretKey=${JWT_SECRET}" \
  "QrSettings:SecretKey=${QR_SECRET}" \
  "PublicApi:ApiKeys:0=${PUBLIC_API_KEY}" >/dev/null

echo "[vault-seed] external kategorisi yazılıyor..."
# 2026-09-20 bulgusu: CorporateApi:ClientId/ClientSecret bu external kategorisinde
# HİÇ yazılmıyordu (yalnızca Minio vardı). appsettings.Production.json'da bilerek boş
# bırakıldığı için (madde 2, sır git'e girmesin diye) ve appsettings.Development.json
# ASPNETCORE_ENVIRONMENT=Production'da hiç yüklenmediği için CorporateApiProxyService
# _clientId/_clientSecret'ı hep boş görüyordu — /navigation/banner(s), /news,
# /announcements, /municipal/popup gibi TÜM kurumsal proxy uçları 500 dönüyordu
# ("[Nexora.Infrastructure.Services.CorporateApiProxyService] CorporateApi:ClientId/
# ClientSecret yapılandırılmamış."). Değerler env değişkeninden beklenir (diğer
# credential'larla aynı desen); yerel geliştirmede appsettings.Development.json'daki
# ile AYNI (zaten git'te duran) değerlere düşer, prod'da .env ile override edilir.
vault kv put secret/nexora/api/production/production/external \
  "MinioSettings:Endpoint=nexora-minio:9000" \
  "MinioSettings:AccessKey=nexora_minio" \
  "MinioSettings:SecretKey=NexoraMinio2026!" \
  "CorporateApi:BaseUrl=${CORPORATE_API_BASE_URL:-https://www.bakirkoy.bel.tr/api/v2}" \
  "CorporateApi:ClientId=${CORPORATE_API_CLIENT_ID:-sg_7a941fd2e836f251}" \
  "CorporateApi:ClientSecret=${CORPORATE_API_CLIENT_SECRET:-cb2fe457413c1c6fd886187febf30216dde8a60a5ccbb4fc}" \
  "Nvi:Username=${NVI_USERNAME:-}" \
  "Nvi:Password=${NVI_PASSWORD:-}" >/dev/null

# Bulgu (2026-09-22): Nvi:Username/Nvi:Password bu external kategorisine HİÇ
# yazılmıyordu (yalnızca CorporateApi/Minio vardı) — Production ortamında
# (appsettings.Production.json: Nvi:UseMockMode=false, yani GERÇEK NVI servisi
# kullanılıyor) NviService her çağrıda boş kimlik bilgisiyle erken "return Fail()"
# ile dönüyordu; hem yetişkin hem çocuk kütük sorgusu (kayıt, giriş, NVİ'den Yenile)
# hiçbir zaman sonuç getirmiyordu. NVI_USERNAME/NVI_PASSWORD artık diğer
# kimlik bilgileriyle (CORPORATE_API_*) AYNI desende host'un .env dosyasından
# beklenir — .env'de boşsa Vault'a boş yazılır ve NviService yine Fail() döner
# (appsettings.Production.json Nvi:UseMockMode=false olduğu sürece burada mock'a
# sessizce düşülmez, bu KASITLI: prod'da sahte NVİ verisiyle gerçek vatandaş
# hesabı açılmasın diye Program.cs'teki leak-guard zaten UseMockMode=true'yu
# prod'da reddediyor). Gerçek kullanım için host .env'ine
# NVI_USERNAME=... / NVI_PASSWORD=... eklenip container'lar yeniden
# oluşturulmalı (docker compose up -d --force-recreate nexora-api-1 nexora-api-2
# nexora-api-3) — vault-seed container'ı her restart'ta bu script'i otomatik koşar.
echo "[vault-seed] Tamamlandı: database/main/external kategorileri dolduruldu."
if [ -z "${NVI_USERNAME:-}" ] || [ -z "${NVI_PASSWORD:-}" ]; then
  echo "[vault-seed] UYARI: NVI_USERNAME/NVI_PASSWORD boş — gerçek NVİ kütük sorgusu (kayıt/giriş/çocuk listesi) Fail() dönecek. Host .env dosyasına gerçek NVİ kullanıcı adı/şifresini ekleyin."
fi
