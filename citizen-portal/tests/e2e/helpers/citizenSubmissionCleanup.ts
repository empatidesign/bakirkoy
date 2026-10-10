import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * Kullanıcı isteği (2026-09-02): "test verilerinin her zaman temizlenmesi" (repo alışkanlığı,
 * bkz. surveyCleanup.ts). CitizenSubmission (Muhtarlık talep/öneri/şikayet) kayıtları için
 * admin API'de silme ucu yok (vatandaş başvurusu kasıtlı olarak kalıcıdır — denetim izi).
 * Bu yüzden E2E'nin ürettiği test kayıtları doğrudan veritabanından, başlıktaki benzersiz
 * test işaretleyicisiyle (ör. "OFFLINE-QUEUE-E2E-<timestamp>") silinir.
 *
 * `psql` bulunamazsa veya bağlantı başarısız olursa hata YUTULUR — temizlik testin
 * PASS/FAIL sonucunu asla etkilemez (bkz. SurveyTrash.purge ile aynı ilke).
 */
export async function purgeCitizenSubmissionsByTitlePrefix(titlePrefix: string): Promise<void> {
  const conn = process.env.E2E_PG_CONN
  if (!conn) return // bağlantı bilgisi verilmemişse sessizce vazgeç (CI'da farklı olabilir)
  try {
    await execFileAsync('psql', [
      conn,
      '-c',
      `DELETE FROM "CitizenSubmissions" WHERE "Title" LIKE '${titlePrefix.replace(/'/g, "''")}%';`,
    ])
  } catch {
    // yok say: temizlik en iyi çaba ilkesiyle çalışır
  }
}
