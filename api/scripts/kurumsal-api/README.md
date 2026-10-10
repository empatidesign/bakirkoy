# Kurumsal API → Nexora aktarım scriptleri

> **Tek doğru kaynak:** `sultangazi.bel.tr` → `sbyonetim/projects/projects-content`
> (API: `/api/v2/projects`, 22 tesis). Hizmet Tesislerimiz sayfasında **yalnız bu 22 tesis**
> bulunmalıdır.
>
> ⚠️ Şehir rehberi (`/sultangazi/city-guides`) tesis kaynağı **DEĞİLDİR**. 2026-09-07'de
> oradan 9 kayıt (İSMEK'ler, kurs merkezleri) yanlışlıkla aktarıldı ve sonra geri alındı —
> İSMEK'ler belediye hizmet tesisi değildir.

## proje-tesis-aktar.mjs — Projeler kaynağı (asıl tesis verisi)

Panel: `sultangazi.bel.tr/sbyonetim/projects/projects-content`
API karşılığı: **`/api/v2/projects`** — 22 belediye tesisi, **açıklama + adres + resim galerisi** ile.

Bu, `tesis-aktar.mjs`'in kullandığı şehir rehberinden **daha zengin** kaynaktır:
liste ucu id/title/description(HTML), detay ucu ayrıca `address`, `map`, `gallery[]` döner.

```bash
export SG_CLIENT_SECRET=...
node proje-tesis-aktar.mjs                  # kuru çalıştırma
node proje-tesis-aktar.mjs --silmeyi-planla # + kaynakta olmayan Nexora tesislerini RAPORLA
node proje-tesis-aktar.mjs --uygula         # eşleşenleri güncelle, olmayanları ekle
```

### Resimler nasıl aktarılır (önemli)

`ServiceFacilityManagementService.ToImage()` gelen `url` alanını **yok sayar**
(`Url = ""`); genel URL daima `FileUrl.Public(image.Id)` ile üretilir. Yani dış bağlantı
(`sultangazi.bel.tr/uploads/...`) doğrudan kaydedilemez — kayıt oluşur ama **resimler boş
görünür**. Script bu yüzden her resmi indirip `POST /service-facilities/images` ile Nexora'nın
kendi deposuna yükler ve dönen `ObjectName`'i kullanır.

Sonuç (2026-09-07): 22 tesis, **247 resim** yüklendi; örnek doğrulama
`GET /api/v1/files/public/<id>` → `200 image/jpeg`.

### Diğer notlar

- `Description` sütunu **varchar(500)**; uzun proje metinleri kelime sınırında kesilir.
- Bazı eski kayıtlar `parkingType`/`locationType` alanını `"0"` döndürür; aynen geri
  gönderilirse validator 400 verir. Script bunları `Free`/`Indoor` varsayılanına normalize eder.
- İdempotent: ikinci koşuda resimler yeniden yüklenmez ("sg-<id>-<n>" biçimli eski sahte
  kimlikler geçersiz sayılır ve bir kez gerçek yükleme ile değiştirilir).

## ⚠️ Silme (uygulanmadı — onay gerekiyor)

"Kaynakta olmayanları sil" isteği **yıkıcıdır** ve uygulanmamıştır. Ölçülen etki:

| Etki | Adet |
|---|---|
| Nexora'da kaynakta bulunmayan tesis | 35 |
| Bu tesislere bağlı alan tesisi | 47 |
| Bağlı kütüphane | 48 |
| Aktif kütüphane rezervasyonu | 360 |
| Aktif tesis kaydı (vatandaş) | 28.112 |

Silinecekler arasında Engelsiz Yaşam Merkezi, Doğa ve Gençlik Kampı, Kadın ve Aile Yaşam
Merkezi, 29 kütüphane gibi **projects kaynağında hiç bulunmayan ama sistemde aktif kullanılan**
tesisler var. Karar verilmeden önce `--silmeyi-planla` çıktısı incelenmelidir.
