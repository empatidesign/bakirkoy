// Kullanıcı isteği (2026-09-02): "sistem internet bağlantısını kontrol etsin, internet yoksa
// verileri cache'e yazsın, internet geldiğinde otomatik senkronize etsin." Saha görevlisi
// sahada (bodrum, asansör, kırsal alan) sık sık bağlantı kaybedebilir; anket/talep kaydı asla
// kaybolmamalı. Bu modül genel bir "gönderilemeyen kayıt kuyruğu" tutar:
//  - Gönderim başarısız olur ve sebep AĞ HATASIYSA (sunucudan hiç yanıt gelmediyse — 4xx/5xx
//    değil) kayıt localStorage'a yazılır, kullanıcıya "cihazda saklandı" denir.
//  - `online` olayında (ve sayfa her yüklendiğinde, tarayıcı zaten çevrimiçiyse) otomatik
//    olarak sırayla tekrar gönderilmeye çalışılır; başarılı olanlar kuyruktan silinir.
//  - İdempotency: anket yanıtları zaten `localUuid` ile sunucu tarafında tekilleştiriliyor
//    (bkz. ParticipantSurveyService.Field.cs) — aynı kayıt iki kez gönderilse bile sunucu
//    ikinci isteği aynı sonucu döndürür, mükerrer kayıt oluşmaz.
import { toast } from 'sonner'
import type { FieldSubmitPayload, FieldCitizenSubmissionPayload } from '@/types/fieldSurvey.types'

interface QueuedSurveySubmit {
  id: string
  kind: 'survey_submit'
  taskId: string
  payload: FieldSubmitPayload
  queuedAt: string
}
interface QueuedCitizenSubmission {
  id: string
  kind: 'citizen_submission'
  payload: FieldCitizenSubmissionPayload
  queuedAt: string
}
type QueuedItem = QueuedSurveySubmit | QueuedCitizenSubmission

const STORAGE_KEY = 'nexora_field_offline_queue'

// Kullanıcı isteği (2026-09-02): Android tablet uygulamasında kayıtlar cihazda kalıcı
// saklanmalı ve internet gelince uygulama kapalıyken bile gönderilmeli. Tarayıcının
// localStorage'ı bunu garanti edemez (WebView verisi temizlenebilir, sayfa kapalıyken
// hiçbir deneme yapılamaz). Tablet kabuğu bir native köprü (AnketTablet) enjekte eder;
// varsa kayıt SQLite tabanlı native kuyruğa yazılır, yoksa eski localStorage yolu kullanılır.
interface AnketTabletBridge {
  queue: (endpoint: string, body: string, authToken: string, label: string) => void | boolean
  pendingCount?: () => number
  flushNow?: () => void
  isTabletApp?: () => boolean
}
const nativeBridge = (): AnketTabletBridge | null => {
  const b = (globalThis as { AnketTablet?: AnketTabletBridge }).AnketTablet
  return b && typeof b.queue === 'function' ? b : null
}

const authToken = (): string => {
  for (const key of ['portal_access_token', 'accessToken', 'access_token', 'nexora_access_token']) {
    const v = localStorage.getItem(key)
    if (v) return v.replace(/^"|"$/g, '')
  }
  return ''
}

const readQueue = (): QueuedItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueuedItem[]) : []
  } catch { return [] }
}

/**
 * Düzeltme (2026-09-05, denetim bulgusu): `localStorage.setItem` kota dolu/private-mode
 * gibi sebeplerle SESSİZCE başarısız olabiliyordu; çağıran taraf bunu her zaman "kuyruğa
 * alındı" sayıp formu temizliyordu — yazma gerçekte tutmadıysa vatandaşın kaydı kalıcı
 * olarak kayboluyordu. Artık yazmanın gerçekten tuttuğu ayrıca doğrulanır (setItem
 * sonrası geri okunup karşılaştırılır) ve sonuç boolean olarak döner; enqueue*
 * fonksiyonları bu sonucu çağırana iletir.
 */
