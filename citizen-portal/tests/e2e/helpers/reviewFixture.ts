import { execFileSync } from 'node:child_process'

// Değerlendirme akışı testi TEK KULLANIMLIKTIR: yorum gönderilince EventReviews'a
// kayıt düşer ve aynı etkinlik bir daha canReview=true dönmez. Fixture'sız yazılırsa
// test ilk koşuda geçer, sonraki HER koşuda sessizce skip'e düşer — yani "yeşil" görünen
// ama aslında hiçbir şeyi doğrulamayan bir spec olur. Bu yüzden her koşu kendi
// değerlendirilebilir etkinliğini üretir.
//
// canReview = !alreadyReviewed && withinWindow && checkedIn  (HistoryService.cs:117)
// Üretilen kayıt üç koşulu da sağlar: 2 gün önce bitmiş etkinlik (14 günlük pencere içi),
// approved başvuru ve 'check_in' aktivitesi.

const PG = {
  host: process.env.E2E_PGHOST || 'localhost',
  port: process.env.E2E_PGPORT || '34100',
  user: process.env.E2E_PGUSER || 'nexora_admin',
  db: process.env.E2E_PGDATABASE || 'nexora',
  password: process.env.E2E_PGPASSWORD!,
}

function runSql(sql: string): string {
  return execFileSync(
    'psql',
    ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', PG.db, '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { env: { ...process.env, PGPASSWORD: PG.password }, encoding: 'utf8' },
  ).trim()
}

export function psqlAvailable(): boolean {
  try {
    runSql('select 1')
    return true
  } catch {
    return false
  }
}

/**
 * E2E vatandaşı için değerlendirilebilir (canReview=true) yeni bir etkinlik üretir.
 * Şablon olarak mevcut bir etkinliğin sütunlarını kopyalar; böylece AccessJson/PricingJson
 * gibi zorunlu jsonb alanları şemayla uyumlu kalır ve yeni sütun eklenince test kırılmaz.
 */
export function seedReviewableEvent(tckn: string): string {
  return runSql(`
DO $$
DECLARE
  v_ev uuid := gen_random_uuid();
  v_pid uuid;
  v_src uuid;
  v_end timestamp := date_trunc('day', now()) - interval '2 days' + interval '12 hours';
  v_code text;
  v_appcode text;
BEGIN
  SELECT "Id" INTO v_pid FROM "Participants" WHERE "Tckn" = '${tckn}' AND "IsDeleted" = false;
  IF v_pid IS NULL THEN RAISE EXCEPTION 'E2E katılımcısı bulunamadı: ${tckn}'; END IF;

  SELECT "Id" INTO v_src FROM "Events" WHERE "IsDeleted" = false ORDER BY "CreatedAt" DESC LIMIT 1;
  IF v_src IS NULL THEN RAISE EXCEPTION 'Şablon etkinlik yok'; END IF;

  SELECT 'EVT-' || lpad((COALESCE(MAX(NULLIF(regexp_replace("Code",'\\D','','g'),''))::int,0)+1)::text, 6, '0')
    INTO v_code FROM "Events" WHERE "Code" LIKE 'EVT-%';
  SELECT 'EVA-' || lpad((COALESCE(MAX(NULLIF(regexp_replace("Code",'\\D','','g'),''))::int,0)+1)::text, 6, '0')
    INTO v_appcode FROM "EventApplications";

  INSERT INTO "Events"
  SELECT v_ev, v_code, 'E2E Değerlendirme Fixture', "CategoryId", "VenueType", "FacilityId", "HallId",
         "LocationJson", v_end - interval '2 hours', v_end, "IsSingleDay", 'mixed', "Capacity",
         "ReserveCapacity", 0, 0, 'none', 0,
         'değerlendirme akışı e2e fixture', "InternalNote", "ImagesJson", "AccessJson", "PricingJson",
         "PointsJson", true, 1, 0, 0, "CreatedBy", NULL, NULL, now(), NULL, false, NULL,
         NULL, NULL, false, false, "EndTime", "StartTime", 'anyone'
  FROM "Events" WHERE "Id" = v_src;

  INSERT INTO "EventApplications"
    ("Id","Code","EventId","SessionId","ParticipantId","ReferenceDate","Status","DocumentStatus",
     "PaymentStatus","HasCompanion","CompanionCount","SeatNumber","AppliedBy","CreatedAt","IsDeleted")
  VALUES (gen_random_uuid(), v_appcode, v_ev, NULL, v_pid, v_end, 'approved', 'none', 'none',
          false, 0, NULL, 'E2E Fixture', now() - interval '5 days', false);

  INSERT INTO "EventActivities"
    ("Id","Kind","At","EventId","SessionId","ParticipantId","ParticipantName","Tckn","Method",
     "Status","WalkIn","PointsAwarded","CreatedAt","IsDeleted")
  SELECT gen_random_uuid(), 'check_in', v_end - interval '1 hour', v_ev, NULL, v_pid,
         p."FullName", p."Tckn", 'qr', 'success', false, 0, now(), false
  FROM "Participants" p WHERE p."Id" = v_pid;
END $$;
  `)
}
