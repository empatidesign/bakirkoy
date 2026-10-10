# Public Portal (Nexora)

Üyelik/token gerektirmeyen, herkese açık **görüntüleme** servisi. Belediye
etkinliklerini ve hizmet tesislerini (tarih, saat, mekan, kapasite, çalışma
saatleri vb.) kimlik doğrulaması olmadan gösterir. "Başvur" tıklanınca
kullanıcı mevcut Vatandaş Portalına (`citizen-portal`, örn.
`sultansehir.sultangazi.bel.tr`) yönlendirilir — orada giriş/kayıt olup
başvuruyu tamamlar.

## Neden ayrı bir servis?

- `citizen-portal` tüm rotaları `ProtectedRoute` ile korur (giriş şart).
- Bu servis, mevcut `api`/`admin-panel`/`citizen-portal` sistemlerine
  **hiç dokunmadan**, backend'de zaten var olan token'sız
  `GET /api/v1/public/*` uçlarını (X-Api-Key ile korumalı, bkz.
  `Nexora.Api/Endpoints/Public/PublicCatalogEndpoints.cs`) tüketir.
- Dış sitelere (belediye ana sitesi vb.) iframe/link olarak gömülebilir.

## Geliştirme

```bash
npm install
npm run dev   # http://localhost:3200
```

`.env.local` içinde `VITE_API_URL` boş bırakılmalı (Vite dev proxy `/api`
isteklerini `API_PROXY_TARGET`'e — varsayılan `localhost:5207` — yönlendirir).
`VITE_API_KEY`, backend `PublicApi:ApiKeys` (appsettings/Vault) ile eşleşmeli.

## Üretim

```bash
docker build \
  --build-arg VITE_API_KEY=<vault-public-key> \
  --build-arg VITE_CITIZEN_PORTAL_URL=https://sultansehir.sultangazi.bel.tr \
  -t nexora-public-portal .
```

nginx katmanı `/api/` isteklerini `API_UPSTREAM` (varsayılan
`http://nexora-api:34000/api/`) adresine proxy'ler; SPA fallback ve statik
asset cache'i `citizen-portal`/`admin-panel` ile aynı desendedir.

## Sayfalar

| Rota | Açıklama |
|---|---|
| `/` | Karşılama |
| `/etkinlikler` | Etkinlik listesi + arama/kategori filtresi + detay modalı |
| `/tesisler` | Hizmet tesisleri listesi + arama |
| `/tesisler/:id` | Tesis detayı (adres, çalışma saatleri, hizmetler, o tesisteki etkinlikler) |

Etkinlik detayındaki "Vatandaş Portalında Başvur" butonu
`{VITE_CITIZEN_PORTAL_URL}/etkinlikler?eventId=<id>` adresine yeni sekmede
açılır; `citizen-portal` bu deep-link'i zaten destekliyor (bkz.
`citizen-portal/src/modules/events/DiscoverTab.tsx`, `eventId` query param
handling — 2026-08-02 tarihli kullanıcı isteği notu).