const writeQueue = (items: QueuedItem[]): boolean => {
  try {
    const serialized = JSON.stringify(items)
    localStorage.setItem(STORAGE_KEY, serialized)
    return localStorage.getItem(STORAGE_KEY) === serialized
  } catch {
    return false
  }
}

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`)

// Dinleyiciler: kuyruk uzunluğu değiştiğinde UI (üst bar rozeti) güncellensin diye.
type Listener = (length: number) => void
const listeners = new Set<Listener>()
const notify = () => { const n = getFieldOfflineQueueLength(); listeners.forEach((l) => l(n)) }

export function subscribeFieldOfflineQueue(listener: Listener): () => void {
  listeners.add(listener)
  listener(getFieldOfflineQueueLength())
  return () => { listeners.delete(listener) }
}

export function getFieldOfflineQueueLength(): number {
  const bridge = nativeBridge()
  if (bridge?.pendingCount) {
    try { return bridge.pendingCount() } catch { /* köprü hatası: yerel kuyruğa düş */ }
  }
  return readQueue().length
}

/** Dönüş değeri: kayıt gerçekten kalıcı olarak saklandı mı (false ise arayan taraf
 *  kullanıcıya "cihaza kaydedilemedi" demeli, taslağı SİLMEMELİ). */
export function enqueueSurveySubmit(taskId: string, payload: FieldSubmitPayload): boolean {
  const bridge = nativeBridge()
  if (bridge) {
    const ok = bridge.queue(
      `/me/surveys/field/tasks/${taskId}/responses`,
      JSON.stringify(payload),
      authToken(),
      'Anket yanıtı (çevrimdışı)',
    )
    notify()
    // Eski köprü sürümleri undefined/void dönebilir; bu durumda geriye dönük uyumluluk
    // için "başarılı" varsayılır (bridge zaten kendi hata yönetimini yapar).
    return ok !== false
  }
  const items = readQueue()
  items.push({ id: newId(), kind: 'survey_submit', taskId, payload, queuedAt: new Date().toISOString() })
  const ok = writeQueue(items)
  notify()
  return ok
}

export function enqueueCitizenSubmission(payload: FieldCitizenSubmissionPayload): boolean {
  const bridge = nativeBridge()
  if (bridge) {
    const ok = bridge.queue(
      '/me/surveys/field/submissions',
      JSON.stringify(payload),
      authToken(),
      'Talep/öneri/şikayet (çevrimdışı)',
    )
    notify()
    return ok !== false
  }
  const items = readQueue()
  items.push({ id: newId(), kind: 'citizen_submission', payload, queuedAt: new Date().toISOString() })
  const ok = writeQueue(items)
  notify()
  return ok
}

// Gerçek ağ isteklerini yapan gönderici — fieldSurvey.service.ts modül yüklenirken kaydeder.
// Döngüsel import'tan kaçınmak için bu dosya servisi DEĞİL, servis bu dosyayı içe aktarır.
interface OfflineSender {
  sendSurveySubmit: (taskId: string, payload: FieldSubmitPayload) => Promise<unknown>
  sendCitizenSubmission: (payload: FieldCitizenSubmissionPayload) => Promise<unknown>
}
let sender: OfflineSender | null = null
export function registerFieldOfflineSender(s: OfflineSender): void { sender = s }

let flushing = false

/** Kuyruktaki her kaydı sırayla tekrar göndermeyi dener; başarılı olanlar kuyruktan silinir. */
export async function flushFieldOfflineQueue(): Promise<{ sent: number; remaining: number }> {
  const bridge = nativeBridge()
  if (bridge) {
    // Tablet uygulamasında gönderimi WorkManager yürütür; burada yalnızca tetiklenir.
    try { bridge.flushNow?.() } catch { /* yok say */ }
    notify()
    return { sent: 0, remaining: getFieldOfflineQueueLength() }
  }
  const items = readQueue()
  if (flushing || items.length === 0 || !sender) return { sent: 0, remaining: items.length }
  // navigator.onLine SADECE false olduğunda güvenilir bir bilgidir (tablette ağ
  // tamamen kapalıyken bile true dönüyor — ölçüldü). true iken engellemeye
  // çalışmak yanlış olur; gönderim denemesi zaten gerçek testtir.
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { sent: 0, remaining: items.length }

  flushing = true
  try {
    const stillPending: QueuedItem[] = []
    let sent = 0
    for (const item of items) {
      try {
        if (item.kind === 'survey_submit') await sender.sendSurveySubmit(item.taskId, item.payload)
        else await sender.sendCitizenSubmission(item.payload)
        sent++
      } catch {
        // Hâlâ gönderilemiyor (ağ ya da sunucu hatası) — kuyrukta kalır, bir sonraki
        // "online" olayında veya bir sonraki flush çağrısında tekrar denenir.
        stillPending.push(item)
      }
    }
    writeQueue(stillPending)
    notify()
    if (sent > 0) {
      toast.success(
        sent === 1 ? '1 bekleyen kayıt sunucuya gönderildi.' : `${sent} bekleyen kayıt sunucuya gönderildi.`,
      )
    }
    return { sent, remaining: stillPending.length }
  } finally {
    flushing = false
  }
}

/**
 * Ölçüm bulgusu (2026-09-03, VIA_L40 / Android 13 tablet): Wi-Fi kapatılıp
 * yeniden açıldığında WebView'de 'online'/'offline' olayları HİÇ tetiklenmedi
 * ve navigator.onLine sürekli true kaldı. Yani kuyruk yalnızca 'online'
 * olayına bağlı kalsaydı, sahada ağ geri geldiğinde kayıtlar asla gönderilmez,
 * anketör uygulamayı elle kapatıp açana dek beklerdi.
 *
 * Bu yüzden bekleyen kayıt varken düzenli aralıklarla gönderim denenir. Deneme
 * zaten gerçek bağlantı testidir; ayrıca bir yoklama isteğine gerek yoktur.
 * Kuyruk boşken zamanlayıcı çalışmaz, yani boşa pil/trafik harcanmaz.
 */
const RETRY_INTERVAL_MS = 20_000
let retryTimer: number | null = null

const stopRetryTimer = () => {
  if (retryTimer !== null) { window.clearInterval(retryTimer); retryTimer = null }
}

const ensureRetryTimer = () => {
  if (typeof window === 'undefined') return
  if (getFieldOfflineQueueLength() === 0) { stopRetryTimer(); return }
  if (retryTimer !== null) return
  retryTimer = window.setInterval(() => {
    if (getFieldOfflineQueueLength() === 0) { stopRetryTimer(); return }
    if (document.hidden) return // arka planda pil harcama
    void flushFieldOfflineQueue()
  }, RETRY_INTERVAL_MS)
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void flushFieldOfflineQueue() })
  // Uygulama öne geldiğinde de dene: anketör ekranı açtığında ağ dönmüş olabilir.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void flushFieldOfflineQueue()
  })
  // Kuyruk uzunluğu değiştikçe zamanlayıcıyı aç/kapat.
  subscribeFieldOfflineQueue(() => ensureRetryTimer())
  // Sayfa açıldığında önceki oturumdan kalan kuyruğu da dene.
  window.setTimeout(() => { void flushFieldOfflineQueue() }, 1500)
}
