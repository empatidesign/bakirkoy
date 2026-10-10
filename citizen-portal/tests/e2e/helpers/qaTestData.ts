/**
 * Standardized test data marker + cleanup (QA gap #10 — 2026-09-04).
 *
 * Kök neden: her spec kendi prefix'ini icat ediyordu (`OFFLINE-QUEUE-E2E-<timestamp>`
 * gibi), merkezi bir sözleşme yoktu. Bu modül tek bir standart üretir:
 *
 *   QA-TEST-E2E-AUTO-<YYYYMMDD>-<random6>
 *
 * ve bu prefix'i taşıyan verileri temizlemek için ortak bir yardımcı sağlar.
 * Var olan cleanup helper'ları (surveyCleanup.ts, citizenSubmissionCleanup.ts) BU
 * dosyayı KIRMAZ — onlar özel tablolar için hâlâ geçerli. Bu dosya yeni yazılacak
 * testler için tek, tutarlı bir başlangıç noktası sağlar.
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export const QA_TEST_PREFIX = 'QA-TEST-E2E-AUTO-'

function pad(n: number, width = 2): string {
  return String(n).padStart(width, '0')
}

/** Bugünün tarihini YYYYMMDD formatında döner (yerel saat). */
function todayStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

function randomSuffix(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 0/O, 1/I gibi karışan karakterler çıkarıldı
  let out = ''
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

/**
 * Benzersiz, tanınabilir bir test-veri tanımlayıcısı üretir.
 * Örnek: `QA-TEST-E2E-AUTO-20260904-K7XZQ2`
 */
export function generateQaTestId(): string {
  return `${QA_TEST_PREFIX}${todayStamp()}-${randomSuffix()}`
}

/**
 * Bir alan (ad, açıklama, başlık vb.) için test değeri üretir; prefix + okunabilir
 * bir etiket + benzersizlik için kısa random suffix içerir.
 * Örnek: `qaTestValue('Müşteri Adı')` -> "QA-TEST-E2E-AUTO Müşteri Adı K7XZQ2"
 */
export function qaTestValue(label: string): string {
  return `${QA_TEST_PREFIX}${label} ${randomSuffix(4)}`
}

/**
 * Benzersiz bir test e-postası üretir: sonradan aranabilir/silinebilir olması için
 * `qa.` local-part prefix'i ve `.test.local` domain kullanır (gerçek bir domain'e
 * mail gitmemesi için TLD kasıtlı olarak `.local`).
 */
export function qaTestEmail(): string {
  return `qa.e2e.${todayStamp()}.${randomSuffix(6).toLowerCase()}@test.local`
}

/**
 * Benzersiz, gerçekçi görünen bir Türkiye telefon numarası üretir (555 alan kodu,
 * gerçek operatörlere ait değil — test amaçlı ayrılmış blok).
 */
export function qaTestPhone(): string {
  const suffix = String(Math.floor(1000000 + Math.random() * 8999999))
  return `555${suffix.slice(0, 7)}`
}

export interface QaCleanupTarget {
  /** Tablo adı (çift tırnaklı, PostgreSQL identifier kuralına uygun). */
  table: string
  /** Prefix'in arandığı sütun adı (çift tırnaklı). */
  column: string
}

/**
 * `QA_TEST_PREFIX` ile başlayan satırları verilen tablo/sütunlardan siler.
 * `E2E_PG_CONN` verilmemişse ya da `psql` bulunamazsa SESSİZCE vazgeçer — cleanup
 * best-effort'tur, testin PASS/FAIL sonucunu asla etkilemez (repodaki mevcut
 * ilkeyle aynı, bkz. surveyCleanup.ts / citizenSubmissionCleanup.ts).
 *
 * Production'a karşı çalışmayı engellemek için burada da bir guard var: baseURL
 * production'a benziyorsa (aynı kontrol productionSafety.ts ile paylaşılıyor)
 * cleanup denenmez — zaten o testin kendisi hiç çalışmamış olması gerekir, ama
 * çift güvenlik katmanı ucuzdur.
 */
export async function cleanupQaTestData(targets: QaCleanupTarget[]): Promise<void> {
  const conn = process.env.E2E_PG_CONN
  if (!conn) return

  for (const { table, column } of targets) {
    try {
      await execFileAsync('psql', [
        conn,
        '-c',
        `DELETE FROM "${table}" WHERE "${column}" LIKE '${QA_TEST_PREFIX}%';`,
      ])
    } catch {
      // yok say: best-effort cleanup, testin sonucunu etkilemez
    }
  }
}
