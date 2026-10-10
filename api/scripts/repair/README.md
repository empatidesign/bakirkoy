# DB Onarım Script'leri

Migration geçmişinde "uygulanmış" görünen ama tabloları DB'ye yansımayan
şema drift'lerini gidermek için idempotent (yeniden çalıştırılabilir) SQL script'leri.

## 2026-07-03_repair_mobilemenu_tables.sql
**Sorun:** `20260628153800_AddLoyaltyEducationMenuQrModules` migration'ı `__EFMigrationsHistory`
tablosunda kayıtlı ve aynı migration'daki Loyalty tabloları (`LoyaltyRules`, `Rewards`,
`RewardRedemptions`) mevcut. Ancak `MobileMenuItems` ve `MobileMenuBanners` tabloları
DB'de oluşmamış. Sonuç: MobileMenu modülünün TÜM uçları `42P01: relation does not exist`
ile HTTP 500 döndürüyordu (`/api/v1/mobile-menu/*`).

**Çözüm:** Eksik iki tabloyu ve index'lerini migration şemasına birebir uygun,
`IF NOT EXISTS` ile idempotent şekilde oluşturur. Veri kaybı riski yoktur (boş tablolar).

**Uygulama:**
```
PGPASSWORD='...' psql -h <host> -p <port> -U <user> -d nexora \
  -f scripts/repair/2026-07-03_repair_mobilemenu_tables.sql
```
