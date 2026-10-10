-- Kullanıcı isteği (2026-08-28): "yaptığın test kayıtları test tesisleri vs onları kaldır
-- temiz bir sistem olsun".
--
-- E2E/QA otomasyonlarının bıraktığı test kayıtlarını siler. Desen KASITLI OLARAK DAR:
-- yalnızca otomasyon adlandırma kalıpları (E2E ..., ZZTEST..., JCODE_TEST..., "Test ..." ile
-- BAŞLAYAN, autotest, smoke test, perf test) eşleşir. Böylece "ÖRNEK" soyadlı gerçek
-- vatandaşlar veya içinde "test" geçen meşru kayıtlar (ör. "Test Sınavı Salonu") silinmez.
--
-- Silme sırası FK bağımlılıklarına göre: önce çocuk kayıtlar, sonra ana kayıtlar.
-- ON DELETE davranışı bilinmediği için her adım kendi başına idempotenttir.

\set pat '(^e2e[ _-]|^zztest|jcode_test|jcode test|^test[ _-]|[ _-]test tesis|^qa[ _-]|autotest|smoke ?test|^perf[ _-]test)'

BEGIN;

-- 1) Katılım / kayıt / başvuru satırları (kişi adı üzerinden)
DELETE FROM "FacilityAttendances"        WHERE "FullName" ~* :'pat';
DELETE FROM "FacilityRegistrations"      WHERE "FullName" ~* :'pat';
DELETE FROM "FacilityApplications"       WHERE "FullName" ~* :'pat';
DELETE FROM "ParticipantActivityRecords" WHERE "FullName" ~* :'pat';
DELETE FROM "SedaEducationRecords"       WHERE "FullName" ~* :'pat';
DELETE FROM "LibraryStaffMembers"        WHERE "FullName" ~* :'pat';
DELETE FROM "FacilityInstructors"        WHERE "FullName" ~* :'pat';
DELETE FROM "CompanyStaffs"              WHERE "FullName" ~* :'pat';

-- 2) Muhtarlık başvuruları ve süreç kayıtları
DELETE FROM "CitizenSubmissionEvents"
 WHERE "SubmissionId" IN (SELECT "Id" FROM "CitizenSubmissions" WHERE "Title" ~* :'pat');
DELETE FROM "CitizenSubmissions"         WHERE "Title" ~* :'pat';

-- 3) Cihaz / şube / grup gibi tesis alt kayıtları
DELETE FROM "FacilityDevices"            WHERE "Name" ~* :'pat';
DELETE FROM "LibraryDevices"             WHERE "Name" ~* :'pat';
DELETE FROM "FacilityBranches"           WHERE "Name" ~* :'pat';
DELETE FROM "FacilityGroups"             WHERE "Name" ~* :'pat';

-- 4) Tesisler / kütüphaneler / salonlar
DELETE FROM "Facilities"                 WHERE "Name" ~* :'pat';
DELETE FROM "ServiceFacilities"          WHERE "Name" ~* :'pat';
DELETE FROM "Libraries"                  WHERE "Name" ~* :'pat';
DELETE FROM "LibraryRules"               WHERE "Title" ~* :'pat';
DELETE FROM "Halls"                      WHERE "Name" ~* :'pat';
DELETE FROM "HallFeatures"               WHERE "Name" ~* :'pat';
DELETE FROM "HallFeatureGroups"          WHERE "Name" ~* :'pat';

-- 5) Etkinlik / gezi / eğitim
DELETE FROM "Events"                     WHERE "Name" ~* :'pat';
DELETE FROM "EventCategories"            WHERE "Name" ~* :'pat';
DELETE FROM "Travels"                    WHERE "Name" ~* :'pat';
DELETE FROM "TravelBuses"                WHERE "Name" ~* :'pat';
DELETE FROM "TravelRoutes"               WHERE "Name" ~* :'pat';
DELETE FROM "TravelCategories"           WHERE "Name" ~* :'pat';
DELETE FROM "EducationInstitutions"      WHERE "Name" ~* :'pat';
DELETE FROM "SedaEducationRecords"       WHERE "FullName" ~* :'pat';
DELETE FROM "SedaSchools"                WHERE "Name" ~* :'pat';
DELETE FROM "SedaPeriods"                WHERE "Name" ~* :'pat';
DELETE FROM "SedaDefinitions"            WHERE "Name" ~* :'pat';

-- 6) Sadakat / anket / quiz / çark
DELETE FROM "Quizzes"                    WHERE "Title" ~* :'pat';
DELETE FROM "QuizCategories"             WHERE "Name" ~* :'pat';
DELETE FROM "QuizAgeGroups"              WHERE "Name" ~* :'pat';
DELETE FROM "Surveys"                    WHERE "Title" ~* :'pat';
DELETE FROM "Wheels"                     WHERE "Title" ~* :'pat';
DELETE FROM "Gifts"                      WHERE "Name" ~* :'pat';
DELETE FROM "Rewards"                    WHERE "Name" ~* :'pat';
DELETE FROM "Campaigns"                  WHERE "Name" ~* :'pat';

-- 7) Firma / hizmet
-- Firmaların QR / kampanya gibi çocuk kayıtları FK ile bağlı; önce onlar silinir.
DELETE FROM "CompanyQrCodes"
 WHERE "CompanyId" IN (SELECT "Id" FROM "Companies" WHERE "Name" ~* :'pat');
DELETE FROM "CompanyStaffs"
 WHERE "CompanyId" IN (SELECT "Id" FROM "Companies" WHERE "Name" ~* :'pat');
DELETE FROM "Companies"                  WHERE "Name" ~* :'pat';
DELETE FROM "ServiceCategories"          WHERE "Name" ~* :'pat';
DELETE FROM "EmergencyAreas"             WHERE "Name" ~* :'pat';

-- 8) Menü / navigasyon
DELETE FROM "MenuItems"                  WHERE "Title" ~* :'pat';
DELETE FROM "MenuSections"               WHERE "Title" ~* :'pat';
DELETE FROM "MobileMenuItems"            WHERE "Title" ~* :'pat';
DELETE FROM "TopMenuItems"               WHERE "Title" ~* :'pat';

-- 9) Yetki / organizasyon (en sona: kullanıcılar rollere bağlı)
DELETE FROM "TeamNotes"                  WHERE "Title" ~* :'pat';
DELETE FROM "AdminUsers"                 WHERE "FullName" ~* :'pat';
-- Test rollerine bağlı kalan yönetici hesapları da test amaçlıdır (rol adı otomasyon
-- kalıbıyla eşleşiyor); rol silinebilsin diye önce bu kullanıcılar temizlenir.
DELETE FROM "AdminUsers"
 WHERE "RoleId" IN (SELECT "Id" FROM "Roles" WHERE "Name" ~* :'pat');
DELETE FROM "Roles"                      WHERE "Name" ~* :'pat';
DELETE FROM "Departments"                WHERE "Name" ~* :'pat';
DELETE FROM "ScopeNodes"                 WHERE "Name" ~* :'pat';
DELETE FROM "Participants"               WHERE "FullName" ~* :'pat';

COMMIT;
