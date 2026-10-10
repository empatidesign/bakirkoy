-- Kullanıcı isteği (2026-09-26): Etkinlik modülünü sıfırdan kurmadan önce mevcut
-- test/QA/UAT kalıntılarını temizle. Bu script'i çalıştırmadan önce tam DB yedeği
-- alındı: _db_backups/etkinlik-modul-oncesi/nexora_full_20260926_214711.dump
--
-- Kapsam dry-run ile doğrulandı (2026-09-26): "Events" tablosundaki TÜM 55 kayıt
-- (aktif+silinmiş) bu kalıpla eşleşiyor — hiçbir gerçek/canlı etkinlik yok, hepsi
-- Test/UAT/[TEST-xxxx]/[DEBUG]/[REPRO] önekli otomasyon kalıntısı.
-- Halls: sadece UAT/TEST/Audit önekli 6 test salonu silinir; gerçek isimli üretim
-- salonları (Boks Odası, Düğün Salonu, Toplantı Salonu vb.) KORUNUR.
-- EventCategories: sadece BC/RemCat/DashLeak/XSSCat/FixCat/Race/Audit/[DEBUG]/[REPRO]/
-- [TEST-xxxx] kalıntıları silinir; gerçek isimli kategoriler (Kültür ve Sanat, Spor ve
-- Sağlıklı Yaşam, Aile ve Sosyal Etkinlikler vb.) KORUNUR.
--
-- Silme sırası FK bağımlılıklarına göre: önce çocuk kayıtlar (activities, applications,
-- sessions, reviews), sonra Events/Halls/EventCategories.

BEGIN;

-- 1) Yoklama kayıtları (Events'e bağlı)
DELETE FROM "EventActivities"
 WHERE "EventId" IN (
   SELECT "Id" FROM "Events"
   WHERE "Name" ~* '(^uat[ ·]|^\[test|test$| test$|^\[debug\]|^\[repro\]|^bc |^remcat|dashleak|xsscat|racems|^fixcat|^audit )'
 );

-- 2) Başvurular (Events'e bağlı)
DELETE FROM "EventApplications"
 WHERE "EventId" IN (
   SELECT "Id" FROM "Events"
   WHERE "Name" ~* '(^uat[ ·]|^\[test|test$| test$|^\[debug\]|^\[repro\]|^bc |^remcat|dashleak|xsscat|racems|^fixcat|^audit )'
 );

-- 3) Seanslar (Events'e bağlı)
DELETE FROM "Sessions"
 WHERE "EventId" IN (
   SELECT "Id" FROM "Events"
   WHERE "Name" ~* '(^uat[ ·]|^\[test|test$| test$|^\[debug\]|^\[repro\]|^bc |^remcat|dashleak|xsscat|racems|^fixcat|^audit )'
 );

-- 4) Etkinlik yorumları (varsa)
DELETE FROM "EventReviews"
 WHERE "EventId" IN (
   SELECT "Id" FROM "Events"
   WHERE "Name" ~* '(^uat[ ·]|^\[test|test$| test$|^\[debug\]|^\[repro\]|^bc |^remcat|dashleak|xsscat|racems|^fixcat|^audit )'
 );

-- 5) Etkinliklerin kendisi
DELETE FROM "Events"
 WHERE "Name" ~* '(^uat[ ·]|^\[test|test$| test$|^\[debug\]|^\[repro\]|^bc |^remcat|dashleak|xsscat|racems|^fixcat|^audit )';

-- 6) Test/UAT/debug salonları (Halls)
DELETE FROM "Halls"
 WHERE "Name" ~* '(^uat[ ·]|^\[test|test$| test$|^\[debug\]|^\[repro\]|^bc |^remcat|dashleak|xsscat|racems|^fixcat|^audit )';

-- 7) Test/debug kategorileri
DELETE FROM "EventCategories"
 WHERE "Name" ~* '(^uat[ ·]|^\[test|test$| test$|^\[debug\]|^\[repro\]|^bc |^remcat|dashleak|xsscat|racems|^fixcat|^audit )';

COMMIT;
